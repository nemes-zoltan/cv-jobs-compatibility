import { ConflictException } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { DRIZZLE } from '../database/database.constants'
import { UserRow } from '../database/schema/users'
import { UsersService } from './users.service'

/**
 * Stands in for the Drizzle query builder. Each method returns the next link in
 * the chain, so `select().from().where().limit()` resolves to whatever `limit`
 * is told to return.
 */
function createDatabase() {
  const limit = jest.fn()
  const returning = jest.fn()
  const values = jest.fn(() => ({ returning }))

  return {
    db: {
      select: jest.fn(() => ({ from: jest.fn(() => ({ where: jest.fn(() => ({ limit })) })) })),
      insert: jest.fn(() => ({ values })),
    },
    limit,
    values,
    returning,
  }
}

const userRow = (overrides: Partial<UserRow> = {}): UserRow => ({
  id: '0f8fad5b-d9cb-469f-a165-70867728950e',
  email: 'ada@example.com',
  passwordHash: '$argon2id$stub',
  name: 'Ada Lovelace',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
})

describe('UsersService', () => {
  let database: ReturnType<typeof createDatabase>

  const createService = async (): Promise<UsersService> => {
    database = createDatabase()
    const moduleRef = await Test.createTestingModule({
      providers: [UsersService, { provide: DRIZZLE, useValue: database.db }],
    }).compile()

    return moduleRef.get(UsersService)
  }

  describe('normalizeEmail', () => {
    it('lower-cases and trims, so one address cannot become two accounts', () => {
      expect(UsersService.normalizeEmail('  Ada@Example.COM ')).toBe('ada@example.com')
    })
  })

  describe('create', () => {
    it('stores the normalized email and a trimmed name', async () => {
      const service = await createService()
      database.returning.mockResolvedValue([userRow()])

      await service.create({
        email: '  Ada@Example.com ',
        name: '  Ada Lovelace  ',
        passwordHash: '$argon2id$stub',
      })

      expect(database.values).toHaveBeenCalledWith({
        email: 'ada@example.com',
        name: 'Ada Lovelace',
        passwordHash: '$argon2id$stub',
      })
    })

    it('turns a unique violation into a 409 rather than a 500', async () => {
      const service = await createService()
      database.returning.mockRejectedValue(Object.assign(new Error('duplicate key'), { code: '23505' }))

      await expect(service.create({ email: 'ada@example.com', name: 'Ada', passwordHash: 'x' })).rejects.toBeInstanceOf(
        ConflictException,
      )
    })

    it('finds the violation when the driver error is wrapped by Drizzle', async () => {
      const service = await createService()
      const wrapped = new Error('Failed query')
      wrapped.cause = Object.assign(new Error('duplicate key'), { code: '23505' })
      database.returning.mockRejectedValue(wrapped)

      await expect(service.create({ email: 'ada@example.com', name: 'Ada', passwordHash: 'x' })).rejects.toBeInstanceOf(
        ConflictException,
      )
    })

    it('lets an unrelated database error through untouched', async () => {
      const service = await createService()
      database.returning.mockRejectedValue(Object.assign(new Error('connection lost'), { code: '08006' }))

      await expect(service.create({ email: 'ada@example.com', name: 'Ada', passwordHash: 'x' })).rejects.toThrow(
        'connection lost',
      )
    })
  })

  describe('lookups', () => {
    it('returns the matching row', async () => {
      const service = await createService()
      database.limit.mockResolvedValue([userRow()])

      await expect(service.findByEmail('ADA@example.com')).resolves.toEqual(userRow())
    })

    it('returns undefined when nothing matches', async () => {
      const service = await createService()
      database.limit.mockResolvedValue([])

      await expect(service.findById('0f8fad5b-d9cb-469f-a165-70867728950e')).resolves.toBeUndefined()
    })
  })
})
