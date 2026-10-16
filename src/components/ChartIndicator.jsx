// Small inline indicator shown after a song title when the song has a chart
// entered. Rendered only by callers that have already checked `song.hasChart`.
// A document-with-lines glyph (a "chart/sheet" affordance), muted purple so it
// reads as a quiet badge next to the title. Accessible via title + aria-label.
export default function ChartIndicator({ className = '' }) {
  return (
    <span
      className={`inline-flex items-center text-purple-400 ${className}`}
      title="Chart entered"
      aria-label="Chart entered"
      role="img"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {/* sheet of music: a page with staff-ish lines */}
        <path d="M4 3h11l5 5v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
        <path d="M14 3v5h5" />
        <path d="M8 13h8" />
        <path d="M8 17h8" />
      </svg>
    </span>
  )
}
