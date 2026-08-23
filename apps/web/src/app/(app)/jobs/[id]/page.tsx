'use client'

import { use } from 'react'
import { AlertTriangleIcon } from 'lucide-react'
import { Card, CardContent, Spinner } from '@cv-jobs-compatibility/components'
import { BackLink } from '@/components/back-link'
import { JobDetail } from '@/components/jobs/job-detail'
import { JobPipelineStrip } from '@/components/jobs/job-pipeline-strip'
import { JobIngestionProgress } from '@/components/jobs/job-ingestion-progress'
import { jobIngestionStep } from '@/lib/use-job-creation'
import { useJob } from '@/lib/use-job'

/**
 * One posting.
 *
 * Reachable while it is still being read - arriving here straight from the
 * paste box is the normal case - so the page shows the pipeline rather than an
 * empty layout, and fills itself in when the worker finishes.
 */
export default function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { job, loading, error, briefingNeedsRetry, retryBriefing, canScore, scoring, score } =
    useJob(id)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10 md:px-10 md:py-14">
      <BackLink href="/jobs" label="Back to roles" />

      {loading && (
        <div className="flex min-h-48 items-center justify-center">
          <Spinner className="size-5 text-muted-foreground" aria-label="Loading the posting" />
        </div>
      )}

      {error && !loading && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {job && job.status === 'ready' && (
        <>
          {/* Above the posting, not below it: what is still happening to this
              page is the first thing a reader needs, and burying it under the
              requirements makes them scroll to find out whether to wait. */}
          <JobPipelineStrip
            job={job}
            briefingNeedsRetry={briefingNeedsRetry}
            onRetryBriefing={retryBriefing}
            canScore={canScore}
            scoring={scoring}
            onScore={score}
          />

          <JobDetail job={job} />
        </>
      )}

      {job && job.status !== 'ready' && (
        <Card>
          <CardContent className="flex flex-col items-center gap-5 px-6 py-12 text-center">
            {job.status === 'rejected' || job.status === 'failed' ? (
              <>
                <AlertTriangleIcon className="size-5 text-muted-foreground" />
                <div className="flex flex-col gap-1.5">
                  <h1 className="font-heading text-lg font-semibold tracking-tight">
                    {job.status === 'rejected'
                      ? 'That does not look like a job posting'
                      : 'We could not read this one'}
                  </h1>
                  <p className="max-w-sm text-sm leading-relaxed text-muted-foreground text-pretty">
                    Remove it from your list and paste the advert again.
                  </p>
                </div>
              </>
            ) : (
              <div className="w-full max-w-sm">
                <JobIngestionProgress step={jobIngestionStep(job)} />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
