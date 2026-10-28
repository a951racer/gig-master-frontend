import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DndContext } from '@dnd-kit/core'

vi.mock('../api/songs', () => ({ listSongs: vi.fn() }))
vi.mock('../api/genres', () => ({ listGenres: vi.fn() }))
vi.mock('../api/playlists', () => ({ listPlaylists: vi.fn(), getPlaylist: vi.fn() }))
vi.mock('../auth/BandContext', () => ({
  useBand: () => ({ currentBand: { id: 'b1', name: 'Band' } }),
}))

import SongCatalogPanel from './SongCatalogPanel'
import { listSongs } from '../api/songs'
import { listGenres } from '../api/genres'
import { listPlaylists, getPlaylist } from '../api/playlists'

// Band catalog: 4 songs.
const SONGS = [
  { _id: 's1', title: 'Alpha', artist: 'A', genre: null, tags: ['rock'] },
  { _id: 's2', title: 'Bravo', artist: 'B', genre: null, tags: ['jazz'] },
  { _id: 's3', title: 'Charlie', artist: 'C', genre: null, tags: ['rock'] },
  { _id: 's4', title: 'Delta', artist: 'D', genre: null, tags: [] },
]

const renderPanel = (props = {}) =>
  render(
    <DndContext>
      <SongCatalogPanel currentPlaylistId="cur" {...props} />
    </DndContext>
  )

// Visible song cards, by their title text.
const visibleTitles = () =>
  SONGS.map(s => s.title).filter(t => screen.queryByText(t))

beforeEach(() => {
  vi.clearAllMocks()
  listGenres.mockResolvedValue({ data: [] })
  listSongs.mockResolvedValue({ data: SONGS })
  // Two other setlists + the current one (which must be excluded from the dropdown).
  listPlaylists.mockResolvedValue({
    data: [
      { _id: 'cur', name: 'Current (being edited)' },
      { _id: 'pl-a', name: 'Summer Set' },
      { _id: 'pl-b', name: 'Winter Set' },
    ],
  })
  // Summer Set contains s1, s2, s3.
  getPlaylist.mockResolvedValue({
    data: { _id: 'pl-a', name: 'Summer Set', songs: [
      { song: { _id: 's1' } }, { song: { _id: 's2' } }, { song: { _id: 's3' } },
    ] },
  })
})

describe('SongCatalogPanel — setlist filter', () => {
  it('lists all setlists except the one being edited in the dropdown', async () => {
    renderPanel()
    const select = await screen.findByLabelText('Filter by setlist')
    const options = within(select).getAllByRole('option').map(o => o.textContent)
    expect(options).toContain('Summer Set')
    expect(options).toContain('Winter Set')
    // The current (edited) setlist is NOT an option.
    expect(options).not.toContain('Current (being edited)')
  })

  it('narrows the catalog to the chosen setlist, minus songs already in the current setlist', async () => {
    const user = userEvent.setup()
    // s1 is already in the setlist being edited -> always hidden.
    renderPanel({ excludeIds: ['s1'] })
    // With no filter active, the other three songs show (s1 excluded).
    await waitFor(() => expect(screen.getByText('Bravo')).toBeInTheDocument())

    await user.selectOptions(await screen.findByLabelText('Filter by setlist'), 'pl-a')

    // Summer Set = s1,s2,s3; minus s1 (in current setlist) => s2, s3 visible.
    await waitFor(() => {
      expect(screen.getByText('Bravo')).toBeInTheDocument()   // s2
      expect(screen.getByText('Charlie')).toBeInTheDocument() // s3
    })
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument() // s1 excluded
    expect(screen.queryByText('Delta')).not.toBeInTheDocument() // s4 not in Summer Set
  })
})

describe('SongCatalogPanel — invert toggle', () => {
  it('inverts the whole filter predicate (hide matches) while keeping current-setlist songs hidden', async () => {
    const user = userEvent.setup()
    renderPanel({ excludeIds: ['s1'] })
    await waitFor(() => expect(screen.queryByText('Bravo')).toBeInTheDocument())

    // Filter: title contains "a" -> matches Alpha, Bravo, Charlie, Delta? 
    // Use a precise filter: tag "rock" matches s1, s3.
    await user.type(screen.getByPlaceholderText('Tags'), 'rock')
    await waitFor(() => {
      // Normal (show matches): rock = s1,s3; s1 excluded => only Charlie(s3).
      expect(screen.getByText('Charlie')).toBeInTheDocument()
      expect(screen.queryByText('Bravo')).not.toBeInTheDocument()
    })

    // Invert (hide matches): hide rock songs => show non-rock = s2,s4 (s1 still excluded).
    await user.click(screen.getByLabelText(/hide songs matching the filters/i))
    await waitFor(() => {
      expect(screen.getByText('Bravo')).toBeInTheDocument()   // s2 (jazz)
      expect(screen.getByText('Delta')).toBeInTheDocument()   // s4 (no tags)
      expect(screen.queryByText('Charlie')).not.toBeInTheDocument() // s3 rock -> hidden
      expect(screen.queryByText('Alpha')).not.toBeInTheDocument()   // s1 excluded always
    })
  })
})
