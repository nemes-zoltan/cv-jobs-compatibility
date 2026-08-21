/**
 * Request and response bodies for every endpoint the API exposes.
 *
 * This is the contract both sides compile against: the API's DTOs implement the
 * request types and its handlers return the response types, so a change here
 * breaks whichever side has not caught up.
 *
 * Endpoints that authenticate do so with cookies, never with a body field -
 * tokens appear nowhere in these types by design.
 */

import type { UserModel } from './models'

/** `POST /api/auth/register` → `201` */
export interface RegisterRequest {
  email: string
  password: string
  name: string
}

export type RegisterResponse = UserModel

/** `POST /api/auth/login` → `200` */
export interface LoginRequest {
  email: string
  password: string
}

export type LoginResponse = UserModel

/**
 * `POST /api/auth/refresh` → `204`
 *
 * No request or response body. The refresh token arrives as a cookie and the
 * new access token leaves as a `Set-Cookie` header.
 */
export type RefreshResponse = void

/** `POST /api/auth/logout` → `204`. No body either way; the effect is on cookies. */
export type LogoutResponse = void

/** `GET /api/auth/me` → `200` */
export type MeResponse = UserModel

/** `GET /api/health` → `200`, or `503` carrying the same shape when degraded. */
export interface HealthResponse {
  status: 'ok' | 'degraded'
  services: {
    database: 'up' | 'down'
  }
}

/** `GET /api` → `200` */
export interface AppInfoResponse {
  message: string
}
