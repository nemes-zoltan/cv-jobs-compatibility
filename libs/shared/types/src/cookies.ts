/**
 * The one cookie name a client needs to know.
 *
 * The token cookies are the API's own business: a browser sends them without
 * being asked and nothing outside the API ever names them. This one is
 * different - the web app's middleware reads it on every request to decide
 * between rendering a page and redirecting to the login form - so the name is
 * part of the contract rather than an implementation detail, and lives here
 * where a rename breaks both sides at once instead of silently breaking
 * routing.
 *
 * It carries no credential. See `auth-cookies.ts` in the API for what it is
 * and what it deliberately is not.
 */
export const SESSION_COOKIE = 'session'
