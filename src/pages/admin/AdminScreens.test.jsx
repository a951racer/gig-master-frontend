import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

// Mock the admin API layer so no network happens.
vi.mock('../../api/admin', () => ({
  listUsers: vi.fn(),
  createUser: vi.fn(),
  listBands: vi.fn(),
  createBand: vi.fn(),
  getSeedGenres: vi.fn(),
  updateSeedGenres: vi.fn(),
}))

// Role gating comes from useBand(); current-user + refresh from useAuth().
let mockRole
vi.mock('../../auth/BandContext', () => ({
  useBand: () => ({ role: mockRole }),
}))
let mockAuthUser
const refreshMock = vi.fn()
vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ user: mockAuthUser, refresh: refreshMock }),
}))

// Capture router navigation triggered by row clicks.
const navigateMock = vi.fn()
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig()
  return { ...actual, useNavigate: () => navigateMock }
})

import UserListPage from './users/UserListPage'
import BandAdminListPage from './bands/BandAdminListPage'
import SeedGenreListPage from './seed-genres/SeedGenreListPage'
import { listUsers, createUser, listBands, createBand, getSeedGenres, updateSeedGenres } from '../../api/admin'

const renderWithRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)

beforeEach(() => {
  vi.clearAllMocks()
  mockRole = undefined
  mockAuthUser = { id: 'current-admin' }
  refreshMock.mockResolvedValue(undefined)
  listUsers.mockResolvedValue({ data: [] })
  listBands.mockResolvedValue({ data: [] })
})

// Req 18.4/18.5: sysadmin screens are gated on role === 'system_administrator'.
describe('Sysadmin screen gating (Req 18.4, 18.5)', () => {
  it('UserListPage shows not-authorized and calls no API for a non-sysadmin', async () => {
    mockRole = 'user'
    renderWithRouter(<UserListPage />)
    expect(screen.getByText(/not authorized to manage users/i)).toBeInTheDocument()
    await Promise.resolve()
    expect(listUsers).not.toHaveBeenCalled()
  })

  it('BandAdminListPage shows not-authorized and calls no API for a non-sysadmin', async () => {
    mockRole = 'user'
    renderWithRouter(<BandAdminListPage />)
    expect(screen.getByText(/not authorized to manage bands/i)).toBeInTheDocument()
    await Promise.resolve()
    expect(listBands).not.toHaveBeenCalled()
  })
})

