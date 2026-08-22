import { UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { Test } from '@nestjs/testing'
import * as argon2 from 'argon2'
import { BaseConfigService } from '../config/config.service'
import { UserRow } from '../database/schema/users'
import { UsersService } from '../users/users.service'
import { AuthService, TokenPayload } from './auth.service'

const JWT_SECRET = 'test-secret'

const jwt = new JwtService({ secret: JWT_SECRET })

/** Only the members AuthService touches. */
const testConfig = (overrides: Partial<BaseConfigService> = {}) =>
  ({
    accessTokenTtl: 60,
    refreshTokenTtl: 604800,
    jwtSecret: JWT_SECRET,
    cookieSecure: false,
    ...overrides,
  }) as BaseConfigService

describe('AuthService', () => {
  const users = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    hasResume: jest.fn().mockResolvedValue(false),
    create: jest.fn(),
  }

  const createService = async (config = testConfig()): Promise<AuthService> => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: users },
        { provide: JwtService, useValue: jwt },
        { provide: BaseConfigService, useValue: config },
      ],
    }).compile()

    return moduleRef.get(AuthService)
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('register', () => {
    it('hashes the password with argon2id and never persists the plaintext', async () => {
      const service = await createService()
      users.create.mockImplementation(
        async ({ passwordHash }: { passwordHash: string }): Promise<UserRow> => ({
          id: 'user-1',
          email: 'ada@example.com',
          passwordHash,
          name: 'Ada',
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      )

      const result = await service.register({
        email: 'ada@example.com',
        password: 'correct horse battery staple',
        name: 'Ada',
      })

      const { passwordHash } = users.create.mock.calls[0][0]
      expect(passwordHash).toMatch(/^\$argon2id\$/)
      expect(passwordHash).not.toContain('correct horse battery staple')
      // The stored digest verifies against the original password.
      await expect(argon2.verify(passwordHash, 'correct horse battery staple')).resolves.toBe(true)
      // And the response carries no trace of it.
      expect(result.user).not.toHaveProperty('passwordHash')
      expect(result.user).toMatchObject({ id: 'user-1', email: 'ada@example.com', name: 'Ada' })
    })
  })

  describe('login', () => {
    const existingUser = async (password: string): Promise<UserRow> => ({
      id: 'user-1',
      email: 'ada@example.com',
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      name: 'Ada',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    it('returns the user and a token pair for the right password', async () => {
      const service = await createService()
      users.findByEmail.mockResolvedValue(await existingUser('correct horse battery staple'))

      const result = await service.login({ email: 'ada@example.com', password: 'correct horse battery staple' })

      expect(result.user.id).toBe('user-1')
      expect(result.tokens.accessToken).toEqual(expect.any(String))
      expect(result.tokens.refreshToken).toEqual(expect.any(String))
    })

    it('rejects a wrong password', async () => {
      const service = await createService()
      users.findByEmail.mockResolvedValue(await existingUser('correct horse battery staple'))

      await expect(service.login({ email: 'ada@example.com', password: 'wrong' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      )
    })

    it('gives an unknown address the same message as a wrong password', async () => {
      const service = await createService()
      users.findByEmail.mockResolvedValue(await existingUser('correct horse battery staple'))
      const knownFailure = await service
        .login({ email: 'ada@example.com', password: 'wrong' })
        .catch((error: UnauthorizedException) => error.message)

      users.findByEmail.mockResolvedValue(undefined)
      const unknownFailure = await service
        .login({ email: 'nobody@example.com', password: 'wrong' })
        .catch((error: UnauthorizedException) => error.message)

      // Identical wording is what stops the endpoint confirming which addresses
      // are registered.
      expect(unknownFailure).toBe(knownFailure)
    })
  })

  describe('token verification', () => {
    it('refuses a refresh token presented as an access token', async () => {
      const service = await createService()
      users.findByEmail.mockResolvedValue(undefined)
      const refreshToken = await jwt.signAsync({ sub: 'user-1', type: 'refresh' } satisfies TokenPayload)

      await expect(service.verifyToken(refreshToken, 'access')).rejects.toBeInstanceOf(UnauthorizedException)
    })

    it('refuses an access token presented for refresh', async () => {
      const service = await createService()
      const accessToken = await jwt.signAsync({ sub: 'user-1', type: 'access' } satisfies TokenPayload)

      await expect(service.refresh(accessToken)).rejects.toBeInstanceOf(UnauthorizedException)
    })

    it('refuses a token signed with a different key', async () => {
      const service = await createService()
      const foreign = new JwtService({ secret: 'someone-elses-secret' })
      const token = await foreign.signAsync({ sub: 'user-1', type: 'access' } satisfies TokenPayload)

      await expect(service.verifyToken(token, 'access')).rejects.toBeInstanceOf(UnauthorizedException)
    })

    it('refuses an expired token', async () => {
      const service = await createService(testConfig({ accessTokenTtl: -10 }))
      const expired = await jwt.signAsync({ sub: 'user-1', type: 'access' } satisfies TokenPayload, {
        expiresIn: -10,
      })

      await expect(service.verifyToken(expired, 'access')).rejects.toBeInstanceOf(UnauthorizedException)
    })

    it('refuses a missing token', async () => {
      const service = await createService()

      await expect(service.verifyToken(undefined, 'access')).rejects.toBeInstanceOf(UnauthorizedException)
    })
  })

  describe('refresh', () => {
    it('issues a usable access token without touching the database', async () => {
      const service = await createService()
      const refreshToken = await jwt.signAsync({ sub: 'user-1', type: 'refresh' } satisfies TokenPayload)

      const accessToken = await service.refresh(refreshToken)

      await expect(service.verifyToken(accessToken, 'access')).resolves.toMatchObject({
        sub: 'user-1',
        type: 'access',
      })
      expect(users.findById).not.toHaveBeenCalled()
    })
  })
})
