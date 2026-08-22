# Decisions

Architecture, the trade-offs behind it, and the product calls that shaped it.

Implementation detail belongs in the code. If a question can be answered by
opening a file — which variables exist, what a class is called, how a module is
wired — it does not belong here.

Each entry is the decision, why it was made, and what it cost. When a decision is
reversed, rewrite the entry rather than appending to it: this describes the
system as it stands today.

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

The cost is that this does not scale like a real broker. At high throughput,
queue traffic competes with application queries for the same connections and the
same disk. Well past anything here, and SQS is the migration when it arrives.

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

Its schema is installed by a committed migration generated from
`getConstructionPlans()`, with `migrate` and `createSchema` turned off. pg-boss
will happily build and upgrade its own tables on boot, which is the same
every-instance-races-to-alter-the-schema problem the application's own
migrations avoid. Upgrading pg-boss therefore means a new migration from
`getMigrationPlans()`, not a version bump alone.

### One codebase, two entrypoints

`src/main.ts` serves HTTP; `src/worker.ts` runs the queue. Same sources, same
dependencies, two bundles, and in a deployment one image started with two
different commands as two services that scale independently — the API on request
volume, the worker on queue depth.

A separate application would have made that split heavier: the two share the
config, the database client, the storage client and the schema, so it would have
meant extracting all of that into libraries to keep one copy. The cost of this
shape is that neither entrypoint can be deployed without rebuilding both, and
the worker image carries the HTTP dependencies it never uses.

Only the worker supervises the queue — expiring, archiving, cron. Several API
instances doing maintenance on the same tables would be pure contention.

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
- **Containers and deployment.** The single-origin shape above is a plan, not
  something that has been stood up; no Dockerfiles exist yet.
- **Observability.** No structured logging, tracing or metrics beyond a health
  check.
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
