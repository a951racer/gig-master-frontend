import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useRef } from 'react'
import { render, act, cleanup } from '@testing-library/react'
import fc from 'fast-check'

import { useSwipe } from './useSwipe'

// --- Test probe -------------------------------------------------------------
//
// A minimal component that wires `useSwipe` to a plain <div>. We attach the
// hook to this surface and then dispatch synthetic pointer events on it.
//
// NOTE on event construction: jsdom does not implement `PointerEvent`, so we
// synthesise the `pointerdown`/`pointerup` events with `MouseEvent`, which
// DOES carry `clientX`/`clientY` (the only fields the hook reads for geometry).
// A `MouseEvent` has no `pointerType`, so `useSwipe`'s mouse filter
// (`e.pointerType === 'mouse'`) would otherwise be ambiguous. To keep the
// tests deterministic and focused on the geometry rule, every probe passes
// `allowMouse: true`, which bypasses the pointerType filter entirely — the
// filtering of mouse events is orthogonal to the dominant-axis/threshold logic
// under test here.
function Probe(props) {
  const ref = useRef(null)
  useSwipe(ref, { allowMouse: true, ...props })
  return <div data-testid="surface" ref={ref} />
}

// Dispatch a pointerdown at (fromX,fromY) then a pointerup at (toX,toY) on the
// element, wrapped in act() so React effects/state settle. Both events bubble
// and carry clientX/clientY, which is all the hook inspects.
function swipe(el, fromX, fromY, toX, toY) {
  act(() => {
    el.dispatchEvent(
      new MouseEvent('pointerdown', { clientX: fromX, clientY: fromY, bubbles: true }),
    )
    el.dispatchEvent(
      new MouseEvent('pointerup', { clientX: toX, clientY: toY, bubbles: true }),
    )
  })
}

// Fresh spies per render so a test can assert "exactly one fired".
function makeHandlers() {
  return {
    onSwipeLeft: vi.fn(),
    onSwipeRight: vi.fn(),
    onSwipeUp: vi.fn(),
    onSwipeDown: vi.fn(),
  }
}

