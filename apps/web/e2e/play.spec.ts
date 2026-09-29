import { expect, type Page, test } from "@playwright/test";

/** Takes one sensible step if this page has something to do; returns whether it acted. */
async function step(page: Page): Promise<boolean> {
  const selectable = page.locator("button.card.selectable");
  if ((await selectable.count()) === 0) return false;
  const prompt = (await page.locator(".prompt").textContent()) ?? "";
  let target = selectable.first();
  if (/^(Last turn! )?Draw/.test(prompt)) target = page.getByRole("button", { name: /Draw pile/ });
  else if (prompt.startsWith("Swap it into your grid"))
    target = page.locator("section.mine button.card.selectable").first();
  // The table can move on between reading and clicking; then simply look again.
  return target.click({ timeout: 1000 }).then(
    () => true,
    () => false,
  );
}

test("two players and a bot play a full round in the browser", async ({ browser }) => {
  const host = await (await browser.newContext()).newPage();
  const guest = await (await browser.newContext()).newPage();
  const errors: string[] = [];
  for (const p of [host, guest]) p.on("pageerror", (e) => errors.push(e.message));

  await host.goto("/");
  await host.getByLabel("Your name").fill("Anna");
  await host.getByRole("button", { name: "Create a table" }).click();
  const codeText = host.locator("p.code");
  await expect(codeText).toHaveText(/^[A-Z2-9]{5}$/);
  const code = (await codeText.textContent())?.trim() ?? "";

  await guest.goto(`/r/${code}`);
  await guest.getByLabel("Your name").fill("Ben");
  await guest.getByRole("button", { name: "Take a seat" }).click();
  await expect(guest.getByText("Waiting for Anna to start the game")).toBeVisible();

  await host.getByRole("button", { name: "Add normal bot" }).click();
  await expect(host.locator(".seats li")).toHaveCount(3);
  await host.getByRole("button", { name: "Start with 3 players" }).click();

  for (const p of [host, guest]) await expect(p.locator(".prompt")).toHaveText("Reveal two of your cards");

  // Play until both see the round summary.
  const summary = (p: Page) => p.getByRole("heading", { name: "Round 1 is over" });
  for (let i = 0; i < 600; i++) {
    if ((await summary(host).isVisible()) && (await summary(guest).isVisible())) break;
    const acted = (await step(host)) || (await step(guest));
    if (!acted) await host.waitForTimeout(50);
  }
  await expect(summary(host)).toBeVisible();
  await expect(summary(guest)).toBeVisible();

  // Scores add up the same way on both screens.
  const totals = async (p: Page) => (await p.locator(".rows .total").allTextContents()).map((t) => t.trim());
  expect(await totals(host)).toHaveLength(3);
  expect((await totals(host)).sort()).toEqual((await totals(guest)).sort());

  await guest.getByRole("button", { name: "Start round 2" }).click();
  for (const p of [host, guest]) await expect(p.locator(".prompt")).toHaveText("Reveal two of your cards");

  // A reload keeps the seat.
  await guest.reload();
  await expect(guest.locator(".prompt")).toHaveText("Reveal two of your cards");
  expect(errors).toEqual([]);
});

test("the practice game coaches a new player through the opening", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Learn with a practice game" }).click();
  await page.getByRole("button", { name: "Start the practice game" }).click();
  await expect(page.locator(".coach .title")).toHaveText("Peek at two cards");

  const mine = page.locator("section.mine button.card.selectable");
  await mine.first().click();
  await expect(page.locator(".coach .title")).toHaveText("One more");
  await mine.first().click();

  // Once both sides have revealed, someone's turn starts and the coach follows it.
  await expect(page.locator(".coach .title")).toHaveText(/Take the 0|Kelp's turn/, { timeout: 10_000 });
  expect(errors).toEqual([]);
});

