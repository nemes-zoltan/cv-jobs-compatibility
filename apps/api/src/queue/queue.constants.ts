/** Injection token for the pg-boss instance. */
export const PG_BOSS = Symbol('PG_BOSS')

/**
 * The Postgres schema pg-boss owns. Not configurable: it is baked into the
 * migration that installs it, so the two would have to change together.
 */
export const PG_BOSS_SCHEMA = 'pgboss'

/** Every queue in the system. Names are part of the contract between the API
 * and the worker, so they live here rather than as string literals. */
export const QUEUES = {
  resumeIngestion: 'resume-ingestion',
} as const

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES]

/** The payload of a `resume-ingestion` job. The worker re-reads everything else
 * from the row - the owner especially is never taken from here. */
export interface ResumeIngestionJob {
  ingestionId: string
}

/**
 * Retries are for failures that a later attempt could survive - storage
 * timeouts, a rate-limited model. A file we cannot read fails identically every
 * time, so the handler marks those terminal itself and returns rather than
 * throwing; only what throws reaches these settings.
 */
export const RESUME_INGESTION_JOB_OPTIONS = {
  retryLimit: 3,
  retryBackoff: true,
  retryDelay: 5,
  /** Long enough for a download plus a model call before the job is retried. */
  expireInSeconds: 120,
} as const
