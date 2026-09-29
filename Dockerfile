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

FROM oven/bun:1.3.14-slim@sha256:d56a2534ffd262e92c12fd3249d3924d296d97086da773f821d7d0477435ea04
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    DATA_DIR=/data \
    STATIC_DIR=/app/public
COPY --from=build /app/out/server.js /app/server.js
COPY --from=build /app/apps/web/dist /app/public
EXPOSE 8080
CMD ["bun", "/app/server.js"]
