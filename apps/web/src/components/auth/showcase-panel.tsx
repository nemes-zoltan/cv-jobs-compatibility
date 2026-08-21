import { CheckIcon } from 'lucide-react'
import { Badge } from '@cv-jobs-compatibility/components'
import { FitReportCarousel } from '@/components/auth/fit-report-carousel'

const HIGHLIGHTS = [
  'Score every role against your CV, not a keyword filter',
  'See the gaps that actually cost you the interview',
  'Ask follow-up questions and get answers with citations',
]

/** Decorative half of the auth screens. Dropped entirely below `lg`. */
export function ShowcasePanel() {
  return (
    // `bg-muted/40` keeps the sample cards reading as raised against the panel
    // in both themes: lighter than the panel in light mode, and still a step up
    // from it once the dark tokens invert.
    <aside className="relative hidden overflow-hidden border-l border-border bg-muted/40 lg:flex lg:flex-col lg:justify-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(var(--color-border)_1px,transparent_1px)] [background-size:18px_18px] [mask-image:radial-gradient(ellipse_at_50%_40%,black,transparent_72%)]"
      />

      <div className="relative mx-auto flex w-full max-w-md flex-col gap-8 px-10 py-16">
        <div className="flex flex-col gap-4">
          <Badge variant="outline" className="bg-background">
            Career intelligence
          </Badge>
          <h2 className="font-heading text-3xl leading-tight font-semibold tracking-tight text-balance">
            Know exactly where you stand.
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
            Upload your CV, add the roles you are chasing, and get a straight
            answer on fit, gaps, and what to prepare for.
          </p>
        </div>

        <FitReportCarousel />

        <ul className="flex flex-col gap-3">
          {HIGHLIGHTS.map((highlight) => (
            <li
              key={highlight}
              className="flex items-start gap-2.5 text-sm text-muted-foreground"
            >
              <CheckIcon className="mt-0.5 size-4 shrink-0 text-foreground" />
              <span className="text-pretty">{highlight}</span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}