test("choose a goal, stop the game, restart and exit with a bot taking over", async ({ browser }) => {
  const host = await (await browser.newContext()).newPage();
  const guest = await (await browser.newContext()).newPage();
  await host.goto("/");
  await host.getByLabel("Your name").fill("Anna");
  await host.getByRole("button", { name: "Quick 50" }).click();
  await expect(host.getByLabel("Game goal")).toHaveValue("50");
  await expect(host.locator(".estimate")).toContainText("minutes");
  await host.getByRole("button", { name: "Create a table" }).click();
  await expect(host.getByLabel("Game goal")).toHaveValue("50");
  const code = (await host.locator("p.code").textContent())?.trim() ?? "";
  await guest.goto(`/r/${code}`);
  await guest.getByLabel("Your name").fill("Ben");
  await guest.getByRole("button", { name: "Take a seat" }).click();
  await expect(guest.getByLabel("Game goal")).toBeDisabled();
  await host.getByRole("button", { name: "Start with 2 players" }).click();
  await expect(guest.locator(".prompt")).toHaveText("Reveal two of your cards");
  await host.getByRole("button", { name: "Game menu" }).click();
  await host.getByRole("button", { name: "Stop game…" }).click();
  await host.getByRole("button", { name: "Keep playing" }).click();
  await expect(host.getByRole("button", { name: "Stop game…" })).toBeVisible();
  await host.getByRole("button", { name: "Stop game…" }).click();
  await host.getByRole("button", { name: "Stop and return to lobby" }).click();
  for (const page of [host, guest]) await expect(page.getByLabel("Game goal")).toHaveValue("50");
  await host.getByRole("button", { name: "Classic 100" }).click();
  await host.getByRole("button", { name: "Start with 2 players" }).click();
  await expect(host.locator(".prompt")).toHaveText("Reveal two of your cards");
  await host.getByRole("button", { name: "Game menu" }).click();
  await host.getByRole("button", { name: "Exit game", exact: true }).click();
  await expect(host.getByRole("button", { name: "Create a table" })).toBeVisible();
  await guest.getByRole("button", { name: "Game menu" }).click();
  await expect(guest.getByRole("button", { name: "Stop game…" })).toBeVisible();
  await guest.getByRole("button", { name: "Close", exact: true }).click();
  await guest.reload();
  await expect(guest.locator(".prompt")).toHaveText("Reveal two of your cards");
  await guest.getByRole("button", { name: "Game menu" }).click();
  await guest.getByRole("button", { name: "Exit game", exact: true }).click();
  await expect(guest.getByRole("button", { name: "Create a table" })).toBeVisible();
  const gone = await guest.request.get(`/api/rooms/${code}`);
  expect(gone.status()).toBe(404);
});

for (const width of [1440, 390]) {
  test(`cards and piles keep their geometry through reveals and draws at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/learn");
    await page.evaluate(() => document.fonts.ready);
    await page.getByRole("button", { name: "Start the practice game" }).click();
    const board = page.locator("section.mine .board");
    const firstCard = board.locator(".card").first();
    const deck = page.locator('[data-anchor="deck"] .card');
    const geometry = () =>
      page.evaluate(() =>
        ["section.mine .board", "section.mine .card", '[data-anchor="deck"] .card', '[data-anchor="hand"]'].map(
          (selector) => {
            const rect = document.querySelector(selector)?.getBoundingClientRect();
            return rect
              ? { x: rect.x + window.scrollX, y: rect.y + window.scrollY, width: rect.width, height: rect.height }
              : null;
          },
        ),
      );
    const before = await geometry();
    await firstCard.click();
    await expect(page.locator(".prompt")).toHaveText("Reveal one more card");
    await board.locator("button.card.selectable").first().click();
    await expect(page.locator(".prompt")).toHaveText(/^Draw from the pile or take the \d+$/, { timeout: 10_000 });
    const assertStable = async () => {
      const after = await geometry();
      for (const [index, rect] of after.entries()) {
        expect(rect).not.toBeNull();
        for (const key of ["x", "y", "width", "height"] as const)
          expect(rect?.[key], `element ${index}, ${key}`).toBeCloseTo(before[index]?.[key] ?? 0, 0);
      }
    };
    await assertStable();
    await deck.click();
    await expect(page.locator(".prompt")).toHaveText("Swap it into your grid, or drop it on the discard pile");
    await assertStable();
    await expect(page.locator(".board-hint")).toContainText("Tap a card below to swap");
    await page.getByRole("button", { name: /Discard pile, drop your card here/ }).click();
    await expect(page.locator(".prompt")).toHaveText("Reveal one of your face-down cards");
    await assertStable();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}
