import { useState, useEffect, useRef, useLayoutEffect, useMemo, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getGig } from '../../api/gigs'
import { allCharts, allChartsPdf, allChartsPdfZip } from '../../api/charts'
import { useBand } from '../../auth/BandContext'
import ChartPages, { PAGE_WIDTH, PAGE_HEIGHT } from '../charts/ChartPages'

// Gig "generate all charts" page (#85).
//
// Two steps live here:
//   1. Setup — a global All Numbers / All Chords choice plus a per-song
//      Numbers/Chords control. Selections are EPHEMERAL (local state only).
//   2. Performance view — the whole setlist flattened into a single page
//      sequence, one page shown at a time scaled to fit the viewport, with
//      next/prev/jump-to-start navigation and PDF/zip downloads.

const MODE_NUMBERS = 'Numbers'
const MODE_CHORDS = 'Chords'

// Trigger a browser download of a Blob under `filename`. Mirrors the pattern in
// ChartViewerPage.handleDownloadPdf: object URL + temp <a> + revoke.
function downloadBlob(data, filename, fallbackType) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: fallbackType })
  const objectUrl = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

// Sanitize a name into a safe download filename stem.
function safeStem(name) {
  return (name || '').trim().replace(/[\\/:*?"<>|]+/g, '_')
}

// Build the flat page sequence from the API's charts array (in setlist order).
// Each entry is { representation, title, keyLabel } where `representation` is a
// single-page chart representation renderable by ChartPages. A null chart
// contributes exactly one placeholder entry (flagged with `placeholder`).
function buildFlatPages(charts) {
  const flat = []
  for (const item of charts || []) {
    const chart = item?.chart
    const keyLabel = item?.playedKey || MODE_NUMBERS
    const title = chart?.title || item?.title || 'Untitled'
    if (!chart || !(chart.pages?.length > 0)) {
      flat.push({ title, keyLabel, placeholder: true })
      continue
    }
    chart.pages.forEach((page) => {
      flat.push({
        title: chart.title || title,
        keyLabel: chart.keyLabel || keyLabel,
        representation: {
          title: chart.title || title,
          artist: chart.artist || '',
          keyLabel: chart.keyLabel || keyLabel,
          formatting: chart.formatting || {},
          pages: [page],
        },
      })
    })
  }
  return flat
}

const toggleBtn = (active) =>
  active
    ? 'text-sm px-3 py-1.5 rounded-lg bg-purple-700 text-white transition-colors'
    : 'text-sm px-3 py-1.5 rounded-lg border border-purple-800/40 text-gray-300 hover:bg-purple-800/30 transition-colors'

// Scale an 816×1056 page down to fit the available container (both width and
// height), so a whole page shows at once. Measures the container and never
// scales above 1.
function FitToScreen({ children }) {
  const ref = useRef(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      if (w > 0 && h > 0) {
        setScale(Math.min(1, w / PAGE_WIDTH, h / PAGE_HEIGHT))
      }
    }
    measure()
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure)
      ro.observe(el)
      return () => ro.disconnect()
    }
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  return (
    <div ref={ref} className="flex-1 w-full flex items-start justify-center overflow-hidden">
      <div
        style={{
          width: `${PAGE_WIDTH * scale}px`,
          height: `${PAGE_HEIGHT * scale}px`,
        }}
      >
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            width: `${PAGE_WIDTH}px`,
            height: `${PAGE_HEIGHT}px`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

export default function GigChartsPage() {
  const { id } = useParams()
  const { currentBand } = useBand()

  const [gig, setGig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Per-song ephemeral mode selections, keyed by songId.
  const [modes, setModes] = useState({})

  // Performance view state.
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')
  const [flatPages, setFlatPages] = useState(null)
  const [truncated, setTruncated] = useState(false)
  const [pageIndex, setPageIndex] = useState(0)

  // Download state.
  const [downloading, setDownloading] = useState('') // '' | 'pdf' | 'zip'
  const [downloadError, setDownloadError] = useState('')

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
          const songId = (entry?.song?._id ?? entry?._id)
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

  // Normalize setlist entries to { songId, title, playedKey }.
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

  const handleGenerate = async () => {
    setGenerating(true)
    setGenerateError('')
    try {
      const res = await allCharts(playlist._id, { selections: buildSelections() })
      const flat = buildFlatPages(res.data?.charts)
      setFlatPages(flat)
      setTruncated(Boolean(res.data?.truncated))
      setPageIndex(0)
    } catch (err) {
      setGenerateError(err?.response?.data?.error?.message || 'Failed to generate charts')
    } finally {
      setGenerating(false)
    }
  }

  const downloadName = safeStem(gig?.name || playlist?.name || 'charts')

  const handleDownloadPdf = async () => {
    setDownloading('pdf')
    setDownloadError('')
    try {
      const res = await allChartsPdf(playlist._id, { selections: buildSelections() })
      downloadBlob(res.data, `${downloadName}.pdf`, 'application/pdf')
    } catch (err) {
      setDownloadError(err?.response?.data?.error?.message || 'Failed to download PDF')
    } finally {
      setDownloading('')
    }
  }

  const handleDownloadZip = async () => {
    setDownloading('zip')
    setDownloadError('')
    try {
      const res = await allChartsPdfZip(playlist._id, { selections: buildSelections() })
      downloadBlob(res.data, `${downloadName}.zip`, 'application/zip')
    } catch (err) {
      setDownloadError(err?.response?.data?.error?.message || 'Failed to download charts')
    } finally {
      setDownloading('')
    }
  }

  const inPerformance = Array.isArray(flatPages)
  const total = flatPages?.length || 0
  const current = inPerformance ? flatPages[pageIndex] : null

  const goStart = useCallback(() => setPageIndex(0), [])
  const goPrev = useCallback(() => setPageIndex((i) => Math.max(0, i - 1)), [])
  const goNext = useCallback(() => setPageIndex((i) => Math.min(total - 1, i + 1)), [total])

  // Keyboard arrows (nice-to-have) in the performance view.
  useEffect(() => {
    if (!inPerformance) return
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') goPrev()
      else if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [inPerformance, goPrev, goNext])

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>
  }
  if (error) {
    return <p role="alert" className="text-red-400 text-center py-16">{error}</p>
  }

  // No setlist / no songs — empty state + back link. (The launch button gates
  // this, so it should not normally be reached.)
  if (!playlist || songRows.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-8 text-center">
        <Link to={`/gigs/${id}`} className="text-gray-400 hover:text-white transition-colors text-sm">
          ← Back to gig
        </Link>
        <div className="py-16 text-gray-500">
          <div className="text-4xl mb-3">🎼</div>
          <p>This gig has no setlist songs to chart. Assign a setlist first.</p>
        </div>
      </div>
    )
  }

  // ---- Performance view ----
  if (inPerformance) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col" style={{ minHeight: 'calc(100vh - 80px)' }}>
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <button
            onClick={() => setFlatPages(null)}
            className="text-gray-400 hover:text-white transition-colors text-sm"
          >
            ← Setup
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloading !== ''}
            className={
              downloading !== ''
                ? 'text-sm text-gray-500 border border-purple-800/40 px-3 py-2 rounded-lg cursor-not-allowed'
                : 'text-sm text-white border border-purple-800/40 hover:bg-purple-800/30 px-3 py-2 rounded-lg transition-colors'
            }
          >
            {downloading === 'pdf' ? 'Preparing…' : 'Combined PDF'}
          </button>
          <button
            type="button"
            onClick={handleDownloadZip}
            disabled={downloading !== ''}
            className={
              downloading !== ''
                ? 'text-sm text-gray-500 border border-purple-800/40 px-3 py-2 rounded-lg cursor-not-allowed'
                : 'text-sm text-white border border-purple-800/40 hover:bg-purple-800/30 px-3 py-2 rounded-lg transition-colors'
            }
          >
            {downloading === 'zip' ? 'Preparing…' : 'Individual PDFs (zip)'}
          </button>
        </div>

        {downloadError && (
          <p role="alert" className="text-red-400 text-sm mb-3 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">
            {downloadError}
          </p>
        )}
        {truncated && (
          <p className="text-amber-300 text-sm mb-3 bg-amber-900/20 border border-amber-800/40 rounded-lg px-3 py-2">
            Some songs were omitted because the setlist is large.
          </p>
        )}

        {/* The one visible page, scaled to fit. */}
        {current ? (
          current.placeholder ? (
            <FitToScreen>
              <div
                className="bg-white text-gray-900 shadow-lg border border-gray-300 flex flex-col"
                style={{ width: `${PAGE_WIDTH}px`, height: `${PAGE_HEIGHT}px`, padding: '48px' }}
              >
                <div className="border-b border-gray-300 pb-2 mb-6 font-bold text-2xl text-gray-900">
                  {current.title} [{current.keyLabel}]
                </div>
                <p className="text-gray-500 text-lg">No chart for this song</p>
              </div>
            </FitToScreen>
          ) : (
            <FitToScreen>
              <ChartPages representation={current.representation} />
            </FitToScreen>
          )
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">No pages to show</div>
        )}

        {/* Navigation controls + position indicator. */}
        <div className="flex items-center justify-center gap-3 mt-4">
          <button
            type="button"
            onClick={goStart}
            disabled={pageIndex === 0}
            aria-label="Jump to beginning"
            className={
              pageIndex === 0
                ? 'text-sm text-gray-600 border border-purple-800/40 px-3 py-2 rounded-lg cursor-not-allowed'
                : 'text-sm text-white border border-purple-800/40 hover:bg-purple-800/30 px-3 py-2 rounded-lg transition-colors'
            }
          >
            ⏮ Start
          </button>
          <button
            type="button"
            onClick={goPrev}
            disabled={pageIndex === 0}
            aria-label="Previous page"
            className={
              pageIndex === 0
                ? 'text-sm text-gray-600 border border-purple-800/40 px-3 py-2 rounded-lg cursor-not-allowed'
                : 'text-sm text-white border border-purple-800/40 hover:bg-purple-800/30 px-3 py-2 rounded-lg transition-colors'
            }
          >
            ← Prev
          </button>
          <span className="text-sm text-gray-300 min-w-[7rem] text-center">
            Page {total === 0 ? 0 : pageIndex + 1} of {total}
          </span>
          <button
            type="button"
            onClick={goNext}
            disabled={pageIndex >= total - 1}
            aria-label="Next page"
            className={
              pageIndex >= total - 1
                ? 'text-sm text-gray-600 border border-purple-800/40 px-3 py-2 rounded-lg cursor-not-allowed'
                : 'text-sm text-white border border-purple-800/40 hover:bg-purple-800/30 px-3 py-2 rounded-lg transition-colors'
            }
          >
            Next →
          </button>
        </div>
      </div>
    )
  }

  // ---- Setup step ----
  const allNumbers = songRows.length > 0 && songRows.every((r) => (modes[r.songId] || MODE_NUMBERS) === MODE_NUMBERS)
  const allChords = songRows.length > 0 && songRows.every((r) => modes[r.songId] === MODE_CHORDS)

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/gigs/${id}`} className="text-gray-400 hover:text-white transition-colors text-sm">
          ← Back to gig
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-white mb-1">Generate Charts</h1>
      <p className="text-gray-400 text-sm mb-6">{playlist.name}</p>

      {/* Global choice: All Numbers (default) vs All Chords. */}
      <div className="bg-[#2a2640] border border-purple-800/30 rounded-2xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Set all songs to</h2>
        <div className="flex gap-2" role="group" aria-label="Set all songs mode">
          <button type="button" onClick={() => setAll(MODE_NUMBERS)} className={toggleBtn(allNumbers)}>
            All Numbers
          </button>
          <button type="button" onClick={() => setAll(MODE_CHORDS)} className={toggleBtn(allChords)}>
            All Chords
          </button>
        </div>
      </div>

      {/* Per-song mode controls. */}
      <div className="bg-[#2a2640] border border-purple-800/30 rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Songs</h2>
        <ul className="space-y-3">
          {songRows.map((row, i) => {
            const mode = modes[row.songId] || MODE_NUMBERS
            return (
              <li key={row.songId} className="flex items-center gap-3 text-sm">
                <span className="text-gray-600 w-5 text-right shrink-0">{i + 1}</span>
                <span className="text-white font-medium">{row.title}</span>
                {row.playedKey && (
                  <span className="text-purple-300 font-mono text-xs font-normal">[{row.playedKey}]</span>
                )}
                <div className="ml-auto flex gap-2" role="group" aria-label={`Mode for ${row.title}`}>
                  <button
                    type="button"
                    aria-pressed={mode === MODE_NUMBERS}
                    onClick={() => setOne(row.songId, MODE_NUMBERS)}
                    className={toggleBtn(mode === MODE_NUMBERS)}
                  >
                    Numbers
                  </button>
                  <button
                    type="button"
                    aria-pressed={mode === MODE_CHORDS}
                    onClick={() => setOne(row.songId, MODE_CHORDS)}
                    className={toggleBtn(mode === MODE_CHORDS)}
                  >
                    Chords
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      {generateError && (
        <p role="alert" className="text-red-400 text-sm mb-4 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">
          {generateError}
        </p>
      )}

      <button
        type="button"
        onClick={handleGenerate}
        disabled={generating}
        className={
          generating
            ? 'w-full bg-purple-900 text-gray-400 text-sm font-medium px-4 py-3 rounded-lg cursor-not-allowed'
            : 'w-full bg-purple-700 hover:bg-purple-600 text-white text-sm font-medium px-4 py-3 rounded-lg transition-colors'
        }
      >
        {generating ? 'Generating…' : 'Generate Charts'}
      </button>
    </div>
  )
}
