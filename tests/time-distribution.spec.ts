import { expect, test, type Page } from "@playwright/test";
import { activityColor, buildActivityDistribution, formatActivityDuration } from "../src/activityColors";

const MINUTE = 60_000;
const TODAY = "2026-10-03";
const STORAGE = "jixiang-prototype-state-v5";
const group = (subject: string, minutes: number, taskKind = "custom") => ({ subject, actualMs: minutes * MINUTE, taskKind });

test("activity totals merge repeated directions without dropping short focus fragments", () => {
  const groups = [group("科研阅读", 25), group("数学", 9), group(" 科研阅读 ", 10), group("写作", .5), group("无效", -3), group("无效", NaN)];
  const { totalMs, activities } = buildActivityDistribution(groups);
  expect(totalMs).toBe(44.5 * MINUTE);
  expect(activities).toHaveLength(3);
  expect(activities.find(item => item.label === "科研阅读")?.actualMs).toBe(35 * MINUTE);
  expect(activities.reduce((sum, item) => sum + item.percentage, 0)).toBeCloseTo(100);
  expect(formatActivityDuration(30_000)).toBe("30 秒");
  expect(formatActivityDuration(91_000)).toBe("1 分 31 秒");
});

test("activity colors are stable across date ordering, duration, and unrelated task kinds", () => {
  const groups = [group("自选项目", 7, "coding"), group("自选项目", 3, "reading"), group("数学", 9), group("科研阅读", 5), group("写作", 6), group("运动", 8)];
  expect(buildActivityDistribution(groups).activities).toEqual(buildActivityDistribution([...groups].reverse()).activities);
  expect(new Set(["数学", "科研阅读", "写作", "运动"].map(activityColor)).size).toBe(4);
  expect(activityColor(" MATH ")).toBe(activityColor("math"));
  expect(buildActivityDistribution([group("自选项目", 100, "reading")]).activities[0].color).toBe(activityColor("自选项目"));
  expect(buildActivityDistribution([group("阅读", 0)])).toEqual({ totalMs: 0, activities: [] });
});

async function openRecordedApp(page: Page) {
  await page.clock.install({ time: new Date("2026-10-03T12:00:00+08:00") });
  const tasks = [
    { id: "reading", title: "读完论文摘要", subject: "科研阅读", minutes: 25 },
    { id: "math", title: "整理数学错题", subject: "数学", minutes: 9 },
    { id: "writing", title: "写一段随笔", subject: "写作", minutes: 8 },
    { id: "sport", title: "出门散步", subject: "运动", minutes: 6 },
  ].map(item => ({ ...item, duration: "30 分钟", planMinutes: 30, actualMs: item.minutes * MINUTE, status: "ready", color: "sage", kind: "custom", expectedArtifact: "留下今天的记录", revisionCount: 0 }));
  const focusLogs = tasks.map(task => ({ id: `focus-${task.id}`, dateKey: TODAY, taskId: task.id, startedAt: 1, endedAt: 1 + task.actualMs, durationMs: task.actualMs }));
  focusLogs.push({ id: "old-reading", dateKey: "2026-10-02", taskId: "reading", startedAt: 1, endedAt: 600001, durationMs: 10 * MINUTE });
  const state = { version: 5, tasks, focusSession: { activeTaskId: "reading", status: "idle", startedAt: null }, focusLedger: Object.fromEntries(tasks.map(task => [task.id, task.actualMs])), focusLogs, outcomes: [], diaries: [], dailyEchoes: {}, weeklyEchoes: [], notes: [], milestones: [], blockers: [], experiments: [], preferences: { reduceMotion: true }, stampStyles: {}, stampBook: { version: 5, styleAssignments: {} } };
  await page.addInitScript(({ state, storage }) => { localStorage.setItem(storage, JSON.stringify(state)); sessionStorage.setItem("jixiang-welcome-seen-v1", "yes"); }, { state, storage: STORAGE });
  await page.goto("/");
  await page.getByRole("navigation", { name: "主要导航" }).getByRole("button", { name: "足迹", exact: true }).click();
  return state;
}

test.use({ timezoneId: "Asia/Shanghai" });

test("day, week and month share activity colors and legend selection preserves original evidence", async ({ page }) => {
  const seeded = await openRecordedApp(page);
  await page.setViewportSize({width:390,height:844});
  await page.getByRole("button", { name: `查看 ${TODAY} 的记录`, exact: true }).click();
  const ring = page.getByTestId("time-distribution");
  await ring.scrollIntoViewIfNeeded();
  await expect(ring).toHaveAttribute("data-total-ms", String(48 * MINUTE));
  const mathLegend = ring.getByRole("button", { name: /数学/ });
  await mathLegend.focus();
  await page.keyboard.press("Enter");
  await expect(mathLegend).toHaveAttribute("aria-pressed", "true");
  await expect(ring.locator(".activity-distribution-story")).toContainText("9 分钟");
  await expect(ring.locator('circle[data-activity="数学"]')).toHaveClass(/is-selected/);
  const stroke = await ring.locator('circle[data-activity="数学"]').getAttribute("stroke");
  const dot = await mathLegend.locator(".activity-legend-color").evaluate(el => getComputedStyle(el).backgroundColor);
  expect(dot).toBe("rgb(100, 141, 174)");
  await mathLegend.click();
  await expect(mathLegend).toHaveAttribute("aria-pressed", "false");
  for (const view of ["周回顾", "月度"]) {
    if(await page.locator(".day-toolbar").count())await page.locator(".day-toolbar button").first().click();
    await page.getByRole("tab", {name:"日历",exact:true}).click();
    await page.getByLabel("回看范围").selectOption(view === "周回顾" ? "week" : "month");
    await expect(ring).toHaveAttribute("data-total-ms", String(58 * MINUTE));
    await expect(ring.locator('circle[data-activity="数学"]')).toHaveAttribute("stroke", stroke!);
    await expect(ring.locator('button[data-activity="科研阅读"]')).toHaveAttribute("data-actual-ms", String(35 * MINUTE));
  }
  const after = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORAGE);
  expect(after.focusLogs).toEqual(seeded.focusLogs);
  expect(after.focusLedger).toEqual(seeded.focusLedger);
});

test("donut and legend fit iPhone and Pixel and an empty month does not invent segments", async ({ page }) => {
  await openRecordedApp(page);
  await page.getByLabel("回看范围").selectOption("month");
  const ring = page.getByTestId("time-distribution");
  for (const device of ["iphone", "pixel-10"]) {
    if (device === "pixel-10") { await page.getByTestId("device-picker").click(); await page.getByTestId("device-option-pixel-10").click(); }
    await ring.scrollIntoViewIfNeeded();
    await expect(ring.locator(".activity-ring-segment")).toHaveCount(4);
    const fit = await ring.evaluate(el => ({ fits: el.scrollWidth <= el.clientWidth, svg: el.querySelector("svg")!.getBoundingClientRect().width }));
    expect(fit.fits).toBe(true);
    expect(fit.svg).toBeGreaterThan(120);
  }
  await page.getByRole("button", { name: "上个月", exact: true }).click();
  await expect(ring).toHaveAttribute("data-total-ms", "0");
  await expect(ring.locator(".activity-ring-segment")).toHaveCount(0);
  await expect(ring).toContainText("完成一段真实投入后");
});
