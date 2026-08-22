import { PoolConfig } from 'pg'
import { BaseConfigService } from './config.service'

export class ProductionConfigService extends BaseConfigService {
  readonly databasePoolMax = Number(process.env.DATABASE_POOL_MAX ?? 20)

  private readonly caCert = process.env.DATABASE_CA_CERT

  /**
   * RDS presents a certificate signed by an Amazon CA that Node does not trust
   * out of the box. Pass the RDS CA bundle in `DATABASE_CA_CERT` to get a fully
   * verified connection; without it the traffic is still encrypted, but the
   * server identity is not checked.
   */
  readonly databaseSsl: PoolConfig['ssl'] = this.caCert
    ? { ca: this.caCert, rejectUnauthorized: true }
    : { rejectUnauthorized: false }

  readonly databaseLogging = false

  /** Deployments terminate TLS at the load balancer; nothing here is served
   * over plain HTTP. */
  readonly cookieSecure = true

  /** Real S3: the SDK derives the endpoint from the region. */
  readonly s3Endpoint = undefined

  readonly s3ForcePathStyle = false

  /**
   * The SDK's provider chain, which on ECS is the task role. Deliberately not
   * from the environment - a static key pair in a task definition is a
   * long-lived credential that has to be rotated.
   */
  readonly s3Credentials = undefined
}
