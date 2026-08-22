import { randomUUID } from 'node:crypto'
import { TERMINAL_RESUME_INGESTION_STATUSES } from '@cv-jobs-compatibility/constants'
import type { ResumeIngestionModel } from '@cv-jobs-compatibility/types'
import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { and, desc, eq, notInArray, sql } from 'drizzle-orm'
import { PgBoss, fromDrizzle } from 'pg-boss'
import { DRIZZLE } from '../database/database.constants'
import type { Database } from '../database/database.module'
import { type ResumeIngestionRow, resumeIngestions } from '../database/schema'
import { PG_BOSS, QUEUES, RESUME_INGESTION_JOB_OPTIONS } from '../queue/queue.constants'
import { StorageService } from '../storage/storage.service'
import type { CreateResumeIngestionDto } from './dto/create-resume-ingestion.dto'
import { toResumeIngestionModel } from './resume-ingestion.mapper'

/** Postgres' unique-violation SQLSTATE. */
const UNIQUE_VIOLATION = '23505'

@Injectable()
export class ResumeIngestionsService {
  private readonly logger = new Logger(ResumeIngestionsService.name)

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(PG_BOSS) private readonly boss: PgBoss,
    private readonly storage: StorageService,
  ) {}

  /**
   * Records a finished upload and queues it for processing.
   *
   * The row and its job are written in one transaction. pg-boss keeps its jobs
   * in this same database, so `fromDrizzle` puts the enqueue inside ours - the
   * two commit together, and neither an ingestion nobody will process nor a job
   * for a row that does not exist is reachable.
   */
  async createUpload(userId: string, dto: CreateResumeIngestionDto): Promise<ResumeIngestionModel> {
    const existing = await this.findByStorageKey(dto.key)
    if (existing) return toResumeIngestionModel(existing)

    const stored = await this.storage.headObject(dto.key)
    if (!stored) {
      throw new BadRequestException('That upload could not be found. Please upload the file again.')
    }

    // The client's own numbers are believed only far enough to notice they
    // disagree with the object that actually landed.
    if (stored.sizeBytes !== dto.sizeBytes || stored.contentType !== dto.contentType) {
      this.logger.warn(
        `Upload ${dto.key} claimed ${dto.sizeBytes}B ${dto.contentType}, storage has ${stored.sizeBytes}B ${stored.contentType}`,
      )
      throw new BadRequestException('That upload does not match the file we received.')
    }

    const id = randomUUID()

    try {
      const row = await this.db.transaction(async (tx) => {
        const jobId = await this.boss.send(
          QUEUES.resumeIngestion,
          { ingestionId: id },
          { ...RESUME_INGESTION_JOB_OPTIONS, db: fromDrizzle(tx, sql) },
        )

        const [inserted] = await tx
          .insert(resumeIngestions)
          .values({
            id,
            userId,
            storageKey: dto.key,
            filename: dto.filename,
            contentType: stored.contentType,
            sizeBytes: stored.sizeBytes,
            jobId,
          })
          .returning()

        return inserted
      })

      return toResumeIngestionModel(row)
    } catch (error) {
      // Two confirmations of the same upload racing each other: the unique index
      // on the key rejects the loser, and the rollback takes its queued job with
      // it. Deliberately not `onConflictDoNothing`, which would swallow the
      // conflict, commit, and leave a second job behind.
      if (isUniqueViolation(error)) {
        const raced = await this.findByStorageKey(dto.key)
        if (raced) return toResumeIngestionModel(raced)
      }

      throw error
    }
  }

  /** The client polls this. `404` rather than `403` for someone else's id. */
  async findUpload(userId: string, id: string): Promise<ResumeIngestionModel> {
    const [row] = await this.db
      .select()
      .from(resumeIngestions)
      .where(and(eq(resumeIngestions.id, id), eq(resumeIngestions.userId, userId)))
      .limit(1)

    if (!row) throw new NotFoundException('No such upload')

    return toResumeIngestionModel(row)
  }

  /**
   * The upload a page should still be watching, if any.
   *
   * Deliberately not bounded by age. One stranded by a worker that died is
   * exactly what the browser needs to see, so it can say so and offer to delete
   * it - hiding it here would leave the page cheerfully offering an upload box
   * for a slot that is still occupied.
   */
  async findPendingUpload(userId: string): Promise<ResumeIngestionModel | null> {
    const [row] = await this.db
      .select()
      .from(resumeIngestions)
      .where(
        and(
          eq(resumeIngestions.userId, userId),
          // Spread because drizzle's overloads want a mutable array.
          notInArray(resumeIngestions.status, [...TERMINAL_RESUME_INGESTION_STATUSES]),
        ),
      )
      .orderBy(desc(resumeIngestions.createdAt))
      .limit(1)

    return row ? toResumeIngestionModel(row) : null
  }

  /**
   * Removes an upload and everything it produced.
   *
   * The row goes first and the object second. A delete that dies between them
   * leaves an unreferenced file, which is the same cheap orphan an abandoned
   * upload leaves; the other order would leave a resume pointing at a file that
   * is gone, which is worse.
   */
  async deleteUpload(userId: string, id: string): Promise<void> {
    const [deleted] = await this.db
      .delete(resumeIngestions)
      .where(and(eq(resumeIngestions.id, id), eq(resumeIngestions.userId, userId)))
      .returning()

    if (!deleted) throw new NotFoundException('No such upload')

    try {
      await this.storage.deleteObject(deleted.storageKey)
    } catch (error) {
      // The user asked for this gone and as far as they can tell it is. An
      // unreachable bucket is not worth failing the request over.
      this.logger.warn(`Deleted ingestion ${id} but could not remove ${deleted.storageKey}: ${error}`)
    }
  }

  private async findByStorageKey(key: string): Promise<ResumeIngestionRow | undefined> {
    const [row] = await this.db
      .select()
      .from(resumeIngestions)
      .where(eq(resumeIngestions.storageKey, key))
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
