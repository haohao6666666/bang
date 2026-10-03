import { expect, test, type Page } from "@playwright/test";
import type { GeneratedDayStamp, SavedBookmark } from "../src/aiContracts";

const STATE_KEY = "jixiang-prototype-state-v5";
const AI_KEY = "jixiang-ai-workspace-v1";
const DAY = "2026-10-03";
const MINUTE = 60_000;
const NOW = new Date("2026-10-03T12:00:00+08:00").getTime();
const IMAGE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jIxoAAAAASUVORK5CYII=";

type RecordedRequest = { path: string; method: string; body: Record<string, any> | null };

function stateFixture() {
  return {
    version: 5,
    tasks: [{ id: "reading", title: "读完论文摘要", subject: "科研阅读", duration: "25 分钟", planMinutes: 25, actualMs: 0, status: "active", color: "sage", kind: "reading", expectedArtifact: "写下论文的核心问题", revisionCount: 0 }],
    focusSession: { activeTaskId: "reading", status: "idle", startedAt: null }, focusLedger: { reading: 0 }, focusLogs: [],
    outcomes: [], diaries: [], dailyEchoes: {}, weeklyEchoes: [], notes: [], workRecords: [], milestones: [], blockers: [], experiments: [], sourceRef: null, methodNote: "先试一小步。",
    preferences: { focusMode: "short", defaultFocusMinutes: 25, reminderEnabled: true, echoTime: "21:30", includeDiaryInAI: true, zhihuMatching: false, zhihuConnected: false, reduceMotion: true, theme: "paper", memoryEnabled: true, memoryIntroSeen: true, backgroundOrganize: true },
    stampStyles: {}, stampBook: { version: 5, styleAssignments: {} },
  };
}

function bookmarks(): SavedBookmark[] {
  return [{ id: "allowed-book", platform: "zhihu", title: "把问题写小一点", url: "https://www.zhihu.com/question/123/answer/456", excerpt: "先写下已经知道的事情，再选择一个最小的问题继续尝试。", savedAt: NOW, authorized: false }];
}

async function mockAi(page: Page) {
  const requests: RecordedRequest[] = [];
  const stamps: GeneratedDayStamp[] = [];
  await page.route("**/api/ai/**", async route => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const body = method === "POST" ? route.request().postDataJSON() : null;
    requests.push({ path: url.pathname, method, body });
    if (url.pathname.endsWith("/status")) return route.fulfill({ json: { text: { provider: "local", baseUrl: "hidden", model: "hidden", configured: true }, image: { provider: "local", baseUrl: "hidden", model: "hidden", configured: true }, bookmarks: { zhihu: "import", xiaohongshu: "import" } } });
    if (url.pathname.endsWith("/memory/status")) return route.fulfill({ json: { enabled: true, count: requests.filter(item => item.path.endsWith("/memory") && item.method === "POST").length } });
    if (url.pathname.endsWith("/memory-clear")) return route.fulfill({ json: { cleared: true } });
    if (url.pathname.endsWith("/memory")) return route.fulfill({ json: { stored: true } });
    if (url.pathname.endsWith("/stamps")) return route.fulfill({ json: { stamps } });
    if (url.pathname.endsWith("/stamp")) {
      const stamp: GeneratedDayStamp = { id: `stamp-${body.dateKey}`, dateKey: body.dateKey, imageUrl: IMAGE, title: "书页间的一枚新芽", meaning: "纪念这一天真实留下的记录。", createdAt: NOW, evidenceIds: body.evidenceIds };
      stamps.push(stamp);
      return route.fulfill({ json: { stamp } });
    }
    if (url.pathname.endsWith("/companion")) return route.fulfill({ json: { reply: "你留下了一个具体线索，可以下次从这里接着走。" } });
    return route.fulfill({ status: 404, json: { error: "Unmocked AI endpoint" } });
  });
  return { requests, posts: (name: string) => requests.filter(item => item.method === "POST" && item.path.endsWith(`/${name}`)) };
}

async function seed(page: Page, fixture = stateFixture(), workspace: { bookmarks: SavedBookmark[]; stamps?: GeneratedDayStamp[] } = { bookmarks: [] }) {
  await page.clock.install({ time: new Date(NOW) });
  await page.addInitScript(({ state, workspace }) => {
    sessionStorage.setItem("jixiang-welcome-seen-v1", "yes");
    localStorage.setItem("jixiang-prototype-state-v5", JSON.stringify(state));
    localStorage.setItem("jixiang-ai-workspace-v1", JSON.stringify({ version: 1, bookmarks: workspace.bookmarks, stamps: workspace.stamps ?? [] }));
  }, { state: fixture, workspace });
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "主要导航" })).toBeVisible();
}

async function nav(page: Page, name: string) {
  await page.getByRole("navigation", { name: "主要导航" }).getByRole("button", { name, exact: true }).click();
}

async function stored(page: Page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STATE_KEY);
}

