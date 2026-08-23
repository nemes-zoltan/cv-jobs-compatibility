import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { JOB_INSIGHTS_RESPONSE_SCHEMA } from './job-insights.schema'

/**
 * Frozen for the same reason as the other two: what v1 sends is derived from
 * zod and from four lists in the constants package, any of which could change
 * underneath this file without anyone editing it.
 */
describe('JOB_INSIGHTS_RESPONSE_SCHEMA', () => {
  const frozen: unknown = JSON.parse(
    readFileSync(join(__dirname, 'job-insights.response-schema.json'), 'utf-8'),
  )

  it('matches the frozen v1 schema', () => {
    expect(JOB_INSIGHTS_RESPONSE_SCHEMA).toEqual(frozen)
  })
})
