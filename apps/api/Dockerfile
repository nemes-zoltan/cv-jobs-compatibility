# The API, the queue worker and the migration task - one image, three commands.
#
# Build from the repository root, not from this directory:
#
#   docker build -f apps/api/Dockerfile -t cv-jobs-api .
#
# Run it as:
#
#   node dist/main.js           the HTTP server
#   node dist-worker/main.js    the queue worker
#   node dist-migrate/main.js   apply migrations, then exit
#
# One image because all three are built from the same sources and share the
# config, the database client, the storage client and the schema - see
# ARCHITECTURE.md. In a deployment that is two long-running services scaling on
# different signals (request volume and queue depth) plus a one-off task run
# before a service update.

FROM node:22-slim AS builder

WORKDIR /repo

# Makes pnpm treat an unapproved install script as fatal rather than a warning,
# which is why `allowBuilds` in pnpm-workspace.yaml has to be complete.
ENV CI=true

RUN corepack enable

COPY . .

RUN pnpm install --frozen-lockfile

# All three bundles. Each webpack config cleans its own output directory, which
# is why they have three rather than sharing one.
RUN pnpm exec nx run-many -t build,build-worker,build-migrate \
      -p @cv-jobs-compatibility/api --skip-nx-cache

# Writes dist/package.json, dist/pnpm-lock.yaml and dist/workspace_modules: the
# dependency manifest for a deployed install, with workspace packages rewritten
# from `workspace:*` to a relative path. Derived from the `build` target, which
# is fine for all three - they share every external.
RUN pnpm exec nx prune @cv-jobs-compatibility/api --skip-nx-cache


FROM node:22-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

RUN corepack enable

# Dependencies before bundles, so editing application code does not invalidate
# the install layer.
COPY --from=builder /repo/apps/api/dist/package.json \
                    /repo/apps/api/dist/pnpm-lock.yaml ./
COPY --from=builder /repo/apps/api/dist/workspace_modules ./workspace_modules

# The pruned manifest is not a workspace, so it inherits none of the root's
# build approvals - and `CI=true` above makes a missing approval fatal.
#
# `argon2` is the one that must run: webpack leaves it external precisely
# because bundling breaks its native binding lookup, so an unbuilt copy means an
# API that cannot hash a password. `protobufjs` is OpenTelemetry's wire format.
# The Gemini SDK's script is declined, as it is in the root workspace - nothing
# it does is needed to make a request.
RUN printf 'autoInstallPeers: true\nallowBuilds:\n  argon2: true\n  protobufjs: true\n  "@google/genai": false\n' \
      > pnpm-workspace.yaml

RUN pnpm install --prod --frozen-lockfile

COPY --from=builder /repo/apps/api/dist ./dist
COPY --from=builder /repo/apps/api/dist-worker ./dist-worker
COPY --from=builder /repo/apps/api/dist-migrate ./dist-migrate

# Nothing here writes to disk: uploads go straight to object storage and never
# pass through this process.
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs api \
 && chown -R api:nodejs /app

USER api

EXPOSE 4000

# The HTTP server is the default; the worker and the migration task override it.
CMD ["node", "dist/main.js"]
