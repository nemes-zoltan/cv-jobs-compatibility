import { meetsYearsRequirement, scoreMatch, verdictFor } from './match-scoring'

const required = (stars: number) => ({ importance: 'required' as const, stars })
const preferred = (stars: number) => ({ importance: 'preferred' as const, stars })

describe('scoreMatch', () => {
  it('gives full marks when everything is met or exceeded', () => {
    expect(scoreMatch([required(5), preferred(5)], [{ importance: 'required', verdict: 'yes' }])).toBe(100)
  })

  it('gives nothing for a CV with no evidence for anything', () => {
    expect(scoreMatch([required(1), required(1)], [{ importance: 'required', verdict: 'no' }])).toBe(0)
  })

  it('weighs a required line above a preferred one', () => {
    const strongWhereItCounts = scoreMatch([required(5), preferred(1)], [])
    const strongWhereItDoesNot = scoreMatch([required(1), preferred(5)], [])

    expect(strongWhereItCounts).toBeGreaterThan(strongWhereItDoesNot as number)
  })

  it('treats a partial skill as half of the thing itself', () => {
    expect(scoreMatch([], [{ importance: 'required', verdict: 'partial' }])).toBe(50)
  })

  it('clamps a rating outside the scale rather than letting it skew the total', () => {
    expect(scoreMatch([required(9)], [])).toBe(100)
    expect(scoreMatch([required(0)], [])).toBe(0)
    expect(scoreMatch([required(Number.NaN)], [])).toBe(0)
  })

  it('returns null rather than zero when there was nothing to grade', () => {
    expect(scoreMatch([], [])).toBeNull()
  })
})

describe('verdictFor', () => {
  it.each([
    [100, 'strong_fit'],
    [80, 'strong_fit'],
    [79, 'stretch'],
    [60, 'stretch'],
    [59, 'reach'],
    [40, 'reach'],
    [39, 'mismatch'],
    [0, 'mismatch'],
  ])('calls %i %s', (score, expected) => {
    expect(verdictFor(score)).toBe(expected)
  })
})

describe('meetsYearsRequirement', () => {
  it.each([
    [6, 5, true],
    [5, 5, true],
    [4, 5, false],
    // Neither side stating a figure is not the same as failing to meet one.
    [null, 5, null],
    [6, null, null],
  ])('reads %p against %p as %p', (resumeYears, jobYears, expected) => {
    expect(meetsYearsRequirement(resumeYears, jobYears)).toBe(expected)
  })
})
