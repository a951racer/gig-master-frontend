import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

// Mock the bands API layer so no network happens (Req 16.1-16.5).
vi.mock('../../api/bands', () => ({
  createBand: vi.fn(),
  requestToJoin: vi.fn(),
  listMyJoinRequests: vi.fn(),
}))

// Mock the membership refresh hook. useRefreshMembership() returns the async
// go-to-band function; a single stable mock lets us assert calls across renders.
const refreshMembershipAndGo = vi.fn()
vi.mock('./refreshMembership', () => ({
  useRefreshMembership: () => refreshMembershipAndGo,
}))

// JoinRequestsPage imports setCurrentBandId from axiosInstance; stub it so no
// real axios/token machinery runs.
vi.mock('../../api/axiosInstance', () => ({
  default: {},
  setCurrentBandId: vi.fn(),
  setAccessToken: vi.fn(),
}))

// BandContext is consumed by JoinRequestsPage via useBand().
const setCurrentBandMock = vi.fn()
let mockBands = []
vi.mock('../../auth/BandContext', () => ({
  useBand: () => ({ bands: mockBands, setCurrentBand: setCurrentBandMock }),
}))

import CreateBandPage from './CreateBandPage'
import JoinBandPage from './JoinBandPage'
import JoinRequestsPage from './JoinRequestsPage'
import { createBand, requestToJoin, listMyJoinRequests } from '../../api/bands'

const renderWithRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)

// The membership refresh hook has a window.location.assign fallback (only hit
// if the in-place refresh throws); jsdom doesn't implement navigation, so stub
// location to keep any fallback path quiet.
const originalLocation = window.location
beforeAll(() => {
  delete window.location
  window.location = { ...originalLocation, assign: vi.fn() }
})
afterAll(() => {
  window.location = originalLocation
})

beforeEach(() => {
  vi.clearAllMocks()
  refreshMembershipAndGo.mockReset()
  mockBands = []
})

