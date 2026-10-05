import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../api/gigs', () => ({ getGig: vi.fn() }))
vi.mock('../../auth/BandContext', () => ({
  useBand: () => ({ currentBand: { id: 'b1', name: 'Band' }, hasNoBand: false }),
}))
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig()
  return { ...actual, useParams: () => ({ id: 'gig-1' }) }
})

import GigDetailPage from './GigDetailPage'
import { getGig } from '../../api/gigs'

const renderPage = () => render(<MemoryRouter><GigDetailPage /></MemoryRouter>)

beforeEach(() => vi.clearAllMocks())

describe('GigDetailPage — setlist songs', () => {
  it('renders song titles/artists from { song, playedKey } entries', async () => {
    getGig.mockResolvedValue({
      data: {
        _id: 'gig-1',
        name: 'Elder Care',
        date: '2026-05-06',
        playlist: {
          _id: 'pl1',
          name: 'Nursing Home Gigs',
          songs: [
            { song: { _id: 's1', title: 'Bye Bye Love', artist: 'Everly Brothers' }, playedKey: 'A' },
            { song: { _id: 's2', title: 'Sweet Caroline', artist: 'Neil Diamond' }, playedKey: 'G' },
            { song: { _id: 's3', title: 'Keyless Tune', artist: 'Nobody' }, playedKey: '' },
          ],
        },
      },
    })

    renderPage()

    expect(await screen.findByText('Bye Bye Love')).toBeInTheDocument()
    expect(screen.getByText('Sweet Caroline')).toBeInTheDocument()
    expect(screen.getByText('— Everly Brothers')).toBeInTheDocument()
    // No blank-title placeholders when songs are populated.
    expect(screen.queryByText('—', { exact: true })).not.toBeInTheDocument()

    // Played keys show in brackets next to songs that have one...
    expect(screen.getByText('[A]')).toBeInTheDocument()
    expect(screen.getByText('[G]')).toBeInTheDocument()
    // ...and keyless songs show no bracket badge.
    expect(screen.getByText('Keyless Tune')).toBeInTheDocument()
    expect(screen.queryByText('[]')).not.toBeInTheDocument()
  })

  it('shows "No setlist assigned" when the gig has no playlist', async () => {
    getGig.mockResolvedValue({
      data: { _id: 'gig-1', name: 'Open Mic', date: '2026-01-01', playlist: null },
    })
    renderPage()
    expect(await screen.findByText(/no setlist assigned/i)).toBeInTheDocument()
  })

  it('shows "No songs in this setlist" when the setlist is empty', async () => {
    getGig.mockResolvedValue({
      data: { _id: 'gig-1', name: 'Soundcheck', date: '2026-01-01', playlist: { _id: 'pl1', name: 'Empty', songs: [] } },
    })
    renderPage()
    expect(await screen.findByText(/no songs in this setlist/i)).toBeInTheDocument()
  })
})

describe('GigDetailPage — Generate Charts button (#85)', () => {
  it('is ENABLED and links to /gigs/:id/charts when the gig has a setlist with songs', async () => {
    getGig.mockResolvedValue({
      data: {
        _id: 'gig-1',
        name: 'Elder Care',
        playlist: {
          _id: 'pl1',
          name: 'Nursing Home Gigs',
          songs: [{ song: { _id: 's1', title: 'Bye Bye Love', artist: 'Everly Brothers' }, playedKey: 'A' }],
        },
      },
    })

    renderPage()

    const link = await screen.findByRole('link', { name: /generate charts/i })
    expect(link).toHaveAttribute('href', '/gigs/gig-1/charts')
  })

  it('is DISABLED (not a link) with a hint when the gig has no setlist', async () => {
    getGig.mockResolvedValue({
      data: { _id: 'gig-1', name: 'Open Mic', playlist: null },
    })

    renderPage()

    // Rendered as a disabled button, not a navigable link.
    const btn = await screen.findByRole('button', { name: /generate charts/i })
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('title', 'Assign a setlist first')
    expect(screen.queryByRole('link', { name: /generate charts/i })).not.toBeInTheDocument()
  })

  it('is DISABLED when the gig has a setlist but no songs', async () => {
    getGig.mockResolvedValue({
      data: { _id: 'gig-1', name: 'Soundcheck', playlist: { _id: 'pl1', name: 'Empty', songs: [] } },
    })

    renderPage()

    const btn = await screen.findByRole('button', { name: /generate charts/i })
    expect(btn).toBeDisabled()
  })
})
