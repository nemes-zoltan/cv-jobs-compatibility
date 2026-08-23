'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, TargetIcon } from 'lucide-react'
import { JOBS_PAGE_SIZE } from '@cv-jobs-compatibility/constants'
import { Button, Card, CardContent, Spinner } from '@cv-jobs-compatibility/components'
import { useSession } from '@/components/auth/session-provider'
import { JobCard } from '@/components/jobs/job-card'
import { errorMessage } from '@/lib/api'
import { deleteJob } from '@/lib/jobs-api'
import { useJobs } from '@/lib/use-jobs'

/**
 * Every posting on the account, newest first.
 *
 * Paged rather than infinite: the list is the thing being compared against one
 * CV, so knowing there are four pages of it is more useful than a feed that
 * never ends.
 */
export default function JobsPage() {
  const router = useRouter()
  const { user } = useSession()
  const [page, setPage] = useState(1)
  const { data, loading, error, reload } = useJobs(page)
  const [removeError, setRemoveError] = useState<string | null>(null)

  useEffect(() => {
    if (!user.hasResume) router.replace('/onboarding')
  }, [user.hasResume, router])

  if (!user.hasResume) return null

  const total = data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / JOBS_PAGE_SIZE))

  async function remove(id: string): Promise<void> {
    setRemoveError(null)

    try {
      await deleteJob(id)
      // The page below shifts up when a row leaves it, so the whole page is
      // re-read rather than the row spliced out of what we happen to hold.
      reload()
    } catch (caught) {
      setRemoveError(errorMessage(caught))
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10 md:px-10 md:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Roles</h1>
          <p className="text-sm text-muted-foreground text-pretty">
            {total > 0
              ? `${total} posting${total === 1 ? '' : 's'} on your list.`
              : 'Postings you add get read and kept here.'}
          </p>
        </div>

        <Button asChild>
          <Link href="/jobs/new">
            <PlusIcon />
            Add a posting
          </Link>
        </Button>
      </div>

      {loading && (
        <div className="flex min-h-48 items-center justify-center">
          <Spinner className="size-5 text-muted-foreground" aria-label="Loading your postings" />
        </div>
      )}

      {(error || removeError) && (
        <p role="alert" className="text-sm text-destructive">
          {removeError ?? error}
        </p>
      )}

      {data && data.items.length === 0 && !loading && <Empty />}

      {data && data.items.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {data.items.map((job) => (
            <JobCard key={job.id} job={job} onRemove={remove} />
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((current) => current - 1)}
          >
            <ChevronLeftIcon />
            Previous
          </Button>

          <span className="text-sm text-muted-foreground tabular-nums">
            Page {page} of {pages}
          </span>

          <Button
            variant="outline"
            size="sm"
            disabled={page >= pages}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
            <ChevronRightIcon />
          </Button>
        </div>
      )}
    </div>
  )
}

function Empty() {
  return (
    <Card className="border border-dashed border-border bg-transparent ring-0">
      <CardContent className="flex flex-col items-center gap-3 px-6 py-14 text-center">
        <TargetIcon className="size-5 text-muted-foreground" />
        <h2 className="font-heading text-lg font-semibold tracking-tight">No roles yet</h2>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground text-pretty">
          Paste a job advert and we read what it asks for - the requirements, the skills, how much
          experience it wants.
        </p>
        <Button asChild variant="outline" className="mt-1">
          <Link href="/jobs/new">
            <PlusIcon />
            Add a posting
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
