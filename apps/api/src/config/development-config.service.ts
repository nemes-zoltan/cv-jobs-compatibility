import type { S3ClientConfig } from '@aws-sdk/client-s3'
import { PoolConfig } from 'pg'
import { BaseConfigService } from './config.service'
import { requireEnv } from './env'

export class DevelopmentConfigService extends BaseConfigService {
  readonly databasePoolMax = Number(process.env.DATABASE_POOL_MAX ?? 5)

  /** The local Postgres container speaks plaintext. */
  readonly databaseSsl: PoolConfig['ssl'] = false

  /** Echo the SQL Drizzle generates while developing. */
  readonly databaseLogging = true

  /** A `Secure` cookie is dropped on a plain-HTTP localhost. */
  readonly cookieSecure = false

  /**
   * The MinIO container. Must be the address the *browser* can reach, since the
   * presigned URL signed here is opened there.
   */
  readonly s3Endpoint = process.env.S3_ENDPOINT ?? 'http://localhost:9000'

  readonly s3ForcePathStyle = true

  readonly s3Credentials: S3ClientConfig['credentials'] = {
    accessKeyId: requireEnv('S3_ACCESS_KEY_ID'),
    secretAccessKey: requireEnv('S3_SECRET_ACCESS_KEY'),
  }
}
