'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'

/**
 * Lives in the app rather than the component library: the library stays free of
 * framework-specific dependencies, and theming is app infrastructure.
 */
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
