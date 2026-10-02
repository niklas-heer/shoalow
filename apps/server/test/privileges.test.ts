import { expect, test } from "bun:test";
import { leaveRoot, parseRunAs } from "../src/privileges.ts";

test("RUN_AS must name an unprivileged user and group", () => {
  expect(parseRunAs("65532:65532")).toEqual({ uid: 65532, gid: 65532 });
  expect(parseRunAs(" 1000:1000 ")).toEqual({ uid: 1000, gid: 1000 });
  for (const bad of ["", "0:0", "1000:0", "0:1000", "nonroot", "1000", "-1:-1", "1000:1000:1", "1e3:1e3"])
    expect(() => parseRunAs(bad)).toThrow();
});

test("the server never stays root by accident", () => {
  // Tests run as a normal user on a laptop and as root in CI containers; check whichever applies.
  if (process.getuid?.() === 0) {
    expect(() => leaveRoot({}, "/tmp/shoalow-unused")).toThrow("refusing to run as root");
    expect(leaveRoot({ ALLOW_ROOT: "1" }, "/tmp/shoalow-unused")).toContain("ALLOW_ROOT");
  } else {
    expect(leaveRoot({ RUN_AS: "65532:65532" }, "/tmp/shoalow-unused")).toBe(`running as uid ${process.getuid?.()}`);
  }
});
