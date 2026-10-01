import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import NavBar from './NavBar'
import { useAuth } from '../auth/AuthContext'
import { useBand } from '../auth/BandContext'
import { setCurrentBandId } from '../api/axiosInstance'

// Mock the hooks/module NavBar consumes so we can drive its state directly.
vi.mock('../auth/AuthContext', () => ({
  useAuth: vi.fn(),
}))

vi.mock('../auth/BandContext', () => ({
  useBand: vi.fn(),
}))

vi.mock('../api/axiosInstance', () => ({
  setCurrentBandId: vi.fn(),
}))

// Default truthy user so NavBar always renders (it returns null with no user).
const defaultUser = { id: 'u1', email: 'user@example.com' }
// Default profile (loaded from GET /auth/me in real AuthContext) with names.
const defaultProfile = { firstName: 'Jane', lastName: 'Doe', email: 'user@example.com' }
// Shared logout mock so the menu's Logout action can be asserted.
let logoutMock

// Sensible no-band-ish defaults; individual tests override via setBand().
const defaultBandValue = {
  bands: [],
  role: 'user',
  currentBand: null,
  setCurrentBand: vi.fn(),
  hasNoBand: true,
}

function setBand(overrides = {}) {
  vi.mocked(useBand).mockReturnValue({ ...defaultBandValue, ...overrides })
}

function renderNavBar() {
  return render(
    <MemoryRouter>
      <NavBar />
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  logoutMock = vi.fn()
  vi.mocked(useAuth).mockReturnValue({ user: defaultUser, token: 'valid.jwt.token', profile: defaultProfile, logout: logoutMock })
  setBand()
})

