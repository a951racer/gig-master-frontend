import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../../api/admin', () => ({
  getUser: vi.fn(),
  updateUser: vi.fn(),
  listBands: vi.fn(),
  addBandMember: vi.fn(),
  removeBandMember: vi.fn(),
}))

let mockRole = 'system_administrator'
vi.mock('../../../auth/BandContext', () => ({
  useBand: () => ({ role: mockRole }),
}))
const refreshMock = vi.fn()
vi.mock('../../../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'current-admin' }, refresh: refreshMock }),
}))

vi.mock('react-router-dom', async (orig) => {
  const actual = await orig()
  return { ...actual, useParams: () => ({ id: 'u-1' }) }
})

import UserDetailPage from './UserDetailPage'
import { getUser, updateUser, listBands, addBandMember, removeBandMember } from '../../../api/admin'

const renderPage = () => render(<MemoryRouter><UserDetailPage /></MemoryRouter>)

const userData = {
  id: 'u-1',
  email: 'ann@band.com',
  firstName: 'Ann',
  lastName: 'Smith',
  role: 'user',
  bands: [
    { id: 'b-1', name: 'Owls', isAdmin: true },
    { id: 'b-2', name: 'Hawks', isAdmin: false },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  mockRole = 'system_administrator'
  refreshMock.mockResolvedValue(undefined)
  getUser.mockResolvedValue({ data: userData })
  listBands.mockResolvedValue({ data: [
    { id: 'b-1', name: 'Owls' },
    { id: 'b-2', name: 'Hawks' },
    { id: 'b-3', name: 'Jays' },
  ] })
})

describe('UserDetailPage gating', () => {
  it('shows not-authorized for a non-sysadmin and does not load', async () => {
    mockRole = 'user'
    renderPage()
    expect(screen.getByText(/not authorized to manage users/i)).toBeInTheDocument()
    await Promise.resolve()
    expect(getUser).not.toHaveBeenCalled()
  })
})

describe('UserDetailPage edit fields', () => {
  it('saves email/name/role via updateUser', async () => {
    const user = userEvent.setup()
    updateUser.mockResolvedValueOnce({ data: {} })
    renderPage()

    const emailField = await screen.findByLabelText('Email')
    await waitFor(() => expect(emailField).toHaveValue('ann@band.com'))
    await user.clear(emailField)
    await user.type(emailField, 'ann2@band.com')
    await user.click(screen.getByRole('button', { name: /save details/i }))

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith('u-1', expect.objectContaining({ email: 'ann2@band.com', firstName: 'Ann', lastName: 'Smith', role: 'user' }))
    })
  })

  it('surfaces a server error (e.g. EMAIL_TAKEN)', async () => {
    const user = userEvent.setup()
    updateUser.mockRejectedValueOnce({ response: { data: { error: { message: 'Email already in use' } } } })
    renderPage()
    await screen.findByLabelText('Email')
    await user.click(screen.getByRole('button', { name: /save details/i }))
    expect(await screen.findByText(/email already in use/i)).toBeInTheDocument()
  })
})

describe('UserDetailPage change password', () => {
  it('rejects a short password client-side', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByLabelText('New password')
    await user.type(screen.getByLabelText('New password'), 'short')
    await user.click(screen.getByRole('button', { name: /set password/i }))
    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument()
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('sets a new password via updateUser', async () => {
    const user = userEvent.setup()
    updateUser.mockResolvedValueOnce({ data: {} })
    renderPage()
    await screen.findByLabelText('New password')
    await user.type(screen.getByLabelText('New password'), 'brand-new-pass')
    await user.click(screen.getByRole('button', { name: /set password/i }))
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith('u-1', { newPassword: 'brand-new-pass' }))
  })
})

describe('UserDetailPage memberships', () => {
  it('lists bands with an admin indicator', async () => {
    renderPage()
    expect(await screen.findByText('Owls')).toBeInTheDocument()
    expect(screen.getByText('Hawks')).toBeInTheDocument()
    // The admin band shows an Admin badge.
    expect(screen.getByText('Admin')).toBeInTheDocument()
  })

  it('removes a non-admin membership via removeBandMember', async () => {
    const user = userEvent.setup()
    removeBandMember.mockResolvedValueOnce({ data: {} })
    renderPage()
    await screen.findByText('Hawks')
    // Only the non-admin band (Hawks) has a Remove button.
    await user.click(screen.getByRole('button', { name: /remove/i }))
    await waitFor(() => expect(removeBandMember).toHaveBeenCalledWith('b-2', 'u-1'))
  })

  it('adds the user to a band via addBandMember (only non-member bands are options)', async () => {
    const user = userEvent.setup()
    addBandMember.mockResolvedValueOnce({ data: {} })
    renderPage()
    await screen.findByText('Owls')
    // b-3 (Jays) is the only band the user isn't in.
    await user.selectOptions(screen.getByLabelText(/add to band/i), 'b-3')
    await user.click(screen.getByRole('button', { name: /^add$/i }))
    await waitFor(() => expect(addBandMember).toHaveBeenCalledWith('b-3', 'u-1'))
  })
})