function renderProbe(handlers, extra = {}) {
  const { getByTestId, unmount } = render(<Probe {...handlers} {...extra} />)
  return { surface: getByTestId('surface'), unmount }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// --- Example-based cases ----------------------------------------------------
// Defaults: threshold = 50, restraint = 40.

describe('useSwipe — directional example cases (Req 3.1, 3.2, 3.3)', () => {
  it('fires onSwipeLeft for a right-to-left horizontal swipe', () => {
    const h = makeHandlers()
    const { surface } = renderProbe(h)

    // 200,100 -> 100,100 : dx = -100, dy = 0 (horizontal, left).
    swipe(surface, 200, 100, 100, 100)

    expect(h.onSwipeLeft).toHaveBeenCalledTimes(1)
    expect(h.onSwipeRight).not.toHaveBeenCalled()
    expect(h.onSwipeUp).not.toHaveBeenCalled()
    expect(h.onSwipeDown).not.toHaveBeenCalled()
  })

  it('fires onSwipeRight for a left-to-right horizontal swipe', () => {
    const h = makeHandlers()
    const { surface } = renderProbe(h)

    // 100,100 -> 220,100 : dx = +120, dy = 0 (horizontal, right).
    swipe(surface, 100, 100, 220, 100)

    expect(h.onSwipeRight).toHaveBeenCalledTimes(1)
    expect(h.onSwipeLeft).not.toHaveBeenCalled()
    expect(h.onSwipeUp).not.toHaveBeenCalled()
    expect(h.onSwipeDown).not.toHaveBeenCalled()
  })

  it('fires onSwipeUp for a bottom-to-top vertical swipe', () => {
    const h = makeHandlers()
    const { surface } = renderProbe(h)

    // 100,200 -> 100,120 : dy = -80, dx = 0 (vertical, up).
    swipe(surface, 100, 200, 100, 120)

    expect(h.onSwipeUp).toHaveBeenCalledTimes(1)
    expect(h.onSwipeDown).not.toHaveBeenCalled()
    expect(h.onSwipeLeft).not.toHaveBeenCalled()
    expect(h.onSwipeRight).not.toHaveBeenCalled()
  })

  it('fires onSwipeDown for a top-to-bottom vertical swipe', () => {
    const h = makeHandlers()
    const { surface } = renderProbe(h)

    // 100,100 -> 100,180 : dy = +80, dx = 0 (vertical, down).
    swipe(surface, 100, 100, 100, 180)

    expect(h.onSwipeDown).toHaveBeenCalledTimes(1)
    expect(h.onSwipeUp).not.toHaveBeenCalled()
    expect(h.onSwipeLeft).not.toHaveBeenCalled()
    expect(h.onSwipeRight).not.toHaveBeenCalled()
  })
})

describe('useSwipe — sub-threshold / ambiguous gestures do nothing (Req 3.6, 3.8)', () => {
  it('fires nothing when the dominant-axis distance is below threshold (a tap)', () => {
    const h = makeHandlers()
    const { surface } = renderProbe(h)

    // 100,100 -> 130,100 : dx = 30 (< 50 threshold) -> treated as a tap.
    swipe(surface, 100, 100, 130, 100)

    expect(h.onSwipeLeft).not.toHaveBeenCalled()
    expect(h.onSwipeRight).not.toHaveBeenCalled()
    expect(h.onSwipeUp).not.toHaveBeenCalled()
    expect(h.onSwipeDown).not.toHaveBeenCalled()
  })

  it('fires nothing when off-axis drift exceeds restraint (diagonal drag)', () => {
    const h = makeHandlers()
    const { surface } = renderProbe(h)

    // 100,100 -> 170,160 : dx = 70 (dominant), dy = 60 (> 40 restraint).
    swipe(surface, 100, 100, 170, 160)

    expect(h.onSwipeLeft).not.toHaveBeenCalled()
    expect(h.onSwipeRight).not.toHaveBeenCalled()
    expect(h.onSwipeUp).not.toHaveBeenCalled()
    expect(h.onSwipeDown).not.toHaveBeenCalled()
  })

  it('ignores a pointerup with no prior pointerdown (no throw, nothing fires)', () => {
    const h = makeHandlers()
    const { surface } = renderProbe(h)

    expect(() => {
      act(() => {
        surface.dispatchEvent(
          new MouseEvent('pointerup', { clientX: 10, clientY: 10, bubbles: true }),
        )
      })
    }).not.toThrow()

    expect(h.onSwipeLeft).not.toHaveBeenCalled()
    expect(h.onSwipeRight).not.toHaveBeenCalled()
    expect(h.onSwipeUp).not.toHaveBeenCalled()
    expect(h.onSwipeDown).not.toHaveBeenCalled()
  })
})

// --- Property-based cases ---------------------------------------------------
//
// Mirrors the hook's dominant-axis + threshold + restraint rule in the test,
// then asserts the dispatched swipe fires exactly the expected callback (or
// none). The reference oracle below is derived from the design, independent of
// the hook's internal structure.

const THRESHOLD = 50
const RESTRAINT = 40

// Returns the name of the single callback that SHOULD fire, or null for none.
function expectedDirection(dx, dy) {
  const absX = Math.abs(dx)
  const absY = Math.abs(dy)
  if (absX >= absY) {
    // Horizontal intent.
    if (absX >= THRESHOLD && absY <= RESTRAINT) {
      if (dx < 0) return 'onSwipeLeft'
      if (dx > 0) return 'onSwipeRight'
    }
  } else {
    // Vertical intent.
    if (absY >= THRESHOLD && absX <= RESTRAINT) {
      if (dy < 0) return 'onSwipeUp'
      if (dy > 0) return 'onSwipeDown'
    }
  }
  return null
}

describe('useSwipe — property: dispatched swipe matches the geometry rule (Design Properties 1 & 2)', () => {
  // Validates: Requirements 3.1, 3.2, 3.3, 3.5
  // Validates: Requirements 3.6, 3.8
  it('fires exactly the callback implied by dominant-axis + threshold + restraint, else none', () => {
    const coord = fc.integer({ min: 0, max: 400 })

    fc.assert(
      fc.property(coord, coord, coord, coord, (x0, y0, x1, y1) => {
        const h = makeHandlers()
        const { surface, unmount } = renderProbe(h)

        try {
          swipe(surface, x0, y0, x1, y1)

          const dx = x1 - x0
          const dy = y1 - y0
          const expected = expectedDirection(dx, dy)

          const names = ['onSwipeLeft', 'onSwipeRight', 'onSwipeUp', 'onSwipeDown']
          for (const name of names) {
            if (name === expected) {
              expect(h[name]).toHaveBeenCalledTimes(1)
            } else {
              expect(h[name]).not.toHaveBeenCalled()
            }
          }
        } finally {
          // Fresh DOM + listeners per run so spies never leak between cases.
          unmount()
        }
      }),
      { numRuns: 100 },
    )
  })
})
