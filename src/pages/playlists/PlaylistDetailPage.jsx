import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { getPlaylist, addSong, removeSong, reorderSongs, setPlayedKey } from '../../api/playlists'
import SongCatalogPanel from '../../components/SongCatalogPanel'
import { useBand } from '../../auth/BandContext'

// The playlist's `songs` is a subdocument array: each entry is
// { song: <populated song>, playedKey }. Played Key is the key THIS playlist
// performs the song in (a song can have a different played key per playlist).
// It is one of the 12 supported MAJOR keys or '' (unset) — never "Numbers".
const KEY_OPTIONS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

const keySelectCls =
  'bg-[#1e1b2e] border border-purple-800/40 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-600'

// Normalize the API's `songs` into a consistent [{ song, playedKey }] list the
// rest of this page relies on. Tolerates:
//   - new shape, populated:   { song: { _id, title, ... }, playedKey }
//   - new shape, unpopulated: { song: '<id>', playedKey }  (dropped — can't render)
//   - LEGACY pre-migration:   a populated song doc { _id, title, ... }  (no wrapper)
//   - legacy bare id string / ObjectId                     (dropped — can't render)
// Entries we can't render (no title) are dropped rather than crashing the page.
// Pre-existing playlists created before the Played Key migration land here;
// run the server migration (migratePlaylistSongsToPlayedKey) to convert them.
function normalizeEntries(songs) {
  if (!Array.isArray(songs)) return []
  const out = []
  for (const raw of songs) {
    if (raw && typeof raw === 'object' && raw.song && typeof raw.song === 'object') {
      // New shape, populated song.
      out.push({ song: raw.song, playedKey: raw.playedKey || '' })
    } else if (raw && typeof raw === 'object' && (raw.title !== undefined || raw.artist !== undefined)) {
      // Legacy: a populated song document with no { song, playedKey } wrapper.
      out.push({ song: raw, playedKey: raw.playedKey || '' })
    }
    // else: bare id / unpopulated reference — nothing to render; skip.
  }
  return out
}

function SortableSongItem({ entry, index, onRemove, onKeyChange }) {
  const song = entry.song
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `playlist-${song._id}`,
    data: { song, source: 'playlist' },
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-3 bg-[#2a2640] border border-purple-800/30 rounded-lg px-3 py-2.5 mb-1.5 select-none transition-opacity ${isDragging ? 'opacity-40' : 'hover:border-purple-500/60'}`}
    >
      {/* Drag handle — only this grabs, so the Played Key control stays usable */}
      <span
        className="text-gray-600 text-xs w-5 text-right shrink-0 cursor-grab"
        {...attributes} {...listeners}
      >{index + 1}</span>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate">{song.title}</p>
        <p className="text-gray-400 text-xs truncate">{song.artist}</p>
      </div>

      {/* Played Key selector for this song in this playlist. */}
      <label className="flex items-center gap-1.5 shrink-0" title="Played Key for this playlist">
        <span className="text-[10px] uppercase tracking-wide text-gray-500">Key</span>
        <select
          aria-label={`Played key for ${song.title}`}
          className={keySelectCls}
          value={entry.playedKey || ''}
          onPointerDown={e => e.stopPropagation()}
          onChange={e => onKeyChange(song._id, e.target.value)}
        >
          <option value="">—</option>
          {KEY_OPTIONS.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
      </label>

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
  const { currentBand } = useBand()
  const [playlist, setPlaylist] = useState(null)
  // entries: array of { song: <populated song>, playedKey }
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeItem, setActiveItem] = useState(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => {
    setLoading(true)
    getPlaylist(id)
      .then(res => { setPlaylist(res.data); setEntries(normalizeEntries(res.data.songs)) })
      .catch(() => setError('Failed to load setlist'))
      .finally(() => setLoading(false))
  }, [id, currentBand?.id])

  const handleDragStart = ({ active }) => setActiveItem(active.data.current)

  const handleDragEnd = async ({ active, over }) => {
    setActiveItem(null)
    if (!over) return
    const activeData = active.data.current
    const overData = over.data?.current
    const overId = over.id

    if (activeData?.source === 'catalog') {
      const song = activeData.song
      if (entries.some(e => e.song._id === song._id)) return
      const prev = [...entries]
      setEntries(p => [...p, { song, playedKey: '' }])
      try { await addSong(id, song._id) }
      catch { setEntries(prev); setError('Failed to add song') }
      return
    }

    if (activeData?.source === 'playlist' && overId === 'catalog-drop-zone') {
      const song = activeData.song
      const prev = [...entries]
      setEntries(p => p.filter(e => e.song._id !== song._id))
      try { await removeSong(id, song._id) }
      catch { setEntries(prev); setError('Failed to remove song') }
      return
    }

    if (activeData?.source === 'playlist' && overData?.source === 'playlist') {
      const oldIdx = entries.findIndex(e => `playlist-${e.song._id}` === active.id)
      const newIdx = entries.findIndex(e => `playlist-${e.song._id}` === overId)
      if (oldIdx === newIdx) return
      const newOrder = arrayMove(entries, oldIdx, newIdx)
      const prev = [...entries]
      setEntries(newOrder)
      try { await reorderSongs(id, newOrder.map(e => e.song._id)) }
      catch { setEntries(prev); setError('Failed to reorder songs') }
    }
  }

  const handleRemove = async (song) => {
    const prev = [...entries]
    setEntries(p => p.filter(e => e.song._id !== song._id))
    try { await removeSong(id, song._id) }
    catch { setEntries(prev); setError('Failed to remove song') }
  }

  // Optimistically update the song's played key, persisting via the API.
  const handleKeyChange = async (songId, playedKey) => {
    const prev = entries
    setEntries(p => p.map(e => (e.song._id === songId ? { ...e, playedKey } : e)))
    try { await setPlayedKey(id, songId, playedKey) }
    catch { setEntries(prev); setError('Failed to update played key') }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>
  if (!playlist) return <div className="text-center py-16 text-gray-500">Setlist not found</div>

  const playlistSongIds = entries.map(e => e.song._id)

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/playlists')} className="text-gray-400 hover:text-white transition-colors text-sm">← Setlists</button>
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
          <PlaylistDropZone isEmpty={entries.length === 0}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-300">Set List</h3>
              <span className="text-xs text-gray-500 bg-[#2a2640] px-2 py-0.5 rounded-full">{entries.length} songs</span>
            </div>
            <SortableContext items={entries.map(e => `playlist-${e.song._id}`)} strategy={verticalListSortingStrategy}>
              {entries.map((entry, i) => (
                <SortableSongItem key={entry.song._id} entry={entry} index={i} onRemove={handleRemove} onKeyChange={handleKeyChange} />
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
