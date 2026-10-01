import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../api/invites', () => ({
  getInvite: vi.fn(),
  acceptInvite: vi.fn(),
}))

// Drive logged-in/out via a swappable auth value.
let mockAuth = { token: null, isLoading: false }
vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => mockAuth,
}))

const refreshMembershipAndGo = vi.fn()
vi.mock('../bands/refreshMembership', () => ({
  useRefreshMembership: () => refreshMembershipAndGo,
}))

import AcceptInvitePage from './AcceptInvitePage'
import { getInvite, acceptInvite } from '../../api/invites'

const renderAt = (token = 'raw-token') =>
  render(
    <MemoryRouter initialEntries={[`/invites/accept?token=${token}`]}>
      <AcceptInvitePage />
    </MemoryRouter>
  )

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth = { token: null, isLoading: false }
})

describe('AcceptInvitePage lookup states', () => {
  it('shows a not-found message on 404', async () => {
    getInvite.mockRejectedValueOnce({ response: { status: 404 } })
    renderAt()
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be found/i)
  })

  it('shows an expired message for a non-pending invite', async () => {
    getInvite.mockResolvedValueOnce({
      data: { bandName: 'The Owls', email: 'a@x.com', status: 'expired', hasAccount: true },
    })
    renderAt()
    expect(await screen.findByText(/has expired/i)).toBeInTheDocument()
  })

  it('shows a missing-token message when token is absent', async () => {
    render(
      <MemoryRouter initialEntries={['/invites/accept']}>
        <AcceptInvitePage />
      </MemoryRouter>
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(/missing its token/i)
    expect(getInvite).not.toHaveBeenCalled()
  })
})

describe('AcceptInvitePage logged-out routing', () => {
  it('offers Sign in when the invited email has an account', async () => {
    getInvite.mockResolvedValueOnce({
      data: { bandName: 'The Owls', email: 'a@x.com', status: 'pending', hasAccount: true },
    })
    renderAt()
    const link = await screen.findByRole('link', { name: /sign in/i })
    expect(link.getAttribute('href')).toContain('/login')
    expect(link.getAttribute('href')).toContain('next=')
  })

  it('offers Create account when the invited email has no account', async () => {
    getInvite.mockResolvedValueOnce({
      data: { bandName: 'The Owls', email: 'new@x.com', status: 'pending', hasAccount: false },
    })
    renderAt()
    const link = await screen.findByRole('link', { name: /create account/i })
    expect(link.getAttribute('href')).toContain('/register')
    expect(link.getAttribute('href')).toContain('email=')
  })
})

describe('AcceptInvitePage logged-in accept', () => {
  // A logged-in visitor (typically returning from login/registration via the
  // `next` round-trip) should have the invite accepted automatically on arrival
  // — no second click required.
  it('auto-accepts on arrival and refreshes the session on success', async () => {
    mockAuth = { token: 'jwt', isLoading: false }
    getInvite.mockResolvedValueOnce({
      data: { bandName: 'The Owls', email: 'a@x.com', status: 'pending', hasAccount: true },
    })
    acceptInvite.mockResolvedValueOnce({ data: { bandId: 'band-9', status: 'accepted' } })

    renderAt()

    await waitFor(() => {
      expect(acceptInvite).toHaveBeenCalledWith('raw-token')
    })
    await waitFor(() => {
      expect(refreshMembershipAndGo).toHaveBeenCalledWith('/songs', { selectBandId: 'band-9' })
    })
    // Auto-accept fires exactly once.
    expect(acceptInvite).toHaveBeenCalledTimes(1)
  })

  it('shows a mismatch message on 403 without requiring a click, and offers Try again', async () => {
    mockAuth = { token: 'jwt', isLoading: false }
    getInvite.mockResolvedValueOnce({
      data: { bandName: 'The Owls', email: 'invited@x.com', status: 'pending', hasAccount: true },
    })
    acceptInvite.mockRejectedValueOnce({ response: { status: 403 } })

    renderAt()

    // Auto-accept fires and fails; the mismatch message appears without a click.
    expect(await screen.findByRole('alert')).toHaveTextContent(/invited@x.com/)
    // A manual retry button is offered as a fallback.
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('retrying after a failure calls acceptInvite again', async () => {
    mockAuth = { token: 'jwt', isLoading: false }
    getInvite.mockResolvedValueOnce({
      data: { bandName: 'The Owls', email: 'a@x.com', status: 'pending', hasAccount: true },
    })
    acceptInvite
      .mockRejectedValueOnce({ response: { status: 500 } })
      .mockResolvedValueOnce({ data: { bandId: 'band-9', status: 'accepted' } })

    const user = userEvent.setup()
    renderAt()

    const retry = await screen.findByRole('button', { name: /try again/i })
    await user.click(retry)

    await waitFor(() => {
      expect(acceptInvite).toHaveBeenCalledTimes(2)
    })
    await waitFor(() => {
      expect(refreshMembershipAndGo).toHaveBeenCalledWith('/songs', { selectBandId: 'band-9' })
    })
  })
})
