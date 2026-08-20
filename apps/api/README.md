# API

NestJS backend for CV Jobs Compatibility.

- **Package:** `@cv-jobs-compatibility/api`
- **Default URL:** http://localhost:4000/api

## Prerequisites

Install workspace dependencies from the repository root:

```bash
pnpm install
```

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

### Port

The server reads `PORT` from `apps/api/.env` (copy `.env.example` to `.env` on a fresh clone) and defaults to `4000`. Routes are mounted under the `/api` prefix.

```bash
PORT=4100 pnpm dev:api
```

Health-style check after start:

```bash
curl http://localhost:4000/api
```

Expected response:

```json
{ "message": "Hello API" }
```

## Commands

Run these from the repository root.

| Command | Description |
| --- | --- |
| `pnpm dev:api` | Serve in development (watch) |
| `pnpm build:api` | Production webpack build → `apps/api/dist` |
| `pnpm test:api` | Jest unit tests |
| `pnpm lint:api` | ESLint |

Nx equivalents:

```bash
pnpm exec nx serve @cv-jobs-compatibility/api
pnpm exec nx serve @cv-jobs-compatibility/api --configuration=production
pnpm exec nx build @cv-jobs-compatibility/api
pnpm exec nx test @cv-jobs-compatibility/api
pnpm exec nx lint @cv-jobs-compatibility/api
```

### Production build

```bash
pnpm build:api
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
│   └── app/
├── webpack.config.js
└── package.json
```
