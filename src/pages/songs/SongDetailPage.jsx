import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getSong, updateSong } from '../../api/songs'
import { listGenres } from '../../api/genres'
import { useBand } from '../../auth/BandContext'
import TagInput from '../../components/TagInput'
import TagChips from '../../components/TagChips'

// Song Detail page (/songs/:id). Read-only by default; a pencil toggles inline
// edit mode (same fields + save as the create form). Also offers chart
// affordances (view / edit the song's chart). Performed Key is intentionally
// NOT shown — it's no longer a song attribute (played key lives on playlists).
const MUSICAL_KEYS = [
  '', 'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F',
  'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B',
  'Cm', 'C#m', 'Dm', 'D#m', 'Ebm', 'Em', 'Fm',
  'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bbm', 'Bm',
]

const inputCls = 'w-full bg-[#1e1b2e] border border-purple-800/40 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600 text-sm'
const labelCls = 'block text-sm font-medium text-gray-300 mb-1.5'

// A labeled read-only field value.
function ReadField({ label, children }) {
  return (
    <div>
      <div className={labelCls}>{label}</div>
      <div className="text-white text-sm bg-[#1e1b2e] border border-purple-800/30 rounded-lg px-3 py-2.5 min-h-[2.6rem]">
        {children}
      </div>
    </div>
  )
}

export default function SongDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentBand } = useBand()

  const [song, setSong] = useState(null)
  const [genres, setGenres] = useState([])
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ title: '', artist: '', genre: '', tags: [], originalKey: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    listGenres().then(res => setGenres(res.data)).catch(() => {})
  }, [currentBand?.id])

  // Load the song and seed the edit form from it.
  useEffect(() => {
    setLoading(true)
    setError('')
    getSong(id)
      .then(res => { setSong(res.data); seedForm(res.data) })
      .catch(() => setError('Failed to load song'))
      .finally(() => setLoading(false))
  }, [id, currentBand?.id])

  const seedForm = (s) => setForm({
    title: s.title || '',
    artist: s.artist || '',
    genre: s.genre?._id || '',
    tags: s.tags || [],
    originalKey: s.originalKey || '',
  })

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))

  const startEdit = () => { seedForm(song); setError(''); setEditing(true) }
  const cancelEdit = () => { seedForm(song); setError(''); setEditing(false) }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true); setError('')
    const payload = {
      title: form.title,
      artist: form.artist,
      genre: form.genre || null,
      tags: form.tags,
      originalKey: form.originalKey,
    }
    try {
      const res = await updateSong(id, payload)
      setSong(res.data)
      seedForm(res.data)
      setEditing(false)
    } catch (err) {
      const fields = err.response?.data?.error?.fields
      setError(fields ? Object.values(fields).join(', ') : (err.response?.data?.error?.message || 'Failed to save song'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>
  if (!song) return <div className="text-center py-16 text-gray-500">{error || 'Song not found'}</div>

  const genreName = song.genre?.name

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      {/* Header: back, title, edit toggle */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/songs')} className="text-gray-400 hover:text-white transition-colors text-sm">← Songs</button>
        <h1 className="text-2xl font-bold text-white flex-1 truncate">{song.title}</h1>
        {!editing && (
          <button
            type="button"
            onClick={startEdit}
            aria-label="Edit song"
            title="Edit song"
            className="text-gray-300 hover:text-white border border-purple-800/40 hover:bg-[#1e1b2e] rounded-lg p-2 transition-colors"
          >
            {/* pencil icon */}
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </button>
        )}
      </div>

      {/* Chart affordances */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => navigate(`/songs/${id}/chart`)} className="text-sm text-purple-300 hover:text-white border border-purple-800/40 hover:bg-[#1e1b2e] px-3 py-1.5 rounded-lg transition-colors">
          View Chart
        </button>
        <button onClick={() => navigate(`/songs/${id}/chart/edit`)} className="text-sm text-purple-300 hover:text-white border border-purple-800/40 hover:bg-[#1e1b2e] px-3 py-1.5 rounded-lg transition-colors">
          Edit Chart
        </button>
      </div>

      {error && <p role="alert" className="text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2 mb-4">{error}</p>}

      <div className="bg-[#2a2640] border border-purple-800/40 rounded-2xl p-6 shadow-xl">
        {editing ? (
          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label htmlFor="title" className={labelCls}>Title <span className="text-purple-400">*</span></label>
              <input id="title" name="title" value={form.title} onChange={handleChange} required className={inputCls} placeholder="Song title" />
            </div>
            <div>
              <label htmlFor="artist" className={labelCls}>Artist <span className="text-purple-400">*</span></label>
              <input id="artist" name="artist" value={form.artist} onChange={handleChange} required className={inputCls} placeholder="Artist name" />
            </div>
            <div>
              <label htmlFor="genre" className={labelCls}>Genre</label>
              <select id="genre" name="genre" value={form.genre} onChange={handleChange} className={inputCls}>
                <option value="">No genre</option>
                {genres.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="tags" className={labelCls}>Tags</label>
              <TagInput id="tags" value={form.tags} onChange={(tags) => setForm(prev => ({ ...prev, tags }))} placeholder="e.g. upbeat, crowd-pleaser" />
            </div>
            <div>
              <label htmlFor="originalKey" className={labelCls}>Original Key</label>
              <select id="originalKey" name="originalKey" value={form.originalKey} onChange={handleChange} className={inputCls}>
                {MUSICAL_KEYS.map(k => <option key={k} value={k}>{k || '—'}</option>)}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving} className="flex-1 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors text-sm">
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button type="button" onClick={cancelEdit} className="px-4 py-2.5 rounded-lg text-sm text-gray-300 bg-gray-700 hover:bg-gray-600 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-5">
            <ReadField label="Title">{song.title}</ReadField>
            <ReadField label="Artist">{song.artist}</ReadField>
            <ReadField label="Genre">
              {genreName
                ? <span className="bg-purple-900/40 text-purple-300 text-xs px-2 py-0.5 rounded-full">{genreName}</span>
                : <span className="text-gray-600">—</span>}
            </ReadField>
            <ReadField label="Tags">
              <TagChips tags={song.tags} />
            </ReadField>
            <ReadField label="Original Key">{song.originalKey || <span className="text-gray-600">—</span>}</ReadField>
          </div>
        )}
      </div>
    </div>
  )
}
