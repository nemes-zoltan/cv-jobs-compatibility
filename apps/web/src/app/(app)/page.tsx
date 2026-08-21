import { FileUpIcon, MessagesSquareIcon, ScanSearchIcon, TargetIcon } from 'lucide-react'
import { Badge, Button, Card, CardContent } from '@cv-jobs-compatibility/components'
import { Greeting } from '@/components/greeting'

/**
 * The home screen, with nothing to show yet.
 *
 * Everything here is an empty state on purpose: there are no resumes to list
 * until that table exists. The upload control is visibly disabled rather than
 * hidden, so the page reads as unfinished rather than as broken.
 */

const CAPABILITIES = [
  {
    icon: TargetIcon,
    title: 'Score every role',
    description: 'Against your CV, not a keyword filter.',
  },
  {
    icon: ScanSearchIcon,
    title: 'See the gaps',
    description: 'The ones that actually cost you the interview.',
  },
  {
    icon: MessagesSquareIcon,
    title: 'Ask follow-ups',
    description: 'And get answers with citations.',
  },
]

export default function Index() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-12 md:px-10 md:py-16">
      <div className="flex flex-col gap-2">
        <Greeting />
        <p className="text-sm text-muted-foreground text-pretty">
          Add a CV to start measuring it against the roles you are chasing.
        </p>
      </div>

      {/* `Card` draws itself with a ring and its own vertical padding; an empty
          state wants a dashed outline and room to breathe instead. */}
      <Card className="relative border border-dashed border-border bg-transparent py-0 ring-0">
        {/* The same dotted field as the auth showcase, so the two halves of the
            product look like one. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(var(--color-border)_1px,transparent_1px)] [background-size:18px_18px] [mask-image:radial-gradient(ellipse_at_50%_35%,black,transparent_70%)]"
        />

        <CardContent className="relative flex flex-col items-center gap-5 px-6 py-14 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl border border-border bg-background">
            <FileUpIcon className="size-5 text-muted-foreground" />
          </span>

          <div className="flex max-w-sm flex-col gap-1.5">
            <h2 className="font-heading text-lg font-semibold tracking-tight">
              No CV yet
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
              Upload one and every role you add gets scored against it.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button disabled>Upload CV</Button>
            <Badge variant="outline" className="bg-background">
              Coming soon
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        {CAPABILITIES.map(({ icon: Icon, title, description }) => (
          <Card key={title} className="bg-muted/40">
            <CardContent className="flex flex-col gap-2 px-5">
              <Icon className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">{title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
                {description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
