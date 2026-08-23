import { dedupeSkills, normalizeSkillName } from './skill-normalisation'

describe('normalizeSkillName', () => {
  it('ignores case and spacing', () => {
    expect(normalizeSkillName('  React   Native ')).toBe('react native')
  })

  it('drops trailing punctuation a bullet list leaves behind', () => {
    expect(normalizeSkillName('TypeScript,')).toBe('typescript')
  })

  it('keeps distinct skills distinct', () => {
    expect(normalizeSkillName('React')).not.toBe(normalizeSkillName('React Native'))
  })
})

describe('dedupeSkills', () => {
  it('keeps the first mention and drops later repeats', () => {
    const deduped = dedupeSkills([
      { name: 'React', category: 'framework' as const },
      { name: 'react ', category: 'tool' as const },
    ])

    expect(deduped).toEqual([{ name: 'React', category: 'framework', normalizedName: 'react' }])
  })

  it('carries the extra fields of whatever it was given', () => {
    const deduped = dedupeSkills([
      { name: 'Kubernetes', category: 'platform' as const, importance: 'required' as const },
    ])

    expect(deduped[0].importance).toBe('required')
  })

  it('drops a name that normalises to nothing', () => {
    expect(dedupeSkills([{ name: '  ', category: 'other' as const }])).toEqual([])
  })
})
