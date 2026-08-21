import { Logger, ServiceUnavailableException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { DRIZZLE } from '../database/database.constants'
import { HealthController } from './health.controller'
import { HealthService } from './health.service'

describe('HealthController', () => {
  const execute = jest.fn()

  const createController = async (): Promise<HealthController> => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [HealthService, { provide: DRIZZLE, useValue: { execute } }],
    }).compile()

    return moduleRef.get(HealthController)
  }

  beforeEach(() => {
    execute.mockReset()
    // The down-path test logs an expected error; keep it out of the report.
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('reports ok when the database answers', async () => {
    execute.mockResolvedValue({ rows: [{ '?column?': 1 }] })
    const controller = await createController()

    await expect(controller.check()).resolves.toEqual({
      status: 'ok',
      services: { database: 'up' },
    })
  })

  it('fails with 503 when the database is unreachable', async () => {
    execute.mockRejectedValue(new Error('ECONNREFUSED'))
    const controller = await createController()

    await expect(controller.check()).rejects.toBeInstanceOf(ServiceUnavailableException)
  })
})
