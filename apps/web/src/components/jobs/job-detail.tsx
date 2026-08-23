'use client'

import {
  BuildingIcon,
  CheckCircle2Icon,
  ClipboardListIcon,
  ExternalLinkIcon,
  GraduationCapIcon,
  ListChecksIcon,
  MapPinIcon,
  UsersIcon,
  WrenchIcon,
} from 'lucide-react'
import type { JobModel, JobRequirementModel } from '@cv-jobs-compatibility/types'
import { Badge, Card, CardContent, Separator } from '@cv-jobs-compatibility/components'
import {
  EDUCATION_LEVEL_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  REQUIREMENT_KIND_LABELS,
  SENIORITY_LABELS,
  WORK_MODE_LABELS,
  formatSalary,
  formatYearsRequired,
  jobTitle,
} from '@/lib/job-format'
import { JobInsights } from './job-insights'

/**
 * A parsed posting, read top to bottom.
 *
 * Requirements are split by whether the advert called them essential, because
 * that split is the one thing the reader is actually deciding on - "do I clear
 * the bar" is a different question from "what else would help". Empty sections
 * are absent rather than empty: a heading with nothing under it tells nobody
 * anything.
 */
export function JobDetail({ job }: { job: JobModel }) {
  const required = job.requirements.filter((one) => one.importance === 'required')
  const preferred = job.requirements.filter((one) => one.importance === 'preferred')
  const salary = formatSalary(job)
  const years = formatYearsRequired(job)

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-balance">
          {jobTitle(job)}
        </h1>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
          {job.company && (
            <span className="flex items-center gap-1.5">
              <BuildingIcon className="size-3.5 shrink-0" aria-hidden />
              {job.company}
            </span>
          )}
          {job.locations.length > 0 && (
            <span className="flex items-center gap-1.5">
              <MapPinIcon className="size-3.5 shrink-0" aria-hidden />
              {job.locations.join(' · ')}
            </span>
          )}
          {job.sourceUrl && (
            <a
              href={job.sourceUrl}
              target="_blank"
              // `noreferrer` as well: the target is a page a stranger linked to.
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-foreground hover:underline"
            >
              <ExternalLinkIcon className="size-3.5 shrink-0" aria-hidden />
              Original posting
            </a>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {job.seniority && <Badge variant="secondary">{SENIORITY_LABELS[job.seniority]}</Badge>}
          {job.workMode && <Badge variant="outline">{WORK_MODE_LABELS[job.workMode]}</Badge>}
          {job.employmentType && (
            <Badge variant="outline">{EMPLOYMENT_TYPE_LABELS[job.employmentType]}</Badge>
          )}
          {years && <Badge variant="outline">{years}</Badge>}
          {salary && <Badge variant="outline">{salary}</Badge>}
          {job.industry && <Badge variant="outline">{job.industry}</Badge>}
        </div>
      </header>

      {job.summary && (
        <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{job.summary}</p>
      )}

      {job.teamContext && (
        <Section icon={<UsersIcon className="size-4" />} title="The team">
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
            {job.teamContext}
          </p>
        </Section>
      )}

      {job.responsibilities.length > 0 && (
        <Section
          icon={<ClipboardListIcon className="size-4" />}
          title="What you would be doing"
        >
          <ul className="flex flex-col gap-2">
            {job.responsibilities.map((responsibility) => (
              <li key={responsibility} className="flex items-start gap-2">
                <span
                  className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground"
                  aria-hidden
                />
                <span className="text-sm leading-relaxed text-muted-foreground text-pretty">
                  {responsibility}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {required.length > 0 && (
        <Section
          icon={<ListChecksIcon className="size-4" />}
          title={`Essential (${required.length})`}
        >
          <Requirements requirements={required} />
        </Section>
      )}

      {preferred.length > 0 && (
        <Section
          icon={<CheckCircle2Icon className="size-4" />}
          title={`Nice to have (${preferred.length})`}
        >
          <Requirements requirements={preferred} />
        </Section>
      )}

      {job.skills.length > 0 && (
        <Section icon={<WrenchIcon className="size-4" />} title={`Skills (${job.skills.length})`}>
          <div className="flex flex-wrap gap-1.5">
            {job.skills.map((skill) => (
              <Badge key={skill.id} variant={skill.importance === 'required' ? 'default' : 'outline'}>
                {skill.name}
              </Badge>
            ))}
          </div>
        </Section>
      )}

      {/* Below the posting itself: what the advert says comes first, what we
          went and found out about it comes after. Whether it is still coming,
          and the button to try again, live in the strip above the page - this
          renders the briefing or nothing. */}
      <JobInsights insights={job.insights} />

      {job.educationLevel && (
        <Section icon={<GraduationCapIcon className="size-4" />} title="Education">
          <p className="text-sm text-muted-foreground">
            {EDUCATION_LEVEL_LABELS[job.educationLevel]}
            {job.educationField && ` in ${job.educationField}`}
            {job.educationImportance === 'preferred' && ' (preferred)'}
          </p>
        </Section>
      )}
    </div>
  )
}

/**
 * The canonical phrase is what gets read, and what the advert actually wrote
 * sits under it - so a bad condensation is visible rather than silent.
 */
function Requirements({ requirements }: { requirements: JobRequirementModel[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {requirements.map((requirement) => (
        <li key={requirement.id} className="flex flex-col gap-1">
          <div className="flex items-start gap-2">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground" aria-hidden />
            <span className="text-sm leading-relaxed text-pretty">{requirement.text}</span>
            <Badge variant="outline" className="ml-auto shrink-0 text-xs">
              {REQUIREMENT_KIND_LABELS[requirement.kind]}
            </Badge>
          </div>

          {requirement.originalText && (
            <p className="pl-3.5 text-xs leading-relaxed text-muted-foreground text-pretty">
              {requirement.originalText}
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 px-6">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <span className="text-muted-foreground">{icon}</span>
          {title}
        </h2>
        <Separator />
        {children}
      </CardContent>
    </Card>
  )
}
