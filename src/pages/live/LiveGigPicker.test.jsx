import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

// Mock the gigs API; listGigs is stubbed per-test.
vi.mock('../../api/gigs', () => ({ listGigs: vi.fn() }))

// Band context: a band is present (hasNoBand false) so the picker fetches gigs.
vi.mock('../../auth/BandContext', () => ({
  useBand: () => ({ currentBand: { id: 'b1', name: 'Band' }, hasNoBand: false }),
}))

// Keep the real router, but override useNavigate with a spy we can assert on.
const navigate = vi.fn()
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig()
  return { ...actual, useNavigate: () => navigate }
})

import LiveGigPicker from './LiveGigPicker'
import { listGigs } from '../../api/gigs'

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
