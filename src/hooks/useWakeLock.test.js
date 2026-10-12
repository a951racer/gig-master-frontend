import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import fc from 'fast-check'

// --- Module-mock approach -----------------------------------------------------
//
// `useWakeLock.js` computes `SUPPORTED` from `'wakeLock' in navigator` ONCE at
// MODULE LOAD. A static `import` at the top of this file would therefore freeze
// `SUPPORTED` to whatever `navigator` looked like at that instant, making it
// impossible to exercise both the supported and unsupported paths.
//
// So we never import the hook statically. Instead each test:
//   1. installs (or removes) a fake `navigator.wakeLock` on the real navigator,
//   2. calls `vi.resetModules()` to drop the cached module,
//   3. `await import('./useWakeLock')` so the fresh module evaluates `SUPPORTED`
//      against the navigator we just set up.
// `loadHook({ supported })` encapsulates that dance and returns the hook fn.
// -----------------------------------------------------------------------------

// Flush pending microtasks (the acquire path is async: `await request(...)` and
// the release path chains off `Promise.resolve()`). Wrapping an empty async
// callback in `act` lets queued promise jobs settle and state updates flush.
async function flush() {
  await act(async () => {})
}

// Build a fake Screen Wake Lock. `request('screen')` is a spy returning a
// sentinel; each sentinel has a `release` spy (resolves) and a real
// `addEventListener('release', cb)` that stores the callback so a test can fire
// it (simulating the platform auto-releasing on tab hide). A live-count tracks
// requests minus releases so we can assert "never more than one held".
function makeFakeWakeLock({ requestImpl } = {}) {
  let live = 0
  let maxLive = 0
  const sentinels = []

  const makeSentinel = () => {
    const listeners = []
    live += 1
    maxLive = Math.max(maxLive, live)
    const sentinel = {
      released: false,
      release: vi.fn(() => {
        if (!sentinel.released) {
          sentinel.released = true
          live -= 1
        }
        return Promise.resolve()
      }),
      addEventListener: vi.fn((type, cb) => {
        if (type === 'release') listeners.push(cb)
      }),
      // Simulate the platform firing its own 'release' (e.g. tab hidden).
      fireRelease: () => {
        if (!sentinel.released) {
          sentinel.released = true
          live -= 1
        }
        listeners.forEach((cb) => cb())
      },
    }
    sentinels.push(sentinel)
    return sentinel
  }

  const request = vi.fn((type) => {
    if (requestImpl) return requestImpl(type, makeSentinel)
    return Promise.resolve(makeSentinel())
  })

  return {
    wakeLock: { request },
    request,
    sentinels,
    get live() {
      return live
    },
    get maxLive() {
      return maxLive
    },
    lastSentinel: () => sentinels[sentinels.length - 1],
  }
}

// Install / remove a fake wakeLock on the real navigator, reset the module
// cache, and import the hook fresh so SUPPORTED reflects the current navigator.
async function loadHook({ supported }) {
  if (supported) {
    const fake = makeFakeWakeLock(supported === true ? {} : supported)
    Object.defineProperty(navigator, 'wakeLock', {
      value: fake.wakeLock,
      configurable: true,
      writable: true,
    })
    vi.resetModules()
    const mod = await import('./useWakeLock')
    return { useWakeLock: mod.useWakeLock, fake }
  }
  // Unsupported: ensure navigator has NO wakeLock before the module evaluates.
  delete navigator.wakeLock
  vi.resetModules()
  const mod = await import('./useWakeLock')
  return { useWakeLock: mod.useWakeLock, fake: null }
}

// Set document.visibilityState (jsdom's is a read-only getter) and dispatch the
// corresponding visibilitychange event inside act().
function setVisibility(state) {
  Object.defineProperty(document, 'visibilityState', {
    value: state,
    configurable: true,
  })
}

