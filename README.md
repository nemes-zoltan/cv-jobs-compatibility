# CV Jobs Compatibility

Nx monorepo with a NestJS API and a Next.js web app.

## Packages

| Package | Path | Stack | Local URL | Docs |
| --- | --- | --- | --- | --- |
| `@cv-jobs-compatibility/api` | `apps/api` | NestJS, Drizzle, Postgres | http://localhost:4000/api | [README](apps/api/README.md) |
| `@cv-jobs-compatibility/web` | `apps/web` | Next.js | http://localhost:3000 | [README](apps/web/README.md) |
| `@cv-jobs-compatibility/components` | `libs/ui/components` | shadcn component library | — | [README](libs/ui/components/README.md) |
| `@cv-jobs-compatibility/types` | `domains/shared/types` | Shared API and domain types | — | [README](domains/shared/types/README.md) |
| `@cv-jobs-compatibility/constants` | `domains/shared/constants` | Shared domain constants | — | [README](domains/shared/constants/README.md) |
| `@cv-jobs-compatibility/prompt-schemas` | `domains/node/prompt-schemas` | Versioned LLM prompts and response schemas | — | [README](domains/node/prompt-schemas/README.md) |

Ports, environment variables, database setup and per-package commands live in those READMEs. Architecture, trade-offs and product decisions live in [DECISIONS.md](DECISIONS.md); the plan for running this on AWS is in [DEPLOYMENT.md](DEPLOYMENT.md).

## Prerequisites

- Node.js 22+
- [pnpm](https://pnpm.io/installation) 9+
- Docker (for the Postgres and MinIO containers)

## Setup

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
docker compose up -d                                  # Postgres and MinIO
pnpm --filter @cv-jobs-compatibility/api run db:migrate
```

## Quick start

Run both apps in parallel:

```bash
pnpm dev
```

Or start them separately:

```bash
pnpm dev:api
pnpm dev:web
```

The API listens on port `4000` and the web app on port `3000`. The API refuses to start when Postgres is unreachable, so run `docker compose up -d` first — see [Containers](apps/api/README.md#containers) in the API README.

| Command | Description |
| --- | --- |
| `pnpm dev` | Start API and web together |
| `pnpm dev:api` | Start the NestJS API (watch) |
| `pnpm dev:worker` | Start the queue worker (watch) |
| `pnpm dev:web` | Start the Next.js app (watch) |
| `pnpm start:web` | Serve the production web build |
| `pnpm psql` | Open a `psql` shell in the Postgres container |

Containers are started with `docker compose` directly. Migration scripts live in `apps/api` — see its [README](apps/api/README.md#migrations).

## Docker images

Two images. Both build from the repository root, because each app depends on workspace packages outside its own directory:

```bash
docker build -f apps/api/Dockerfile -t cv-jobs-api .
docker build -f apps/web/Dockerfile -t cv-jobs-web .
```

The API image runs three ways — HTTP server, queue worker, and a one-off migration task — from the same bundle:

| Command | Runs |
| --- | --- |
| `node dist/main.js` | HTTP server (the image's default) |
| `node dist-worker/main.js` | Queue worker |
| `node dist-migrate/main.js` | Applies migrations, then exits |

Full run commands, the variables each needs, and how to build from inside a package directory are in the [API README](apps/api/README.md#docker-image) and the [web README](apps/web/README.md#docker-image). The AWS shape these images are built for is in [DEPLOYMENT.md](DEPLOYMENT.md).

## Working in the workspace

### Adding a package

```bash
pnpm exec nx g @nx/js:library libs/<name>        # TypeScript package
pnpm exec nx g @nx/react:library libs/<name>     # React package
pnpm exec nx g @nx/nest:app apps/<name>          # NestJS app
```

Add the directory to `packages:` in `pnpm-workspace.yaml` if it falls outside the existing globs (`apps/*`, `libs/ui/*`, `domains/node/*`, `domains/shared/*`), then run `pnpm install` to link it.

`libs/` is for generic building blocks; `domains/` is for packages that only make sense to this product. Under `domains/`, `shared/` runs anywhere and `node/` is server-only.

### Adding a dependency

Install into the package that imports it, never into the root:

```bash
pnpm --filter @cv-jobs-compatibility/api add drizzle-orm
pnpm --filter @cv-jobs-compatibility/web add -D some-dev-tool
```

The root manifest carries only workspace-wide tooling (Nx, ESLint, TypeScript, Jest).

### Build, test, lint

Every project exposes the same Nx targets:

```bash
pnpm exec nx run-many -t build          # every project
pnpm exec nx run-many -t test
pnpm exec nx run-many -t lint

pnpm exec nx build @cv-jobs-compatibility/api    # a single project
pnpm exec nx test @cv-jobs-compatibility/web
```

| Command | Description |
| --- | --- |
| `pnpm exec nx graph` | Open the interactive project graph |
| `pnpm exec nx show project <name>` | List a project's targets |
| `pnpm exec nx affected -t test` | Run a target only for projects touched since `main` |
