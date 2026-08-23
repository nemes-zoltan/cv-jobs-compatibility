'use client'

import {
  CircleAlertIcon,
  CircleCheckIcon,
  CircleHelpIcon,
  ListChecksIcon,
  MessageCircleQuestionIcon,
  ShieldAlertIcon,
  StarIcon,
  ThumbsUpIcon,
  TrendingDownIcon,
  WrenchIcon,
} from 'lucide-react'
import type {
  JobMatchModel,
  JobMatchRequirementModel,
  JobMatchSkillModel,
} from '@cv-jobs-compatibility/types'
import { Badge, Card, CardContent, Separator } from '@cv-jobs-compatibility/components'
import { cn } from '@/lib/utils'
import {
  ESSENTIAL_LABELS,
  GAP_TYPE_LABELS,
  RECOMMENDATION_LABELS,
  SKILL_VERDICT_LABELS,
  VERDICT_LABELS,
} from '@/lib/job-format'

/**
 * How one CV stands against one posting.
 *
 * Built so that every number can be argued with. The score at the top is
 * arithmetic over the rows further down, and each of those rows carries the
 * line of the CV it was read from - so a rating that looks wrong can be checked
 * rather than merely disbelieved.
 *
 * The order is deliberate: what to do, then why, then the evidence. Somebody
 * who trusts it stops after the first card; somebody who does not keeps
 * reading.
 */
export function MatchReport({ match }: { match: JobMatchModel }) {
  const unmet = match.essentials.filter((one) => one.verdict === 'no')
  const unknown = match.essentials.filter((one) => one.verdict === 'unknown')
  const missingSkills = match.skills.filter((skill) => skill.verdict !== 'yes')

  return (
    <div className="flex flex-col gap-6">
      <Headline match={match} />

      {(unmet.length > 0 || match.meetsYearsRequirement === false) && (
        <Section icon={<ShieldAlertIcon className="size-4" />} title="Before you spend time on this">
          <ul className="flex flex-col gap-2">
            {match.meetsYearsRequirement === false && (
              <li className="text-sm leading-relaxed text-pretty">
                You are short of the years of experience this role asks for.
              </li>
            )}
            {unmet.map((essential) => (
              <li key={essential.check} className="text-sm leading-relaxed text-pretty">
                <span className="font-medium">{ESSENTIAL_LABELS[essential.check]}:</span>{' '}
                {essential.note ?? 'Does not look like a match.'}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {match.summary && (
        <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{match.summary}</p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {match.strengths.length > 0 && (
          <Section icon={<ThumbsUpIcon className="size-4" />} title="What you have going for you">
            <Bullets items={match.strengths} />
          </Section>
        )}

        {match.gaps.length > 0 && (
          <Section icon={<TrendingDownIcon className="size-4" />} title="What is missing">
            <Bullets items={match.gaps} />
          </Section>
        )}
      </div>

      {missingSkills.length > 0 && (
        <Section
          icon={<WrenchIcon className="size-4" />}
          title={`Skills to close (${missingSkills.length})`}
        >
          <div className="flex flex-col gap-3">
            {missingSkills.map((skill) => (
              <SkillRow key={skill.id} skill={skill} />
            ))}
          </div>
        </Section>
      )}

      {match.requirements.length > 0 && (
        <Section
          icon={<ListChecksIcon className="size-4" />}
          title={`Every requirement (${match.requirements.length})`}
        >
          <div className="flex flex-col gap-4">
            {match.requirements.map((requirement) => (
              <RequirementRow key={requirement.id} requirement={requirement} />
            ))}
          </div>
        </Section>
      )}

      {match.skills.filter((skill) => skill.verdict === 'yes').length > 0 && (
        <Section icon={<CircleCheckIcon className="size-4" />} title="Skills you already have">
          <div className="flex flex-wrap gap-1.5">
            {match.skills
              .filter((skill) => skill.verdict === 'yes')
              .map((skill) => (
                <Badge key={skill.id} variant="secondary">
                  {skill.name}
                </Badge>
              ))}
          </div>
        </Section>
      )}

      {match.tailoredQuestions.length > 0 && (
        <Section
          icon={<MessageCircleQuestionIcon className="size-4" />}
          title="What they will press you on"
        >
          <ul className="flex flex-col gap-5">
            {match.tailoredQuestions.map((question) => (
              <li key={question.question} className="flex flex-col gap-1.5">
                <p className="text-sm leading-relaxed text-pretty">{question.question}</p>
                <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
                  Coming up because: {question.motivatedBy}
                </p>
                <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
                  How to handle it: {question.howToApproach}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {unknown.length > 0 && (
        <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
          Not judged, because your CV does not say:{' '}
          {unknown.map((one) => ESSENTIAL_LABELS[one.check].toLowerCase()).join(', ')}. These are
          left out of the score rather than guessed at.
        </p>
      )}
    </div>
  )
}

function Headline({ match }: { match: JobMatchModel }) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-4">
          <span className="font-heading text-4xl font-semibold tabular-nums">
            {match.score ?? '—'}
            <span className="text-2xl text-muted-foreground">%</span>
          </span>

          <div className="flex flex-col gap-1">
            {match.verdict && (
              <span className="font-heading text-lg font-semibold tracking-tight">
                {VERDICT_LABELS[match.verdict]}
              </span>
            )}
            <span className="text-sm text-muted-foreground">
              {match.requirements.length} requirements, {match.skills.length} skills weighed
            </span>
          </div>
        </div>

        {match.recommendation && (
          <Badge className="text-sm" variant={match.recommendation === 'skip' ? 'outline' : 'default'}>
            {RECOMMENDATION_LABELS[match.recommendation]}
          </Badge>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Stars rather than the raw number, because a rating is a judgement on a scale
 * and a number invites the reader to do arithmetic with it that we have already
 * done for them.
 */
function RequirementRow({ requirement }: { requirement: JobMatchRequirementModel }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm leading-relaxed text-pretty">{requirement.text}</span>

        <span className="flex shrink-0 items-center gap-1.5">
          {requirement.importance === 'required' && (
            <Badge variant="outline" className="text-xs">
              Required
            </Badge>
          )}
          <Stars value={requirement.stars} />
        </span>
      </div>

      {requirement.evidence && (
        <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
          {requirement.evidence}
        </p>
      )}
    </div>
  )
}

function Stars({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((step) => (
        <StarIcon
          key={step}
          className={cn(
            'size-3.5 shrink-0',
            step <= value ? 'fill-foreground text-foreground' : 'text-muted-foreground/30',
          )}
          aria-hidden
        />
      ))}
    </span>
  )
}

function SkillRow({ skill }: { skill: JobMatchSkillModel }) {
  const Icon = skill.verdict === 'partial' ? CircleHelpIcon : CircleAlertIcon

  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />

      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">{skill.name}</span>
          <span className="text-xs text-muted-foreground">
            {SKILL_VERDICT_LABELS[skill.verdict]}
            {skill.gapType && ` · ${GAP_TYPE_LABELS[skill.gapType]}`}
          </span>
          {skill.importance === 'required' && (
            <Badge variant="outline" className="text-xs">
              Required
            </Badge>
          )}
        </p>

        {skill.evidence && (
          <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
            {skill.evidence}
          </p>
        )}
      </div>
    </div>
  )
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground" aria-hidden />
          <span className="text-sm leading-relaxed text-muted-foreground text-pretty">{item}</span>
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
