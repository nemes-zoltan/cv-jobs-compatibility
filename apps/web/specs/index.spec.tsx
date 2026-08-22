import React from 'react'
import { render, screen } from '@testing-library/react'
import Page from '../src/app/(app)/page'

// The dashboard routes on the session - an account with no CV is sent to
// onboarding - so the hook is mocked with a user that has one. Mocking it also
// keeps this a render smoke test rather than a test of the provider, which has
// its own reasons to fail.
jest.mock('@/components/auth/session-provider', () => ({
  useSession: () => ({
    user: {
      id: 'user-1',
      email: 'ada@example.com',
      name: 'Ada Lovelace',
      createdAt: '',
      hasResume: true,
    },
    refresh: jest.fn(),
    signOut: jest.fn(),
  }),
}))

// The dashboard reads the CV for its stat tiles. Stubbed so this stays a render
// test rather than a test of `fetch` in jsdom.
jest.mock('@/lib/use-my-resume', () => ({
  useMyResume: () => ({
    resume: {
      id: 'resume-1',
      fullName: 'Ada Lovelace',
      headline: 'Senior Backend Engineer',
      yearsExperienceTotal: 5,
      experiences: [{ id: 'e1' }],
      skills: [{ id: 's1' }, { id: 's2' }],
      education: [],
      projects: [],
      links: [],
      certifications: [],
      languages: [],
    },
    loading: false,
    error: null,
  }),
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), refresh: jest.fn() }),
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
