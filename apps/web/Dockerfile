# The web app.
#
# Build from the repository root, not from this directory - the app depends on
# three workspace packages that live outside it:
#
#   docker build -f apps/web/Dockerfile -t cv-jobs-web .
#
# `NEXT_PUBLIC_API_URL` is baked in at build time, so it is a build argument
# rather than an environment variable. The default is relative on purpose:
# in a deployment one load balancer routes /api/* to the API and everything
# else here, so the browser can ask for /api/... without knowing a host, and
# one image works in every environment. Point it at an absolute URL only if the
# two ever stop sharing an origin - which would also mean revisiting the cookie
# strategy, so it should not happen quietly.

FROM node:22-slim AS builder

WORKDIR /repo

ENV CI=true
# Next phones home during builds otherwise.
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable

ARG NEXT_PUBLIC_API_URL=/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY . .

RUN pnpm install --frozen-lockfile

RUN pnpm exec nx build @cv-jobs-compatibility/web --skip-nx-cache


FROM node:22-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# Loopback would leave the container unreachable from the load balancer.
ENV HOSTNAME=0.0.0.0

# Nothing here runs as root. The standalone server writes nothing, so it needs
# no ownership of the files it serves.
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

# Three separate copies because `output: 'standalone'` deliberately leaves two
# of them out: static assets and `public/` are served straight off disk and are
# not part of the traced module graph.
#
# Traced from the repository root, so the tree inside `standalone` mirrors the
# repo - hence the nested paths.
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
