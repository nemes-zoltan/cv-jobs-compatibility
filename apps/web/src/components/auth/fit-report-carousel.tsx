'use client'

import * as React from 'react'
import {
  Badge,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  Progress,
} from '@cv-jobs-compatibility/components'
import { cn } from '@/lib/utils'

type FitReport = {
  role: string
  company: string
  score: number
  breakdown: { label: string; value: number }[]
  missing: string[]
}

/**
 * Illustrative only - invented roles at invented companies. The spread of
 * scores is the point: a sample set that all landed near 90% would suggest the
 * product rates everything highly.
 */
const REPORTS: FitReport[] = [
  {
    role: 'Senior Backend Engineer',
    company: 'Northwind Labs · Remote (EU)',
    score: 87,
    breakdown: [
      { label: 'Skills', value: 92 },
      { label: 'Experience', value: 84 },
      { label: 'Education', value: 70 },
    ],
    missing: ['Kubernetes', 'Terraform'],
  },
  {
    role: 'Platform Engineer, DevOps',
    company: 'Helix Systems · Berlin, hybrid',
    score: 74,
    breakdown: [
      { label: 'Skills', value: 71 },
      { label: 'Experience', value: 80 },
      { label: 'Education', value: 68 },
    ],
    missing: ['ArgoCD', 'Service mesh'],
  },
  {
    role: 'Senior Frontend Engineer',
    company: 'Lumen Studio · London',
    score: 91,
    breakdown: [
      { label: 'Skills', value: 94 },
      { label: 'Experience', value: 89 },
      { label: 'Education', value: 82 },
    ],
    missing: ['React Native', 'WebGL'],
  },
]

const ADVANCE_INTERVAL_MS = 6000

function FitReportCard({ report }: { report: FitReport }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{report.role}</CardTitle>
        <CardDescription>{report.company}</CardDescription>
        <CardAction>
          <div className="text-right leading-none">
            <div className="font-heading text-2xl font-semibold tabular-nums">
              {report.score}%
            </div>
            <div className="mt-1 text-xs text-muted-foreground">fit</div>
          </div>
        </CardAction>
      </CardHeader>

      {/* `flex-1` keeps the footer pinned to the bottom, so cards of differing
          title lengths still line up across slides. */}
      <CardContent className="flex flex-1 flex-col justify-center gap-3.5">
        {report.breakdown.map(({ label, value }) => (
          <div key={label} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-medium tabular-nums">{value}</span>
            </div>
            <Progress value={value} />
          </div>
        ))}
      </CardContent>

      <CardFooter className="flex-col items-start gap-2">
        <span className="text-xs text-muted-foreground">Missing</span>
        <div className="flex flex-wrap gap-1.5">
          {report.missing.map((skill) => (
            <Badge key={skill} variant="outline" className="bg-background">
              {skill}
            </Badge>
          ))}
        </div>
      </CardFooter>
    </Card>
  )
}

/**
 * Decorative gallery, so the whole block is `aria-hidden` and the dots are
 * removed from the tab order: announcing invented scores on a sign-in page
 * would only confuse, and nothing focusable should sit inside a hidden
 * subtree. Sighted users can still drag, click a dot, or let it advance.
 */
export function FitReportCarousel() {
  const [api, setApi] = React.useState<CarouselApi>()
  const [selected, setSelected] = React.useState(0)
  const [paused, setPaused] = React.useState(false)

  React.useEffect(() => {
    if (!api) return

    const onSelect = () => setSelected(api.selectedScrollSnap())
    onSelect()
    api.on('select', onSelect)

    return () => {
      api.off('select', onSelect)
    }
  }, [api])

  React.useEffect(() => {
    if (!api || paused) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const timer = window.setInterval(
      () => api.scrollNext(),
      ADVANCE_INTERVAL_MS,
    )

    return () => window.clearInterval(timer)
  }, [api, paused])

  return (
    <div
      aria-hidden
      className="flex flex-col gap-4"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <Carousel setApi={setApi} opts={{ loop: true }}>
        <CarouselContent>
          {REPORTS.map((report) => (
            <CarouselItem key={report.role}>
              <FitReportCard report={report} />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      <div className="flex justify-center gap-1">
        {REPORTS.map((report, index) => (
          <button
            key={report.role}
            type="button"
            tabIndex={-1}
            onClick={() => api?.scrollTo(index)}
            className="group cursor-pointer p-1.5"
          >
            <span
              className={cn(
                'block size-1.5 rounded-full transition-colors',
                index === selected
                  ? 'bg-foreground'
                  : 'bg-foreground/20 group-hover:bg-foreground/40',
              )}
            />
          </button>
        ))}
      </div>
    </div>
  )
}
