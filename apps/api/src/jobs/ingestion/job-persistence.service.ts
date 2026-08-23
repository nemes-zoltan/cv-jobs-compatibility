import type { ExtractedJob } from '@cv-jobs-compatibility/prompt-schemas'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { DRIZZLE } from '../../database/database.constants'
import type { Database } from '../../database/database.module'
import { jobRequirements, jobSkills, jobs } from '../../database/schema'
import { dedupeSkills } from '../../skills/skill-normalisation'
import {
  toCurrencyCode,
  toRequirements,
  toSalaryAmount,
  toYearsRequired,
} from './job-normalisation'

/**
 * A validated reading becomes rows.
 *
 * One transaction for the posting and both child tables. A half-written
 * posting - requirements but no skills - would be worse than none, because
 * everything downstream reads these tables on the strength of the status alone.
 *
 * The children are deleted first, so a re-extraction replaces rather than
 * duplicates. Anything derived from them has to go at the same time; today
 * nothing is, and when matches exist that becomes this method's problem.
 */
@Injectable()
export class JobPersistenceService {
  private readonly logger = new Logger(JobPersistenceService.name)

  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async run(jobId: string, extractionId: string, extracted: ExtractedJob): Promise<void> {
    const skills = dedupeSkills(extracted.skills)
    const requirements = toRequirements(extracted.requirements)

    await this.db.transaction(async (tx) => {
      await tx.delete(jobRequirements).where(eq(jobRequirements.jobId, jobId))
      await tx.delete(jobSkills).where(eq(jobSkills.jobId, jobId))

      await tx
        .update(jobs)
        .set({
          extractionId,
          title: extracted.title,
          company: extracted.company,
          locations: extracted.locations,
          workMode: extracted.workMode,
          employmentType: extracted.employmentType,
          seniority: extracted.seniority,
          yearsExperienceMin: toYearsRequired(extracted.yearsExperienceMin),
          yearsExperienceMax: toYearsRequired(extracted.yearsExperienceMax),
          salaryMin: toSalaryAmount(extracted.salary?.min ?? null),
          salaryMax: toSalaryAmount(extracted.salary?.max ?? null),
          salaryCurrency: toCurrencyCode(extracted.salary?.currency ?? null),
          salaryPeriod: extracted.salary?.period ?? null,
          industry: extracted.industry,
          teamContext: extracted.teamContext,
          summary: extracted.summary,
          responsibilities: extracted.responsibilities,
          educationLevel: extracted.education?.level ?? null,
          educationField: extracted.education?.field ?? null,
          educationImportance: extracted.education?.importance ?? null,
          // Extracted but not yet queried structurally. Promoting one to a
          // column later is a migration over data already here.
          extras: { benefits: extracted.benefits },
        })
        .where(eq(jobs.id, jobId))

      if (requirements.length > 0) {
        await tx.insert(jobRequirements).values(
          requirements.map((requirement, orderIndex) => ({
            jobId,
            orderIndex,
            text: requirement.text,
            originalText: requirement.originalText,
            importance: requirement.importance,
            kind: requirement.kind,
          })),
        )
      }

      if (skills.length > 0) {
        await tx.insert(jobSkills).values(
          skills.map((skill, orderIndex) => ({
            jobId,
            orderIndex,
            name: skill.name,
            normalizedName: skill.normalizedName,
            category: skill.category,
            importance: skill.importance,
          })),
        )
      }
    })

    this.logger.log(
      `Stored posting ${jobId}: ${requirements.length} requirements, ${skills.length} skills, ` +
        `${extracted.responsibilities.length} responsibilities`,
    )
  }
}
