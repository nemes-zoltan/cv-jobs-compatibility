import { STALLED_JOB_SECONDS, TERMINAL_JOB_STATUSES } from '@cv-jobs-compatibility/constants'
import type { JobListResponse, JobModel, JobSummaryModel } from '@cv-jobs-compatibility/types'
import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { and, asc, count, desc, eq, notInArray, sql } from 'drizzle-orm'
import { PgBoss, fromDrizzle } from 'pg-boss'
import { DRIZZLE } from '../database/database.constants'
import type { Database } from '../database/database.module'
import {
  type JobRow,
  jobFlags,
  jobInsights,
  jobMatches,
  jobRequirements,
  jobSkills,
  jobTexts,
  jobs,
  resumes,
  savedJobs,
} from '../database/schema'
import {
  JOB_EXTRACTION_JOB_OPTIONS,
  JOB_INSIGHTS_JOB_OPTIONS,
  PG_BOSS,
  QUEUES,
} from '../queue/queue.constants'
import type { CreateJobDto } from './dto/create-job.dto'
import type { ListJobsDto } from './dto/list-jobs.dto'
import { TelemetryService } from '../telemetry/telemetry.service'
import { hashJobText } from './job-text'
import { type SavedJobRows, toJobModel, toJobSummaryModel } from './job.mapper'

/** Postgres' unique-violation SQLSTATE. */
const UNIQUE_VIOLATION = '23505'

/**
 * Stands in for the CV of an account that has none, so the join for scores is
 * written once rather than branched around. It matches nothing, which is the
 * correct answer: no CV, no scores.
 */
const NO_RESUME = '00000000-0000-0000-0000-000000000000'

/**
 * Job postings, from the caller's point of view.
 *
 * The distinction that runs through every method: a posting belongs to nobody
 * and a `saved_jobs` row belongs to somebody. So reads always start from
 * `saved_jobs` - it is what makes a posting reachable at all, and joining
 * outwards from it is what keeps one account from seeing another's list by
 * guessing an id. Removing a posting deletes only that row.
 */
