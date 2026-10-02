+++
schema_version = 1
id = "01M3Y5K0XMTG0V58Z4JCWCGY9D"
title = "Run the server as an unprivileged user in a distroless image"
date = "2026-10-02"
status = "accepted"
tags = ["security", "deployment"]
supersedes = []
superseded_by = []
depends_on = []
related_to = ["01M3Y3MEAZJ5RSN68TDB4XZ4TW"]
+++
## Decision

The production image is `oven/bun` distroless: Bun, the bundled server and the built client, with
no shell, package manager, coreutils or setuid programs. The container still starts as root,
because Fly mounts the volume owned by root and only root can hand it over. Before anything else
runs, `apps/server/src/privileges.ts` does three things:

1. It gives `/data` and the files directly inside it to `nonroot` (65532:65532), using `lchown`
   so symbolic links are never followed.
2. It clears supplementary groups and switches group and user for good.
3. It checks that the switch happened and that root cannot be regained. If either check fails,
   it exits.

The server refuses to start as root unless `RUN_AS=uid:gid` names the user to become, or
`ALLOW_ROOT=1` is set on purpose. Application code and static files stay owned by root and are
read-only to the server.

## Context

On 2026-10-02 Niklas asked whether the container could stop running as root, to reduce what an
attack could reach. The earlier hardening record noted root as a remaining gap.

Alternatives considered:

- An image `USER` alone: the server could not write to the root-owned Fly volume.
- A one-off manual `chown` over `fly ssh`: new volumes would silently break.
- An entrypoint shell script with `setpriv`: it needs a shell and util-linux in the image.

Bun implements `setgroups`, `setgid` and `setuid`, so the drop needs nothing beyond Bun.

## Consequences

Verified on 2026-10-02 against the built image with a root-owned volume that held a database
written by the old root image:

- The server runs as 65532 with empty permitted and effective capabilities.
- `setuid(0)` fails.
- The old database was handed over and opened.
- A planted link to `/etc/passwd` left that file owned by root.
- The image holds no setuid or setgid files and no `/bin/sh`.

`dagger call smoke`, part of `mise run ci`, starts the image on an empty root-owned volume and
checks from outside that it serves pages with its security headers and saves a table. Because the
server refuses to run as root, a healthy answer also shows the switch worked.

Without a shell, `fly ssh console` can only run commands that exist in the image, which is just
Bun. Root inside the Firecracker VM was never root on the host. This change limits what a
compromised server process can do inside the VM.
