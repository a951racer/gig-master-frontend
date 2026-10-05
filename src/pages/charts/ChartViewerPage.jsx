import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { viewChart, downloadChartPdf } from '../../api/charts'
import { useBand } from '../../auth/BandContext'
import ChartPages from './ChartPages'

// On-screen chart viewer (R12). Renders the API Render_Representation with a
// single Key selector whose options are `Numbers` + the 12 supported major
// keys. `Numbers` shows stored Nashville degrees; a key shows server-transposed
// chord names (the transposition happens on the API via `viewChart`).
//
// The representation carries a server-computed `pages` array (PAGE_BREAK /
// COLUMN_BREAK already resolved into pages/columns). The actual page layout is
// delegated to the shared <ChartPages> component so the viewer and the editor
// live preview render identically.

// Key_Selection options: Numbers first, then the 12 major keys in design order.
const KEY_OPTIONS = ['Numbers', 'C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

const selectCls =
  'bg-[#1e1b2e] border border-purple-800/40 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-600 text-sm'

export default function ChartViewerPage() {
  const { id: songId } = useParams()
  const navigate = useNavigate()
  const { currentBand } = useBand()

  const [keySelection, setKeySelection] = useState('Numbers')
  const [chart, setChart] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(false)

  // Download state (R13). The PDF is fetched as a Blob through the authenticated
  // axios instance (downloadChartPdf) so the Authorization + X-Band-Id headers
  // ride along — a plain anchor href to the PDF URL could not carry those.
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')

  // Fetch on mount and whenever the Key selection (or band / song) changes.
  // `Numbers` is a valid value the API understands, so it is passed through as-is.
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setNotFound(false)
    viewChart(songId, { key: keySelection })
      .then((res) => {
        if (!active) return
        setChart(res.data)
      })
      .catch((err) => {
        if (!active) return
        const code = err?.response?.data?.error?.code
        const status = err?.response?.status
        if (code === 'CHART_NOT_FOUND' || status === 404) {
          setNotFound(true)
          setChart(null)
        } else {
          setError(err?.response?.data?.error?.message || 'Failed to load chart')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [songId, keySelection, currentBand?.id])

  // Fetch the PDF for the current Key selection as a Blob (auth-safe path),
  // then trigger a browser download via a temporary <a>. The download filename
  // is derived from the chart title, falling back to "chart.pdf".
  const handleDownloadPdf = async () => {
    setDownloading(true)
    setDownloadError('')
    let objectUrl
    try {
      const res = await downloadChartPdf(songId, { key: keySelection })
      const blob = res.data instanceof Blob ? res.data : new Blob([res.data], { type: 'application/pdf' })
      objectUrl = URL.createObjectURL(blob)
      const safeTitle = (chart?.title || '').trim().replace(/[\\/:*?"<>|]+/g, '_')
      const filename = safeTitle ? `${safeTitle}.pdf` : 'chart.pdf'
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch (err) {
      setDownloadError(err?.response?.data?.error?.message || 'Failed to download PDF')
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      setDownloading(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Top bar: back + Key selector + Download PDF */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-400 hover:text-white transition-colors text-sm"
        >
          ← Back
        </button>
        <div className="flex-1" />
        <label className="flex items-center gap-2 text-sm text-gray-400">
          <span>Key</span>
          <select
            className={selectCls}
            value={keySelection}
            onChange={(e) => setKeySelection(e.target.value)}
            aria-label="Key"
          >
            {KEY_OPTIONS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        {/* Edit this chart — jumps to the chart editor. */}
        <button
          type="button"
          onClick={() => navigate(`/songs/${songId}/chart/edit`)}
          className="text-sm text-white border border-purple-800/40 hover:bg-purple-800/30 px-3 py-2 rounded-lg transition-colors"
        >
          Edit Chart
        </button>
        {/* Download PDF (R13): enabled only when a chart exists. Fetches the PDF
            as a Blob through the authenticated axios instance and triggers a
            browser download. Disabled while a request is in flight. */}
        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={!chart || downloading}
          title={chart ? 'Download this chart as a PDF' : 'No chart to download'}
          className={
            !chart || downloading
              ? 'text-sm text-gray-500 border border-purple-800/40 px-3 py-2 rounded-lg cursor-not-allowed inline-flex items-center gap-2'
              : 'text-sm text-white border border-purple-800/40 hover:bg-purple-800/30 px-3 py-2 rounded-lg transition-colors inline-flex items-center gap-2'
          }
        >
          {downloading && (
            <span
              className="h-3.5 w-3.5 rounded-full border-2 border-purple-300/40 border-t-purple-300 animate-spin"
              aria-hidden="true"
            />
          )}
          {downloading ? 'Preparing…' : 'Download PDF'}
        </button>
      </div>

      {downloadError && (
        <p role="alert" className="text-red-400 text-sm mb-4 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">
          {downloadError}
        </p>
      )}

      {error && (
        <p role="alert" className="text-red-400 text-sm mb-4 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>
      ) : notFound ? (
        <div className="text-center py-16 text-gray-500">
          <div className="text-4xl mb-3">🎼</div>
          <p className="mb-4">This song has no chart yet.</p>
          <button
            onClick={() => navigate(`/songs/${songId}/chart/edit`)}
            className="bg-purple-700 hover:bg-purple-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Create a chart
          </button>
        </div>
      ) : chart ? (
        <ChartPages representation={chart} />
      ) : null}
    </div>
  )
}
