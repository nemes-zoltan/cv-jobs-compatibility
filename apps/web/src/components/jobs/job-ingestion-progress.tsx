'use client'

import { CheckIcon, SparklesIcon, TimerIcon } from 'lucide-react'
import { Spinner } from '@cv-jobs-compatibility/components'
import { cn } from '@/lib/utils'

/**
 * The two phases a pasted advert goes through.
 *
 * Two rather than the CV's three because there is no file: nothing is uploaded
 * and nothing has to be turned into text, so the posting waits and then it is
 * read.
 *
 * Driven entirely by which step is current - deciding that from a status is a
 * product judgement and belongs to the caller.
 */

const STEPS = [
  {
    icon: TimerIcon,
    title: 'Queued',
    description: 'Waiting to be picked up.',
  },
  {
    icon: SparklesIcon,
    title: 'Read',
    description: 'Picking out the requirements, skills and everything they ask for.',
  },
] as const

export interface JobIngestionProgressProps {
  /** Which of the two is happening now, or `2` once both are done. */
  step: number
}

export function JobIngestionProgress({ step }: JobIngestionProgressProps) {
  const current = STEPS[Math.min(step, STEPS.length - 1)]

  return (
    <div className="flex w-full flex-col gap-5">
      <ol className="flex items-start gap-2" aria-label="Reading the posting">
        {STEPS.map(({ icon: Icon, title }, index) => {
          const done = index < step
          const active = index === step

          return (
            <li key={title} className="flex flex-1 flex-col items-center gap-2">
              <span
                className={cn(
                  'h-1 w-full rounded-full transition-colors',
                  done || active ? 'bg-primary' : 'bg-border',
                  active && 'animate-pulse',
                )}
              />

              <span
                className={cn(
                  'flex items-center gap-1.5 text-xs transition-colors',
                  done || active ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {done ? (
                  <CheckIcon className="size-3.5 shrink-0" aria-hidden />
                ) : (
                  <Icon className="size-3.5 shrink-0" aria-hidden />
                )}
                {title}
              </span>
            </li>
          )
        })}
      </ol>

      <p
        role="status"
        aria-live="polite"
        // The description wraps at this width, and a centred row would then
        // float the spinner between the two lines. It aligns to the first line
        // instead, nudged down to sit optically on it.
        className="flex items-start justify-center gap-2 text-sm text-muted-foreground"
      >
        {step < STEPS.length && <Spinner className="mt-0.5 size-4 shrink-0" />}
        {/* A real element rather than a bare text node, so the wrapped lines
            balance instead of leaving one word stranded on the second. */}
        <span className="text-balance">
          {step < STEPS.length ? current.description : 'Done.'}
        </span>
      </p>
    </div>
  )
}