describe('NavBar', () => {
  it('renders nothing when there is no authenticated user', () => {
    vi.mocked(useAuth).mockReturnValue({ user: null, token: null, logout: vi.fn() })
    const { container } = renderNavBar()
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when there is no valid token (session invalid)', () => {
    // Even if a stale user object lingers, no token means the nav is hidden.
    vi.mocked(useAuth).mockReturnValue({ user: defaultUser, token: null, logout: vi.fn() })
    const { container } = renderNavBar()
    expect(container).toBeEmptyDOMElement()
  })

  describe('band switcher options mirror the token membership claim', () => {
    it('renders one option per band, sorted alphabetically by name', () => {
      // Provided in non-alphabetical order to prove the switcher sorts them.
      const bands = [
        { id: 'b1', name: 'The Alphas', isAdmin: false },
        { id: 'b2', name: 'Beta Crew', isAdmin: true },
        { id: 'b3', name: 'Gamma Rays', isAdmin: false },
      ]
      setBand({
        bands,
        currentBand: bands[0],
        hasNoBand: false,
      })

      renderNavBar()

      const select = screen.getByRole('combobox')
      const options = within(select).getAllByRole('option')

      // No placeholder option because a current band is selected.
      expect(options).toHaveLength(bands.length)

      // Options are the same set of bands, rendered alphabetically by name.
      const expected = [...bands].sort((a, b) => a.name.localeCompare(b.name))
      options.forEach((opt, i) => {
        expect(opt).toHaveValue(expected[i].id)
        expect(opt).toHaveTextContent(expected[i].name)
      })
      // Sanity: the first option is the alphabetically-first band, not b1.
      expect(options[0]).toHaveTextContent('Beta Crew')
    })

    it('shows a disabled placeholder option when no current band is selected', () => {
      const bands = [{ id: 'b1', name: 'The Alphas', isAdmin: false }]
      setBand({ bands, currentBand: null, hasNoBand: false })

      renderNavBar()

      const options = within(screen.getByRole('combobox')).getAllByRole('option')
      // placeholder + one band option
      expect(options).toHaveLength(2)
      expect(options[0]).toBeDisabled()
      expect(options[1]).toHaveValue('b1')
    })
  })

  describe('empty membership (no band)', () => {
    it('renders the create/join prompt and not the switcher', () => {
      setBand({ bands: [], currentBand: null, hasNoBand: true })

      renderNavBar()

      expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
      expect(screen.getByText('No band')).toBeInTheDocument()

      const createLink = screen.getByRole('link', { name: 'Create' })
      const joinLink = screen.getByRole('link', { name: 'Join' })
      expect(createLink).toHaveAttribute('href', '/bands/new')
      expect(joinLink).toHaveAttribute('href', '/bands/join')
    })
  })

  describe('band-admin link visibility', () => {
    it('shows the Band Admin link when currentBand.isAdmin is true', () => {
      const band = { id: 'b1', name: 'Admin Band', isAdmin: true }
      setBand({ bands: [band], currentBand: band, hasNoBand: false })

      renderNavBar()

      const link = screen.getByRole('link', { name: 'Band Admin' })
      expect(link).toHaveAttribute('href', '/band-admin')
    })

    it('hides the Band Admin link when currentBand.isAdmin is false', () => {
      const band = { id: 'b1', name: 'Member Band', isAdmin: false }
      setBand({ bands: [band], currentBand: band, hasNoBand: false })

      renderNavBar()

      expect(screen.queryByRole('link', { name: 'Band Admin' })).not.toBeInTheDocument()
    })
  })

  describe('sysadmin link visibility', () => {
    it('shows the Admin link when role is system_administrator', () => {
      const band = { id: 'b1', name: 'Any Band', isAdmin: false }
      setBand({
        bands: [band],
        currentBand: band,
        role: 'system_administrator',
        hasNoBand: false,
      })

      renderNavBar()

      const link = screen.getByRole('link', { name: 'Admin' })
      expect(link).toHaveAttribute('href', '/admin')
    })

    it('hides the Admin link when role is not system_administrator', () => {
      const band = { id: 'b1', name: 'Any Band', isAdmin: false }
      setBand({
        bands: [band],
        currentBand: band,
        role: 'user',
        hasNoBand: false,
      })

      renderNavBar()

      expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument()
    })
  })

  describe('switching the active band', () => {
    it('calls setCurrentBand and setCurrentBandId with the selected id', () => {
      const setCurrentBand = vi.fn()
      const bands = [
        { id: 'b1', name: 'The Alphas', isAdmin: false },
        { id: 'b2', name: 'Beta Crew', isAdmin: false },
      ]
      setBand({
        bands,
        currentBand: bands[0],
        setCurrentBand,
        hasNoBand: false,
      })

      renderNavBar()

      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'b2' } })

      expect(setCurrentBand).toHaveBeenCalledWith('b2')
      expect(setCurrentBandId).toHaveBeenCalledWith('b2')
    })
  })

  // #58: the user identity + account dropdown (Edit Profile / Logout).
  describe('user menu', () => {
    it('shows the current user name (First Last) and no standalone Profile/Logout', () => {
      renderNavBar()

      // The toggle shows the display name from the profile.
      expect(screen.getByRole('button', { name: /jane doe/i })).toBeInTheDocument()
      // The old standalone Profile link and Logout button are gone.
      expect(screen.queryByRole('link', { name: /^profile$/i })).not.toBeInTheDocument()
      // The menu is closed initially (no menu items visible).
      expect(screen.queryByRole('menuitem', { name: /edit profile/i })).not.toBeInTheDocument()
    })

    it('falls back to email when the profile has no names', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: defaultUser,
        token: 'valid.jwt.token',
        profile: { firstName: '', lastName: '', email: 'noname@example.com' },
        logout: logoutMock,
      })
      renderNavBar()
      expect(screen.getByRole('button', { name: /noname@example.com/i })).toBeInTheDocument()
    })

    it('opens the dropdown with Edit Profile and Logout, with aria-expanded', () => {
      renderNavBar()
      const toggle = screen.getByRole('button', { name: /jane doe/i })
      expect(toggle).toHaveAttribute('aria-expanded', 'false')

      fireEvent.click(toggle)

      expect(toggle).toHaveAttribute('aria-expanded', 'true')
      expect(screen.getByRole('menuitem', { name: /edit profile/i })).toBeInTheDocument()
      expect(screen.getByRole('menuitem', { name: /logout/i })).toBeInTheDocument()
    })

    it('Logout menu item calls logout', async () => {
      renderNavBar()
      fireEvent.click(screen.getByRole('button', { name: /jane doe/i }))
      fireEvent.click(screen.getByRole('menuitem', { name: /logout/i }))
      await waitFor(() => expect(logoutMock).toHaveBeenCalledTimes(1))
    })

    it('closes on Escape', () => {
      renderNavBar()
      fireEvent.click(screen.getByRole('button', { name: /jane doe/i }))
      expect(screen.getByRole('menuitem', { name: /edit profile/i })).toBeInTheDocument()

      fireEvent.keyDown(document, { key: 'Escape' })

      expect(screen.queryByRole('menuitem', { name: /edit profile/i })).not.toBeInTheDocument()
    })

    it('closes on outside click', () => {
      renderNavBar()
      fireEvent.click(screen.getByRole('button', { name: /jane doe/i }))
      expect(screen.getByRole('menuitem', { name: /edit profile/i })).toBeInTheDocument()

      // Click outside the menu (document body).
      fireEvent.mouseDown(document.body)

      expect(screen.queryByRole('menuitem', { name: /edit profile/i })).not.toBeInTheDocument()
    })

    it('Edit Profile menu item closes the menu (navigates to /profile)', () => {
      renderNavBar()
      fireEvent.click(screen.getByRole('button', { name: /jane doe/i }))
      fireEvent.click(screen.getByRole('menuitem', { name: /edit profile/i }))
      // Menu closes after selecting an item.
      expect(screen.queryByRole('menuitem', { name: /edit profile/i })).not.toBeInTheDocument()
    })
  })
})
