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
docker compose up -d    # from the repository root: Postgres and MinIO
pnpm db:migrate         # apply pending migrations
```

The API checks the database connection while booting and exits if it fails, so Postgres has to be up before `pnpm dev:api`. MinIO is not checked at boot — only the upload endpoints need it.

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
| `QUEUE_POOL_MAX` | `4` | Connections pg-boss keeps, separate from the pool above |
| `DATABASE_CA_CERT` | — | PEM bundle for verifying the server certificate (production only) |
| `JWT_SECRET` | **required** | Signs access and refresh tokens |
| `ACCESS_TOKEN_TTL` | **required** | Access token lifetime in seconds (`.env.example` ships `60`) |
| `REFRESH_TOKEN_TTL` | **required** | Refresh token lifetime in seconds (`.env.example` ships `604800`, 7 days) |
| `S3_BUCKET` | **required** | Bucket resumes are written to |
| `UPLOAD_URL_TTL` | **required** | Presigned upload URL lifetime in seconds (`.env.example` ships `300`) |
| `S3_REGION` | `us-east-1` | Signed into every presigned URL |
| `S3_ENDPOINT` | `http://localhost:9000` dev / unset production | S3 API address; unset means AWS's own |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | **required in development** | MinIO credentials. Production ignores them and uses the task role |
| `GOOGLE_GEMINI_API_KEY` | **required by the worker** | Resume extraction. From [AI Studio](https://aistudio.google.com/apikey); not read by the HTTP process |

The required variables have no fallback in code — the API refuses to start without them, and a lifetime that is not a positive integer is rejected the same way.

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

This app has two entrypoints built from the same sources — `src/main.ts` (HTTP) and `src/worker.ts` (queue). `pnpm dev` starts both; run the worker alone with `pnpm dev:worker`. They build to `dist/` and `dist-worker/` respectively.

`dist-worker/` is not a single file: unpdf loads PDF.js through a dynamic import, so webpack emits it as a lazy chunk (~1.7 MB) beside `main.js`. Deploying `main.js` alone fails on the first PDF upload and nowhere else.

### Containers

Postgres and MinIO come from `docker-compose.yml` at the repository root:

```bash
docker compose up -d      # both, plus the one-shot bucket creation
docker compose down       # stop
docker compose down -v    # stop and drop the Postgres volume
```

Postgres is on `localhost:5432`. MinIO's S3 API is on `localhost:9000` and its console on http://localhost:9001 (`cvjobs` / `cvjobs_dev_password`).

MinIO's data is bind-mounted to `tmp/minio/`, so the bucket is visible in the tree — but it holds MinIO's own format (one directory per object containing `xl.meta`), not readable files. Use the console to download. `docker compose down -v` does not clear it; the container writes as root, so removing it needs `sudo rm -rf tmp/minio`.

### Migrations

| From `apps/api` | Description |
| --- | --- |
| `pnpm db:generate` | Generate a migration from the Drizzle schema |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:studio` | Browse the data in Drizzle Studio |
| `pnpm db:psql` | Open a `psql` shell in the Postgres container |
| `pnpm db:wipe` | Delete every upload — ingestion rows, queued jobs and the stored files. Accounts survive; refuses to run with `NODE_ENV=production` |

These are Nx targets too, so `pnpm exec nx run @cv-jobs-compatibility/api:db:migrate` works from anywhere. `pnpm psql` at the repository root is a shortcut for `db:psql`.

pg-boss lives in its own `pgboss` schema, so `\dt` will not show it — use `\dt pgboss.*`.

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
