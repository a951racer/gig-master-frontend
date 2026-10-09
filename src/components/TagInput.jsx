import { useState } from 'react'

// Chip-based tag entry. Operates on an array of strings: type a tag and press
// Enter or comma to add it as a chip; click a chip's × to remove it; Backspace
// on an empty input removes the last chip. Duplicates (case-insensitive) and
// blank entries are ignored.
export default function TagInput({ value = [], onChange, id = 'tags', placeholder = 'Add a tag…' }) {
  const [draft, setDraft] = useState('')
  const tags = Array.isArray(value) ? value : []

  const commit = (raw) => {
    const t = raw.trim()
    if (!t) return
    if (tags.some((x) => x.toLowerCase() === t.toLowerCase())) { setDraft(''); return }
    onChange?.([...tags, t])
    setDraft('')
  }

  const removeAt = (i) => onChange?.(tags.filter((_, idx) => idx !== i))

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit(draft)
    } else if (e.key === 'Backspace' && draft === '' && tags.length) {
      e.preventDefault()
      removeAt(tags.length - 1)
    }
  }

  return (
    <div className="w-full bg-[#1e1b2e] border border-purple-800/40 rounded-lg px-2 py-2 focus-within:ring-2 focus-within:ring-purple-600">
      <div className="flex flex-wrap gap-1.5 items-center">
        {tags.map((tag, i) => (
          <span
            key={`${tag}-${i}`}
            className="inline-flex items-center gap-1 bg-[#1e1b2e] border border-purple-800/40 text-gray-300 text-xs px-2 py-0.5 rounded-full"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeAt(i)}
              aria-label={`Remove ${tag}`}
              className="text-gray-500 hover:text-white leading-none"
            >
              ×
            </button>
          </span>
        ))}
        <input
          id={id}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => commit(draft)}
          placeholder={tags.length ? '' : placeholder}
          className="flex-1 min-w-[8rem] bg-transparent px-1 py-0.5 text-white placeholder-gray-500 focus:outline-none text-sm"
        />
      </div>
    </div>
  )
}
