import { Test } from '@nestjs/testing'
import { ConfigModule } from './config.module'
import { BaseConfigService } from './config.service'
import { DevelopmentConfigService } from './development-config.service'
import { ProductionConfigService } from './production-config.service'

describe('ConfigModule', () => {
  const originalEnv = process.env

  /**
   * Builds an environment and asks the module for the config it produces.
   * `undefined` unsets a variable rather than setting it to the string
   * `"undefined"`, which is what a plain spread would leave behind.
   */
  const envWith = (env: NodeJS.ProcessEnv): NodeJS.ProcessEnv => {
    // The auth and storage settings have no defaults in code, so every case
    // supplies them unless it is testing that very rule.
    const required = {
      JWT_SECRET: 'test-secret',
      ACCESS_TOKEN_TTL: '60',
      REFRESH_TOKEN_TTL: '604800',
      S3_BUCKET: 'test-bucket',
      UPLOAD_URL_TTL: '300',
      S3_ACCESS_KEY_ID: 'test-key-id',
      S3_SECRET_ACCESS_KEY: 'test-secret-key',
    }
    const merged: NodeJS.ProcessEnv = { ...required, ...originalEnv, ...env }
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) delete merged[key]
    }
    return merged
  }

  const configFor = async (env: NodeJS.ProcessEnv): Promise<BaseConfigService> => {
    process.env = envWith(env)
    const moduleRef = await Test.createTestingModule({ imports: [ConfigModule] }).compile()
    return moduleRef.get(BaseConfigService)
  }

  afterEach(() => {
    process.env = originalEnv
  })

  it('provides the production config when NODE_ENV is production', async () => {
    const config = await configFor({ NODE_ENV: 'production' })

    expect(config).toBeInstanceOf(ProductionConfigService)
    expect(config.isProduction).toBe(true)
    expect(config.databaseLogging).toBe(false)
    expect(config.databasePoolMax).toBe(20)
    // Encrypted, but the server certificate is not verified without a CA.
    expect(config.databaseSsl).toEqual({ rejectUnauthorized: false })
  })

  it('verifies the server certificate when a CA bundle is supplied', async () => {
    const config = await configFor({
      NODE_ENV: 'production',
      DATABASE_CA_CERT: '-----BEGIN CERTIFICATE-----',
    })

    expect(config.databaseSsl).toEqual({
      ca: '-----BEGIN CERTIFICATE-----',
      rejectUnauthorized: true,
    })
  })

  it('falls back to the development config', async () => {
    const config = await configFor({ NODE_ENV: undefined })

    expect(config).toBeInstanceOf(DevelopmentConfigService)
    expect(config.isProduction).toBe(false)
    expect(config.databaseSsl).toBe(false)
    expect(config.databaseLogging).toBe(true)
    expect(config.databasePoolMax).toBe(5)
  })

  it('lets the environment override the pool size', async () => {
    const config = await configFor({ NODE_ENV: 'production', DATABASE_POOL_MAX: '42' })

    expect(config.databasePoolMax).toBe(42)
  })

  describe('authentication settings', () => {
    it('takes the signing key and both lifetimes from the environment', async () => {
      const config = await configFor({
        JWT_SECRET: 'a-secret-from-the-environment',
        ACCESS_TOKEN_TTL: '30',
        REFRESH_TOKEN_TTL: '3600',
      })

      expect(config.jwtSecret).toBe('a-secret-from-the-environment')
      expect(config.accessTokenTtl).toBe(30)
      expect(config.refreshTokenTtl).toBe(3600)
    })

    /**
     * The important one. A key with a fallback in code is a key an attacker
     * already has, so a missing one has to stop the process rather than quietly
     * issue forgeable tokens.
     */
    it('refuses to start without a signing key, in any environment', async () => {
      await expect(configFor({ NODE_ENV: 'production', JWT_SECRET: undefined })).rejects.toThrow('JWT_SECRET')
      await expect(configFor({ NODE_ENV: undefined, JWT_SECRET: undefined })).rejects.toThrow('JWT_SECRET')
    })

    it('refuses to start without token lifetimes', async () => {
      await expect(configFor({ ACCESS_TOKEN_TTL: undefined })).rejects.toThrow('ACCESS_TOKEN_TTL')
      await expect(configFor({ REFRESH_TOKEN_TTL: undefined })).rejects.toThrow('REFRESH_TOKEN_TTL')
    })

    /** `Number('fifteen')` is `NaN`, which would otherwise surface much later
     * as an unreadable error from the JWT library. */
    it('rejects a lifetime that is not a positive whole number', async () => {
      await expect(configFor({ ACCESS_TOKEN_TTL: 'fifteen' })).rejects.toThrow('positive integer')
      await expect(configFor({ ACCESS_TOKEN_TTL: '0' })).rejects.toThrow('positive integer')
      await expect(configFor({ ACCESS_TOKEN_TTL: '-60' })).rejects.toThrow('positive integer')
      await expect(configFor({ ACCESS_TOKEN_TTL: '1.5' })).rejects.toThrow('positive integer')
    })

    it('marks cookies Secure only where traffic is served over TLS', async () => {
      await expect(configFor({ NODE_ENV: undefined })).resolves.toMatchObject({ cookieSecure: false })
      await expect(configFor({ NODE_ENV: 'production' })).resolves.toMatchObject({ cookieSecure: true })
    })
  })

  describe('storage settings', () => {
    it('points development at the MinIO container with path-style addressing', async () => {
      // Passed here rather than left to the defaults: `envWith` lets the real
      // environment win, and `apps/api/.env` sets these.
      const config = await configFor({
        NODE_ENV: undefined,
        S3_ENDPOINT: 'http://localhost:9000',
        S3_ACCESS_KEY_ID: 'test-key-id',
        S3_SECRET_ACCESS_KEY: 'test-secret-key',
      })

      expect(config.s3Endpoint).toBe('http://localhost:9000')
      expect(config.s3ForcePathStyle).toBe(true)
      expect(config.s3Credentials).toEqual({
        accessKeyId: 'test-key-id',
        secretAccessKey: 'test-secret-key',
      })
    })

    /**
     * The one that matters for deployment. Leaving both unset is what makes the
     * SDK derive the real endpoint and reach for the task role, so a static key
     * pair never has to exist in a task definition.
     */
    it('leaves the endpoint and credentials to the SDK in production', async () => {
      const config = await configFor({ NODE_ENV: 'production' })

      expect(config.s3Endpoint).toBeUndefined()
      expect(config.s3Credentials).toBeUndefined()
      expect(config.s3ForcePathStyle).toBe(false)
    })

    it('refuses to start without a bucket or an upload lifetime', async () => {
      await expect(configFor({ S3_BUCKET: undefined })).rejects.toThrow('S3_BUCKET')
      await expect(configFor({ UPLOAD_URL_TTL: undefined })).rejects.toThrow('UPLOAD_URL_TTL')
    })

    /** Production has no static credentials to miss; development does. */
    it('refuses to start development without MinIO credentials', async () => {
      await expect(configFor({ NODE_ENV: undefined, S3_ACCESS_KEY_ID: undefined })).rejects.toThrow(
        'S3_ACCESS_KEY_ID',
      )
      await expect(
        configFor({ NODE_ENV: 'production', S3_ACCESS_KEY_ID: undefined }),
      ).resolves.toMatchObject({ s3Credentials: undefined })
    })

    it('defaults the signing region rather than requiring one', async () => {
      await expect(configFor({ S3_REGION: undefined })).resolves.toMatchObject({ s3Region: 'us-east-1' })
      await expect(configFor({ S3_REGION: 'eu-west-1' })).resolves.toMatchObject({ s3Region: 'eu-west-1' })
    })
  })
})
