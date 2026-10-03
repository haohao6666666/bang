import { expect, test, type Page } from "@playwright/test";

const STORAGE_KEY = "jixiang-prototype-state-v5";
const SESSION_KEY = "jixiang-welcome-seen-v1";
const NOW = new Date("2026-10-03T12:00:00+08:00");
const MINUTE = 60_000;

function savedState(options: { reduceMotion?: boolean; running?: boolean } = {}) {
  return {
    version: 5,
    tasks: [{ id: "reading", title: "读完论文摘要", subject: "科研阅读", duration: "25 分钟", planMinutes: 25, actualMs: 10 * MINUTE, status: "active", color: "sage", kind: "reading", expectedArtifact: "写下一个核心问题", revisionCount: 0 }],
    focusSession: { activeTaskId: "reading", status: options.running ? "running" : "idle", startedAt: options.running ? NOW.getTime() - 10_000 : null },
    focusLedger: { reading: 10 * MINUTE },
    focusLogs: [{ id: "recorded-focus", dateKey: "2026-10-03", taskId: "reading", startedAt: NOW.getTime() - 20 * MINUTE, endedAt: NOW.getTime() - 10 * MINUTE, durationMs: 10 * MINUTE }],
    outcomes: [{ id: "recorded-outcome", taskId: "reading", dateKey: "2026-10-03", classification: "partial", evidenceType: "summary", body: "已经写下实验使用的对照方法。", createdAt: NOW.getTime() - 9 * MINUTE, version: 1 }],
    diaries: [{ id: "recorded-diary", dateKey: "2026-10-02", text: "昨天把问题写清楚了。", createdAt: NOW.getTime() - 24 * 60 * MINUTE, updatedAt: NOW.getTime() - 24 * 60 * MINUTE }],
    dailyEchoes: {}, weeklyEchoes: [], notes: [], milestones: [], blockers: [], experiments: [], sourceRef: null, methodNote: "从一小步开始。",
    preferences: { focusMode: "short", reminderEnabled: true, echoTime: "21:30", includeDiaryInAI: true, zhihuMatching: false, zhihuConnected: false, reduceMotion: options.reduceMotion ?? false, theme: "paper" },
    stampStyles: {}, stampBook: { version: 5, styleAssignments: {} },
  };
}

async function openApp(page: Page, options: { reduceMotion?: boolean; running?: boolean } = {}) {
  await page.clock.install({ time: NOW });
  await page.clock.pauseAt(new Date(NOW.getTime() + 1_000));
  await page.addInitScript(({ key, state }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state));
  }, { key: STORAGE_KEY, state: savedState(options) });
  await page.goto("/");
  await expect(page.locator(".jixiang-shell")).toBeVisible();
}

async function readState(page: Page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
}

test.use({ timezoneId: "Asia/Shanghai" });

test("first entrance finishes automatically without altering evidence or device chrome", async ({ page }) => {
  await openApp(page);
  const welcome = page.getByTestId("welcome-transition");
  await expect(welcome).toBeVisible();
  await expect(page.getByRole("button", { name: "进入迹向", exact: true })).toBeFocused();
  await expect(page.locator(".app-experience")).toHaveAttribute("inert", "");
  const before = await readState(page);
  const statusBefore = await page.locator(".status-bar").boundingBox();
  const indicatorBefore = await page.locator(".home-indicator-svg").boundingBox();

  await page.clock.runFor(2_200);
  await expect(welcome).toHaveCount(0);
  // Flush the next frame after React removes inert and commits the revealed screen.
  await page.clock.runFor(50);
  await expect(page.locator(".app-experience")).not.toHaveAttribute("inert", "");
  await expect(page.getByRole("heading", { name: "今天，先做这一件。", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "主要导航" })).toBeVisible();
  expect(await readState(page)).toEqual(before);
  expect(await page.locator(".status-bar").boundingBox()).toEqual(statusBefore);
  expect(await page.locator(".home-indicator-svg").boundingBox()).toEqual(indicatorBefore);
  expect(await page.evaluate(key => sessionStorage.getItem(key), SESSION_KEY)).toBe("yes");

  await page.reload();
  await expect(page.getByRole("navigation", { name: "主要导航" })).toBeVisible();
  await expect(welcome).toHaveCount(0);
  expect(await readState(page)).toEqual(before);
});

test("enter button and Escape both skip the welcome immediately", async ({ page }) => {
  await openApp(page);
  const before = await readState(page);
  await page.getByRole("button", { name: "进入迹向", exact: true }).click();
  await expect(page.getByTestId("welcome-transition")).toHaveCount(0);
  expect(await readState(page)).toEqual(before);

  // A fresh session must offer the same keyboard escape without starting any task.
  await page.evaluate(key => sessionStorage.removeItem(key), SESSION_KEY);
  await page.reload();
  await expect(page.getByTestId("welcome-transition")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("welcome-transition")).toHaveCount(0);
  expect(await readState(page)).toEqual(before);
});

