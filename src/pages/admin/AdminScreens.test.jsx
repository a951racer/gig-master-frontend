import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

// Mock the admin API layer so no network happens (Req 18.1-18.3).
vi.mock('../../api/admin', () => ({
  listUsers: vi.fn(),
  createUser: vi.fn(),
  setUserRole: vi.fn(),
  updateUser: vi.fn(),
  listBands: vi.fn(),
  createBand: vi.fn(),
  addBandMember: vi.fn(),
  listBandMembers: vi.fn(),
  setBandAdministrator: vi.fn(),
  renameBand: vi.fn(),
  archiveBand: vi.fn(),
  unarchiveBand: vi.fn(),
  deleteBand: vi.fn(),
  getSeedGenres: vi.fn(),
  updateSeedGenres: vi.fn(),
}))

// BandContext is consumed by every admin page via useBand() for role gating.
// Keep a stable per-test object so top-level role reads stay consistent.
let mockRole
vi.mock('../../auth/BandContext', () => ({
  useBand: () => ({ role: mockRole }),
}))

// BandAdminListPage consumes useAuth() for the current user id + in-place
// refresh (used to update the NavBar switcher after a self-affecting membership
// change). Drive both via mutable holders.
let mockAuthUser
const refreshMock = vi.fn()
vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ user: mockAuthUser, refresh: refreshMock }),
}))

import UserListPage from './users/UserListPage'
import BandAdminListPage from './bands/BandAdminListPage'
import SeedGenreListPage from './seed-genres/SeedGenreListPage'
import {
  listUsers,
  createUser,
  setUserRole,
  updateUser,
  listBands,
  createBand,
  addBandMember,
  listBandMembers,
  setBandAdministrator,
  renameBand,
  archiveBand,
  unarchiveBand,
  deleteBand,
  getSeedGenres,
  updateSeedGenres,
} from '../../api/admin'

const renderWithRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)

beforeEach(() => {
  vi.clearAllMocks()
  mockRole = undefined
  mockAuthUser = { id: 'current-admin' }
  refreshMock.mockResolvedValue(undefined)
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
    await user.selectOptions(screen.getByLabelText(/new user role/i), 'system_administrator')

    await user.click(screen.getByRole('button', { name: /create user/i }))

    await waitFor(() => {
      expect(createUser).toHaveBeenCalledWith({
        email: 'new@band.com',
        password: 'sup3rsecret',
        role: 'system_administrator',
        firstName: '',
        lastName: '',
      })
    })
  })

  it('submitting the create-user form with names passes firstName/lastName', async () => {
    const user = userEvent.setup()
    createUser.mockResolvedValueOnce({ data: { id: 'u-2', email: 'named@band.com' } })

    renderWithRouter(<UserListPage />)

    await user.type(screen.getByPlaceholderText(/email/i), 'named@band.com')
    await user.type(screen.getByPlaceholderText(/^password$/i), 'sup3rsecret')
    await user.type(screen.getByPlaceholderText(/first name/i), 'Ann')
    await user.type(screen.getByPlaceholderText(/last name/i), 'Smith')

    await user.click(screen.getByRole('button', { name: /create user/i }))

    await waitFor(() => {
      expect(createUser).toHaveBeenCalledWith({
        email: 'named@band.com',
        password: 'sup3rsecret',
        role: 'user',
        firstName: 'Ann',
        lastName: 'Smith',
      })
    })
  })

  it('submitting the assign-role form calls setUserRole(id, role)', async () => {
    const user = userEvent.setup()
    // The assign-role picker is populated from listUsers(). A named user is
    // shown as "Last, First"; selection is still by option VALUE (id).
    listUsers.mockResolvedValue({
      data: [
        { id: 'user-99', email: 'target@band.com', role: 'user', firstName: 'Ann', lastName: 'Smith' },
      ],
    })
    setUserRole.mockResolvedValueOnce({ data: {} })

    renderWithRouter(<UserListPage />)

    // Wait for the user picker to populate. A named user renders as "Last, First".
    const userPicker = await screen.findByLabelText('User')
    await waitFor(() =>
      expect(within(userPicker).getByText('Smith, Ann')).toBeInTheDocument()
    )
    // Selection is by value (id), so the friendly label does not affect it.
    await user.selectOptions(userPicker, 'user-99')

    // Target the assign-role select by its accessible label so added selects
    // elsewhere on the page (e.g. the edit-user section) don't shift indices.
    await user.selectOptions(screen.getByLabelText(/role to assign/i), 'system_administrator')

    await user.click(screen.getByRole('button', { name: /assign role/i }))

    await waitFor(() => {
      expect(setUserRole).toHaveBeenCalledWith('user-99', 'system_administrator')
    })
  })
})

