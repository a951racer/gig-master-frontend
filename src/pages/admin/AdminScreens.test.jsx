import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

// Mock the admin API layer so no network happens (Req 18.1-18.3).
vi.mock('../../api/admin', () => ({
  listUsers: vi.fn(),
  createUser: vi.fn(),
  setUserRole: vi.fn(),
  listBands: vi.fn(),
  createBand: vi.fn(),
  addBandMember: vi.fn(),
  setBandAdministrator: vi.fn(),
  renameBand: vi.fn(),
  getSeedGenres: vi.fn(),
  updateSeedGenres: vi.fn(),
}))

// BandContext is consumed by every admin page via useBand() for role gating.
// Keep a stable per-test object so top-level role reads stay consistent.
let mockRole
vi.mock('../../auth/BandContext', () => ({
  useBand: () => ({ role: mockRole }),
}))

import UserListPage from './users/UserListPage'
import BandAdminListPage from './bands/BandAdminListPage'
import SeedGenreListPage from './seed-genres/SeedGenreListPage'
import {
  listUsers,
  createUser,
  setUserRole,
  listBands,
  createBand,
  addBandMember,
  setBandAdministrator,
  renameBand,
  getSeedGenres,
  updateSeedGenres,
} from '../../api/admin'

const renderWithRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)

beforeEach(() => {
  vi.clearAllMocks()
  mockRole = undefined
  listUsers.mockResolvedValue({ data: [] })
  listBands.mockResolvedValue({ data: [] })
})

// Req 18.4, 18.5: every sysadmin screen is gated on role === 'system_administrator'.
// A non-sysadmin sees a not-authorized state and NO admin API is called.
describe('Sysadmin screen visibility gating (Req 18.4, 18.5)', () => {
  it('UserListPage renders not-authorized and calls no user APIs for a non-sysadmin', () => {
    mockRole = 'user'
    renderWithRouter(<UserListPage />)

    expect(screen.getByText(/not authorized to manage users/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /create user/i })).not.toBeInTheDocument()
    expect(createUser).not.toHaveBeenCalled()
    expect(setUserRole).not.toHaveBeenCalled()
  })

  it('BandAdminListPage renders not-authorized and calls no band APIs for a non-sysadmin', () => {
    mockRole = 'user'
    renderWithRouter(<BandAdminListPage />)

    expect(screen.getByText(/not authorized to manage bands/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /create band/i })).not.toBeInTheDocument()
    // The load effect must not fire the admin APIs when unauthorized.
    expect(listBands).not.toHaveBeenCalled()
    expect(listUsers).not.toHaveBeenCalled()
    expect(createBand).not.toHaveBeenCalled()
    expect(addBandMember).not.toHaveBeenCalled()
    expect(setBandAdministrator).not.toHaveBeenCalled()
  })

  it('SeedGenreListPage renders not-authorized and does NOT load seed genres for a non-sysadmin', () => {
    mockRole = 'user'
    renderWithRouter(<SeedGenreListPage />)

    expect(screen.getByText(/not authorized to maintain the seed genre list/i)).toBeInTheDocument()
    // The load effect must not fire the admin API when unauthorized.
    expect(getSeedGenres).not.toHaveBeenCalled()
    expect(updateSeedGenres).not.toHaveBeenCalled()
  })

  it('renders not-authorized when role is undefined (no sysadmin claim)', () => {
    mockRole = undefined
    renderWithRouter(<UserListPage />)

    expect(screen.getByText(/not authorized to manage users/i)).toBeInTheDocument()
    expect(createUser).not.toHaveBeenCalled()
  })
})

// Req 18.1: sysadmin user management calls.
describe('UserListPage as system_administrator (Req 18.1)', () => {
  beforeEach(() => {
    mockRole = 'system_administrator'
  })

  it('submitting the create-user form calls createUser({ email, password, role })', async () => {
    const user = userEvent.setup()
    createUser.mockResolvedValueOnce({ data: { id: 'u-1', email: 'new@band.com' } })

    renderWithRouter(<UserListPage />)

    await user.type(screen.getByPlaceholderText(/email/i), 'new@band.com')
    await user.type(screen.getByPlaceholderText(/password/i), 'sup3rsecret')
    // Set the create-user role select to system_administrator.
    const roleSelect = screen.getAllByRole('combobox')[0]
    await user.selectOptions(roleSelect, 'system_administrator')

    await user.click(screen.getByRole('button', { name: /create user/i }))

    await waitFor(() => {
      expect(createUser).toHaveBeenCalledWith({
        email: 'new@band.com',
        password: 'sup3rsecret',
        role: 'system_administrator',
      })
    })
  })

  it('submitting the assign-role form calls setUserRole(id, role)', async () => {
    const user = userEvent.setup()
    // The assign-role picker is populated from listUsers().
    listUsers.mockResolvedValue({
      data: [{ id: 'user-99', email: 'target@band.com', role: 'user' }],
    })
    setUserRole.mockResolvedValueOnce({ data: {} })

    renderWithRouter(<UserListPage />)

    // Wait for the user picker to populate, then select the target user.
    const userPicker = await screen.findByLabelText('User')
    await waitFor(() =>
      expect(within(userPicker).getByText('target@band.com')).toBeInTheDocument()
    )
    await user.selectOptions(userPicker, 'user-99')

    // The assign-role form has two selects: the User picker and the role select.
    // The role select is the last combobox on the page (create-role, user
    // picker, then assign-role).
    const comboboxes = screen.getAllByRole('combobox')
    const assignRoleSelect = comboboxes[comboboxes.length - 1]
    await user.selectOptions(assignRoleSelect, 'system_administrator')

    await user.click(screen.getByRole('button', { name: /assign role/i }))

    await waitFor(() => {
      expect(setUserRole).toHaveBeenCalledWith('user-99', 'system_administrator')
    })
  })
})

