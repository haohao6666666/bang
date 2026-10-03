import { expect, test, type Page } from "@playwright/test";
import { buildStampBookPage, migrateV4ToV5 } from "../src/stampBook";

const STORAGE_KEY = "jixiang-prototype-state-v5";
const TODAY = "2026-10-03";
const YESTERDAY = "2026-10-02";
const TWO_DAYS_AGO = "2026-10-01";
const MINUTE = 60_000;
const at = (date: string, hour = 10) => new Date(`${date}T${String(hour).padStart(2, "0")}:00:00+08:00`).getTime();

function recordedState() {
  return {
    version: 5,
    tasks: [
      { id: "reading", title: "读完论文摘要", subject: "科研阅读", duration: "25 分钟", planMinutes: 25, actualMs: 25 * MINUTE, status: "active", color: "sage", kind: "reading", expectedArtifact: "写下论文的核心问题", milestoneId: "question", revisionCount: 0 },
      { id: "math", title: "整理数学错题", subject: "数学", duration: "20 分钟", planMinutes: 20, actualMs: 9 * MINUTE, status: "ready", color: "peach", kind: "exercise", expectedArtifact: "整理三道错题", revisionCount: 0 },
    ],
    focusSession: { activeTaskId: "reading", status: "idle", startedAt: null },
    focusLedger: { reading: 25 * MINUTE, math: 9 * MINUTE },
    focusLogs: [
      { id: "focus-reading-today", dateKey: TODAY, taskId: "reading", startedAt: at(TODAY), endedAt: at(TODAY) + 25 * MINUTE, durationMs: 25 * MINUTE },
      { id: "focus-math-today", dateKey: TODAY, taskId: "math", startedAt: at(TODAY, 11), endedAt: at(TODAY, 11) + 9 * MINUTE, durationMs: 9 * MINUTE },
      { id: "focus-reading-yesterday", dateKey: YESTERDAY, taskId: "reading", startedAt: at(YESTERDAY), endedAt: at(YESTERDAY) + 10 * MINUTE, durationMs: 10 * MINUTE },
      { id: "focus-reading-first", dateKey: TWO_DAYS_AGO, taskId: "reading", startedAt: at(TWO_DAYS_AGO), endedAt: at(TWO_DAYS_AGO) + 10 * MINUTE, durationMs: 10 * MINUTE },
    ],
    outcomes: [{ id: "outcome-reading", taskId: "reading", dateKey: YESTERDAY, classification: "completed", evidenceType: "summary", body: "证据：论文通过对照实验验证了问题。", createdAt: at(YESTERDAY, 11), version: 1 }],
    diaries: [{ id: "diary-yesterday", dateKey: YESTERDAY, text: "昨天把论文的问题写清楚了。", createdAt: at(YESTERDAY, 20), updatedAt: at(YESTERDAY, 20) }],
    dailyEchoes: {}, weeklyEchoes: [],
    notes: [{ id: "note-reading", type: "result", title: "论文的核心问题", body: "保留下来的实验对照摘要。", taskId: "reading", outcomeId: "outcome-reading", dateKey: YESTERDAY, createdAt: at(YESTERDAY, 11), color: "sage", pinned: true }],
    milestones: [{ id: "question", title: "明确问题", criteria: "写下论文的核心问题", scene: "灯塔", unlocked: true, unlockedByOutcomeId: "outcome-reading" }],
    blockers: [], experiments: [], sourceRef: null, methodNote: "先把第一步缩小到十分钟。",
    preferences: { focusMode: "short", reminderEnabled: true, echoTime: "21:30", includeDiaryInAI: true, zhihuMatching: false, zhihuConnected: false, reduceMotion: false, theme: "paper" },
    stampStyles: {}, stampBook: { version: 5, styleAssignments: {} },
  };
}

async function seedApp(page: Page, state = recordedState(), storageKey = STORAGE_KEY) {
  await page.clock.install({ time: new Date("2026-10-03T12:00:00+08:00") });
  await page.addInitScript(({ state, storageKey }) => {
    // Only seed a new browser context; reload must exercise actual persistence.
    if (!localStorage.getItem(storageKey)) localStorage.setItem(storageKey, JSON.stringify(state));
  }, { state, storageKey });
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "主要导航" })).toBeVisible();
}

async function openCalendar(page: Page) {
  await page.getByRole("navigation", { name: "主要导航" }).getByRole("button", { name: "足迹", exact: true }).click();
  await page.getByRole("tab", { name: "日历", exact: true }).click();
}