// Edit user (#40): sysadmin selects a user, edits fields, and saves via updateUser.
describe('UserListPage edit-user (#40)', () => {
  beforeEach(() => {
    mockRole = 'system_administrator'
    listUsers.mockResolvedValue({
      data: [
        { id: 'user-7', email: 'edit@band.com', role: 'user', firstName: 'Ann', lastName: 'Smith' },
      ],
    })
  })

  it('populates the form from the selected user and saves changes via updateUser', async () => {
    const user = userEvent.setup()
    updateUser.mockResolvedValueOnce({ data: { id: 'user-7', email: 'renamed@band.com' } })

    renderWithRouter(<UserListPage />)

    const picker = await screen.findByLabelText(/user to edit/i)
    await waitFor(() =>
      expect(within(picker).getByText('Smith, Ann')).toBeInTheDocument()
    )
    await user.selectOptions(picker, 'user-7')

    // Fields populate from the selected user.
    const emailField = screen.getByLabelText(/edit email/i)
    await waitFor(() => expect(emailField).toHaveValue('edit@band.com'))
    expect(screen.getByLabelText(/edit first name/i)).toHaveValue('Ann')
    expect(screen.getByLabelText(/edit last name/i)).toHaveValue('Smith')

    // Change the email and save.
    await user.clear(emailField)
    await user.type(emailField, 'renamed@band.com')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith('user-7', {
        email: 'renamed@band.com',
        firstName: 'Ann',
        lastName: 'Smith',
        role: 'user',
      })
    })
    // The list is refreshed after a successful edit.
    await waitFor(() => expect(listUsers).toHaveBeenCalledTimes(2))
  })

  it('includes newPassword only when a password is entered', async () => {
    const user = userEvent.setup()
    updateUser.mockResolvedValueOnce({ data: { id: 'user-7', email: 'edit@band.com' } })

    renderWithRouter(<UserListPage />)

    const picker = await screen.findByLabelText(/user to edit/i)
    await user.selectOptions(picker, 'user-7')
    await screen.findByLabelText(/edit email/i)

    await user.type(screen.getByLabelText(/reset password/i), 'fresh-password')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith('user-7', {
        email: 'edit@band.com',
        firstName: 'Ann',
        lastName: 'Smith',
        role: 'user',
        newPassword: 'fresh-password',
      })
    })
  })

  it('surfaces a server error (e.g. LAST_ADMIN) without refreshing the list again', async () => {
    const user = userEvent.setup()
    updateUser.mockRejectedValueOnce({
      response: { data: { error: { code: 'LAST_ADMIN', message: 'Cannot remove the last system administrator' } } },
    })

    renderWithRouter(<UserListPage />)

    const picker = await screen.findByLabelText(/user to edit/i)
    await user.selectOptions(picker, 'user-7')
    await screen.findByLabelText(/edit email/i)

    await user.selectOptions(screen.getByLabelText(/edit role/i), 'system_administrator')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(await screen.findByText(/last system administrator/i)).toBeInTheDocument()
  })
})

