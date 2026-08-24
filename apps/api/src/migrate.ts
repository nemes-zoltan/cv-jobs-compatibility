import { join } from 'node:path'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { redactDatabaseUrl, resolveDatabaseUrl } from './config/database-url'

/**
 * The third entrypoint: applies migrations, then exits.
 *
 * Deliberately not `drizzle-kit migrate`, which is what the `db:migrate` script
 * runs locally. drizzle-kit is a devDependency, its config is TypeScript that
 * imports from `src/`, and neither is in a bundle - so using it in a deployment
 * would mean shipping a build tool and a TypeScript runtime in the production
 * image to run one task. `drizzle-orm`'s own migrator is a runtime dependency
 * that is already here, and it reads the same journal that drizzle-kit writes,
 * so the two agree about what has been applied.
 *
 * `drizzle-kit generate` stays exactly as it is: a developer tool that never
 * enters an image. Only applying moved.
 *
 * Nothing migrates on boot - see ARCHITECTURE.md. This runs as a one-off task
 * before a service update, because several instances racing to alter the same
 * schema on every scaling event is the problem being avoided.
 */

/**
 * The SQL ships beside this bundle, copied in by webpack. Overridable because
 * the migration task is the one thing somebody might want to point at a folder
 * of their own while debugging a deployment.
 */
const migrationsFolder = process.env.MIGRATIONS_DIR ?? join(__dirname, 'migrations')

async function main(): Promise<void> {
  const databaseUrl = resolveDatabaseUrl()
  const pool = new Pool({
    connectionString: databaseUrl,
    // Managed Postgres requires TLS; a local container does not offer it. Same
    // rule as drizzle.config.ts, and it has to stay the same rule.
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    // One connection: this process does one thing and then stops.
    max: 1,
  })

  console.log(`Applying migrations from ${migrationsFolder} to ${redactDatabaseUrl(databaseUrl)}`)

  try {
    await migrate(drizzle(pool), { migrationsFolder })
    console.log('Migrations applied')
  } finally {
    await pool.end()
  }
}

main().catch((error: unknown) => {
  console.error('Migration failed:', error)
  // A non-zero exit is the whole contract with whatever runs this: a deployment
  // that carries on after a failed migration is a deployment running code
  // against a schema that does not support it.
  process.exit(1)
})
