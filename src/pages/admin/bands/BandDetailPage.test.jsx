import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../../api/admin', () => ({
  listBands: vi.fn(),
  listUsers: vi.fn(),
  listBandMembers: vi.fn(),
  renameBand: vi.fn(),
  setBandAdministrator: vi.fn(),
  addBandMember: vi.fn(),
  removeBandMember: vi.fn(),
  archiveBand: vi.fn(),
  unarchiveBand: vi.fn(),
  deleteBand: vi.fn(),
}))

let mockRole = 'system_administrator'
vi.mock('../../../auth/BandContext', () => ({
  useBand: () => ({ role: mockRole }),
}))
const refreshMock = vi.fn()
vi.mock('../../../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'current-admin' }, refresh: refreshMock }),
}))

const navigateMock = vi.fn()
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig()
  return { ...actual, useParams: () => ({ id: 'b-1' }), useNavigate: () => navigateMock }
})

import BandDetailPage from './BandDetailPage'
import {
  listBands, listUsers, listBandMembers, renameBand, setBandAdministrator,
  addBandMember, removeBandMember, archiveBand, unarchiveBand, deleteBand,
} from '../../../api/admin'

const renderPage = () => render(<MemoryRouter><BandDetailPage /></MemoryRouter>)

function seed({ archivedAt = null } = {}) {
  listBands.mockResolvedValue({ data: [{ id: 'b-1', name: 'The Owls', administrator: 'owner', archivedAt }] })
  listBandMembers.mockResolvedValue({ data: [
    { id: 'owner', email: 'owner@band.com', firstName: 'Oli', lastName: 'Owner', isAdmin: true },
    { id: 'mem', email: 'mem@band.com', firstName: 'Mem', lastName: 'Ber', isAdmin: false },
  ] })
  listUsers.mockResolvedValue({ data: [
    { id: 'owner', email: 'owner@band.com' },
    { id: 'mem', email: 'mem@band.com' },
    { id: 'newbie', email: 'newbie@band.com' },
  ] })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockRole = 'system_administrator'
  refreshMock.mockResolvedValue(undefined)
  seed()
})

describe('BandDetailPage gating', () => {
  it('shows not-authorized for a non-sysadmin and does not load', async () => {
    mockRole = 'user'
    renderPage()
    expect(screen.getByText(/not authorized to manage bands/i)).toBeInTheDocument()
    await Promise.resolve()
    expect(listBandMembers).not.toHaveBeenCalled()
  })
})

describe('BandDetailPage actions', () => {
  it('renames the band', async () => {
    const user = userEvent.setup()
    renameBand.mockResolvedValueOnce({ data: {} })
    renderPage()
    const nameField = await screen.findByLabelText('Band name')
    await waitFor(() => expect(nameField).toHaveValue('The Owls'))
    await user.clear(nameField)
    await user.type(nameField, 'The Night Owls')
    await user.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(renameBand).toHaveBeenCalledWith('b-1', 'The Night Owls'))
  })

  it('shows a friendly message when renaming to a duplicate band name (409)', async () => {
    const user = userEvent.setup()
    renameBand.mockRejectedValueOnce({ response: { data: { error: { code: 'DUPLICATE_BAND_NAME' } } } })
    renderPage()
    const nameField = await screen.findByLabelText('Band name')
    await waitFor(() => expect(nameField).toHaveValue('The Owls'))
    await user.clear(nameField)
    await user.type(nameField, 'Taken Name')
    await user.click(screen.getByRole('button', { name: /^save$/i }))
    expect(await screen.findByText(/band names must be unique/i)).toBeInTheDocument()
  })

  it('reassigns the administrator (from the members list)', async () => {
    const user = userEvent.setup()
    setBandAdministrator.mockResolvedValueOnce({ data: {} })
    renderPage()
    await waitFor(() => expect(screen.getByLabelText('Band name')).toHaveValue('The Owls'))
    await user.selectOptions(screen.getByLabelText(/set administrator/i), 'mem')
    await user.click(screen.getByRole('button', { name: /^set$/i }))
    await waitFor(() => expect(setBandAdministrator).toHaveBeenCalledWith('b-1', 'mem'))
  })

  it('lists members with an admin indicator and removes a non-admin member', async () => {
    const user = userEvent.setup()
    removeBandMember.mockResolvedValueOnce({ data: {} })
    renderPage()
    await waitFor(() => expect(screen.getByLabelText('Band name')).toHaveValue('The Owls'))
    // Members appear in the table (and the admin dropdown), so use getAllByText.
    expect(screen.getAllByText('Owner, Oli').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Ber, Mem').length).toBeGreaterThan(0)
    // The admin member carries an Admin badge.
    expect(screen.getByText('Admin')).toBeInTheDocument()
    // Only the non-admin (mem) has a Remove button.
    await user.click(screen.getByRole('button', { name: /remove/i }))
    await waitFor(() => expect(removeBandMember).toHaveBeenCalledWith('b-1', 'mem'))
  })

  it('adds a member (only non-members are options)', async () => {
    const user = userEvent.setup()
    addBandMember.mockResolvedValueOnce({ data: {} })
    renderPage()
    await waitFor(() => expect(screen.getByLabelText('Band name')).toHaveValue('The Owls'))
    await user.selectOptions(screen.getByLabelText(/add member/i), 'newbie')
    await user.click(screen.getByRole('button', { name: /^add$/i }))
    await waitFor(() => expect(addBandMember).toHaveBeenCalledWith('b-1', 'newbie'))
  })

  it('archives an active band', async () => {
    const user = userEvent.setup()
    archiveBand.mockResolvedValueOnce({ data: {} })
    renderPage()
    await waitFor(() => expect(screen.getByLabelText('Band name')).toHaveValue('The Owls'))
    await user.click(screen.getByRole('button', { name: /^archive$/i }))
    await waitFor(() => expect(archiveBand).toHaveBeenCalledWith('b-1'))
  })

  it('for an archived band, offers Unarchive and confirm-gated Delete that navigates back', async () => {
    seed({ archivedAt: '2024-01-01T00:00:00Z' })
    const user = userEvent.setup()
    deleteBand.mockResolvedValueOnce({ data: { message: 'Band deleted' } })
    renderPage()
    await waitFor(() => expect(screen.getByLabelText('Band name')).toHaveValue('The Owls'))

    expect(screen.getByRole('button', { name: /unarchive/i })).toBeInTheDocument()

    // Delete requires confirmation.
    await user.click(screen.getByRole('button', { name: /delete permanently/i }))
    const dialog = await screen.findByRole('dialog')
    expect(deleteBand).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: /^delete$/i }))

    await waitFor(() => expect(deleteBand).toHaveBeenCalledWith('b-1'))
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/admin/bands'))
  })
})
