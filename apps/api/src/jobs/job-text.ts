import { createHash } from 'node:crypto'

/**
 * Turning a pasted advert into the key that decides whether we have seen it.
 *
 * Pure, so the thing most likely to be subtly wrong can be tested without a
 * database.
 */

/**
 * The form two copies of one advert have to agree on.
 *
 * Whitespace is collapsed because copying from a web page picks up whatever
 * indentation the markup had, and case is dropped because two adverts differing
 * only in capitals are one advert. Neither transform touches what is stored -
 * the model reads the text as it was pasted, since layout is a signal about
 * how the sections are divided.
 */
export function normaliseJobText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase()
}

/**
 * The identity of a posting.
 *
 * Only catches exact reposts. Two people copying different amounts of the same
 * page produce two hashes and two rows, and that is accepted: real
 * deduplication means comparing title, company and text similarity, and every
 * version of that misfires in its own way.
 */
export function hashJobText(text: string): string {
  return createHash('sha256').update(normaliseJobText(text)).digest('hex')
}
