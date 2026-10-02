import { useRef, useState, useLayoutEffect } from 'react'

// Shared chart page renderer.
//
// Renders the server-computed `pages` structure (pages -> columns -> lines)
// as virtual US-Letter portrait pages. Used by BOTH the on-screen viewer
// (ChartViewerPage) and the editor live preview (ChartEditorPage) so the two
// surfaces look identical and column/page breaks match exactly.
//
// The server resolves PAGE_BREAK / COLUMN_BREAK into the pages/columns
// structure, so those directives NEVER arrive here as visible lines. Each line
// in a column is one of:
//   { header: { label, repeat } }                              — section header
//   { segments: [{chord, lyric}], directive, transposeShift }  — content/blank
//   { directive: 'TRANSPOSE_KEY', transposeShift }             — transpose marker
//
// Rendering mode:
//   - default: pages render at true size (816px wide) — used by the viewer.
//   - fitToWidth: pages are scaled down with a CSS transform to fit the
//     container's width, and the wrapper RESERVES the scaled height so the
//     page doesn't float or overflow — used by the editor's narrow preview
//     panel. (A naive `transform: scale()` without reserving height leaves the
//     element occupying its full un-scaled box, which looked broken.)

// Virtual US-Letter portrait page at 96dpi: 8.5in × 11in → 816px × 1056px.
export const PAGE_WIDTH = 816
export const PAGE_HEIGHT = 1056
const PAGE_PADDING = 48
const BANNER_HEIGHT = 72 // ~0.75in shaded banner on page 1

const CHORD_COLORS = {
  blue: '#2563eb',
  red: '#dc2626',
  green: '#16a34a',
  orange: '#ea580c',
  purple: '#9333ea',
  black: '#111827',
}
export function resolveChordColor(token) {
  if (!token) return CHORD_COLORS.blue
  return CHORD_COLORS[token] || token
}

// Render a chord as ROOT + superscript QUALITY (+ optional /BASS). On a number
// chart "45" (degree 4, quality "5") is ambiguous, so the quality/extension is
// superscripted to visually separate it from the degree. `root`/`quality`/
// `bass` come parsed from the API; we fall back to the raw `chord` text when
// they are absent (e.g. an unparseable verbatim token).
function ChordText({ chord, root, quality, bass }) {
  // Unparseable / plain token: render the raw text.
  if (root == null && !quality && !bass) {
    return <>{chord || '\u00A0'}</>
  }
  return (
    <>
      {root}
      {quality ? <sup className="text-[0.7em] font-semibold">{quality}</sup> : null}
      {bass ? <span>/{bass}</span> : null}
    </>
  )
}

// A single rendered segment: chord stacked above its lyric, monospaced so the
// chord stays glued to the start of the syllable it sits over. whitespace-pre
// preserves spacing; the segments do NOT wrap (a line is one horizontal run)
// so chord/lyric alignment never breaks mid-line. A trailing space is appended
// to the CHORD so that when a chord is wider than its (often single-space)
// lyric — e.g. a chord-only INTRO line — adjacent chords never collide.
function Segment({ chord, root, quality, bass, lyric, chordColor }) {
  const hasChord = (chord && chord.length) || root
  return (
    <span className="inline-flex flex-col align-top whitespace-pre leading-none">
      <span className="font-semibold pb-0.5" style={{ color: chordColor }}>
        {hasChord ? (
          <>
            <ChordText chord={chord} root={root} quality={quality} bass={bass} />
            {'\u00A0'}
          </>
        ) : (
          '\u00A0'
        )}
      </span>
      <span className="text-gray-900">{lyric || '\u00A0'}</span>
    </span>
  )
}

function Line({ line, chordColor }) {
  if (line.header) {
    return (
      <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 mt-3 mb-1 first:mt-0">
        {line.header.label}
        {line.header.repeat ? <span className="ml-2 text-gray-500">x{line.header.repeat}</span> : null}
      </h3>
    )
  }

  if (line.directive === 'TRANSPOSE_KEY') {
    const sign = line.transposeShift != null && line.transposeShift >= 0 ? '+' : ''
    const label =
      line.transposeShift != null ? `TRANSPOSE KEY ${sign}${line.transposeShift}` : 'TRANSPOSE KEY'
    return (
      <div className="my-1.5 flex items-center gap-2 text-[10px] uppercase tracking-widest text-gray-500">
        <span className="h-px flex-1 bg-gray-300" />
        <span>{label}</span>
        <span className="h-px flex-1 bg-gray-300" />
      </div>
    )
  }

  const segments = line.segments || []
  const isBlank = segments.length === 0 || segments.every((s) => !s.chord && !s.lyric)
  if (isBlank) {
    return <div className="h-4" aria-hidden="true" />
  }

  // One line is a single non-wrapping horizontal run of chord/lyric segments.
  return (
    <div className="flex items-start whitespace-pre">
      {segments.map((seg, i) => (
        <Segment key={i} chord={seg.chord} root={seg.root} quality={seg.quality} bass={seg.bass} lyric={seg.lyric} chordColor={chordColor} />
      ))}
    </div>
  )
}

