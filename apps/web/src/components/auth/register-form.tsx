'use client'

import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import type { RegisterRequest } from '@cv-jobs-compatibility/types'
import {
  Button,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  Spinner,
} from '@cv-jobs-compatibility/components'
import { FormError } from '@/components/auth/form-error'
import { PasswordInput } from '@/components/auth/password-input'
import { ApiError, errorMessage } from '@/lib/api'
import { register as registerAccount } from '@/lib/auth-api'
import { registerSchema } from '@/lib/validation/auth'

/**
 * The form and nothing around it. Headings, the link to the login page, and the
 * spacing between them belong to whatever page composes this - which also keeps
 * the client boundary down to the part that actually needs one.
 */
export function RegisterForm() {
  const router = useRouter()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<RegisterRequest>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '' },
  })

  const onSubmit = handleSubmit(async (details) => {
    try {
      await registerAccount(details)
      // Registering signs you straight in, so this goes to the app rather than
      // to the login form - see DECISIONS.md.
      router.replace('/')
      router.refresh()
    } catch (error) {
      // A taken address is the one failure that names a field, and the API's
      // own wording says it best.
      if (error instanceof ApiError && error.status === 409) {
        setError('email', { message: error.message })
        return
      }

      setError('root', { message: errorMessage(error) })
    }
  })

  const busy = isSubmitting || isSubmitSuccessful

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <FormError message={errors.root?.message} />

        <Field data-invalid={Boolean(errors.name)}>
          <FieldLabel htmlFor="name">Name</FieldLabel>
          <Input
            id="name"
            autoComplete="name"
            placeholder="Ada Lovelace"
            className="h-10"
            aria-invalid={Boolean(errors.name)}
            {...register('name')}
          />
          <FieldError errors={[errors.name]} />
        </Field>

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
            autoComplete="new-password"
            placeholder="••••••••••••"
            aria-describedby="password-description"
            aria-invalid={Boolean(errors.password)}
            {...register('password')}
          />
          {/* Mirrors RegisterDto: length is the only rule the API enforces. */}
          <FieldDescription id="password-description">
            At least 12 characters. No symbol or digit requirements.
          </FieldDescription>
          <FieldError errors={[errors.password]} />
        </Field>

        <Button type="submit" className="h-10 w-full" disabled={busy}>
          {busy && <Spinner />}
          Create account
        </Button>
      </FieldGroup>
    </form>
  )
}
