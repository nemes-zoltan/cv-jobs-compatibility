'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRightIcon, FileTextIcon, PlusIcon, TargetIcon } from 'lucide-react'
import { MAX_JOBS_PAGE_SIZE } from '@cv-jobs-compatibility/constants'
import type { JobSummaryModel } from '@cv-jobs-compatibility/types'
import { Badge, Button, Card, CardContent, Spinner } from '@cv-jobs-compatibility/components'
import { useSession } from '@/components/auth/session-provider'
import { Greeting } from '@/components/greeting'
import { VERDICT_LABELS, jobTitle } from '@/lib/job-format'
import { useJobs } from '@/lib/use-jobs'
import { useMyResume } from '@/lib/use-my-resume'

/**
 * The dashboard.
 *
 * Reports what the account actually holds and offers the one action that
 * follows from it - which changes as the account fills up. An empty account is
 * asked for a role; an account with roles nobody has scored is asked to score
 * them; an account with scores is shown the best of them.
 *
 * Every number here is real. A tile that reports zero of something the product
 * cannot yet do would claim a feature exists and is performing badly, which is
 * a worse lie than saying it is coming.
 */
export default function DashboardPage() {
  const router = useRouter()
  const { user } = useSession()
  const { resume, loading: resumeLoading } = useMyResume()
  // The whole list rather than a page of it: "your best match" has to be the
  // best of all of them, not the best of the first twelve.
  const { data, loading: jobsLoading } = useJobs(1, MAX_JOBS_PAGE_SIZE)

  useEffect(() => {
    if (!user.hasResume) router.replace('/onboarding')
  }, [user.hasResume, router])

  if (!user.hasResume) return null

  const jobs = data?.items ?? []
  const scored = jobs
    .filter((job) => job.match?.status === 'ready' && job.match.score !== null)
    .sort((a, b) => (b.match?.score ?? 0) - (a.match?.score ?? 0))
  const best = scored[0]?.match?.score ?? null

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10 md:px-10 md:py-14">
      <div className="flex flex-col gap-2">
        <Greeting />
        <p className="text-sm text-muted-foreground text-pretty">
          {data?.total
            ? 'Every role you add gets read, then measured against your CV.'
            : 'Your CV is in. Add a role and we will measure it against you.'}
        </p>
      </div>

      {jobsLoading && resumeLoading ? (
        <div className="flex min-h-24 items-center justify-center">
          <Spinner className="size-5 text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Roles tracked" value={data?.total ?? 0} />
          <Stat label="Scored against you" value={scored.length} />
          <Stat label="Best fit" value={best === null ? '—' : `${best}%`} />
          <Stat label="Skills on your CV" value={resume?.skills.length ?? 0} />
        </div>
      )}

      <Roles jobs={jobs} scored={scored} loading={jobsLoading} />

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 px-6">
          <div className="flex items-start gap-3">
            <FileTextIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <h2 className="text-sm font-medium">
                {resume?.fullName ?? 'Your CV'}
                {resume?.headline && (
                  <span className="font-normal text-muted-foreground"> · {resume.headline}</span>
                )}
              </h2>
              <p className="text-sm text-muted-foreground text-pretty">
                Everything we read out of your resume, in one place.
              </p>
            </div>
          </div>

          <Button asChild variant="outline" size="sm">
            <Link href="/my-resume">
              View my resume
              <ArrowRightIcon />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * The one card that changes with the state of the account, because there is
 * exactly one useful next thing at any point and guessing which is not the
 * reader's job.
 */
function Roles({
  jobs,
  scored,
  loading,
}: {
  jobs: JobSummaryModel[]
  scored: JobSummaryModel[]
  loading: boolean
}) {
  if (loading) return null

  if (jobs.length === 0) {
    return (
      <Empty
        title="No roles yet"
        description="Paste a job advert and we read what it asks for, what to expect from the process, and how you stack up."
        action={
          <Button asChild>
            <Link href="/jobs/new">
              <PlusIcon />
              Add a posting
            </Link>
          </Button>
        }
      />
    )
  }

  if (scored.length === 0) {
    const ready = jobs.filter((job) => job.status === 'ready').length

    return (
      <Empty
        title={ready > 0 ? `${ready} role${ready === 1 ? '' : 's'} waiting to be scored` : 'Still reading'}
        description={
          ready > 0
            ? 'Scoring is something you ask for, one role at a time - open one and press the button.'
            : 'The roles you added are still being read. This page will fill in on its own.'
        }
        action={
          <Button asChild variant="outline">
            <Link href="/jobs">
              Go to roles
              <ArrowRightIcon />
            </Link>
          </Button>
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-4">
        <h2 className="font-heading text-lg font-semibold tracking-tight">Your best matches</h2>
        <Button asChild variant="ghost" size="sm">
          <Link href="/jobs">
            All roles
            <ArrowRightIcon />
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {scored.slice(0, 3).map((job) => (
          <MatchRow key={job.id} job={job} />
        ))}
      </div>
    </div>
  )
}

function MatchRow({ job }: { job: JobSummaryModel }) {
  const match = job.match
  if (!match || match.score === null) return null

  return (
    <Link href={`/jobs/${job.id}/match`} className="group">
      <Card className="transition-colors group-hover:border-foreground/20">
        <CardContent className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm font-medium group-hover:underline">
              {jobTitle(job)}
            </span>
            {job.company && (
              <span className="truncate text-xs text-muted-foreground">{job.company}</span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {match.verdict && (
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {VERDICT_LABELS[match.verdict]}
              </span>
            )}
            {/* The bar and the number say the same thing, which is the point:
                one is read at a glance across three rows, the other is exact. */}
            <span
              aria-hidden
              className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-border sm:block"
            >
              <span className="block h-full rounded-full bg-primary" style={{ width: `${match.score}%` }} />
            </span>
            <Badge className="tabular-nums">{match.score}%</Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

function Empty({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action: React.ReactNode
}) {
  return (
    <Card className="border border-dashed border-border bg-transparent ring-0">
      <CardContent className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <TargetIcon className="size-5 text-muted-foreground" />
        <h2 className="font-heading text-lg font-semibold tracking-tight">{title}</h2>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground text-pretty">
          {description}
        </p>
        <div className="mt-1">{action}</div>
      </CardContent>
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="bg-muted/40">
      <CardContent className="flex flex-col gap-1 px-5">
        <span className="font-heading text-2xl font-semibold tabular-nums">{value}</span>
        <span className="text-sm text-muted-foreground">{label}</span>
      </CardContent>
    </Card>
  )
}
