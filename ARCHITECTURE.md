# Architecture

The long version: every architectural trade-off, what it cost, and the product
calls that shaped it. [DECISIONS.md](DECISIONS.md) is the summary — start there
if you want the short answer.

Implementation detail belongs in the code. If a question can be answered by
opening a file — which variables exist, what a class is called, how a module is
wired — it does not belong here.

Each entry is the decision, why it was made, and what it cost. When a decision is
reversed, rewrite the entry rather than appending to it: this describes the
system as it stands today.

---

## The stack

| | Choice | In one line |
| --- | --- | --- |
| Repository | Nx monorepo, pnpm | One commit crosses the API, the web app and the shared contract |
| API | NestJS | Dependency injection and module boundaries without assembling them by hand |
| Web | Next.js, App Router | Server-rendered pages, and `standalone` output keeps the image small |
| UI | Tailwind, shadcn | Components in the repository rather than a dependency to fight |
| Database | Postgres 17, Drizzle | SQL stays visible; migrations are reviewed and committed |
| Queue | pg-boss | A table in the same database, so a row and its job commit together |
| Object storage | S3, MinIO locally | The browser uploads straight to it; the API never handles bytes |
| LLM | Google Gemini | Free tier, structured output, no card required to start |
| Auth | Hand-written JWT in `httpOnly` cookies | One strategy did not justify Passport |
| Tracing | OpenTelemetry → X-Ray | The application only speaks OTLP; the destination is deployment config |
| Deployment | ECS Fargate, ALB, RDS | Two images, four runtimes, no instances to manage |
| Infrastructure | Terraform | Version-controlled, and `destroy` actually empties the account |

Not chosen yet: an embedding model, a vector store, and any retrieval beyond
what the extraction prompt returns. That decision belongs to the retrieval work
and will be recorded here when it is made.

---

## Architecture

### One repository, one shared contract

The API, the web app and the shared UI library live in a single Nx workspace, so
a change that crosses them is one commit and one review.

The load-bearing part is the shared contract packages. Every request and response
has one definition: the API's DTOs implement the request types and its handlers
declare the response types, so the server cannot drift from the contract without
failing to compile, and the web app compiles against the same definitions rather
than a hand-copied duplicate. Because the contract describes JSON, timestamps are
strings — declaring `Date` in a shared model would be true on the server and
false on the client.

It is two packages, split on whether a symbol survives compilation. `types` is
erased entirely; `constants` holds the runtime values several places must agree
on — upload limits the browser and the API both enforce, and the enum members
Postgres declares. The database schema imports those lists rather than restating
them, so a status the API can set is always one the column accepts. `libs/` holds
generic building blocks and `domains/` holds packages that only mean something to
this product, which is why both live under the latter.

The cost is a heavier toolchain than two repositories would need, and a contract
change now ripples to both sides at once. That is the point, but it does mean
neither side can quietly ship ahead of the other.

### Authentication is stateless, and sessions cannot be revoked

The largest trade-off in the system.

Access and refresh tokens are JWTs; there is no session table. Access tokens are
short-lived and verified by signature alone, with no database round trip, which
is what makes a guarded endpoint cheap enough for client components to poll.
Refresh tokens are long-lived and are never rotated.

Rotation with reuse detection is the stronger design and it breaks under a
polling client: several requests expire in the same instant, all refresh at once,
the first invalidates the token the others are still holding, and reuse detection
reads the result as theft and ends the session. Avoiding that needs single-flight
refresh logic in every client, or a server-side grace window, or both. Without
rotation, concurrent refreshes are idempotent and none of that machinery exists.

What it costs is real: signing out clears the cookies, but the refresh token stays
cryptographically valid until it expires. A stolen token cannot be revoked, a
session cannot be ended from another device, and changing a password does not
invalidate sessions already open. A table holding one hash per session is the
fix, and it is the first thing to add if this ever holds real accounts.

### Tokens live in cookies, not in JavaScript

Both tokens are `httpOnly` cookies and neither ever appears in a response body.
No script on the page can read them, and a browser authenticates by simply making
a request — nothing to attach per call, nothing to restore after a reload. That is
what lets client components poll without an auth wrapper around every `fetch`.

The alternative, a bearer token in `localStorage`, trades CSRF exposure for XSS
exposure. Neither is free; this keeps the credential out of reach of the exposure
that is harder to contain. CSRF is then held off by `SameSite` plus the fact that
every state-changing route is a `POST` with a JSON body — adequate while both
apps share an origin, insufficient the moment cross-site form posts matter.

