import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listSongs, deleteSong } from '../../api/songs'
import { listGenres } from '../../api/genres'
import ConfirmDialog from '../../components/ConfirmDialog'

const inputCls = 'bg-[#1e1b2e] border border-purple-800/40 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600 text-sm'
const selectCls = inputCls

export default function SongListPage() {
  const navigate = useNavigate()
  const [songs, setSongs] = useState([])
  const [genres, setGenres] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [titleFilter, setTitleFilter] = useState('')
  const [genreFilter, setGenreFilter] = useState('')
  const [tagsFilter, setTagsFilter] = useState('')
  const [sortField, setSortField] = useState('title')
  const [sortDir, setSortDir] = useState('asc')
  const [confirmDelete, setConfirmDelete] = useState(null)

  useEffect(() => {
    listGenres().then(res => setGenres(res.data)).catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = {}
    if (titleFilter) params.title = titleFilter
    if (genreFilter) params.genre = genreFilter
    if (tagsFilter) params.tags = tagsFilter
    listSongs(params)
      .then(res => {
        let data = [...res.data].sort((a, b) => {
          const aVal = sortField === 'genre' ? (a.genre?.name || '') : (a[sortField] || '')
          const bVal = sortField === 'genre' ? (b.genre?.name || '') : (b[sortField] || '')
          return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
        })
        setSongs(data); setError('')
      })
      .catch(() => setError('Failed to load songs'))
      .finally(() => setLoading(false))
  }, [titleFilter, genreFilter, tagsFilter, sortField, sortDir])

  const handleDelete = async (song) => {
    try {
      await deleteSong(song._id)
      setSongs(prev => prev.filter(s => s._id !== song._id))
    } catch { setError('Failed to delete song') }
    finally { setConfirmDelete(null) }
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Songs</h1>
        <Link to="/songs/new">
          <button className="bg-purple-700 hover:bg-purple-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            + New Song
          </button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6 bg-[#2a2640] border border-purple-800/30 rounded-xl p-4">
        <input className={inputCls} placeholder="Search by title" value={titleFilter} onChange={e => setTitleFilter(e.target.value)} />
        <select className={selectCls} value={genreFilter} onChange={e => setGenreFilter(e.target.value)}>
          <option value="">All genres</option>
          {genres.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
        </select>
        <input className={inputCls} placeholder="Tags (comma-separated)" value={tagsFilter} onChange={e => setTagsFilter(e.target.value)} />
        <select className={selectCls} value={sortField} onChange={e => setSortField(e.target.value)}>
          <option value="title">Sort: Title</option>
          <option value="artist">Sort: Artist</option>
          <option value="genre">Sort: Genre</option>
        </select>
        <select className={selectCls} value={sortDir} onChange={e => setSortDir(e.target.value)}>
          <option value="asc">↑ Asc</option>
          <option value="desc">↓ Desc</option>
        </select>
      </div>

      {error && <p role="alert" className="text-red-400 text-sm mb-4">{error}</p>}

      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : songs.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <div className="text-4xl mb-3">🎵</div>
          <p>No songs found. Add your first song!</p>
        </div>
      ) : (
        <div className="bg-[#2a2640] border border-purple-800/30 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-purple-800/30 text-gray-400 text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3">Title</th>
                <th className="text-left px-4 py-3">Artist</th>
                <th className="text-left px-4 py-3">Genre</th>
                <th className="text-left px-4 py-3">Tags</th>
                <th className="text-left px-4 py-3">Key</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {songs.map((song, i) => (
                <tr key={song._id} className={`border-b border-purple-900/20 hover:bg-purple-900/10 transition-colors ${i % 2 === 0 ? '' : 'bg-[#1e1b2e]/30'}`}>
                  <td className="px-4 py-3 font-medium text-white">{song.title}</td>
                  <td className="px-4 py-3 text-gray-300">{song.artist}</td>
                  <td className="px-4 py-3">
                    {song.genre?.name
                      ? <span className="bg-purple-900/40 text-purple-300 text-xs px-2 py-0.5 rounded-full">{song.genre.name}</span>
                      : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{song.tags?.join(', ') || '—'}</td>
                  <td className="px-4 py-3 text-gray-400">{song.performedKey || song.originalKey || '—'}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button onClick={() => navigate(`/songs/${song._id}/edit`)} className="text-xs text-purple-400 hover:text-purple-300 transition-colors">Edit</button>
                    <button onClick={() => setConfirmDelete(song)} className="text-xs text-red-400 hover:text-red-300 transition-colors">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          message={`Delete "${confirmDelete.title}"?`}
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
