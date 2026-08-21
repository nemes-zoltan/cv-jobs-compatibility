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

The load-bearing part is the shared types package. Every request and response has
one definition: the API's DTOs implement the request types and its handlers
declare the response types, so the server cannot drift from the contract without
failing to compile, and the web app compiles against the same definitions rather
than a hand-copied duplicate. Because the contract describes JSON, timestamps are
strings — declaring `Date` in a shared model would be true on the server and
false on the client.

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
- **Vector search.** The local database image can support it, but nothing has
  been chosen or modelled — that decision belongs to the retrieval work and will
  be recorded here when it is made.