Tokens carry a user id and nothing else. Anything beyond identity is read at the
point of use, so a token can never serve a stale name or a permission that has
since been withdrawn, and a deleted account stops working immediately rather than
when its token happens to expire.

The auth layer is hand-written — a guard that reads a cookie and verifies it —
rather than Passport. With a single strategy, the strategy abstraction is three
dependencies of indirection around ten lines. A second one, OAuth or API keys,
would be the point to reconsider.

### A third cookie tells the router a session exists

Neither token can answer "is this browser signed in?" for the web app's router.
The access cookie expires in a minute while the session lives for a week, so
gating on it would bounce an active user to the login form every minute. The
refresh cookie could answer it, but it is scoped to `/api/auth` precisely so the
long-lived credential does not ride along on ordinary requests — which means a
request for `/` carries neither.

So signing in also sets `session=1`: `httpOnly`, `path=/`, and the refresh
token's lifetime. It is not a credential. Presenting it authenticates nobody, no
endpoint reads it, and its value is a constant, so there is nothing in it worth
stealing. Its only reader is Next.js middleware deciding between a page and a
redirect.

What it buys is a redirect that happens before anything renders. What it costs is
a third cookie that has to be set and cleared in step with the other two — and a
hint that can be wrong. A deleted account or a rotated signing key leaves the
marker in place beside tokens the API will no longer accept, and the proxy then
admits a request the page's own `/auth/me` call rejects a moment later.

That disagreement is a redirect loop waiting to happen: the page sends the
browser to the login form, the proxy reads the marker still sitting there and
sends it back. So the app shell clears the cookies before it redirects, and
redirects only once the API confirms they are gone. A failed session check that
cannot be cleared — the API is unreachable — stops and offers to retry rather
than redirecting into the loop.

The cookie is an optimisation over the real check, never a replacement for it:
every authorisation decision still happens at the API.

Widening the refresh cookie to `path=/` would have avoided the extra cookie, at
the price of attaching a week-long credential to every request to the origin.

### Resume files never pass through the API

The browser asks for a presigned URL, `PUT`s the file straight to object
storage, and then tells the API it is done. The API signs URLs and reads objects
back; it never handles file bytes.

Sending the file through the API was the other candidate and would have been
adequate — a CV is a few megabytes, and each user uploads roughly one, ever, so
the upload path was never going to be this system's bottleneck. What decided it
is that the presigned shape is the one that is already correct on a hyper-scaler
rather than the one that would need revisiting there: no request-size ceiling at
the load balancer, no memory per concurrent upload, and the API scaling on
traffic rather than on file volume.

The order matters and is the part worth defending. **Nothing is recorded until
the upload has finished.** The alternative — create the row, hand out the URL,
mark it complete afterwards — leaves a row for every upload anyone abandons at
the file picker, and a user whose browser dies between the `PUT` and the
confirmation sees a resume stuck processing forever. Recording last means an
abandoned upload leaves an unreferenced object nobody can see, and the user
simply retries. The orphan moves from the side that is visible and broken to the
side that is invisible and cheap.

What it costs:

- **CORS is back.** "The web app and the API are one origin" holds for the two
  applications, but a browser `PUT` to the storage host is cross-origin by
  construction, so the bucket needs its own policy. MinIO is configured to match
  locally so this is not discovered after deployment.
- **The client hands us the key.** It is untrusted input, so the user id is a
  path segment and the API refuses any key whose prefix is not the caller's.
  Signing the key when it is minted is the stronger version and is not built.
- **Size is not enforced at the bucket.** The declared size is checked before a
  URL is signed, and the object's real size is checked before it is processed,
  but a client that lies can still write an oversized object first. A presigned
  POST policy with `content-length-range` is the fix if it matters.
- **Orphaned objects accumulate.** Nothing deletes an object whose upload was
  never confirmed. Accepted for now: it is a few kilobytes per rare failure and
  invisible to users. The intended cleanup is a scheduled job that lists objects
  written between one and twenty-four hours ago and deletes those with no row —
  the lower bound is load-bearing, since without it the sweep deletes files whose
  confirmation is still in flight.

### The queue is a table in the same database

pg-boss, so jobs live in Postgres beside the data they operate on. No broker to
run, no second thing that can be down, and — because the queue and the domain
tables share a transaction — a row and the job that processes it can be written
atomically. Without that, an enqueue failing after a commit strands a resume
that nothing will ever pick up.

