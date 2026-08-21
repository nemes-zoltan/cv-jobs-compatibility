/**
 * Connection-string helpers.
 *
 * Kept free of any NestJS import so `drizzle.config.ts` can reuse them without
 * pulling the framework into drizzle-kit's bundle.
 */

/**
 * Resolves the Postgres connection string from the environment.
 *
 * `DATABASE_URL` wins when it is set (local development, most PaaS). Otherwise
 * the discrete values are assembled, which is what a deployment usually has to
 * work with: an RDS-managed secret exposes host, port, username, password and
 * dbname as separate keys, and ECS injects them as separate task-definition
 * variables.
 */
export function resolveDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  if (env.DATABASE_URL) return env.DATABASE_URL

  // Generated passwords routinely contain characters that are not URL-safe.
  const user = encodeURIComponent(env.POSTGRES_USER ?? '')
  const password = encodeURIComponent(env.POSTGRES_PASSWORD ?? '')
  const host = env.POSTGRES_HOST ?? 'localhost'
  const port = env.POSTGRES_PORT ?? '5432'
  const database = env.POSTGRES_DB ?? ''

  return `postgresql://${user}:${password}@${host}:${port}/${database}`
}

/** Strips the password so a connection string can safely be logged. */
export function redactDatabaseUrl(url: string): string {
  try {
    const parsed = new URL(url)
    if (parsed.password) parsed.password = '***'
    return parsed.toString()
  } catch {
    return '<unparseable database URL>'
  }
}
