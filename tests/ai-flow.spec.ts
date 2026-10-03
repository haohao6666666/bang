import { expect, test, type Page } from "@playwright/test";
import type { AiSnapshot, GeneratedDayStamp, SavedBookmark } from "../src/aiContracts";
import type { DailyEchoDraft } from "../src/echoAgent";

const STATE_KEY = "jixiang-prototype-state-v5";
const AI_KEY = "jixiang-ai-workspace-v1";
const DAY = "2026-10-03";
const MINUTE = 60_000;
const NOW = new Date("2026-10-03T12:00:00+08:00").getTime();
const PRIVATE_DIARY = "日记隐私标记：今天想慢慢读懂这个问题。";
const OUTCOME = "成果原文隐私标记：论文使用了交叉对照实验。";
const IMAGE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jIxoAAAAASUVORK5CYII=";

function stateFixture() {
  return {
    version: 5,
    tasks: [{ id: "reading", title: "读完论文摘要", subject: "科研阅读", duration: "25 分钟", planMinutes: 25, actualMs: 25 * MINUTE, status: "active", color: "sage", kind: "reading", expectedArtifact: "写下论文的核心问题", revisionCount: 0 }],
    focusSession: { activeTaskId: "reading", status: "idle", startedAt: null }, focusLedger: { reading: 25 * MINUTE },
    focusLogs: [{ id: "focus-reading", taskId: "reading", dateKey: DAY, startedAt: NOW - 30 * MINUTE, endedAt: NOW - 5 * MINUTE, durationMs: 25 * MINUTE }],
    outcomes: [{ id: "outcome-reading", taskId: "reading", dateKey: DAY, classification: "partial", evidenceType: "summary", body: OUTCOME, createdAt: NOW - 4 * MINUTE, version: 1 }],
    diaries: [{ id: "diary-today", dateKey: DAY, text: PRIVATE_DIARY, createdAt: NOW - 2 * MINUTE, updatedAt: NOW - 2 * MINUTE }],
    dailyEchoes: {}, weeklyEchoes: [], notes: [], milestones: [], blockers: [], experiments: [], sourceRef: null, methodNote: "先试一小步。",
    preferences: { focusMode: "short", reminderEnabled: true, echoTime: "21:30", includeDiaryInAI: true, zhihuMatching: false, zhihuConnected: false, reduceMotion: true, theme: "paper" },
    stampStyles: {}, stampBook: { version: 5, styleAssignments: {} },
  };
}
function savedBookmarks(): SavedBookmark[] {
  return [
    { id: "allowed-book", platform: "zhihu", title: "把问题写小一点", url: "https://www.zhihu.com/question/123/answer/456", excerpt: "先写下你已经知道的事情，再选择一个最小的问题继续尝试，看看这样是否让思路更清楚。", savedAt: NOW - MINUTE, authorized: true },
    { id: "private-book", platform: "xiaohongshu", title: "尚未授权的私人收藏", url: "https://www.xiaohongshu.com/explore/123456", excerpt: "收藏隐私标记：这是尚未授权使用的原文内容，默认不能发送给模型进行阅读或分析。", savedAt: NOW, authorized: false },
  ];
}
function draftFor(snapshot: AiSnapshot): DailyEchoDraft {
  const ref = snapshot.evidence.find(item => item.kind === "focus")!;
  const source = { id: ref.id, dateKey: ref.dateKey, kind: ref.kind };
  const bookmark = snapshot.bookmarks[0];
  return {
    status: "draft", quiet: false,
    facts: [{ id: "fact-1", text: "今天留下一段真实的科研阅读。", evidenceRefs: [source] }],
    signals: [{ id: "signal-1", type: "progress", title: "你已经开始理解", detail: "可以围绕一个问题继续读。", confidence: 0.8, needsExternal: Boolean(bookmark), evidenceRefs: [source] }],
    sparkle: { id: "sparkle-1", text: "你给好奇心留出了一段时间。", evidenceRefs: [source] },
    externalMatches: bookmark ? [{ bookmarkId: bookmark.id, whyRelevant: "这个方法可以接上今天的阅读。", excerpt: bookmark.excerpt, savedAt: bookmark.savedAt, url: bookmark.url, usefulPart: "先列出已知，再挑一个小问题。", applicableWhen: "不知道从哪里继续时。", limitation: "只是参考方法，不适合时可以停下。", evidenceRefs: [source, { id: bookmark.id, kind: "bookmark", dateKey: snapshot.dateKey }] }] : [],
    tomorrowExperiments: [{ id: "experiment-1", title: "明天只追一个小问题", why: "接上今天的好奇心。", stopCondition: "疲倦时就停下来。", evidenceRefs: [source] }],
  };
}
type RecordedRequest = { path: string; method: string; body: Record<string, any> | null };
async function mockAi(page: Page, options: { configured?: boolean; holdEcho?: boolean } = {}) {
  const requests: RecordedRequest[] = [];
  let configured = options.configured ?? true;
  const stamps: GeneratedDayStamp[] = [];
  const releases: Array<() => void> = [];
  const status = () => ({ text: { provider: "qwen", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus", configured }, image: { provider: "wan", baseUrl: "https://dashscope.aliyuncs.com/api/v1", model: "wan2.2-t2i-flash", configured }, bookmarks: { zhihu: "import", xiaohongshu: "import" } });
  await page.route("**/api/ai/**", async route => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    const body = method === "POST" ? route.request().postDataJSON() : null;
    requests.push({ path, method, body });
    if (path.endsWith("/status")) return route.fulfill({ json: status() });
    if (path.endsWith("/config")) { configured = true; return route.fulfill({ json: status() }); }
    if (path.endsWith("/stamps")) return route.fulfill({ json: { stamps } });
    if (path.endsWith("/echo")) {
      if (options.holdEcho) await new Promise<void>(resolve => releases.push(resolve));
      await route.fulfill({ json: { draft: draftFor(body.snapshot) } }).catch(() => {});
      return;
    }
    if (path.endsWith("/stamp")) {
      const stamp: GeneratedDayStamp = { id: `stamp-${body.dateKey}`, dateKey: body.dateKey, imageUrl: IMAGE, title: "书页间的一枚新芽", meaning: "纪念这一天真实发生的阅读。", prompt: body.brief, createdAt: NOW, evidenceIds: body.evidenceIds, model: "test-image-model" };
      stamps.push(stamp); return route.fulfill({ json: { stamp } });
    }
    return route.fulfill({ status: 404, json: { error: "Unmocked AI endpoint" } });
  });
  return { requests, releases, posts: (name: string) => requests.filter(item => item.method === "POST" && item.path.endsWith(`/${name}`)) };
}
async function seed(page: Page, bookmarks = savedBookmarks(), fixture = stateFixture()) {
  await page.clock.install({ time: new Date(NOW) });
  await page.addInitScript(({ state, workspace, stateKey, aiKey }) => {
    sessionStorage.setItem("jixiang-welcome-seen-v1", "yes");
    if (!localStorage.getItem(stateKey)) localStorage.setItem(stateKey, JSON.stringify(state));
    if (!localStorage.getItem(aiKey)) localStorage.setItem(aiKey, JSON.stringify(workspace));
  }, { state: fixture, workspace: { version: 1, bookmarks, stamps: [], includeDiary: false, useBookmarks: false }, stateKey: STATE_KEY, aiKey: AI_KEY });
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "主要导航" })).toBeVisible();
}
async function nav(page: Page, name: string) { await page.getByRole("navigation", { name: "主要导航" }).getByRole("button", { name, exact: true }).click(); }
async function stored(page: Page, key = STATE_KEY) { return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key); }
async function openEcho(page: Page) { await nav(page, "回响"); await expect(page.getByTestId("ai-echo-panel")).toBeVisible(); return page.getByTestId("ai-echo-panel"); }

