import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

// Mock the API layers: getGig loads the gig; allCharts is stubbed and asserted.
vi.mock('../../api/gigs', () => ({ getGig: vi.fn() }))
vi.mock('../../api/charts', () => ({ allCharts: vi.fn() }))
vi.mock('../../auth/BandContext', () => ({
  useBand: () => ({ currentBand: { id: 'b1', name: 'Band' }, hasNoBand: false }),
}))

// Keep the real router, overriding useParams (→ gig-1) and useNavigate (spy).
const navigate = vi.fn()
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig()
  return { ...actual, useParams: () => ({ id: 'gig-1' }), useNavigate: () => navigate }
})

import LiveSetup from './LiveSetup'
import { getGig } from '../../api/gigs'
import { allCharts } from '../../api/charts'

const renderSetup = () => render(<MemoryRouter><LiveSetup /></MemoryRouter>)

// A gig with a two-song setlist, each with a played key.
const gigWithSetlist = {
  _id: 'gig-1',
  name: 'Elder Care',
  playlist: {
    _id: 'pl1',
    name: 'Nursing Home Gigs',
    songs: [
      { song: { _id: 's1', title: 'Bye Bye Love', artist: 'Everly Brothers' }, playedKey: 'A' },
      { song: { _id: 's2', title: 'Sweet Caroline', artist: 'Neil Diamond' }, playedKey: 'G' },
    ],
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  getGig.mockResolvedValue({ data: gigWithSetlist })
})

describe('LiveSetup — setup step (Req 2.1)', () => {
  it('renders the setlist song titles and a "Start Gig" control', async () => {
    renderSetup()

    expect(await screen.findByText('Bye Bye Love')).toBeInTheDocument()
    expect(screen.getByText('Sweet Caroline')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start gig/i })).toBeInTheDocument()
  })
})

describe('LiveSetup — start a performance (Req 2.2)', () => {
  it('calls allCharts with the playlist id + selections and navigates to the play route on success', async () => {
    const user = userEvent.setup()
    const charts = [
      { songId: 's1', title: 'Bye Bye Love', playedKey: 'A', chart: null },
      { songId: 's2', title: 'Sweet Caroline', playedKey: 'G', chart: null },
    ]
    allCharts.mockResolvedValue({ data: { charts, truncated: false } })

    renderSetup()
    await screen.findByText('Bye Bye Love')

    await user.click(screen.getByRole('button', { name: /start gig/i }))

    const expectedSelections = [
      { songId: 's1', mode: 'Numbers' },
      { songId: 's2', mode: 'Numbers' },
    ]

    await waitFor(() =>
      expect(allCharts).toHaveBeenCalledWith('pl1', { selections: expectedSelections })
    )

    expect(navigate).toHaveBeenCalledWith(
      '/live/gigs/gig-1/play',
      { state: expect.objectContaining({ charts, selections: expectedSelections }) }
    )
  })
})

describe('LiveSetup — charts request failure (Req 2.3)', () => {
  it('shows an error and does NOT navigate when allCharts rejects', async () => {
    const user = userEvent.setup()
    allCharts.mockRejectedValue(new Error('network down'))

    renderSetup()
    await screen.findByText('Bye Bye Love')

    await user.click(screen.getByRole('button', { name: /start gig/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/failed to load charts/i)
    expect(navigate).not.toHaveBeenCalled()
    // Stays on the setup step — the Start control is still present.
    expect(screen.getByRole('button', { name: /start gig/i })).toBeInTheDocument()
  })
})

describe('LiveSetup — empty state (Req 1.3-consistent)', () => {
  it('renders a non-crashing empty state with a back action when the gig has no setlist', async () => {
    getGig.mockResolvedValue({ data: { _id: 'gig-1', name: 'Open Mic', playlist: null } })
    const user = userEvent.setup()
    renderSetup()

    expect(await screen.findByText(/no setlist songs to perform/i)).toBeInTheDocument()

    // A back action returns to the gig list without crashing.
    const back = screen.getByRole('button', { name: /back to gigs/i })
    await user.click(back)
    expect(navigate).toHaveBeenCalledWith('/live')
  })
})
