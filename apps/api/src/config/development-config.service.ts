import { PoolConfig } from 'pg'
import { BaseConfigService } from './config.service'

export class DevelopmentConfigService extends BaseConfigService {
  readonly databasePoolMax = Number(process.env.DATABASE_POOL_MAX ?? 5)

  /** The local Postgres container speaks plaintext. */
  readonly databaseSsl: PoolConfig['ssl'] = false

  /** Echo the SQL Drizzle generates while developing. */
  readonly databaseLogging = true

  /** A `Secure` cookie is dropped on a plain-HTTP localhost. */
  readonly cookieSecure = false
}
