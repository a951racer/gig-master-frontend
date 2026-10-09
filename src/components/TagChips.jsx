// Display a song's tags as chips (read-only). Renders nothing-but-a-dash when
// there are no tags, so callers can drop it straight into a cell/field.
export default function TagChips({ tags, emptyText = '—', className = '' }) {
  const list = Array.isArray(tags) ? tags.filter(Boolean) : []
  if (list.length === 0) {
    return <span className="text-gray-600">{emptyText}</span>
  }
  return (
    <span className={`inline-flex flex-wrap gap-1 ${className}`}>
      {list.map((tag) => (
        <span
          key={tag}
          className="bg-purple-900/40 border border-purple-500/40 text-gray-200 text-xs px-2 py-0.5 rounded-full"
        >
          {tag}
        </span>
      ))}
    </span>
  )
}
