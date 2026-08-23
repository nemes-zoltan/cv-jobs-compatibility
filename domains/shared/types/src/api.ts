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

import type {
  JobMatchModel,
  JobMatchSummaryModel,
  JobModel,
  JobSummaryModel,
  ResumeIngestionModel,
  ResumeModel,
  UserModel,
} from './models'

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

/**
 * `POST /api/jobs` → `201`
 *
 * Registers a pasted advert and puts it on the caller's list. The text is
 * hashed, so pasting one somebody else has already added links to the posting
 * that exists rather than parsing it a second time.
 *
 * `409` while the caller already has one being processed: parsing costs a model
 * call, and letting somebody queue ten at once is letting them spend ten.
 */
export interface CreateJobRequest {
  /** The advert, pasted. Between `MIN_JOB_TEXT_CHARS` and `MAX_JOB_TEXT_CHARS`. */
  text: string
  /** Optional, and only ever rendered as a link back. Never fetched. */
  sourceUrl?: string
}

export type CreateJobResponse = JobSummaryModel

/**
 * `GET /api/jobs?page=1&pageSize=12` → `200`
 *
 * The caller's list, newest addition first. Offset paging: the list is short,
 * ordered by something stable, and a page number is what the UI wants to show.
 */
export interface JobListResponse {
  items: JobSummaryModel[]
  /** Across every page, so a client can render "page 2 of 4". */
  total: number
  page: number
  pageSize: number
}

/** `GET /api/jobs/:id` → `200`, or `404` for a posting the caller has not saved. */
export type JobResponse = JobModel

/**
 * `GET /api/jobs/pending` → `200`
 *
 * The posting still being processed, so the create page can resume watching it
 * after a reload rather than offering a second one. `null` when there is none.
 *
 * Not bounded by age: one stranded by a worker that died is exactly what the
 * page needs to see, so it can say so and offer to remove it.
 */
export type PendingJobResponse = JobSummaryModel | null

/**
 * `POST /api/jobs/:id/insights` → `200`
 *
 * Asks for the briefing again. The one manual way out of a briefing that ran
 * out of retries - a rate-limited or out-of-quota model call fails in a way no
 * amount of backoff fixes, so the way back is a person deciding to try again.
 *
 * `409` before the posting itself has parsed: there is nothing to brief yet.
 */
export type RetryJobInsightsResponse = JobModel

/**
 * `POST /api/jobs/:id/match` → `201`
 *
 * Scores the posting against the caller's CV. Deliberately a thing a person
 * asks for rather than something that happens on its own: it is a model call
 * per posting, and after a new CV every posting would need one at once.
 *
 * Returns the match queued; the page polls it. Asking again while one is in
 * flight returns that one rather than starting a second. Asking again once it
 * has finished re-runs it.
 *
 * `409` before the posting has been read and its briefing has settled.
 */
export type CreateJobMatchResponse = JobMatchSummaryModel

/** `GET /api/jobs/:id/match` → `200`, or `404` when the posting has not been scored. */
export type JobMatchResponse = JobMatchModel

/**
 * `DELETE /api/jobs/:id` → `204`
 *
 * Removes the posting from the caller's list and nothing else. The posting
 * itself belongs to nobody and may be on someone else's.
 */
export type DeleteJobResponse = void

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
