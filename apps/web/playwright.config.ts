import { defineConfig, devices } from "@playwright/test";

const PORT = 4317;

export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  fullyParallel: false,
  reporter: [["list"]],
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `rm -rf ../../.data/e2e && bun ../server/src/main.ts`,
    env: { PORT: String(PORT), STATIC_DIR: "dist", DATA_DIR: "../../.data/e2e", BOT_DELAY_MS: "40" },
    url: `http://127.0.0.1:${PORT}/healthz`,
    reuseExistingServer: false,
  },
});
