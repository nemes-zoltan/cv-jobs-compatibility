import { AlertCircleIcon } from 'lucide-react'

/**
 * The whole-form failure: a rejected sign-in, an unreachable API. Field-level
 * problems belong on their field, and `FieldError` renders those.
 *
 * `role="alert"` so it is announced when it appears - it is the only feedback a
 * submit that failed produces, and nothing else on the page moves.
 */
export function FormError({ message }: { message?: string }) {
  if (!message) return null

  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2.5 text-sm text-destructive"
    >
      <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
      {message}
    </div>
  )
}
