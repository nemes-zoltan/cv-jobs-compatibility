import { z } from 'zod'

/**
 * Client-side rules for the auth forms.
 *
 * These mirror the API's DTOs so a mistake is caught before a round trip, not
 * so the API can trust them - it validates every request regardless, and stays
 * the authority. Each schema names the DTO it shadows; keep them in step.
 *
 * The schemas live here rather than in `domains/shared/types` on purpose. The API
 * validates with class-validator decorators on its DTOs, and a zod schema in
 * the shared package would either sit unused or become a second, competing
 * source of truth. What is shared is the request type; only the rules are
 * duplicated.
 */

/** Mirrors `LoginDto`. */
export const loginSchema = z.object({
  email: z.email({ error: 'A valid email address is required' }).max(254),
  // Deliberately not the register rules. A sign-in form that rejects a short
  // password before sending it tells whoever is guessing what the policy is,
  // and locks out anyone whose account predates a policy change.
  password: z.string().min(1, 'Enter your password').max(128),
})

/** Mirrors `RegisterDto`. */
export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name is too long'),
  email: z.email({ error: 'A valid email address is required' }).max(254),
  // Length is the only rule the API enforces, and composition requirements are
  // deliberately absent - see ARCHITECTURE.md.
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .max(128, 'Password must be at most 128 characters'),
})
