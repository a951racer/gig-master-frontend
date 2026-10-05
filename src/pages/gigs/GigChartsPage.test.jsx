import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

// Mock the API layers. getGig loads the gig; the all* fns are stubbed and
// asserted.
vi.mock('../../api/gigs', () => ({ getGig: vi.fn() }))
vi.mock('../../api/charts', () => ({
  allCharts: vi.fn(),
  allChartsPdf: vi.fn(),
  allChartsPdfZip: vi.fn(),
}))
vi.mock('../../auth/BandContext', () => ({
  useBand: () => ({ currentBand: { id: 'b1', name: 'Band' }, hasNoBand: false }),
}))
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig()
  return { ...actual, useParams: () => ({ id: 'gig-1' }) }
})

import GigChartsPage from './GigChartsPage'
import { getGig } from '../../api/gigs'
import { allCharts, allChartsPdf, allChartsPdfZip } from '../../api/charts'

const renderPage = () => render(<MemoryRouter><GigChartsPage /></MemoryRouter>)

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

// A one-page chart for a song.
const oneP = (title) => ({
  title,
  artist: 'Someone',
  keyLabel: 'A',
  playedKey: 'A',
  mode: 'Numbers',
  formatting: { font: 'monospace', size: 11, chordColor: 'blue', columns: 1 },
  sections: [],
  pages: [{ columns: [{ lines: [{ header: { label: `${title} VERSE`, repeat: null } }] }] }],
})

beforeEach(() => {
  vi.clearAllMocks()
  getGig.mockResolvedValue({ data: gigWithSetlist })
})

