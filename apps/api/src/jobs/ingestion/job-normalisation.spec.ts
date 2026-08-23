import type { ExtractedJob } from '@cv-jobs-compatibility/prompt-schemas'
import {
  hasSomethingToGrade,
  toCurrencyCode,
  toRequirements,
  toSalaryAmount,
  toYearsRequired,
} from './job-normalisation'

function requirement(
  text: string,
  importance: 'required' | 'preferred',
): ExtractedJob['requirements'][number] {
  return { text, originalText: null, importance, kind: 'other' }
}

describe('toYearsRequired', () => {
  it.each([
    [5, '5.0'],
    [2.5, '2.5'],
    [null, null],
    [-1, null],
    [Number.NaN, null],
    // numeric(4, 1) cannot hold four digits before the point.
    [10_000, '999.9'],
  ])('turns %p into %p', (value, expected) => {
    expect(toYearsRequired(value)).toBe(expected)
  })
})

describe('toSalaryAmount', () => {
  it('keeps two decimal places', () => {
    expect(toSalaryAmount(120_000)).toBe('120000.00')
  })

  it('clamps a figure the column could not hold', () => {
    expect(toSalaryAmount(1e15)).toBe('9999999999.99')
  })
})

describe('toCurrencyCode', () => {
  it.each([
    ['gbp', 'GBP'],
    [' usd ', 'USD'],
    // A symbol would make Intl throw on a page rather than fail here.
    ['£', null],
    ['dollars', null],
    [null, null],
  ])('turns %p into %p', (value, expected) => {
    expect(toCurrencyCode(value)).toBe(expected)
  })
})

describe('toRequirements', () => {
  it('drops entries with no text', () => {
    expect(toRequirements([requirement('  ', 'required'), requirement('React', 'required')])).toHaveLength(1)
  })

  it('leaves a normal advert alone', () => {
    const requirements = Array.from({ length: 12 }, (_, index) =>
      requirement(`Requirement ${index}`, 'preferred'),
    )

    expect(toRequirements(requirements)).toEqual(requirements)
  })

  it('keeps the essential ones when a padded advert overflows the cap', () => {
    const requirements = [
      ...Array.from({ length: 30 }, (_, index) => requirement(`Nice ${index}`, 'preferred')),
      ...Array.from({ length: 5 }, (_, index) => requirement(`Must ${index}`, 'required')),
    ]

    const trimmed = toRequirements(requirements)

    expect(trimmed).toHaveLength(25)
    expect(trimmed.filter((one) => one.importance === 'required')).toHaveLength(5)
  })
})

describe('hasSomethingToGrade', () => {
  const empty = { requirements: [], skills: [] } as unknown as ExtractedJob

  it('rejects a posting nothing could be scored against', () => {
    expect(hasSomethingToGrade(empty)).toBe(false)
  })

  it('accepts one with skills but no stated requirements', () => {
    const job = { requirements: [], skills: [{ name: 'Go' }] } as unknown as ExtractedJob

    expect(hasSomethingToGrade(job)).toBe(true)
  })
})