// Req 18.2: sysadmin band management calls.
describe('BandAdminListPage as system_administrator (Req 18.2)', () => {
  beforeEach(() => {
    mockRole = 'system_administrator'
    // The dropdowns are populated from listUsers() and listBands().
    listUsers.mockResolvedValue({
      data: [
        // u-1 has names → rendered as "Last, First". u-2 has none → email.
        { id: 'u-1', email: 'admin@band.com', role: 'user', firstName: 'Ann', lastName: 'Smith' },
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
    // The administrator field is a user dropdown; a named user shows as
    // "Last, First" while a nameless user falls back to email. Selection is by
    // option value (id) regardless of label.
    const adminSelect = await screen.findByLabelText('Create band administrator')
    await waitFor(() =>
      expect(within(adminSelect).getByText('Smith, Ann')).toBeInTheDocument()
    )
    // A user without names still renders by email.
    expect(within(adminSelect).getByText('member@band.com')).toBeInTheDocument()
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

  it('selecting a band loads its members and flags the administrator', async () => {
    const user = userEvent.setup()
    listBandMembers.mockResolvedValueOnce({
      data: [
        { id: 'u-1', email: 'admin@band.com', firstName: 'Ann', lastName: 'Smith', isAdmin: true },
        { id: 'u-2', email: 'member@band.com', isAdmin: false },
      ],
    })

    renderWithRouter(<BandAdminListPage />)

    const membersSelect = await screen.findByLabelText('View members band')
    await waitFor(() =>
      expect(within(membersSelect).getByText('The Night Owls')).toBeInTheDocument()
    )
    await user.selectOptions(membersSelect, 'b-1')

    await waitFor(() => {
      expect(listBandMembers).toHaveBeenCalledWith('b-1')
    })

    // Scope assertions to the members list container so the friendly labels /
    // emails don't collide with the same values rendered in the pickers'
    // <option>s. The Admin badge appears only in the members list; its row is
    // badge.closest('div') and the list is that row's parent element.
    const badge = await screen.findByText('Admin')
    const membersList = badge.closest('div').parentElement
    expect(within(membersList).getByText('Smith, Ann')).toBeInTheDocument()
    expect(within(membersList).getByText('member@band.com')).toBeInTheDocument()
  })

  it('shows an empty state when a band has no members', async () => {
    const user = userEvent.setup()
    listBandMembers.mockResolvedValueOnce({ data: [] })

    renderWithRouter(<BandAdminListPage />)

    const membersSelect = await screen.findByLabelText('View members band')
    await waitFor(() =>
      expect(within(membersSelect).getByText('Second Band')).toBeInTheDocument()
    )
    await user.selectOptions(membersSelect, 'b-2')

    expect(await screen.findByText(/no members/i)).toBeInTheDocument()
  })

  it('surfaces an error when loading members fails', async () => {
    const user = userEvent.setup()
    listBandMembers.mockRejectedValueOnce({
      response: { data: { error: { message: 'Band not found' } } },
    })

    renderWithRouter(<BandAdminListPage />)

    const membersSelect = await screen.findByLabelText('View members band')
    await waitFor(() =>
      expect(within(membersSelect).getByText('The Night Owls')).toBeInTheDocument()
    )
    await user.selectOptions(membersSelect, 'b-1')

    expect(await screen.findByText(/band not found/i)).toBeInTheDocument()
  })
})

// Self-membership refresh: when a sysadmin changes their OWN band membership
// from the Bands page, their token is refreshed in place so the NavBar switcher
// updates without a hard reload. Actions affecting other users don't refresh.
describe('BandAdminListPage self-membership refresh', () => {
  beforeEach(() => {
    mockRole = 'system_administrator'
    mockAuthUser = { id: 'me' }
    listUsers.mockResolvedValue({
      data: [
        { id: 'me', email: 'me@band.com', role: 'system_administrator' },
        { id: 'other', email: 'other@band.com', role: 'user' },
      ],
    })
    listBands.mockResolvedValue({
      data: [{ id: 'b-1', name: 'The Night Owls' }],
    })
  })

  it('refreshes the session when the admin creates a band with THEMSELVES as administrator', async () => {
    const user = userEvent.setup()
    createBand.mockResolvedValueOnce({ data: { id: 'b-new', name: 'My Band' } })

    renderWithRouter(<BandAdminListPage />)

    await user.type(screen.getByPlaceholderText(/^band name$/i), 'My Band')
    const adminSelect = await screen.findByLabelText('Create band administrator')
    await user.selectOptions(adminSelect, 'me')
    await user.click(screen.getByRole('button', { name: /create band/i }))

    await waitFor(() => expect(createBand).toHaveBeenCalled())
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1))
  })

  it('does NOT refresh when the admin creates a band for ANOTHER user', async () => {
    const user = userEvent.setup()
    createBand.mockResolvedValueOnce({ data: { id: 'b-new', name: 'Their Band' } })

    renderWithRouter(<BandAdminListPage />)

    await user.type(screen.getByPlaceholderText(/^band name$/i), 'Their Band')
    const adminSelect = await screen.findByLabelText('Create band administrator')
    await user.selectOptions(adminSelect, 'other')
    await user.click(screen.getByRole('button', { name: /create band/i }))

    await waitFor(() => expect(createBand).toHaveBeenCalled())
    expect(refreshMock).not.toHaveBeenCalled()
  })

  it('refreshes when the admin adds THEMSELVES as a member', async () => {
    const user = userEvent.setup()
    addBandMember.mockResolvedValueOnce({ data: {} })

    renderWithRouter(<BandAdminListPage />)

    const bandSelect = await screen.findByLabelText('Add member band')
    await user.selectOptions(bandSelect, 'b-1')
    const userSelect = await screen.findByLabelText('Add member user')
    await user.selectOptions(userSelect, 'me')
    await user.click(screen.getByRole('button', { name: /add member/i }))

    await waitFor(() => expect(addBandMember).toHaveBeenCalledWith('b-1', 'me'))
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1))
  })

  it('does NOT refresh when the admin adds ANOTHER user as a member', async () => {
    const user = userEvent.setup()
    addBandMember.mockResolvedValueOnce({ data: {} })

    renderWithRouter(<BandAdminListPage />)

    const bandSelect = await screen.findByLabelText('Add member band')
    await user.selectOptions(bandSelect, 'b-1')
    const userSelect = await screen.findByLabelText('Add member user')
    await user.selectOptions(userSelect, 'other')
    await user.click(screen.getByRole('button', { name: /add member/i }))

    await waitFor(() => expect(addBandMember).toHaveBeenCalledWith('b-1', 'other'))
    expect(refreshMock).not.toHaveBeenCalled()
  })

  it('refreshes when the admin sets THEMSELVES as a band administrator', async () => {
    const user = userEvent.setup()
    setBandAdministrator.mockResolvedValueOnce({ data: {} })

    renderWithRouter(<BandAdminListPage />)

    const bandSelect = await screen.findByLabelText('Set administrator band')
    await user.selectOptions(bandSelect, 'b-1')
    const userSelect = await screen.findByLabelText('Set administrator user')
    await user.selectOptions(userSelect, 'me')
    await user.click(screen.getByRole('button', { name: /set administrator/i }))

    await waitFor(() => expect(setBandAdministrator).toHaveBeenCalledWith('b-1', 'me'))
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1))
  })
})

