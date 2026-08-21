import { PoolConfig } from 'pg'
import { resolveDatabaseUrl } from './database-url'
import { requireEnv, requireIntEnv } from './env'

/**
 * Configuration read straight off `process.env`.
 *
 * Nothing loads a `.env` file here: Nx injects those into the environment for
 * `nx serve`, and a deployed container gets its variables from the ECS task
 * definition. The process environment is the only source.
 *
 * Values are captured when the instance is created, which is once at startup.
 * The abstract members are the settings that differ per environment; the
 * concrete subclasses supply them and `ConfigModule` picks one.
 */
export abstract class BaseConfigService {
  readonly nodeEnv = process.env.NODE_ENV ?? 'development'
  readonly isProduction = this.nodeEnv === 'production'

  readonly port = Number(process.env.PORT ?? 4000)
  readonly webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000'

  readonly databaseUrl = resolveDatabaseUrl()

  /** Connections a single instance keeps open. */
  abstract readonly databasePoolMax: number

  /** TLS settings handed to `pg`. */
  abstract readonly databaseSsl: PoolConfig['ssl']

  /** Whether Drizzle echoes every statement it runs. */
  abstract readonly databaseLogging: boolean

  /**
   * Signing key for both token types. Required everywhere: a key that lives in
   * the source is a key an attacker already has, so there is no default to fall
   * back to.
   */
  readonly jwtSecret = requireEnv('JWT_SECRET')

  /** Seconds an access token stays valid. */
  readonly accessTokenTtl = requireIntEnv('ACCESS_TOKEN_TTL')

  /**
   * Seconds a refresh token stays valid, and therefore how long a session can
   * survive without the user signing in again. Not extended on use: a session
   * ends a fixed interval after it started rather than sliding forward forever.
   */
  readonly refreshTokenTtl = requireIntEnv('REFRESH_TOKEN_TTL')

  /** Whether auth cookies carry the `Secure` flag. */
  abstract readonly cookieSecure: boolean
}
