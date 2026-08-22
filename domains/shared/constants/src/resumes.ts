/**
 * What counts as an acceptable resume upload, and the states one moves through.
 *
 * Contract constants rather than API configuration, so the browser's checks and
 * the API's cannot drift apart.
 */

/** Every entry is a text extractor someone has to own, hence only two. */
export const RESUME_CONTENT_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const

export type ResumeContentType = (typeof RESUME_CONTENT_TYPES)[number]

/** File extensions matching `RESUME_CONTENT_TYPES`, for an `accept` attribute. */
export const RESUME_FILE_EXTENSIONS = ['.pdf', '.docx'] as const

/** Far above any honest CV, small enough that a rejection costs little time. */
export const MAX_RESUME_BYTES = 10 * 1024 * 1024

export const MAX_RESUME_FILENAME_LENGTH = 255

export function isResumeContentType(value: string): value is ResumeContentType {
  return (RESUME_CONTENT_TYPES as readonly string[]).includes(value)
}

/**
 * The pipeline an uploaded file moves through, in order.
 *
 * Declared here rather than only as a drizzle `pgEnum` because three consumers
 * need the same strings: Postgres, the API, and the browser rendering progress.
 * The schema imports this, so the column and the union cannot drift.
 *
 * `rejected` and `failed` are both terminal but mean different things to the
 * user: a valid file that is not a CV, versus our pipeline giving up. One asks
 * for a different file, the other for a retry.
 */
export const RESUME_INGESTION_STATUSES = [
  'uploaded',
  'extracting',
  'analyzing',
  'ready',
  'rejected',
  'failed',
] as const

export type ResumeIngestionStatus = (typeof RESUME_INGESTION_STATUSES)[number]

/** Statuses the pipeline never leaves. */
export const TERMINAL_RESUME_INGESTION_STATUSES = ['ready', 'rejected', 'failed'] as const

export type TerminalResumeIngestionStatus = (typeof TERMINAL_RESUME_INGESTION_STATUSES)[number]

/**
 * How long an upload may go without progress before the browser offers a way
 * out of it.
 *
 * Nothing rewrites the row and the API does not apply this at all - an upload
 * that stalls stays pending until someone deletes it. This only decides when a
 * page stops saying "working" and starts offering the delete button, so a
 * worker that died does not leave its owner watching a spinner forever.
 *
 * Measured from the last status change rather than from the upload, so a slow
 * step is not mistaken for a dead one.
 */
export const STALLED_RESUME_UPLOAD_SECONDS = 3 * 60

export function isTerminalResumeIngestionStatus(
  status: ResumeIngestionStatus,
): status is TerminalResumeIngestionStatus {
  return (TERMINAL_RESUME_INGESTION_STATUSES as readonly string[]).includes(status)
}
