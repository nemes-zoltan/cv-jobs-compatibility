import { Test } from '@nestjs/testing'
import { ConfigModule } from './config.module'
import { BaseConfigService } from './config.service'
import { DevelopmentConfigService } from './development-config.service'
import { ProductionConfigService } from './production-config.service'

describe('ConfigModule', () => {
  const originalEnv = process.env

  const configFor = async (env: NodeJS.ProcessEnv): Promise<BaseConfigService> => {
    process.env = { ...originalEnv, ...env }
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
})