test.use({ timezoneId: "Asia/Shanghai" });

test("model setup sends keys only to local service and imported bookmarks require individual permission", async ({ page }) => {
  const api = await mockAi(page, { configured: false });
  await seed(page, []);
  await nav(page, "我的");
  const connections = page.getByRole("region", { name: "模型与收藏", exact: true });
  await connections.locator("summary").filter({ hasText: "国内大模型" }).click();
  await page.getByLabel("文本 API Key", { exact: true }).fill("text-only-test-secret");
  await page.getByLabel("绘图 API Key", { exact: true }).fill("image-only-test-secret");
  await page.getByRole("button", { name: "保存模型配置", exact: true }).click();
  await expect.poll(() => api.posts("config").length).toBe(1);
  expect(api.posts("config")[0].body?.text.apiKey).toBe("text-only-test-secret");
  expect(api.posts("config")[0].body?.image.apiKey).toBe("image-only-test-secret");
  await expect(page.getByLabel("文本 API Key", { exact: true })).toHaveValue("");
  const browserStorage = await page.evaluate(() => JSON.stringify({ ...localStorage }));
  expect(browserStorage).not.toContain("text-only-test-secret");
  expect(browserStorage).not.toContain("image-only-test-secret");
  expect(api.posts("echo")).toHaveLength(0); expect(api.posts("stamp")).toHaveLength(0);

  await page.getByLabel("收藏标题", { exact: true }).fill("我的一条阅读方法");
  await page.getByLabel("收藏分享链接", { exact: true }).fill("https://www.zhihu.com/question/999/answer/888");
  await page.getByLabel("收藏原文片段", { exact: true }).fill("把一个大问题写成一句话，再选择已经理解的部分开始，边做边观察是否适合自己。");
  await page.getByRole("button", { name: "存入收藏库", exact: true }).click();
  const permission = page.getByRole("checkbox", { name: "允许分析收藏：我的一条阅读方法", exact: true });
  await expect(permission).not.toBeChecked();
  expect((await stored(page, AI_KEY)).bookmarks[0].authorized).toBe(false);
  await permission.check();
  await expect.poll(async () => (await stored(page, AI_KEY)).bookmarks[0].authorized).toBe(true);
  await permission.uncheck();
  await expect.poll(async () => (await stored(page, AI_KEY)).bookmarks[0].authorized).toBe(false);
  expect(api.posts("echo")).toHaveLength(0);
});

