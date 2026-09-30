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

vi.mock('../bands/refreshMembership', () => ({
  refreshMembershipAndGo: vi.fn(),
}))

import AcceptInvitePage from './AcceptInvitePage'
import { getInvite, acceptInvite } from '../../api/invites'
import { refreshMembershipAndGo } from '../bands/refreshMembership'

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
  it('accepts and refreshes the session on success', async () => {
    mockAuth = { token: 'jwt', isLoading: false }
    getInvite.mockResolvedValueOnce({
      data: { bandName: 'The Owls', email: 'a@x.com', status: 'pending', hasAccount: true },
    })
    acceptInvite.mockResolvedValueOnce({ data: { bandId: 'band-9', status: 'accepted' } })

    const user = userEvent.setup()
    renderAt()

    await user.click(await screen.findByRole('button', { name: /accept invite/i }))

    await waitFor(() => {
      expect(acceptInvite).toHaveBeenCalledWith('raw-token')
    })
    await waitFor(() => {
      expect(refreshMembershipAndGo).toHaveBeenCalledWith('/songs', { selectBandId: 'band-9' })
    })
  })

  it('shows a mismatch message on 403', async () => {
    mockAuth = { token: 'jwt', isLoading: false }
    getInvite.mockResolvedValueOnce({
      data: { bandName: 'The Owls', email: 'invited@x.com', status: 'pending', hasAccount: true },
    })
    acceptInvite.mockRejectedValueOnce({ response: { status: 403 } })

    const user = userEvent.setup()
    renderAt()

    await user.click(await screen.findByRole('button', { name: /accept invite/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/invited@x.com/)
  })
})
