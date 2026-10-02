import { expect, test } from "bun:test";
import { clientKey, RateLimiter } from "../src/limits.ts";

test("a bucket allows its burst, then refills at its rate", () => {
  let now = 0;
  const limiter = new RateLimiter({ burst: 3, perSecond: 0.5 }, () => now);
  expect([limiter.take("a"), limiter.take("a"), limiter.take("a")]).toEqual([0, 0, 0]);
  expect(limiter.take("a")).toBe(2);
  expect(limiter.take("b")).toBe(0);
  now += 2000;
  expect(limiter.take("a")).toBe(0);
  expect(limiter.take("a")).toBeGreaterThan(0);
});

test("buckets that have refilled are forgotten", () => {
  let now = 0;
  const limiter = new RateLimiter({ burst: 2, perSecond: 1 }, () => now);
  for (let i = 0; i < 1000; i++) limiter.take(`client-${i}`);
  expect(limiter.size).toBe(1000);
  now += 1500;
  limiter.prune();
  expect(limiter.size).toBe(0);
});

test("clients are keyed by IPv4 address or by IPv6 /64", () => {
  expect(clientKey("203.0.113.7")).toBe("203.0.113.7");
  expect(clientKey("::ffff:203.0.113.7")).toBe("203.0.113.7");
  expect(clientKey("2001:db8:a:b:1:2:3:4")).toBe("2001:db8:a:b::/64");
  expect(clientKey("2001:0db8:000a:000b::ff")).toBe("2001:db8:a:b::/64");
  expect(clientKey("2001:db8::1")).toBe("2001:db8:0:0::/64");
  expect(clientKey("fe80::1%en0")).toBe("fe80:0:0:0::/64");
  expect(clientKey("::1")).toBe("0:0:0:0::/64");
  expect(clientKey("")).toBe("unknown");
  expect(clientKey(null)).toBe("unknown");
  expect(clientKey("1:2:3:4:5:6:7:8:9::")).toBe("1:2:3:4::/64");
});