test("daily echo requires fresh consent and sends only selected diary and authorized bookmark content", async ({ page }) => {
  const api = await mockAi(page); await seed(page);
  const panel = await openEcho(page);
  const consent = panel.getByRole("checkbox", { name: /我同意将上方选定内容/ });
  const generate = panel.getByRole("button", { name: "生成这一天的回声", exact: true });
  await expect(consent).not.toBeChecked(); await expect(generate).toBeDisabled();
  expect(api.posts("echo")).toHaveLength(0);
  await consent.check(); await generate.click();
  await expect(page.getByTestId("ai-daily-draft")).toBeVisible();
  const first = api.posts("echo")[0].body!;
  expect(first.consent).toBe(true);
  expect(first.snapshot.dateKey).toBe(DAY);
  expect(first.snapshot.evidence.some((item: { kind: string }) => item.kind === "diary")).toBe(false);
  expect(first.snapshot.bookmarks).toEqual([]);
  expect(JSON.stringify(first)).not.toContain(PRIVATE_DIARY);
  expect(JSON.stringify(first)).not.toContain("收藏隐私标记");
  await expect(consent).not.toBeChecked();
  await panel.getByRole("checkbox", { name: /这次包含已保存的日记/ }).check();
  await panel.getByRole("checkbox", { name: /参考我授权的收藏/ }).check();
  await expect(panel.getByRole("button", { name: "重新生成回声", exact: true })).toBeDisabled();
  await consent.check(); await panel.getByRole("button", { name: "重新生成回声", exact: true }).click();
  await expect.poll(() => api.posts("echo").length).toBe(2);
  const second = api.posts("echo")[1].body!;
  expect(JSON.stringify(second.snapshot)).toContain(PRIVATE_DIARY);
  expect(second.snapshot.bookmarks.map((item: { id: string }) => item.id)).toEqual(["allowed-book"]);
  expect(JSON.stringify(second.snapshot)).not.toContain("收藏隐私标记");
  await expect(panel.locator(".ai-bookmark-match")).toContainText("只是参考方法，不适合时可以停下。");
  await panel.locator(".ai-bookmark-match summary").filter({ hasText: "查看导入原文" }).click();
  await expect(panel.locator(".ai-bookmark-match blockquote")).toHaveText(savedBookmarks()[0].excerpt);
  await expect(panel.getByRole("link", { name: "打开收藏来源" })).toHaveAttribute("href", savedBookmarks()[0].url);
  expect((await stored(page)).focusLogs).toEqual(stateFixture().focusLogs);
});

