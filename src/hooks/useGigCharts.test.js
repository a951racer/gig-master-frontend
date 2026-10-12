import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Mock the two dependency modules so we never touch the real network or
// IndexedDB. The hook orchestrates these; we control them per-test.
vi.mock('../api/charts', () => ({ allCharts: vi.fn() }))
vi.mock('../live/chartCache', () => ({ putCharts: vi.fn(), getCharts: vi.fn() }))

import { useGigCharts } from './useGigCharts'
import { allCharts } from '../api/charts'
import { putCharts, getCharts } from '../live/chartCache'

const GIG_ID = 'gig-123'
const PLAYLIST_ID = 'pl-456'
const SELECTIONS = [{ songId: 's1', mode: 'numbers' }]

// Remember the original navigator.onLine so each test can override it and
// afterEach can restore it (avoids leaking offline state across tests).
const originalOnLineDescriptor = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(navigator),
  'onLine'
)

function setOnLine(value) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true })
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  // Restore navigator.onLine to its original (prototype) definition.
  delete navigator.onLine
  if (originalOnLineDescriptor) {
    Object.defineProperty(navigator, 'onLine', originalOnLineDescriptor)
  }
})

describe('useGigCharts', () => {
  // 1. ONLINE success (Req 6.2)
  it('online success returns network charts, writes cache, and reflects state', async () => {
    setOnLine(true)
    const charts = [{ id: 'c1' }, { id: 'c2' }]
    allCharts.mockResolvedValue({ data: { charts, truncated: false } })
    putCharts.mockResolvedValue(undefined)

    const { result } = renderHook(() => useGigCharts(GIG_ID))

    let returned
    await act(async () => {
      returned = await result.current.load(PLAYLIST_ID, SELECTIONS)
    })

    expect(allCharts).toHaveBeenCalledWith(PLAYLIST_ID, { selections: SELECTIONS })
    expect(returned).toEqual({ charts, truncated: false, source: 'network' })
    expect(putCharts).toHaveBeenCalledWith({
      gigId: GIG_ID,
      selections: SELECTIONS,
      charts,
      truncated: false,
    })
    expect(result.current.charts).toEqual(charts)
    expect(result.current.source).toBe('network')
    expect(result.current.truncated).toBe(false)
    expect(result.current.error).toBe('')
    expect(getCharts).not.toHaveBeenCalled()
  })

  // 1b. ONLINE success forwards truncated: true
  it('online success forwards truncated: true', async () => {
    setOnLine(true)
    const charts = [{ id: 'c1' }]
    allCharts.mockResolvedValue({ data: { charts, truncated: true } })
    putCharts.mockResolvedValue(undefined)

    const { result } = renderHook(() => useGigCharts(GIG_ID))

    let returned
    await act(async () => {
      returned = await result.current.load(PLAYLIST_ID, SELECTIONS)
    })

    expect(returned).toEqual({ charts, truncated: true, source: 'network' })
    expect(putCharts).toHaveBeenCalledWith(
      expect.objectContaining({ truncated: true })
    )
    expect(result.current.truncated).toBe(true)
  })

  // 2. ONLINE success but cache WRITE fails (resilience, Req 6.2)
  it('online success still returns network charts when cache write fails', async () => {
    setOnLine(true)
    const charts = [{ id: 'c1' }]
    allCharts.mockResolvedValue({ data: { charts, truncated: false } })
    putCharts.mockRejectedValue(new Error('IndexedDB unavailable'))

    const { result } = renderHook(() => useGigCharts(GIG_ID))

    let returned
    await act(async () => {
      returned = await result.current.load(PLAYLIST_ID, SELECTIONS)
    })

    // Cache failure is swallowed — the online success path is unaffected.
    expect(returned).toEqual({ charts, truncated: false, source: 'network' })
    expect(result.current.source).toBe('network')
    expect(result.current.charts).toEqual(charts)
    expect(result.current.error).toBe('')
  })

  // 3. OFFLINE cache HIT (Req 6.3)
  it('offline serves cached charts without calling the network', async () => {
    setOnLine(false)
    const charts = [{ id: 'cached-1' }]
    getCharts.mockResolvedValue({ charts, truncated: true })

    const { result } = renderHook(() => useGigCharts(GIG_ID))

    let returned
    await act(async () => {
      returned = await result.current.load(PLAYLIST_ID, SELECTIONS)
    })

    expect(allCharts).not.toHaveBeenCalled()
    expect(getCharts).toHaveBeenCalledWith(GIG_ID, SELECTIONS)
    expect(returned).toEqual({ charts, truncated: true, source: 'cache' })
    expect(result.current.source).toBe('cache')
    expect(result.current.charts).toEqual(charts)
    expect(result.current.truncated).toBe(true)
    expect(result.current.error).toBe('')
  })

  // 4. OFFLINE cache MISS (Req 6.4)
  it('offline with no cache entry returns the not-available state without throwing', async () => {
    setOnLine(false)
    getCharts.mockResolvedValue(null)

    const { result } = renderHook(() => useGigCharts(GIG_ID))

    let returned
    await act(async () => {
      returned = await result.current.load(PLAYLIST_ID, SELECTIONS)
    })

    expect(allCharts).not.toHaveBeenCalled()
    expect(returned.source).toBe('unavailable')
    expect(returned.error).toMatch(/not available offline/i)
    expect(result.current.source).toBe('unavailable')
    expect(result.current.charts).toBeNull()
    expect(result.current.error).toMatch(/not available offline/i)
  })

  // 5. ONLINE network FAILS + cache HIT (Req 6.3)
  it('online network failure falls back to cached charts', async () => {
    setOnLine(true)
    allCharts.mockRejectedValue(new Error('network down'))
    const charts = [{ id: 'cached-fallback' }]
    getCharts.mockResolvedValue({ charts, truncated: false })

    const { result } = renderHook(() => useGigCharts(GIG_ID))

    let returned
    await act(async () => {
      returned = await result.current.load(PLAYLIST_ID, SELECTIONS)
    })

    expect(allCharts).toHaveBeenCalled()
    expect(getCharts).toHaveBeenCalledWith(GIG_ID, SELECTIONS)
    expect(returned).toEqual({ charts, truncated: false, source: 'cache' })
    expect(result.current.source).toBe('cache')
    expect(result.current.charts).toEqual(charts)
  })

  // 6. ONLINE network FAILS + cache MISS (Req 2.3 / 6.4)
  it('online network failure with no cache entry returns a load-failed state', async () => {
    setOnLine(true)
    allCharts.mockRejectedValue(new Error('network down'))
    getCharts.mockResolvedValue(null)

    const { result } = renderHook(() => useGigCharts(GIG_ID))

    let returned
    await act(async () => {
      returned = await result.current.load(PLAYLIST_ID, SELECTIONS)
    })

    expect(returned.source).toBe('unavailable')
    expect(returned.error).toMatch(/failed to load charts/i)
    expect(result.current.source).toBe('unavailable')
    expect(result.current.error).toMatch(/failed to load charts/i)
  })

  // 7. loading state brackets the in-flight load
  it('sets loading true during the in-flight load and false after it settles', async () => {
    setOnLine(true)
    const charts = [{ id: 'c1' }]

    // Deferred promise so we can observe the in-flight state before resolving.
    let resolveAllCharts
    allCharts.mockReturnValue(
      new Promise((resolve) => {
        resolveAllCharts = resolve
      })
    )
    putCharts.mockResolvedValue(undefined)

    const { result } = renderHook(() => useGigCharts(GIG_ID))

    expect(result.current.loading).toBe(false)

    let loadPromise
    act(() => {
      loadPromise = result.current.load(PLAYLIST_ID, SELECTIONS)
    })

    // In-flight: the network call hasn't resolved yet.
    expect(result.current.loading).toBe(true)

    await act(async () => {
      resolveAllCharts({ data: { charts, truncated: false } })
      await loadPromise
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.source).toBe('network')
  })
})
