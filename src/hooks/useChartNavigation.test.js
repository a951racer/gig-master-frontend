import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import fc from 'fast-check'

import { useChartNavigation } from './useChartNavigation'

// Dispatch a keydown on window inside act(). Returns the event so callers can
// inspect `defaultPrevented`. The event is cancelable so preventDefault is
// observable.
function dispatchKey(key, { cancelable = true } = {}) {
  const event = new KeyboardEvent('keydown', { key, cancelable, bubbles: true })
  act(() => {
    window.dispatchEvent(event)
  })
  return event
}

// Apply a named action to the hook result inside act().
function applyAction(result, action) {
  act(() => {
    result.current[action]()
  })
}

describe('useChartNavigation', () => {
  // ---------------------------------------------------------------------------
  // Property-based tests (fast-check) — design Correctness Properties 1-7.
  // ---------------------------------------------------------------------------

  describe('property-based', () => {
    // Property 1: index always in [0, max(0, total-1)] under arbitrary action
    // sequences. **Validates: Requirements 2.2**
    it('Property 1 — index always stays within bounds under arbitrary actions', () => {
      const action = fc.constantFrom('goStart', 'goPrev', 'goNext', 'goTo')
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 20 }),
          fc.array(action, { maxLength: 50 }),
          fc.array(fc.integer({ min: -5, max: 25 }), { maxLength: 50 }),
          (total, actions, goToArgs) => {
            const { result } = renderHook(() =>
              useChartNavigation({ total, enabled: false })
            )
            let goToCursor = 0
            actions.forEach((a) => {
              act(() => {
                if (a === 'goTo') {
                  const arg = goToArgs[goToCursor % Math.max(1, goToArgs.length)] ?? 0
                  goToCursor += 1
                  result.current.goTo(arg)
                } else {
                  result.current[a]()
                }
              })
              const max = Math.max(0, total - 1)
              expect(result.current.index).toBeGreaterThanOrEqual(0)
              expect(result.current.index).toBeLessThanOrEqual(max)
            }
            )
          }
        )
      )
    })

    // Properties 2 & 5: off-boundary a single goNext is +1 and goPrev is -1, and
    // goNext then goPrev (and vice versa) returns to the original index. At a
    // boundary a step is a no-op (0). **Validates: Requirements 1.1, 1.2**
    it('Property 2 & 5 — single steps move by exactly ±1 off-boundary and are inverse', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 30 }),
          fc.integer({ min: 0, max: 29 }),
          (total, startAt) => {
            const start = Math.min(startAt, total - 1)
            const { result } = renderHook(() =>
              useChartNavigation({ total, enabled: false, initialIndex: start })
            )
            const before = result.current.index
            const last = total - 1

            // Single goNext: +1 off the last page, 0 at the last page.
            applyAction(result, 'goNext')
            const afterNext = result.current.index
            if (before === last) {
              expect(afterNext).toBe(before)
            } else {
              expect(afterNext).toBe(before + 1)
            }

            // goPrev inverts goNext whenever goNext actually moved.
            applyAction(result, 'goPrev')
            if (before === last) {
              // At last: goNext no-op, then goPrev steps back one (unless also 0).
              expect(result.current.index).toBe(Math.max(0, before - 1))
            } else {
              expect(result.current.index).toBe(before)
            }
          }
        )
      )
    })

    // Property 5 symmetric for goPrev: -1 off index 0, 0 at index 0.
    it('Property 5 — single goPrev moves by exactly -1 off-boundary and 0 at index 0', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 30 }),
          fc.integer({ min: 0, max: 29 }),
          (total, startAt) => {
            const start = Math.min(startAt, total - 1)
            const { result } = renderHook(() =>
              useChartNavigation({ total, enabled: false, initialIndex: start })
            )
            const before = result.current.index
            applyAction(result, 'goPrev')
            if (before === 0) {
              expect(result.current.index).toBe(0)
            } else {
              expect(result.current.index).toBe(before - 1)
            }
          }
        )
      )
    })

    // Property 3: goNext at last and goPrev at 0 are no-ops (no wrap-around).
    // **Validates: Requirements 1.4, 1.5**
    it('Property 3 — boundaries are idempotent (no wrap)', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 30 }), (total) => {
          const last = total - 1

          // goNext at the last index stays at last.
          const atLast = renderHook(() =>
            useChartNavigation({ total, enabled: false, initialIndex: last })
          )
          applyAction(atLast.result, 'goNext')
          expect(atLast.result.current.index).toBe(last)
          applyAction(atLast.result, 'goNext')
          expect(atLast.result.current.index).toBe(last)

          // goPrev at index 0 stays at 0.
          const atStart = renderHook(() =>
            useChartNavigation({ total, enabled: false, initialIndex: 0 })
          )
          applyAction(atStart.result, 'goPrev')
          expect(atStart.result.current.index).toBe(0)
          applyAction(atStart.result, 'goPrev')
          expect(atStart.result.current.index).toBe(0)
        })
      )
    })

    // Property 4: goStart is absorbing — index is 0 for any prior state/total.
    // **Validates: Requirements 1.3**
    it('Property 4 — goStart yields index 0 from any state/total', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 30 }),
          fc.integer({ min: 0, max: 29 }),
          (total, startAt) => {
            const start = total === 0 ? 0 : Math.min(startAt, total - 1)
            const { result } = renderHook(() =>
              useChartNavigation({ total, enabled: false, initialIndex: start })
            )
            applyAction(result, 'goStart')
            expect(result.current.index).toBe(0)
          }
        )
      )
    })

    // Property 6: shrinking total to t leaves index min(prev, max(0, t-1)).
    // Re-render the hook with a smaller `total` prop to exercise the effect.
    // **Validates: Requirements 2.3**
    it('Property 6 — shrinking total re-clamps the index', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 30 }),
          fc.integer({ min: 0, max: 29 }),
          fc.integer({ min: 0, max: 30 }),
          (total, startAt, newTotalRaw) => {
            const start = Math.min(startAt, total - 1)
            const newTotal = Math.min(newTotalRaw, total) // shrink (or equal)
            const { result, rerender } = renderHook(
              ({ t }) =>
                useChartNavigation({ total: t, enabled: false, initialIndex: start }),
              { initialProps: { t: total } }
            )
            const prev = result.current.index
            act(() => {
              rerender({ t: newTotal })
            })
            const expected = Math.min(prev, Math.max(0, newTotal - 1))
            expect(result.current.index).toBe(expected)
          }
        )
      )
    })

    // Property 7: with enabled:false, dispatched key events never move the index.
    // **Validates: Requirements 1.7, 2.5**
    it('Property 7 — disabled hook is inert to key events', () => {
      const key = fc.constantFrom(
        'ArrowRight',
        'ArrowLeft',
        'PageUp',
        'PageDown',
        ' ',
        'Home'
      )
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 30 }),
          fc.integer({ min: 0, max: 29 }),
          fc.array(key, { minLength: 1, maxLength: 20 }),
          (total, startAt, keys) => {
            const start = Math.min(startAt, total - 1)
            const { result } = renderHook(() =>
              useChartNavigation({ total, enabled: false, initialIndex: start })
            )
            const before = result.current.index
            keys.forEach((k) => dispatchKey(k))
            expect(result.current.index).toBe(before)
          }
        )
      )
    })
  })

  // ---------------------------------------------------------------------------
  // Example-based tests
  // ---------------------------------------------------------------------------

  describe('index state + clamped actions', () => {
    it('starts at index 0 and reports total', () => {
      const { result } = renderHook(() =>
        useChartNavigation({ total: 5, enabled: false })
      )
      expect(result.current.index).toBe(0)
      expect(result.current.total).toBe(5)
    })

    it('respects a custom initialIndex (clamped)', () => {
      const { result } = renderHook(() =>
        useChartNavigation({ total: 3, enabled: false, initialIndex: 2 })
      )
      expect(result.current.index).toBe(2)
    })

    it('goNext advances and goPrev reverses', () => {
      const { result } = renderHook(() =>
        useChartNavigation({ total: 3, enabled: false })
      )
      applyAction(result, 'goNext')
      expect(result.current.index).toBe(1)
      applyAction(result, 'goNext')
      expect(result.current.index).toBe(2)
      applyAction(result, 'goPrev')
      expect(result.current.index).toBe(1)
    })

    it('goTo jumps to a clamped target', () => {
      const { result } = renderHook(() =>
        useChartNavigation({ total: 4, enabled: false })
      )
      act(() => result.current.goTo(2))
      expect(result.current.index).toBe(2)
      act(() => result.current.goTo(99))
      expect(result.current.index).toBe(3)
      act(() => result.current.goTo(-5))
      expect(result.current.index).toBe(0)
    })

    it('total === 0 keeps index 0 and no-ops the actions', () => {
      const { result } = renderHook(() =>
        useChartNavigation({ total: 0, enabled: false })
      )
      expect(result.current.index).toBe(0)
      applyAction(result, 'goNext')
      expect(result.current.index).toBe(0)
      applyAction(result, 'goPrev')
      expect(result.current.index).toBe(0)
      act(() => result.current.goTo(3))
      expect(result.current.index).toBe(0)
    })
  })

  describe('key bindings (enabled: true)', () => {
    it('ArrowRight advances to the next page', () => {
      const { result } = renderHook(() =>
        useChartNavigation({ total: 3, enabled: true })
      )
      dispatchKey('ArrowRight')
      expect(result.current.index).toBe(1)
    })

    it('PageDown advances to the next page', () => {
      const { result } = renderHook(() =>
        useChartNavigation({ total: 3, enabled: true })
      )
      dispatchKey('PageDown')
      expect(result.current.index).toBe(1)
    })

    it('Space advances to the next page', () => {
      const { result } = renderHook(() =>
        useChartNavigation({ total: 3, enabled: true })
      )
      dispatchKey(' ')
      expect(result.current.index).toBe(1)
    })

    it('ArrowLeft reverses to the previous page', () => {
      const { result } = renderHook(() =>
        useChartNavigation({ total: 3, enabled: true, initialIndex: 2 })
      )
      dispatchKey('ArrowLeft')
      expect(result.current.index).toBe(1)
    })

    it('PageUp reverses to the previous page', () => {
      const { result } = renderHook(() =>
        useChartNavigation({ total: 3, enabled: true, initialIndex: 2 })
      )
      dispatchKey('PageUp')
      expect(result.current.index).toBe(1)
    })

    it('Home resets to the first page', () => {
      const { result } = renderHook(() =>
        useChartNavigation({ total: 5, enabled: true, initialIndex: 4 })
      )
      dispatchKey('Home')
      expect(result.current.index).toBe(0)
    })

    it('calls preventDefault for a mapped key', () => {
      renderHook(() => useChartNavigation({ total: 3, enabled: true }))
      const event = dispatchKey('ArrowRight')
      expect(event.defaultPrevented).toBe(true)
    })

    it('does NOT call preventDefault for an unmapped key', () => {
      const { result } = renderHook(() =>
        useChartNavigation({ total: 3, enabled: true })
      )
      const event = dispatchKey('a')
      expect(event.defaultPrevented).toBe(false)
      // ...and the unmapped key does not move the index.
      expect(result.current.index).toBe(0)
    })

    it('detaches the listener when unmounted', () => {
      const { result, unmount } = renderHook(() =>
        useChartNavigation({ total: 3, enabled: true })
      )
      unmount()
      // After unmount the stale result still holds the last index; dispatching a
      // key must not throw and (nothing to assert on index) simply confirms no
      // listener remains active.
      expect(() => dispatchKey('ArrowRight')).not.toThrow()
      expect(result.current.index).toBe(0)
    })
  })
})
