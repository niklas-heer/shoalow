import { expect, type Page, test } from "@playwright/test";

test("browse every illustrated card and return to the game", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Your name").fill("Anna");
  await page.getByRole("button", { name: "Meet the cards", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Meet the shoal" })).toBeVisible();
  const cards = page.getByRole("region", { name: "All fifteen cards" }).getByRole("img");
  await expect(cards).toHaveCount(15);
  await expect(cards.first()).toHaveAttribute("aria-label", "−2, pearl clam");
  await expect(cards.last()).toHaveAttribute("aria-label", "12, anglerfish");
  const asset = await cards.first().locator("image").getAttribute("href");
  expect(asset).toBeTruthy();
  const response = await page.request.get(asset ?? "");
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("image/png");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Meet the shoal" })).toBeVisible();
  await page.getByRole("button", { name: "Back to Shoalow" }).click();
  await expect(page.getByRole("button", { name: "Create a table" })).toBeVisible();
});

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

test("the table shows where you can play and previews a swap under the mouse", async ({ page }) => {
  await page.goto("/learn");
  await page.getByRole("button", { name: "Start the practice game" }).click();
  const mine = page.locator("section.mine");
  const pulsing = (selector: string) =>
    page
      .locator(selector)
      .evaluateAll((els) => els.map((el) => getComputedStyle(el, "::after").animationName.includes("pulse")));

  // Only the cards you may reveal pulse, not the piles.
  expect(await pulsing("section.mine button.card.selectable")).toEqual(Array(12).fill(true));
  await expect(page.locator(".piles .selectable")).toHaveCount(0);
  await mine.locator("button.card.selectable").first().click();
  await mine.locator("button.card.selectable").first().click();
  await expect(page.locator(".prompt")).toHaveText(/^Draw from the pile or take the \d+$/, { timeout: 10_000 });

  // Pointing at the draw pile shows a face-down card arriving in your hand.
  expect(await pulsing(".piles button.card.selectable")).toEqual([true, true]);
  await page.getByRole("button", { name: /Draw pile/ }).hover();
  await expect(page.locator('[data-anchor="hand"] .preview .card.down')).toBeVisible();
  await page.getByRole("button", { name: /Draw pile/ }).click();
  await expect(page.locator(".prompt")).toHaveText("Swap it into your grid, or drop it on the discard pile");
  const held = await page.locator('[data-anchor="hand"] .held .card').getAttribute("aria-label");

  // Every grid card and the discard pile are now places the drawn card can go.
  expect(await pulsing("section.mine button.card.selectable")).toEqual(Array(12).fill(true));
  expect(await pulsing('[data-anchor="discard"] button.card.selectable')).toEqual([true]);

  // Hovering a face-down card previews the drawn card there and a face-down card leaving.
  const target = mine
    .locator(".cell")
    .filter({ has: page.locator(".card.down") })
    .first();
  await target.hover();
  const ghost = target.locator(".preview .card");
  await expect(ghost).toBeVisible();
  expect((await ghost.getAttribute("aria-label"))?.split(": ").at(-1)).toBe(held?.split(": ").at(-1));
  await expect(page.locator('[data-anchor="discard"] .preview .card.down')).toBeVisible();
  await page.mouse.move(0, 0);
  await expect(page.locator(".preview")).toHaveCount(0);
});

test("a finished game throws confetti and puts a trophy beside the winner", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByLabel("Your name").fill("Anna");
  await page.getByLabel("Game goal").fill("10");
  await page.getByRole("button", { name: "Create a table" }).click();
  await page.getByRole("button", { name: "Add normal bot" }).click();
  await page.getByRole("button", { name: "Start with 2 players" }).click();

  const final = page.getByRole("heading", { name: /wins? with|share the win/ });
  for (let i = 0; i < 2000 && !(await final.isVisible()); i++) {
    const next = page.getByRole("button", { name: /^Start round \d+$/ });
    if (await next.isVisible()) await next.click();
    else if (!(await step(page))) await page.waitForTimeout(50);
  }
  await expect(final).toBeVisible();
  await expect(page.locator("canvas.confetti")).toBeAttached();

  const winners = page.locator(".rows li.winner");
  expect(await winners.count()).toBeGreaterThan(0);
  await expect(winners.getByRole("img", { name: "winner" })).toHaveCount(await winners.count());
  await expect(page.locator(".rows li:not(.winner)").getByRole("img", { name: "winner" })).toHaveCount(0);
  await expect(page.locator("canvas.confetti")).not.toBeAttached({ timeout: 6_000 });

  // A reload shows the result again, with the trophies but without a second burst.
  await page.reload();
  await expect(final).toBeVisible();
  await expect(winners.getByRole("img", { name: "winner" })).toHaveCount(await winners.count());
  await page.waitForTimeout(300);
  await expect(page.locator("canvas.confetti")).toHaveCount(0);
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

for (const width of [1440, 1240, 1000, 390]) {
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
    // The whole table fits the screen, so on a 900px-high window the cards are sized by height.
    expect(before[1]?.width, "player cards stay readable").toBeGreaterThanOrEqual(width === 1440 ? 95 : 75);
    expect((before[0]?.y ?? 0) + (before[0]?.height ?? 0), "your cards fit on the screen").toBeLessThanOrEqual(900);
    // Phones put smaller piles beside the prompt so the whole table fits on one screen.
    expect(before[2]?.width, "pile cards stay readable").toBeGreaterThanOrEqual(width >= 1000 ? 100 : 56);
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

test("a table reconnects straight away when a phone wakes up with a dead connection", async ({ page }) => {
  // Each socket can be cut off silently, like one a locked phone left behind.
  const live: boolean[] = [];
  await page.routeWebSocket(/\/ws\?/, (ws) => {
    const i = live.push(true) - 1;
    const server = ws.connectToServer();
    ws.onMessage((m) => {
      if (live[i]) server.send(m);
    });
    server.onMessage((m) => {
      if (live[i]) ws.send(m);
    });
  });
  await page.goto("/");
  await page.getByLabel("Your name").fill("Anna");
  await page.getByRole("button", { name: "Create a table" }).click();
  await expect(page.locator(".seats li")).toHaveCount(1);
  expect(live).toHaveLength(1);

  live[0] = false;
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect.poll(() => live.length, { timeout: 8_000 }).toBe(2);

  await page.getByRole("button", { name: "Add normal bot" }).click();
  await expect(page.locator(".seats li")).toHaveCount(2);
});

test("the game can be added to a phone's home screen", async ({ page }) => {
  await page.goto("/");
  const manifestUrl = await page.locator('link[rel="manifest"]').getAttribute("href");
  const manifest = await (await page.request.get(manifestUrl ?? "")).json();
  expect(manifest).toMatchObject({ name: "Shoalow", display: "standalone", start_url: "/" });
  const touchIcon = await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");
  for (const src of [touchIcon, ...manifest.icons.map((icon: { src: string }) => icon.src)]) {
    const response = await page.request.get(src ?? "");
    expect(response.ok(), src ?? "").toBe(true);
    expect(response.headers()["content-type"]).toContain("image/png");
  }
});
