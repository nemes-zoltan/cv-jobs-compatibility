import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { JOB_MATCH_RESPONSE_SCHEMA } from './job-match.schema'

/**
 * Frozen like the others, and with one extra thing riding on it: the order of
 * the top-level fields. Gemini generates in schema order, so `requirements`
 * appearing before `summary` is what makes the prose conditioned on the
 * ratings. A reordering that looked cosmetic would quietly change the output.
 */
describe('JOB_MATCH_RESPONSE_SCHEMA', () => {
  const frozen: unknown = JSON.parse(
    readFileSync(join(__dirname, 'job-match.response-schema.json'), 'utf-8'),
  )

  it('matches the frozen v1 schema', () => {
    expect(JOB_MATCH_RESPONSE_SCHEMA).toEqual(frozen)
  })

  it('asks for the judgements before the prose', () => {
    const keys = Object.keys((JOB_MATCH_RESPONSE_SCHEMA as { properties: object }).properties)

    expect(keys.indexOf('requirements')).toBeLessThan(keys.indexOf('summary'))
    expect(keys.indexOf('skills')).toBeLessThan(keys.indexOf('summary'))
  })
})