pg-boss owns tables, and it is not allowed to install them. Its schema ships as
a committed migration like everything else, with its own migrate-on-boot turned
off — left on, every instance would race to build and upgrade the same tables on
startup, which is exactly what the application's migrations already avoid. The
cost is that upgrading pg-boss means generating a migration, not just bumping a
version.

The larger cost is that this does not scale like a real broker. At high
throughput, queue traffic competes with application queries for the same
connections and the same disk. Well past anything here, and SQS is the migration
when it arrives.

### `hasResume` is a question, not a column

Which screen the app opens on depends on whether a CV has made it through the
pipeline. That could be a boolean on `users`, and it would be wrong sooner or
later: the row that makes it true appears in a **worker**, not in a request, so
the flag would be written by a process the user never talks to and left stale by
any failure between the two.

So `UserModel.hasResume` is read from the `resumes` table on every `/auth/me`.
A row exists there only when everything succeeded, which makes its presence the
whole answer. The cost is one indexed lookup per session check, and a value that
can go stale in a tab that is already open — which is why the session can be
re-read, and why the page that finishes an upload does so before it routes.

The routing itself stays in the pages rather than the proxy. The proxy sees only
cookies, and no cookie can be set at the moment a worker finishes.

### The pipeline is a chain of steps, and only some failures retry

`IngestionService` holds the order and nothing else: text, then the model, then
the rows. Each step is its own service — one owns every write to
`resume_ingestions`, one turns the stored file into text, one runs the model and
records the attempt, one writes the resume and its children. Reading the
orchestrator is meant to be enough to know what happens to an uploaded CV.

The distinction that runs through all of it is retryable versus terminal.
Anything a later attempt could survive — a storage timeout, a rate-limited model
— is thrown and reaches pg-boss, which retries with backoff. Anything that would
repeat identically — an unreadable file, output that is not JSON, a document that
is not a CV — raises `TerminalIngestionError`, and the orchestrator ends the
ingestion instead. Retrying those would spend two more minutes arriving at the
same answer.

The model's attempt is recorded before it is judged, so a failure while writing
the resume rows is recoverable without paying for the call twice: a retry finds
the stored response and goes straight to persistence.

What this costs is a status that can lie briefly. `analyzing` is set before the
call and nothing resets it if the process dies mid-request, which is what the
abandonment window below exists to cover.

### An upload is identified by its key, and a stuck one ages out

There is no separate idempotency token. The storage key is minted server-side,
carries a fresh uuid, is unique on the ingestion row, and cannot be reused by a
client that does not own its prefix — so a confirmation repeated after a lost
response returns the upload that already exists rather than creating a second.

The simultaneous case is left to the database. Two confirmations of one key race,
the unique index rejects the loser, and its transaction rolls back — taking with
it the job it had just enqueued, because that enqueue was inside the same
transaction. Swallowing the conflict instead (`on conflict do nothing`) would
commit and strand a duplicate job, which is why the insert is allowed to throw.
The worker is re-entrant for the same reason: it claims a row only if that row
has not already finished, so a redelivered job does nothing and an interrupted
one resumes.

What is deliberately missing is a timeout. Nothing marks an abandoned ingestion
failed — a worker that dies mid-file leaves a row that no longer moves, and the
API keeps reporting it as in progress for exactly as long as it sits there.

The way out is a person, not a sweeper. After three minutes without a status
change the browser stops saying "working" and offers to delete the upload, which
removes the row, its children and the stored file in one go. The same button
handles a rejected CV and replacing one that is already in, so there is one path
out of every dead end rather than three.

Deleting an upload whose worker is merely slow is safe: the handler claims a row
before it works on one, so a job that arrives afterwards finds nothing and drops
itself.

The cost is that three minutes is a judgement, not a measurement. A job that is
still legitimately retrying can be presented as stuck, and someone who acts on
that pays for the same CV twice.

### One codebase, three entrypoints

`main.ts` serves HTTP, `worker.ts` runs the queue, `migrate.ts` applies
migrations and exits. Same sources, same dependencies, three bundles, and in a
deployment one image started with three different commands — two long-running
services that scale independently, and a task that runs once.

A separate application per entrypoint would have made the split heavier: they
share the config, the database client, the storage client and the schema, so it
would have meant extracting all of that into libraries to keep one copy. The
cost of this shape is that no entrypoint can be deployed without rebuilding all
of them, and the worker image carries HTTP dependencies it never uses.

