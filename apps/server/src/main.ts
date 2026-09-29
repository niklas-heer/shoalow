import { createServer } from "./app.ts";

const app = createServer({
  port: Number(process.env.PORT ?? 3000),
  dataDir: process.env.DATA_DIR ?? "./data",
  ...(process.env.STATIC_DIR ? { staticDir: process.env.STATIC_DIR } : {}),
  botDelayMs: Number(process.env.BOT_DELAY_MS ?? 1000),
});

console.log(`Shoalow listening on ${app.url}`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    app.stop();
    process.exit(0);
  });
}
