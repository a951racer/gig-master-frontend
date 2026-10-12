import { useCallback, useState } from 'react'
import { allCharts } from '../api/charts'
import { putCharts, getCharts } from '../live/chartCache'

// Chart loader for Gig Master Live with online + offline paths (Phase 2, Req
// 2.2, 2.3, 6.2, 6.3, 6.4).
//
// `useGigCharts(gigId)` returns `{ load, charts, truncated, source, loading,
// error }`. The hook owns the network/cache orchestration so callers
// (LiveSetup's "Start Gig", a future direct performance load) share one source
// of truth; it does NOT navigate — callers decide what to do with the result.
//
// `load(playlistId, selections)` resolves to a plain result object (it never
// throws for the "offline + miss" case, so the UI can't crash on a rejected
// promise):
//
//   1. Online (`navigator.onLine !== false`): POST the charts via `allCharts`.
//      On success, best-effort write the payload into the IndexedDB cache
//      (`putCharts`) so the same performance can be replayed offline later
//      (Req 6.2). A cache-write failure MUST NOT fail the load — in jsdom (and
//      any environment without IndexedDB) `putCharts` rejects, so we swallow /
//      log it and still return the freshly-fetched charts. `source: 'network'`.
//
//   2. Network call fails, OR we're offline (`navigator.onLine === false`):
//      fall back to the cache (`getCharts`). On a hit, serve the cached payload
//      with `source: 'cache'` (Req 6.3) — an offline performance renders
//      identically to the online one.
//
//   3. Offline/failed AND no cache entry: surface a clear error state and
//      return `{ error, source: 'unavailable' }` without throwing (Req 6.4).
//      The message reflects the cause: a genuine offline miss reads "not
//      available offline" (Req 6.4), while an online request that failed with a
//      cache miss reads "failed to load charts" (Req 2.3) — both carry
//      `source: 'unavailable'`.
//
// `charts` / `truncated` / `source` / `error` are also kept in state so a
// component can read them directly (not only via the resolved value), and
// `loading` brackets the async work. `load` is stable (useCallback keyed on
// `gigId`) so it's safe in effect deps.

const OFFLINE_MESSAGE = 'This performance is not available offline.'
const LOAD_FAILED_MESSAGE = 'Failed to load charts'

export function useGigCharts(gigId) {
  const [charts, setCharts] = useState(null)
  const [truncated, setTruncated] = useState(false)
  const [source, setSource] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(
    async (playlistId, selections) => {
      setLoading(true)
      setError('')

      // Serve the cached entry for this gig + selections, or produce the
      // not-available state when there's no cache hit. Shared by the offline
      // and network-failure branches below. `missMessage` tailors the error to
      // the cause (offline vs. a failed online request).
      const serveFromCacheOrFail = async (missMessage) => {
        try {
          const entry = await getCharts(gigId, selections)
          if (entry) {
            const cachedCharts = entry.charts
            const cachedTruncated = Boolean(entry.truncated)
            setCharts(cachedCharts)
            setTruncated(cachedTruncated)
            setSource('cache')
            setError('')
            return { charts: cachedCharts, truncated: cachedTruncated, source: 'cache' }
          }
        } catch (cacheErr) {
          // A cache read failure (e.g. IndexedDB unavailable) is treated the
          // same as a miss — there's nothing to serve offline.
          // eslint-disable-next-line no-console
          console.warn('useGigCharts: cache read failed', cacheErr)
        }
        // Offline/failed with no usable cache entry (Req 6.4 / 2.3).
        setCharts(null)
        setTruncated(false)
        setSource('unavailable')
        setError(missMessage)
        return { error: missMessage, source: 'unavailable' }
      }

      try {
        // Offline up front: skip the doomed network call and go to cache. A
        // miss here is genuinely "not available offline" (Req 6.4).
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          return await serveFromCacheOrFail(OFFLINE_MESSAGE)
        }

        // Online path (Req 6.2): fetch, then best-effort cache the payload.
        const res = await allCharts(playlistId, { selections })
        const nextCharts = res.data?.charts
        const nextTruncated = Boolean(res.data?.truncated)

        // Best-effort cache write — a failure here MUST NOT fail the load.
        try {
          await putCharts({ gigId, selections, charts: nextCharts, truncated: nextTruncated })
        } catch (cacheErr) {
          // Expected in environments without IndexedDB (e.g. jsdom tests);
          // swallow so the online success path is unaffected.
          // eslint-disable-next-line no-console
          console.warn('useGigCharts: cache write failed (continuing)', cacheErr)
        }

        setCharts(nextCharts)
        setTruncated(nextTruncated)
        setSource('network')
        setError('')
        return { charts: nextCharts, truncated: nextTruncated, source: 'network' }
      } catch (networkErr) {
        // Network call failed while nominally online (Req 6.3) — fall back to
        // the cache; a miss here is a load failure, not an offline state.
        return await serveFromCacheOrFail(LOAD_FAILED_MESSAGE)
      } finally {
        setLoading(false)
      }
    },
    [gigId]
  )

  return { load, charts, truncated, source, loading, error }
}

export default useGigCharts
