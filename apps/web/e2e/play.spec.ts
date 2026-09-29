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
