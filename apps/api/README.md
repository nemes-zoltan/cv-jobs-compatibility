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

This app has three entrypoints built from the same sources — `src/main.ts` (HTTP), `src/worker.ts` (queue) and `src/migrate.ts` (migrations, for containers only). `pnpm dev` starts the first two; run the worker alone with `pnpm dev:worker`. They build to `dist/`, `dist-worker/` and `dist-migrate/` respectively.

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
pnpm exec nx build @cv-jobs-compatibility/api           # → apps/api/dist
pnpm exec nx build-worker @cv-jobs-compatibility/api    # → apps/api/dist-worker
pnpm exec nx build-migrate @cv-jobs-compatibility/api   # → apps/api/dist-migrate
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

### Docker image

One image, three commands. The build context must be the repository root — this app depends on workspace packages that live outside `apps/api`.

```bash
# from the repository root
docker build -f apps/api/Dockerfile -t cv-jobs-api .

# from apps/api
docker build -f Dockerfile -t cv-jobs-api ../..
```

| Command | Runs |
| --- | --- |
| `node dist/main.js` | HTTP server (the image's default) |
| `node dist-worker/main.js` | Queue worker |
| `node dist-migrate/main.js` | Applies migrations, then exits |

Migrations in a container use `dist-migrate`, not `pnpm db:migrate` — drizzle-kit is a devDependency and is not in the image. `pnpm db:generate` is unchanged and stays a local tool.

#### Running it locally

Start the backing services first — `docker compose up -d` from the repository root.

Join the container to the compose network so it can reach Postgres and MinIO by service name. `localhost` inside a container is the container itself, which is why a connection string pointing there fails with `ECONNREFUSED 127.0.0.1:5432`.

Copy-paste as-is; nothing here needs replacing.

```bash
docker run --name cv-jobs-api \
  --network cv-jobs-compatibility_default \
  -p 4000:4000 \
  -e NODE_ENV=development \
  -e PORT=4000 \
  -e WEB_ORIGIN=http://localhost:3000 \
  -e DATABASE_URL=postgresql://cvjobs:cvjobs_dev_password@postgres:5432/cvjobs \
  -e JWT_SECRET=local-development-secret-change-me \
  -e ACCESS_TOKEN_TTL=60 \
  -e REFRESH_TOKEN_TTL=604800 \
  -e S3_BUCKET=cvjobs-resumes \
  -e S3_REGION=us-east-1 \
  -e S3_ENDPOINT=http://minio:9000 \
  -e S3_ACCESS_KEY_ID=cvjobs \
  -e S3_SECRET_ACCESS_KEY=cvjobs_dev_password \
  -e UPLOAD_URL_TTL=300 \
  cv-jobs-api
```

```bash
curl http://localhost:4000/api/health
# {"status":"ok","services":{"database":"up"}}
```

`NODE_ENV=development` is not optional here: `production` connects to Postgres with TLS, which the local container does not offer.

The worker takes the same variables plus a Gemini key — the only value you have to supply:

```bash
docker run --name cv-jobs-worker \
  --network cv-jobs-compatibility_default \
  -e NODE_ENV=development \
  -e DATABASE_URL=postgresql://cvjobs:cvjobs_dev_password@postgres:5432/cvjobs \
  -e JWT_SECRET=local-development-secret-change-me \
  -e ACCESS_TOKEN_TTL=60 \
  -e REFRESH_TOKEN_TTL=604800 \
  -e S3_BUCKET=cvjobs-resumes \
  -e S3_REGION=us-east-1 \
  -e S3_ENDPOINT=http://minio:9000 \
  -e S3_ACCESS_KEY_ID=cvjobs \
  -e S3_SECRET_ACCESS_KEY=cvjobs_dev_password \
  -e UPLOAD_URL_TTL=300 \
  -e GOOGLE_GEMINI_API_KEY=your-key-here \
  cv-jobs-api node dist-worker/main.js
```

Migrations, on the same network:

```bash
docker run --rm --network cv-jobs-compatibility_default \
  -e NODE_ENV=development \
  -e DATABASE_URL=postgresql://cvjobs:cvjobs_dev_password@postgres:5432/cvjobs \
  cv-jobs-api node dist-migrate/main.js
```

Add tracing to any of them with `-e OTEL_EXPORTER_OTLP_ENDPOINT=http://otel:4318` and `-e OTEL_SERVICE_NAME=cv-jobs-api` (or `cv-jobs-worker`).

Stop them with `docker rm -f cv-jobs-api cv-jobs-worker`.

##### One caveat: uploading a CV from the browser

Presigned upload URLs are signed against `S3_ENDPOINT`, and the browser is handed the result — so it gets `http://minio:9000/...`, which only resolves inside the compose network. Everything else works; picking a CV fails.

To fix it, make that hostname mean the same thing on both sides by adding one line to your hosts file:

```
127.0.0.1 minio
```

`/etc/hosts` on Linux and macOS, `C:\Windows\System32\drivers\etc\hosts` if the browser is on Windows. The container keeps resolving `minio` through Docker's DNS; the browser now resolves it to the published port.

This does not arise in normal development, where the API runs on the host with `pnpm dev:api` and `S3_ENDPOINT` is `http://localhost:9000` for everyone.

#### Deployed

The same image and the same three commands. What changes is the environment:

| Variable | Local | Deployed |
| --- | --- | --- |
| `NODE_ENV` | `development` | `production` — turns on TLS to Postgres and the production config |
| `DATABASE_URL` | `…@postgres:5432/cvjobs` | the managed instance, or the discrete `POSTGRES_*` variables an RDS secret exposes |
| `WEB_ORIGIN` | `http://localhost:3000` | the domain the browser loads the app from |
| `JWT_SECRET` | anything | a long random string, from a secret store |
| `S3_ENDPOINT` | `http://minio:9000` | **unset** — absent means AWS's own endpoint |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | MinIO's | **unset** — the task role provides credentials |
| `S3_REGION` | `us-east-1` | the bucket's region |
| `GOOGLE_GEMINI_API_KEY` | worker only | worker only; the HTTP task never gets it |

Networking is a deployment concern rather than a flag: one load balancer routes `/api/*` to the API service and everything else to the web service, which is what lets them share an origin. The migration task runs once before a service update — nothing migrates on boot.

## Debug

Use the VS Code launch config **Debug @cv-jobs-compatibility/api with Nx** (`.vscode/launch.json`). It runs `nx serve` with `--inspect=9229`.
