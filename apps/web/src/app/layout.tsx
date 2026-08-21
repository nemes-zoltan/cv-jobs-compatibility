import './global.css'
import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { cn } from '@/lib/utils'
import { APP_NAME, APP_TAGLINE } from '@/lib/app'
import { ThemeProvider } from '@/components/theme-provider'

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_TAGLINE,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    // `suppressHydrationWarning` is required by next-themes: it writes the
    // theme class onto <html> before React hydrates, so the server markup and
    // the first client render intentionally disagree on this one attribute.
    <html
      lang="en"
      suppressHydrationWarning
      className={cn('font-sans', geist.variable)}
    >
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
