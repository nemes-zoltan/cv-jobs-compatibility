# Web

Next.js frontend for CV Jobs Compatibility.

- **Package:** `@cv-jobs-compatibility/web`
- **Default URL:** http://localhost:3000

## Prerequisites

Install workspace dependencies from the repository root:

```bash
pnpm install
```

## Develop

Start the Next.js dev server:

```bash
# from repo root
pnpm dev:web
```

Same command via Nx:

```bash
pnpm exec nx dev @cv-jobs-compatibility/web
```

Hot reload is enabled. Open http://localhost:3000.

The port is set to `3000` in `.env` (copy `.env.example` to `.env` on a fresh clone) so it does not clash with the API on `4000`. Override it with `PORT` if needed:

```bash
PORT=3100 pnpm dev:web
```

## Commands

Run these from the repository root.

| Command | Description |
| --- | --- |
| `pnpm dev:web` | Next.js development server |
| `pnpm start:web` | Serve the production build |

Everything else runs through Nx:

```bash
pnpm exec nx dev @cv-jobs-compatibility/web
pnpm exec nx build @cv-jobs-compatibility/web
pnpm exec nx start @cv-jobs-compatibility/web
pnpm exec nx test @cv-jobs-compatibility/web
pnpm exec nx lint @cv-jobs-compatibility/web
```

### Production

```bash
pnpm exec nx build @cv-jobs-compatibility/web
pnpm start:web
```

`start` expects a successful `build` first.

## Layout

```text
apps/web/
├── src/app/          # App Router
├── next.config.js
└── package.json
```