// Req 16.1: create-band flow makes the new band selectable.
describe('CreateBandPage (Req 16.1)', () => {
  it('submitting a name calls createBand and, on success, refreshMembershipAndGo', async () => {
    const user = userEvent.setup()
    createBand.mockResolvedValueOnce({ data: { id: 'band-1', name: 'The Night Owls' } })

    renderWithRouter(<CreateBandPage />)

    await user.type(screen.getByLabelText(/band name/i), 'The Night Owls')
    await user.click(screen.getByRole('button', { name: /create band/i }))

    await waitFor(() => {
      expect(createBand).toHaveBeenCalledWith({ name: 'The Night Owls' })
    })
    await waitFor(() => {
      expect(refreshMembershipAndGo).toHaveBeenCalledWith('/songs', {
        selectBandId: 'band-1',
      })
    })
  })

  it('an empty name shows a validation error and does not call createBand', async () => {
    const user = userEvent.setup()
    renderWithRouter(<CreateBandPage />)

    await user.click(screen.getByRole('button', { name: /create band/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/band name is required/i)
    expect(createBand).not.toHaveBeenCalled()
    expect(refreshMembershipAndGo).not.toHaveBeenCalled()
  })
})

// Req 16.2, 16.3: join-band flow submits and confirms pending; maps 409/404.
describe('JoinBandPage (Req 16.2, 16.3)', () => {
  it('submitting a band id calls requestToJoin and shows the pending confirmation', async () => {
    const user = userEvent.setup()
    requestToJoin.mockResolvedValueOnce({ data: { id: 'jr-1', status: 'pending' } })

    renderWithRouter(<JoinBandPage />)

    await user.type(screen.getByLabelText(/band id/i), 'band-42')
    await user.click(screen.getByRole('button', { name: /request to join/i }))

    await waitFor(() => {
      expect(requestToJoin).toHaveBeenCalledWith('band-42')
    })
    expect(await screen.findByText(/request pending/i)).toBeInTheDocument()
    expect(screen.getByText(/pending approval/i)).toBeInTheDocument()
  })

  it('a 409 rejection shows the "already pending" message', async () => {
    const user = userEvent.setup()
    requestToJoin.mockRejectedValueOnce({ response: { status: 409 } })

    renderWithRouter(<JoinBandPage />)

    await user.type(screen.getByLabelText(/band id/i), 'band-42')
    await user.click(screen.getByRole('button', { name: /request to join/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/already have a pending request/i)
  })

  it('a 404 rejection shows the "no band found" message', async () => {
    const user = userEvent.setup()
    requestToJoin.mockRejectedValueOnce({ response: { status: 404 } })

    renderWithRouter(<JoinBandPage />)

    await user.type(screen.getByLabelText(/band id/i), 'missing-band')
    await user.click(screen.getByRole('button', { name: /request to join/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/no band found/i)
  })

  it('an empty band id shows a validation error and does not call requestToJoin', async () => {
    const user = userEvent.setup()
    renderWithRouter(<JoinBandPage />)

    await user.click(screen.getByRole('button', { name: /request to join/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/band id is required/i)
    expect(requestToJoin).not.toHaveBeenCalled()
  })
})

// Req 16.4, 16.5: own join-request statuses render with badges; approved
// rows expose a "Switch to band" control.
describe('JoinRequestsPage (Req 16.4, 16.5)', () => {
  it('renders pending/approved/denied statuses and a Switch to band control on approved rows', async () => {
    listMyJoinRequests.mockResolvedValueOnce({
      data: [
        { band: { id: 'b1', name: 'Pending Band' }, status: 'pending' },
        { band: { id: 'b2', name: 'Approved Band' }, status: 'approved' },
        { band: { id: 'b3', name: 'Denied Band' }, status: 'denied' },
      ],
    })

    renderWithRouter(<JoinRequestsPage />)

    // Band names render once loaded.
    expect(await screen.findByText('Pending Band')).toBeInTheDocument()
    expect(screen.getByText('Approved Band')).toBeInTheDocument()
    expect(screen.getByText('Denied Band')).toBeInTheDocument()

    // Status badges render for each status.
    expect(screen.getByText('pending')).toBeInTheDocument()
    expect(screen.getByText('approved')).toBeInTheDocument()
    expect(screen.getByText('denied')).toBeInTheDocument()

    // Only the approved row has a "Switch to band" control.
    const switchButtons = screen.getAllByRole('button', { name: /switch to band/i })
    expect(switchButtons).toHaveLength(1)
  })

  it('shows an empty-state message when there are no join requests', async () => {
    listMyJoinRequests.mockResolvedValueOnce({ data: [] })

    renderWithRouter(<JoinRequestsPage />)

    expect(await screen.findByText(/no join requests yet/i)).toBeInTheDocument()
  })

  it('switching to an approved band already in the token selects it directly', async () => {
    mockBands = [{ id: 'b2', name: 'Approved Band', isAdmin: false }]
    listMyJoinRequests.mockResolvedValueOnce({
      data: [{ band: { id: 'b2', name: 'Approved Band' }, status: 'approved' }],
    })

    const user = userEvent.setup()
    renderWithRouter(<JoinRequestsPage />)

    const switchBtn = await screen.findByRole('button', { name: /switch to band/i })
    await user.click(switchBtn)

    expect(setCurrentBandMock).toHaveBeenCalledWith('b2')
    // Band is already in the token claim, so no session refresh is triggered.
    expect(refreshMembershipAndGo).not.toHaveBeenCalled()
  })

  it('switching to an approved band not yet in the token refreshes the session', async () => {
    mockBands = [] // approved band not in token yet
    listMyJoinRequests.mockResolvedValueOnce({
      data: [{ band: { id: 'b9', name: 'New Band' }, status: 'approved' }],
    })

    const user = userEvent.setup()
    renderWithRouter(<JoinRequestsPage />)

    const switchBtn = await screen.findByRole('button', { name: /switch to band/i })
    await user.click(switchBtn)

    expect(refreshMembershipAndGo).toHaveBeenCalledWith('/songs', { selectBandId: 'b9' })
    expect(setCurrentBandMock).not.toHaveBeenCalled()
  })
})
