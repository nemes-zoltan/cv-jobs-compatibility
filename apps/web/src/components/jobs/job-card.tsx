'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertTriangleIcon, BuildingIcon, MapPinIcon, Trash2Icon } from 'lucide-react'
import type { JobSummaryModel } from '@cv-jobs-compatibility/types'
import { Badge, Button, Card, CardContent, Spinner } from '@cv-jobs-compatibility/components'
import {
  EMPLOYMENT_TYPE_LABELS,
  SENIORITY_LABELS,
  VERDICT_LABELS,
  WORK_MODE_LABELS,
  formatSalary,
  formatYearsRequired,
  jobTitle,
} from '@/lib/job-format'

/**
 * One posting in the list.
 *
 * Has to render a row that knows nothing about itself yet: a posting added ten
 * seconds ago has a status and a date and no title. So the card leads with
 * whatever it has and says plainly what is missing, rather than showing a
 * skeleton that implies the data is on its way from the server when it is
 * actually still being written.
 */

export interface JobCardProps {
  job: JobSummaryModel
  /** Removing is the page's business - it owns the list and the error line. */
  onRemove: (id: string) => Promise<void>
}

export function JobCard({ job, onRemove }: JobCardProps) {
  const [removing, setRemoving] = useState(false)

  const parsed = job.status === 'ready'
  const salary = formatSalary(job)
  const years = formatYearsRequired(job)

  return (
    <Card className="group relative transition-colors hover:border-foreground/20">
      <CardContent className="flex flex-col gap-3 px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="truncate font-heading text-base font-semibold tracking-tight">
              {parsed ? (
                // The whole card is not a link: it holds a delete button, and
                // nesting a button inside an anchor is invalid and unusable
                // with a keyboard.
                <Link href={`/jobs/${job.id}`} className="hover:underline">
                  {jobTitle(job)}
                </Link>
              ) : (
                jobTitle(job)
              )}
            </h2>

            {job.company && (
              <p className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                <BuildingIcon className="size-3.5 shrink-0" aria-hidden />
                {job.company}
              </p>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            aria-label={`Remove ${jobTitle(job)}`}
            disabled={removing}
            className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            onClick={() => {
              setRemoving(true)
              void onRemove(job.id).finally(() => setRemoving(false))
            }}
          >
            {removing ? <Spinner /> : <Trash2Icon />}
          </Button>
        </div>

        <StatusLine job={job} />

        {parsed && job.summary && (
          <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground text-pretty">
            {job.summary}
          </p>
        )}

        {parsed && (
          <div className="flex flex-wrap items-center gap-1.5">
            {/* First, because it is the only thing on the card that is about
                this reader rather than about the role. */}
            {job.match?.status === 'ready' && job.match.score !== null && (
              <Badge className="tabular-nums">
                {job.match.score}%
                {job.match.verdict && ` · ${VERDICT_LABELS[job.match.verdict]}`}
              </Badge>
            )}
            {job.match === null && (
              <Badge variant="outline" className="text-muted-foreground">
                Not scored
              </Badge>
            )}
            {job.seniority && <Badge variant="secondary">{SENIORITY_LABELS[job.seniority]}</Badge>}
            {job.workMode && <Badge variant="outline">{WORK_MODE_LABELS[job.workMode]}</Badge>}
            {job.employmentType && (
              <Badge variant="outline">{EMPLOYMENT_TYPE_LABELS[job.employmentType]}</Badge>
            )}
            {years && <Badge variant="outline">{years}</Badge>}
            {salary && <Badge variant="outline">{salary}</Badge>}
            {job.locations.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPinIcon className="size-3 shrink-0" aria-hidden />
                {job.locations.join(' · ')}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * What the card says instead of a title while there is nothing to show.
 *
 * A rejection is described in our words. The model's account of what the text
 * was is written about something a stranger pasted, and it never reaches a
 * screen.
 */
function StatusLine({ job }: { job: JobSummaryModel }) {
  if (job.status === 'ready') return null

  if (job.status === 'rejected') {
    return (
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <AlertTriangleIcon className="size-3.5 shrink-0" aria-hidden />
        That text did not look like a job posting.
      </p>
    )
  }

  if (job.status === 'failed') {
    return (
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <AlertTriangleIcon className="size-3.5 shrink-0" aria-hidden />
        We could not read this one. Remove it and paste it again.
      </p>
    )
  }

  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <Spinner className="size-3.5 shrink-0" />
      Reading the posting…
    </p>
  )
}
