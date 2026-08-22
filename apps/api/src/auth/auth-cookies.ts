import { SESSION_COOKIE } from '@cv-jobs-compatibility/constants'
import type { CookieOptions, Response } from 'express'
import { BaseConfigService } from '../config/config.service'

export const ACCESS_TOKEN_COOKIE = 'access_token'
export const REFRESH_TOKEN_COOKIE = 'refresh_token'

/**
 * `SESSION_COOKIE` says a session exists, and nothing else. Not a credential:
 * presenting it authenticates nobody, and no endpoint here reads it.
 *
 * It exists because neither token can answer "is this browser signed in?" for
 * the web app's router. The access cookie expires in a minute while the session
 * lives for a week, and the refresh cookie is deliberately scoped away from
 * ordinary page requests - so a request for a page carries nothing a redirect
 * could be decided from. Its name is shared rather than declared here, since
 * the other side of that contract is a different application.
 */
export { SESSION_COOKIE }

/** The value is a constant: it marks presence, and there is nothing to read. */
const SESSION_COOKIE_VALUE = '1'

/**
 * The refresh cookie is scoped to the auth routes, so the long-lived credential
 * is attached only to `/refresh` and `/logout` instead of riding along on every
 * request the app makes. Must stay in step with the global prefix set in
 * `main.ts` and with the controller's `auth` path.
 */
export const REFRESH_TOKEN_COOKIE_PATH = '/api/auth'

/**
 * `httpOnly` keeps both tokens out of reach of any script on the page, which is
 * the whole reason they live in cookies rather than in `localStorage`.
 *
 * `sameSite: 'lax'` is enough in both environments: locally the browser treats
 * ports 3000 and 4000 as the same site, and a deployment puts the web app and
 * the API behind one origin. Cross-site cookies (`none`) are never needed, so
 * the CSRF surface stays limited to top-level navigations - and every endpoint
 * that changes state is a `POST` with a JSON body.
 */
function cookieOptions(config: BaseConfigService, path: string, maxAgeSeconds?: number): CookieOptions {
  return {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    path,
    ...(maxAgeSeconds !== undefined && { maxAge: maxAgeSeconds * 1000 }),
  }
}

export function setAccessCookie(res: Response, config: BaseConfigService, token: string): void {
  res.cookie(ACCESS_TOKEN_COOKIE, token, cookieOptions(config, '/', config.accessTokenTtl))
}

export function setRefreshCookie(res: Response, config: BaseConfigService, token: string): void {
  res.cookie(
    REFRESH_TOKEN_COOKIE,
    token,
    cookieOptions(config, REFRESH_TOKEN_COOKIE_PATH, config.refreshTokenTtl),
  )
}

/**
 * Given the refresh token's lifetime, so it disappears exactly when the session
 * it describes does. `refresh` leaves it alone for the same reason it leaves
 * the refresh cookie alone: a session ends a fixed interval after it began.
 */
export function setSessionCookie(res: Response, config: BaseConfigService): void {
  res.cookie(SESSION_COOKIE, SESSION_COOKIE_VALUE, cookieOptions(config, '/', config.refreshTokenTtl))
}

/**
 * Browsers only drop a cookie when the attributes match the ones it was set
 * with, so the paths have to be repeated here.
 */
export function clearAuthCookies(res: Response, config: BaseConfigService): void {
  res.clearCookie(ACCESS_TOKEN_COOKIE, cookieOptions(config, '/'))
  res.clearCookie(REFRESH_TOKEN_COOKIE, cookieOptions(config, REFRESH_TOKEN_COOKIE_PATH))
  res.clearCookie(SESSION_COOKIE, cookieOptions(config, '/'))
}
