import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createGig, getGig, updateGig } from '../../api/gigs'
import { listPlaylists } from '../../api/playlists'

const inputCls = 'w-full bg-[#1e1b2e] border border-purple-800/40 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600 text-sm'
const labelCls = 'block text-sm font-medium text-gray-300 mb-1.5'

export default function GigFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(id)
  const [form, setForm] = useState({ name: '', description: '', location: '', date: '', playlist: '' })
  const [playlists, setPlaylists] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    listPlaylists().then(res => setPlaylists(res.data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (isEdit) {
      getGig(id).then(res => {
        const gig = res.data
        setForm({
          name: gig.name || '', description: gig.description || '',
          location: gig.location || '',
          date: gig.date ? new Date(gig.date).toISOString().split('T')[0] : '',
          playlist: gig.playlist?._id || gig.playlist || '',
        })
      }).catch(() => setError('Failed to load gig'))
    }
  }, [id, isEdit])

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      const payload = { ...form, playlist: form.playlist === '' ? null : form.playlist }
      isEdit ? await updateGig(id, payload) : await createGig(payload)
      navigate('/gigs')
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to save gig')
    } finally { setLoading(false) }
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/gigs')} className="text-gray-400 hover:text-white transition-colors text-sm">← Gigs</button>
        <h1 className="text-2xl font-bold text-white">{isEdit ? 'Edit Gig' : 'New Gig'}</h1>
      </div>
      <div className="bg-[#2a2640] border border-purple-800/40 rounded-2xl p-6 shadow-xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="name" className={labelCls}>Name <span className="text-purple-400">*</span></label>
            <input id="name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required className={inputCls} placeholder="Gig name" />
          </div>
          <div>
            <label htmlFor="description" className={labelCls}>Description</label>
            <textarea id="description" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} className={inputCls + ' resize-none'} placeholder="Optional notes" />
          </div>
          <div>
            <label htmlFor="location" className={labelCls}>Location</label>
            <input id="location" value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} className={inputCls} placeholder="Venue or address" />
          </div>
          <div>
            <label htmlFor="date" className={labelCls}>Date <span className="text-purple-400">*</span></label>
            <input id="date" type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} required className={inputCls} />
          </div>
          <div>
            <label htmlFor="playlist" className={labelCls}>Playlist</label>
            <select id="playlist" value={form.playlist} onChange={e => setForm(p => ({ ...p, playlist: e.target.value }))} className={inputCls}>
              <option value="">— None —</option>
              {playlists.map(pl => <option key={pl._id} value={pl._id}>{pl.name}</option>)}
            </select>
          </div>
          {error && <p role="alert" className="text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="flex-1 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors text-sm">
              {loading ? 'Saving...' : 'Save Gig'}
            </button>
            <button type="button" onClick={() => navigate('/gigs')} className="px-4 py-2.5 rounded-lg text-sm text-gray-300 bg-gray-700 hover:bg-gray-600 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