function dateCard(page: Page, date: string) {
  return page.locator(".stampbook-mobile-day-card").filter({ has: page.getByRole("button", { name: `查看 ${date} 的记录`, exact: true }) });
}

async function readState(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
}

test.use({ timezoneId: "Asia/Shanghai" });

test("calendar preserves dates, weekday and per-task ten-minute counts", async ({ page }) => {
  await seedApp(page);
  await openCalendar(page);
  const today = dateCard(page, TODAY);
  const yesterday = dateCard(page, YESTERDAY);
  await expect(today).toContainText("10.03");
  await expect(today).toContainText(/周六|星期六/);
  await expect(today).toContainText(/2 枚.*34 分钟/);
  await expect(today.getByTestId("calendar-stamp")).toHaveCount(2);
  await expect(yesterday).toContainText(/1 枚.*10 分钟/);
  await expect(yesterday.getByTestId("calendar-stamp")).toHaveCount(1);
  // Descriptive text belongs to the interaction, never permanently inside a date card.
  await expect(today.getByTestId("calendar-stamp").first()).toHaveText("");
  await expect(today.getByTestId("calendar-stamp").first().locator("img")).toHaveCount(1);
  await expect(page.getByRole("tooltip")).toHaveCount(0);
});

test("desktop pointer hover explains a calendar stamp without entering the date", async ({ page }) => {
  await seedApp(page);
  await openCalendar(page);
  await dateCard(page, TODAY).getByTestId("calendar-stamp").first().hover();
  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText("时间印迹");
  await expect(tooltip).toContainText("科研阅读");
  await expect(tooltip).toContainText(/真实|投入/);
  await expect(page.getByRole("tab", { name: "日历", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.mouse.move(5, 5);
  await expect(tooltip).toHaveCount(0);
});

test.describe("touch preview", () => {
  test.use({ hasTouch: true, viewport: { width: 480, height: 1000 } });

  test("touch opens a lightweight explanation on iPhone and Pixel", async ({ page }) => {
    await seedApp(page);
    await openCalendar(page);
    await dateCard(page, TODAY).getByTestId("calendar-stamp").first().tap();
    const sheet = page.getByTestId("bottom-sheet");
    await expect(sheet.getByRole("heading", { name: "印章说明", exact: true })).toBeVisible();
    await expect(sheet).toContainText("时间印迹");
    await expect(sheet).toContainText("科研阅读");
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
    await page.getByTestId("device-picker").click();
    await page.getByTestId("device-option-pixel-10").click();
    await expect(page.getByTestId("phone-frame")).toHaveAttribute("data-device", "pixel-10");
    await dateCard(page, YESTERDAY).getByTestId("calendar-stamp").first().tap();
    await expect(sheet).toContainText(YESTERDAY);
    await expect(page.getByTestId("android-navigation-bar")).toBeVisible();
  });
});

test("weekly stamp explanation uses the clicked stamp's date", async ({ page }) => {
  await seedApp(page);
  await openCalendar(page);
  await page.getByRole("tab", { name: "周回顾", exact: true }).click();
  await page.getByTestId("calendar-stamp").and(page.getByRole("button", { name: new RegExp(YESTERDAY) })).first().click();
  await expect(page.getByTestId("bottom-sheet")).toContainText(YESTERDAY);
  await expect(page.getByTestId("bottom-sheet")).toContainText("10 分钟");
});

test("an empty month does not display today's stamps", async ({ page }) => {
  await seedApp(page);
  await openCalendar(page);
  await page.getByRole("button", { name: "上个月", exact: true }).click();
  await expect(page.locator(".stampbook-mobile-day-card")).toHaveCount(0);
  await expect(page.getByTestId("calendar-stamp")).toHaveCount(0);
  await expect(page.getByText("这个月还没有记录", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "今天", exact: true }).click();
  await expect(dateCard(page, TODAY)).toBeVisible();
});

test("stamp collection separates five categories and earned states", async ({ page }) => {
  await seedApp(page);
  await openCalendar(page);
  await page.getByRole("tab", { name: "我的印章册", exact: true }).click();
  const collection = page.getByTestId("stamp-collection");
  for (const label of ["时间印迹", "坚持章", "探索章", "突破章", "成长章"]) {
    await expect(collection.getByRole("tab", { name: label, exact: true })).toBeVisible();
  }
  await expect(page.getByTestId("stamp-card-time:mountain")).toHaveAttribute("data-earned", "true");
  await expect(page.getByTestId("stamp-card-time:mountain")).toContainText(TWO_DAYS_AGO.replaceAll("-", "."));
  await expect(page.getByTestId("stamp-card-time:book")).toHaveAttribute("data-earned", "false");
  await expect(page.getByTestId("stamp-card-time:book")).toContainText("未获得");
  await collection.getByRole("tab", { name: "坚持章", exact: true }).click();
  await expect(page.getByTestId("stamp-card-persistence:return")).toHaveAttribute("data-earned", "true");
  await expect(page.getByTestId("stamp-card-persistence:return")).toContainText(TODAY.replaceAll("-", "."));
  await collection.getByRole("tab", { name: "探索章", exact: true }).click();
  await expect(page.getByTestId("stamp-card-exploration:科研阅读")).toHaveAttribute("data-earned", "true");
  await expect(page.getByTestId("stamp-card-exploration:数学")).toHaveAttribute("data-earned", "false");
  await collection.getByRole("tab", { name: "突破章", exact: true }).click();
  await expect(page.getByTestId("stamp-card-breakthrough:milestone")).toHaveAttribute("data-earned", "true");
  await collection.getByRole("tab", { name: "成长章", exact: true }).click();
  await expect(page.getByTestId("stamp-card-growth:reflection")).toHaveAttribute("data-earned", "true");
  await expect(page.locator(".stampbook-mobile-day-card")).toHaveCount(0);
});

test("growth detail opens original diary and outcome evidence", async ({ page }) => {
  await seedApp(page);
  await openCalendar(page);
  await page.getByRole("tab", { name: "我的印章册", exact: true }).click();
  await page.getByTestId("stamp-collection").getByRole("tab", { name: "成长章", exact: true }).click();
  await page.getByTestId("stamp-card-growth:reflection").click();
  const detail = page.locator(".stamp-collection-detail");
  await expect(page.getByTestId("bottom-sheet")).toContainText("成长章");
  await expect(detail).toContainText(YESTERDAY);
  const diary = page.getByTestId("stamp-evidence-diary-diary-yesterday");
  await diary.locator("summary").click();
  await expect(diary).toHaveAttribute("open", "");
  await expect(diary.getByText("昨天把论文的问题写清楚了。", { exact: true })).toBeVisible();
  const outcome = page.getByTestId("stamp-evidence-outcome-outcome-reading");
  await outcome.locator("summary").click();
  await expect(outcome.getByText("证据：论文通过对照实验验证了问题。", { exact: true })).toBeVisible();
});

test("generated stamp images load in every category and match calendar and detail views", async ({ page }) => {
  test.setTimeout(45_000);
  const state = recordedState();
  for (const [id, subject] of [["interest", "兴趣"], ["new-theme", "星空观测"]]) {
    state.tasks.push({ ...state.tasks[1], id, subject, actualMs: 0, title: subject });
  }
  await seedApp(page, state);
  await openCalendar(page);
  const calendarStamp = dateCard(page, TODAY).getByTestId("calendar-stamp").first();
  const calendarImage = await calendarStamp.locator("img").getAttribute("src");
  await calendarStamp.click();
  await expect(page.getByTestId("bottom-sheet").locator(".stamp-mark img")).toHaveAttribute("src", calendarImage!);
  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: "我的印章册", exact: true }).click();
  const collection = page.getByTestId("stamp-collection");
  await expect(page.getByTestId("stamp-card-time:mountain").locator("img")).toHaveAttribute("src", calendarImage!);
  const seenArtwork = new Set<string>();
  for (const category of ["时间印迹", "坚持章", "探索章", "突破章", "成长章"]) {
    await collection.getByRole("tab", { name: category, exact: true }).click();
    const pictures = collection.locator(".stamp-collection-art img");
    for (const picture of await pictures.all()) {
      await picture.scrollIntoViewIfNeeded();
      await expect.poll(() => picture.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 100)).toBe(true);
      seenArtwork.add((await picture.getAttribute("src"))!);
    }
  }
  expect(seenArtwork.size).toBe(17);
  const growthPicture = await page.getByTestId("stamp-card-growth:reflection").locator("img").getAttribute("src");
  await page.getByTestId("stamp-card-growth:reflection").click();
  await expect(page.getByTestId("stamp-collection-detail").locator(".stamp-collection-detail-intro > img")).toHaveAttribute("src", growthPicture!);
  await page.keyboard.press("Escape");
  await collection.getByRole("tab", { name: "时间印迹", exact: true }).click();
  const unearned = page.getByTestId("stamp-card-time:book");
  await expect(unearned).toContainText("未获得");
  const treatment = await unearned.locator(".stamp-collection-art").evaluate((art) => ({ filter: getComputedStyle(art).filter, opacity: Number(getComputedStyle(art).opacity) }));
  expect(treatment.filter).not.toContain("grayscale");
  expect(treatment.opacity).toBeGreaterThanOrEqual(.8);
  expect((await readState(page)).focusLogs).toEqual(state.focusLogs);
});

