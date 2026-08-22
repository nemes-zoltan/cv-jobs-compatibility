'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRightIcon, BriefcaseIcon, TargetIcon } from 'lucide-react'
import { Button, Card, CardContent, Spinner } from '@cv-jobs-compatibility/components'
import { useSession } from '@/components/auth/session-provider'
import { Greeting } from '@/components/greeting'
import { useMyResume } from '@/lib/use-my-resume'

/**
 * The dashboard.
 *
 * Reports what the account actually holds. The numbers that need job postings
 * to mean anything are shown as not-yet rather than as zero - a "0 roles
 * analysed" tile claims a feature exists and is performing badly, which is a
 * worse lie than saying it is coming.
 */
export default function DashboardPage() {
  const router = useRouter()
  const { user } = useSession()
  const { resume, loading } = useMyResume()

  useEffect(() => {
    if (!user.hasResume) router.replace('/onboarding')
  }, [user.hasResume, router])

  if (!user.hasResume) return null

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10 md:px-10 md:py-14">
      <div className="flex flex-col gap-2">
        <Greeting />
        <p className="text-sm text-muted-foreground text-pretty">
          Your CV is in. Roles get measured against it.
        </p>
      </div>

      {loading ? (
        <div className="flex min-h-24 items-center justify-center">
          <Spinner className="size-5 text-muted-foreground" />
        </div>
      ) : (
        resume && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Roles on your CV" value={resume.experiences.length} />
            <Stat label="Skills extracted" value={resume.skills.length} />
            <Stat
              label="Years of experience"
              value={
                resume.yearsExperienceTotal === null
                  ? '—'
                  : Number(resume.yearsExperienceTotal.toFixed(1))
              }
            />
          </div>
        )
      )}

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 px-6">
          <div className="flex items-start gap-3">
            <BriefcaseIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
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

      <Card className="border border-dashed border-border bg-transparent ring-0">
        <CardContent className="flex flex-col items-center gap-2 px-6 py-12 text-center">
          <TargetIcon className="size-5 text-muted-foreground" />
          <h2 className="font-heading text-lg font-semibold tracking-tight">No roles yet</h2>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground text-pretty">
            Adding job postings is next. Each one gets scored against your CV, with the gaps worth
            closing called out.
          </p>
        </CardContent>
      </Card>
    </div>
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
