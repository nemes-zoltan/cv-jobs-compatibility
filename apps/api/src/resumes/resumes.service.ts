import type { ResumeModel } from '@cv-jobs-compatibility/types'
import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { asc, eq } from 'drizzle-orm'
import { DRIZZLE } from '../database/database.constants'
import type { Database } from '../database/database.module'
import {
  resumeEducation,
  resumeExperiences,
  resumeProjects,
  resumeSkills,
  resumes,
} from '../database/schema'
import { toResumeModel } from './resume.mapper'

/**
 * The finished article. Everything about getting one belongs to
 * `ResumeIngestionsService`.
 */
@Injectable()
export class ResumesService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * The caller's CV, whole.
   *
   * Five queries rather than one join: the children are independent lists, and
   * joining them would multiply every experience by every skill and leave the
   * mapper to undo it. They run together, and at one CV per account the row
   * counts are small enough that the round trips are the cheaper end of the
   * trade.
   */
  async findForUser(userId: string): Promise<ResumeModel> {
    const [resume] = await this.db
      .select()
      .from(resumes)
      .where(eq(resumes.userId, userId))
      .limit(1)

    if (!resume) throw new NotFoundException('No CV yet')

    const [experiences, education, skills, projects] = await Promise.all([
      this.db
        .select()
        .from(resumeExperiences)
        .where(eq(resumeExperiences.resumeId, resume.id))
        .orderBy(asc(resumeExperiences.orderIndex)),
      this.db
        .select()
        .from(resumeEducation)
        .where(eq(resumeEducation.resumeId, resume.id))
        .orderBy(asc(resumeEducation.orderIndex)),
      this.db
        .select()
        .from(resumeSkills)
        .where(eq(resumeSkills.resumeId, resume.id))
        .orderBy(asc(resumeSkills.orderIndex)),
      this.db
        .select()
        .from(resumeProjects)
        .where(eq(resumeProjects.resumeId, resume.id))
        .orderBy(asc(resumeProjects.orderIndex)),
    ])

    return toResumeModel({ resume, experiences, education, skills, projects })
  }
}
