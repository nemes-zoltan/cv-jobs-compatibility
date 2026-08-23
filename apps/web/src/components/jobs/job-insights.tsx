'use client'

import {
  BuildingIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  ExternalLinkIcon,
  InfoIcon,
  MessageCircleQuestionIcon,
  RouteIcon,
} from 'lucide-react'
import type {
  JobFlagModel,
  JobInsightsModel,
  JobInterviewStageModel,
} from '@cv-jobs-compatibility/types'
import { Badge, Card, CardContent, Separator } from '@cv-jobs-compatibility/components'
import { cn } from '@/lib/utils'

/**
 * What we found out about the role beyond what it advertises.
 *
 * Everything here is somebody's account of something, so everything here says
 * whose. A flag read off the advert quotes the line; one found online names the
 * person, links the page and dates it. Nothing renders as a bare assertion
 * about a real employer, because a bare assertion is exactly what a reader
 * cannot check and we cannot stand behind.
 */

/**
 * Renders the briefing, or nothing.
 *
 * Whether one is still coming, and the button to ask again after a failure,
 * belong to the pipeline strip at the top of the page. A page reporting the
 * same state in two places is a page with two states to keep in step.
 */
export function JobInsights({ insights }: { insights: JobInsightsModel | null }) {
  if (!insights) return null

  const red = insights.flags.filter((flag) => flag.polarity === 'red')
  const green = insights.flags.filter((flag) => flag.polarity === 'green')
  const neutral = insights.flags.filter((flag) => flag.polarity === 'neutral')

  return (
    <div className="flex flex-col gap-6">
      {insights.company.known && (
        <Section icon={<BuildingIcon className="size-4" />} title="The company">
          <div className="flex flex-col gap-3">
            {insights.company.whatTheyDo && (
              <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
                {insights.company.whatTheyDo}
              </p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {insights.company.sector && <Badge variant="outline">{insights.company.sector}</Badge>}
              {insights.company.sizeEstimate && (
                <Badge variant="outline">{insights.company.sizeEstimate}</Badge>
              )}
            </div>
          </div>
        </Section>
      )}

      {insights.flags.length > 0 && (
        <Section icon={<InfoIcon className="size-4" />} title="Worth knowing">
          {/* Good news, then context, then warnings. Leading with red flags
              reads as a verdict on the role before anyone has decided; ending
              on them leaves the caveats freshest, which is where they belong. */}
          <div className="flex flex-col gap-4">
            {[...green, ...neutral, ...red].map((flag) => (
              <Flag key={flag.id} flag={flag} />
            ))}
          </div>
        </Section>
      )}

      {insights.interviewStages.length > 0 && (
        <Section
          icon={<RouteIcon className="size-4" />}
          title={`Likely interview process (${insights.interviewStages.length} stages)`}
        >
          <div className="flex flex-col gap-4">
            <p className="text-xs text-muted-foreground">
              {insights.interviewBasis === 'stated_in_posting'
                ? 'As described in the posting.'
                : 'Not stated in the posting - this is what a role like this usually runs.'}
            </p>

            <ol className="flex flex-col">
              {insights.interviewStages.map((stage, index) => (
                <Stage
                  key={stage.stage}
                  stage={stage}
                  index={index}
                  last={index === insights.interviewStages.length - 1}
                />
              ))}
            </ol>
          </div>
        </Section>
      )}

      {insights.interviewQuestions.length > 0 && (
        <Section
          icon={<MessageCircleQuestionIcon className="size-4" />}
          title="Questions to expect"
        >
          <ul className="flex flex-col gap-4">
            {insights.interviewQuestions.map((question) => (
              <li key={question.question} className="flex flex-col gap-1">
                <p className="text-sm leading-relaxed text-pretty">{question.question}</p>
                <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
                  Testing: {question.whatTheyAreProbing}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  )
}

/**
 * The attribution is not a footnote, it is the point. A claim about an employer
 * that does not say who made it and when is not worth showing at all.
 */
function Flag({ flag }: { flag: JobFlagModel }) {
  const Icon =
    flag.polarity === 'red' ? CircleAlertIcon : flag.polarity === 'green' ? CircleCheckIcon : InfoIcon

  return (
    <div className="flex items-start gap-2.5">
      <Icon
        className={cn(
          'mt-0.5 size-4 shrink-0',
          flag.polarity === 'red' && 'text-destructive',
          flag.polarity === 'green' && 'text-emerald-600 dark:text-emerald-500',
          flag.polarity === 'neutral' && 'text-muted-foreground',
        )}
        aria-hidden
      />

      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-sm leading-relaxed text-pretty">{flag.text}</p>

        {flag.evidence && (
          <blockquote className="border-l-2 border-border pl-3 text-xs leading-relaxed text-muted-foreground text-pretty">
            {flag.evidence}
          </blockquote>
        )}

        <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {flag.sourceKind === 'posting' ? (
            <span>From the posting itself</span>
          ) : (
            <>
              <span>{flag.sourceLabel ?? 'Reported online'}</span>
              {flag.sourceDate && <span>· {flag.sourceDate}</span>}
              {flag.sourceUrl && (
                <a
                  href={flag.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-foreground hover:underline"
                >
                  <ExternalLinkIcon className="size-3 shrink-0" aria-hidden />
                  Read it
                </a>
              )}
            </>
          )}
        </p>
      </div>
    </div>
  )
}

function Stage({
  stage,
  index,
  last,
}: {
  stage: JobInterviewStageModel
  index: number
  last: boolean
}) {
  return (
    <li className="flex gap-3">
      {/* The rail makes it read as a sequence rather than a list of options -
          which is what a candidate is actually trying to picture. */}
      <div className="flex flex-col items-center">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-background text-xs font-medium tabular-nums">
          {index + 1}
        </span>
        {!last && <span className="w-px flex-1 bg-border" aria-hidden />}
      </div>

      <div className={cn('flex flex-col gap-0.5', last ? 'pb-0' : 'pb-5')}>
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
          {stage.stage}
          {stage.typicalDuration && (
            <span className="text-xs font-normal text-muted-foreground">
              {stage.typicalDuration}
            </span>
          )}
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
          {stage.whatTheyAssess}
        </p>
      </div>
    </li>
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
