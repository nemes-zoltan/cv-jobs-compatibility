# API

NestJS backend for CV Jobs Compatibility.

- **Package:** `@cv-jobs-compatibility/api`
- **Default URL:** http://localhost:4000/api

## Prerequisites

Install workspace dependencies from the repository root, then start Postgres from this package:

```bash
pnpm install     # repository root
pnpm db:up       # apps/api
```

The API verifies the database connection during bootstrap and exits if it fails, so the container has to be up before `pnpm dev:api`.

## Develop

Start the API with file watching:

```bash
# from repo root
pnpm dev:api
```

Same command via Nx:

```bash
pnpm exec nx serve @cv-jobs-compatibility/api
```

The process rebuilds on change and restarts the Node process.

### Configuration

The app reads `process.env` and nothing else — it never opens a `.env` file. Nx loads `apps/api/.env` into the environment for `nx serve`, and a deployed container receives the same variables from its ECS task definition.

`ConfigModule` provides a single instance under the `BaseConfigService` token, chosen at startup by `NODE_ENV`:

```text
BaseConfigService (abstract)   reads process.env, holds what is the same everywhere
├── DevelopmentConfigService   no TLS, small pool, SQL logging on
└── ProductionConfigService    TLS on, larger pool, SQL logging off
```

Injecting the base class means callers never branch on the environment themselves:

```ts
constructor(private readonly config: BaseConfigService) {}
```

Adding a setting means adding a `readonly` field to `BaseConfigService`; adding one that *differs* per environment means declaring it `abstract` there and implementing it in both subclasses, so a new environment cannot silently miss it. Everything is read from the environment once, when the instance is constructed at startup.

| Variable | Default | Description |
| --- | --- | --- |
| `NODE_ENV` | `development` | `production` selects `ProductionConfigService` |
| `PORT` | `4000` | Port the server listens on |
| `WEB_ORIGIN` | `http://localhost:3000` | Origin allowed by CORS |
| `DATABASE_URL` | assembled | Full connection string; wins when set |
| `POSTGRES_HOST` / `POSTGRES_PORT` / `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | — | Used to assemble the connection string when `DATABASE_URL` is absent |
| `DATABASE_POOL_MAX` | `5` dev / `20` production | Max pooled connections per instance |
| `DATABASE_CA_CERT` | — | PEM bundle for verifying the server certificate (production only) |

Both connection styles are supported because deployments differ: `DATABASE_URL` is convenient locally, while an RDS-managed secret exposes host, port, username, password and dbname as separate keys that ECS injects individually. Credentials are URL-encoded during assembly, so generated passwords with `@` or `/` in them work.

In production TLS is always on. Without `DATABASE_CA_CERT` the connection is encrypted but the server certificate is not verified, because Node does not trust Amazon's RDS CA by default — supply the RDS CA bundle to get full verification.

```bash
PORT=4100 pnpm dev:api
```

The compiled bundle takes its configuration from the environment too, so running it outside Nx needs the variables exported:

```bash
set -a && . ./.env && set +a
node dist/main.js
```

Routes are mounted under the `/api` prefix.

```bash
curl http://localhost:4000/api
```

```json
{ "message": "Hello API" }
```

### Health check

```bash
curl http://localhost:4000/api/health
```

```json
{ "status": "ok", "services": { "database": "up" } }
```

Returns `503` with `"status": "degraded"` when the database round trip fails.

## Database

Postgres access goes through [Drizzle ORM](https://orm.drizzle.team). `DatabaseModule` is global, so any provider can inject the client:

```ts
import { Inject } from '@nestjs/common'
import { DRIZZLE } from '../database/database.constants'
import { Database } from '../database/database.module'

constructor(@Inject(DRIZZLE) private readonly db: Database) {}
```

The module owns a single `pg` connection pool, verifies it on `onModuleInit`, and closes it on application shutdown.

| Path | Purpose |
| --- | --- |
| `src/database/schema/` | Table definitions, re-exported from `index.ts` |
| `src/database/migrations/` | Generated SQL migrations (committed) |
| `drizzle.config.ts` | drizzle-kit config; loads this package's `.env` the way Nx does |

### Container

Postgres 17 runs from `docker-compose.yml` at the repository root. Being a throwaway local database, its credentials are written straight into that file; keep `DATABASE_URL` in `.env` pointing at them:

```bash
pnpm db:up      # start it and wait for the healthcheck
pnpm db:logs    # follow the logs
pnpm db:psql    # psql shell inside the container
pnpm db:reset   # destroy the volume and start clean
```

The port is published on `127.0.0.1` only, so the development database is not reachable from the network.

### Schema and migrations

- Schema lives in `src/database/schema/` behind the `index.ts` barrel — empty until the first table is modelled.
- Migrations are generated into `src/database/migrations/` and committed.

```bash
pnpm db:generate   # diff the schema and write a new SQL migration
pnpm db:migrate    # apply pending migrations
pnpm db:studio     # browse the data
```

Migrations are never applied automatically at startup; running them is an explicit step.

### Adding pgvector later

The container already uses the `pgvector/pgvector:pg17` image, so the extension binaries are present but not enabled. To switch it on, add a migration containing `CREATE EXTENSION IF NOT EXISTS vector;` and start using Drizzle's `vector()` column type — no compose or volume changes needed.

## Commands

Database scripts live in this package's `package.json`. Run them from `apps/api`:

| Script | Description |
| --- | --- |
| `pnpm db:up` | Start Postgres and wait until healthy |
| `pnpm db:down` | Stop the container (keeps the data volume) |
| `pnpm db:reset` | Destroy the volume and start a fresh database |
| `pnpm db:logs` | Follow Postgres logs |
| `pnpm db:psql` | Open a `psql` shell in the container |
| `pnpm db:generate` | Generate migrations from the Drizzle schema |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:studio` | Open Drizzle Studio |

From the repository root, prefix them with `pnpm --filter @cv-jobs-compatibility/api run`. They are Nx targets too, so `pnpm exec nx run @cv-jobs-compatibility/api:db:migrate` works as well.

Build, test and lint run through Nx from the repository root:

```bash
pnpm exec nx serve @cv-jobs-compatibility/api          # or `pnpm dev:api`
pnpm exec nx serve @cv-jobs-compatibility/api --configuration=production
pnpm exec nx build @cv-jobs-compatibility/api          # → apps/api/dist
pnpm exec nx test @cv-jobs-compatibility/api
pnpm exec nx lint @cv-jobs-compatibility/api
```

### Production build

```bash
pnpm exec nx build @cv-jobs-compatibility/api
node apps/api/dist/main.js
```

Optional prune targets (for a slimmer deployable `dist`):

```bash
pnpm exec nx prune @cv-jobs-compatibility/api
```

## Debug

Use the VS Code launch config **Debug @cv-jobs-compatibility/api with Nx** (`.vscode/launch.json`). It runs `nx serve` with `--inspect=9229`.

## Layout

```text
apps/api/
├── src/
│   ├── main.ts
│   ├── app/          # root module
│   ├── config/       # BaseConfigService + per-environment subclasses
│   ├── database/     # Drizzle client, schema, migrations
│   └── health/       # /api/health
├── drizzle.config.ts
├── webpack.config.js
└── package.json
```
