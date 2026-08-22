import type { S3ClientConfig } from '@aws-sdk/client-s3'
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

  /** pg-boss keeps its own pool, including one connection pinned to LISTEN. */
  readonly queuePoolMax = Number(process.env.QUEUE_POOL_MAX ?? 4)

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

  readonly s3Bucket = requireEnv('S3_BUCKET')

  /** SigV4 signs the region, so it must match between signing and verifying. */
  readonly s3Region = process.env.S3_REGION ?? 'us-east-1'

  /** Seconds a presigned upload URL stays valid. */
  readonly uploadUrlTtl = requireIntEnv('UPLOAD_URL_TTL')

  /** `undefined` means AWS's own endpoint, derived from the region. */
  abstract readonly s3Endpoint: string | undefined

  /** MinIO needs path style; S3 prefers virtual-hosted. */
  abstract readonly s3ForcePathStyle: boolean

  /** `undefined` lets the SDK find credentials itself - in production, the task role. */
  abstract readonly s3Credentials: S3ClientConfig['credentials']

  /**
   * Deliberately a getter rather than a field.
   *
   * Only the worker calls Gemini. Reading this eagerly would make the HTTP
   * process refuse to start without a key it never uses - and, worse, mean
   * handing that process a secret it has no business holding.
   */
  get geminiApiKey(): string {
    return requireEnv('GOOGLE_GEMINI_API_KEY')
  }

  /**
   * Pinned, never an alias like `gemini-flash-latest`. Every extraction row
   * stores the model that produced it, and that record is worthless if the name
   * quietly means something different next month.
   */
  readonly geminiModel = process.env.GEMINI_MODEL ?? 'gemini-3.6-flash'

  /** A CV is a couple of pages; anything slower than this is a stuck request. */
  readonly geminiTimeoutMs = Number(process.env.GEMINI_TIMEOUT_MS ?? 60_000)
}
