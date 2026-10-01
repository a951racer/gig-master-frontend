import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

// Mock the bands API layer (join-request queue + band rename) so no network happens.
vi.mock('../../api/bands', () => ({
  listJoinRequests: vi.fn(),
  resolveJoinRequest: vi.fn(),
  renameBand: vi.fn(),
}))

// BandAdminPage's "Band settings" section uses the membership refresh hook;
// stub it so no /auth/refresh or navigation happens.
vi.mock('../bands/refreshMembership', () => ({
  useRefreshMembership: () => vi.fn(),
}))

// Mock the genres API layer (genre editor) so no network happens.
vi.mock('../../api/genres', () => ({
  listGenres: vi.fn(),
  createGenre: vi.fn(),
  updateGenre: vi.fn(),
  deleteGenre: vi.fn(),
}))

// BandContext is consumed by all band-admin pages via useBand(). We drive the
// gating (currentBand.isAdmin) by swapping mockBandValue per test.
let mockBandValue = { currentBand: null }
vi.mock('../../auth/BandContext', () => ({
  useBand: () => mockBandValue,
}))

import BandAdminPage from './BandAdminPage'
import JoinRequestQueuePage from './JoinRequestQueuePage'
import BandGenreEditorPage from './BandGenreEditorPage'
import { listJoinRequests, resolveJoinRequest } from '../../api/bands'
import { listGenres, createGenre, deleteGenre } from '../../api/genres'

const renderWithRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)

const adminBand = { id: 'band-1', name: 'The Night Owls', isAdmin: true }

beforeEach(() => {
  vi.clearAllMocks()
  mockBandValue = { currentBand: null }
})

// Req 17.3, 17.4: every band-admin screen is gated on currentBand.isAdmin. When
// the current band is not administered (or there is no current band), the page
// renders a not-authorized state and never calls the admin APIs.
describe('Band-admin visibility gating (Req 17.3, 17.4)', () => {
  it('BandAdminPage shows a not-authorized state and no nav when currentBand is null', () => {
    mockBandValue = { currentBand: null }
    renderWithRouter(<BandAdminPage />)

    expect(screen.getByText(/select a band you administer/i)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /join requests/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /genres/i })).not.toBeInTheDocument()
  })

  it('BandAdminPage shows a not-authorized state when currentBand is not administered', () => {
    mockBandValue = { currentBand: { id: 'band-2', name: 'Guest Band', isAdmin: false } }
    renderWithRouter(<BandAdminPage />)

    expect(screen.getByText(/select a band you administer/i)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /join requests/i })).not.toBeInTheDocument()
  })

  it('JoinRequestQueuePage renders a not-authorized state and does not call listJoinRequests when not admin', async () => {
    mockBandValue = { currentBand: { id: 'band-2', name: 'Guest Band', isAdmin: false } }
    renderWithRouter(<JoinRequestQueuePage />)

    expect(screen.getByText(/select a band you administer/i)).toBeInTheDocument()
    // Give any (unexpected) effect a chance to run before asserting no call.
    await Promise.resolve()
    expect(listJoinRequests).not.toHaveBeenCalled()
  })

  it('JoinRequestQueuePage does not call listJoinRequests when currentBand is null', async () => {
    mockBandValue = { currentBand: null }
    renderWithRouter(<JoinRequestQueuePage />)

    expect(screen.getByText(/select a band you administer/i)).toBeInTheDocument()
    await Promise.resolve()
    expect(listJoinRequests).not.toHaveBeenCalled()
  })

  it('BandGenreEditorPage renders a not-authorized state and does not call listGenres when not admin', async () => {
    mockBandValue = { currentBand: { id: 'band-2', name: 'Guest Band', isAdmin: false } }
    renderWithRouter(<BandGenreEditorPage />)

    expect(screen.getByText(/select a band you administer/i)).toBeInTheDocument()
    await Promise.resolve()
    expect(listGenres).not.toHaveBeenCalled()
  })

  it('BandGenreEditorPage does not call listGenres when currentBand is null', async () => {
    mockBandValue = { currentBand: null }
    renderWithRouter(<BandGenreEditorPage />)

    expect(screen.getByText(/select a band you administer/i)).toBeInTheDocument()
    await Promise.resolve()
    expect(listGenres).not.toHaveBeenCalled()
  })
})

