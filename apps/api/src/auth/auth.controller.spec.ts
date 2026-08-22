import { ConflictException, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { Test } from '@nestjs/testing'
import * as argon2 from 'argon2'
import type { Request, Response } from 'express'
import { BaseConfigService } from '../config/config.service'
import { UserRow } from '../database/schema/users'
import { UsersService } from '../users/users.service'
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE_PATH,
  SESSION_COOKIE,
} from './auth-cookies'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'

const JWT_SECRET = 'test-secret'

const testConfig = (overrides: Partial<BaseConfigService> = {}) =>
  ({
    accessTokenTtl: 60,
    refreshTokenTtl: 604800,
    jwtSecret: JWT_SECRET,
    cookieSecure: false,
    ...overrides,
  }) as BaseConfigService

/** Captures what the handler sets, without an HTTP server in the way. */
function createResponse() {
  return { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as Response & {
    cookie: jest.Mock
    clearCookie: jest.Mock
  }
}

const requestWithCookies = (cookies: Record<string, string>) => ({ cookies }) as unknown as Request

const storedUser = async (password: string): Promise<UserRow> => ({
  id: 'user-1',
  email: 'ada@example.com',
  passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
  name: 'Ada',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
})

describe('AuthController', () => {
  const users = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    hasResume: jest.fn().mockResolvedValue(false),
  }
  const jwt = new JwtService({ secret: JWT_SECRET })

  const createController = async (config = testConfig()): Promise<AuthController> => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        { provide: UsersService, useValue: users },
        { provide: JwtService, useValue: jwt },
        { provide: BaseConfigService, useValue: config },
      ],
    }).compile()

    return moduleRef.get(AuthController)
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('register', () => {
    it('sets all three cookies and returns the user without its password hash', async () => {
      const controller = await createController()
      users.create.mockResolvedValue(await storedUser('correct horse battery staple'))
      const res = createResponse()

      const user = await controller.register(
        { email: 'ada@example.com', password: 'correct horse battery staple', name: 'Ada' },
        res,
      )

      expect(user).toEqual({
        id: 'user-1',
        email: 'ada@example.com',
        name: 'Ada',
        // Serialised at the boundary: `UserModel.createdAt` is an ISO string.
        createdAt: '2026-01-01T00:00:00.000Z',
        // A new account cannot have been through the pipeline yet.
        hasResume: false,
      })
      expect(res.cookie).toHaveBeenCalledTimes(3)
      expect(res.cookie.mock.calls.map(([name]) => name)).toEqual([
        ACCESS_TOKEN_COOKIE,
        REFRESH_TOKEN_COOKIE,
        SESSION_COOKIE,
      ])
    })

    it('surfaces the duplicate-email conflict from the users service', async () => {
      const controller = await createController()
      users.create.mockRejectedValue(new ConflictException('An account with this email already exists'))

      await expect(
        controller.register(
          { email: 'ada@example.com', password: 'correct horse battery staple', name: 'Ada' },
          createResponse(),
        ),
      ).rejects.toBeInstanceOf(ConflictException)
    })
  })

  describe('cookie attributes', () => {
    it('keeps both tokens out of reach of JavaScript', async () => {
      const controller = await createController()
      users.findByEmail.mockResolvedValue(await storedUser('correct horse battery staple'))
      const res = createResponse()

      await controller.login({ email: 'ada@example.com', password: 'correct horse battery staple' }, res)

      for (const [, , options] of res.cookie.mock.calls) {
        expect(options).toMatchObject({ httpOnly: true, sameSite: 'lax' })
      }
    })

    it('scopes the refresh cookie to the auth routes and the access cookie to everything', async () => {
      const controller = await createController()
      users.findByEmail.mockResolvedValue(await storedUser('correct horse battery staple'))
      const res = createResponse()

      await controller.login({ email: 'ada@example.com', password: 'correct horse battery staple' }, res)

      const [[, , accessOptions], [, , refreshOptions]] = res.cookie.mock.calls
      expect(accessOptions).toMatchObject({ path: '/', maxAge: 60_000 })
      expect(refreshOptions).toMatchObject({ path: REFRESH_TOKEN_COOKIE_PATH, maxAge: 604_800_000 })
    })

    it('gives the session marker the refresh lifetime and no credential', async () => {
      const controller = await createController()
      users.findByEmail.mockResolvedValue(await storedUser('correct horse battery staple'))
      const res = createResponse()

      await controller.login({ email: 'ada@example.com', password: 'correct horse battery staple' }, res)

      const [, value, options] = res.cookie.mock.calls[2]
      // A constant. Anything derived from the account would turn a routing hint
      // into something worth stealing.
      expect(value).toBe('1')
      expect(options).toMatchObject({ path: '/', maxAge: 604_800_000 })
    })

    it('marks cookies Secure when the environment says so', async () => {
      const controller = await createController(testConfig({ cookieSecure: true }))
      users.findByEmail.mockResolvedValue(await storedUser('correct horse battery staple'))
      const res = createResponse()

      await controller.login({ email: 'ada@example.com', password: 'correct horse battery staple' }, res)

      for (const [, , options] of res.cookie.mock.calls) {
        expect(options).toMatchObject({ secure: true })
      }
    })
  })

  describe('refresh', () => {
    it('replaces the access cookie and leaves the refresh cookie alone', async () => {
      const controller = await createController()
      const refreshToken = await jwt.signAsync({ sub: 'user-1', type: 'refresh' }, { expiresIn: 604800 })
      const res = createResponse()

      await controller.refresh(requestWithCookies({ [REFRESH_TOKEN_COOKIE]: refreshToken }), res)

      // Not rotating is what lets concurrent refreshes from a polling client
      // succeed instead of invalidating each other.
      expect(res.cookie).toHaveBeenCalledTimes(1)
      expect(res.cookie.mock.calls[0][0]).toBe(ACCESS_TOKEN_COOKIE)
    })

    it('rejects a request with no refresh cookie', async () => {
      const controller = await createController()

      await expect(controller.refresh(requestWithCookies({}), createResponse())).rejects.toBeInstanceOf(
        UnauthorizedException,
      )
    })
  })

  describe('logout', () => {
    it('clears every cookie with the path it was set on', async () => {
      const controller = await createController()
      const res = createResponse()

      controller.logout(res)

      expect(res.clearCookie).toHaveBeenCalledWith(ACCESS_TOKEN_COOKIE, expect.objectContaining({ path: '/' }))
      expect(res.clearCookie).toHaveBeenCalledWith(
        REFRESH_TOKEN_COOKIE,
        expect.objectContaining({ path: REFRESH_TOKEN_COOKIE_PATH }),
      )
      // Left behind, the router would keep believing in a session whose tokens
      // are gone, and bounce the browser between `/` and `/login`.
      expect(res.clearCookie).toHaveBeenCalledWith(SESSION_COOKIE, expect.objectContaining({ path: '/' }))
    })
  })

  describe('me', () => {
    it('reads the account fresh rather than trusting the token payload', async () => {
      const controller = await createController()
      users.findById.mockResolvedValue(await storedUser('correct horse battery staple'))

      await expect(controller.me({ id: 'user-1' })).resolves.toMatchObject({ id: 'user-1', email: 'ada@example.com' })
      expect(users.findById).toHaveBeenCalledWith('user-1')
    })

    it('rejects a valid token for an account that has since been deleted', async () => {
      const controller = await createController()
      users.findById.mockResolvedValue(undefined)

      await expect(controller.me({ id: 'user-1' })).rejects.toBeInstanceOf(UnauthorizedException)
    })
  })
})
