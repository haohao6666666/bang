import { expect, test, type Page } from "@playwright/test";

const STORAGE_KEY = "jixiang-prototype-state-v5";

async function openApp(page: Page) {
  await page.clock.install({ time: new Date("2026-10-03T12:00:00+08:00") });
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "主要导航" })).toBeVisible();
}

async function companion(page: Page, name: string) {
  const picture = page.getByRole("img", { name, exact: true });
  await picture.scrollIntoViewIfNeeded();
  await expect(picture).toBeVisible();
  await expect.poll(() => picture.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 100)).toBe(true);
  const source = await picture.getAttribute("src");
  expect(source).not.toContain("/reference/");
  expect(await picture.evaluate((element) => getComputedStyle(element).backgroundImage)).toBe("none");
  return source;
}

test.use({ timezoneId: "Asia/Shanghai" });

test("independent companions follow the workflow without losing paused focus", async ({ page }) => {
  await openApp(page);
  const sources = new Set<string | null>();
  sources.add(await companion(page, "小芽趴在书上，陪你慢慢向前"));
  const previousLogCount = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).focusLogs.length, STORAGE_KEY);
  await page.getByRole("button", { name: "开始投入", exact: true }).click();
  sources.add(await companion(page, "小芽陪你专心读书"));
  await page.clock.runFor(3_000);
  await page.getByRole("button", { name: "先停一下", exact: true }).click();
  sources.add(await companion(page, "小芽陪你休息片刻"));
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).focusLogs.length, STORAGE_KEY)).toBe(previousLogCount + 1);

  await page.getByRole("button", { name: "遇到卡点？先记下来", exact: true }).click();
  sources.add(await companion(page, "小芽正在思考"));
  const nav = page.getByRole("navigation", { name: "主要导航" });
  await nav.getByRole("button", { name: "我的", exact: true }).click();
  sources.add(await companion(page, "小芽为你轻轻加油"));
  expect(sources.size).toBe(5);

  await page.keyboard.press("Escape");
  await page.reload();
  const persisted = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
  expect(persisted.focusSession.status).toBe("paused");
  expect(persisted.focusLogs.length).toBe(previousLogCount + 1);
  expect(persisted.focusLogs.at(-1).durationMs).toBeGreaterThanOrEqual(3_000);
});

test("collection artwork and full-width explanations fit both phone presets", async ({ page }) => {
  await openApp(page);
  await page.getByRole("navigation", { name: "主要导航" }).getByRole("button", { name: "足迹", exact: true }).click();
  await page.getByRole("tab", { name: "我的印章册", exact: true }).click();
  const card = page.getByTestId("stamp-card-time:book");
    await card.scrollIntoViewIfNeeded();
    await expect(card.getByRole("img", { name: "书页印印章", exact: true })).toBeVisible();
    await expect(card).toContainText("出现方式");
    await expect(card).toContainText("未获得");
    const sizes = await card.evaluate((element) => {
      const card = element.getBoundingClientRect();
      const meaning = element.querySelector(".stamp-collection-meaning")!.getBoundingClientRect();
      const picture = element.querySelector("img")!.getBoundingClientRect();
      const viewport = document.querySelector(".app-screen")!.getBoundingClientRect();
      return {
        meaningWidth: meaning.width / card.width,
        pictureWidth: picture.width / card.width,
        insideViewport: card.left >= viewport.left - 1 && card.right <= viewport.right + 1,
      };
    });
    expect(sizes.insideViewport).toBe(true);
    expect(sizes.meaningWidth).toBeGreaterThan(.75);
    expect(sizes.pictureWidth).toBeGreaterThan(.18);
    await card.click();
    await expect(page.getByTestId("stamp-collection-detail")).toContainText("同一天、同一任务累计留下 10 分钟真实投入");
    await page.keyboard.press("Escape");
  await expect(page.getByTestId("phone-frame")).toHaveCount(0);
  await expect(page.locator(".status-bar")).toHaveCount(0);
});