test.use({ timezoneId: "Asia/Shanghai" });

test("the visible product surface keeps AI quiet and the bottom navigation has three destinations", async ({ page }) => {
  await mockAi(page); await seed(page);
  const navigation = page.getByRole("navigation", { name: "主要导航" });
  await expect(navigation.getByRole("button")).toHaveCount(3);
  await expect(navigation.getByRole("button", { name: "今日", exact: true })).toBeVisible();
  await expect(navigation.getByRole("button", { name: "足迹", exact: true })).toBeVisible();
  await expect(navigation.getByRole("button", { name: "我的", exact: true })).toBeVisible();
  await nav(page, "我的");
  const sheet = page.getByTestId("bottom-sheet");
  await expect(sheet.getByRole("heading", { name: "设置", exact: true })).toBeVisible();
  await expect(sheet.getByText(/模型|提示词|推理过程/)).toHaveCount(0);
  await expect(sheet.getByRole("button", { name: /生成(回顾|印章)/ })).toHaveCount(0);
  await expect(sheet.getByText("允许后台记住进度", { exact: true })).toBeVisible();
});

test("bookmark import remains real, local, and individually authorized", async ({ page }) => {
  await mockAi(page); await seed(page, stateFixture(), { bookmarks: [] }); await nav(page, "我的");
  const file = page.getByLabel("导入收藏文件", { exact: true });
  const rows = [{ title: "把观察写下来", url: "https://www.xiaohongshu.com/explore/sample", excerpt: "从已经观察到的一件小事开始，记录发生了什么。" }];
  await file.setInputFiles({ name: "collections.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(rows)) });
  await expect.poll(async () => (await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), AI_KEY)).bookmarks.length).toBe(1);
  const saved = (await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), AI_KEY)).bookmarks[0];
  expect(saved.authorized).toBe(false);
  const permission = page.getByRole("checkbox", { name: `允许整理收藏：${rows[0].title}`, exact: true });
  await permission.check();
  await expect.poll(async () => (await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), AI_KEY)).bookmarks[0].authorized).toBe(true);
  await permission.uncheck();
  await expect.poll(async () => (await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), AI_KEY)).bookmarks[0].authorized).toBe(false);
});

test("a saved one-line work is kept with its task and starts quiet background organization", async ({ page }) => {
  const api = await mockAi(page); await seed(page);
  await page.getByRole("button", { name: "写一句", exact: true }).click();
  await page.getByLabel("作品一句话记录", { exact: true }).fill("把开头改成了一个具体问题。");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect.poll(async () => (await stored(page)).workRecords.length).toBe(1);
  const state = await stored(page);
  expect(state.workRecords[0]).toMatchObject({ taskId: "reading", dateKey: DAY, kind: "note", text: "把开头改成了一个具体问题。" });
  await expect.poll(() => api.posts("memory").length).toBeGreaterThan(0);
  await expect.poll(() => api.posts("stamp").length).toBe(1);
  await nav(page, "足迹");
  await page.getByRole("tab", { name: "我的印章册", exact: true }).click();
  await expect(page.getByTestId("generated-day-stamp")).toContainText("书页间的一枚新芽");
  await expect(page.getByRole("button", { name: /生成|绘制/ })).toHaveCount(0);
});

test("pause, resume, and end preserve time without silently completing the task", async ({ page }) => {
  await mockAi(page); await seed(page);
  await page.getByRole("button", { name: "开始投入", exact: true }).click();
  await page.clock.runFor(3_000);
  await page.getByRole("button", { name: "先停一下", exact: true }).click();
  await expect.poll(async () => (await stored(page)).focusSession.status).toBe("paused");
  await expect.poll(async () => (await stored(page)).focusLogs.length).toBe(1);
  await page.getByRole("button", { name: "继续投入", exact: true }).click();
  await page.clock.runFor(1_000);
  await page.getByRole("button", { name: "结束投入", exact: true }).click();
  await expect.poll(async () => (await stored(page)).focusSession.status).toBe("idle");
  const state = await stored(page);
  expect(state.tasks.find((task: { id: string }) => task.id === "reading").status).toBe("active");
  expect(state.focusLogs.reduce((sum: number, log: { durationMs: number }) => sum + log.durationMs, 0)).toBeGreaterThanOrEqual(3_000);
});

test("clearing backend memory does not remove local records", async ({ page }) => {
  const api = await mockAi(page); await seed(page);
  await page.getByRole("button", { name: "写一句", exact: true }).click();
  await page.getByLabel("作品一句话记录", { exact: true }).fill("留下一句可以继续的线索。");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect.poll(async () => (await stored(page)).workRecords.length).toBe(1);
  await nav(page, "我的");
  await page.getByRole("button", { name: "清除已整理记忆", exact: true }).click();
  await expect.poll(() => api.posts("memory-clear").length).toBe(1);
  expect((await stored(page)).workRecords).toHaveLength(1);
});
