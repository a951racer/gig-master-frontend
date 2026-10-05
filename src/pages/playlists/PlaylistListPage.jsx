import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listPlaylists, deletePlaylist, getPlaylist, createPlaylist } from '../../api/playlists'
import ConfirmDialog from '../../components/ConfirmDialog'
import { useBand } from '../../auth/BandContext'
import NoBandPrompt from '../bands/NoBandPrompt'

export default function PlaylistListPage() {
  const navigate = useNavigate()
  const { currentBand, hasNoBand } = useBand()
  const [playlists, setPlaylists] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [copySource, setCopySource] = useState(null)

  useEffect(() => {
    if (hasNoBand) return
    setLoading(true)
    setError('')
    listPlaylists()
      .then(res => setPlaylists(res.data))
      .catch(() => setError('Failed to load setlists'))
      .finally(() => setLoading(false))
  }, [hasNoBand, currentBand?.id])

  const handleDelete = async (playlist) => {
    try {
      await deletePlaylist(playlist._id)
      setPlaylists(prev => prev.filter(p => p._id !== playlist._id))
    } catch { setError('Failed to delete setlist') }
    finally { setConfirmDelete(null) }
  }

  // Copy a playlist: fetch the source's songs, then create a new playlist with
  // the chosen name/description and the same songs (one atomic POST), and open
  // the new playlist. Throws on failure so the modal can surface the message
  // in-dialog (e.g. a duplicate-name 409) and let the user fix the name.
  const handleCopy = async ({ name, description }) => {
    const source = copySource
    const res = await getPlaylist(source._id)
    // songs are { song: <populated song>, playedKey } entries; carry both the
    // song id and its played key across to the copy. Tolerate legacy/bare-id
    // shapes defensively.
    const songs = (res.data.songs || []).map(sg => {
      if (sg && typeof sg === 'object' && sg.song) {
        const songId = typeof sg.song === 'string' ? sg.song : sg.song._id
        return { song: songId, playedKey: sg.playedKey || '' }
      }
      return typeof sg === 'string' ? sg : sg._id
    })
    const created = await createPlaylist({ name, description, songs })
    setCopySource(null)
    navigate(`/playlists/${created.data._id}`)
  }

  if (hasNoBand) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <NoBandPrompt />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Setlists</h1>
        <Link to="/playlists/new">
          <button className="bg-purple-700 hover:bg-purple-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            + New Setlist
          </button>
        </Link>
      </div>

      {error && <p role="alert" className="text-red-400 text-sm mb-4">{error}</p>}

      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : playlists.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <div className="text-4xl mb-3">🎼</div>
          <p>No setlists yet. Create your first setlist!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {playlists.map(p => (
            <div key={p._id} className="bg-[#2a2640] border border-purple-800/30 rounded-xl px-5 py-4 flex items-center gap-4 hover:border-purple-600/50 transition-colors">
              <div className="flex-1 min-w-0">
                <Link to={`/playlists/${p._id}`} className="font-semibold text-white hover:text-purple-300 transition-colors">
                  {p.name}
                </Link>
                {p.description && <p className="text-gray-400 text-sm mt-0.5 truncate">{p.description}</p>}
              </div>
              <span className="text-xs text-gray-500 bg-[#1e1b2e] px-2.5 py-1 rounded-full whitespace-nowrap">
                {p.songCount ?? p.songs?.length ?? 0} songs
              </span>
              <div className="flex gap-2">
                <button onClick={() => navigate(`/playlists/new?edit=${p._id}`)} className="text-xs text-purple-400 hover:text-purple-300 transition-colors px-2 py-1">Edit</button>
                <button onClick={() => setCopySource(p)} className="text-xs text-gray-300 hover:text-white transition-colors px-2 py-1">Copy</button>
                <button onClick={() => setConfirmDelete(p)} className="text-xs text-red-400 hover:text-red-300 transition-colors px-2 py-1">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          message={`Delete setlist "${confirmDelete.name}"?`}
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {copySource && (
        <CopyPlaylistModal
          source={copySource}
          onCopy={handleCopy}
          onCancel={() => setCopySource(null)}
        />
      )}
    </div>
  )
}

// Modal to copy a playlist — prefilled with "Copy of <name>" and the source
// description. The songs are carried over by the parent on confirm.
function CopyPlaylistModal({ source, onCopy, onCancel }) {
  const [name, setName] = useState(`Copy of ${source.name}`)
  // A copied playlist is flagged as a duplicate in its description.
  const [description, setDescription] = useState('** Duplicate **')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const inputCls = 'w-full bg-[#1e1b2e] border border-purple-800/40 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600 text-sm'

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!name.trim()) { setError('Name is required.'); return }
    setSaving(true)
    try {
      await onCopy({ name: name.trim(), description: description.trim() })
    } catch (err) {
      const code = err?.response?.data?.error?.code
      if (code === 'DUPLICATE_NAME') {
        setError('Setlist names must be unique within your band. Please choose a different name.')
      } else {
        setError(err?.response?.data?.error?.message || 'Failed to copy setlist.')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div role="dialog" aria-modal="true" aria-label="Copy setlist" className="w-full max-w-md bg-[#2a2640] border border-purple-800/50 rounded-2xl p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-white mb-4">Copy setlist</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="text-sm text-gray-300">
            Name
            <input aria-label="New setlist name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls + ' mt-1'} autoFocus />
          </label>
          <label className="text-sm text-gray-300">
            Description
            <input aria-label="New setlist description" value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls + ' mt-1'} />
          </label>
          {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
          <div className="flex items-center gap-3 mt-1">
            <button type="submit" disabled={saving} className="bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              {saving ? 'Copying…' : 'Copy setlist'}
            </button>
            <button type="button" onClick={onCancel} className="text-sm text-gray-400 hover:text-white px-3 py-2">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}
