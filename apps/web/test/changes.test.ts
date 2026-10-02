import { expect, test } from "bun:test";
import { CHANGES } from "../src/lib/changes.ts";

test("change notes are dated, newest first, one entry per day", () => {
  expect(CHANGES.length).toBeGreaterThan(0);
  const dates = CHANGES.map((r) => r.date);
  for (const date of dates) {
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10)).toBe(date);
  }
  expect([...dates].sort().reverse()).toEqual(dates);
  expect(new Set(dates).size).toBe(dates.length);
  for (const release of CHANGES) {
    expect(release.title.trim().length).toBeGreaterThan(0);
    expect(release.notes.length).toBeGreaterThan(0);
    for (const note of release.notes) expect(note.trim()).toMatch(/[.!?]$/);
  }
});
