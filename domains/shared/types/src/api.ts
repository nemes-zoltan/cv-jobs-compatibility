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

import type { ResumeIngestionModel, ResumeModel, UserModel } from './models'

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

/**
 * `POST /api/resumes/ingestions/upload-url` → `201`
 *
 * Signs a URL the browser `PUT`s to directly. Records nothing, so an abandoned
 * upload leaves no half-created resume behind.
 */
export interface CreateUploadUrlRequest {
  /** For display. The API mints the key; the client never chooses it. */
  filename: string
  /** One of `RESUME_CONTENT_TYPES`, and must match the eventual `PUT`. */
  contentType: string
  /** Checked against `MAX_RESUME_BYTES` before a URL is issued. */
  sizeBytes: number
}

export interface CreateUploadUrlResponse {
  key: string
  uploadUrl: string
  /** ISO-8601. After this a new URL has to be minted. */
  expiresAt: string
}

/**
 * `POST /api/resumes/ingestions` → `201`
 *
 * The browser reporting that its `PUT` succeeded. Every field is a claim the
 * API re-checks against the object that actually landed.
 *
 * Repeating the request with a key already registered returns that upload
 * rather than creating a second one, so a retry after a lost response is safe.
 */
export interface CreateResumeIngestionRequest {
  key: string
  filename: string
  contentType: string
  sizeBytes: number
}

export type CreateResumeIngestionResponse = ResumeIngestionModel

/** `GET /api/resumes/ingestions/:id` → `200`, or `404` for anyone but its owner. */
export type ResumeIngestionResponse = ResumeIngestionModel

/**
 * `GET /api/resumes/ingestions/pending` → `200`
 *
 * The upload still being processed, so a page can resume polling after a
 * reload instead of offering a second upload. `null` when there is none.
 *
 * Only recent uploads count: one abandoned by a worker that died must not lock
 * its owner out of trying again.
 */
export type PendingResumeIngestionResponse = ResumeIngestionModel | null

/**
 * `DELETE /api/resumes/ingestions/:id` → `204`
 *
 * Removes the upload, whatever it produced, and the stored file. The way out of
 * a rejected CV or one whose processing stalled, and the way to replace a CV
 * that is already in.
 */
export type DeleteResumeIngestionResponse = void

/**
 * `GET /api/resumes/me` → `200`, or `404` before a CV has been through.
 *
 * The whole parsed CV in one response: one account has at most one, and the one
 * page that shows it needs all of it.
 */
export type MyResumeResponse = ResumeModel

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