test("legacy aggregate time does not fabricate acquired growth stamps", async ({ page }) => {
  const state = recordedState();
  state.focusLogs = [];
  await seedApp(page, state);
  await openCalendar(page);
  await expect(dateCard(page, TODAY).getByTestId("calendar-stamp")).toHaveCount(2);
  await page.getByRole("tab", { name: "我的印章册", exact: true }).click();
  const collection = page.getByTestId("stamp-collection");
  for (const [category, key] of [["坚持章", "persistence:return"], ["突破章", "breakthrough:milestone"], ["成长章", "growth:reflection"]]) {
    await collection.getByRole("tab", { name: category, exact: true }).click();
    await expect(page.getByTestId(`stamp-card-${key}`)).toHaveAttribute("data-earned", "false");
  }
});

test("settings remain available and persist after reload", async ({ page }) => {
  await seedApp(page);
  await page.getByRole("navigation", { name: "主要导航" }).getByRole("button", { name: "我的", exact: true }).click();
  const sheet = page.getByTestId("bottom-sheet");
  await expect(sheet.getByRole("heading", { name: "设置", exact: true })).toBeVisible();
  await sheet.getByRole("button", { name: "常规投入", exact: true }).click();
  await sheet.getByLabel("每日回声提醒").uncheck();
  await expect.poll(async () => (await readState(page)).preferences.reminderEnabled).toBe(false);
  await page.reload();
  await page.getByRole("navigation", { name: "主要导航" }).getByRole("button", { name: "我的", exact: true }).click();
  await expect(sheet.getByLabel("每日回声提醒")).not.toBeChecked();
  expect((await readState(page)).preferences.focusMode).toBe("standard");
});

