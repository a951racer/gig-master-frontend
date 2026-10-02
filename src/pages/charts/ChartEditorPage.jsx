import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getChart, saveChart, previewChart } from '../../api/charts'
import { useBand } from '../../auth/BandContext'
import ChartPages from './ChartPages'

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
// The Options menu (directive/markup/chord-symbol inserts + Revert All Changes)
// and the Formatting modal (Font / Size / Chord Color / Columns) are task 9.2 —
// both operate on the controlled textarea value / the `formatting` block and
// ride along on the existing saveChart call. The router wiring is task 8.2.

// "Numbers" (default) + the 12 supported major keys. Shared by both selectors.
const KEY_OPTIONS = ['Numbers', 'C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

// Default formatting subdoc — mirrors the Chart model defaults (R1.4). The
// Formatting modal (below) edits these in place; they ride along on save so the
// stored chart always has a valid formatting block.
const DEFAULT_FORMATTING = { font: 'monospace', size: 11, chordColor: 'blue', columns: 1 }

// Formatting modal field options. Kept small and in step with the API's
// formatting subdoc (font / size / chordColor / columns) — no This-Chart vs
// Defaults toggle and no Print Settings (design "Frontend — Editor").
const FONT_OPTIONS = ['monospace', 'serif', 'sans-serif']
const SIZE_OPTIONS = [8, 9, 10, 11, 12, 14, 16, 18]
const CHORD_COLOR_OPTIONS = ['blue', 'red', 'green', 'purple', 'black']
const COLUMN_OPTIONS = [1, 2]

// Chord symbols offered by the Options menu — inserted at the caret (design
// "Frontend — Editor": Chord Symbols ° ø Δ ♭ ◊).
const CHORD_SYMBOLS = ['°', 'ø', 'Δ', '♭', '◊']

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

// The live preview panel. Renders the SAME paginated `pages` structure the
// on-screen viewer uses (via the shared <ChartPages> component), so the editor
// preview is a true WYSIWYG: multi-column layout, hidden COLUMN_BREAK /
// PAGE_BREAK, and the page banner all match the viewer and the PDF. The pages
// are scaled down to fit the narrower editor panel.
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
  const hasPages = Array.isArray(render.pages) && render.pages.length > 0
  return (
    <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
      {hasPages ? (
        // Scale the 816px-wide virtual pages down to fit the editor's panel.
        <ChartPages representation={render} fitToWidth />
      ) : (
        <p className="text-gray-500 text-sm">Nothing to preview yet.</p>
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
  // title/artist : READ-ONLY, sourced from the Song (never chart-overridable).
  //                Shown for context; not editable and not part of the save.
  // formatting   : default formatting block; edited via the Formatting modal.
  const [body, setBody] = useState('')
  const [enteredKey, setEnteredKey] = useState('Numbers')
  const [displayedKey, setDisplayedKey] = useState('Numbers')
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [formatting, setFormatting] = useState(DEFAULT_FORMATTING)

  // loadedBody : the body as last fetched on mount / last saved. "Revert All
  // Changes" (Options menu) resets the textarea back to this (R11.5).
  const [loadedBody, setLoadedBody] = useState('')

  // UI state for the Options menu (dropdown open) and Formatting modal (open).
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [formattingOpen, setFormattingOpen] = useState(false)

  // --- Load / preview / save status --------------------------------------
  const [loadingChart, setLoadingChart] = useState(true)
  const [render, setRender] = useState(null)
  const [previewError, setPreviewError] = useState('')
  const [previewing, setPreviewing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')

  const debounceRef = useRef(null)
  const textareaRef = useRef(null)
  const optionsRef = useRef(null)

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
        setLoadedBody(chart.body || '') // revert target = last-loaded body
        // Title/artist are Song properties returned on the chart payload —
        // read-only context only, never edited or saved from here.
        setTitle(chart.title || '')
        setArtist(chart.artist || '')
        // Formatting rides along on save; fall back to defaults when absent so
        // the modal always has a complete block to edit.
        setFormatting({ ...DEFAULT_FORMATTING, ...(chart.formatting || {}) })
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
    previewChart(songId, { body, enteredKey, displayedKey, formatting })
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
  }, [songId, body, enteredKey, displayedKey, formatting])

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

  // Close the Options dropdown when clicking outside it.
  useEffect(() => {
    if (!optionsOpen) return
    const onDocClick = (e) => {
      if (optionsRef.current && !optionsRef.current.contains(e.target)) {
        setOptionsOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [optionsOpen])

  // --- Textarea insertion helpers (Options menu) --------------------------
  //
  // Low-level splice: replace the current selection [start, end) in `body` with
  // `text` and leave the caret at `start + caretOffset` (default: end of the
  // inserted text). Updates the controlled value (which re-triggers the
  // debounced live preview) and restores focus/selection to the textarea.
  const spliceIntoBody = useCallback(
    (text, { caretOffset } = {}) => {
      const el = textareaRef.current
      const start = el ? el.selectionStart : body.length
      const end = el ? el.selectionEnd : body.length
      const next = body.slice(0, start) + text + body.slice(end)
      setBody(next)
      markDirty()
      const caret = start + (caretOffset == null ? text.length : caretOffset)
      // Restore caret/selection after React commits the new value.
      requestAnimationFrame(() => {
        if (!textareaRef.current) return
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(caret, caret)
      })
    },
    // markDirty reads/sets saved+saveError refs that are stable enough; body is
    // the only value we actually splice against.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [body],
  )

  // Insert a directive on its own line. If the caret is mid-line we drop onto a
  // fresh line below; a blank line after keeps it readable. For TRANSPOSE KEY
  // the caret is parked on the editable "±n" so the user can adjust it inline.
  const insertDirective = (directive) => {
    const el = textareaRef.current
    const start = el ? el.selectionStart : body.length
    const atLineStart = start === 0 || body[start - 1] === '\n'
    const prefix = atLineStart ? '' : '\n'
    const line = `${prefix}${directive}\n`
    if (directive === 'TRANSPOSE KEY +1') {
      // Park the caret right after the "+" so "1" is selected-ready to edit.
      const plusIdx = line.indexOf('+')
      spliceIntoBody(line, { caretOffset: plusIdx + 1 })
    } else {
      spliceIntoBody(line)
    }
    setOptionsOpen(false)
  }

  // Wrap the current selection in markup (e.g. <b>…</b>). With no selection,
  // insert the tags with sample text and leave the caret after the open tag so
  // the user can overtype the sample.
  const insertMarkup = (tag, sample) => {
    const el = textareaRef.current
    const start = el ? el.selectionStart : body.length
    const end = el ? el.selectionEnd : body.length
    const selected = body.slice(start, end)
    const inner = selected || sample
    const text = `<${tag}>${inner}</${tag}>`
    if (selected) {
      // Keep the selection wrapped; caret lands after the closing tag.
      spliceIntoBody(text)
    } else {
      // No selection: place caret just after the opening tag, over the sample.
      spliceIntoBody(text, { caretOffset: `<${tag}>`.length })
    }
    setOptionsOpen(false)
  }

  // Insert a chord symbol glyph at the caret.
  const insertSymbol = (sym) => {
    spliceIntoBody(sym)
    setOptionsOpen(false)
  }

  // Revert All Changes — reset the textarea body to the last-loaded body.
  const revertAll = () => {
    setBody(loadedBody)
    markDirty()
    setOptionsOpen(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError('')
    setSaved(false)
    try {
      await saveChart(songId, { enteredKey, body, formatting })
      setLoadedBody(body) // the saved body becomes the new revert target
      setSaved(true)
    } catch (err) {
      setSaveError(errorMessage(err, 'Failed to save chart'))
    } finally {
      setSaving(false)
    }
  }

  // Prefer the live preview's song title/artist (always present on the render
  // response), falling back to the values loaded from getChart. This keeps the
  // header correct even if the initial chart load lacked them.
  const displayTitle = render?.title || title
  const displayArtist = render?.artist || artist

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
            type="button"
            onClick={() => setFormattingOpen(true)}
            disabled={loadingChart}
            className="border border-purple-800/40 hover:bg-[#1e1b2e] disabled:opacity-50 text-gray-200 font-medium py-2 px-4 rounded-lg transition-colors text-sm"
          >
            Formatting
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loadingChart}
            className="bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white font-medium py-2 px-5 rounded-lg transition-colors text-sm"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Song title / artist — READ-ONLY context. These are Song properties,
          not chart-overridable, so they are shown as static labels and are not
          part of the saveChart payload. */}
      <div className="flex items-baseline gap-3 mb-4">
        <span className="text-lg font-bold text-white">{displayTitle || 'Untitled song'}</span>
        {displayArtist && <span className="text-sm text-gray-400">{displayArtist}</span>}
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

            {/* Options menu — directive / markup / chord-symbol inserts and
                Revert All Changes. Inserts act on the textarea caret/selection. */}
            <div className="relative ml-auto" ref={optionsRef}>
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={optionsOpen}
                onClick={() => setOptionsOpen((o) => !o)}
                disabled={loadingChart}
                className="border border-purple-800/40 hover:bg-[#1e1b2e] disabled:opacity-50 text-gray-200 font-medium py-2 px-4 rounded-lg transition-colors text-sm"
              >
                Options ▾
              </button>
              {optionsOpen && (
                <div
                  role="menu"
                  className="absolute right-0 z-20 mt-1 w-56 bg-[#1e1b2e] border border-purple-800/40 rounded-lg shadow-xl py-1 text-sm"
                >
                  <div className="px-3 py-1 text-xs uppercase tracking-wide text-gray-500">Directives</div>
                  <button type="button" role="menuitem" onClick={() => insertDirective('PAGE_BREAK')} className="w-full text-left px-3 py-1.5 text-gray-200 hover:bg-purple-800/30">Page Break</button>
                  <button type="button" role="menuitem" onClick={() => insertDirective('COLUMN_BREAK')} className="w-full text-left px-3 py-1.5 text-gray-200 hover:bg-purple-800/30">Column Break</button>
                  <button type="button" role="menuitem" onClick={() => insertDirective('TRANSPOSE KEY +1')} className="w-full text-left px-3 py-1.5 text-gray-200 hover:bg-purple-800/30">Transpose Key (±n)</button>

                  <div className="border-t border-purple-800/30 my-1" />
                  <div className="px-3 py-1 text-xs uppercase tracking-wide text-gray-500">Markup</div>
                  <button type="button" role="menuitem" onClick={() => insertMarkup('b', 'Bold')} className="w-full text-left px-3 py-1.5 text-gray-200 hover:bg-purple-800/30"><span className="font-bold">Bold</span></button>
                  <button type="button" role="menuitem" onClick={() => insertMarkup('i', 'Italic')} className="w-full text-left px-3 py-1.5 text-gray-200 hover:bg-purple-800/30"><span className="italic">Italic</span></button>

                  <div className="border-t border-purple-800/30 my-1" />
                  <div className="px-3 py-1 text-xs uppercase tracking-wide text-gray-500">Chord Symbols</div>
                  <div className="flex gap-1 px-3 py-1.5">
                    {CHORD_SYMBOLS.map((sym) => (
                      <button
                        key={sym}
                        type="button"
                        role="menuitem"
                        aria-label={`Insert ${sym}`}
                        onClick={() => insertSymbol(sym)}
                        className="w-8 h-8 flex items-center justify-center rounded border border-purple-800/40 text-gray-100 hover:bg-purple-800/30 font-mono text-base"
                      >
                        {sym}
                      </button>
                    ))}
                  </div>

                  <div className="border-t border-purple-800/30 my-1" />
                  <button type="button" role="menuitem" onClick={revertAll} className="w-full text-left px-3 py-1.5 text-red-300 hover:bg-red-900/30">Revert All Changes</button>
                </div>
              )}
            </div>
          </div>
          <textarea
            ref={textareaRef}
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

      {/* Formatting modal — Font / Size / Chord Color / Columns. No This-Chart
          vs Defaults toggle and no Print Settings (design "Frontend — Editor").
          Values bind to `formatting`, which rides along on the next Save. */}
      {formattingOpen && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 px-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setFormattingOpen(false) }}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="formatting-title" className="w-full max-w-md bg-[#17132a] border border-purple-800/40 rounded-xl p-6 shadow-2xl">
            <div className="flex items-center mb-4">
              <h2 id="formatting-title" className="text-lg font-bold text-white">Formatting</h2>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setFormattingOpen(false)}
                className="ml-auto text-gray-400 hover:text-white text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="fmt-font" className={labelCls}>Font</label>
                <select
                  id="fmt-font"
                  value={formatting.font}
                  onChange={(e) => { setFormatting((f) => ({ ...f, font: e.target.value })); markDirty() }}
                  className={inputCls}
                >
                  {FONT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>

              <div>
                <label htmlFor="fmt-size" className={labelCls}>Size</label>
                <select
                  id="fmt-size"
                  value={formatting.size}
                  onChange={(e) => { setFormatting((f) => ({ ...f, size: Number(e.target.value) })); markDirty() }}
                  className={inputCls}
                >
                  {SIZE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label htmlFor="fmt-chord-color" className={labelCls}>Chord Color</label>
                <select
                  id="fmt-chord-color"
                  value={formatting.chordColor}
                  onChange={(e) => { setFormatting((f) => ({ ...f, chordColor: e.target.value })); markDirty() }}
                  className={inputCls}
                >
                  {CHORD_COLOR_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label htmlFor="fmt-columns" className={labelCls}>Columns</label>
                <select
                  id="fmt-columns"
                  value={formatting.columns}
                  onChange={(e) => { setFormatting((f) => ({ ...f, columns: Number(e.target.value) })); markDirty() }}
                  className={inputCls}
                >
                  {COLUMN_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                type="button"
                onClick={() => setFormattingOpen(false)}
                className="bg-purple-700 hover:bg-purple-600 text-white font-medium py-2 px-5 rounded-lg transition-colors text-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
