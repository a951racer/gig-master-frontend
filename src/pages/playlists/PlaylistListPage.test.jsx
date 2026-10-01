import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../api/playlists', () => ({
  listPlaylists: vi.fn(),
  deletePlaylist: vi.fn(),
  getPlaylist: vi.fn(),
  createPlaylist: vi.fn(),
}))

// Band context: a band is selected (not the no-band state).
vi.mock('../../auth/BandContext', () => ({
  useBand: () => ({ currentBand: { id: 'b1', name: 'Band' }, hasNoBand: false }),
}))

const navigateMock = vi.fn()
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig()
  return { ...actual, useNavigate: () => navigateMock }
})

import PlaylistListPage from './PlaylistListPage'
import { listPlaylists, getPlaylist, createPlaylist } from '../../api/playlists'

const renderPage = () => render(<MemoryRouter><PlaylistListPage /></MemoryRouter>)

beforeEach(() => {
  vi.clearAllMocks()
  listPlaylists.mockResolvedValue({
    data: [
      { _id: 'p1', name: 'Summer Set', description: 'Outdoor gigs', songCount: 3 },
    ],
  })
})

describe('PlaylistListPage copy (#2)', () => {
  it('renders playlists', async () => {
    renderPage()
    expect(await screen.findByText('Summer Set')).toBeInTheDocument()
    expect(screen.getByText('3 songs')).toBeInTheDocument()
  })

  it('Copy opens a modal prefilled with "Copy of <name>" and the description', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Summer Set')

    await user.click(screen.getByRole('button', { name: /copy/i }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByLabelText(/new playlist name/i)).toHaveValue('Copy of Summer Set')
    expect(within(dialog).getByLabelText(/new playlist description/i)).toHaveValue('Outdoor gigs')
  })

  it('copying fetches the source songs and creates a new playlist, then navigates to it', async () => {
    const user = userEvent.setup()
    getPlaylist.mockResolvedValueOnce({
      data: { _id: 'p1', name: 'Summer Set', songs: [{ _id: 's1' }, { _id: 's2' }] },
    })
    createPlaylist.mockResolvedValueOnce({ data: { _id: 'p9', name: 'Copy of Summer Set' } })

    renderPage()
    await screen.findByText('Summer Set')
    await user.click(screen.getByRole('button', { name: /copy/i }))

    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /copy playlist/i }))

    await waitFor(() => expect(getPlaylist).toHaveBeenCalledWith('p1'))
    await waitFor(() => {
      expect(createPlaylist).toHaveBeenCalledWith({
        name: 'Copy of Summer Set',
        description: 'Outdoor gigs',
        songs: ['s1', 's2'],
      })
    })
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/playlists/p9'))
  })

  it('lets the user edit the name/description before copying', async () => {
    const user = userEvent.setup()
    getPlaylist.mockResolvedValueOnce({ data: { _id: 'p1', songs: ['s1'] } })
    createPlaylist.mockResolvedValueOnce({ data: { _id: 'p9' } })

    renderPage()
    await screen.findByText('Summer Set')
    await user.click(screen.getByRole('button', { name: /copy/i }))

    const dialog = await screen.findByRole('dialog')
    const nameField = within(dialog).getByLabelText(/new playlist name/i)
    await user.clear(nameField)
    await user.type(nameField, 'Winter Set')
    await user.click(within(dialog).getByRole('button', { name: /copy playlist/i }))

    await waitFor(() => {
      expect(createPlaylist).toHaveBeenCalledWith(expect.objectContaining({ name: 'Winter Set', songs: ['s1'] }))
    })
  })

  it('requires a name in the copy modal', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Summer Set')
    await user.click(screen.getByRole('button', { name: /copy/i }))

    const dialog = await screen.findByRole('dialog')
    await user.clear(within(dialog).getByLabelText(/new playlist name/i))
    await user.click(within(dialog).getByRole('button', { name: /copy playlist/i }))

    expect(await within(dialog).findByText(/name is required/i)).toBeInTheDocument()
    expect(createPlaylist).not.toHaveBeenCalled()
  })
})
