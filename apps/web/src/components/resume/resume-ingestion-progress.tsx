'use client'

import { CheckIcon, FileSearchIcon, SparklesIcon, UploadCloudIcon } from 'lucide-react'
import { Spinner } from '@cv-jobs-compatibility/components'
import { cn } from '@/lib/utils'

/**
 * The three phases a CV goes through, as a bar in three parts.
 *
 * Driven entirely by which step is current: the caller decides that from the
 * ingestion status, because the mapping from pipeline state to something worth
 * showing a person is a product decision, not a rendering one.
 */

const STEPS = [
  {
    icon: UploadCloudIcon,
    title: 'Upload',
    description: 'Sending the file to storage.',
  },
  {
    icon: FileSearchIcon,
    title: 'Read',
    description: 'Pulling the text out of the document.',
  },
  {
    icon: SparklesIcon,
    title: 'Understand',
    description: 'Picking out your experience, skills and education.',
  },
] as const

export interface ResumeIngestionProgressProps {
  /** Which of the three is happening now, or `3` once all of them are done. */
  step: number
}

export function ResumeIngestionProgress({ step }: ResumeIngestionProgressProps) {
  const current = STEPS[Math.min(step, STEPS.length - 1)]

  return (
    <div className="flex w-full flex-col gap-5">
      <ol className="flex items-start gap-2" aria-label="Processing your CV">
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
        className="flex items-center justify-center gap-2 text-sm text-muted-foreground"
      >
        {step < STEPS.length && <Spinner className="size-4 shrink-0" />}
        {step < STEPS.length ? current.description : 'Done.'}
      </p>
    </div>
  )
}
