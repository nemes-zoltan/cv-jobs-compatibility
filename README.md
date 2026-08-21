# CV Jobs Compatibility

Nx monorepo with a NestJS API and a Next.js web app.

## Packages

| Package | Path | Stack | Local URL | Docs |
| --- | --- | --- | --- | --- |
| `@cv-jobs-compatibility/api` | `apps/api` | NestJS, Drizzle, Postgres | http://localhost:4000/api | [README](apps/api/README.md) |
| `@cv-jobs-compatibility/web` | `apps/web` | Next.js | http://localhost:3000 | [README](apps/web/README.md) |
| `@cv-jobs-compatibility/components` | `libs/ui/components` | shadcn component library | — | [README](libs/ui/components/README.md) |

Ports, environment variables, database setup and per-package commands live in those READMEs.

## Prerequisites

- Node.js 22+
- [pnpm](https://pnpm.io/installation) 9+
- Docker (for the Postgres container)

## Setup

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
pnpm --filter @cv-jobs-compatibility/api run db:up    # start Postgres
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

The API listens on port `4000` and the web app on port `3000`. The API refuses to start when Postgres is unreachable, so bring the database up first — see [Database](apps/api/README.md#database) in the API README.

| Command | Description |
| --- | --- |
| `pnpm dev` | Start API and web together |
| `pnpm dev:api` | Start the NestJS API (watch) |
| `pnpm dev:web` | Start the Next.js app (watch) |
| `pnpm start:web` | Serve the production web build |

These are the only scripts in the root `package.json`; database and migration scripts live in `apps/api`.

## Working in the workspace

### Adding a package

```bash
pnpm exec nx g @nx/js:library libs/<name>        # TypeScript package
pnpm exec nx g @nx/react:library libs/<name>     # React package
pnpm exec nx g @nx/nest:app apps/<name>          # NestJS app
```

Add the directory to `packages:` in `pnpm-workspace.yaml` if it falls outside the existing globs (`apps/*`, `libs/ui/*`), then run `pnpm install` to link it.

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