// #54: Users table + Create User.
describe('UserListPage table (#54)', () => {
  beforeEach(() => {
    mockRole = 'system_administrator'
    listUsers.mockResolvedValue({
      data: [
        { id: 'u-1', email: 'ann@band.com', role: 'user', firstName: 'Ann', lastName: 'Smith' },
        { id: 'u-2', email: 'bob@band.com', role: 'system_administrator' },
      ],
    })
  })

  it('renders a table of users', async () => {
    renderWithRouter(<UserListPage />)
    // Ann has names → "Smith, Ann" in the Name column + email in Email column.
    expect(await screen.findByText('Smith, Ann')).toBeInTheDocument()
    expect(screen.getByText('ann@band.com')).toBeInTheDocument()
    // Bob has no names → email appears in both Name and Email columns.
    expect(screen.getAllByText('bob@band.com').length).toBe(2)
    // Friendly role label.
    expect(screen.getByText('System Administrator')).toBeInTheDocument()
  })

  it('navigates to the user detail page on row click', async () => {
    renderWithRouter(<UserListPage />)
    const row = (await screen.findByText('ann@band.com')).closest('tr')
    await userEvent.setup().click(row)
    expect(navigateMock).toHaveBeenCalledWith('/admin/users/u-1')
  })

  it('Create User opens a modal and creates a user, refreshing the list', async () => {
    const user = userEvent.setup()
    createUser.mockResolvedValueOnce({ data: { id: 'u-3', email: 'carol@band.com' } })
    renderWithRouter(<UserListPage />)
    await screen.findByText('ann@band.com')

    await user.click(screen.getByRole('button', { name: /create user/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/email/i), 'carol@band.com')
    await user.type(within(dialog).getByPlaceholderText(/password/i), 'sup3rsecret')
    await user.click(within(dialog).getByRole('button', { name: /create user/i }))

    await waitFor(() => {
      expect(createUser).toHaveBeenCalledWith(expect.objectContaining({ email: 'carol@band.com', password: 'sup3rsecret', role: 'user' }))
    })
    await waitFor(() => expect(listUsers).toHaveBeenCalledTimes(2))
  })
})

// #56: Bands table + Create Band.
describe('BandAdminListPage table (#56)', () => {
  beforeEach(() => {
    mockRole = 'system_administrator'
    mockAuthUser = { id: 'me' }
    listUsers.mockResolvedValue({
      data: [{ id: 'me', email: 'me@band.com', firstName: 'Me', lastName: 'Admin' }],
    })
    listBands.mockResolvedValue({
      data: [
        { id: 'b-1', name: 'Active Band', administrator: 'me', archivedAt: null },
        { id: 'b-2', name: 'Archived Band', administrator: 'me', archivedAt: '2024-01-01T00:00:00Z' },
      ],
    })
  })

  it('renders a table of bands with administrator and archived badge', async () => {
    renderWithRouter(<BandAdminListPage />)
    expect(await screen.findByText('Active Band')).toBeInTheDocument()
    expect(screen.getByText('Archived Band')).toBeInTheDocument()
    expect(screen.getByText('Archived')).toBeInTheDocument()
    // administrator label resolved from the users list
    expect(screen.getAllByText('Admin, Me').length).toBeGreaterThan(0)
  })

  it('navigates to the band detail page on row click', async () => {
    renderWithRouter(<BandAdminListPage />)
    const row = (await screen.findByText('Active Band')).closest('tr')
    await userEvent.setup().click(row)
    expect(navigateMock).toHaveBeenCalledWith('/admin/bands/b-1')
  })

  it('Create Band opens a modal and creates a band, refreshing the list', async () => {
    const user = userEvent.setup()
    createBand.mockResolvedValueOnce({ data: { id: 'b-3', name: 'New Band' } })
    renderWithRouter(<BandAdminListPage />)
    await screen.findByText('Active Band')

    await user.click(screen.getByRole('button', { name: /create band/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/band name/i), 'New Band')
    await user.selectOptions(within(dialog).getByLabelText(/create band administrator/i), 'me')
    await user.click(within(dialog).getByRole('button', { name: /create band/i }))

    await waitFor(() => {
      expect(createBand).toHaveBeenCalledWith({ name: 'New Band', administrator: 'me' })
    })
    // Admin created a band with THEMSELVES as admin → session refresh fires.
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(listBands).toHaveBeenCalledTimes(2))
  })

  it('does NOT refresh when creating a band for another administrator', async () => {
    const user = userEvent.setup()
    // Add another user to pick as admin.
    listUsers.mockResolvedValue({
      data: [
        { id: 'me', email: 'me@band.com' },
        { id: 'other', email: 'other@band.com' },
      ],
    })
    createBand.mockResolvedValueOnce({ data: { id: 'b-9', name: 'Theirs' } })
    renderWithRouter(<BandAdminListPage />)
    await screen.findByText('Active Band')

    await user.click(screen.getByRole('button', { name: /create band/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/band name/i), 'Theirs')
    await user.selectOptions(within(dialog).getByLabelText(/create band administrator/i), 'other')
    await user.click(within(dialog).getByRole('button', { name: /create band/i }))

    await waitFor(() => expect(createBand).toHaveBeenCalled())
    expect(refreshMock).not.toHaveBeenCalled()
  })

  it('shows a friendly message when creating a duplicate band name (409)', async () => {
    const user = userEvent.setup()
    createBand.mockRejectedValueOnce({ response: { data: { error: { code: 'DUPLICATE_BAND_NAME' } } } })
    renderWithRouter(<BandAdminListPage />)
    await screen.findByText('Active Band')

    await user.click(screen.getByRole('button', { name: /create band/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/band name/i), 'Active Band')
    await user.selectOptions(within(dialog).getByLabelText(/create band administrator/i), 'me')
    await user.click(within(dialog).getByRole('button', { name: /create band/i }))

    expect(await within(dialog).findByText(/band names must be unique/i)).toBeInTheDocument()
  })
})

// Seed genres page is unchanged by the remodel.
describe('SeedGenreListPage (unchanged)', () => {
  beforeEach(() => {
    mockRole = 'system_administrator'
  })

  it('loads seed genres on mount and renders the names', async () => {
    getSeedGenres.mockResolvedValueOnce({ data: { genres: ['Rock', 'Jazz'] } })
    renderWithRouter(<SeedGenreListPage />)
    expect(await screen.findByText('Rock')).toBeInTheDocument()
    expect(screen.getByText('Jazz')).toBeInTheDocument()
  })

  it('adds a genre and saves via updateSeedGenres', async () => {
    const user = userEvent.setup()
    getSeedGenres.mockResolvedValueOnce({ data: { genres: [] } })
    updateSeedGenres.mockResolvedValueOnce({ data: { genres: ['Blues'] } })
    renderWithRouter(<SeedGenreListPage />)
    await screen.findByText(/no seed genres yet/i)

    await user.type(screen.getByPlaceholderText(/new seed genre name/i), 'Blues')
    await user.click(screen.getByRole('button', { name: /^add$/i }))
    await user.click(screen.getByRole('button', { name: /save seed genres/i }))

    await waitFor(() => expect(updateSeedGenres).toHaveBeenCalledWith(['Blues']))
  })
})
