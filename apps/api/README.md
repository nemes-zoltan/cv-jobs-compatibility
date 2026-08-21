# API

NestJS backend for CV Jobs Compatibility.

- **Package:** `@cv-jobs-compatibility/api`
- **Default URL:** http://localhost:4000/api

## Prerequisites

- Node.js 22+, pnpm 9+, Docker
- Workspace dependencies installed from the repository root: `pnpm install`

## Setup

Run from `apps/api`:

```bash
cp .env.example .env
pnpm db:up        # start Postgres, wait for the healthcheck
pnpm db:migrate   # apply pending migrations
```

The API checks the database connection while booting and exits if it fails, so Postgres has to be up before `pnpm dev:api`.

### Environment

The app reads `process.env` and never opens a `.env` file. Nx loads `apps/api/.env` into the environment for local tasks; a deployed container gets the same variables from its task definition.

| Variable | Default | Description |
| --- | --- | --- |
| `NODE_ENV` | `development` | `production` switches to the production config |
| `PORT` | `4000` | Port the server listens on |
| `WEB_ORIGIN` | `http://localhost:3000` | Origin allowed by CORS |
| `DATABASE_URL` | assembled | Full connection string; wins when set |
| `POSTGRES_HOST` / `POSTGRES_PORT` / `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | — | Used to assemble the connection string when `DATABASE_URL` is absent |
| `DATABASE_POOL_MAX` | `5` dev / `20` production | Max pooled connections per instance |
| `DATABASE_CA_CERT` | — | PEM bundle for verifying the server certificate (production only) |
| `JWT_SECRET` | **required** | Signs access and refresh tokens |
| `ACCESS_TOKEN_TTL` | **required** | Access token lifetime in seconds (`.env.example` ships `60`) |
| `REFRESH_TOKEN_TTL` | **required** | Refresh token lifetime in seconds (`.env.example` ships `604800`, 7 days) |

The three required variables have no fallback in code — the API refuses to start without them, and a lifetime that is not a positive integer is rejected the same way.

Any of them can be set for a single run:

```bash
PORT=4100 pnpm dev:api
```

## Commands

### Develop

```bash
pnpm dev:api                                    # from the repository root
pnpm exec nx serve @cv-jobs-compatibility/api   # same thing
```

Rebuilds and restarts the Node process on change.

### Database

| From `apps/api` | From the repository root | Description |
| --- | --- | --- |
| `pnpm db:up` | `pnpm --filter @cv-jobs-compatibility/api run db:up` | Start Postgres and wait until healthy |
| `pnpm db:down` | `pnpm --filter @cv-jobs-compatibility/api run db:down` | Stop the container (keeps the data volume) |
| `pnpm db:reset` | `pnpm --filter @cv-jobs-compatibility/api run db:reset` | Destroy the volume and start a fresh database |
| `pnpm db:logs` | `pnpm --filter @cv-jobs-compatibility/api run db:logs` | Follow Postgres logs |
| `pnpm db:psql` | `pnpm psql` | Open a `psql` shell in the container |
| `pnpm db:generate` | `pnpm --filter @cv-jobs-compatibility/api run db:generate` | Generate a migration from the Drizzle schema |
| `pnpm db:migrate` | `pnpm --filter @cv-jobs-compatibility/api run db:migrate` | Apply pending migrations |
| `pnpm db:studio` | `pnpm --filter @cv-jobs-compatibility/api run db:studio` | Browse the data in Drizzle Studio |

`pnpm psql` is a root shortcut that calls `db:psql` here; the `--filter` form works for it too. They are all Nx targets as well, so `pnpm exec nx run @cv-jobs-compatibility/api:db:migrate` works from anywhere.

### Build, test, lint

```bash
pnpm exec nx build @cv-jobs-compatibility/api   # → apps/api/dist
pnpm exec nx test @cv-jobs-compatibility/api
pnpm exec nx lint @cv-jobs-compatibility/api
```

### Production build

```bash
pnpm exec nx build @cv-jobs-compatibility/api
pnpm exec nx prune @cv-jobs-compatibility/api   # optional: slimmer deployable dist
node apps/api/dist/main.js
```

Running the bundle outside Nx needs the variables exported first:

```bash
set -a && . ./.env && set +a
node dist/main.js
```

## Debug

Use the VS Code launch config **Debug @cv-jobs-compatibility/api with Nx** (`.vscode/launch.json`). It runs `nx serve` with `--inspect=9229`.
