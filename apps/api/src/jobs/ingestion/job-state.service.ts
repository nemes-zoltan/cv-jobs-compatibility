import { TERMINAL_JOB_STATUSES } from '@cv-jobs-compatibility/constants'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { and, eq, notInArray, sql } from 'drizzle-orm'
import { PgBoss, fromDrizzle } from 'pg-boss'
import { DRIZZLE } from '../../database/database.constants'
import type { Database } from '../../database/database.module'
import { type JobRow, jobs } from '../../database/schema'
import { JOB_INSIGHTS_JOB_OPTIONS, PG_BOSS, QUEUES } from '../../queue/queue.constants'
import { TelemetryService } from '../../telemetry/telemetry.service'

/**
 * Every write to `jobs.status` the pipeline makes.
 *
 * Gathered here so the statuses move in one place: the steps report what
 * happened and this decides what the row should say, rather than three services
 * each holding an opinion about what `analyzing` means.
 */
@Injectable()
export class JobStateService {
  private readonly logger = new Logger(JobStateService.name)

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(PG_BOSS) private readonly boss: PgBoss,
    private readonly telemetry: TelemetryService,
  ) {}

  /**
   * Takes ownership of a posting, or reports that there is nothing to do.
   *
   * A job can arrive more than once - a retry after a timeout, a redelivery, or
   * the re-enqueue that rescues a posting nobody was working on - and the
   * status is what keeps that harmless. The update matches only rows that have
   * not finished, so a repeat of a completed posting changes nothing while one
   * interrupted part-way is picked up again.
   */
  async claim(jobId: string): Promise<JobRow | null> {
    const [claimed] = await this.db
      .update(jobs)
      .set({ status: 'analyzing' })
      .where(
        and(
          eq(jobs.id, jobId),
          // Spread because drizzle's overloads want a mutable array.
          notInArray(jobs.status, [...TERMINAL_JOB_STATUSES]),
        ),
      )
      .returning()

    if (claimed) {
      this.logger.log(`Reading posting ${jobId}`)
      return claimed
    }

    // Nothing matched: either the posting finished already, or the row is gone -
    // wiped in development, or swept once nobody had it saved. Neither is
    // retryable.
    const [existing] = await this.db
      .select({ status: jobs.status })
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .limit(1)

    this.logger.warn(
      existing
        ? `Posting ${jobId} is already ${existing.status}, dropping the job`
        : `Posting ${jobId} no longer exists, dropping the job`,
    )

    return null
  }

  /**
   * The posting is parsed, and the briefing is queued in the same breath.
   *
   * One transaction, because the alternative is a posting that is `ready` with
   * `insightsStatus` stuck at `pending` and nothing that will ever move it -
   * the exact dead state the extraction queue avoids by enqueueing inside the
   * insert. Insights failing later is fine; insights never being asked for is
   * not.
   */
  async markReady(jobId: string): Promise<void> {
    this.logger.log(`Posting ${jobId} is ready`)

    await this.db.transaction(async (tx) => {
      await tx
        .update(jobs)
        .set({ status: 'ready', failureReason: null, completedAt: new Date() })
        .where(eq(jobs.id, jobId))

      await this.boss.send(
        QUEUES.jobInsights,
        { jobId, ...this.telemetry.carrier() },
        { ...JOB_INSIGHTS_JOB_OPTIONS, db: fromDrizzle(tx, sql) },
      )
    })
  }

  /**
   * Readable text that is not a usable job posting: something else entirely, a
   * careers page listing several roles, or one the model accepted but read
   * nothing gradeable out of.
   *
   * Distinct from `failed`: the user is being asked for different text, not for
   * another attempt. The model's own account of what it was is not stored here -
   * it belongs to the extraction row, and it is written about text a stranger
   * pasted, so it never reaches a screen.
   */
  markRejected(jobId: string): Promise<unknown> {
    return this.finish(jobId, 'rejected')
  }

  /**
   * The pipeline could not finish and trying again would not help.
   *
   * `failureReason` is a code, not a sentence: the browser maps it to wording,
   * and the detail worth reading goes to the log.
   */
  async markFailed(jobId: string, code: string, detail: string): Promise<void> {
    this.logger.warn(`Posting ${jobId} failed: ${detail}`)

    await this.finish(jobId, 'failed', code)
  }

  /**
   * The queue has run out of retries.
   *
   * Without this the row keeps whatever status the last attempt left it on -
   * `analyzing` forever, with the failure recorded only in pg-boss's own table
   * where nothing the user can see will ever read it.
   */
  async markAbandoned(jobId: string, detail: string): Promise<void> {
    this.logger.error(`Posting ${jobId} abandoned after the last retry: ${detail}`)

    await this.finish(jobId, 'failed', 'internal_error')
  }

  private finish(jobId: string, status: 'ready' | 'rejected' | 'failed', failureReason?: string) {
    return this.db
      .update(jobs)
      .set({ status, failureReason: failureReason ?? null, completedAt: new Date() })
      .where(eq(jobs.id, jobId))
  }
}
