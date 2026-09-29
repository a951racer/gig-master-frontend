import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Control the band context per test (Req 19.1, 19.2, 19.4). Each list page
// consumes useBand() for { currentBand, hasNoBand }.
vi.mock('../auth/BandContext', () => ({
  useBand: vi.fn(),
}))

// Mock the resource API layers so no network happens; each list page's
// data-load effect calls these.
vi.mock('../api/songs', () => ({
  listSongs: vi.fn(),
  deleteSong: vi.fn(),
}))
vi.mock('../api/genres', () => ({
  listGenres: vi.fn(),
}))
vi.mock('../api/playlists', () => ({
  listPlaylists: vi.fn(),
  deletePlaylist: vi.fn(),
}))
vi.mock('../api/gigs', () => ({
  listGigs: vi.fn(),
  deleteGig: vi.fn(),
}))

import SongListPage from './songs/SongListPage'
import PlaylistListPage from './playlists/PlaylistListPage'
import GigListPage from './gigs/GigListPage'
import { useBand } from '../auth/BandContext'
import { listSongs } from '../api/songs'
import { listGenres } from '../api/genres'
import { listPlaylists } from '../api/playlists'
import { listGigs } from '../api/gigs'

const renderWithRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)

const setBand = (value) => vi.mocked(useBand).mockReturnValue(value)

beforeEach(() => {
  vi.clearAllMocks()
  // Default happy-path resolutions; individual tests override as needed.
  listSongs.mockResolvedValue({ data: [] })
  listGenres.mockResolvedValue({ data: [] })
  listPlaylists.mockResolvedValue({ data: [] })
  listGigs.mockResolvedValue({ data: [] })
})

// A table of the three scoped list pages so we can run the same shape of
// assertions against each.
const pages = [
  {
    name: 'SongListPage',
    Component: SongListPage,
    listApi: listSongs,
    rows: [
      { _id: 's1', title: 'Song One', artist: 'Artist A', tags: [] },
      { _id: 's2', title: 'Song Two', artist: 'Artist B', tags: [] },
    ],
    rowText: ['Song One', 'Song Two'],
  },
  {
    name: 'PlaylistListPage',
    Component: PlaylistListPage,
    listApi: listPlaylists,
    rows: [
      { _id: 'p1', name: 'Set One' },
      { _id: 'p2', name: 'Set Two' },
    ],
    rowText: ['Set One', 'Set Two'],
  },
  {
    name: 'GigListPage',
    Component: GigListPage,
    listApi: listGigs,
    rows: [
      { _id: 'g1', name: 'Gig One', date: '2024-01-01' },
      { _id: 'g2', name: 'Gig Two', date: '2024-02-02' },
    ],
    rowText: ['Gig One', 'Gig Two'],
  },
]

// Req 19.4: in the no-band state each list page renders the create-or-join
// prompt and never calls its list API.
describe('No-band state renders NoBandPrompt and does not fetch (Req 19.4)', () => {
  it.each(pages)('$name shows the create/join prompt and skips its list API', async ({ Component, listApi }) => {
    setBand({ currentBand: null, hasNoBand: true })

    renderWithRouter(<Component />)

    // NoBandPrompt exposes create/join links.
    expect(screen.getByRole('link', { name: /create a band/i })).toHaveAttribute('href', '/bands/new')
    expect(screen.getByRole('link', { name: /join a band/i })).toHaveAttribute('href', '/bands/join')

    // No fetch is triggered in the no-band state.
    expect(listApi).not.toHaveBeenCalled()
    // Songs page also gates the genre load behind hasNoBand.
    expect(listGenres).not.toHaveBeenCalled()
  })
})

// Req 19.1: with a current band, the page fetches on mount and renders rows.
describe('Scoped fetch when a current band is set (Req 19.1)', () => {
  it.each(pages)('$name fetches on mount and renders returned rows', async ({ Component, listApi, rows, rowText }) => {
    setBand({ currentBand: { id: 'b1' }, hasNoBand: false })
    listApi.mockResolvedValueOnce({ data: rows })

    renderWithRouter(<Component />)

    await waitFor(() => expect(listApi).toHaveBeenCalledTimes(1))
    for (const text of rowText) {
      expect(await screen.findByText(text)).toBeInTheDocument()
    }
  })
})

// Req 19.2: switching the current band refetches (effect keyed on currentBand?.id).
describe('Refetch on band switch (Req 19.2)', () => {
  it.each(pages)('$name refetches when currentBand changes from b1 to b2', async ({ Component, listApi }) => {
    setBand({ currentBand: { id: 'b1' }, hasNoBand: false })

    const { rerender } = renderWithRouter(<Component />)

    await waitFor(() => expect(listApi).toHaveBeenCalledTimes(1))

    // Switch bands and re-render the same page.
    setBand({ currentBand: { id: 'b2' }, hasNoBand: false })
    rerender(<MemoryRouter><Component /></MemoryRouter>)

    await waitFor(() => expect(listApi).toHaveBeenCalledTimes(2))
  })
})
