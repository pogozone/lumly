# syntax=docker/dockerfile:1.7

# lumly production image
#
# Build contract:
# - pnpm workspace
# - root script: pnpm build
# - server build output: apps/server/dist/index.js
# - dashboard/tracker assets are produced by the workspace build
# - HTTP health endpoint: GET /health
#
# The application container does not contain MariaDB. The database runs
# separately (for example via docker-compose.yml or a managed MariaDB service).

FROM node:24-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /app


# ---------------------------------------------------------------------------
# Dependencies
# ---------------------------------------------------------------------------

FROM base AS dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy workspace manifests separately so dependency installation remains
# cacheable when only application source code changes.
COPY apps/server/package.json ./apps/server/package.json
COPY apps/dashboard/package.json ./apps/dashboard/package.json
COPY packages/tracker/package.json ./packages/tracker/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile


# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------

FROM dependencies AS build

COPY . .

RUN pnpm build


# ---------------------------------------------------------------------------
# Runtime
# ---------------------------------------------------------------------------

FROM node:24-alpine AS runtime

ENV NODE_ENV="production"
ENV PORT="3000"

WORKDIR /app

# tini forwards signals correctly and avoids orphaned child processes.
RUN apk add --no-cache tini

# Keep package metadata because pnpm workspace links may resolve through it.
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /app/node_modules ./node_modules

COPY --from=build /app/apps/server/package.json ./apps/server/package.json
COPY --from=build /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=build /app/apps/server/dist ./apps/server/dist

COPY --from=build /app/apps/dashboard/package.json ./apps/dashboard/package.json
COPY --from=build /app/apps/dashboard/dist ./apps/dashboard/dist

COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist

COPY --from=build /app/packages/tracker/package.json ./packages/tracker/package.json
COPY --from=build /app/packages/tracker/dist ./packages/tracker/dist

# If migrations are executed by the application/entrypoint, they must be
# available in the runtime image.
COPY --from=build /app/migrations ./migrations

# The official Node image provides an unprivileged "node" user.
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || '3000') + '/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/server/dist/index.js"]