function Column({ column, chordColor }) {
  return (
    <div className="flex-1 min-w-0">
      {(column.lines || []).map((line, i) => (
        <Line key={i} line={line} chordColor={chordColor} />
      ))}
    </div>
  )
}

// Page 1 banner header: shaded block with "Title [Key]" and "[Artist]".
function BannerHeader({ title, artist, keyLabel }) {
  return (
    <div
      className="bg-gray-200 rounded px-5 flex flex-col justify-center mb-6"
      style={{ minHeight: `${BANNER_HEIGHT}px` }}
    >
      <div className="text-2xl font-bold text-gray-900 leading-tight">
        {title} [{keyLabel}]
      </div>
      {artist ? <div className="text-base font-bold text-gray-700 leading-tight">[{artist}]</div> : null}
    </div>
  )
}

// Pages 2+ condensed header: smaller "Title [Key]", no shaded banner.
function CondensedHeader({ title, keyLabel }) {
  return (
    <div className="mb-4 border-b border-gray-300 pb-2">
      <div className="font-bold text-gray-900 leading-tight text-lg">
        {title} [{keyLabel}]
      </div>
    </div>
  )
}

// A single virtual US-Letter page.
function ChartPage({ page, index, title, artist, keyLabel, chordColor, columnGap }) {
  const columns = page.columns || []
  return (
    <div
      className="bg-white text-gray-900 shadow-lg border border-gray-300"
      style={{
        width: `${PAGE_WIDTH}px`,
        minHeight: `${PAGE_HEIGHT}px`,
        padding: `${PAGE_PADDING}px`,
      }}
    >
      {index === 0 ? (
        <BannerHeader title={title} artist={artist} keyLabel={keyLabel} />
      ) : (
        <CondensedHeader title={title} keyLabel={keyLabel} />
      )}

      <div className="flex" style={{ gap: `${columnGap}px` }}>
        {columns.map((column, i) => (
          <Column key={i} column={column} chordColor={chordColor} />
        ))}
      </div>
    </div>
  )
}

// Wrap a true-size (816px) page and scale it to the measured container width.
// The outer box reserves the SCALED height so the page occupies the right
// amount of vertical space and stays left-anchored (no floating).
function FitToWidth({ children }) {
  const ref = useRef(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const w = el.clientWidth
      if (w > 0) setScale(Math.min(1, w / PAGE_WIDTH))
    }
    measure()
    // ResizeObserver keeps the scale correct as the panel resizes. Guard for
    // environments that lack it (e.g. jsdom in tests) by falling back to a
    // window resize listener; either way we always measure once up front.
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure)
      ro.observe(el)
      return () => ro.disconnect()
    }
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  return (
    <div ref={ref} className="w-full">
      <div style={{ height: `${PAGE_HEIGHT * scale}px` }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: `${PAGE_WIDTH}px` }}>
          {children}
        </div>
      </div>
    </div>
  )
}

// Render a full chart `representation` ({ title, artist, keyLabel, formatting,
// pages }) as stacked virtual pages.
//
// Props:
//   representation : the chart render representation.
//   fitToWidth     : when true, scale each page down to the container width
//                    (editor preview). When false, render at true 816px size
//                    centered (viewer).
export default function ChartPages({ representation, fitToWidth = false }) {
  if (!representation) return null
  const { title = '', artist = '', keyLabel = 'Numbers', formatting = {}, pages = [] } = representation

  const chordColor = resolveChordColor(formatting.chordColor)
  const fontFamily =
    formatting.font && formatting.font !== 'monospace' ? `${formatting.font}, monospace` : 'monospace'
  const baseSize = formatting.size
  const fontSize = baseSize ? `${baseSize}pt` : undefined
  const columnGap = 24

  if (pages.length === 0) {
    return <p className="text-gray-500 text-sm">This chart is empty.</p>
  }

  const renderedPages = pages.map((page, i) => (
    <div key={i} style={{ fontFamily, fontSize }}>
      <ChartPage
        page={page}
        index={i}
        title={title}
        artist={artist}
        keyLabel={keyLabel}
        chordColor={chordColor}
        columnGap={columnGap}
      />
    </div>
  ))

  if (fitToWidth) {
    return (
      <div className="flex flex-col gap-6">
        {renderedPages.map((p, i) => (
          <FitToWidth key={i}>{p}</FitToWidth>
        ))}
      </div>
    )
  }

  return <div className="flex flex-col items-center gap-8">{renderedPages}</div>
}
