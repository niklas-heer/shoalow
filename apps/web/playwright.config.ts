import { defineConfig, devices } from "@playwright/test";

const PORT = 4317;

export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  fullyParallel: false,
  reporter: [["list"]],
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, testIgnore: /mobile/ },
    // Safari on iPhone and iPad, in both orientations.
    { name: "iphone", use: { ...devices["iPhone 15"] }, testMatch: /mobile/ },
    { name: "iphone-landscape", use: { ...devices["iPhone 15 landscape"] }, testMatch: /mobile/ },
    { name: "ipad", use: { ...devices["iPad (gen 7)"] }, testMatch: /mobile/ },
    { name: "ipad-landscape", use: { ...devices["iPad (gen 7) landscape"] }, testMatch: /mobile/ },
  ],
  webServer: {
    command: `rm -rf ../../.data/e2e && bun ../server/src/main.ts`,
    env: { PORT: String(PORT), STATIC_DIR: "dist", DATA_DIR: "../../.data/e2e", BOT_DELAY_MS: "40" },
    url: `http://127.0.0.1:${PORT}/healthz`,
    reuseExistingServer: false,
  },
});