@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name)

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(PG_BOSS) private readonly boss: PgBoss,
    private readonly telemetry: TelemetryService,
  ) {}

  /**
   * Registers a pasted advert against the caller.
   *
   * Three outcomes, in order of how often they happen: the advert is new and
   * gets parsed; somebody has already added it, so the existing posting is
   * linked and no model is paid twice; or the caller already had it, and this
   * is a no-op that returns what they had.
   *
   * One at a time, per account. Parsing costs a model call, and a paste box
   * that accepts ten at once is a paste box that spends ten.
   */
  async create(userId: string, dto: CreateJobDto): Promise<JobSummaryModel> {
    const pending = await this.findPending(userId)
    if (pending) {
      throw new ConflictException('One posting is still being read. Wait for it to finish, or remove it.')
    }

    const contentHash = hashJobText(dto.text)

    const existing = await this.findByHash(contentHash)
    if (existing) return this.save(userId, existing, dto.sourceUrl)

    try {
      const job = await this.db.transaction(async (tx) => {
        // Everything about this posting is written together: the row, the text
        // the worker will read, the link that makes it visible, and the queued
        // job. pg-boss keeps its jobs in this same database, so `fromDrizzle`
        // puts the enqueue inside our transaction - they commit together, and
        // neither a posting nobody will read nor a job for a row that does not
        // exist is reachable.
        const [inserted] = await tx.insert(jobs).values({ contentHash }).returning()

        await tx.insert(jobTexts).values({
          jobId: inserted.id,
          content: dto.text,
          charCount: dto.text.length,
        })

        await tx.insert(savedJobs).values({
          userId,
          jobId: inserted.id,
          sourceUrl: dto.sourceUrl ?? null,
        })

        const queueJobId = await this.boss.send(
          QUEUES.jobExtraction,
          { jobId: inserted.id, ...this.telemetry.carrier() },
          { ...JOB_EXTRACTION_JOB_OPTIONS, db: fromDrizzle(tx, sql) },
        )

        const [withJob] = await tx
          .update(jobs)
          .set({ queueJobId })
          .where(eq(jobs.id, inserted.id))
          .returning()

        return withJob
      })

      return toJobSummaryModel({
        job,
        savedAt: job.createdAt,
        sourceUrl: dto.sourceUrl ?? null,
        match: null,
      })
    } catch (error) {
      // Two people pasting one advert at the same moment: the unique index on
      // the hash rejects the loser and its transaction rolls back. The posting
      // the winner created is the one both of them should be looking at.
      if (!isUniqueViolation(error)) throw error

      const raced = await this.findByHash(contentHash)
      if (!raced) throw error

      this.logger.log(`Posting ${raced.id} was created concurrently; linking to it instead`)

      return this.save(userId, raced, dto.sourceUrl)
    }
  }

  /** The caller's list, newest addition first. */
  async findAll(userId: string, query: ListJobsDto): Promise<JobListResponse> {
    const resumeId = await this.resumeIdFor(userId)

    const [rows, [totals]] = await Promise.all([
      this.db
        .select({
          job: jobs,
          savedAt: savedJobs.createdAt,
          sourceUrl: savedJobs.sourceUrl,
          match: jobMatches,
        })
        .from(savedJobs)
        .innerJoin(jobs, eq(jobs.id, savedJobs.jobId))
        // Left, because most postings have no score and a card still has to
        // render - "not scored" is the normal state, not a missing row.
        .leftJoin(
          jobMatches,
          and(eq(jobMatches.jobId, savedJobs.jobId), eq(jobMatches.resumeId, resumeId)),
        )
        .where(eq(savedJobs.userId, userId))
        .orderBy(desc(savedJobs.createdAt))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      this.db
        .select({ total: count() })
        .from(savedJobs)
        .where(eq(savedJobs.userId, userId)),
    ])

    return {
      items: rows.map(toJobSummaryModel),
      total: totals.total,
      page: query.page,
      pageSize: query.pageSize,
    }
  }

  /**
   * One posting, whole. `404` rather than `403` for one the caller has not
   * saved: whether a posting exists is not theirs to learn.
   */
  async findOne(userId: string, id: string): Promise<JobModel> {
    const saved = await this.findSaved(userId, id)
    if (!saved) throw new NotFoundException('No such posting')

    // Separate queries rather than a join: these are independent lists, and
    // joining them would multiply each by the others and leave the mapper to
    // undo it. They run together.
    const [requirements, skills, [insights], flags] = await Promise.all([
      this.db
        .select()
        .from(jobRequirements)
        .where(eq(jobRequirements.jobId, id))
        .orderBy(asc(jobRequirements.orderIndex)),
      this.db
        .select()
        .from(jobSkills)
        .where(eq(jobSkills.jobId, id))
        .orderBy(asc(jobSkills.orderIndex)),
      this.db.select().from(jobInsights).where(eq(jobInsights.jobId, id)).limit(1),
      this.db
        .select()
        .from(jobFlags)
        .where(eq(jobFlags.jobId, id))
        .orderBy(asc(jobFlags.orderIndex)),
    ])

    return toJobModel({ ...saved, requirements, skills, insights, flags })
  }

  /**
   * The posting the create page should still be watching, if any.
   *
   * Deliberately not bounded by age. One stranded by a worker that died is
   * exactly what the browser needs to see, so it can say so and offer to remove
   * it - hiding it here would leave the page offering a paste box for a slot
   * that is still occupied.
   */
  async findPending(userId: string): Promise<JobSummaryModel | null> {
    const [row] = await this.db
      .select({
        job: jobs,
        savedAt: savedJobs.createdAt,
        sourceUrl: savedJobs.sourceUrl,
        // A posting still being read has never been scored; the column is here
        // only because the shape a card renders demands it.
        match: sql<null>`null`,
      })
      .from(savedJobs)
      .innerJoin(jobs, eq(jobs.id, savedJobs.jobId))
      .where(
        and(
          eq(savedJobs.userId, userId),
          // Spread because drizzle's overloads want a mutable array.
          notInArray(jobs.status, [...TERMINAL_JOB_STATUSES]),
        ),
      )
      .orderBy(desc(savedJobs.createdAt))
      .limit(1)

    return row ? toJobSummaryModel(row) : null
  }

  /**
   * Asks for the briefing again.
   *
   * The manual way out of a briefing that ran out of retries. Backoff answers a
   * timeout or a 503; it does nothing for an exhausted quota or a rate limit,
   * where the fix is a person changing something and deciding to try again.
   *
   * Allowed from any state once the posting has parsed, including `ready` -
   * re-running it is a refresh, and the row is replaced wholesale either way.
   * There is no in-progress status to guard against a double run, so the worst
   * case is paying for one call twice, which is the caller's own quota.
   */
  async retryInsights(userId: string, id: string): Promise<JobModel> {
    const saved = await this.findSaved(userId, id)
    if (!saved) throw new NotFoundException('No such posting')

    if (saved.job.status !== 'ready') {
      throw new ConflictException('This posting has not been read yet, so there is nothing to brief.')
    }

    await this.db.transaction(async (tx) => {
      await tx.update(jobs).set({ insightsStatus: 'pending' }).where(eq(jobs.id, id))

      await this.boss.send(
        QUEUES.jobInsights,
        { jobId: id, ...this.telemetry.carrier() },
        { ...JOB_INSIGHTS_JOB_OPTIONS, db: fromDrizzle(tx, sql) },
      )
    })

    this.logger.log(`Re-queued the briefing for posting ${id}`)

    return this.findOne(userId, id)
  }

  /**
   * Takes a posting off the caller's list.
   *
   * Only the link goes. The posting, its text and whatever was parsed out of it
   * stay: somebody else may be tracking the same advert, and re-adding it later
   * should not pay for a second reading.
   */
  async remove(userId: string, id: string): Promise<void> {
    const [deleted] = await this.db
      .delete(savedJobs)
      .where(and(eq(savedJobs.userId, userId), eq(savedJobs.jobId, id)))
      .returning()

    if (!deleted) throw new NotFoundException('No such posting')
  }

  /**
   * Puts an existing posting on the caller's list, or leaves it where it is.
   *
   * Adding one twice is not an error - the second attempt is somebody pasting
   * an advert they forgot they had, and the honest answer is the one they
   * already own.
   */
  private async save(userId: string, job: JobRow, sourceUrl?: string): Promise<JobSummaryModel> {
    const [inserted] = await this.db
      .insert(savedJobs)
      .values({ userId, jobId: job.id, sourceUrl: sourceUrl ?? null })
      .onConflictDoNothing()
      .returning()

    const revived = await this.requeueIfAbandoned(job)

    if (inserted) {
      // Newly on this list, so unscored by definition - somebody else's score
      // against their CV says nothing about this one.
      return toJobSummaryModel({
        job: revived,
        savedAt: inserted.createdAt,
        sourceUrl: inserted.sourceUrl,
        match: null,
      })
    }

    const saved = await this.findSaved(userId, job.id)
    if (!saved) throw new NotFoundException('No such posting')

    return toJobSummaryModel(saved)
  }

  /**
   * Puts a posting back on the queue when nothing is going to move it.
   *
   * Two cases. One that `failed` deserves another attempt, and because postings
   * are shared, the person pasting it today gets the retry that yesterday's
   * reader never had. One that is unfinished but has not moved in
   * `STALLED_JOB_SECONDS` has no live worker behind it - typically because
   * whoever added it removed it and left the row unreferenced, with the queued
   * job long expired.
   *
   * Never for `rejected`. That verdict is deterministic, and re-running buys the
   * same answer for the same money.
   *
   * The status goes back to `queued` in both cases: `claim` refuses a row that
   * has finished, so a `failed` one would otherwise be re-queued and
   * immediately dropped, and resetting also restarts the clock the stall
   * window is measured against.
   */
  private async requeueIfAbandoned(job: JobRow): Promise<JobRow> {
    if (job.status === 'ready' || job.status === 'rejected') return job

    const idleFor = Date.now() - job.updatedAt.getTime()
    if (job.status !== 'failed' && idleFor < STALLED_JOB_SECONDS * 1000) return job

    this.logger.log(`Re-queueing posting ${job.id} (was ${job.status}, idle ${Math.round(idleFor / 1000)}s)`)

    return this.db.transaction(async (tx) => {
      const queueJobId = await this.boss.send(
        QUEUES.jobExtraction,
        { jobId: job.id, ...this.telemetry.carrier() },
        { ...JOB_EXTRACTION_JOB_OPTIONS, db: fromDrizzle(tx, sql) },
      )

      const [requeued] = await tx
        .update(jobs)
        .set({ status: 'queued', failureReason: null, completedAt: null, queueJobId })
        .where(eq(jobs.id, job.id))
        .returning()

      return requeued
    })
  }

  private async findSaved(userId: string, jobId: string): Promise<SavedJobRows | undefined> {
    const resumeId = await this.resumeIdFor(userId)

    const [row] = await this.db
      .select({
        job: jobs,
        savedAt: savedJobs.createdAt,
        sourceUrl: savedJobs.sourceUrl,
        match: jobMatches,
      })
      .from(savedJobs)
      .innerJoin(jobs, eq(jobs.id, savedJobs.jobId))
      .leftJoin(
        jobMatches,
        and(eq(jobMatches.jobId, savedJobs.jobId), eq(jobMatches.resumeId, resumeId)),
      )
      .where(and(eq(savedJobs.userId, userId), eq(savedJobs.jobId, jobId)))
      .limit(1)

    return row
  }

  /**
   * The CV every score on this account is measured against.
   *
   * One per account today. When that becomes several, this becomes "the active
   * one" and nothing above it changes.
   */
  private async resumeIdFor(userId: string): Promise<string> {
    const [resume] = await this.db
      .select({ id: resumes.id })
      .from(resumes)
      .where(eq(resumes.userId, userId))
      .limit(1)

    return resume?.id ?? NO_RESUME
  }

  private async findByHash(contentHash: string): Promise<JobRow | undefined> {
    const [row] = await this.db
      .select()
      .from(jobs)
      .where(eq(jobs.contentHash, contentHash))
      .limit(1)

    return row
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === UNIQUE_VIOLATION
  )
}