The migration entrypoint is deliberately not `drizzle-kit`. That is a
devDependency configured in TypeScript, so using it in a deployment would mean
shipping a build tool and a TypeScript runtime to run one task. Drizzle's own
migrator is already a runtime dependency and reads the same journal, so the two
agree about what has been applied.

Only the worker supervises the queue — expiring, archiving, cron. Several API
instances maintaining the same tables would be pure contention. Several *workers*
are fine, and the deployment runs two: pg-boss guards maintenance with an
advisory lock and claims cron intervals in the database, so only one instance
wins each round.

The API scales on request volume. The worker was meant to scale on queue depth
and does not, because nothing publishes that metric — so it runs at a fixed
count. That gap is the honest reason there is no autoscaling on it.

### Development stands in S3 with MinIO, not a mock

MinIO speaks the S3 API, so the code that talks to it locally is the code that
talks to S3 in a deployment. The difference is three configuration values:
development sets an endpoint, forces path-style addressing and supplies static
credentials; production sets none of them, which is what makes the SDK derive
the real endpoint and take short-lived credentials from the task role. No static
key pair has to exist in a deployed task definition.

LocalStack would have emulated the rest of AWS as well, which is a larger
dependency for one bucket.

### SQL stays visible and migrations stay deliberate

Drizzle rather than a full ORM: the schema is TypeScript, and migrations are
generated SQL that is reviewed and committed like any other code. The cost is
explicit joins and no lazy-loaded relations.

Nothing migrates at startup. Applying migrations is a separate step, which in a
deployment is a one-off task run before the service update. Automatic migration
on boot would have every scaling event race to alter the schema.

### The web app and the API are one origin

A single load balancer routes `/api/*` to the API and everything else to the web
app. They then share an origin in production: no CORS, no cross-site cookies, no
third-party cookie policy to fight. Locally the two ports are still same-site, so
the cookie behaviour is identical in both places rather than something that only
breaks after deployment.

The cost is that the two can no longer be deployed to unrelated domains without
revisiting the cookie strategy.

---

## Deployment

This has been stood up on AWS, demonstrated and destroyed. The mechanics are in
[infra/README.md](infra/README.md); the calls behind them are here.

### Fargate, not instances

Four runtimes from two images: the HTTP server, the queue worker, a one-off
migration task, and the web app. ECS runs each as a task definition, and the
worker — which serves no HTTP and so has nothing to health-check — is a service
with a desired count and no load balancer.

An Auto Scaling Group was the alternative and would have meant writing user-data
to install Docker, authenticate to ECR, start containers and restart them when
they die, plus owning AMI patching. All of that is work ECS already does, and
none of it is work this product is about.

The cost is a ceiling on control: no daemonsets, no host tuning, and a cold
start measured in tens of seconds rather than milliseconds.

### Secrets live in Parameter Store

Standard SSM parameters are free, including `SecureString`. Secrets Manager is
better — it rotates, it replicates across regions — and charges $0.40 per secret
per month for features nothing here uses. ECS reads both through the same
mechanism, so the application cannot tell which was chosen.

The consequence is that RDS cannot manage its own master password, which
requires Secrets Manager, so Terraform generates it instead and it lives in
Terraform state.

Which is why the split matters: secrets born with the stack — the signing key,
the database password — are generated by Terraform and are worthless once it is
destroyed. The Gemini API key is not. It outlives the stack and has billing
attached, so it is written to Parameter Store by the deploy script and Terraform
only ever names it. A key read through a data source would be a key sitting in
plaintext in state.

### The demonstrated deployment has no TLS

The load balancer listens on port 80 with no certificate, because the account
used could not issue one. This is the worst thing about the deployment and is
recorded rather than hidden.

A browser refuses to store a `Secure` cookie set over plain HTTP, so leaving
cookies marked secure would mean every sign-in returning 200 and no session ever
existing. The API therefore honours a `COOKIE_SECURE` opt-out, defaulting to on,
which the demo sets to off. Every session on that stack was readable by anyone
on the wire.

Acceptable for a stack that existed for one afternoon and held nothing but test
data. Not acceptable for anything else, and the fix is ACM plus a domain — not a
change to the application.

### Migrations run between "database exists" and "anything starts"

Nothing migrates on boot. Both the API and the worker open the queue at startup,
which fails outright when the schema is missing, so neither can be running while
it changes.

