import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { createPlaylist, getPlaylist, updatePlaylist } from '../../api/playlists'

const inputCls = 'w-full bg-[#1e1b2e] border border-purple-800/40 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600 text-sm'
const labelCls = 'block text-sm font-medium text-gray-300 mb-1.5'

export default function PlaylistFormPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit')
  const isEdit = Boolean(editId)
  const [form, setForm] = useState({ name: '', description: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isEdit) {
      getPlaylist(editId)
        .then(res => setForm({ name: res.data.name, description: res.data.description || '' }))
        .catch(() => setError('Failed to load playlist'))
    }
  }, [editId, isEdit])

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      isEdit ? await updatePlaylist(editId, form) : await createPlaylist(form)
      navigate('/playlists')
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to save playlist')
    } finally { setLoading(false) }
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/playlists')} className="text-gray-400 hover:text-white transition-colors text-sm">← Playlists</button>
        <h1 className="text-2xl font-bold text-white">{isEdit ? 'Edit Playlist' : 'New Playlist'}</h1>
      </div>
      <div className="bg-[#2a2640] border border-purple-800/40 rounded-2xl p-6 shadow-xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="name" className={labelCls}>Name <span className="text-purple-400">*</span></label>
            <input id="name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required className={inputCls} placeholder="Set list name" />
          </div>
          <div>
            <label htmlFor="description" className={labelCls}>Description</label>
            <textarea id="description" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} className={inputCls + ' resize-none'} placeholder="Optional description" />
          </div>
          {error && <p role="alert" className="text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="flex-1 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors text-sm">
              {loading ? 'Saving...' : 'Save Playlist'}
            </button>
            <button type="button" onClick={() => navigate('/playlists')} className="px-4 py-2.5 rounded-lg text-sm text-gray-300 bg-gray-700 hover:bg-gray-600 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
