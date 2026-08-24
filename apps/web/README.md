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

## Docker image

The build context must be the repository root — this app depends on workspace packages that live outside `apps/web`.

```bash
# from the repository root
docker build -f apps/web/Dockerfile -t cv-jobs-web .

# from apps/web
docker build -f Dockerfile -t cv-jobs-web ../..
```

`NEXT_PUBLIC_API_URL` is inlined at build time, not read at runtime, so it is a build argument.

The default `/api` is **relative**, and that is the point: the browser resolves it against whatever origin served the page, so the image contains no hostname, no IP and no environment name. The same image is built once and deployed to staging and production unchanged — nothing about it has to be known or rebuilt after a deployment exists. This is the image to ship.

Override it only if the API and the web app stop sharing a hostname, in which case you bake a DNS name you chose in advance — never an address:

```bash
docker build -f apps/web/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://api.example.com/api \
  -t cv-jobs-web .
```

### Running it

```bash
docker run --name cv-jobs-web -p 3000:3000 cv-jobs-web
```

Nothing is passed at run time — but that is not the same as needing no configuration. The API URL is configuration; it was fixed when the image was built and cannot be changed afterwards.

With the default `/api` the browser asks whatever origin served the page. That is correct behind a load balancer routing `/api/*` to the API, and wrong for a container running on its own: the browser would call `http://localhost:3000/api/...`, which this container does not serve.

To run it standalone against a local API on port 4000, bake that in instead. Tag it separately: this build is for your machine and must not be deployed.

```bash
docker build -f apps/web/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=http://localhost:4000/api \
  -t cv-jobs-web:local .

docker run --name cv-jobs-web -p 3000:3000 cv-jobs-web:local
```

Different ports on `localhost` are still same-site, so the auth cookies work. The API needs `WEB_ORIGIN=http://localhost:3000` so CORS allows the calls.

`PORT` (`3000`) and `HOSTNAME` (`0.0.0.0`) are set in the image and can be overridden at run time:

```bash
docker run --name cv-jobs-web -p 8080:8080 -e PORT=8080 cv-jobs-web
```
