'use client'

import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import type { LoginRequest } from '@cv-jobs-compatibility/types'
import {
  Button,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  Spinner,
} from '@cv-jobs-compatibility/components'
import { FormError } from '@/components/auth/form-error'
import { PasswordInput } from '@/components/auth/password-input'
import { errorMessage } from '@/lib/api'
import { login } from '@/lib/auth-api'
import { loginSchema } from '@/lib/validation/auth'

/**
 * The form and nothing around it. Headings, the link to registration, and the
 * spacing between them belong to whatever page composes this - which also keeps
 * the client boundary down to the part that actually needs one.
 */
export function LoginForm() {
  const router = useRouter()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<LoginRequest>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = handleSubmit(async (credentials) => {
    try {
      await login(credentials)
      // The API has set the cookies on this response, so the proxy will let the
      // navigation through. `refresh` discards the router cache, which was
      // populated while signed out.
      router.replace('/')
      router.refresh()
    } catch (error) {
      // Always form-level. The API answers a wrong address and a wrong password
      // identically on purpose, so pinning the message to a field would undo
      // that - see DECISIONS.md.
      setError('root', { message: errorMessage(error) })
    }
  })

  // Stays disabled through the navigation that follows a success, which
  // outlives the submit promise.
  const busy = isSubmitting || isSubmitSuccessful

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <FormError message={errors.root?.message} />

        <Field data-invalid={Boolean(errors.email)}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className="h-10"
            aria-invalid={Boolean(errors.email)}
            {...register('email')}
          />
          <FieldError errors={[errors.email]} />
        </Field>

        <Field data-invalid={Boolean(errors.password)}>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            placeholder="••••••••••••"
            aria-invalid={Boolean(errors.password)}
            {...register('password')}
          />
          <FieldError errors={[errors.password]} />
        </Field>

        <Button type="submit" className="h-10 w-full" disabled={busy}>
          {busy && <Spinner />}
          Sign in
        </Button>
      </FieldGroup>
    </form>
  )
}
