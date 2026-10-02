/**
 * Takes the README's screenshots from a real game: starts the server on a temporary data
 * directory, sits down with a few bots and plays until a lively moment on your turn. The
 * table is shot in Chromium on a computer and in WebKit on an iPhone, plus the lobby's house
 * rules and the first cards. Run with `mise run screenshots`; it builds the client first.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Browser, chromium, devices, type Page, webkit } from "@playwright/test";
import { createServer } from "../../server/src/app.ts";

const out = (name: string) => new URL(`../../../docs/screenshots/${name}`, import.meta.url).pathname;
const dataDir = mkdtempSync(join(tmpdir(), "shoalow-shots-"));
const app = createServer({
  port: 0,
  hostname: "127.0.0.1",
  dataDir,
  staticDir: new URL("../dist", import.meta.url).pathname,
  botDelayMs: 150,
  limits: { messages: { burst: 10_000, perSecond: 10_000 } },
});
const base = app.url.origin;

/** Creates a table with the given bots, waiting in the lobby. */
async function sitDown(page: Page, bots: ("easy" | "normal")[]): Promise<void> {
  await page.goto(base);
  await page.getByLabel("Your name").fill("Anna");
  await page.getByRole("button", { name: "Create a table" }).click();
  for (const level of bots) await page.getByRole("button", { name: `Add ${level} bot` }).click();
  await page.locator(".seats li").nth(bots.length).waitFor();
}

/**
 * Plays sensible moves until it is our turn to choose a pile, at least `revealed` of our
 * cards are face up and the table has had `turns` turns, so the shot shows a game under way.
 */
async function playUntilShot(page: Page, revealed: number, turns: number): Promise<void> {
  const mine = page.locator("section.mine button.card.selectable");
  const faceUp = page.locator("section.mine .card:not(.down)");
  const hidden = page.locator("section.mine button.card.selectable.down");
  let ourTurns = 0;
  const nextRound = page.getByRole("button", { name: /^Start round/ });
  for (let i = 0; i < 4000; i++) {
    if (await nextRound.isVisible()) {
      await nextRound.click().catch(() => {});
      continue;
    }
    const prompt = (await page.locator(".prompt").textContent()) ?? "";
    const choosing = /Draw from the pile or take the/.test(prompt);
    const lastTurns = prompt.startsWith("Last turn");
    if (choosing && !lastTurns && (await faceUp.count()) >= revealed && ourTurns >= turns) return;
    if ((await mine.count()) === 0 && !choosing) {
      await page.waitForTimeout(40);
      continue;
    }
    if (choosing) {
      ourTurns += 1;
      await page
        .locator('[data-anchor="deck"] button.card')
        .click({ force: true, timeout: 1000 })
        .catch(() => {});
    } else {
      // Reveal face-down cards until enough show, then swap into face-up ones to keep the round going.
      const target = (await faceUp.count()) < revealed && (await hidden.count()) > 0 ? hidden.first() : mine.first();
      await target.click({ force: true, timeout: 1000 }).catch(() => {});
    }
  }
  throw new Error("never reached a good moment for the screenshot");
}

async function settle(page: Page): Promise<void> {
  await page.mouse.move(1, 1);
  await page.waitForTimeout(1500);
}

async function desktop(browser: Browser): Promise<void> {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await sitDown(page, ["normal", "easy", "normal", "normal"]);
  await page.locator("label", { hasText: "Counts" }).click();
  await settle(page);
  await page.locator("section.settings").screenshot({ path: out("house-rules.jpg"), type: "jpeg", quality: 85 });
  await page.getByRole("button", { name: "Start with 5 players" }).click();
  await playUntilShot(page, 6, 4);
  await settle(page);
  await page.screenshot({ path: out("table-desktop.jpg"), type: "jpeg", quality: 85 });

  await page.goto(`${base}/cards`);
  await settle(page);
  const cards = page.locator("section.cards");
  const box = await cards.boundingBox();
  const first = await cards.locator(".card").first().boundingBox();
  if (!box || !first) throw new Error("cards not laid out");
  await page.screenshot({
    path: out("cards.jpg"),
    type: "jpeg",
    quality: 85,
    clip: { x: box.x, y: box.y, width: box.width, height: first.height },
  });
  await page.close();
}

async function iphone(browser: Browser): Promise<void> {
  const context = await browser.newContext({ ...devices["iPhone 15"], deviceScaleFactor: 2 });
  const page = await context.newPage();
  await sitDown(page, ["normal", "easy", "normal"]);
  await page.getByRole("button", { name: "Start with 4 players" }).click();
  await playUntilShot(page, 6, 4);
  await settle(page);
  await page.screenshot({ path: out("table-iphone.jpg"), type: "jpeg", quality: 85 });
  await context.close();
}

const browsers: Browser[] = [];
try {
  const chrome = await chromium.launch();
  browsers.push(chrome);
  await desktop(chrome);
  const safari = await webkit.launch();
  browsers.push(safari);
  await iphone(safari);
  console.log("Saved docs/screenshots/{table-desktop,table-iphone,house-rules,cards}.jpg");
} finally {
  for (const b of browsers) await b.close();
  app.stop();
  rmSync(dataDir, { recursive: true, force: true });
}