test("reflection is editable and confirmed locally, while an accepted experiment stays out of today's tasks", async ({ page }) => {
  const api = await mockAi(page); await seed(page);
  const panel = await openEcho(page);
  await panel.getByRole("checkbox", { name: /我同意将上方选定内容/ }).check();
  await panel.getByRole("button", { name: "生成这一天的回声", exact: true }).click();
  const accept = panel.getByRole("button", { name: "把这个尝试放进明天", exact: true });
  await expect(accept).toBeDisabled();
  await panel.getByRole("button", { name: "修改文字", exact: true }).click();
  await panel.getByLabel("修改事实 1", { exact: true }).fill("我先读了摘要，再记下一个具体问题。");
  await panel.getByRole("button", { name: "保存修改", exact: true }).click();
  await expect(panel.locator(".ai-fact")).toContainText("我先读了摘要，再记下一个具体问题。");
  await panel.getByRole("button", { name: "确认这份回声", exact: true }).click();
  await expect.poll(async () => (await stored(page)).dailyEchoes[DAY].status).toBe("confirmed");
  await accept.click();
  await expect(panel.getByRole("button", { name: "已放进明天", exact: true })).toBeDisabled();
  const accepted = await stored(page);
  expect(accepted.tasks).toEqual(stateFixture().tasks);
  expect(accepted.experiments.filter((item: { title: string }) => item.title === "明天只追一个小问题")).toHaveLength(1);
  await panel.getByRole("button", { name: "隐藏", exact: true }).click();
  await expect(page.getByTestId("ai-daily-draft")).toHaveCount(0);
  await panel.getByRole("button", { name: "重新查看", exact: true }).click();
  await expect(page.getByTestId("ai-daily-draft")).toContainText("我先读了摘要，再记下一个具体问题。");
  await page.reload(); await openEcho(page);
  await expect(page.getByRole("button", { name: "已放进明天", exact: true })).toBeDisabled();
  const restored = await stored(page);
  expect(restored.experiments.filter((item: { title: string }) => item.title === "明天只追一个小问题")).toHaveLength(1);
  expect(restored.tasks).toEqual(stateFixture().tasks);
  expect(api.posts("echo")).toHaveLength(1);
});

test("a generated daily illustration is isolated from time stamps and uses a minimized drawing snapshot", async ({ page }) => {
  const api = await mockAi(page); await seed(page);
  await nav(page, "足迹");
  const dateCard = page.locator(`.stampbook-mobile-day-card[data-date="${DAY}"]`);
  const beforeCount = await dateCard.locator(".calendar-stamp").count();
  expect(beforeCount).toBe(2);
  await page.getByRole("tab", { name: "我的印章册", exact: true }).click();
  const studio = page.getByTestId("daily-stamp-studio");
  await expect(studio.getByRole("button", { name: "绘制纪念印章", exact: true })).toBeDisabled();
  expect(api.posts("stamp")).toHaveLength(0);
  await studio.getByLabel("纪念印章绘制说明", { exact: true }).fill("一册打开的书，嫩芽和安静的奶油色小狗。");
  await studio.getByRole("checkbox", { name: /我确认绘制说明/ }).check();
  await studio.getByRole("button", { name: "绘制纪念印章", exact: true }).click();
  await expect(page.getByTestId("generated-day-stamp")).toContainText("书页间的一枚新芽");
  const body = api.posts("stamp")[0].body!;
  expect(body.consent).toBe(true); expect(body.dateKey).toBe(DAY);
  expect(body.snapshot.bookmarks).toEqual([]);
  expect(body.evidenceIds.length).toBeGreaterThan(0);
  expect(JSON.stringify(body)).not.toContain(PRIVATE_DIARY);
  expect(JSON.stringify(body)).not.toContain(OUTCOME);
  expect(JSON.stringify(body)).not.toContain("读完论文摘要");
  expect(JSON.stringify(body)).not.toContain("收藏隐私标记");
  expect(body.snapshot.evidence.every((item: { kind: string }) => ["focus", "outcome", "note"].includes(item.kind))).toBe(true);
  await expect(studio.getByRole("button", { name: "绘制纪念印章", exact: true })).toHaveCount(0);
  expect((await stored(page)).focusLogs).toEqual(stateFixture().focusLogs);
  expect((await stored(page)).tasks).toEqual(stateFixture().tasks);
  await page.getByRole("tab", { name: "日历", exact: true }).click();
  expect(await dateCard.locator(".calendar-stamp").count()).toBe(beforeCount);
  await page.reload(); await nav(page, "足迹");
  await page.getByRole("tab", { name: "我的印章册", exact: true }).click();
  await expect(page.getByTestId("generated-day-stamp")).toContainText("书页间的一枚新芽");
  expect(api.posts("stamp")).toHaveLength(1);
});

