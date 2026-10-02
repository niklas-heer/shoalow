import { lchownSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

export interface RunAs {
  uid: number;
  gid: number;
}

/** Reads `uid:gid`, as in `RUN_AS=65532:65532`. Anything else is a configuration error. */
export function parseRunAs(raw: string): RunAs {
  const match = raw.trim().match(/^(\d+):(\d+)$/);
  const uid = Number(match?.[1]);
  const gid = Number(match?.[2]);
  if (!match || uid === 0 || gid === 0 || uid > 2 ** 31 || gid > 2 ** 31)
    throw new Error(`RUN_AS must be "uid:gid" of an unprivileged user, got "${raw}"`);
  return { uid, gid };
}

/**
 * Gives the data directory to `target` and then becomes that user for good. Fly mounts the
 * volume owned by root, so the container starts as root only for this; nothing else runs
 * first. Symbolic links are never followed, so a link planted in the data directory cannot
 * make root hand over a file elsewhere. Throws rather than carrying on as root.
 */
export function dropPrivileges(target: RunAs, dataDir: string): void {
  mkdirSync(dataDir, { recursive: true });
  lchownSync(dataDir, target.uid, target.gid);
  for (const entry of readdirSync(dataDir)) lchownSync(join(dataDir, entry), target.uid, target.gid);

  const p = process;
  if (!p.setgroups || !p.setgid || !p.setuid || !p.getgroups || !p.getuid || !p.geteuid || !p.getgid)
    throw new Error("this platform cannot switch users");
  p.setgroups([]);
  p.setgid(target.gid);
  p.setuid(target.uid);

  if (p.getuid() !== target.uid || p.geteuid() !== target.uid || p.getgid() !== target.gid || p.getgroups().length > 0)
    throw new Error("could not switch to the unprivileged user");
  let regained = false;
  try {
    p.setuid(0);
    regained = true;
  } catch {
    // Expected: an unprivileged user cannot become root again.
  }
  if (regained) throw new Error("the process could become root again after dropping privileges");
}

/**
 * Called first thing at startup. As root, the server only runs after switching to `RUN_AS`;
 * set `ALLOW_ROOT=1` to run as root on purpose. Returns a line for the log.
 */
export function leaveRoot(env: Record<string, string | undefined>, dataDir: string): string {
  const uid = process.getuid?.();
  if (uid !== 0) return `running as uid ${uid ?? "unknown"}`;
  if (env.RUN_AS) {
    const target = parseRunAs(env.RUN_AS);
    dropPrivileges(target, dataDir);
    return `dropped root, running as ${target.uid}:${target.gid}`;
  }
  if (env.ALLOW_ROOT === "1") return "running as root because ALLOW_ROOT=1";
  throw new Error("refusing to run as root: set RUN_AS=uid:gid (or ALLOW_ROOT=1)");
}
