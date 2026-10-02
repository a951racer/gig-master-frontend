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

// A single rendered segment: chord stacked above its lyric, monospaced so the
// chord stays glued to the start of the syllable it sits over.
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

function Line({ line, chordColor }) {
  if (line.header) {
    return (
      <h3 className="text-xs font-bold uppercase tracking-wider text-purple-700 mt-3 mb-1.5 first:mt-0">
        {line.header.label}
        {line.header.repeat ? <span className="ml-2 text-purple-500">x{line.header.repeat}</span> : null}
      </h3>
    )
  }

  if (line.directive === 'TRANSPOSE_KEY') {
    const sign = line.transposeShift != null && line.transposeShift >= 0 ? '+' : ''
    const label =
      line.transposeShift != null ? `TRANSPOSE KEY ${sign}${line.transposeShift}` : 'TRANSPOSE KEY'
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

// A single virtual US-Letter page.
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

// Render a full chart `representation` ({ title, artist, keyLabel, formatting,
// pages }) as stacked virtual pages. `scale` optionally shrinks the pages to
// fit a narrower container (e.g. the editor's right panel) via CSS transform.
export default function ChartPages({ representation, scale = 1 }) {
  if (!representation) return null
  const { title = '', artist = '', keyLabel = 'Numbers', formatting = {}, pages = [] } = representation

  const chordColor = resolveChordColor(formatting.chordColor)
  const fontFamily =
    formatting.font && formatting.font !== 'monospace' ? `${formatting.font}, monospace` : 'monospace'
  const baseSize = formatting.size
  const fontSize = baseSize ? `${baseSize}pt` : undefined

  if (pages.length === 0) {
    return <p className="text-gray-500 text-sm">This chart is empty.</p>
  }

  const scaledWrapper = scale !== 1
    ? { transform: `scale(${scale})`, transformOrigin: 'top center', width: `${PAGE_WIDTH}px` }
    : undefined

  return (
    <div className="flex flex-col items-center gap-8">
      {pages.map((page, i) => (
        <div key={i} style={{ fontFamily, fontSize }}>
          <div style={scaledWrapper}>
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
        </div>
      ))}
    </div>
  )
}
