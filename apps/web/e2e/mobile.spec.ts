import { expect, type Page, test } from "@playwright/test";

/** Everything a turn needs must be on screen at once: no scrolling between piles and cards. */
async function expectOnScreen(page: Page) {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("no viewport");
  for (const selector of ["section.mine .board", '[data-anchor="deck"]', '[data-anchor="discard"]', ".prompt"]) {
    const box = await page.locator(selector).boundingBox();
    expect(box, selector).not.toBeNull();
    expect(box?.y ?? -1, `${selector} top`).toBeGreaterThanOrEqual(0);
    expect((box?.y ?? 0) + (box?.height ?? 0), `${selector} bottom`).toBeLessThanOrEqual(viewport.height);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  expect(await page.evaluate(() => scrollY), "the table starts at the top").toBe(0);
}

test("a practice round fits the screen and shows the faces of turned cards", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/learn");
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole("button", { name: "Start the practice game" }).tap();
  await expectOnScreen(page);

  const mine = page.locator("section.mine");
  await mine.locator("button.card.selectable").first().tap();
  await mine.locator("button.card.selectable").first().tap();
  await expect(page.locator(".prompt")).toHaveText(/^Draw from the pile or take the \d+$/, { timeout: 10_000 });

  // Safari can draw a card's back over its front; a turned card must show only its face.
  const up = mine.locator(".card:not(.down)");
  await expect(up).toHaveCount(2);
  for (const card of await up.all()) {
    await expect(card.locator(".front > svg")).toBeVisible();
    await expect(card.locator(".back")).toBeHidden();
  }
  await expect(mine.locator(".card.down .front").first()).toBeHidden();
  await expect(page.locator('[data-anchor="discard"] .card .front > svg')).toBeVisible();

  await page.getByRole("button", { name: /Draw pile/ }).tap();
  await expect(page.locator(".prompt")).toHaveText("Swap it into your grid, or drop it on the discard pile");
  await expect(page.locator('[data-anchor="hand"] .card .front > svg')).toBeVisible();
  await expectOnScreen(page);

  // The turn steps are on screen and clear of the piles.
  const steps = await page.locator(".turn-steps ol").boundingBox();
  expect(steps).not.toBeNull();
  const viewport = page.viewportSize();
  expect((steps?.x ?? 0) + (steps?.width ?? 0)).toBeLessThanOrEqual(viewport?.width ?? 0);
  for (const pile of ['[data-anchor="deck"]', '[data-anchor="discard"]']) {
    const box = await page.locator(pile).boundingBox();
    const apart =
      !steps ||
      !box ||
      steps.x + steps.width <= box.x ||
      box.x + box.width <= steps.x ||
      steps.y + steps.height <= box.y ||
      box.y + box.height <= steps.y;
    expect(apart, `turn steps overlap ${pile}`).toBe(true);
  }
  expect(errors).toEqual([]);
});
