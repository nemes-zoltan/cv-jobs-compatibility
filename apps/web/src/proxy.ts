import { SESSION_COOKIE } from '@cv-jobs-compatibility/constants'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Decides between a page and a redirect before anything renders.
 *
 * Named `proxy` rather than `middleware`: Next 16 renamed the convention and
 * warns on the old filename.
 *
 * The only thing it can see is whether the session cookie is present, which is
 * a hint and not an authorisation: the cookie outlives a logout in another tab,
 * and says nothing about whether the API would still accept the tokens beside
 * it. When it is wrong, the protected layout's own `/auth/me` call catches it a
 * moment later and sends the browser back here. This exists so the common cases
 * - a signed-out visitor hitting `/`, a signed-in one hitting `/login` - never
 * paint the wrong screen first.
 */

const AUTH_ROUTES = ['/login', '/register']

export function proxy(request: NextRequest): NextResponse {
  const signedIn = request.cookies.has(SESSION_COOKIE)
  const isAuthRoute = AUTH_ROUTES.includes(request.nextUrl.pathname)

  if (signedIn && isAuthRoute) return NextResponse.redirect(new URL('/', request.url))
  if (!signedIn && !isAuthRoute) return NextResponse.redirect(new URL('/login', request.url))

  return NextResponse.next()
}

export const config = {
  /**
   * Everything except Next's own internals, files with an extension, and route
   * handlers - a fetch for JSON should get its status, not a redirect to an
   * HTML login page.
   */
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.[^/]+$).*)'],
}
