/**
 * Failures a pipeline records rather than retries.
 *
 * The distinction runs through every step of both pipelines: a failure that a
 * later attempt could survive is thrown as itself and reaches pg-boss, which
 * retries it. One that would repeat identically - an unreadable file, text that
 * is not a job posting, output that is not JSON - is raised as this, and the
 * orchestrator ends the run instead. Retrying those spends two more minutes
 * arriving at the same answer.
 *
 * Shared rather than declared twice because the meaning is the same on both
 * sides; only the codes differ.
 */
export class TerminalIngestionError extends Error {
  constructor(
    /** Goes to the log. Never shown to anyone. */
    readonly detail: string,
    /** Stored on the row. A code the browser maps to its own wording. */
    readonly code = 'invalid_document',
  ) {
    super(detail)
    this.name = 'TerminalIngestionError'
  }
}