// Two-stage band deletion UI (#42): archive → confirm-gated hard delete.
describe('BandAdminListPage archive/delete (#42)', () => {
  beforeEach(() => {
    mockRole = 'system_administrator'
    listUsers.mockResolvedValue({ data: [] })
    // b-1 is active, b-2 is already archived.
    listBands.mockResolvedValue({
      data: [
        { id: 'b-1', name: 'Active Band', archivedAt: null },
        { id: 'b-2', name: 'Archived Band', archivedAt: '2024-01-01T00:00:00.000Z' },
      ],
    })
  })

  it('shows an Archived badge and the right actions per band', async () => {
    renderWithRouter(<BandAdminListPage />)

    // The archived band shows a badge; the active one does not.
    expect(await screen.findByText('Archived')).toBeInTheDocument()
    // Active band offers Archive; archived band offers Unarchive + Delete.
    expect(screen.getByRole('button', { name: /^archive$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /unarchive/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^delete$/i })).toBeInTheDocument()
  })

  it('archiving a band calls archiveBand and refreshes the list', async () => {
    const user = userEvent.setup()
    archiveBand.mockResolvedValueOnce({ data: {} })

    renderWithRouter(<BandAdminListPage />)

    await user.click(await screen.findByRole('button', { name: /^archive$/i }))

    await waitFor(() => {
      expect(archiveBand).toHaveBeenCalledWith('b-1')
    })
    // Initial load + refresh after archive.
    await waitFor(() => expect(listBands).toHaveBeenCalledTimes(2))
  })

  it('unarchiving a band calls unarchiveBand', async () => {
    const user = userEvent.setup()
    unarchiveBand.mockResolvedValueOnce({ data: {} })

    renderWithRouter(<BandAdminListPage />)

    await user.click(await screen.findByRole('button', { name: /unarchive/i }))

    await waitFor(() => {
      expect(unarchiveBand).toHaveBeenCalledWith('b-2')
    })
  })

  it('deleting requires confirmation and calls deleteBand only after confirm', async () => {
    const user = userEvent.setup()
    deleteBand.mockResolvedValueOnce({ data: { message: 'Band deleted' } })

    renderWithRouter(<BandAdminListPage />)

    // Click the row Delete → opens a confirm dialog; nothing deleted yet.
    await user.click(await screen.findByRole('button', { name: /^delete$/i }))
    const dialog = await screen.findByRole('dialog')
    expect(deleteBand).not.toHaveBeenCalled()

    // Confirm inside the dialog (its confirm button is labeled Delete).
    await user.click(within(dialog).getByRole('button', { name: /^delete$/i }))

    await waitFor(() => {
      expect(deleteBand).toHaveBeenCalledWith('b-2')
    })
  })

  it('cancelling the confirm dialog does not delete', async () => {
    const user = userEvent.setup()

    renderWithRouter(<BandAdminListPage />)

    await user.click(await screen.findByRole('button', { name: /^delete$/i }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /cancel/i }))

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
    expect(deleteBand).not.toHaveBeenCalled()
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
