import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

// Focused on the data layer + Played Key editing (not drag-and-drop). The
// playlist's `songs` is the new subdocument shape: [{ song, playedKey }].
vi.mock('../../api/playlists', () => ({
  getPlaylist: vi.fn(),
  addSong: vi.fn(),
  removeSong: vi.fn(),
  reorderSongs: vi.fn(),
  setPlayedKey: vi.fn(),
}))

// Stub the catalog panel (it has its own data deps we don't need here).
vi.mock('../../components/SongCatalogPanel', () => ({
  default: () => <div data-testid="catalog" />,
}))

vi.mock('../../auth/BandContext', () => ({
  useBand: () => ({ currentBand: { id: 'b1', name: 'Band' }, hasNoBand: false }),
}))

const navigateMock = vi.fn()
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig()
  return { ...actual, useParams: () => ({ id: 'pl1' }), useNavigate: () => navigateMock }
})

import PlaylistDetailPage from './PlaylistDetailPage'
import { getPlaylist, setPlayedKey } from '../../api/playlists'

const renderPage = () => render(<MemoryRouter><PlaylistDetailPage /></MemoryRouter>)

const playlist = {
  _id: 'pl1',
  name: 'Friday Set',
  description: 'the gig',
  songs: [
    { song: { _id: 's1', title: 'Alpha', artist: 'A' }, playedKey: 'G' },
    { song: { _id: 's2', title: 'Beta', artist: 'B' }, playedKey: '' },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  getPlaylist.mockResolvedValue({ data: playlist })
  setPlayedKey.mockResolvedValue({ data: playlist })
})

describe('PlaylistDetailPage — Played Key (#84)', () => {
  it('renders songs from the { song, playedKey } entries', async () => {
    renderPage()
    expect(await screen.findByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
    expect(screen.getByText('2 songs')).toBeInTheDocument()
  })

  it('links each song title to its song detail page (#98)', async () => {
    renderPage()
    const alpha = await screen.findByRole('link', { name: 'Alpha' })
    expect(alpha).toHaveAttribute('href', '/songs/s1')
    const beta = screen.getByRole('link', { name: 'Beta' })
    expect(beta).toHaveAttribute('href', '/songs/s2')
  })

  it('shows each song\'s current played key in its selector', async () => {
    renderPage()
    const sel1 = await screen.findByLabelText('Played key for Alpha')
    const sel2 = screen.getByLabelText('Played key for Beta')
    expect(sel1).toHaveValue('G')
    expect(sel2).toHaveValue('') // unset → "—"
  })

  it('changing a played key calls setPlayedKey(playlistId, songId, key)', async () => {
    const user = userEvent.setup()
    renderPage()
    const sel = await screen.findByLabelText('Played key for Beta')
    await user.selectOptions(sel, 'D')
    await waitFor(() => expect(setPlayedKey).toHaveBeenCalledWith('pl1', 's2', 'D'))
    // Optimistic update reflects the new value.
    expect(sel).toHaveValue('D')
  })

  it('the key selector offers the 12 major keys and a blank clear option (no "Numbers")', async () => {
    renderPage()
    const sel = await screen.findByLabelText('Played key for Alpha')
    const values = Array.from(sel.querySelectorAll('option')).map(o => o.value)
    expect(values).toEqual(['', 'C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'])
    expect(values).not.toContain('Numbers')
  })

  it('does not crash on a LEGACY playlist whose songs are populated song docs (no wrapper)', async () => {
    // Pre-migration data: songs is a flat array of populated song documents,
    // not { song, playedKey } entries. The page must render them (keyless),
    // not throw on e.song._id.
    getPlaylist.mockResolvedValueOnce({
      data: {
        _id: 'pl1',
        name: 'Legacy Set',
        songs: [
          { _id: 's1', title: 'Alpha', artist: 'A' },
          { _id: 's2', title: 'Beta', artist: 'B' },
        ],
      },
    })
    renderPage()
    expect(await screen.findByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
    // Keyless → selectors default to the blank clear option.
    expect(screen.getByLabelText('Played key for Alpha')).toHaveValue('')
  })

    it('reverts the key on API failure', async () => {
    const user = userEvent.setup()
    setPlayedKey.mockRejectedValueOnce(new Error('nope'))
    renderPage()
    const sel = await screen.findByLabelText('Played key for Alpha')
    await user.selectOptions(sel, 'C')
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/played key/i))
    // Reverted back to the original 'G'.
    expect(sel).toHaveValue('G')
  })
})
