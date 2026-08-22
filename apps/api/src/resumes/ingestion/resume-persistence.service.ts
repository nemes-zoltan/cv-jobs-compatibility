import type { ExtractedResume } from '@cv-jobs-compatibility/prompt-schemas'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { DRIZZLE } from '../../database/database.constants'
import type { Database } from '../../database/database.module'
import {
  type ResumeIngestionRow,
  resumeEducation,
  resumeExperiences,
  resumeProjects,
  resumeSkills,
  resumes,
} from '../../database/schema'
import { dedupeSkills, parseResumeDate, toYearsOfExperience } from './resume-normalisation'

/**
 * Step three: a validated reading becomes rows.
 *
 * One transaction for the resume and all four child tables. A half-written CV -
 * experience but no skills - would be worse than none, because everything
 * downstream reads this table without checking whether it finished.
 */
@Injectable()
export class ResumePersistenceService {
  private readonly logger = new Logger(ResumePersistenceService.name)

  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async run(
    ingestion: ResumeIngestionRow,
    extractionId: string,
    extracted: ExtractedResume,
  ): Promise<void> {
    const skills = dedupeSkills(extracted.skills)

    await this.db.transaction(async (tx) => {
      // The id is the ingestion's: one file, one resume. A re-run replaces
      // rather than versions, so anything already here goes first and takes its
      // children with it.
      await tx.delete(resumes).where(eq(resumes.id, ingestion.id))

      await tx.insert(resumes).values({
        id: ingestion.id,
        userId: ingestion.userId,
        extractionId,
        fullName: extracted.fullName,
        email: extracted.email,
        phone: extracted.phone,
        location: extracted.location,
        headline: extracted.headline,
        summary: extracted.summary,
        yearsExperienceTotal: toYearsOfExperience(extracted.yearsExperienceTotal),
        links: extracted.links,
        // Extracted but not yet queried structurally. Promoting either to its
        // own table later is a migration over data already here.
        extras: { certifications: extracted.certifications, languages: extracted.languages },
      })

      if (extracted.experiences.length > 0) {
        await tx.insert(resumeExperiences).values(
          extracted.experiences.map((experience, orderIndex) => ({
            resumeId: ingestion.id,
            orderIndex,
            company: experience.company,
            title: experience.title,
            location: experience.location,
            startDateRaw: experience.startDateRaw,
            endDateRaw: experience.endDateRaw,
            startDate: parseResumeDate(experience.startDateRaw),
            endDate: parseResumeDate(experience.endDateRaw),
            isCurrent: experience.isCurrent,
            summary: experience.summary,
            highlights: experience.highlights,
          })),
        )
      }

      if (extracted.education.length > 0) {
        await tx.insert(resumeEducation).values(
          extracted.education.map((education, orderIndex) => ({
            resumeId: ingestion.id,
            orderIndex,
            institution: education.institution,
            degree: education.degree,
            field: education.field,
            startDateRaw: education.startDateRaw,
            endDateRaw: education.endDateRaw,
            startDate: parseResumeDate(education.startDateRaw),
            endDate: parseResumeDate(education.endDateRaw),
            grade: education.grade,
          })),
        )
      }

      if (skills.length > 0) {
        await tx.insert(resumeSkills).values(
          skills.map((skill, orderIndex) => ({
            resumeId: ingestion.id,
            orderIndex,
            name: skill.name,
            normalizedName: skill.normalizedName,
            category: skill.category,
          })),
        )
      }

      if (extracted.projects.length > 0) {
        await tx.insert(resumeProjects).values(
          extracted.projects.map((project, orderIndex) => ({
            resumeId: ingestion.id,
            orderIndex,
            name: project.name,
            description: project.description,
            technologies: project.technologies,
            url: project.url,
            startDateRaw: project.startDateRaw,
            endDateRaw: project.endDateRaw,
            startDate: parseResumeDate(project.startDateRaw),
            endDate: parseResumeDate(project.endDateRaw),
          })),
        )
      }
    })

    this.logger.log(
      `Stored resume ${ingestion.id}: ${extracted.experiences.length} roles, ` +
        `${extracted.education.length} education, ${skills.length} skills, ` +
        `${extracted.projects.length} projects`,
    )
  }
}
