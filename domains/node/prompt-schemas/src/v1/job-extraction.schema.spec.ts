import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { JOB_EXTRACTION_RESPONSE_SCHEMA } from './job-extraction.schema'

/**
 * The same freeze as the resume schema, for the same reason: what v1 sends is
 * derived from zod and from four lists in the constants package, any of which
 * could change underneath this file without anyone editing it.
 *
 * Changing what v1 asks for then means editing the committed JSON by hand,
 * which is a reviewable diff and a prompt for the real question: should this be
 * v2 instead?
 */
describe('JOB_EXTRACTION_RESPONSE_SCHEMA', () => {
  const frozen: unknown = JSON.parse(
    readFileSync(join(__dirname, 'job-extraction.response-schema.json'), 'utf-8'),
  )

  it('matches the frozen v1 schema', () => {
    expect(JOB_EXTRACTION_RESPONSE_SCHEMA).toEqual(frozen)
  })
})
