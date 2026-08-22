'use client'

import {
  AwardIcon,
  BriefcaseIcon,
  FolderGitIcon,
  GraduationCapIcon,
  LanguagesIcon,
  LinkIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
  WrenchIcon,
} from 'lucide-react'
import type {
  ResumeEducationModel,
  ResumeExperienceModel,
  ResumeModel,
  ResumeProjectModel,
} from '@cv-jobs-compatibility/types'
import { Badge, Card, CardContent, Separator } from '@cv-jobs-compatibility/components'
import { groupSkills, skillsMentionedIn } from '@/lib/resume-skills'

/**
 * The parsed CV, read top to bottom.
 *
 * Dates are the strings the document used, never the normalised ones: "2019"
 * should stay "2019" rather than becoming a confident first of January, and a
 * date the parser could not read is still perfectly readable here.
 *
 * Empty sections are absent rather than empty. A CV with no projects has no
 * projects heading - a row of "None" tells the reader nothing they wanted.
 */
export function ResumeDetail({ resume }: { resume: ResumeModel }) {
  const groups = groupSkills(resume.skills)

  return (
    <div className="flex flex-col gap-6">
      <Identity resume={resume} />

      {resume.summary && (
        <Section icon={null} title="Summary">
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
            {resume.summary}
          </p>
        </Section>
      )}

      {resume.experiences.length > 0 && (
        <Section icon={<BriefcaseIcon className="size-4" />} title="Experience">
          <div className="flex flex-col gap-6">
            {resume.experiences.map((experience) => (
              <Experience key={experience.id} experience={experience} skills={resume.skills} />
            ))}
          </div>
        </Section>
      )}

      {groups.length > 0 && (
        <Section icon={<WrenchIcon className="size-4" />} title={`Skills (${resume.skills.length})`}>
          <div className="flex flex-col gap-4">
            {groups.map((group) => (
              <div key={group.category} className="flex flex-col gap-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {group.skills.map((skill) => (
                    <Badge key={skill.id} variant="secondary" className="font-normal">
                      {skill.name}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {resume.projects.length > 0 && (
        <Section icon={<FolderGitIcon className="size-4" />} title="Projects">
          <div className="flex flex-col gap-5">
            {resume.projects.map((project) => (
              <Project key={project.id} project={project} />
            ))}
          </div>
        </Section>
      )}

      {resume.education.length > 0 && (
        <Section icon={<GraduationCapIcon className="size-4" />} title="Education">
          <div className="flex flex-col gap-5">
            {resume.education.map((entry) => (
              <Education key={entry.id} entry={entry} />
            ))}
          </div>
        </Section>
      )}

      {resume.certifications.length > 0 && (
        <Section icon={<AwardIcon className="size-4" />} title="Certifications">
          <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
            {resume.certifications.map((certification) => (
              <li key={certification}>{certification}</li>
            ))}
          </ul>
        </Section>
      )}

      {resume.languages.length > 0 && (
        <Section icon={<LanguagesIcon className="size-4" />} title="Languages">
          <div className="flex flex-wrap gap-1.5">
            {resume.languages.map((language) => (
              <Badge key={language} variant="outline" className="font-normal">
                {language}
              </Badge>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}

function Identity({ resume }: { resume: ResumeModel }) {
  const contacts = [
    resume.email && { icon: <MailIcon className="size-3.5" />, text: resume.email },
    resume.phone && { icon: <PhoneIcon className="size-3.5" />, text: resume.phone },
    resume.location && { icon: <MapPinIcon className="size-3.5" />, text: resume.location },
  ].filter(Boolean) as { icon: React.ReactNode; text: string }[]

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 px-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-balance">
            {resume.fullName ?? 'Your CV'}
          </h1>
          {resume.headline && (
            <p className="text-sm text-muted-foreground text-pretty">{resume.headline}</p>
          )}
        </div>

        {(contacts.length > 0 || resume.yearsExperienceTotal !== null) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            {contacts.map(({ icon, text }) => (
              <span key={text} className="flex items-center gap-1.5">
                {icon}
                <span className="break-all">{text}</span>
              </span>
            ))}
            {resume.yearsExperienceTotal !== null && (
              <span>{formatYears(resume.yearsExperienceTotal)} experience</span>
            )}
          </div>
        )}

        {resume.links.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            {resume.links.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center gap-1.5 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                <LinkIcon className="size-3.5 shrink-0" />
                <span className="break-all">{link.label ?? hostOf(link.url)}</span>
              </a>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Experience({
  experience,
  skills,
}: {
  experience: ResumeExperienceModel
  skills: ResumeModel['skills']
}) {
  const mentioned = skillsMentionedIn(experience, skills)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex flex-col">
          <h3 className="font-medium">{experience.title}</h3>
          <p className="text-sm text-muted-foreground">
            {experience.company}
            {experience.location && ` · ${experience.location}`}
          </p>
        </div>
        <Period start={experience.start} end={experience.end} isCurrent={experience.isCurrent} />
      </div>

      {experience.summary && (
        <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
          {experience.summary}
        </p>
      )}

      {experience.highlights.length > 0 && (
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-muted-foreground marker:text-border">
          {experience.highlights.map((highlight) => (
            <li key={highlight} className="text-pretty">
              {highlight}
            </li>
          ))}
        </ul>
      )}

      {mentioned.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {/* Not the model's judgement - these are skills whose names appear in
              the text above. Said plainly so it is not read as more than it is. */}
          <span className="text-xs text-muted-foreground">Mentioned here:</span>
          {mentioned.map((skill) => (
            <Badge key={skill.id} variant="outline" className="font-normal">
              {skill.name}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

function Project({ project }: { project: ResumeProjectModel }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-medium">
          {project.url ? (
            <a
              href={project.url}
              target="_blank"
              rel="noreferrer noopener"
              className="underline-offset-4 hover:underline"
            >
              {project.name}
            </a>
          ) : (
            project.name
          )}
        </h3>
        <Period start={project.start} end={project.end} isCurrent={false} />
      </div>

      {project.description && (
        <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
          {project.description}
        </p>
      )}

      {project.technologies.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {project.technologies.map((technology) => (
            <Badge key={technology} variant="outline" className="font-normal">
              {technology}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

function Education({ entry }: { entry: ResumeEducationModel }) {
  const qualification = [entry.degree, entry.field].filter(Boolean).join(', ')

  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <div className="flex flex-col">
        <h3 className="font-medium">{entry.institution}</h3>
        {(qualification || entry.grade) && (
          <p className="text-sm text-muted-foreground">
            {qualification}
            {qualification && entry.grade && ' · '}
            {entry.grade}
          </p>
        )}
      </div>
      <Period start={entry.start} end={entry.end} isCurrent={false} />
    </div>
  )
}

/** Exactly what the document said, joined with a dash. */
function Period({
  start,
  end,
  isCurrent,
}: {
  start: string | null
  end: string | null
  isCurrent: boolean
}) {
  const finish = end ?? (isCurrent ? 'Present' : null)
  const text = [start, finish].filter(Boolean).join(' – ')

  if (!text) return null

  return <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{text}</span>
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
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <h2 className="font-heading text-sm font-medium uppercase tracking-wide">{title}</h2>
      </div>
      <Separator />
      {children}
    </section>
  )
}

function formatYears(years: number): string {
  return `${Number.isInteger(years) ? years : years.toFixed(1)} year${years === 1 ? '' : 's'}`
}

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    // The model returns what the document wrote, which is not always a URL.
    return url
  }
}
