import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createSong, getSong, updateSong } from '../../api/songs'
import { listGenres } from '../../api/genres'

const MUSICAL_KEYS = [
  '', 'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F',
  'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B',
  'Cm', 'C#m', 'Dm', 'D#m', 'Ebm', 'Em', 'Fm',
  'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bbm', 'Bm'
]

const inputCls = 'w-full bg-[#1e1b2e] border border-purple-800/40 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600 text-sm'
const labelCls = 'block text-sm font-medium text-gray-300 mb-1.5'

export default function SongFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [genres, setGenres] = useState([])
  const [form, setForm] = useState({ title: '', artist: '', genre: '', tags: '', originalKey: '', performedKey: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    listGenres().then(res => setGenres(res.data)).catch(() => {})
    if (isEdit) {
      getSong(id).then(res => {
        const s = res.data
        setForm({ title: s.title || '', artist: s.artist || '', genre: s.genre?._id || '', tags: s.tags?.join(', ') || '', originalKey: s.originalKey || '', performedKey: s.performedKey || '' })
      }).catch(() => setError('Failed to load song'))
    }
  }, [id, isEdit])

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true)
    const payload = {
      title: form.title, artist: form.artist, genre: form.genre || null,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      originalKey: form.originalKey, performedKey: form.performedKey,
    }
    try {
      isEdit ? await updateSong(id, payload) : await createSong(payload)
      navigate('/songs')
    } catch (err) {
      const fields = err.response?.data?.error?.fields
      setError(fields ? Object.values(fields).join(', ') : (err.response?.data?.error?.message || 'Failed to save song'))
    } finally { setLoading(false) }
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/songs')} className="text-gray-400 hover:text-white transition-colors text-sm">← Songs</button>
        <h1 className="text-2xl font-bold text-white">{isEdit ? 'Edit Song' : 'New Song'}</h1>
      </div>
      <div className="bg-[#2a2640] border border-purple-800/40 rounded-2xl p-6 shadow-xl">
        <form onSubmit={handleSubmit} className="space-y-5">
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
            <label htmlFor="tags" className={labelCls}>Tags <span className="text-gray-500 font-normal">(comma-separated)</span></label>
            <input id="tags" name="tags" value={form.tags} onChange={handleChange} className={inputCls} placeholder="e.g. upbeat, crowd-pleaser" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="originalKey" className={labelCls}>Original Key</label>
              <select id="originalKey" name="originalKey" value={form.originalKey} onChange={handleChange} className={inputCls}>
                {MUSICAL_KEYS.map(k => <option key={k} value={k}>{k || '—'}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="performedKey" className={labelCls}>Performed Key</label>
              <select id="performedKey" name="performedKey" value={form.performedKey} onChange={handleChange} className={inputCls}>
                {MUSICAL_KEYS.map(k => <option key={k} value={k}>{k || '—'}</option>)}
              </select>
            </div>
          </div>
          {error && <p role="alert" className="text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="flex-1 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors text-sm">
              {loading ? 'Saving...' : 'Save Song'}
            </button>
            <button type="button" onClick={() => navigate('/songs')} className="px-4 py-2.5 rounded-lg text-sm text-gray-300 bg-gray-700 hover:bg-gray-600 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
