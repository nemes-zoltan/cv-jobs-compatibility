import React from 'react'
import { render, screen } from '@testing-library/react'
import Page from '../src/app/(app)/page'

// The page is a server component, but `Greeting` inside it reads the session.
// Mocking the hook keeps this a render smoke test rather than a test of the
// provider, which has its own reasons to fail.
jest.mock('@/components/auth/session-provider', () => ({
  useSession: () => ({
    user: { id: 'user-1', email: 'ada@example.com', name: 'Ada Lovelace', createdAt: '' },
    signOut: jest.fn(),
  }),
}))

describe('Page', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<Page />)
    expect(baseElement).toBeTruthy()
  })

  it('greets the signed-in user by first name', () => {
    render(<Page />)
    expect(screen.getByRole('heading', { name: 'Welcome back, Ada' })).toBeTruthy()
  })
})
