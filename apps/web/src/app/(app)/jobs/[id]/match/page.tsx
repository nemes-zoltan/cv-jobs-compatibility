'use client'

import { use } from 'react'
import Link from 'next/link'
import { AlertTriangleIcon, TargetIcon } from 'lucide-react'
import { Button, Card, CardContent, Spinner } from '@cv-jobs-compatibility/components'
import { BackLink } from '@/components/back-link'
import { MatchReport } from '@/components/jobs/match-report'
import { jobTitle } from '@/lib/job-format'
import { useJob } from '@/lib/use-job'
import { useJobMatch } from '@/lib/use-job-match'

/**
 * How this posting scores against the CV.
 *
 * Its own page rather than another section on the posting: the posting is what
 * the company wrote, this is what we make of it against one person, and mixing
 * them would leave a reader unsure which half they were looking at. The two
 * share their section shell and nothing else.
 */
export default function JobMatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { job } = useJob(id)
  const { match, loading, error, notScored } = useJobMatch(id)

  const running = match !== null && match.status !== 'ready' && match.status !== 'failed'

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10 md:px-10 md:py-14">
      <BackLink href={`/jobs/${id}`} label="Back to the posting" />

      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-balance">
          {job ? jobTitle(job) : 'This role'} vs your CV
        </h1>
        {job?.company && <p className="text-sm text-muted-foreground">{job.company}</p>}
      </div>

      {loading && (
        <div className="flex min-h-48 items-center justify-center">
          <Spinner className="size-5 text-muted-foreground" aria-label="Loading the breakdown" />
        </div>
      )}

      {error && !loading && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {notScored && !loading && (
        <Empty
          icon={<TargetIcon className="size-5 text-muted-foreground" />}
          title="Not scored yet"
          description="Scoring is something you ask for - it costs a model call per posting."
          jobId={id}
        />
      )}

      {running && (
        <Card className="border border-dashed border-border bg-transparent ring-0">
          <CardContent className="flex items-center justify-center gap-2 px-6 py-12 text-sm text-muted-foreground">
            <Spinner className="size-4 shrink-0" />
            Reading your CV against every requirement…
          </CardContent>
        </Card>
      )}

      {match?.status === 'failed' && (
        <Empty
          icon={<AlertTriangleIcon className="size-5 text-muted-foreground" />}
          title="Scoring did not finish"
          description="Something went wrong on our side. You can start it again from the posting."
          jobId={id}
        />
      )}

      {match?.status === 'ready' && <MatchReport match={match} />}
    </div>
  )
}

function Empty({
  icon,
  title,
  description,
  jobId,
}: {
  icon: React.ReactNode
  title: string
  description: string
  jobId: string
}) {
  return (
    <Card className="border border-dashed border-border bg-transparent ring-0">
      <CardContent className="flex flex-col items-center gap-3 px-6 py-14 text-center">
        {icon}
        <h2 className="font-heading text-lg font-semibold tracking-tight">{title}</h2>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground text-pretty">
          {description}
        </p>
        {/* The button lives on the posting, where the rest of the pipeline is -
            two places to start the same thing is two places to keep in step. */}
        <Button asChild variant="outline" className="mt-1">
          <Link href={`/jobs/${jobId}`}>Back to the posting</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