// Req 17.4: when the current band is administered, BandAdminPage renders its
// nav (Join Requests / Genres) and the nested Outlet.
describe('BandAdminPage when the current band is administered (Req 17.4)', () => {
  it('renders the nav links and the nested Outlet', () => {
    mockBandValue = { currentBand: adminBand }
    render(
      <MemoryRouter initialEntries={['/band-admin']}>
        <Routes>
          <Route path="/band-admin" element={<BandAdminPage />}>
            <Route index element={<div>Outlet content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByRole('link', { name: /join requests/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /genres/i })).toBeInTheDocument()
    expect(screen.getByText('Outlet content')).toBeInTheDocument()
    expect(screen.getByText(adminBand.name)).toBeInTheDocument()
  })
})

// Req 17.1: the admin join-request queue loads the current band's pending
// requests and approves/denies them, refreshing the list after each action.
describe('JoinRequestQueuePage actions when administered (Req 17.1)', () => {
  it('loads pending requests for the current band', async () => {
    mockBandValue = { currentBand: adminBand }
    listJoinRequests.mockResolvedValueOnce({
      data: [
        { id: 'jr-1', user: { email: 'alice@example.com' } },
        { id: 'jr-2', user: { email: 'bob@example.com' } },
      ],
    })

    renderWithRouter(<JoinRequestQueuePage />)

    expect(await screen.findByText('alice@example.com')).toBeInTheDocument()
    expect(screen.getByText('bob@example.com')).toBeInTheDocument()
    expect(listJoinRequests).toHaveBeenCalledWith('band-1')
  })

  it('Approve calls resolveJoinRequest with "approved" and refreshes the list', async () => {
    mockBandValue = { currentBand: adminBand }
    listJoinRequests
      .mockResolvedValueOnce({ data: [{ id: 'jr-1', user: { email: 'alice@example.com' } }] })
      .mockResolvedValueOnce({ data: [] })
    resolveJoinRequest.mockResolvedValueOnce({ data: { id: 'jr-1', status: 'approved' } })

    const user = userEvent.setup()
    renderWithRouter(<JoinRequestQueuePage />)

    await user.click(await screen.findByRole('button', { name: /approve/i }))

    await waitFor(() => {
      expect(resolveJoinRequest).toHaveBeenCalledWith('band-1', 'jr-1', 'approved')
    })
    // List refreshes after the action.
    await waitFor(() => {
      expect(listJoinRequests).toHaveBeenCalledTimes(2)
    })
    expect(await screen.findByText(/no pending join requests/i)).toBeInTheDocument()
  })

  it('Deny calls resolveJoinRequest with "denied" and refreshes the list', async () => {
    mockBandValue = { currentBand: adminBand }
    listJoinRequests
      .mockResolvedValueOnce({ data: [{ id: 'jr-2', user: { email: 'bob@example.com' } }] })
      .mockResolvedValueOnce({ data: [] })
    resolveJoinRequest.mockResolvedValueOnce({ data: { id: 'jr-2', status: 'denied' } })

    const user = userEvent.setup()
    renderWithRouter(<JoinRequestQueuePage />)

    await user.click(await screen.findByRole('button', { name: /deny/i }))

    await waitFor(() => {
      expect(resolveJoinRequest).toHaveBeenCalledWith('band-1', 'jr-2', 'denied')
    })
    await waitFor(() => {
      expect(listJoinRequests).toHaveBeenCalledTimes(2)
    })
  })
})

// Req 17.2: the admin genre editor loads the current band's genres and can
// create and delete them.
describe('BandGenreEditorPage actions when administered (Req 17.2)', () => {
  it('loads the current band genres on mount', async () => {
    mockBandValue = { currentBand: adminBand }
    listGenres.mockResolvedValueOnce({
      data: [
        { id: 'g1', name: 'Rock' },
        { id: 'g2', name: 'Jazz' },
      ],
    })

    renderWithRouter(<BandGenreEditorPage />)

    expect(await screen.findByText('Rock')).toBeInTheDocument()
    expect(screen.getByText('Jazz')).toBeInTheDocument()
    expect(listGenres).toHaveBeenCalledTimes(1)
  })

  it('creating a genre calls createGenre and refreshes the list', async () => {
    mockBandValue = { currentBand: adminBand }
    listGenres
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [{ id: 'g3', name: 'Blues' }] })
    createGenre.mockResolvedValueOnce({ data: { id: 'g3', name: 'Blues' } })

    const user = userEvent.setup()
    renderWithRouter(<BandGenreEditorPage />)

    // Wait for the initial (empty) load to settle.
    expect(await screen.findByText(/no genres yet/i)).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText(/new genre name/i), 'Blues')
    await user.click(screen.getByRole('button', { name: /add genre/i }))

    await waitFor(() => {
      expect(createGenre).toHaveBeenCalledWith('Blues')
    })
    await waitFor(() => {
      expect(listGenres).toHaveBeenCalledTimes(2)
    })
    expect(await screen.findByText('Blues')).toBeInTheDocument()
  })

  it('deleting a genre calls deleteGenre after confirmation', async () => {
    mockBandValue = { currentBand: adminBand }
    listGenres
      .mockResolvedValueOnce({ data: [{ id: 'g1', name: 'Rock' }] })
      .mockResolvedValueOnce({ data: [] })
    deleteGenre.mockResolvedValueOnce({ data: {} })

    const user = userEvent.setup()
    renderWithRouter(<BandGenreEditorPage />)

    expect(await screen.findByText('Rock')).toBeInTheDocument()

    // Click the row's Delete button to open the confirm dialog.
    await user.click(screen.getByRole('button', { name: /^delete$/i }))

    // Confirm inside the dialog (its confirm button is also labeled Delete).
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /^delete$/i }))

    await waitFor(() => {
      expect(deleteGenre).toHaveBeenCalledWith('g1')
    })
    await waitFor(() => {
      expect(listGenres).toHaveBeenCalledTimes(2)
    })
  })
})
