# CV Jobs Compatibility

Nx monorepo with a NestJS API and a Next.js web app.

## Apps

| App | Package | Stack | Local URL |
| --- | --- | --- | --- |
| [API](apps/api/README.md) | `@cv-jobs-compatibility/api` | NestJS | http://localhost:4000/api |
| [Web](apps/web/README.md) | `@cv-jobs-compatibility/web` | Next.js | http://localhost:3000 |

## Prerequisites

- Node.js 22+
- [pnpm](https://pnpm.io/installation) 9+

## Setup

```bash
pnpm install
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

The API listens on port `4000` and the web app on port `3000`. Both are set in each app's `.env` (copy `.env.example` to `.env` on a fresh clone).

## Commands

All scripts run from the repository root.

### Develop

| Command | Description |
| --- | --- |
| `pnpm dev` | Start API and web together |
| `pnpm dev:api` | Start the NestJS API (watch) |
| `pnpm dev:web` | Start the Next.js app (watch) |

### Build & production

| Command | Description |
| --- | --- |
| `pnpm build` | Build all apps |
| `pnpm build:api` | Build the API |
| `pnpm build:web` | Build the web app |
| `pnpm start:web` | Serve the production web build |

The API has no separate start script: after `pnpm build:api`, run the compiled output with `node apps/api/dist/main.js`.

### Test & lint

| Command | Description |
| --- | --- |
| `pnpm test` | Run unit tests for all apps |
| `pnpm test:api` | Run API unit tests |
| `pnpm test:web` | Run web unit tests |
| `pnpm lint` | Lint all apps |
| `pnpm lint:api` | Lint the API |
| `pnpm lint:web` | Lint the web app |

### Nx

| Command | Description |
| --- | --- |
| `pnpm graph` | Open the interactive project graph |
| `pnpm exec nx show project @cv-jobs-compatibility/api` | Inspect API targets |
| `pnpm exec nx show project @cv-jobs-compatibility/web` | Inspect web targets |

Equivalent Nx commands work the same way, for example:

```bash
pnpm exec nx serve @cv-jobs-compatibility/api
pnpm exec nx dev @cv-jobs-compatibility/web
```

## Workspace

- TypeScript package: `pnpm exec nx g @nx/js:library libs/<name>`
- React lib package: `pnpm exec nx g @nx/react:library libs/<name>`

## Project layout

```text
.
├── apps/
│   ├── api/          # NestJS backend
│   └── web/          # Next.js frontend
├── libs/
│   └── ui/
│       └── components/   # shadcn component library
├── nx.json
├── package.json
└── pnpm-workspace.yaml
```

Per-app details (ports, env vars, extra targets) live in:

- [apps/api/README.md](apps/api/README.md)
- [apps/web/README.md](apps/web/README.md)
- [libs/ui/components/README.md](libs/ui/components/README.md) — adding shadcn components
