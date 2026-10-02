# Build the web client and bundle the server (with the game package) into one file.
FROM oven/bun:1.3.14@sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4 AS build
WORKDIR /app
COPY package.json bun.lock tsconfig.base.json ./
COPY packages/game/package.json packages/game/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN bun install --frozen-lockfile --ignore-scripts
COPY packages packages
COPY apps apps
RUN bun run --cwd apps/web build \
 && bun build apps/server/src/main.ts --target=bun --minify --outfile=/app/out/server.js

# Distroless: Bun and nothing else, so no shell, package manager or other tools to misuse.
# The server starts as root only to hand the root-owned Fly volume to `nonroot` (RUN_AS),
# then drops to that user for good and refuses to run as root otherwise. Code and assets
# stay owned by root and read-only to the server.
FROM oven/bun:1.3.14-distroless@sha256:c28c51287af70bab8e0b66fc4b6a30cfb92a727ebc88045223adc9f4c9d09307
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    DATA_DIR=/data \
    STATIC_DIR=/app/public \
    RUN_AS=65532:65532
COPY --from=build /app/out/server.js /app/server.js
COPY --from=build /app/apps/web/dist /app/public
EXPOSE 8080
CMD ["/app/server.js"]
