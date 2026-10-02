import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { viewChart, downloadChartPdf } from '../../api/charts'
import { useBand } from '../../auth/BandContext'

// On-screen chart viewer (R12). Renders the API Render_Representation with a
// single Key selector whose options are `Numbers` + the 12 supported major
// keys. `Numbers` shows stored Nashville degrees; a key shows server-transposed
// chord names (the transposition happens on the API via `viewChart`).
//
// The representation now carries a server-computed `pages` array — the server
// resolves PAGE_BREAK / COLUMN_BREAK into pages and columns, so the viewer just
// lays them out as virtual US-Letter pages. Each line in a column is one of:
//   { header: { label, repeat } }                         — a section header
//   { segments: [{chord, lyric}], directive, transposeShift } — content/blank
//   { directive: 'TRANSPOSE_KEY', transposeShift }         — a transpose marker
// COLUMN_BREAK / PAGE_BREAK never appear as visible lines — do not render them.

// Key_Selection options: Numbers first, then the 12 major keys in design order.
const KEY_OPTIONS = ['Numbers', 'C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

// Virtual US-Letter portrait page at 96dpi: 8.5in × 11in → 816px × 1056px.
const PAGE_WIDTH = 816
const PAGE_HEIGHT = 1056
const PAGE_PADDING = 48
const BANNER_HEIGHT = 72 // ~0.75in shaded banner on page 1

// Map the formatting.chordColor token to a concrete CSS color. The default is
// `blue`; fall back to the raw value so any valid CSS color still works, and to
// a sensible blue when unset.
const CHORD_COLORS = {
  blue: '#2563eb',
  red: '#dc2626',
  green: '#16a34a',
  orange: '#ea580c',
  purple: '#9333ea',
  black: '#111827',
}
function resolveChordColor(token) {
  if (!token) return CHORD_COLORS.blue
  return CHORD_COLORS[token] || token
}

const selectCls =
  'bg-[#1e1b2e] border border-purple-800/40 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-600 text-sm'

// A single rendered segment: the chord (or a blank spacer) stacked above its
// lyric text. Using inline-flex columns keeps each chord glued to the start of
// the syllable it sits over while the monospaced font keeps things aligned.
function Segment({ chord, lyric, chordColor }) {
  return (
    <span className="inline-flex flex-col align-top whitespace-pre">
      <span className="leading-tight font-semibold min-h-[1.2em]" style={{ color: chordColor }}>
        {chord || '\u00A0'}
      </span>
      <span className="leading-tight text-gray-900 min-h-[1.2em]">{lyric || '\u00A0'}</span>
    </span>
  )
}

// Render one line of a column. A line is one of:
//   - a section header   : { header: { label, repeat } }
//   - a transpose marker : { directive: 'TRANSPOSE_KEY', transposeShift }
//   - a content/blank    : { segments: [...] } (empty segments → blank line)
// COLUMN_BREAK / PAGE_BREAK are resolved by the server and never arrive here.
function Line({ line, chordColor }) {
  // Section header line.
  if (line.header) {
    return (
      <h3 className="text-xs font-bold uppercase tracking-wider text-purple-700 mt-3 mb-1.5 first:mt-0">
        {line.header.label}
        {line.header.repeat ? <span className="ml-2 text-purple-500">x{line.header.repeat}</span> : null}
      </h3>
    )
  }

  // Transpose marker line.
  if (line.directive === 'TRANSPOSE_KEY') {
    const sign = line.transposeShift != null && line.transposeShift >= 0 ? '+' : ''
    const label =
      line.transposeShift != null
        ? `TRANSPOSE KEY ${sign}${line.transposeShift}`
        : 'TRANSPOSE KEY'
    return (
      <div className="my-2 flex items-center gap-2 text-[10px] uppercase tracking-widest text-purple-500">
        <span className="h-px flex-1 bg-purple-300" />
        <span>{label}</span>
        <span className="h-px flex-1 bg-purple-300" />
      </div>
    )
  }

  const segments = line.segments || []
  const isBlank = segments.length === 0 || segments.every((s) => !s.chord && !s.lyric)
  if (isBlank) {
    // Stanza separator — reserve vertical space.
    return <div className="h-5" aria-hidden="true" />
  }

  return (
    <div className="flex flex-wrap items-start">
      {segments.map((seg, i) => (
        <Segment key={i} chord={seg.chord} lyric={seg.lyric} chordColor={chordColor} />
      ))}
    </div>
  )
}

// Render one column: its lines top-to-bottom.
function Column({ column, chordColor }) {
  return (
    <div className="flex-1 min-w-0">
      {(column.lines || []).map((line, i) => (
        <Line key={i} line={line} chordColor={chordColor} />
      ))}
    </div>
  )
}

// Page 1 banner header: a shaded block with the title (large/bold) and the
// artist beneath it in bold brackets.
function BannerHeader({ title, artist, keyLabel }) {
  return (
    <div
      className="bg-gray-200 rounded px-5 flex flex-col justify-center mb-6"
      style={{ minHeight: `${BANNER_HEIGHT}px` }}
    >
      <div className="text-2xl font-bold text-gray-900 leading-tight">
        {title} [{keyLabel}]
      </div>
      <div className="text-base font-bold text-gray-700 leading-tight">[{artist}]</div>
    </div>
  )
}

// Pages 2+ condensed header: two lines tall, smaller, no shaded banner. Sized
// relative to the formatting size so it scales with the chart body.
function CondensedHeader({ title, keyLabel, baseSize }) {
  const size = baseSize ? `${baseSize + 1}pt` : undefined
  return (
    <div className="mb-4 border-b border-gray-300 pb-2" style={{ minHeight: '2.6em' }}>
      <div className="font-bold text-gray-900 leading-tight" style={{ fontSize: size }}>
        {title} [{keyLabel}]
      </div>
    </div>
  )
}

// A single virtual US-Letter page. Page 1 gets the banner, pages 2+ a condensed
// header. The columns come from the data (pages[i].columns), rendered as an
// equal-width flex row.
function ChartPage({ page, index, title, artist, keyLabel, chordColor, baseSize }) {
  const columns = page.columns || []
  return (
    <div
      className="bg-white text-gray-900 shadow-lg border border-gray-300 mx-auto"
      style={{
        width: `${PAGE_WIDTH}px`,
        minHeight: `${PAGE_HEIGHT}px`,
        padding: `${PAGE_PADDING}px`,
      }}
    >
      {index === 0 ? (
        <BannerHeader title={title} artist={artist} keyLabel={keyLabel} />
      ) : (
        <CondensedHeader title={title} keyLabel={keyLabel} baseSize={baseSize} />
      )}

      <div className="flex" style={{ gap: '24px' }}>
        {columns.map((column, i) => (
          <Column key={i} column={column} chordColor={chordColor} />
        ))}
      </div>
    </div>
  )
}

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

  const chordColor = resolveChordColor(chart?.formatting?.chordColor)
  const fontFamily = chart?.formatting?.font && chart.formatting.font !== 'monospace'
    ? `${chart.formatting.font}, monospace`
    : 'monospace'
  const baseSize = chart?.formatting?.size
  const fontSize = baseSize ? `${baseSize}pt` : undefined

  const pages = chart?.pages || []
  const keyLabel = chart?.keyLabel || keySelection
  const title = chart?.title || 'Untitled chart'
  const artist = chart?.artist || ''

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
        pages.length === 0 ? (
          <p className="text-gray-500 text-sm">This chart is empty.</p>
        ) : (
          <div className="flex flex-col items-center gap-8">
            {pages.map((page, i) => (
              <div key={i} style={{ fontFamily, fontSize }}>
                <ChartPage
                  page={page}
                  index={i}
                  title={title}
                  artist={artist}
                  keyLabel={keyLabel}
                  chordColor={chordColor}
                  baseSize={baseSize}
                />
              </div>
            ))}
          </div>
        )
      ) : null}
    </div>
  )
}
