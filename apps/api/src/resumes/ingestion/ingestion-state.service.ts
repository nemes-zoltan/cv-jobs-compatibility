import { TERMINAL_RESUME_INGESTION_STATUSES } from '@cv-jobs-compatibility/constants'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { and, eq, notInArray } from 'drizzle-orm'
import { DRIZZLE } from '../../database/database.constants'
import type { Database } from '../../database/database.module'
import { type ResumeIngestionRow, resumeIngestions } from '../../database/schema'

/**
 * Every write to `resume_ingestions` the pipeline makes.
 *
 * Gathered here so the statuses move in one place: the steps report what
 * happened and this decides what the row should say, rather than four services
 * each holding an opinion about what `analyzing` means.
 */
@Injectable()
export class IngestionStateService {
  private readonly logger = new Logger(IngestionStateService.name)

  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Takes ownership of an ingestion, or reports that there is nothing to do.
   *
   * A job can arrive more than once - a retry after a timeout, a redelivery -
   * and the status is what keeps that harmless. The update matches only rows
   * that have not finished, so a repeat of a completed ingestion changes
   * nothing, while one interrupted part-way is picked up again.
   */
  async claim(ingestionId: string): Promise<ResumeIngestionRow | null> {
    const [claimed] = await this.db
      .update(resumeIngestions)
      .set({ status: 'extracting' })
      .where(
        and(
          eq(resumeIngestions.id, ingestionId),
          // Spread because drizzle's overloads want a mutable array.
          notInArray(resumeIngestions.status, [...TERMINAL_RESUME_INGESTION_STATUSES]),
        ),
      )
      .returning()

    if (claimed) return claimed

    // Nothing matched: either the ingestion finished already, or the row is
    // gone - wiped in development, or its owner deleted it. Neither is
    // retryable.
    const [existing] = await this.db
      .select({ status: resumeIngestions.status })
      .from(resumeIngestions)
      .where(eq(resumeIngestions.id, ingestionId))
      .limit(1)

    this.logger.warn(
      existing
        ? `Ingestion ${ingestionId} is already ${existing.status}, dropping the job`
        : `Ingestion ${ingestionId} no longer exists, dropping the job`,
    )

    return null
  }

  /** The model call is about to start. */
  markAnalyzing(ingestionId: string): Promise<unknown> {
    return this.db
      .update(resumeIngestions)
      .set({ status: 'analyzing' })
      .where(eq(resumeIngestions.id, ingestionId))
  }

  markReady(ingestionId: string): Promise<unknown> {
    return this.finish(ingestionId, 'ready')
  }

  /**
   * A readable document that is not a CV. Distinct from `failed`: the user is
   * being asked for a different file, not for another attempt.
   *
   * The model's own account of what the document was is not stored here - it
   * belongs to the extraction row, and it is written about a document a stranger
   * supplied, so it never reaches a screen.
   */
  markRejected(ingestionId: string): Promise<unknown> {
    return this.finish(ingestionId, 'rejected')
  }

  /**
   * The pipeline could not finish and trying again would not help.
   *
   * `failureReason` is a code, not a sentence: the browser maps it to wording,
   * and the detail worth reading goes to the log.
   */
  async markFailed(ingestion: ResumeIngestionRow, code: string, detail: string): Promise<void> {
    this.logger.warn(`Ingestion ${ingestion.id} failed (${ingestion.filename}): ${detail}`)

    await this.finish(ingestion.id, 'failed', code)
  }

  /**
   * The queue has run out of retries.
   *
   * Without this the row keeps whatever status it had when the last attempt
   * threw - `analyzing` forever, with the failure recorded only in pg-boss's own
   * table where nothing the user can see will ever read it.
   */
  async markAbandoned(ingestionId: string, detail: string): Promise<void> {
    this.logger.error(`Ingestion ${ingestionId} abandoned after the last retry: ${detail}`)

    await this.finish(ingestionId, 'failed', 'internal_error')
  }

  private finish(ingestionId: string, status: 'ready' | 'rejected' | 'failed', failureReason?: string) {
    return this.db
      .update(resumeIngestions)
      .set({ status, failureReason: failureReason ?? null, completedAt: new Date() })
      .where(eq(resumeIngestions.id, ingestionId))
  }
}
