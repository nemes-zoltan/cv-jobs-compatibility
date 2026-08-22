import Link from 'next/link'
import { ArrowLeftIcon } from 'lucide-react'

/**
 * The way back up, above a page's own heading.
 *
 * A single link rather than a crumb trail: the app is one level deep, and
 * "Dashboard / My Resume" would spend a line telling you what the header
 * already shows.
 */
export function BackLink({ href = '/', label = 'Back to dashboard' }: { href?: string; label?: string }) {
  return (
    <Link
      href={href}
      className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
    >
      <ArrowLeftIcon className="size-4 shrink-0" />
      {label}
    </Link>
  )
}
