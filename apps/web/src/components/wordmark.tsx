import Link from 'next/link'
import { TargetIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { APP_NAME } from '@/lib/app'

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn(
        'flex w-fit items-center gap-2 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
        className,
      )}
    >
      <span className="flex size-7 items-center justify-center rounded-lg bg-foreground text-background">
        <TargetIcon className="size-4" />
      </span>
      <span className="font-heading text-[0.95rem] font-semibold tracking-tight">
        {APP_NAME}
      </span>
    </Link>
  )
}
