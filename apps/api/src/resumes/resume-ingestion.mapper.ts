import type { ResumeIngestionModel } from '@cv-jobs-compatibility/types'
import type { ResumeIngestionRow } from '../database/schema'

/**
 * The row holds the storage key and the pg-boss job id; neither is any of a
 * client's business, so the shape a client sees is built explicitly rather than
 * by spreading the row and deleting fields.
 */
export function toResumeIngestionModel(row: ResumeIngestionRow): ResumeIngestionModel {
  return {
    id: row.id,
    status: row.status,
    filename: row.filename,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  }
}