describe('GigChartsPage — setup step (#85)', () => {
  it('lists setlist songs with played keys and per-song mode controls', async () => {
    renderPage()

    expect(await screen.findByText('Bye Bye Love')).toBeInTheDocument()
    expect(screen.getByText('Sweet Caroline')).toBeInTheDocument()
    // Played keys in brackets.
    expect(screen.getByText('[A]')).toBeInTheDocument()
    expect(screen.getByText('[G]')).toBeInTheDocument()

    // Per-song groups each have Numbers + Chords controls.
    const g1 = screen.getByRole('group', { name: /mode for bye bye love/i })
    expect(within(g1).getByRole('button', { name: 'Numbers' })).toBeInTheDocument()
    expect(within(g1).getByRole('button', { name: 'Chords' })).toBeInTheDocument()
    // Defaults to Numbers.
    expect(within(g1).getByRole('button', { name: 'Numbers' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('"All Chords" sets every song to Chords, and per-song override works', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Bye Bye Love')

    await user.click(screen.getByRole('button', { name: 'All Chords' }))

    const g1 = screen.getByRole('group', { name: /mode for bye bye love/i })
    const g2 = screen.getByRole('group', { name: /mode for sweet caroline/i })
    expect(within(g1).getByRole('button', { name: 'Chords' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(g2).getByRole('button', { name: 'Chords' })).toHaveAttribute('aria-pressed', 'true')

    // Override song 1 back to Numbers.
    await user.click(within(g1).getByRole('button', { name: 'Numbers' }))
    expect(within(g1).getByRole('button', { name: 'Numbers' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(g2).getByRole('button', { name: 'Chords' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('Generate calls allCharts with per-song { songId, mode } selections', async () => {
    const user = userEvent.setup()
    allCharts.mockResolvedValue({ data: { playlistId: 'pl1', charts: [], truncated: false } })

    renderPage()
    await screen.findByText('Bye Bye Love')

    // Set song 1 to Chords; leave song 2 at Numbers.
    const g1 = screen.getByRole('group', { name: /mode for bye bye love/i })
    await user.click(within(g1).getByRole('button', { name: 'Chords' }))

    await user.click(screen.getByRole('button', { name: /^generate charts$/i }))

    await waitFor(() =>
      expect(allCharts).toHaveBeenCalledWith('pl1', {
        selections: [
          { songId: 's1', mode: 'Chords' },
          { songId: 's2', mode: 'Numbers' },
        ],
      })
    )
  })
})

describe('GigChartsPage — performance view (#85)', () => {
  it('pages through the flat sequence including a "No chart" placeholder', async () => {
    const user = userEvent.setup()
    // s1 has a one-page chart; s2 has no chart (null).
    allCharts.mockResolvedValue({
      data: {
        playlistId: 'pl1',
        truncated: false,
        charts: [
          { songId: 's1', title: 'Bye Bye Love', playedKey: 'A', chart: oneP('Bye Bye Love') },
          { songId: 's2', title: 'Sweet Caroline', playedKey: 'G', chart: null },
        ],
      },
    })

    renderPage()
    await screen.findByText('Bye Bye Love')
    await user.click(screen.getByRole('button', { name: /^generate charts$/i }))

    // Performance view: 2 pages total (1 real + 1 placeholder).
    expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument()
    // Page 1 is the real chart (its section header is shown).
    expect(screen.getByRole('heading', { name: /BYE BYE LOVE VERSE/i })).toBeInTheDocument()

    // Jump-to-start disabled at the start; next advances.
    expect(screen.getByRole('button', { name: /jump to beginning/i })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: /next page/i }))

    expect(await screen.findByText('Page 2 of 2')).toBeInTheDocument()
    // Page 2 is the placeholder for the null-chart song.
    expect(screen.getByText(/no chart for this song/i)).toBeInTheDocument()
    expect(screen.getByText(/Sweet Caroline \[G\]/)).toBeInTheDocument()

    // Previous goes back to page 1.
    await user.click(screen.getByRole('button', { name: /previous page/i }))
    expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument()

    // Advance again, then jump-to-start returns to page 1.
    await user.click(screen.getByRole('button', { name: /next page/i }))
    await screen.findByText('Page 2 of 2')
    await user.click(screen.getByRole('button', { name: /jump to beginning/i }))
    expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument()
  })

  it('Combined PDF and Zip buttons call allChartsPdf / allChartsPdfZip with selections', async () => {
    const user = userEvent.setup()
    allCharts.mockResolvedValue({
      data: {
        playlistId: 'pl1',
        truncated: false,
        charts: [{ songId: 's1', title: 'Bye Bye Love', playedKey: 'A', chart: oneP('Bye Bye Love') }],
      },
    })
    allChartsPdf.mockResolvedValue({ data: new Blob(['pdf'], { type: 'application/pdf' }) })
    allChartsPdfZip.mockResolvedValue({ data: new Blob(['zip'], { type: 'application/zip' }) })

    // jsdom lacks URL.createObjectURL / revokeObjectURL; define them for the
    // download path.
    const origCreate = URL.createObjectURL
    const origRevoke = URL.revokeObjectURL
    URL.createObjectURL = vi.fn().mockReturnValue('blob:x')
    URL.revokeObjectURL = vi.fn()

    renderPage()
    await screen.findByText('Bye Bye Love')
    await user.click(screen.getByRole('button', { name: /^generate charts$/i }))
    await screen.findByText('Page 1 of 1')

    // Selections cover the whole setlist (both songs), regardless of how many
    // charts the render returned.
    const expectedSelections = {
      selections: [
        { songId: 's1', mode: 'Numbers' },
        { songId: 's2', mode: 'Numbers' },
      ],
    }

    await user.click(screen.getByRole('button', { name: /combined pdf/i }))
    await waitFor(() => expect(allChartsPdf).toHaveBeenCalledWith('pl1', expectedSelections))

    await user.click(screen.getByRole('button', { name: /individual pdfs \(zip\)/i }))
    await waitFor(() => expect(allChartsPdfZip).toHaveBeenCalledWith('pl1', expectedSelections))

    URL.createObjectURL = origCreate
    URL.revokeObjectURL = origRevoke
  })
})

describe('GigChartsPage — empty state', () => {
  it('shows an empty state and a back link when the gig has no setlist', async () => {
    getGig.mockResolvedValue({ data: { _id: 'gig-1', name: 'Open Mic', playlist: null } })
    renderPage()
    expect(await screen.findByText(/no setlist songs to chart/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to gig/i })).toHaveAttribute('href', '/gigs/gig-1')
  })
})