// Req 18.2: sysadmin band management calls.
describe('BandAdminListPage as system_administrator (Req 18.2)', () => {
  beforeEach(() => {
    mockRole = 'system_administrator'
    // The dropdowns are populated from listUsers() and listBands().
    listUsers.mockResolvedValue({
      data: [
        { id: 'u-1', email: 'admin@band.com', role: 'user' },
        { id: 'u-2', email: 'member@band.com', role: 'user' },
      ],
    })
    listBands.mockResolvedValue({
      data: [
        { id: 'b-1', name: 'The Night Owls' },
        { id: 'b-2', name: 'Second Band' },
      ],
    })
  })

  it('submitting the create-band form calls createBand({ name, administrator })', async () => {
    const user = userEvent.setup()
    createBand.mockResolvedValueOnce({ data: { id: 'b-3', name: 'The Night Owls' } })

    renderWithRouter(<BandAdminListPage />)

    await user.type(screen.getByPlaceholderText(/^band name$/i), 'The Night Owls')
    // The administrator field is now a user-email dropdown; select by option value (id).
    const adminSelect = await screen.findByLabelText('Create band administrator')
    await waitFor(() =>
      expect(within(adminSelect).getByText('admin@band.com')).toBeInTheDocument()
    )
    await user.selectOptions(adminSelect, 'u-1')

    await user.click(screen.getByRole('button', { name: /create band/i }))

    await waitFor(() => {
      expect(createBand).toHaveBeenCalledWith({
        name: 'The Night Owls',
        administrator: 'u-1',
      })
    })
  })

  it('submitting the add-member form calls addBandMember(bandId, userId)', async () => {
    const user = userEvent.setup()
    addBandMember.mockResolvedValueOnce({ data: {} })

    renderWithRouter(<BandAdminListPage />)

    const bandSelect = await screen.findByLabelText('Add member band')
    await waitFor(() =>
      expect(within(bandSelect).getByText('The Night Owls')).toBeInTheDocument()
    )
    await user.selectOptions(bandSelect, 'b-1')

    const userSelect = await screen.findByLabelText('Add member user')
    await user.selectOptions(userSelect, 'u-2')

    await user.click(screen.getByRole('button', { name: /add member/i }))

    await waitFor(() => {
      expect(addBandMember).toHaveBeenCalledWith('b-1', 'u-2')
    })
  })

  it('submitting the set-administrator form calls setBandAdministrator(bandId, userId)', async () => {
    const user = userEvent.setup()
    setBandAdministrator.mockResolvedValueOnce({ data: {} })

    renderWithRouter(<BandAdminListPage />)

    const bandSelect = await screen.findByLabelText('Set administrator band')
    await waitFor(() =>
      expect(within(bandSelect).getByText('Second Band')).toBeInTheDocument()
    )
    await user.selectOptions(bandSelect, 'b-2')

    const userSelect = await screen.findByLabelText('Set administrator user')
    await user.selectOptions(userSelect, 'u-1')

    await user.click(screen.getByRole('button', { name: /set administrator/i }))

    await waitFor(() => {
      expect(setBandAdministrator).toHaveBeenCalledWith('b-2', 'u-1')
    })
  })

  it('submitting the rename-band form calls renameBand(bandId, name)', async () => {
    const user = userEvent.setup()
    renameBand.mockResolvedValueOnce({ data: {} })

    renderWithRouter(<BandAdminListPage />)

    const bandSelect = await screen.findByLabelText('Rename band')
    await waitFor(() =>
      expect(within(bandSelect).getByText('The Night Owls')).toBeInTheDocument()
    )
    await user.selectOptions(bandSelect, 'b-1')

    await user.type(screen.getByPlaceholderText(/new band name/i), 'Renamed Owls')

    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(renameBand).toHaveBeenCalledWith('b-1', 'Renamed Owls')
    })
  })
})

// Req 18.3: sysadmin seed-genre maintenance calls.
describe('SeedGenreListPage as system_administrator (Req 18.3)', () => {
  beforeEach(() => {
    mockRole = 'system_administrator'
  })

  it('loads seed genres on mount via getSeedGenres and renders the names', async () => {
    getSeedGenres.mockResolvedValueOnce({ data: { genres: ['Rock', 'Jazz'] } })

    renderWithRouter(<SeedGenreListPage />)

    await waitFor(() => {
      expect(getSeedGenres).toHaveBeenCalled()
    })
    expect(await screen.findByText('Rock')).toBeInTheDocument()
    expect(screen.getByText('Jazz')).toBeInTheDocument()
  })

  it('handles a plain-array seed genre response shape', async () => {
    getSeedGenres.mockResolvedValueOnce({ data: ['Blues', 'Funk'] })

    renderWithRouter(<SeedGenreListPage />)

    expect(await screen.findByText('Blues')).toBeInTheDocument()
    expect(screen.getByText('Funk')).toBeInTheDocument()
  })

  it('adding a genre and clicking Save calls updateSeedGenres with the edited list', async () => {
    const user = userEvent.setup()
    getSeedGenres.mockResolvedValueOnce({ data: { genres: ['Rock'] } })
    updateSeedGenres.mockResolvedValueOnce({ data: {} })

    renderWithRouter(<SeedGenreListPage />)

    // Wait for initial load.
    expect(await screen.findByText('Rock')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText(/new seed genre name/i), 'Metal')
    await user.click(screen.getByRole('button', { name: /^add$/i }))

    expect(await screen.findByText('Metal')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /save seed genres/i }))

    await waitFor(() => {
      expect(updateSeedGenres).toHaveBeenCalledWith(['Rock', 'Metal'])
    })
  })
})
