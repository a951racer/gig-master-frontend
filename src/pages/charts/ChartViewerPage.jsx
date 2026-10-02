import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { viewChart } from '../../api/charts'
import { useBand } from '../../auth/BandContext'

// On-screen chart viewer (R12). Renders the API Render_Representation with a
// single Key selector whose options are `Numbers` + the 12 supported major
// keys. `Numbers` shows stored Nashville degrees; a key shows server-transposed
// chord names (the transposition happens on the API via `viewChart`). Each line
// renders its chord positioned ABOVE the lyric it sits over, in a monospaced
// font, honoring `formatting.columns` and `formatting.chordColor`.

// Key_Selection options: Numbers first, then the 12 major keys in design order.
const KEY_OPTIONS = ['Numbers', 'C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

// Map the formatting.chordColor token to a concrete CSS color. The default is
// `blue`; fall back to the raw value so any valid CSS color still works, and to
// a sensible purple-tinted blue when unset.
const CHORD_COLORS = {
  blue: '#60a5fa',
  red: '#f87171',
  green: '#4ade80',
  orange: '#fb923c',
  purple: '#c084fc',
  black: '#e5e7eb', // on the dark theme a literal black would be invisible
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
      <span className="leading-tight text-gray-100 min-h-[1.2em]">{lyric || '\u00A0'}</span>
    </span>
  )
}

// Render one line of a section. A line is either a directive marker
// (PAGE_BREAK / COLUMN_BREAK / TRANSPOSE_KEY) or a sequence of chord/lyric
// segments. A line with no non-empty segments is a blank line → vertical space.
function Line({ line, chordColor }) {
  if (line.directive) {
    let label = line.directive.replace(/_/g, ' ')
    if (line.directive === 'TRANSPOSE_KEY' && line.transposeShift != null) {
      const sign = line.transposeShift >= 0 ? '+' : ''
      label = `TRANSPOSE KEY ${sign}${line.transposeShift}`
    }
    return (
      <div className="my-2 flex items-center gap-2 text-[10px] uppercase tracking-widest text-purple-400/70">
        <span className="h-px flex-1 bg-purple-800/40" />
        <span>{label}</span>
        <span className="h-px flex-1 bg-purple-800/40" />
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

// Render one section: an optional header (label + optional "x<repeat>") then
// each of its lines.
function Section({ section, chordColor }) {
  return (
    <div className="mb-5 break-inside-avoid">
      {section.label && (
        <h3 className="text-xs font-bold uppercase tracking-wider text-purple-300 mb-1.5">
          {section.label}
          {section.repeat ? <span className="ml-2 text-purple-400/70">x{section.repeat}</span> : null}
        </h3>
      )}
      <div className="space-y-0.5">
        {(section.lines || []).map((line, i) => (
          <Line key={i} line={line} chordColor={chordColor} />
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

  const chordColor = resolveChordColor(chart?.formatting?.chordColor)
  const columns = chart?.formatting?.columns === 2 ? 2 : 1
  const fontFamily = chart?.formatting?.font && chart.formatting.font !== 'monospace'
    ? `${chart.formatting.font}, monospace`
    : 'monospace'
  const fontSize = chart?.formatting?.size ? `${chart.formatting.size}pt` : undefined

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Top bar: back + Key selector + (PDF stub) */}
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
        {/* Download PDF is wired in task 11.1 — stub only, intentionally disabled. */}
        <button
          type="button"
          disabled
          title="PDF download coming soon"
          className="text-sm text-gray-500 border border-purple-800/40 px-3 py-2 rounded-lg cursor-not-allowed"
        >
          Download PDF
        </button>
      </div>

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
        <>
          <header className="mb-6">
            <h1 className="text-2xl font-bold text-white">{chart.title || 'Untitled chart'}</h1>
            {chart.artistLabel && <p className="text-gray-400 text-sm mt-0.5">{chart.artistLabel}</p>}
            <p className="text-purple-300 text-xs mt-2 uppercase tracking-wider">
              Key: {chart.keyLabel || keySelection}
            </p>
          </header>

          <div
            className="bg-[#1e1b2e] border border-purple-800/30 rounded-xl p-6 overflow-x-auto"
            style={{ fontFamily, fontSize }}
          >
            <div
              style={{
                columnCount: columns,
                columnGap: '2.5rem',
              }}
            >
              {(chart.sections || []).map((section, i) => (
                <Section key={i} section={section} chordColor={chordColor} />
              ))}
              {(chart.sections || []).length === 0 && (
                <p className="text-gray-600 text-sm">This chart is empty.</p>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
