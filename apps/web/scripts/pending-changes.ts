/**
 * Lists commits since the newest What's new entry that might need a note for players, so
 * nothing noticeable ships without one. Documentation, tests, builds, CI and refactors are
 * left out. Usage: mise run changes
 */
import { CHANGES } from "../src/lib/changes.ts";

const latest = CHANGES[0]?.date;
if (!latest) {
  console.log("No change notes yet; every commit is a candidate.");
  process.exit(0);
}

const log = Bun.spawnSync(["git", "log", `--since=${latest}T00:00:00`, "--date=short", "--format=%h%x09%ad%x09%s"], {
  stdout: "pipe",
  stderr: "pipe",
});
if (log.exitCode !== 0) {
  console.error(log.stderr.toString().trim() || "git log failed");
  process.exit(1);
}

const skipped = /^(docs|test|build|ci|chore|refactor|style)(\(.+\))?!?:/;
const commits = log.stdout
  .toString()
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((line) => {
    const [hash = "", date = "", subject = ""] = line.split("\t");
    return { hash, date, subject };
  })
  .filter((c) => !skipped.test(c.subject));

console.log(`Newest note: ${latest}, "${CHANGES[0]?.title}" (${CHANGES[0]?.notes.length} notes)`);
if (commits.length === 0) {
  console.log("No feature or fix commits since then.");
} else {
  console.log("Feature and fix commits since then. Check each has a note if players could notice it:");
  for (const c of commits) console.log(`  ${c.hash}  ${c.date}  ${c.subject}`);
}
