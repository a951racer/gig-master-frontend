import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../api/songs', () => ({
  listSongs: vi.fn(),
  deleteSong: vi.fn(),
}))
vi.mock('../../api/genres', () => ({
  listGenres: vi.fn(),
}))
vi.mock('../../auth/BandContext', () => ({
  useBand: () => ({ currentBand: { id: 'b1', name: 'Band' }, hasNoBand: false }),
}))

import SongListPage from './SongListPage'
import { listSongs } from '../../api/songs'
import { listGenres } from '../../api/genres'

const renderPage = () => render(<MemoryRouter><SongListPage /></MemoryRouter>)

const songs = [
  { _id: 's1', title: 'Alpha', artist: 'A', genre: { name: 'Rock' }, tags: ['x'], originalKey: 'G', performedKey: 'C' },
]

beforeEach(() => {
  vi.clearAllMocks()
  listSongs.mockResolvedValue({ data: songs })
  listGenres.mockResolvedValue({ data: [] })
})

describe('SongListPage — slimmed actions (#83)', () => {
  it('renders the title as a link to the song detail page', async () => {
    renderPage()
    const link = await screen.findByRole('link', { name: 'Alpha' })
    expect(link).toHaveAttribute('href', '/songs/s1')
  })

  it('the row Actions are a Chart link (to the viewer) and a Delete button — no Edit / Edit Chart', async () => {
    renderPage()
    const row = (await screen.findByRole('link', { name: 'Alpha' })).closest('tr')

    // Chart action is a link to the chart VIEWER (not the editor).
    const chart = within(row).getByRole('link', { name: 'Chart' })
    expect(chart).toHaveAttribute('href', '/songs/s1/chart')

    // Delete is the only button.
    const buttons = within(row).getAllByRole('button').map(b => b.textContent)
    expect(buttons).toEqual(['Delete'])

    // No Edit / Edit Chart affordances.
    expect(within(row).queryByText('Edit Chart')).not.toBeInTheDocument()
    expect(within(row).queryByText('Edit')).not.toBeInTheDocument()
  })

  it('the Key column shows originalKey (no performedKey fallback)', async () => {
    renderPage()
    const row = (await screen.findByRole('link', { name: 'Alpha' })).closest('tr')
    // originalKey 'G' is shown; performedKey 'C' is NOT.
    expect(within(row).getByText('G')).toBeInTheDocument()
    expect(within(row).queryByText('C')).not.toBeInTheDocument()
  })
})