test("settings can replay the welcome on Pixel and return to a usable home", async ({ page }) => {
  await openApp(page);
  await page.keyboard.press("Escape");
  await page.clock.runFor(400);
  await page.getByTestId("device-picker").click();
  await page.getByTestId("device-option-pixel-10").click();
  await page.getByRole("navigation", { name: "主要导航" }).getByRole("button", { name: "我的", exact: true }).click();
  await page.clock.runFor(400);
  await expect(page.getByTestId("bottom-sheet")).toBeVisible();
  const before = await readState(page);
  const cameraBefore = await page.getByTestId("device-camera").boundingBox();
  await page.getByRole("button", { name: "重看入场动画", exact: true }).click();
  await page.clock.runFor(1_200);
  await expect(page.getByTestId("bottom-sheet")).toHaveCount(0);
  await expect(page.getByTestId("welcome-transition")).toBeVisible();
  expect(await page.getByTestId("device-camera").boundingBox()).toEqual(cameraBefore);
  await page.clock.runFor(2_200);
  await expect(page.getByTestId("welcome-transition")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "今日路线", exact: true })).toBeVisible();
  expect(await readState(page)).toEqual(before);
  await page.getByRole("navigation", { name: "主要导航" }).getByRole("button", { name: "足迹", exact: true }).click();
  await expect(page.getByRole("tab", { name: "我的印章册", exact: true })).toBeVisible();
});

test("saved reduced motion bypasses entrance and replay leaves the app usable", async ({ page }) => {
  await openApp(page, { reduceMotion: true });
  await expect(page.getByTestId("welcome-transition")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "主要导航" })).toBeVisible();
  const before = await readState(page);
  await page.getByRole("navigation", { name: "主要导航" }).getByRole("button", { name: "我的", exact: true }).click();
  await page.clock.runFor(400);
  await page.getByRole("button", { name: "重看入场动画", exact: true }).click();
  await expect(page.getByTestId("welcome-transition")).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("减少动效已开启");
  expect(await readState(page)).toEqual(before);
});

test("system reduced motion bypasses or immediately closes the entrance", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openApp(page);
  await expect(page.getByTestId("welcome-transition")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "主要导航" })).toBeVisible();
  const before = await readState(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.reload();
  await expect(page.getByTestId("welcome-transition")).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.getByTestId("welcome-transition")).toHaveCount(0);
  await expect(page.locator(".app-experience")).not.toHaveAttribute("inert", "");
  expect(await readState(page)).toEqual(before);
});

test("returning with an active focus session skips welcome and preserves the running log", async ({ page }) => {
  await openApp(page, { running: true });
  await expect(page.getByTestId("welcome-transition")).toHaveCount(0);
  const before = await readState(page);
  await page.getByRole("navigation", { name: "主要导航" }).getByRole("button", { name: "今日", exact: true }).click();
  await expect(page.getByRole("button", { name: "先停一下", exact: true })).toBeVisible();
  const timerBefore = await page.getByLabel("累计投入时间").textContent();
  await page.clock.runFor(3_000);
  await expect(page.getByLabel("累计投入时间")).not.toHaveText(timerBefore!);
  expect(await readState(page)).toEqual(before);
  expect(before.focusSession.startedAt).toBe(NOW.getTime() - 10_000);
  expect(before.focusLogs).toEqual(savedState({ running: true }).focusLogs);
  await page.reload();
  await expect(page.getByTestId("welcome-transition")).toHaveCount(0);
  expect(await readState(page)).toEqual(before);
});

test("replay stays anchored in a small scaled desktop preview", async ({ page }) => {
  await page.setViewportSize({ width: 358, height: 550 });
  await openApp(page);
  await page.keyboard.press("Escape");
  await page.clock.runFor(400);
  const screen = page.getByTestId("device-screen");
  const statusBefore = await page.locator(".status-bar").boundingBox();
  await page.getByRole("navigation", { name: "主要导航" }).getByRole("button", { name: "我的", exact: true }).click();
  await page.clock.runFor(500);
  await page.getByRole("button", { name: "重看入场动画", exact: true }).click();
  await page.clock.runFor(1_200);
  await expect(page.getByTestId("welcome-transition")).toBeVisible();
  expect(await screen.evaluate(el => el.scrollTop)).toBe(0);
  await page.clock.runFor(2_200);
  await expect(page.getByTestId("welcome-transition")).toHaveCount(0);
  expect(await screen.evaluate(el => el.scrollTop)).toBe(0);
  expect(await page.locator(".status-bar").boundingBox()).toEqual(statusBefore);
  const screenRect = await screen.boundingBox();
  const keyboardRect = await page.getByTestId("keyboard-dock").boundingBox();
  expect(keyboardRect!.y).toBeGreaterThanOrEqual(screenRect!.y + screenRect!.height - 1);
});
