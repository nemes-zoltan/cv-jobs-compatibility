import { UserRow } from '../database/schema/users'
import { toUserModel } from './user.mapper'

const row: UserRow = {
  id: '0f8fad5b-d9cb-469f-a165-70867728950e',
  email: 'ada@example.com',
  passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$stub',
  name: 'Ada Lovelace',
  createdAt: new Date('2026-01-01T09:30:00Z'),
  updatedAt: new Date('2026-02-02T10:00:00Z'),
}

describe('toUserModel', () => {
  it('emits exactly the fields UserModel declares', () => {
    expect(toUserModel(row, true)).toEqual({
      id: '0f8fad5b-d9cb-469f-a165-70867728950e',
      email: 'ada@example.com',
      name: 'Ada Lovelace',
      createdAt: '2026-01-01T09:30:00.000Z',
      // Not on the row: it is asked of the resumes table and passed in.
      hasResume: true,
    })
  })

  it('never carries the password hash, whatever the row holds', () => {
    expect(JSON.stringify(toUserModel(row, false))).not.toContain('argon2')
    expect(toUserModel(row, false)).not.toHaveProperty('passwordHash')
  })

  it('converts timestamps to ISO strings, because that is what survives JSON', () => {
    expect(typeof toUserModel(row, false).createdAt).toBe('string')
  })
})