The deploy is therefore three applies: the whole configuration with every
service held at zero tasks, then the migration as a one-off task, then the same
configuration again with real task counts. A non-zero exit from the migration
stops the deploy, because a deployment that carries on is code running against a
schema that does not support it.

Targeting a subset of resources was tried first and was wrong: a task definition
references the execution role's ARN but not the role's policies, and references
no subnets at all, so it produced a migration task that could neither pull its
image nor reach a network. Zero desired count expresses "built but not running"
honestly; `-target` only looked like it did.

The cost is a brief full stop on every deploy. Zero-downtime would need
backward-compatible migrations — which these are written to be — plus a rolling
update that the script does not do.

### Three subnet tiers, and one NAT gateway

Public holds the load balancer and the NAT gateway; app holds every Fargate
task; data holds Postgres and has no route off the VPC in either direction. The
security groups chain by reference rather than by address range — the load
balancer's group is what the tasks accept, the tasks' group is what the database
accepts — so the rules survive every address changing.

One NAT gateway rather than one per zone. Two would survive a zone failure; for
a stack destroyed the same day, halving the cost of the most expensive line item
was the better trade.

Tasks in public subnets with public addresses would have avoided the NAT gateway
entirely, at roughly $35/month saved on a long-lived stack. Over an afternoon it
saves about twenty cents, which is not worth a shape that has to be explained.

### Two ECS clusters, and what that is actually worth

One for the load-balanced services, one for the worker and one-off tasks.

Worth being precise, because it is easy to overclaim: with Fargate a cluster is
a namespace, not a compute boundary. Nothing is attached to it, and every task
already runs in its own managed microVM, so the API and the worker are isolated
from each other either way. What two clusters buy is operational and IAM
separation — a policy or a service update scoped to one cannot reach the other.
On EC2 launch type the isolation argument would be real.

### Terraform state is local

Correct for a stack one person creates and destroys the same day, and wrong the
moment a second person or a CI runner applies it. State holds the generated
signing key and the database password in plaintext, so it is gitignored and
never committed. The remote backend that replaces it is written out and
commented in the configuration.

### How far this scales, and what breaks first

Nothing here was load tested. What follows is arithmetic from configured values,
which is enough to say what the ceiling is made of and in what order it is hit.

**First limit: Postgres connections, and it is closer than it looks.**

Each API and worker task opens two pools — twenty for the application and four
for pg-boss, so twenty-four per task. RDS derives `max_connections` from
instance memory (`LEAST({DBInstanceClassMemory/9531392},5000)`), which on a
`db.t4g.micro` is 112, less three reserved for superusers. The deployed shape is
two API and two worker tasks:

```
(2 api + 2 workers) × 24  =  96 of 109 usable
```

Ninety per cent of the connection budget at rest. Worse, CPU autoscaling is
configured to take the API to four tasks, and that does not fit:

```
(4 api + 2 workers) × 24  =  144   ✗
```

So the autoscaling ceiling is set above what the database can serve, and the
failure would arrive as connection errors under exactly the load that triggered
the scale-out. **This is a real defect, not a theoretical one.** The fix is any
of: RDS Proxy or PgBouncer so tasks share a pool, a smaller `DATABASE_POOL_MAX`,
or an instance with room. Pooling is the right answer, because it is the one
that keeps working as task counts grow.

**Second limit: the model, not the infrastructure.**

Every handler runs `batchSize: 1`, and `localConcurrency` is never set, so it
takes pg-boss's default of 1. Each worker therefore runs **one job per queue at
a time**. There are four queues — resume extraction, job extraction, job
insights, job matching — so a worker can have four jobs in flight, but only one
of each kind.

That distinction matters, because the four are different work, not four lanes of
the same work. For a resume upload the concurrency is one per worker:

```
resume extraction:  1 per worker × 2 workers  =  2 at a time
```

A job posting is worse than it looks the other way — one posting fans out into
three LLM calls across three of those queues.

Two calls observed in one deployed trace took 13.5s and 21.4s, which is a data
point rather than a benchmark. The shape is the point: throughput is however
fast the model answers, multiplied by a concurrency of two. What binds is Gemini's rate limit
and then its bill, not anything in this stack. The levers are more worker tasks
or `localConcurrency` above 1, and both lead straight back to the connection
ceiling above.

**Third limit: pg-boss itself, and it is nowhere near.**

