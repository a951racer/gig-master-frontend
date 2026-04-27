import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { getPlaylist, addSong, removeSong, reorderSongs } from '../../api/playlists'
import SongCatalogPanel from '../../components/SongCatalogPanel'

function SortableSongItem({ song, index, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `playlist-${song._id}`,
    data: { song, source: 'playlist' },
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-3 bg-[#2a2640] border border-purple-800/30 rounded-lg px-3 py-2.5 mb-1.5 cursor-grab select-none transition-opacity ${isDragging ? 'opacity-40' : 'hover:border-purple-500/60'}`}
      {...attributes} {...listeners}
    >
      <span className="text-gray-600 text-xs w-5 text-right shrink-0">{index + 1}</span>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate">{song.title}</p>
        <p className="text-gray-400 text-xs truncate">{song.artist}</p>
      </div>
      <button
        onPointerDown={e => e.stopPropagation()}
        onClick={() => onRemove(song)}
        className="text-gray-600 hover:text-red-400 transition-colors text-sm shrink-0"
      >✕</button>
    </div>
  )
}

function PlaylistDropZone({ children, isEmpty }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'playlist-drop-zone' })
  return (
    <div
      ref={setNodeRef}
      className={`flex-1 bg-[#1e1b2e] border-2 rounded-xl p-4 min-h-[400px] transition-colors ${isOver ? 'border-purple-500/80 bg-purple-900/10' : 'border-dashed border-purple-800/40'}`}
    >
      {children}
      {isEmpty && (
        <div className="flex flex-col items-center justify-center h-48 text-gray-600">
          <div className="text-3xl mb-2">🎵</div>
          <p className="text-sm">Drag songs here</p>
        </div>
      )}
    </div>
  )
}

export default function PlaylistDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [playlist, setPlaylist] = useState(null)
  const [playlistSongs, setPlaylistSongs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeItem, setActiveItem] = useState(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => {
    getPlaylist(id)
      .then(res => { setPlaylist(res.data); setPlaylistSongs(res.data.songs || []) })
      .catch(() => setError('Failed to load playlist'))
      .finally(() => setLoading(false))
  }, [id])

  const handleDragStart = ({ active }) => setActiveItem(active.data.current)

  const handleDragEnd = async ({ active, over }) => {
    setActiveItem(null)
    if (!over) return
    const activeData = active.data.current
    const overData = over.data?.current
    const overId = over.id

    if (activeData?.source === 'catalog') {
      const song = activeData.song
      if (playlistSongs.some(s => s._id === song._id)) return
      const prev = [...playlistSongs]
      setPlaylistSongs(p => [...p, song])
      try { await addSong(id, song._id) }
      catch { setPlaylistSongs(prev); setError('Failed to add song') }
      return
    }

    if (activeData?.source === 'playlist' && overId === 'catalog-drop-zone') {
      const song = activeData.song
      const prev = [...playlistSongs]
      setPlaylistSongs(p => p.filter(s => s._id !== song._id))
      try { await removeSong(id, song._id) }
      catch { setPlaylistSongs(prev); setError('Failed to remove song') }
      return
    }

    if (activeData?.source === 'playlist' && overData?.source === 'playlist') {
      const oldIdx = playlistSongs.findIndex(s => `playlist-${s._id}` === active.id)
      const newIdx = playlistSongs.findIndex(s => `playlist-${s._id}` === overId)
      if (oldIdx === newIdx) return
      const newOrder = arrayMove(playlistSongs, oldIdx, newIdx)
      const prev = [...playlistSongs]
      setPlaylistSongs(newOrder)
      try { await reorderSongs(id, newOrder.map(s => s._id)) }
      catch { setPlaylistSongs(prev); setError('Failed to reorder songs') }
    }
  }

  const handleRemove = async (song) => {
    const prev = [...playlistSongs]
    setPlaylistSongs(p => p.filter(s => s._id !== song._id))
    try { await removeSong(id, song._id) }
    catch { setPlaylistSongs(prev); setError('Failed to remove song') }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>
  if (!playlist) return <div className="text-center py-16 text-gray-500">Playlist not found</div>

  const playlistSongIds = playlistSongs.map(s => s._id)

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/playlists')} className="text-gray-400 hover:text-white transition-colors text-sm">← Playlists</button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">{playlist.name}</h1>
          {playlist.description && <p className="text-gray-400 text-sm mt-0.5">{playlist.description}</p>}
        </div>
        <button onClick={() => navigate(`/playlists/new?edit=${id}`)} className="text-sm text-purple-400 hover:text-purple-300 border border-purple-800/40 px-3 py-1.5 rounded-lg transition-colors">
          Edit Details
        </button>
      </div>

      {error && <p role="alert" className="text-red-400 text-sm mb-4 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">{error}</p>}

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 items-start">
          <PlaylistDropZone isEmpty={playlistSongs.length === 0}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-300">Set List</h3>
              <span className="text-xs text-gray-500 bg-[#2a2640] px-2 py-0.5 rounded-full">{playlistSongs.length} songs</span>
            </div>
            <SortableContext items={playlistSongs.map(s => `playlist-${s._id}`)} strategy={verticalListSortingStrategy}>
              {playlistSongs.map((song, i) => (
                <SortableSongItem key={song._id} song={song} index={i} onRemove={handleRemove} />
              ))}
            </SortableContext>
          </PlaylistDropZone>

          <SongCatalogPanel excludeIds={playlistSongIds} droppable />
        </div>

        <DragOverlay>
          {activeItem && (
            <div className="bg-purple-800 border border-purple-500 rounded-lg px-3 py-2 shadow-xl opacity-90 text-sm text-white">
              {activeItem.song?.title} — {activeItem.song?.artist}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
