import { expect, test, type Locator, type Page } from "@playwright/test";

async function drag(page: Page, locator: Locator, deltaX: number, deltaY: number, steps = 8) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Drag target has no bounding box");
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  for (let step = 1; step <= steps; step += 1) {
    await page.mouse.move(
      startX + (deltaX * step) / steps,
      startY + (deltaY * step) / steps,
    );
    await page.waitForTimeout(8);
  }
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/runtime-fixture.html");
});

test("horizontal intent stays in Carousel and cannot create parent momentum", async ({ page }) => {
  const carousel = page.locator(".fixture-carousel");
  const card = page.locator(".carousel-card").nth(1);
  const parent = page.getByTestId("mobile-scroll");

  await expect(carousel).not.toHaveAttribute("data-scroll-drag", "ignore");
  await drag(page, card, -130, 14, 5);

  const afterRelease = await carousel.evaluate((element) => element.scrollLeft);
  expect(afterRelease).toBeGreaterThan(40);
  expect(await parent.evaluate((element) => element.scrollTop)).toBe(0);

  await page.waitForTimeout(250);
  expect(await parent.evaluate((element) => element.scrollTop)).toBe(0);
  expect(await page.getByTestId("tap-count").textContent()).toBe("0");
});

test("vertical intent over a carousel is handed to MobileScroll in both directions", async ({ page }) => {
  const card = page.locator(".carousel-card").nth(1);
  const carousel = page.locator(".fixture-carousel");
  const parent = page.getByTestId("mobile-scroll");

  await drag(page, card, 4, -150);
  expect(await parent.evaluate((element) => element.scrollTop)).toBeGreaterThan(60);
  expect(await carousel.evaluate((element) => element.scrollLeft)).toBe(0);

  await parent.evaluate((element) => {
    element.scrollTop = 80;
  });
  await drag(page, card, -3, 110);
  expect(await parent.evaluate((element) => element.scrollTop)).toBeLessThan(80);
});

test("tap activates a card but a completed drag does not", async ({ page }) => {
  const firstCard = page.locator(".carousel-card").first();
  await firstCard.click();
  await expect(page.getByTestId("tap-count")).toHaveText("1");

  await drag(page, firstCard, -100, 6);
  await expect(page.getByTestId("tap-count")).toHaveText("1");
});

test("Carousel preserves momentum and edge rubber-banding", async ({ page }) => {
  const carousel = page.locator(".fixture-carousel");
  const card = page.locator(".carousel-card").nth(1);

  await drag(page, card, -100, 5, 3);
  const releasedOffset = await carousel.evaluate((element) => element.scrollLeft);
  await page.waitForTimeout(120);
  expect(await carousel.evaluate((element) => element.scrollLeft)).toBeGreaterThan(releasedOffset);

  await carousel.evaluate((element) => {
    element.scrollLeft = 0;
  });
  const box = await card.boundingBox();
  if (!box) throw new Error("Card has no bounding box");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2, { steps: 4 });
  expect(Number(await carousel.getAttribute("data-overscroll"))).toBeGreaterThan(0);
  await page.mouse.up();
  await page.waitForTimeout(900);
  expect(Math.abs(Number(await carousel.getAttribute("data-overscroll")))).toBeLessThan(1);
});

test("BottomSheet remains mounted while its default exit animation plays", async ({ page }) => {
  await page.locator(".sheet-trigger").click();
  await expect(page.getByTestId("bottom-sheet")).toBeVisible();

  // Stay inside the curved device screen; its top-left 8px corner is clipped.
  await page.getByTestId("sheet-overlay").click({ position: { x: 50, y: 120 } });
  await expect(page.getByTestId("bottom-sheet")).toHaveCount(1);
  await page.waitForTimeout(500);
  await expect(page.getByTestId("bottom-sheet")).toHaveCount(0);
});

test("keyboard and its attached footer dismiss on the same transition", async ({ page }) => {
  await page.goto("/tests/runtime-fixture.html?fixture=keyboard");
  const input = page.getByLabel("Message");
  const footer = page.getByTestId("flow-fixed-footer");
  const dismissZone = page.getByTestId("keyboard-dismiss-zone");
  const keyboard = page.getByTestId("keyboard-dock");

  await input.click();
  await expect(keyboard).toHaveAttribute("data-visible", "true");
  await expect
    .poll(
      () => footer.evaluate((element) => Number.parseFloat(getComputedStyle(element).bottom)),
      { message: "keyboard footer settles above the visible keyboard" },
    )
    .toBeGreaterThan(337);
  await drag(page, dismissZone, 0, 120, 5);
  await expect(keyboard).toHaveAttribute("data-visible", "false");

  await page.waitForTimeout(100);
  const progress = await page.evaluate(() => {
    const footerElement = document.querySelector<HTMLElement>('[data-testid="flow-fixed-footer"]')!;
    const keyboardElement = document.querySelector<HTMLElement>('[data-testid="keyboard-dock"]')!;
    const fullHeight = Number.parseFloat(keyboardElement.style.height);
    const footerRemaining = Number.parseFloat(getComputedStyle(footerElement).bottom);
    const matrix = new DOMMatrixReadOnly(getComputedStyle(keyboardElement).transform);
    return {
      footer: footerRemaining / fullHeight,
      keyboard: 1 - matrix.m42 / fullHeight,
    };
  });
  expect(Math.abs(progress.footer - progress.keyboard)).toBeLessThan(0.18);

  await page.waitForTimeout(300);
  expect(await footer.evaluate((element) => getComputedStyle(element).bottom)).toBe("34px");
});

test("device preview no longer offers Pixel", async ({page}) => {
  await page.getByTestId("device-picker").click();
  await expect(page.getByTestId("device-option-iphone")).toBeVisible();
  await expect(page.locator('[data-testid="device-option-pixel-10"]')).toHaveCount(0);
});

test("FlowStack pushes and pops screens while dismissing the keyboard", async ({ page }) => {
  await page.goto("/tests/runtime-fixture.html?fixture=flow");
  await page.getByLabel("Flow message").click();
  await expect(page.getByTestId("keyboard-dock")).toHaveAttribute("data-visible", "true");

  await page.getByRole("button", { name: "Push level 2" }).click();
  await expect(page.getByRole("heading", { name: "Screen stacking works" })).toBeVisible();
  await expect(page.getByTestId("keyboard-dock")).toHaveAttribute("data-visible", "false");
  const safeHeaderPlacement = await page.evaluate(() => {
    const screen = document.querySelector<HTMLElement>('[data-testid="device-screen"]')!;
    const toolbar = document.querySelector<HTMLElement>(".flow-fixture-header")!;
    return toolbar.getBoundingClientRect().top - screen.getBoundingClientRect().top;
  });
  expect(safeHeaderPlacement).toBeGreaterThanOrEqual(54);

  await page.getByRole("button", { name: "Push level 3" }).click();
  await expect(page.getByRole("heading", { name: "Nested view level 3" })).toBeVisible();
  await page.getByRole("button", { name: "Push level 4" }).click();
  await expect(page.getByRole("heading", { name: "Nested view level 4" })).toBeVisible();

  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("heading", { name: "Nested view level 3" })).toBeVisible();
  await page.getByRole("button", { name: "‹ Back" }).click();
  await expect(page.getByRole("heading", { name: "Screen stacking works" })).toBeVisible();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("heading", { name: "Flow root" })).toBeVisible();
});
