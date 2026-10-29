import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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

// Summer = {s1, s2}; Winter = {s3}. (Current setlist 'cur' is excluded.)
const SETLIST_SONGS = {
  'pl-a': [{ song: { _id: 's1' } }, { song: { _id: 's2' } }],
  'pl-b': [{ song: { _id: 's3' } }],
}

const renderPanel = (props = {}) =>
  render(
    <DndContext>
      <SongCatalogPanel currentPlaylistId="cur" {...props} />
    </DndContext>
  )

beforeEach(() => {
  vi.clearAllMocks()
  listGenres.mockResolvedValue({ data: [] })
  listSongs.mockResolvedValue({ data: SONGS })
  listPlaylists.mockResolvedValue({
    data: [
      { _id: 'cur', name: 'Current (being edited)' },
      { _id: 'pl-a', name: 'Summer Set' },
      { _id: 'pl-b', name: 'Winter Set' },
    ],
  })
  getPlaylist.mockImplementation((id) =>
    Promise.resolve({ data: { _id: id, songs: SETLIST_SONGS[id] || [] } })
  )
})

describe('SongCatalogPanel — multi-select setlist filter', () => {
  it('lists a checkbox per setlist, excluding the one being edited', async () => {
    renderPanel()
    expect(await screen.findByRole('checkbox', { name: 'Summer Set' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Winter Set' })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Current (being edited)' })).not.toBeInTheDocument()
  })

  it('shows the UNION of the selected setlists, minus songs in the current setlist', async () => {
    const user = userEvent.setup()
    // s1 is in the setlist being edited -> always hidden.
    renderPanel({ excludeIds: ['s1'] })
    await waitFor(() => expect(screen.getByText('Bravo')).toBeInTheDocument())

    // Select Summer (s1,s2) and Winter (s3). Union = s1,s2,s3; minus s1 => s2,s3.
    await user.click(await screen.findByRole('checkbox', { name: 'Summer Set' }))
    await user.click(screen.getByRole('checkbox', { name: 'Winter Set' }))

    await waitFor(() => {
      expect(screen.getByText('Bravo')).toBeInTheDocument()    // s2 (Summer)
      expect(screen.getByText('Charlie')).toBeInTheDocument()  // s3 (Winter)
    })
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument() // s1 excluded (current)
    expect(screen.queryByText('Delta')).not.toBeInTheDocument() // s4 in neither
  })

  it('invert hides the union; current-setlist songs stay hidden', async () => {
    const user = userEvent.setup()
    renderPanel({ excludeIds: ['s1'] })
    await waitFor(() => expect(screen.getByText('Bravo')).toBeInTheDocument())

    // Select only Summer (s1,s2).
    await user.click(await screen.findByRole('checkbox', { name: 'Summer Set' }))
    await waitFor(() => {
      // Show-matches: union = s1,s2; minus s1 => only Bravo(s2).
      expect(screen.getByText('Bravo')).toBeInTheDocument()
      expect(screen.queryByText('Charlie')).not.toBeInTheDocument()
    })

    // Invert: hide the union (s1,s2) => show s3,s4 (s1 still excluded).
    await user.click(screen.getByLabelText(/hide songs matching the filters/i))
    await waitFor(() => {
      expect(screen.getByText('Charlie')).toBeInTheDocument() // s3
      expect(screen.getByText('Delta')).toBeInTheDocument()   // s4
      expect(screen.queryByText('Bravo')).not.toBeInTheDocument() // s2 in union -> hidden
      expect(screen.queryByText('Alpha')).not.toBeInTheDocument() // s1 excluded always
    })
  })
})