function dispatchVisibilityChange(state) {
  setVisibility(state)
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

describe('useWakeLock', () => {
  beforeEach(() => {
    // Default to a visible document for every test; individual tests override.
    setVisibility('visible')
  })

  afterEach(() => {
    delete navigator.wakeLock
    vi.resetModules()
    vi.restoreAllMocks()
  })

  // ---------------------------------------------------------------------------
  // Example-based tests
  // ---------------------------------------------------------------------------

  // Req 4.1: supported + active requests a screen lock and reports held.
  it('supported + active: requests a screen lock on mount and reports active', async () => {
    const { useWakeLock, fake } = await loadHook({ supported: true })
    const { result } = renderHook(() => useWakeLock(true))
    await flush()

    expect(fake.request).toHaveBeenCalledWith('screen')
    expect(fake.request).toHaveBeenCalledTimes(1)
    expect(result.current.supported).toBe(true)
    expect(result.current.active).toBe(true)
    expect(fake.live).toBe(1)
  })

  // Req 4.2: deactivating (rerender active:false) releases the sentinel.
  it('deactivate: releasing on active -> false and active becomes false', async () => {
    const { useWakeLock, fake } = await loadHook({ supported: true })
    const { result, rerender } = renderHook(({ a }) => useWakeLock(a), {
      initialProps: { a: true },
    })
    await flush()
    expect(result.current.active).toBe(true)
    const sentinel = fake.lastSentinel()

    rerender({ a: false })
    await flush()

    expect(sentinel.release).toHaveBeenCalled()
    expect(result.current.active).toBe(false)
    expect(fake.live).toBe(0)
  })

  // Req 4.2: unmount releases the sentinel.
  it('unmount: releases the held sentinel', async () => {
    const { useWakeLock, fake } = await loadHook({ supported: true })
    const { result, unmount } = renderHook(() => useWakeLock(true))
    await flush()
    expect(result.current.active).toBe(true)
    const sentinel = fake.lastSentinel()

    unmount()
    await flush()

    expect(sentinel.release).toHaveBeenCalled()
    expect(fake.live).toBe(0)
  })

  // Req 4.3: platform auto-releases on hide; returning to visible re-acquires.
  it('visibilitychange: re-acquires when returning to visible after a hide', async () => {
    const { useWakeLock, fake } = await loadHook({ supported: true })
    const { result } = renderHook(() => useWakeLock(true))
    await flush()
    expect(result.current.active).toBe(true)
    expect(fake.request).toHaveBeenCalledTimes(1)

    // Simulate the platform auto-releasing on tab hide: fire the sentinel's
    // own 'release' event -> hook reflects not-held.
    act(() => {
      fake.lastSentinel().fireRelease()
    })
    expect(result.current.active).toBe(false)

    // Return to visible -> the hook re-requests a fresh lock.
    dispatchVisibilityChange('visible')
    await flush()

    expect(fake.request).toHaveBeenCalledTimes(2)
    expect(result.current.active).toBe(true)
    expect(fake.live).toBe(1)
    expect(fake.maxLive).toBeLessThanOrEqual(1)
  })

  // Req 4.4: no API -> no-op, supported false, active false, nothing throws.
  it('unsupported: no-ops with supported false and active false', async () => {
    const { useWakeLock, fake } = await loadHook({ supported: false })
    expect(fake).toBeNull()

    let result
    expect(() => {
      ;({ result } = renderHook(() => useWakeLock(true)))
    }).not.toThrow()
    await flush()

    expect(result.current.supported).toBe(false)
    expect(result.current.active).toBe(false)
  })

  // Req 4.4: request rejects -> hook catches, active stays false, no throw.
  it('request rejects: catches, stays inactive, does not throw', async () => {
    const { useWakeLock, fake } = await loadHook({
      supported: { requestImpl: () => Promise.reject(new Error('denied')) },
    })

    let result
    expect(() => {
      ;({ result } = renderHook(() => useWakeLock(true)))
    }).not.toThrow()
    await flush()

    expect(fake.request).toHaveBeenCalledWith('screen')
    expect(result.current.supported).toBe(true)
    expect(result.current.active).toBe(false)
    expect(fake.live).toBe(0)
  })

  // ---------------------------------------------------------------------------
  // Property-based test (fast-check) — Design Correctness Property 4.
  // ---------------------------------------------------------------------------

  describe('property-based', () => {
    // Property 4: across any sequence of activate / deactivate /
    // visibility-hide / visibility-show / rerender, the hook never holds more
    // than one sentinel at a time, and after a final deactivate + unmount the
    // net held count is 0 (always released, no leak).
    // **Validates: Requirements 4.1, 4.2, 4.3**
    it('Property 4 — never holds more than one sentinel and always releases (no leak)', async () => {
      const op = fc.constantFrom(
        'activate',
        'deactivate',
        'hide',
        'show',
        'rerender'
      )

      await fc.assert(
        fc.asyncProperty(fc.array(op, { maxLength: 40 }), async (ops) => {
          const { useWakeLock, fake } = await loadHook({ supported: true })

          let active = true
          const { rerender, unmount } = renderHook(({ a }) => useWakeLock(a), {
            initialProps: { a: active },
          })
          await flush()

          for (const o of ops) {
            if (o === 'activate') {
              active = true
              rerender({ a: active })
            } else if (o === 'deactivate') {
              active = false
              rerender({ a: active })
            } else if (o === 'rerender') {
              rerender({ a: active })
            } else if (o === 'hide') {
              // Platform auto-release on hide: fire the live sentinel's release.
              setVisibility('hidden')
              act(() => {
                const s = fake.lastSentinel()
                if (s && !s.released) s.fireRelease()
              })
            } else if (o === 'show') {
              dispatchVisibilityChange('visible')
            }
            await flush()

            // Invariant: at no observed point is more than one sentinel held.
            expect(fake.live).toBeLessThanOrEqual(1)
          }

          // Global high-water mark across the whole sequence.
          expect(fake.maxLive).toBeLessThanOrEqual(1)

          // Final teardown: deactivate then unmount must leave nothing held.
          active = false
          rerender({ a: active })
          await flush()
          unmount()
          await flush()

          expect(fake.live).toBe(0)
        }),
        { numRuns: 50 }
      )
    })
  })
})
