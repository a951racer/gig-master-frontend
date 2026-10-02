import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getChart, saveChart, previewChart } from '../../api/charts'
import { useBand } from '../../auth/BandContext'

// Song Charts — PCO-style two-panel editor shell (task 9.1).
//
// Left panel  : monospaced <textarea> for ChordPro entry (full height).
// Right panel : live preview rendered from the API Render_Representation.
//
// Two independent key selectors frame the panels:
//   Entered Key   (over the left panel)  — how the body is interpreted (R11.2).
//   Displayed Key (over the right panel) — how the preview is rendered (R11.3).
// Both default to "Numbers" since the canonical stored body is Nashville numbers.
//
// Live preview is driven off a debounced change of body / enteredKey /
// displayedKey (400ms) that calls previewChart (un-persisted POST view) and
// renders the returned representation. Preview failures (e.g. an invalid body)
// surface as a small inline message rather than crashing the panel.
//
// NOTE: the Options menu + Formatting modal are task 9.2 — this component only
// leaves minimal hooks/placeholders for them (see `formatting` state and the
// optional title / artistLabel inputs). The router wiring is task 8.2.

// "Numbers" (default) + the 12 supported major keys. Shared by both selectors.
const KEY_OPTIONS = ['Numbers', 'C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

// Default formatting subdoc — mirrors the Chart model defaults (R1.4). Task 9.2
// (Formatting modal) will let the user edit these; for now they ride along on
// save unchanged so the stored chart has a valid formatting block.
const DEFAULT_FORMATTING = { font: 'monospace', size: 11, chordColor: 'blue', columns: 1 }

const PREVIEW_DEBOUNCE_MS = 400

const inputCls = 'w-full bg-[#1e1b2e] border border-purple-800/40 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600 text-sm'
const labelCls = 'block text-sm font-medium text-gray-300 mb-1.5'
const selectCls = 'bg-[#1e1b2e] border border-purple-800/40 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-600 text-sm'

// Pull a human-readable message (incl. 422 field detail) out of the error
// envelope { error: { code, message, fields } } the API returns.
function errorMessage(err, fallback) {
  const envelope = err?.response?.data?.error
  if (envelope?.fields) {
    const detail = Object.values(envelope.fields).join(', ')
    if (detail) return detail
  }
  return envelope?.message || fallback
}

// Render a single line: chords sit on their own row directly above the lyric
// row, aligned per segment, both monospaced so columns line up. A segment may
// carry only a chord (chord-only line) or only lyric (plain lyric).
function PreviewLine({ line }) {
  // Directive lines (PAGE_BREAK / COLUMN_BREAK / TRANSPOSE_KEY) render as a
  // dim marker rather than chord-over-lyric.
  if (line.directive) {
    const label =
      line.directive === 'TRANSPOSE_KEY'
        ? `TRANSPOSE KEY ${line.transposeShift >= 0 ? '+' : ''}${line.transposeShift}`
        : line.directive
    return <div className="text-purple-400/70 text-xs uppercase tracking-wide py-0.5">— {label} —</div>
  }

  const segments = line.segments || []
  // A fully blank line (no segments) renders as vertical spacing.
  if (segments.length === 0) {
    return <div className="h-4" />
  }

  return (
    <div className="flex font-mono text-sm whitespace-pre leading-tight">
      {segments.map((seg, i) => (
        <span key={i} className="flex flex-col">
          <span className="text-purple-300 h-5">{seg.chord || '\u00A0'}</span>
          <span className="text-gray-100">{seg.lyric || '\u00A0'}</span>
        </span>
      ))}
    </div>
  )
}

function PreviewSection({ section }) {
  return (
    <div className="mb-4">
      {section.label && (
        <div className="text-purple-400 font-semibold text-sm mb-1">
          {section.label}
          {section.repeat ? <span className="text-gray-400 font-normal"> ×{section.repeat}</span> : null}
        </div>
      )}
      <div className="space-y-0.5">
        {(section.lines || []).map((line, i) => (
          <PreviewLine key={i} line={line} />
        ))}
      </div>
    </div>
  )
}

// The live preview panel. Renders the Render_Representation, a loading hint, or
// an inline error without ever throwing.
function PreviewPanel({ render, error, loading }) {
  if (error) {
    return (
      <p role="alert" className="text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">
        {error}
      </p>
    )
  }
  if (!render) {
    return <p className="text-gray-500 text-sm">{loading ? 'Rendering…' : 'Start typing to see a live preview.'}</p>
  }
  const sections = render.sections || []
  return (
    <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
      {(render.title || render.artistLabel) && (
        <div className="mb-3">
          {render.title && <div className="text-white font-bold text-lg">{render.title}</div>}
          {render.artistLabel && <div className="text-gray-400 text-sm">{render.artistLabel}</div>}
        </div>
      )}
      {render.keyLabel && (
        <div className="text-xs text-gray-500 mb-3">Key: {render.keyLabel}</div>
      )}
      {sections.length === 0 ? (
        <p className="text-gray-500 text-sm">Nothing to preview yet.</p>
      ) : (
        sections.map((section, i) => <PreviewSection key={i} section={section} />)
      )}
    </div>
  )
}

export default function ChartEditorPage() {
  const { id: songId } = useParams()
  const navigate = useNavigate()
  const { currentBand } = useBand()

  // --- Editor state -------------------------------------------------------
  // body         : the working ChordPro text in the left textarea.
  // enteredKey   : how `body` is interpreted ("Numbers" | major key).
  // displayedKey : how the right-panel preview is rendered.
  // title/artistLabel : optional metadata carried on save (minimal for 9.1).
  // formatting   : default formatting block; the Formatting modal is task 9.2.
  const [body, setBody] = useState('')
  const [enteredKey, setEnteredKey] = useState('Numbers')
  const [displayedKey, setDisplayedKey] = useState('Numbers')
  const [title, setTitle] = useState('')
  const [artistLabel, setArtistLabel] = useState('')
  const [formatting] = useState(DEFAULT_FORMATTING)

  // --- Load / preview / save status --------------------------------------
  const [loadingChart, setLoadingChart] = useState(true)
  const [render, setRender] = useState(null)
  const [previewError, setPreviewError] = useState('')
  const [previewing, setPreviewing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')

  const debounceRef = useRef(null)

  // Load the existing chart on mount / song / band change. A 404 (no chart
  // yet) is not an error — we simply start with an empty editor. The stored
  // body is canonical Numbers, so we load it with Entered Key = Numbers.
  useEffect(() => {
    let cancelled = false
    setLoadingChart(true)
    getChart(songId)
      .then((res) => {
        if (cancelled) return
        const chart = res.data || {}
        setBody(chart.body || '')
        setTitle(chart.title || '')
        setArtistLabel(chart.artistLabel || '')
        setEnteredKey('Numbers') // stored body is always Numbers
      })
      .catch((err) => {
        if (cancelled) return
        // 404 CHART_NOT_FOUND → fresh editor. Anything else is a real failure.
        if (err?.response?.status !== 404) {
          setSaveError(errorMessage(err, 'Failed to load chart'))
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingChart(false)
      })
    return () => {
      cancelled = true
    }
  }, [songId, currentBand?.id])

  // Debounced live preview. Any change to body / enteredKey / displayedKey
  // schedules a previewChart call 400ms later; a fresh change resets the timer.
  const runPreview = useCallback(() => {
    // Empty body → clear the preview without hitting the server.
    if (!body.trim()) {
      setRender(null)
      setPreviewError('')
      setPreviewing(false)
      return
    }
    setPreviewing(true)
    previewChart(songId, { body, enteredKey, displayedKey })
      .then((res) => {
        setRender(res.data)
        setPreviewError('')
      })
      .catch((err) => {
        // Invalid body / key → show a small message, keep the last good render
        // cleared so the user isn't misled.
        setPreviewError(errorMessage(err, 'Preview unavailable — check the chart body.'))
      })
      .finally(() => setPreviewing(false))
  }, [songId, body, enteredKey, displayedKey])

  useEffect(() => {
    // Don't preview until the initial chart load has settled.
    if (loadingChart) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(runPreview, PREVIEW_DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [runPreview, loadingChart])

  // Editing the body or keys invalidates any "Saved" indicator.
  const markDirty = () => {
    if (saved) setSaved(false)
    if (saveError) setSaveError('')
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError('')
    setSaved(false)
    try {
      await saveChart(songId, { enteredKey, body, title, artistLabel, formatting })
      setSaved(true)
    } catch (err) {
      setSaveError(errorMessage(err, 'Failed to save chart'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col px-6 py-6">
      {/* Header: back link, title, save controls */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => navigate(`/songs/${songId}/chart`)}
          className="text-gray-400 hover:text-white transition-colors text-sm"
        >
          ← Chart
        </button>
        <h1 className="text-2xl font-bold text-white">Chart Editor</h1>
        <div className="ml-auto flex items-center gap-3">
          {saved && <span className="text-green-400 text-sm">Saved ✓</span>}
          <button
            onClick={handleSave}
            disabled={saving || loadingChart}
            className="bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white font-medium py-2 px-5 rounded-lg transition-colors text-sm"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Optional metadata — minimal for 9.1 (full Options menu is 9.2) */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label htmlFor="chart-title" className={labelCls}>Title</label>
          <input
            id="chart-title"
            value={title}
            onChange={(e) => { setTitle(e.target.value); markDirty() }}
            className={inputCls}
            placeholder="Optional display title"
          />
        </div>
        <div>
          <label htmlFor="chart-artist" className={labelCls}>Artist Label</label>
          <input
            id="chart-artist"
            value={artistLabel}
            onChange={(e) => { setArtistLabel(e.target.value); markDirty() }}
            className={inputCls}
            placeholder="Optional artist label"
          />
        </div>
      </div>

      {saveError && (
        <p role="alert" className="text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2 mb-4">
          {saveError}
        </p>
      )}

      {/* Two-panel editor shell */}
      <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
        {/* LEFT: Entered Key + ChordPro textarea */}
        <div className="flex flex-col min-h-0">
          <div className="flex items-center gap-2 mb-2">
            <label htmlFor="entered-key" className="text-sm font-medium text-gray-300">Entered Key</label>
            <select
              id="entered-key"
              value={enteredKey}
              onChange={(e) => { setEnteredKey(e.target.value); markDirty() }}
              className={selectCls}
            >
              {KEY_OPTIONS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <textarea
            value={body}
            onChange={(e) => { setBody(e.target.value); markDirty() }}
            disabled={loadingChart}
            spellCheck={false}
            className="flex-1 w-full bg-[#1e1b2e] border border-purple-800/40 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-600 min-h-0"
            placeholder={loadingChart ? 'Loading…' : 'Enter ChordPro here — e.g. [1]Amazing [4]grace'}
          />
        </div>

        {/* RIGHT: Displayed Key + live preview */}
        <div className="flex flex-col min-h-0">
          <div className="flex items-center gap-2 mb-2">
            <label htmlFor="displayed-key" className="text-sm font-medium text-gray-300">Displayed Key</label>
            <select
              id="displayed-key"
              value={displayedKey}
              onChange={(e) => setDisplayedKey(e.target.value)}
              className={selectCls}
            >
              {KEY_OPTIONS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
            {previewing && <span className="text-gray-500 text-xs">rendering…</span>}
          </div>
          <div className="flex-1 bg-[#2a2640] border border-purple-800/40 rounded-lg p-4 overflow-auto min-h-0">
            <PreviewPanel render={render} error={previewError} loading={previewing} />
          </div>
        </div>
      </div>
    </div>
  )
}
