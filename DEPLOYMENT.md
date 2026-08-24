# Deployment

The plan for running this on AWS. **Nothing here has been stood up** — the two Dockerfiles exist and are tested locally, and everything below is the shape they are built for. Why it is shaped this way is in [DECISIONS.md](DECISIONS.md); this file is the mechanics.

## Shape

```
                    https://app.example.com
                              │
                    ┌─────────┴──────────┐
                    │   ALB  :443 (ACM)  │
                    └─────────┬──────────┘
              /api, /api/*    │    everything else
                    ┌─────────┴──────────┐
                    ▼                    ▼
             ┌────────────┐       ┌────────────┐
             │  api-tg    │       │  web-tg    │
             │  ECS svc   │       │  ECS svc   │
             │ dist/      │       │ Next       │
             │ main.js    │       │ server.js  │
             └─────┬──────┘       └────────────┘
                   │
                   │  (no load balancer)
             ┌─────▼──────┐      ┌──────────────┐
             │ worker svc │      │ migrate task │
             │ dist-worker│      │ dist-migrate │
             └─────┬──────┘      └──────┬───────┘
                   │                    │
        ┌──────────┴────────────────────┴─────────┐
        ▼                    ▼                    ▼
     RDS Postgres        S3 bucket        Secrets Manager
```

One hostname, so the browser sees one origin. The API owns `/api` because `main.ts` sets that global prefix — the ALB routes on a path the application really has, and rewrites nothing.

## Resources to create once

| Resource | Notes |
| --- | --- |
| ECR repositories | `cv-jobs-api`, `cv-jobs-web` |
| ECS cluster | Fargate |
| RDS Postgres 17 | `pgvector` is not required — the extension is not enabled |
| S3 bucket | Plus a CORS policy allowing `PUT` from the app's origin — the browser uploads straight to it |
| ALB | One listener on 443 with an ACM certificate |
| Target groups | `api-tg` (port 4000, health check `/api/health`), `web-tg` (port 3000, health check `/login`) |
| Secrets Manager | `JWT_SECRET`, the database credentials, `GOOGLE_GEMINI_API_KEY` |
| Task roles | The API and worker roles need `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject` and `s3:HeadObject` on the bucket. No static keys anywhere |

### Listener rules

| Priority | Condition | Action |
| --- | --- | --- |
| 10 | path is `/api` or `/api/*` | forward to `api-tg` |
| default | — | forward to `web-tg` |

Both patterns are needed: `/api/*` does not match `/api`, which `AppController` serves.

## Images

```bash
docker build -f apps/api/Dockerfile -t cv-jobs-api .
docker build -f apps/web/Dockerfile -t cv-jobs-web .        # NEXT_PUBLIC_API_URL defaults to /api
```

The web image bakes its API URL at build time, and the default `/api` is relative — it contains no hostname, no IP and no environment name, so the browser resolves it against whatever origin served the page. Build it once and promote the same image through staging and production; there is nothing to rebuild once the deployment exists.

A build argument is only needed if the API and the web app stop sharing a hostname, and then it is a DNS name chosen in advance. Never an address: ALB addresses rotate, which is why Route 53 points at them with alias records rather than A records.

The `cv-jobs-web:local` build described in the [web README](apps/web/README.md#running-it) is for running a container on a developer machine with no load balancer in front of it. It must not be deployed.

Tag and push both to ECR.

## Services and tasks

Three runtimes from the API image, one from the web image.

| | Image | Command | Load balancer | Scales on |
| --- | --- | --- | --- | --- |
| API | `cv-jobs-api` | `node dist/main.js` | `api-tg` | request volume |
| Worker | `cv-jobs-api` | `node dist-worker/main.js` | none | queue depth |
| Migrations | `cv-jobs-api` | `node dist-migrate/main.js` | none | run once, exits |
| Web | `cv-jobs-web` | image default | `web-tg` | request volume |

### Environment

| Variable | API | Worker | Value |
| --- | --- | --- | --- |
| `NODE_ENV` | ✓ | ✓ | `production` — also what turns on TLS to Postgres |
| `PORT` | ✓ | — | `4000` |
| `WEB_ORIGIN` | ✓ | — | `https://app.example.com` |
| `DATABASE_URL` or `POSTGRES_*` | ✓ | ✓ | from the RDS secret |
| `JWT_SECRET` | ✓ | ✓ | from Secrets Manager |
| `ACCESS_TOKEN_TTL` / `REFRESH_TOKEN_TTL` | ✓ | ✓ | `60` / `604800` |
| `S3_BUCKET` / `S3_REGION` | ✓ | ✓ | the bucket and its region |
| `UPLOAD_URL_TTL` | ✓ | ✓ | `300` |
| `S3_ENDPOINT` | — | — | **unset**; absent means AWS's own |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | — | — | **unset**; the task role provides credentials |
| `GOOGLE_GEMINI_API_KEY` | — | ✓ | from Secrets Manager. The API never reads it, so its task definition does not get it |
| `GEMINI_SEARCH_ENABLED` | — | optional | `true` only with billing enabled on the Google project |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | optional | optional | `http://localhost:4318` — an ADOT sidecar in the same task |
| `OTEL_SERVICE_NAME` | optional | optional | `cv-jobs-api` / `cv-jobs-worker` |

The web task needs no environment at all.

## Deploying

Migrations do not run on boot — several instances racing to alter one schema on every scaling event is the problem being avoided. So the order is:

1. Build and push both images.
2. `aws ecs run-task` with a command override of `["node","dist-migrate/main.js"]`. Wait for it to exit `0`; a non-zero exit means stop here, because the new code expects a schema that does not exist.
3. Update the API, worker and web services to the new task definitions.

Migrations are written to be safe to apply before the old code stops running. A change that is not — dropping a column the running version still selects — needs the usual two-step: deploy the code that stops using it, then the migration that removes it.

## Not built yet

- No Terraform, CDK or CloudFormation. Every resource above is currently a description, not code.
- No CI. Images are built by hand.
- No queue-depth metric published, so the worker cannot autoscale on anything meaningful yet.
- No sweeper for postings nobody has saved, or for storage objects whose upload was never confirmed.
- Sessions cannot be revoked — see DECISIONS.md. The first thing to fix for real accounts.
