/**
 * The browser's side of the API contract.
 *
 * Requests go to the API directly rather than through a Next.js route handler,
 * so the browser is the one that receives `Set-Cookie` and owns the session. A
 * server action proxying these calls would have to parse those headers and
 * re-emit them, which is a different architecture for no gain while both apps
 * share an origin.
 *
 * `credentials: 'include'` is what makes the cookies travel in development,
 * where the two apps sit on different ports. In production they share an origin
 * and it costs nothing.
 */

// Read as a literal so Next.js can inline it at build time.
const API_URL = process.env.NEXT_PUBLIC_API_URL

/** What every failed call throws, whatever the failure was. */
export class ApiError extends Error {
  constructor(
    /** The HTTP status, or `0` when the request never got an answer. */
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

const UNREACHABLE = 'Could not reach the server. Check your connection and try again.'
const UNEXPECTED = 'Something went wrong. Please try again.'

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  /** Serialised as JSON. */
  body?: unknown
  /**
   * Whether a `401` should be treated as an expired access token and retried
   * once behind a refresh.
   *
   * On by default, because a guarded endpoint is the normal case and access
   * tokens are short-lived enough that this path runs constantly. The
   * endpoints that authenticate turn it off: a rejected password is a `401`
   * that no amount of refreshing will fix.
   */
  refreshOnUnauthorized?: boolean
}

/** The shape NestJS's exception filter serialises. */
interface ApiErrorBody {
  message?: string | string[]
}

function url(path: string): string {
  if (!API_URL) throw new ApiError(0, 'NEXT_PUBLIC_API_URL is not set - see apps/web/.env.example')

  return `${API_URL}${path}`
}

async function send(path: string, options: ApiRequestOptions): Promise<Response> {
  try {
    return await fetch(url(path), {
      method: options.method ?? 'GET',
      credentials: 'include',
      headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch (error) {
    // `fetch` rejects only when the request never completed - offline, DNS,
    // CORS. Every HTTP status, including 500, resolves.
    if (error instanceof ApiError) throw error
    throw new ApiError(0, UNREACHABLE)
  }
}

/**
 * Turns an error response into an `ApiError`, preferring the API's own message.
 *
 * Validation failures arrive as an array of messages, one per broken rule. They
 * are joined rather than dropped: the client mirrors the same rules, so an
 * array reaching this point means the two have drifted and the detail is worth
 * seeing.
 */
async function toApiError(response: Response): Promise<ApiError> {
  let message: string | undefined

  try {
    const body = (await response.json()) as ApiErrorBody
    message = Array.isArray(body.message) ? body.message.join('. ') : body.message
  } catch {
    // No body, or not JSON. The status is all there is.
  }

  return new ApiError(response.status, message || UNEXPECTED)
}

/**
 * At most one refresh is in flight at a time.
 *
 * Several requests routinely expire together - a page that loads two guarded
 * endpoints at once will 401 twice - and without this each would refresh
 * separately. Sharing the promise is not a correctness requirement, since
 * refresh tokens are not rotated and concurrent refreshes are idempotent, but
 * it keeps a burst of 401s from becoming a burst of refreshes.
 */
let refreshInFlight: Promise<boolean> | null = null

function refreshSession(): Promise<boolean> {
  refreshInFlight ??= send('/auth/refresh', { method: 'POST' })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null
    })

  return refreshInFlight
}

/**
 * Deliberately does no redirecting of its own. A failed refresh means the
 * session is over, but what to do about that is the caller's decision - the
 * session provider sends the browser to the login form, and a background call
 * may prefer to fail quietly.
 */
export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  let response = await send(path, options)

  if (response.status === 401 && (options.refreshOnUnauthorized ?? true)) {
    // The body is a string by the time it is sent, so replaying the request
    // costs nothing.
    if (await refreshSession()) {
      response = await send(path, options)
    }
  }

  if (!response.ok) throw await toApiError(response)

  // `204` on logout and refresh: the answer is in the headers.
  if (response.status === 204) return undefined as T

  return (await response.json()) as T
}

/** Every failure reaches the forms as an `ApiError`; this is belt and braces. */
export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : UNEXPECTED
}
