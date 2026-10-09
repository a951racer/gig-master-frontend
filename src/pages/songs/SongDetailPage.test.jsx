import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../api/songs', () => ({
  getSong: vi.fn(),
  updateSong: vi.fn(),
}))
vi.mock('../../api/genres', () => ({
  listGenres: vi.fn(),
}))
vi.mock('../../auth/BandContext', () => ({
  useBand: () => ({ currentBand: { id: 'b1', name: 'Band' }, hasNoBand: false }),
}))

const navigateMock = vi.fn()
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig()
  return { ...actual, useParams: () => ({ id: 'song-1' }), useNavigate: () => navigateMock }
})

import SongDetailPage from './SongDetailPage'
import { getSong, updateSong } from '../../api/songs'
import { listGenres } from '../../api/genres'

const renderPage = () => render(<MemoryRouter><SongDetailPage /></MemoryRouter>)

const song = {
  _id: 'song-1',
  title: 'Country Roads',
  artist: 'John Denver',
  genre: { _id: 'g1', name: 'Folk' },
  tags: ['classic', 'singalong'],
  originalKey: 'A',
}

beforeEach(() => {
  vi.clearAllMocks()
  getSong.mockResolvedValue({ data: song })
  updateSong.mockResolvedValue({ data: song })
  listGenres.mockResolvedValue({ data: [{ _id: 'g1', name: 'Folk' }, { _id: 'g2', name: 'Rock' }] })
})

describe('SongDetailPage (#83)', () => {
  it('renders the song read-only by default (no form inputs)', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Country Roads' })).toBeInTheDocument()
    expect(screen.getByText('John Denver')).toBeInTheDocument()
    expect(screen.getByText('Folk')).toBeInTheDocument()
    expect(screen.getByText('classic')).toBeInTheDocument()
    expect(screen.getByText('singalong')).toBeInTheDocument()
    expect(screen.getByText('A')).toBeInTheDocument()
    // Read-only: no title textbox until editing.
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    // Performed Key is gone entirely.
    expect(screen.queryByText(/performed key/i)).not.toBeInTheDocument()
  })

  it('the pencil toggles into an editable form', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'Country Roads' })

    await user.click(screen.getByRole('button', { name: /edit song/i }))

    // Now the fields are editable inputs seeded from the song.
    expect(screen.getByLabelText(/Title/)).toHaveValue('Country Roads')
    expect(screen.getByLabelText(/Artist/)).toHaveValue('John Denver')
  })

  it('saving calls updateSong with the edited fields (no performedKey) and returns to read-only', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'Country Roads' })
    await user.click(screen.getByRole('button', { name: /edit song/i }))

    const title = screen.getByLabelText(/Title/)
    await user.clear(title)
    await user.type(title, 'Take Me Home')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(updateSong).toHaveBeenCalledWith('song-1', expect.objectContaining({
      title: 'Take Me Home',
      artist: 'John Denver',
      originalKey: 'A',
      tags: ['classic', 'singalong'],
    })))
    // No performedKey in the payload.
    const payload = updateSong.mock.calls[0][1]
    expect(payload).not.toHaveProperty('performedKey')
  })

  it('cancel exits edit mode without saving', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'Country Roads' })
    await user.click(screen.getByRole('button', { name: /edit song/i }))
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(updateSong).not.toHaveBeenCalled()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('chart affordances navigate to the viewer and editor', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'Country Roads' })

    await user.click(screen.getByRole('button', { name: /view chart/i }))
    expect(navigateMock).toHaveBeenCalledWith('/songs/song-1/chart')

    await user.click(screen.getByRole('button', { name: /edit chart/i }))
    expect(navigateMock).toHaveBeenCalledWith('/songs/song-1/chart/edit')
  })
})