test("acquisition filtering stays within its category and never changes evidence", async ({ page }) => {
  const state = recordedState();
  await seedApp(page, state);
  await openCalendar(page);
  await page.getByRole("tab", { name: "我的印章册", exact: true }).click();
  const collection = page.getByTestId("stamp-collection");
  const filters = collection.getByRole("group", { name: "印章获得状态" });
  await filters.getByRole("button", { name: "已获得", exact: true }).click();
  await expect(collection.locator(".stamp-collection-card")).toHaveCount(1);
  await expect(page.getByTestId("stamp-card-time:mountain")).toBeVisible();
  await filters.getByRole("button", { name: "未获得", exact: true }).click();
  await expect(collection.locator(".stamp-collection-card")).toHaveCount(9);
  await expect(page.getByTestId("stamp-card-time:mountain")).toHaveCount(0);
  await collection.getByRole("tab", { name: "成长章", exact: true }).click();
  await expect(filters.getByRole("button", { name: "未获得", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(collection.getByRole("status")).toContainText("这一类的印章都已收好");
  await collection.getByRole("button", { name: /查看这一类的全部印章/ }).click();
  await expect(page.getByTestId("stamp-card-growth:reflection")).toHaveAttribute("data-earned", "true");
  const after = await readState(page);
  expect(after.focusLogs).toEqual(state.focusLogs);
  expect(after.outcomes).toEqual(state.outcomes);
  expect(after.diaries).toEqual(state.diaries);
});

test("saving a historical diary returns to that date and keeps its original evidence", async ({ page }) => {
  await seedApp(page);
  await openCalendar(page);
  await page.getByRole("button", { name: `查看 ${YESTERDAY} 的记录`, exact: true }).click();
  await page.getByRole("button", { name: /写下这一天/ }).click();
  const diaryText = "把昨天的思考补完整，今天依然可以接着走。";
  await page.getByLabel("今天的日记").fill(diaryText);
  await page.getByRole("button", { name: "保存日记", exact: true }).click();
  await page.getByRole("button", { name: /这一页，已经收好/ }).click();
  await expect(page.locator(".day-heading")).toContainText("10.02");
  await page.getByRole("button", { name: "日记与成果", exact: true }).click();
  await expect(page.getByTestId("bottom-sheet")).toContainText(diaryText);
  await expect(page.getByTestId("bottom-sheet")).toContainText("证据：论文通过对照实验验证了问题。");
  await page.keyboard.press("Escape");
  await page.reload();
  const saved = await readState(page);
  expect(saved.diaries.find((entry: { dateKey: string }) => entry.dateKey === YESTERDAY).text).toBe(diaryText);
  expect(saved.diaries.some((entry: { dateKey: string }) => entry.dateKey === TODAY)).toBe(false);
});

test("route, focus, outcome and diary remain one persistent workflow", async ({ page }) => {
  await seedApp(page);
  const flow = page.getByRole("navigation", { name: "今天的流程" });
  await expect(flow.getByRole("button")).toHaveCount(4);
  await page.getByRole("button", { name: /添加一个想做的事/ }).click();
  await page.getByLabel("添加今日任务").fill("整理一页研究笔记");
  await page.getByLabel("填写成果要求").fill("留下一张问题清单");
  await page.getByRole("button", { name: "加入路线", exact: true }).click();
  await expect.poll(async () => (await readState(page)).tasks.length).toBe(3);
  const task = (await readState(page)).tasks.find((item: { title: string }) => item.title === "整理一页研究笔记");
  await page.getByTestId(`task-row-${task.id}`).click();
  await page.getByRole("button", { name: "开始投入", exact: true }).click();
  await page.clock.runFor(12_000);
  await page.getByRole("button", { name: "先停一下", exact: true }).click();
  await expect.poll(async () => (await readState(page)).focusLogs.filter((log: { taskId: string }) => log.taskId === task.id).length).toBe(1);
  expect((await readState(page)).focusLedger[task.id]).toBeGreaterThanOrEqual(12_000);
  await page.getByRole("button", { name: "留下成果", exact: true }).click();
  await page.getByLabel("填写成果内容").fill("整理好了三条可以继续研究的问题。");
  await page.getByRole("button", { name: /保存这一步/ }).click();
  await expect(page.getByLabel("今天的日记")).toBeVisible();
  await page.getByLabel("今天的日记").fill("今天从一个小问题开始，留下了三条清楚的线索。");
  await page.getByRole("button", { name: "保存日记", exact: true }).click();
  await expect.poll(async () => (await readState(page)).diaries.some((diary: { dateKey: string; text: string }) => diary.dateKey === TODAY && diary.text.includes("三条清楚的线索"))).toBe(true);
  await page.reload();
  const restored = await readState(page);
  expect(restored.tasks.find((item: { id: string }) => item.id === task.id).status).toBe("completed");
  expect(restored.outcomes.some((item: { taskId: string; body: string }) => item.taskId === task.id && item.body.includes("三条"))).toBe(true);
  expect(restored.focusLogs.some((item: { taskId: string; durationMs: number }) => item.taskId === task.id && item.durationMs >= 12_000)).toBe(true);
});

test("legacy style migration retains time and historical style fallback", async () => {
  const migrated = migrateV4ToV5({ version: 4, tasks: [{ id: "legacy", title: "旧阅读", subject: "语文", actualMinutes: 25, duration: "30 分钟" }], stampBook: { styleAssignments: { "task:legacy": { presetId: "science-atom" } } }, notes: [{ id: "pause", type: "pause", taskId: "legacy", dateKey: TODAY }], diaries: [{ id: "old-diary", dateKey: YESTERDAY, text: "保留旧日记" }] });
  expect(migrated.version).toBe(5);
  expect(migrated.focusLedger).toEqual({ legacy: 25 * MINUTE });
  expect(migrated.stampStyles["task:legacy"]).toMatchObject({ presetId: "science-atom", icon: "atom", color: "blue", outline: "scallop" });
  expect(migrated.diaries).toEqual([{ id: "old-diary", dateKey: YESTERDAY, text: "保留旧日记" }]);
  expect((migrated.notes as Array<{ archived: boolean }>)[0].archived).toBe(true);
  const state = recordedState();
  const today = buildStampBookPage({ dateKey: TODAY, tasks: state.tasks, focusLogs: state.focusLogs, outcomes: state.outcomes, notes: state.notes });
  expect(today.totalMs).toBe(34 * MINUTE);
  expect(today.totalActualStampCount).toBe(2);
  expect(today.totalRemainderMs).toBe(14 * MINUTE);
});
