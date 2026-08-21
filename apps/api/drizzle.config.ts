import { config as loadEnv } from 'dotenv'
import { defineConfig } from 'drizzle-kit'
import { join } from 'node:path'
import { resolveDatabaseUrl } from './src/config/database-url'

// drizzle-kit runs outside Nx, so it loads this app's .env itself. Where that
// file does not exist - CI, or a migration task on ECS - the variables are
// expected to be in the environment already and this is a no-op.
loadEnv({ path: join(__dirname, '.env'), quiet: true })

export default defineConfig({
  schema: './src/database/schema/index.ts',
  out: './src/database/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: resolveDatabaseUrl(),
    // Managed Postgres requires TLS; the local container does not offer it.
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  },
  // Must match the `casing` passed to drizzle() in database.module.ts.
  casing: 'snake_case',
  // Warn before running anything destructive.
  strict: true,
  verbose: true,
})
