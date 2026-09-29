import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
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
  vi.mocked(useAuth).mockReturnValue({ user: defaultUser, token: 'valid.jwt.token', logout: vi.fn() })
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
    it('renders one option per band with matching label and value', () => {
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
      options.forEach((opt, i) => {
        expect(opt).toHaveValue(bands[i].id)
        expect(opt).toHaveTextContent(bands[i].name)
      })
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
})