With a couple of jobs in flight the queue is doing single-digit queries per
second. pg-boss on modest hardware handles jobs per second in the high hundreds
to low thousands. The queue is orders of magnitude from being the constraint, which
is the whole justification for not running a broker.

**So when would a Redis or SQS queue be right?**

Not for throughput — that argument does not arrive until sustained thousands of
jobs per second, and this workload is capped by an LLM long before then. The
real triggers are:

- **Connection pressure.** Every worker holding four pg-boss connections is the
  cost of the queue living in the database. At tens of workers that is the
  dominant consumer, and pooling helps the application pools more than it helps
  a queue that wants long-lived listeners.
- **Decoupling availability.** Today the queue is down whenever Postgres is. A
  broker means an upload can still be accepted and enqueued during a database
  failover.
- **Fan-out past one database.** Sharding the domain tables makes a
  single-database queue the thing that stops it.

What is given up in that move is the property the current design exists for: a
row and the job that processes it committing in one transaction. With an
external broker, enqueue-after-commit can fail and strand work, and getting back
to safety means an outbox table and a relay — which is more moving parts than
pg-boss is. That trade only pays once one of the three triggers above is real.

---

## Product

### Registering signs you straight in

A new account gets its session immediately rather than being bounced to a sign-in
form to retype what it just submitted. There is no email verification gate,
because nothing in the product yet depends on an address being real.

### A failed sign-in never says which half was wrong

An unknown address and a wrong password return the same message, and take about
the same time to do it. The alternative turns the sign-in form into a tool for
discovering which addresses have accounts.

Registration is necessarily the exception — it has to reject a duplicate address —
so that route remains an enumeration vector, which is one reason rate limiting
belongs on the list below.

### Password rules are length and nothing else

A floor and a ceiling, no composition requirements. Mandatory symbols and digits
push people towards predictable substitutions of a weak base word, and NIST
stopped recommending them years ago. The ceiling only exists so nobody hands the
hashing function a megabyte.

### A session lasts a week and does not slide

Refresh tokens are not extended on use, so a session ends a fixed interval after
it began rather than living forever for anyone who stays active. Signing in again
once a week is a small enough cost for a bounded worst case on a credential that
cannot be revoked.

---

## What we have not built

Deliberate omissions, not oversights.

- **Server-side session revocation** — the consequence of the stateless design
  above, and the first thing to add for real accounts.
- **Rate limiting** on sign-in and registration. Both currently answer as fast as
  password hashing allows.
- **CSRF tokens.** `SameSite` carries it today; a token pattern is needed before
  accepting cross-site requests.
- **Email verification, password reset, account lockout.**
- **Structured logging and metrics.** Tracing exists — the API and worker emit
  OTLP and propagate context across the job queue — but logs are still Nest's
  default text, and nothing publishes a metric. Queue depth is the one that is
  actually missed: without it the worker has no honest signal to scale on, so it
  runs at a fixed count while the API and web scale on CPU.
- **CI.** Images are built by the deploy script on a developer machine. Nothing
  builds or tests on push, and nothing stops an image being built from a dirty
  tree beyond a warning.
- **A second environment.** One configuration, applied by one person. Promoting
  a tested image from staging to production is the shape this is built for — the
  web image bakes a relative API URL precisely so the same artifact works
  anywhere — but there is only one place to put it.
- **OCR.** A scanned CV is a picture of text, and neither extractor reads one.
  Below 200 characters of extracted text the ingestion is marked `failed` rather
  than sending near-empty text to a model that would invent a CV from it. The
  fix, if it matters, is a model that reads the PDF directly rather than an OCR
  step of our own.
- **More than one CV per account.** One resume, hard-locked, and no way to
  replace it: the only route to a new CV is deleting the upload behind the old
  one. Replacing, keeping a history, and choosing which CV a role is scored
  against are all the same feature, and it is the next thing to build here.
- **Skills tied to the roles they were used in.** `resume_skills` hangs off the
  resume, not off an experience, because the extraction schema asks for one flat
  list. The CV page approximates it by looking for skill names in each role's own
  bullet text, which finds what was written down and misses what was not. Doing
  it properly means asking the model which skills belong to which role, and that
  is a new prompt version and a re-extraction.
- **Vector search.** The local database image can support it, but nothing has
  been chosen or modelled — that decision belongs to the retrieval work and will
  be recorded here when it is made.
- **A sweeper.** Nothing deletes storage objects whose upload was never
  confirmed, or job postings nobody saved. Both are described above as accepted;
  neither is built.