test("cancelled and unmounted echo responses cannot save a stale draft", async ({ page }) => {
  const api = await mockAi(page, { holdEcho: true }); await seed(page);
  let panel = await openEcho(page);
  await panel.getByRole("checkbox", { name: /我同意将上方选定内容/ }).check();
  await panel.getByRole("button", { name: "生成这一天的回声", exact: true }).click();
  await expect.poll(() => api.releases.length).toBe(1);
  await panel.getByRole("button", { name: "取消", exact: true }).click();
  api.releases[0]();
  await expect(panel.getByRole("alert")).toContainText("已取消");
  expect((await stored(page)).dailyEchoes).toEqual({});
  await panel.getByRole("checkbox", { name: /我同意将上方选定内容/ }).check();
  await panel.getByRole("button", { name: "生成这一天的回声", exact: true }).click();
  await expect.poll(() => api.releases.length).toBe(2);
  await nav(page, "今日"); api.releases[1]();
  panel = await openEcho(page);
  await expect(panel.getByRole("checkbox", { name: /我同意将上方选定内容/ })).not.toBeChecked();
  await expect(page.getByTestId("ai-daily-draft")).toHaveCount(0);
  expect((await stored(page)).dailyEchoes).toEqual({});
  expect((await stored(page)).focusLogs).toEqual(stateFixture().focusLogs);
});

test("weekly reflection needs diary consent and keeps review links tied to actual dates", async ({ page }) => {
  await mockAi(page);
  const fixture = stateFixture();
  fixture.diaries.push(...["2026-10-01", "2026-10-02"].map(day => ({ id: "diary-" + day, dateKey: day, text: "这一天先把一个问题写了下来。", createdAt: NOW, updatedAt: NOW })));
  const requests: any[] = [];
  await page.route("**/api/ai/weekly", async route => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ json: { draft: { status: "draft", rangeStart: "2026-09-27", rangeEnd: DAY, observations: [{ id: "week-1", text: "几天的记录中，都出现了先写出一个问题的做法。", evidenceDates: ["2026-10-01", DAY] }] } } });
  });
  await seed(page, [], fixture);
  const daily = await openEcho(page);
  const weekly = page.locator(".weekly-ai-panel");
  await weekly.locator("summary").first().click();
  await expect(weekly.getByRole("button", { name: "生成周回声", exact: true })).toBeDisabled();
  await daily.getByRole("checkbox", { name: /这次包含已保存的日记/ }).check();
  await weekly.getByRole("checkbox", { name: /允许将上面这七天内的记录/ }).check();
  await weekly.getByRole("button", { name: "生成周回声", exact: true }).click();
  await expect(weekly.locator(".ai-fact")).toContainText("先写出一个问题");
  expect(requests).toHaveLength(1);
  expect(requests[0].snapshots.filter((day: AiSnapshot) => day.evidence.some(item => item.kind === "diary"))).toHaveLength(3);
  expect(requests[0].snapshots.every((day: AiSnapshot) => day.bookmarks.length === 0)).toBe(true);
  await weekly.getByRole("button", { name: "确认周回声", exact: true }).click();
  await expect.poll(async () => (await stored(page)).weeklyEchoes[0].status).toBe("confirmed");
  await weekly.getByRole("button", { name: "回看 10-01", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("2026-10-01");
  await expect(page.getByRole("dialog")).toContainText("这一天先把一个问题写了下来。");
  expect((await stored(page)).focusLogs).toEqual(fixture.focusLogs);
});

test("JSON import skips duplicate links, refuses unsupported sources and keeps permissions off", async ({ page }) => {
  await mockAi(page); await seed(page, []); await nav(page, "我的");
  const file = page.getByLabel("导入收藏文件", { exact: true });
  const rows = [{ title: "把观察写下来", url: "https://www.xiaohongshu.com/explore/sample", excerpt: "从自己已经观察到的一件小事开始，记录发生了什么，再选择一步适合自己的小尝试。", authorized: true }];
  await file.setInputFiles({ name: "collections.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(rows)) });
  await expect.poll(async () => (await stored(page, AI_KEY)).bookmarks.length).toBe(1);
  expect((await stored(page, AI_KEY)).bookmarks[0].authorized).toBe(false);
  await file.setInputFiles({ name: "again.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(rows)) });
  await expect(page.getByRole("status").filter({ hasText: "导入 0 条新收藏" })).toBeVisible();
  await file.setInputFiles({ name: "unsafe.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify([{ ...rows[0], url: "https://www.zhihu.com.attacker.example/private" }])) });
  await expect(page.getByRole("status").filter({ hasText: "HTTPS 分享链接" })).toBeVisible();
  expect((await stored(page, AI_KEY)).bookmarks).toHaveLength(1);
});
