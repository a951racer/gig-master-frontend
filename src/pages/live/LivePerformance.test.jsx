import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

// --- Mocks ------------------------------------------------------------------
//
// Keep the real router, overriding useParams (→ gig-1), useNavigate (spy), and
// useLocation (so we can hand LivePerformance its forwarded `{ charts }` state
// directly, matching the live-screen test style). The real useSwipe and
// useChartNavigation are exercised unchanged — only the geometry/nav behavior
// is under test here.
const navigate = vi.fn()
let locationState = null
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig()
  return {
    ...actual,
    useParams: () => ({ id: 'gig-1' }),
    useNavigate: () => navigate,
    useLocation: () => ({ pathname: '/live/gigs/gig-1/play', state: locationState }),
  }
})

// Wake lock is a no-op in tests so it never reaches navigator. Mock both the
// named and default exports (LivePerformance imports the default).
vi.mock('../../hooks/useWakeLock', () => {
  const useWakeLock = () => ({ supported: false, active: false })
  return { default: useWakeLock, useWakeLock }
})

import LivePerformance from './LivePerformance'

// --- Fixtures ---------------------------------------------------------------

// A one-page chart for a song (mirrors GigChartsPage.test.jsx's `oneP`).
const oneP = (title) => ({
  title,
  artist: 'Someone',
  keyLabel: 'A',
  playedKey: 'A',
  mode: 'Numbers',
  formatting: { font: 'monospace', size: 11, chordColor: 'blue', columns: 1 },
  sections: [],
  pages: [{ columns: [{ lines: [{ header: { label: `${title} VERSE`, repeat: null } }] }] }],
})

// s1 → one real page, s2 → one placeholder page ⇒ "Page 1 of 2".
const charts = [
  { songId: 's1', title: 'Bye Bye Love', playedKey: 'A', chart: oneP('Bye Bye Love') },
  { songId: 's2', title: 'Sweet Caroline', playedKey: 'G', chart: null },
]

// --- Harness ----------------------------------------------------------------

const renderPerf = () =>
  render(
    <MemoryRouter initialEntries={[{ pathname: '/live/gigs/gig-1/play' }]}>
      <LivePerformance />
    </MemoryRouter>,
  )

// The chart surface carrying the swipe ref: the `.flex-1.min-h-0` div.
const getSurface = (container) => {
  const el = container.querySelector('.flex-1.min-h-0')
  if (!el) throw new Error('chart surface (.flex-1.min-h-0) not found')
  return el
}

// Dispatch pointerdown at (fromX,fromY) then pointerup at (toX,toY) on `el`.
//
// jsdom has no PointerEvent, so we synthesise with MouseEvent (it carries
// clientX/clientY — the only geometry the hook reads). LivePerformance does NOT
// pass allowMouse, so the hook ignores `pointerType === 'mouse'`; a MouseEvent
// has pointerType === undefined and so is NOT filtered. To be robust against a
// jsdom build that sets pointerType, we force it to 'touch' before dispatch so
// the gesture is always honored.
function swipe(el, fromX, fromY, toX, toY) {
  act(() => {
    const down = new MouseEvent('pointerdown', { clientX: fromX, clientY: fromY, bubbles: true })
    Object.defineProperty(down, 'pointerType', { value: 'touch' })
    el.dispatchEvent(down)

    const up = new MouseEvent('pointerup', { clientX: toX, clientY: toY, bubbles: true })
    Object.defineProperty(up, 'pointerType', { value: 'touch' })
    el.dispatchEvent(up)
  })
}

beforeEach(() => {
  locationState = { charts, truncated: false }
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('LivePerformance — swipe gestures (Req 3)', () => {
  it('swipe LEFT advances to the next page (Req 3.1)', () => {
    const { container } = renderPerf()
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()

    const surface = getSurface(container)
    // 200,100 -> 100,100 : dx = -100 (horizontal, left) → next page.
    swipe(surface, 200, 100, 100, 100)

    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument()
  })

  it('swipe RIGHT returns to the previous page (Req 3.2)', () => {
    const { container } = renderPerf()
    const surface = getSurface(container)

    // Advance to page 2 first, then swipe right back to page 1.
    swipe(surface, 200, 100, 100, 100)
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument()

    // 100,100 -> 220,100 : dx = +120 (horizontal, right) → previous page.
    swipe(surface, 100, 100, 220, 100)
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()
  })

  it('swipe UP exits to the gig setup (Req 3.3)', () => {
    const { container } = renderPerf()
    const surface = getSurface(container)

    // 100,200 -> 100,120 : dy = -80 (vertical, up) → exit.
    swipe(surface, 100, 200, 100, 120)

    expect(navigate).toHaveBeenCalledWith('/live/gigs/gig-1')
  })

  it('keeps on-screen Next button and ArrowRight key working alongside gestures (Req 3.7)', async () => {
    const user = userEvent.setup()
    renderPerf()
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()

    // On-screen Next button still advances the page.
    await user.click(screen.getByRole('button', { name: /next page/i }))
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument()

    // Previous button reverses so we can re-check the keyboard path from page 1.
    await user.click(screen.getByRole('button', { name: /previous page/i }))
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()

    // ArrowRight key (HID pedal / keyboard) still advances, unchanged.
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    })
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument()
  })
})
