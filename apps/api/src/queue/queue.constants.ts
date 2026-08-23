import type { JobTraceCarrier } from '../telemetry/telemetry.service'

/** Injection token for the pg-boss instance. */
export const PG_BOSS = Symbol('PG_BOSS')

/**
 * The Postgres schema pg-boss owns. Not configurable: it is baked into the
 * migration that installs it, so the two would have to change together.
 */
export const PG_BOSS_SCHEMA = 'pgboss'

/**
 * Every queue in the system. Names are part of the contract between the API and
 * the worker, so they live here rather than as string literals.
 *
 * Every payload below extends `JobTraceCarrier`: the enqueueing request's trace
 * travels with the job, so the worker's spans continue the trace that caused
 * them rather than starting an unrelated one minutes later.
 */
export const QUEUES = {
  resumeIngestion: 'resume-ingestion',
  jobExtraction: 'job-extraction',
  jobInsights: 'job-insights',
  jobMatch: 'job-match',
} as const

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES]

/** The payload of a `resume-ingestion` job. The worker re-reads everything else
 * from the row - the owner especially is never taken from here. */
export interface ResumeIngestionJob extends JobTraceCarrier {
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

/**
 * The payload of a `job-extraction` job. Like the resume queue, it carries an
 * id and nothing else - everything the handler needs is re-read from the row,
 * so a payload that has gone stale cannot make it act on the wrong data.
 */
export interface JobExtractionJob extends JobTraceCarrier {
  jobId: string
}

/**
 * Shorter than the resume equivalent: there is no file to fetch and no text to
 * extract, so one attempt is a model call and a handful of inserts.
 */
export const JOB_EXTRACTION_JOB_OPTIONS = {
  retryLimit: 3,
  retryBackoff: true,
  retryDelay: 5,
  expireInSeconds: 90,
} as const

/** The payload of a `job-insights` job. Enqueued once extraction succeeds. */
export interface JobInsightsJob extends JobTraceCarrier {
  jobId: string
}

/**
 * Longer and less persistent than extraction. Longer because the call searches
 * the web before it answers; less persistent because insights are advisory - a
 * posting whose briefing never arrives is still parsed and still scoreable, so
 * this is not worth four attempts.
 */
export const JOB_INSIGHTS_JOB_OPTIONS = {
  retryLimit: 2,
  retryBackoff: true,
  retryDelay: 10,
  expireInSeconds: 180,
} as const

/**
 * The payload of a `job-match` job.
 *
 * The match row exists before the job does - it is created queued, in the same
 * transaction - so this carries its id and the handler re-reads both documents
 * from it. Nothing about who or what is being compared travels in the payload.
 */
export interface JobMatchJob extends JobTraceCarrier {
  matchId: string
}

/**
 * A person is watching this one, having pressed a button and waited. Two
 * attempts and no more: a third would keep them looking at a spinner for the
 * best part of a minute to reach the same answer.
 */
export const JOB_MATCH_JOB_OPTIONS = {
  retryLimit: 2,
  retryBackoff: true,
  retryDelay: 5,
  expireInSeconds: 120,
} as const
