import { parseResumeDate, toYearsOfExperience } from './resume-normalisation'

describe('parseResumeDate', () => {
  it.each([
    ['2019-03-15', '2019-03-15'],
    ['2019-03', '2019-03-01'],
    ['2019/3', '2019-03-01'],
    ['03/2019', '2019-03-01'],
    ['3-2019', '2019-03-01'],
    ['Jan 2019', '2019-01-01'],
    ['January 2019', '2019-01-01'],
    ['Sept. 2019', '2019-09-01'],
    ['2019', '2019-01-01'],
    ['  2019  ', '2019-01-01'],
  ])('reads %s as %s', (raw, expected) => {
    expect(parseResumeDate(raw)).toBe(expected)
  })

  it.each([
    [null],
    [''],
    ['present'],
    ['Current'],
    // Ambiguous: '19 could be 1919 or 2019, and the raw string is kept anyway.
    ["Jan '19"],
    ['Summer 2020'],
    ['sometime in the nineties'],
    // A parse this wrong is worse than no date at all.
    ['1319'],
    ['13/2019'],
  ])('gives up on %p rather than guessing', (raw) => {
    expect(parseResumeDate(raw)).toBeNull()
  })
})

describe('toYearsOfExperience', () => {
  it.each([
    [12.3456, '12.3'],
    [0, '0.0'],
    [null, null],
    [-1, null],
    [Number.NaN, null],
    // numeric(4, 1) cannot hold four digits before the point.
    [100_000, '999.9'],
  ])('turns %p into %p', (value, expected) => {
    expect(toYearsOfExperience(value)).toBe(expected)
  })
})
