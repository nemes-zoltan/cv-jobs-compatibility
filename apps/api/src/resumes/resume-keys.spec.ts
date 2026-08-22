import { buildResumeKey, isKeyOwnedBy, sanitizeFilename } from './resume-keys'

const USER = '3f1b2c4d-0000-4000-8000-000000000001'
const OTHER = '3f1b2c4d-0000-4000-8000-000000000002'

describe('sanitizeFilename', () => {
  it('keeps an ordinary filename intact', () => {
    expect(sanitizeFilename('Ada_Lovelace-CV.pdf')).toBe('Ada_Lovelace-CV.pdf')
  })

  it('strips separators so a name cannot extend the key', () => {
    expect(sanitizeFilename('../../etc/passwd')).not.toContain('/')
    expect(sanitizeFilename('a/b/c.pdf')).toBe('a-b-c.pdf')
  })

  it('never returns a name that starts with a dot or a dash', () => {
    expect(sanitizeFilename('...hidden.pdf')).toBe('hidden.pdf')
    expect(sanitizeFilename('--weird.pdf')).toBe('weird.pdf')
  })

  it('falls back rather than returning an empty segment', () => {
    expect(sanitizeFilename('///')).toBe('resume')
    expect(sanitizeFilename('')).toBe('resume')
  })
})

describe('buildResumeKey', () => {
  it('places the file under the owner and a unique segment', () => {
    expect(buildResumeKey(USER, 'cv.pdf')).toMatch(
      new RegExp(`^resumes/${USER}/[0-9a-f-]{36}/cv\\.pdf$`),
    )
  })

  it('does not collide when the same file is uploaded twice', () => {
    expect(buildResumeKey(USER, 'cv.pdf')).not.toBe(buildResumeKey(USER, 'cv.pdf'))
  })

  it('produces a key that passes its own ownership check', () => {
    expect(isKeyOwnedBy(buildResumeKey(USER, '../../etc/passwd'), USER)).toBe(true)
  })
})

describe('isKeyOwnedBy', () => {
  it('accepts a key minted for the user', () => {
    expect(isKeyOwnedBy(buildResumeKey(USER, 'cv.pdf'), USER)).toBe(true)
  })

  it("rejects another user's key", () => {
    expect(isKeyOwnedBy(buildResumeKey(OTHER, 'cv.pdf'), USER)).toBe(false)
  })

  it('rejects a key outside the resumes prefix', () => {
    expect(isKeyOwnedBy(`backups/${USER}/abc/cv.pdf`, USER)).toBe(false)
  })

  it('rejects extra path segments', () => {
    expect(isKeyOwnedBy(`resumes/${USER}/abc/nested/cv.pdf`, USER)).toBe(false)
  })

  it('rejects a shape padded with empty segments', () => {
    expect(isKeyOwnedBy(`resumes/${USER}//cv.pdf`, USER)).toBe(false)
    expect(isKeyOwnedBy(`resumes/${USER}/abc/`, USER)).toBe(false)
  })

  it('rejects a user id that only prefixes the real one', () => {
    expect(isKeyOwnedBy(`resumes/${USER}extra/abc/cv.pdf`, USER)).toBe(false)
  })
})
