import { redactDatabaseUrl, resolveDatabaseUrl } from './database-url'

describe('resolveDatabaseUrl', () => {
  it('prefers DATABASE_URL when it is set', () => {
    const url = resolveDatabaseUrl({
      DATABASE_URL: 'postgresql://someone:secret@db.example.com:5432/app',
      POSTGRES_HOST: 'ignored',
    })

    expect(url).toBe('postgresql://someone:secret@db.example.com:5432/app')
  })

  it('assembles the string from the discrete variables a deployment provides', () => {
    const url = resolveDatabaseUrl({
      POSTGRES_USER: 'app',
      POSTGRES_PASSWORD: 'secret',
      POSTGRES_HOST: 'cvjobs.abc123.eu-west-1.rds.amazonaws.com',
      POSTGRES_PORT: '5432',
      POSTGRES_DB: 'cvjobs',
    })

    expect(url).toBe('postgresql://app:secret@cvjobs.abc123.eu-west-1.rds.amazonaws.com:5432/cvjobs')
  })

  it('escapes credentials that are not URL-safe', () => {
    const url = resolveDatabaseUrl({
      POSTGRES_USER: 'app',
      POSTGRES_PASSWORD: 'p@ss/word:1',
      POSTGRES_HOST: 'db',
      POSTGRES_DB: 'cvjobs',
    })

    expect(url).toBe('postgresql://app:p%40ss%2Fword%3A1@db:5432/cvjobs')
    expect(new URL(url).password).toBe('p%40ss%2Fword%3A1')
  })
})

describe('redactDatabaseUrl', () => {
  it('hides the password', () => {
    expect(redactDatabaseUrl('postgresql://app:secret@db:5432/cvjobs')).toBe(
      'postgresql://app:***@db:5432/cvjobs',
    )
  })

  it('does not throw on a malformed string', () => {
    expect(redactDatabaseUrl('not-a-url')).toBe('<unparseable database URL>')
  })
})
