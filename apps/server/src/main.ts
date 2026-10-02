import { createServer } from "./app.ts";

const app = createServer({
  port: Number(process.env.PORT ?? 3000),
  dataDir: process.env.DATA_DIR ?? "./data",
  ...(process.env.STATIC_DIR ? { staticDir: process.env.STATIC_DIR } : {}),
  botDelayMs: Number(process.env.BOT_DELAY_MS ?? 1400),
  // Fly's proxy sets this header and overwrites any value a client sends; elsewhere,
  // set CLIENT_IP_HEADER only when a trusted proxy does the same.
  ...(process.env.FLY_APP_NAME
    ? { clientIpHeader: "fly-client-ip" }
    : process.env.CLIENT_IP_HEADER
      ? { clientIpHeader: process.env.CLIENT_IP_HEADER }
      : {}),
});

console.log(`Shoalow listening on ${app.url}`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    app.stop();
    process.exit(0);
  });
}
