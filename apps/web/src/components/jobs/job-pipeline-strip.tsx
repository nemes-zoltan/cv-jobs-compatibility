'use client'

import Link from 'next/link'
import {
  AlertTriangleIcon,
  CheckIcon,
  CircleIcon,
  RefreshCwIcon,
  TargetIcon,
} from 'lucide-react'
import type { JobModel } from '@cv-jobs-compatibility/types'
import { Button, Card, CardContent, Spinner } from '@cv-jobs-compatibility/components'
import { cn } from '@/lib/utils'
import { VERDICT_LABELS } from '@/lib/job-format'

/**
 * Everything happening to this posting, in one place, near the top.
 *
 * Three separate model calls run against a posting and they finish minutes
 * apart. Without this the page just fills in on its own and a reader is left
 * guessing whether something is still coming or nothing else ever will - so
 * each line says which of those it is, and the ones that need a decision carry
 * the button that makes it.
 */

export interface JobPipelineStripProps {
  job: JobModel
  briefingNeedsRetry: boolean
  onRetryBriefing: () => Promise<void>
  canScore: boolean
  scoring: boolean
  onScore: () => Promise<void>
}

export function JobPipelineStrip({
  job,
  briefingNeedsRetry,
  onRetryBriefing,
  canScore,
  scoring,
  onScore,
}: JobPipelineStripProps) {
  return (
    <Card className="bg-muted/30">
      <CardContent className="flex flex-col gap-3 px-5">
        <Row state="done" label="Posting read" />

        <Row
          state={
            briefingNeedsRetry ? 'failed' : job.insightsStatus === 'pending' ? 'working' : 'done'
          }
          label={
            briefingNeedsRetry
              ? 'Could not work out what to expect'
              : job.insightsStatus === 'pending'
                ? 'Working out how they interview…'
                : 'Interview expectations ready'
          }
          action={
            briefingNeedsRetry && (
              <BusyButton onClick={onRetryBriefing} icon={<RefreshCwIcon />}>
                Try again
              </BusyButton>
            )
          }
        />

        <MatchRow job={job} canScore={canScore} scoring={scoring} onScore={onScore} />
      </CardContent>
    </Card>
  )
}

function MatchRow({
  job,
  canScore,
  scoring,
  onScore,
}: Pick<JobPipelineStripProps, 'job' | 'canScore' | 'scoring' | 'onScore'>) {
  const match = job.match

  if (match?.status === 'ready' && match.score !== null) {
    return (
      <Row
        state="done"
        label={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium tabular-nums">{match.score}%</span>
            <span className="text-muted-foreground">
              against your CV
              {match.verdict && ` · ${VERDICT_LABELS[match.verdict]}`}
            </span>
          </span>
        }
        action={
          <Button asChild variant="outline" size="sm">
            <Link href={`/jobs/${job.id}/match`}>
              <TargetIcon />
              See the breakdown
            </Link>
          </Button>
        }
      />
    )
  }

  if (match?.status === 'failed') {
    return (
      <Row
        state="failed"
        label="Scoring did not finish"
        action={
          <BusyButton onClick={onScore} busy={scoring} icon={<RefreshCwIcon />}>
            Try again
          </BusyButton>
        }
      />
    )
  }

  if (match) {
    return <Row state="working" label="Scoring against your CV…" />
  }

  return (
    <Row
      state="idle"
      label={canScore ? 'Not scored against your CV yet' : 'Scoring waits for the step above'}
      action={
        canScore && (
          <BusyButton onClick={onScore} busy={scoring} icon={<TargetIcon />} variant="default">
            Score this role
          </BusyButton>
        )
      }
    />
  )
}

type RowState = 'done' | 'working' | 'failed' | 'idle'

function Row({
  state,
  label,
  action,
}: {
  state: RowState
  label: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="flex min-h-8 flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <span className="flex items-center gap-2 text-sm">
        <StateIcon state={state} />
        <span className={cn(state === 'idle' && 'text-muted-foreground')}>{label}</span>
      </span>

      {action}
    </div>
  )
}

function StateIcon({ state }: { state: RowState }) {
  if (state === 'working') return <Spinner className="size-4 shrink-0 text-muted-foreground" />

  if (state === 'failed') {
    return <AlertTriangleIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
  }

  if (state === 'done') {
    return <CheckIcon className="size-4 shrink-0 text-emerald-600 dark:text-emerald-500" aria-hidden />
  }

  return <CircleIcon className="size-4 shrink-0 text-muted-foreground/50" aria-hidden />
}

/**
 * Own busy state, because the two things this button does have different
 * owners: scoring is tracked on the posting, retrying a briefing is not.
 */
function BusyButton({
  onClick,
  busy = false,
  icon,
  variant = 'outline',
  children,
}: {
  onClick: () => Promise<void>
  busy?: boolean
  icon: React.ReactNode
  variant?: 'default' | 'outline'
  children: React.ReactNode
}) {
  return (
    <Button
      variant={variant}
      size="sm"
      disabled={busy}
      onClick={() => {
        void onClick()
      }}
    >
      {busy ? <Spinner /> : icon}
      {children}
    </Button>
  )
}
