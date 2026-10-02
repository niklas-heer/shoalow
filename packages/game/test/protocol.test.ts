import { expect, test } from "bun:test";
import { cleanName, parseClientMessage } from "../src/index.ts";

test("valid client messages parse to exactly their known fields", () => {
  expect(parseClientMessage('{"t":"action","action":{"type":"swap","index":3,"extra":1}}')).toEqual({
    t: "action",
    action: { type: "swap", index: 3 },
  });
  expect(parseClientMessage('{"t":"addBot","level":"easy"}')).toEqual({ t: "addBot", level: "easy" });
  expect(parseClientMessage('{"t":"takeover","seat":2,"bot":true}')).toEqual({ t: "takeover", seat: 2, bot: true });
  expect(parseClientMessage('{"t":"start"}')).toEqual({ t: "start" });
  expect(parseClientMessage('{"t":"setBotSpeed","speed":"slow"}')).toEqual({ t: "setBotSpeed", speed: "slow" });
  expect(parseClientMessage('{"t":"setShowSums","show":false}')).toEqual({ t: "setShowSums", show: false });
});

test("malformed or unknown client messages are rejected", () => {
  for (const bad of [
    "not json",
    "[]",
    "null",
    '{"t":"nope"}',
    '{"t":"action","action":{"type":"swap","index":"3"}}',
    '{"t":"action","action":{"type":"swap","index":1.5}}',
    '{"t":"action","action":{"type":"nextRound"}}',
    '{"t":"addBot","level":"hard"}',
    '{"t":"setTarget","score":"100"}',
    '{"t":"takeover","seat":1}',
    '{"t":"setBotSpeed","speed":"turbo"}',
    '{"t":"setShowSums","show":"no"}',
    '{"t":"setShowSums"}',
  ]) {
    expect(parseClientMessage(bad)).toBeNull();
  }
});

test("names are trimmed, collapsed and limited to 20 characters", () => {
  expect(cleanName("  Anna   Lena ")).toBe("Anna Lena");
  expect(cleanName("")).toBeNull();
  expect(cleanName("   ")).toBeNull();
  expect(cleanName(42)).toBeNull();
  expect(cleanName("x".repeat(21))).toBeNull();
  expect(cleanName("🐙".repeat(20))).toBe("🐙".repeat(20));
});
