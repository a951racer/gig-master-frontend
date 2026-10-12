import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getGig } from '../../api/gigs'
import { useBand } from '../../auth/BandContext'
import { useGigCharts } from '../../hooks/useGigCharts'
import ChartSelection, { MODE_NUMBERS } from '../../components/ChartSelection'

/**
 * Gig Master Live — chart-type setup (Req 2.1, 2.2, 2.3).
 *
 * The second screen of the `/live` flow. Loads the gig (`:id`), lets the
 * performer confirm per-song chart types via the shared `ChartSelection`
 * component (identical setAll/setOne logic to GigChartsPage), then offers a
 * prominent "Start Gig" control.
 *
 * On start: request the gig's charts for the current selections via the shared
 * `useGigCharts` loader and, on success, enter performance mode at
 * `/live/gigs/:id/play`, passing the loaded charts payload forward via React
 * Router location state so the performance view can render without re-fetching.
 * On failure (or offline with no cache), show an error and STAY on this screen
 * (Req 2.3, 6.4) — the button shows a working/disabled state while the request
 * is in flight.
 *
 * The loader (Task 13) owns the online/offline logic: online it fetches via
 * `allCharts` and caches the payload (Req 6.2); offline (or on a network
 * failure) it serves the previously-cached charts (`source: 'cache'`, Req 6.3)
 * or reports the performance isn't available offline (`source: 'unavailable'`,
 * Req 6.4). The start handler just awaits `load(...)` and forwards whatever
 * `{ charts, truncated }` comes back, regardless of source.
 *
 * Rendered inside LiveLayout's chromeless full-viewport wrapper (no NavBar), so
 * this screen owns its own flex column + internal scroll region, with
 * touch-friendly sizing consistent with LiveGigPicker.
 */
export default function LiveSetup() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentBand } = useBand()

  // Shared online/offline charts loader keyed on this gig (Req 6.2–6.4).
  const { load } = useGigCharts(id)

  const [gig, setGig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Per-song ephemeral mode selections, keyed by songId.
  const [modes, setModes] = useState({})

  // Start-Gig (charts request) state.
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    getGig(id)
      .then((res) => {
        if (!active) return
        setGig(res.data)
        // Seed every song to Numbers by default.
        const songs = res.data?.playlist?.songs || []
        const seed = {}
        songs.forEach((entry) => {
          const songId = entry?.song?._id ?? entry?._id
          if (songId) seed[songId] = MODE_NUMBERS
        })
        setModes(seed)
      })
      .catch(() => {
        if (active) setError('Failed to load gig')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [id, currentBand?.id])

  const playlist = gig?.playlist
  const songs = useMemo(() => playlist?.songs || [], [playlist])

  // Normalize setlist entries to { songId, title, playedKey } — same shape as
  // GigChartsPage so ChartSelection and the selections payload match.
  const songRows = useMemo(
    () =>
      songs.map((entry, i) => {
        const song = entry?.song ?? entry
        return {
          songId: song?._id ?? `row-${i}`,
          title: song?.title ?? '—',
          playedKey: entry?.playedKey || '',
        }
      }),
    [songs]
  )

  // Build the selections payload for every song in setlist order.
  const buildSelections = useCallback(
    () => songRows.map((row) => ({ songId: row.songId, mode: modes[row.songId] || MODE_NUMBERS })),
    [songRows, modes]
  )

  const setAll = (mode) => {
    setModes((prev) => {
      const next = { ...prev }
      songRows.forEach((row) => {
        next[row.songId] = mode
      })
      return next
    })
  }

  const setOne = (songId, mode) => setModes((prev) => ({ ...prev, [songId]: mode }))

  const handleStart = async () => {
    setStarting(true)
    setStartError('')
    const selections = buildSelections()
    // The loader never throws for the offline-miss case; it returns a result
    // object describing what it could serve. `result.charts` is present on a
    // network OR cache hit; `result.source === 'unavailable'` means offline
    // with no cache. (Req 2.2, 2.3, 6.2–6.4.)
    const result = await load(playlist._id, selections)

    if (result.charts) {
      // Enter performance mode at the first page, forwarding the loaded charts
      // (network or cache) via location state so the performance view renders
      // without a refetch. On success we navigate away, so `starting` need not
      // be reset here.
      navigate(`/live/gigs/${id}/play`, {
        state: { charts: result.charts, truncated: result.truncated, selections },
      })
      return
    }

    // Failure / not available offline (Req 2.3, 6.4) — show the error and stay.
    setStartError(result.error || 'Failed to load charts')
    setStarting(false)
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-lg">Loading...</div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex flex-col">
        <header className="shrink-0 px-6 pt-8 pb-6">
          <button
            type="button"
            onClick={() => navigate('/live')}
            className="text-gray-400 hover:text-white transition-colors text-base"
          >
            ← Back to gigs
          </button>
        </header>
        <div className="flex-1 min-h-0 flex items-center justify-center px-6">
          <p role="alert" className="text-red-400 text-lg">{error}</p>
        </div>
      </div>
    )
  }

  // No setlist / no songs — reached directly by URL. Non-crashing empty state
  // with a back-to-/live action (consistent with GigChartsPage / Req 1.3).
  if (!playlist || songRows.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <header className="shrink-0 px-6 pt-8 pb-6">
          <button
            type="button"
            onClick={() => navigate('/live')}
            className="text-gray-400 hover:text-white transition-colors text-base"
          >
            ← Back to gigs
          </button>
        </header>
        <div className="flex-1 min-h-0 flex items-center justify-center px-6">
          <div className="text-center text-gray-500">
            <div className="text-5xl mb-4">🎼</div>
            <p className="text-lg">This gig has no setlist songs to perform.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    // Full-height flex column: fixed heading + back control on top, scrollable
    // selection region in the middle, pinned Start Gig button at the bottom.
    <div className="h-full flex flex-col">
      <header className="shrink-0 px-6 pt-8 pb-4">
        <button
          type="button"
          onClick={() => navigate('/live')}
          className="text-gray-400 hover:text-white transition-colors text-base"
        >
          ← Back to gigs
        </button>
        <h1 className="text-3xl font-bold text-white mt-4">{gig?.name || 'Gig'}</h1>
        <p className="text-gray-400 text-base mt-1">{playlist.name}</p>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-6">
        <div className="max-w-2xl mx-auto pb-4">
          <ChartSelection songRows={songRows} modes={modes} onSetAll={setAll} onSetOne={setOne} />
        </div>
      </div>

      <footer className="shrink-0 px-6 pb-8 pt-2">
        <div className="max-w-2xl mx-auto">
          {startError && (
            <p
              role="alert"
              className="text-red-400 text-base mb-4 bg-red-900/20 border border-red-800/40 rounded-xl px-4 py-3"
            >
              {startError}
            </p>
          )}
          <button
            type="button"
            onClick={handleStart}
            disabled={starting}
            className={
              starting
                ? 'w-full bg-purple-900 text-gray-400 text-xl font-semibold px-6 py-5 rounded-2xl cursor-not-allowed'
                : 'w-full bg-purple-700 hover:bg-purple-600 active:bg-purple-500 text-white text-xl font-semibold px-6 py-5 rounded-2xl transition-colors'
            }
          >
            {starting ? 'Loading charts…' : 'Start Gig'}
          </button>
        </div>
      </footer>
    </div>
  )
}
