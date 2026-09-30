import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock the invites API layer so no network happens.
vi.mock('../../api/invites', () => ({
  listInvites: vi.fn(),
  createInvite: vi.fn(),
  revokeInvite: vi.fn(),
}))

// InvitesPage gates on currentBand.isAdmin via useBand(); swap per test.
let mockBandValue = { currentBand: null }
vi.mock('../../auth/BandContext', () => ({
  useBand: () => mockBandValue,
}))

import InvitesPage from './InvitesPage'
import { listInvites, createInvite, revokeInvite } from '../../api/invites'

const adminBand = { id: 'band-1', name: 'The Night Owls', isAdmin: true }

beforeEach(() => {
  vi.clearAllMocks()
  mockBandValue = { currentBand: null }
})

describe('InvitesPage gating', () => {
  it('renders a not-authorized state and does not call listInvites when not admin', async () => {
    mockBandValue = { currentBand: { id: 'band-2', name: 'Guest', isAdmin: false } }
    render(<InvitesPage />)
    expect(screen.getByText(/select a band you administer/i)).toBeInTheDocument()
    await Promise.resolve()
    expect(listInvites).not.toHaveBeenCalled()
  })

  it('does not call listInvites when currentBand is null', async () => {
    mockBandValue = { currentBand: null }
    render(<InvitesPage />)
    expect(screen.getByText(/select a band you administer/i)).toBeInTheDocument()
    await Promise.resolve()
    expect(listInvites).not.toHaveBeenCalled()
  })
})

describe('InvitesPage when administered', () => {
  it('loads pending invites for the current band', async () => {
    mockBandValue = { currentBand: adminBand }
    listInvites.mockResolvedValueOnce({
      data: [
        { id: 'inv-1', email: 'alice@example.com' },
        { id: 'inv-2', email: 'bob@example.com' },
      ],
    })

    render(<InvitesPage />)

    expect(await screen.findByText('alice@example.com')).toBeInTheDocument()
    expect(screen.getByText('bob@example.com')).toBeInTheDocument()
    expect(listInvites).toHaveBeenCalledWith('band-1')
  })

  it('sending an invite calls createInvite and refreshes the list', async () => {
    mockBandValue = { currentBand: adminBand }
    listInvites
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [{ id: 'inv-3', email: 'carol@example.com' }] })
    createInvite.mockResolvedValueOnce({ data: { id: 'inv-3' } })

    const user = userEvent.setup()
    render(<InvitesPage />)

    expect(await screen.findByText(/no pending invites/i)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/invite email/i), 'carol@example.com')
    await user.click(screen.getByRole('button', { name: /send invite/i }))

    await waitFor(() => {
      expect(createInvite).toHaveBeenCalledWith('band-1', 'carol@example.com')
    })
    await waitFor(() => {
      expect(listInvites).toHaveBeenCalledTimes(2)
    })
    expect(await screen.findByText('carol@example.com')).toBeInTheDocument()
  })

  it('shows a friendly message when the email already has a pending invite (409)', async () => {
    mockBandValue = { currentBand: adminBand }
    listInvites.mockResolvedValue({ data: [] })
    createInvite.mockRejectedValueOnce({ response: { status: 409, data: { error: { code: 'DUPLICATE' } } } })

    const user = userEvent.setup()
    render(<InvitesPage />)

    await screen.findByText(/no pending invites/i)
    await user.type(screen.getByLabelText(/invite email/i), 'dupe@example.com')
    await user.click(screen.getByRole('button', { name: /send invite/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/already a pending invite/i)
  })

  it('revoking an invite calls revokeInvite and refreshes the list', async () => {
    mockBandValue = { currentBand: adminBand }
    listInvites
      .mockResolvedValueOnce({ data: [{ id: 'inv-1', email: 'alice@example.com' }] })
      .mockResolvedValueOnce({ data: [] })
    revokeInvite.mockResolvedValueOnce({ data: {} })

    const user = userEvent.setup()
    render(<InvitesPage />)

    expect(await screen.findByText('alice@example.com')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /revoke/i }))

    await waitFor(() => {
      expect(revokeInvite).toHaveBeenCalledWith('band-1', 'inv-1')
    })
    await waitFor(() => {
      expect(listInvites).toHaveBeenCalledTimes(2)
    })
  })
})
