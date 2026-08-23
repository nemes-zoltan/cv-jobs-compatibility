import { hashJobText, normaliseJobText } from './job-text'

describe('normaliseJobText', () => {
  it('collapses the whitespace a copy-paste from a web page brings with it', () => {
    expect(normaliseJobText('Senior   Engineer\n\n  London')).toBe('senior engineer london')
  })

  it('ignores case, so two copies of one advert are one advert', () => {
    expect(normaliseJobText('Senior Engineer')).toBe(normaliseJobText('SENIOR ENGINEER'))
  })
})

describe('hashJobText', () => {
  it('gives the same posting the same identity however it was spaced', () => {
    expect(hashJobText('Backend Engineer\n\nRemote')).toBe(hashJobText('  backend engineer remote '))
  })

  it('separates postings that differ in words', () => {
    expect(hashJobText('Backend Engineer')).not.toBe(hashJobText('Frontend Engineer'))
  })
})
