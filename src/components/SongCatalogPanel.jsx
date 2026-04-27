import { useState, useEffect } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { listSongs } from '../api/songs'
import { listGenres } from '../api/genres'

const inputCls = 'bg-[#16132a] border border-purple-800/40 rounded-lg px-2.5 py-1.5 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-600 text-xs w-full'
const selectCls = inputCls

function DraggableSongCard({ song }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `catalog-${song._id}`,
    data: { song, source: 'catalog' },
  })

  return (
    <div
      ref={setNodeRef}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      className={`bg-[#2a2640] border border-purple-800/30 rounded-lg px-3 py-2 mb-1.5 cursor-grab select-none transition-opacity ${isDragging ? 'opacity-40' : 'hover:border-purple-500/60'}`}
      {...listeners} {...attributes}
    >
      <p className="text-white text-xs font-medium truncate">{song.title}</p>
      <p className="text-gray-400 text-xs truncate">{song.artist}{song.genre ? ` · ${song.genre.name}` : ''}</p>
    </div>
  )
}

export default function SongCatalogPanel({ excludeIds = [], droppable = false }) {
  const { setNodeRef: setCatalogDropRef, isOver } = useDroppable({ id: 'catalog-drop-zone', disabled: !droppable })
  const [songs, setSongs] = useState([])
  const [genres, setGenres] = useState([])
  const [titleFilter, setTitleFilter] = useState('')
  const [genreFilter, setGenreFilter] = useState('')
  const [tagsFilter, setTagsFilter] = useState('')
  const [sortField, setSortField] = useState('title')
  const [sortDir, setSortDir] = useState('asc')

  useEffect(() => { listGenres().then(res => setGenres(res.data)).catch(() => {}) }, [])

  useEffect(() => {
    const params = {}
    if (titleFilter) params.title = titleFilter
    if (genreFilter) params.genre = genreFilter
    if (tagsFilter) params.tags = tagsFilter
    listSongs(params).then(res => {
      let data = res.data.filter(s => !excludeIds.includes(s._id))
      data = [...data].sort((a, b) => {
        const aVal = sortField === 'genre' ? (a.genre?.name || '') : (a[sortField] || '')
        const bVal = sortField === 'genre' ? (b.genre?.name || '') : (b[sortField] || '')
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      })
      setSongs(data)
    }).catch(() => {})
  }, [titleFilter, genreFilter, tagsFilter, sortField, sortDir, excludeIds.join(',')])

  return (
    <div
      ref={droppable ? setCatalogDropRef : undefined}
      className={`flex flex-col w-72 shrink-0 bg-[#1e1b2e] border rounded-xl p-3 transition-colors ${isOver ? 'border-green-500/60 bg-green-900/10' : 'border-purple-800/30'}`}
    >
      <h3 className="text-sm font-semibold text-gray-300 mb-3">Song Catalog</h3>
      <div className="space-y-1.5 mb-3">
        <input className={inputCls} placeholder="Search title" value={titleFilter} onChange={e => setTitleFilter(e.target.value)} />
        <select className={selectCls} value={genreFilter} onChange={e => setGenreFilter(e.target.value)}>
          <option value="">All genres</option>
          {genres.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
        </select>
        <input className={inputCls} placeholder="Tags" value={tagsFilter} onChange={e => setTagsFilter(e.target.value)} />
        <div className="flex gap-1.5">
          <select className={selectCls} value={sortField} onChange={e => setSortField(e.target.value)}>
            <option value="title">Title</option>
            <option value="artist">Artist</option>
            <option value="genre">Genre</option>
          </select>
          <select className={selectCls + ' w-16'} value={sortDir} onChange={e => setSortDir(e.target.value)}>
            <option value="asc">↑</option>
            <option value="desc">↓</option>
          </select>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 max-h-[500px]">
        {songs.map(song => <DraggableSongCard key={song._id} song={song} />)}
        {songs.length === 0 && <p className="text-gray-600 text-xs text-center py-6">No songs found</p>}
      </div>
    </div>
  )
}
