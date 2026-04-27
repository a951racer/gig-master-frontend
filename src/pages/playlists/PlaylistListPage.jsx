import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listPlaylists, deletePlaylist } from '../../api/playlists'
import ConfirmDialog from '../../components/ConfirmDialog'

export default function PlaylistListPage() {
  const navigate = useNavigate()
  const [playlists, setPlaylists] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)

  useEffect(() => {
    listPlaylists()
      .then(res => setPlaylists(res.data))
      .catch(() => setError('Failed to load playlists'))
      .finally(() => setLoading(false))
  }, [])

  const handleDelete = async (playlist) => {
    try {
      await deletePlaylist(playlist._id)
      setPlaylists(prev => prev.filter(p => p._id !== playlist._id))
    } catch { setError('Failed to delete playlist') }
    finally { setConfirmDelete(null) }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Playlists</h1>
        <Link to="/playlists/new">
          <button className="bg-purple-700 hover:bg-purple-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            + New Playlist
          </button>
        </Link>
      </div>

      {error && <p role="alert" className="text-red-400 text-sm mb-4">{error}</p>}

      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : playlists.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <div className="text-4xl mb-3">🎼</div>
          <p>No playlists yet. Create your first set list!</p>
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
                <button onClick={() => setConfirmDelete(p)} className="text-xs text-red-400 hover:text-red-300 transition-colors px-2 py-1">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          message={`Delete playlist "${confirmDelete.name}"?`}
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
