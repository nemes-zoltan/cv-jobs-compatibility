import type {
  LoginRequest,
  LoginResponse,
  MeResponse,
  RegisterRequest,
  RegisterResponse,
} from '@cv-jobs-compatibility/types'
import { apiFetch } from './api'

/**
 * The auth endpoints, typed against the shared contract so a change on the API
 * side fails to compile here.
 *
 * No function returns a token, because none of them carries one: every call
 * below either sets or clears cookies the browser then sends on its own.
 */

/** `401` on a wrong password, and on nothing else worth retrying. */
export function login(credentials: LoginRequest): Promise<LoginResponse> {
  return apiFetch('/auth/login', {
    method: 'POST',
    body: credentials,
    refreshOnUnauthorized: false,
  })
}

/** `409` when the address is taken. Signs the new account straight in. */
export function register(details: RegisterRequest): Promise<RegisterResponse> {
  return apiFetch('/auth/register', {
    method: 'POST',
    body: details,
    refreshOnUnauthorized: false,
  })
}

export function logout(): Promise<void> {
  return apiFetch('/auth/logout', { method: 'POST', refreshOnUnauthorized: false })
}

/** The guarded call the session hangs on: a `401` here means signed out. */
export function getMe(): Promise<MeResponse> {
  return apiFetch('/auth/me')
}
