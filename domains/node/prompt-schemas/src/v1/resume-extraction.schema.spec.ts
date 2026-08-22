import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { RESUME_EXTRACTION_RESPONSE_SCHEMA } from './resume-extraction.schema'

/**
 * A released version has to keep asking the model for exactly what it asked for
 * when its rows were written, and the schema it sends is *derived* - from zod,
 * and from `SKILL_CATEGORIES` in the constants package. Either could change
 * underneath this file without anyone editing it.
 *
 * So the emitted schema is frozen in a committed JSON file. Changing what v1
 * sends then means editing that file by hand, which is a reviewable diff and a
 * prompt for the real question: should this be v2 instead?
 *
 * Deliberately not a jest snapshot - `jest -u` would rewrite it without anyone
 * having to decide anything.
 */
describe('RESUME_EXTRACTION_RESPONSE_SCHEMA', () => {
  const frozen: unknown = JSON.parse(
    readFileSync(join(__dirname, 'resume-extraction.response-schema.json'), 'utf-8'),
  )

  it('matches the frozen v1 schema', () => {
    expect(RESUME_EXTRACTION_RESPONSE_SCHEMA).toEqual(frozen)
  })
})
