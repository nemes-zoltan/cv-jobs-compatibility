/**
 * Failures the pipeline records rather than retries.
 *
 * The distinction runs through every step: a failure that a later attempt could
 * survive is thrown as itself and reaches pg-boss, which retries it. One that
 * would repeat identically - an unreadable file, a document that is not a CV -
 * is raised as this, and the orchestrator ends the ingestion instead.
 */
export class TerminalIngestionError extends Error {
  constructor(
    /** Goes to the log. Never shown to anyone. */
    readonly detail: string,
    /** Stored on the row. A code the browser maps to its own wording. */
    readonly code = 'invalid_resume',
  ) {
    super(detail)
    this.name = 'TerminalIngestionError'
  }
}
