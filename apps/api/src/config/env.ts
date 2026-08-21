/**
 * Environment readers.
 *
 * Kept free of any NestJS import for the same reason as `database-url.ts`: so
 * `drizzle.config.ts` can reuse them without pulling the framework into
 * drizzle-kit's bundle.
 *
 * There is no schema and no validation layer here - just two readers that turn
 * a missing or unusable value into a clear error at startup, instead of a
 * `undefined` secret or a `NaN` lifetime surfacing much later as something
 * unrecognisable.
 */

/** Reads a variable that the app cannot sensibly run without. */
export function requireEnv(name: string, env: NodeJS.ProcessEnv = process.env): string {
  const value = env[name]
  if (!value) throw new Error(`${name} must be set - see apps/api/.env.example`)

  return value
}

/** Reads a required variable that has to be a positive whole number of seconds. */
export function requireIntEnv(name: string, env: NodeJS.ProcessEnv = process.env): number {
  const raw = requireEnv(name, env)
  const value = Number(raw)
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer, got "${raw}"`)
  }

  return value
}
