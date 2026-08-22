import { randomUUID } from 'node:crypto'

/**
 * Keys are `resumes/<userId>/<uuid>/<filename>`.
 *
 * The user id is a path segment so ownership is readable from the key alone,
 * which is what makes the check below possible without a lookup.
 */

const PREFIX = 'resumes'

/** Anything outside this is replaced, so a key can never contain a path escape. */
const UNSAFE_CHARACTERS = /[^a-zA-Z0-9._-]+/g

/** The filename is decoration - the uuid is what makes the key unique. */
export function sanitizeFilename(filename: string): string {
  const safe = filename.replace(UNSAFE_CHARACTERS, '-').replace(/^[.-]+/, '').slice(-100)

  return safe || 'resume'
}

export function buildResumeKey(userId: string, filename: string): string {
  return `${PREFIX}/${userId}/${randomUUID()}/${sanitizeFilename(filename)}`
}

/**
 * The client echoes its key back after uploading, so it is untrusted input.
 * Without this it could name an object under someone else's prefix.
 */
export function isKeyOwnedBy(key: string, userId: string): boolean {
  const segments = key.split('/')

  // Exactly four non-empty segments, so a trailing or doubled slash cannot pad
  // the shape into place.
  return (
    segments.length === 4 &&
    segments[0] === PREFIX &&
    segments[1] === userId &&
    segments.every((segment) => segment.length > 0)
  )
}
