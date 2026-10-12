import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

// Mock the gigs API; listGigs is stubbed per-test.
vi.mock('../../api/gigs', () => ({ listGigs: vi.fn() }))

// Auth context: expose a controllable logout spy. The header renders a "Log out"
// button whose handler awaits logout() then navigates to /login, so the tests
// drive logout() per-case (resolve or reject) via this hoisted spy.
const { logout } = vi.hoisted(() => ({ logout: vi.fn() }))
vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ logout }),
}))

// Band context: a band is present (hasNoBand false) so the picker fetches gigs.
// useBand is a spy set per-test; the default (a single band) means BandSwitcher
// renders nothing, leaving the existing list/gating tests unaffected.
vi.mock('../../auth/BandContext', () => ({ useBand: vi.fn() }))

// Keep the real router, but override useNavigate with a spy we can assert on.
const navigate = vi.fn()
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig()
  return { ...actual, useNavigate: () => navigate }
})

import LiveGigPicker from './LiveGigPicker'
import { listGigs } from '../../api/gigs'
import { useBand } from '../../auth/BandContext'

const renderPicker = () => render(<MemoryRouter><LiveGigPicker /></MemoryRouter>)

// One performable gig (setlist has a song) + one non-performable (empty setlist).
const performableGig = {
  _id: 'gig-1',
  name: 'Elder Care',
  date: '2024-06-01',
  location: 'Sunrise Home',
  playlist: { _id: 'pl1', songs: [{ song: { _id: 's1', title: 'Bye Bye Love' } }] },
}
const emptyGig = {
  _id: 'gig-2',
  name: 'Open Mic',
  playlist: { _id: 'pl2', songs: [] },
}
const noPlaylistGig = {
  _id: 'gig-3',
  name: 'No Playlist',
  playlist: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  // Default: single band → BandSwitcher renders null, so the picker's list and
  // gating behavior is unchanged for the existing tests.
  useBand.mockReturnValue({
    bands: [{ id: 'b1', name: 'Band' }],
    currentBand: { id: 'b1', name: 'Band' },
    setCurrentBand: vi.fn(),
    hasNoBand: false,
  })
  // Default logout resolves; the failure test overrides this.
  logout.mockResolvedValue(undefined)
})

describe('LiveGigPicker — gig list (Req 1.1)', () => {
  it('lists the gigs returned by listGigs', async () => {
    listGigs.mockResolvedValue({ data: [performableGig, emptyGig] })
    renderPicker()

    expect(await screen.findByText('Elder Care')).toBeInTheDocument()
    expect(screen.getByText('Open Mic')).toBeInTheDocument()
  })
})

describe('LiveGigPicker — performable gig selection (Req 1.2)', () => {
  it('navigates to the live setup when a performable gig is clicked', async () => {
    const user = userEvent.setup()
    listGigs.mockResolvedValue({ data: [performableGig] })
    renderPicker()

    const gig = await screen.findByRole('button', { name: /elder care/i })
    await user.click(gig)

    expect(navigate).toHaveBeenCalledWith('/live/gigs/gig-1')
  })
})

describe('LiveGigPicker — non-performable gig gating (Req 1.3)', () => {
  it('shows "No setlist" and does NOT navigate for a gig with no setlist songs', async () => {
    const user = userEvent.setup()
    listGigs.mockResolvedValue({ data: [emptyGig, noPlaylistGig] })
    renderPicker()

    // The non-performable gig is a non-button div flagged aria-disabled.
    const openMic = await screen.findByText('Open Mic')
    const row = openMic.closest('[aria-disabled="true"]')
    expect(row).not.toBeNull()
    expect(within(row).getByText(/no setlist/i)).toBeInTheDocument()

    // It is not a button, so there is nothing clickable that navigates.
    expect(screen.queryByRole('button', { name: /open mic/i })).not.toBeInTheDocument()

    // Clicking the disabled row does not navigate.
    await user.click(row)
    expect(navigate).not.toHaveBeenCalled()

    // A gig with no playlist at all is also gated as non-performable.
    const noPlaylist = screen.getByText('No Playlist')
    expect(noPlaylist.closest('[aria-disabled="true"]')).not.toBeNull()
  })
})

describe('LiveGigPicker — empty state', () => {
  it('shows "No gigs yet." when listGigs returns no gigs', async () => {
    listGigs.mockResolvedValue({ data: [] })
    renderPicker()

    expect(await screen.findByText(/no gigs yet\./i)).toBeInTheDocument()
  })
})

describe('LiveGigPicker — chromeless (Req 3.1)', () => {
  it('renders standalone with its heading and no app NavBar chrome', async () => {
    listGigs.mockResolvedValue({ data: [performableGig] })
    const { container } = renderPicker()

    // The picker renders its own branded heading...
    expect(await screen.findByRole('heading', { name: /gig master live/i })).toBeInTheDocument()

    // ...and renders no navigation chrome of its own: no <nav> element and no
    // app NavBar links (the picker is a bare screen inside LiveLayout).
    expect(container.querySelector('nav')).toBeNull()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })
})

describe('LiveGigPicker — logout control (Req 1.2, 1.4)', () => {
  it('calls logout() then navigates to /login when "Log out" is clicked', async () => {
    const user = userEvent.setup()
    listGigs.mockResolvedValue({ data: [performableGig] })
    renderPicker()

    const logoutButton = await screen.findByRole('button', { name: /log out/i })
    await user.click(logoutButton)

    expect(logout).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith('/login')
  })

  it('still navigates to /login when the logout network call fails (Property 4)', async () => {
    const user = userEvent.setup()
    // The picker's handler is `try { await logout() } finally { navigate('/login') }`,
    // so navigation is guaranteed regardless of the logout call's outcome.
    // AuthContext.logout wraps the network call in try/catch — on a failed
    // `logoutApi()` it swallows the error, clears local auth state, and still
    // RESOLVES. We model that failure here: the underlying network call rejects
    // but logout() resolves, and we still land on /login (Req 1.4, Property 4).
    logout.mockImplementation(async () => {
      try {
        await Promise.reject(new Error('network down'))
      } catch {
        // AuthContext.logout swallows the network error and still resolves.
      }
    })
    listGigs.mockResolvedValue({ data: [performableGig] })
    renderPicker()

    const logoutButton = await screen.findByRole('button', { name: /log out/i })
    await user.click(logoutButton)

    expect(logout).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith('/login')
  })
})

describe('LiveGigPicker — band switcher visibility (Req 2.1, 2.3)', () => {
  it('shows the "Current band" selector when the user belongs to multiple bands', async () => {
    useBand.mockReturnValue({
      bands: [
        { id: 'b1', name: 'The Night Owls' },
        { id: 'b2', name: 'Daytime Trio' },
      ],
      currentBand: { id: 'b1', name: 'The Night Owls' },
      setCurrentBand: vi.fn(),
      hasNoBand: false,
    })
    listGigs.mockResolvedValue({ data: [performableGig] })
    renderPicker()

    expect(await screen.findByText('Elder Care')).toBeInTheDocument()
    expect(screen.getByLabelText('Current band')).toBeInTheDocument()
  })

  it('does NOT show the band selector when the user belongs to a single band', async () => {
    // The default useBand mock (set in beforeEach) is a single band.
    listGigs.mockResolvedValue({ data: [performableGig] })
    renderPicker()

    expect(await screen.findByText('Elder Care')).toBeInTheDocument()
    expect(screen.queryByLabelText('Current band')).not.toBeInTheDocument()
  })
})
