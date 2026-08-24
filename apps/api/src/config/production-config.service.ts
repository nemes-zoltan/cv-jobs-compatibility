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

  /**
   * Deployments terminate TLS at the load balancer, so this is `true` unless
   * something explicitly opts out.
   *
   * The opt-out exists for one case: the throwaway AWS demo, whose ALB has no
   * certificate because the deploying account is denied ACM. A browser refuses
   * to store a `Secure` cookie set over plain HTTP, so leaving this on there
   * means sign-in returns 200 and no session ever exists. Setting
   * `COOKIE_SECURE=false` trades that for a session anyone on the wire can
   * read - acceptable for a demo that is destroyed the same day, and for
   * nothing else. See ARCHITECTURE.md.
   */
  readonly cookieSecure = process.env.COOKIE_SECURE !== 'false'

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
