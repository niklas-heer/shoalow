/**
 * Renders the home-screen icons in public/ from the logo, using Playwright's Chromium.
 * Run with `mise run icons` after changing src/assets/shoalow.svg.
 */
import { chromium } from "@playwright/test";

const BACKGROUND = "#0a2a3f";
// The logo's own rounded tile and outline would double up with the rounding iOS applies.
const logo = await Bun.file(new URL("../src/assets/shoalow.svg", import.meta.url)).text();
const svg = logo.replace(/<rect[^>]*\/>/g, "");
const icons = [
  // iOS rounds the corners itself and shows transparency as black, so icons fill the square.
  { file: "apple-touch-icon.png", size: 180, scale: 1 },
  { file: "icon-192.png", size: 192, scale: 1 },
  { file: "icon-512.png", size: 512, scale: 1 },
  // Maskable icons can be cropped to a circle: keep the logo inside the safe zone.
  { file: "icon-maskable-512.png", size: 512, scale: 0.78 },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const { file, size, scale } of icons) {
  await page.setViewportSize({ width: size, height: size });
  const side = Math.round(size * scale);
  await page.setContent(
    `<body style="margin:0;display:grid;place-items:center;width:${size}px;height:${size}px;background:${BACKGROUND}">
      <div style="width:${side}px;height:${side}px">${svg.replace("<svg ", `<svg width="${side}" height="${side}" `)}</div>
    </body>`,
  );
  await page.screenshot({ path: new URL(`../public/${file}`, import.meta.url).pathname });
}
await browser.close();
