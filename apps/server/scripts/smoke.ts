/**
 * Checks a running production image from the outside: it answers, sends its security headers,
 * and can save a table to its data volume. Usage: bun smoke.ts http://host:8080
 */
const base = process.argv[2] ?? "http://localhost:8080";

async function check(what: string, test: () => Promise<boolean>): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      if (await test()) {
        console.log(`ok   ${what}`);
        return;
      }
    } catch {
      // Not up yet.
    }
    await Bun.sleep(200);
  }
  console.error(`FAIL ${what}`);
  process.exit(1);
}

await check("health check answers", async () => (await fetch(`${base}/healthz`)).ok);
await check("the page carries its security policy", async () => {
  const res = await fetch(`${base}/`);
  return res.ok && (res.headers.get("content-security-policy") ?? "").includes("default-src 'self'");
});
await check("a table is created and saved on the volume", async () => {
  const res = await fetch(`${base}/api/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Smoke" }),
  });
  const body = (await res.json()) as { code?: string };
  return res.ok && typeof body.code === "string" && (await fetch(`${base}/api/rooms/${body.code}`)).ok;
});
