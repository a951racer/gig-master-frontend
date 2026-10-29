import { useState, useEffect, useMemo } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { listSongs } from '../api/songs'
import { listGenres } from '../api/genres'
import { listPlaylists, getPlaylist } from '../api/playlists'
import { useBand } from '../auth/BandContext'

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

export default function SongCatalogPanel({ excludeIds = [], currentPlaylistId = null, droppable = false }) {
  const { setNodeRef: setCatalogDropRef, isOver } = useDroppable({ id: 'catalog-drop-zone', disabled: !droppable })
  const { currentBand } = useBand()

  // The full band catalog (fetched once per band) + lookups. Filtering is done
  // CLIENT-SIDE so the invert toggle can flip the whole filter predicate
  // consistently (title + genre + tags + setlist membership).
  const [allSongs, setAllSongs] = useState([])
  const [genres, setGenres] = useState([])
  const [playlists, setPlaylists] = useState([])

  const [titleFilter, setTitleFilter] = useState('')
  const [genreFilter, setGenreFilter] = useState('')
  const [tagsFilter, setTagsFilter] = useState('')
  // Multi-select setlist filter: a Set of selected playlist ids. A song matches
  // the setlist criterion if it is in the UNION of the selected setlists (in at
  // least one of them).
  const [selectedSetlistIds, setSelectedSetlistIds] = useState(() => new Set())
  const [invert, setInvert] = useState(false) // false = show matches, true = hide matches
  const [sortField, setSortField] = useState('title')
  const [sortDir, setSortDir] = useState('asc')

  // Per-setlist song-id lists, keyed by playlist id, loaded lazily as setlists
  // are selected and cached so re-selecting doesn't refetch.
  const [setlistSongs, setSetlistSongs] = useState({}) // { [playlistId]: string[] }

  useEffect(() => { listGenres().then(res => setGenres(res.data)).catch(() => {}) }, [currentBand?.id])

  // Setlist checkbox options: every band setlist EXCEPT the one being edited.
  useEffect(() => {
    listPlaylists()
      .then(res => setPlaylists((res.data || []).filter(p => String(p._id) !== String(currentPlaylistId))))
      .catch(() => {})
  }, [currentBand?.id, currentPlaylistId])

  // The whole catalog, fetched once per band (no server-side filter params).
  useEffect(() => {
    listSongs().then(res => setAllSongs(res.data || [])).catch(() => {})
  }, [currentBand?.id])

  // Reset selections + cache when the band changes.
  useEffect(() => {
    setSelectedSetlistIds(new Set())
    setSetlistSongs({})
  }, [currentBand?.id])

  // Lazily load the song ids for any newly-selected setlist not yet cached.
  useEffect(() => {
    let active = true
    const missing = [...selectedSetlistIds].filter(id => !(id in setlistSongs))
    if (missing.length === 0) return
    Promise.all(
      missing.map(id =>
        getPlaylist(id)
          .then(res => [id, (res.data?.songs || []).map(e => String(e?.song?._id ?? e?.song)).filter(Boolean)])
          .catch(() => [id, []])
      )
    ).then(pairs => {
      if (!active) return
      setSetlistSongs(prev => {
        const next = { ...prev }
        for (const [id, ids] of pairs) next[id] = ids
        return next
      })
    })
    return () => { active = false }
  }, [selectedSetlistIds, setlistSongs])

  const toggleSetlist = (id) => {
    setSelectedSetlistIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const excludeSet = useMemo(() => new Set((excludeIds || []).map(String)), [excludeIds])

  // Union of song ids across all SELECTED setlists (whose data has loaded).
  const unionSetlistIds = useMemo(() => {
    const u = new Set()
    for (const id of selectedSetlistIds) {
      for (const sid of (setlistSongs[id] || [])) u.add(sid)
    }
    return u
  }, [selectedSetlistIds, setlistSongs])

  const visibleSongs = useMemo(() => {
    const title = titleFilter.trim().toLowerCase()
    const wantTags = tagsFilter.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
    const setlistActive = selectedSetlistIds.size > 0

    // Whether ANY filter is active. With no active filter, show everything
    // (the invert toggle has nothing to invert).
    const hasFilter = Boolean(title || genreFilter || wantTags.length || setlistActive)

    const matches = (s) => {
      if (title && !(s.title || '').toLowerCase().includes(title)) return false
      if (genreFilter && String(s.genre?._id ?? s.genre ?? '') !== String(genreFilter)) return false
      if (wantTags.length) {
        const songTags = (s.tags || []).map(t => String(t).toLowerCase())
        if (!wantTags.every(t => songTags.includes(t))) return false
      }
      // Setlist criterion: the song is in the UNION of the selected setlists
      // (in at least one of them).
      if (setlistActive && !unionSetlistIds.has(String(s._id))) return false
      return true
    }

    const filtered = allSongs.filter((s) => {
      // Songs in the setlist being edited are ALWAYS hidden, regardless of the
      // filters or the invert toggle.
      if (excludeSet.has(String(s._id))) return false
      if (!hasFilter) return true
      const m = matches(s)
      return invert ? !m : m
    })

    return [...filtered].sort((a, b) => {
      const aVal = sortField === 'genre' ? (a.genre?.name || '') : (a[sortField] || '')
      const bVal = sortField === 'genre' ? (b.genre?.name || '') : (b[sortField] || '')
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
    })
  }, [allSongs, titleFilter, genreFilter, tagsFilter, selectedSetlistIds, unionSetlistIds, invert, sortField, sortDir, excludeSet])

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

        {/* Multi-select setlist filter: a song matches if it is in the UNION of
            the checked setlists (at least one). All band setlists except the
            one being edited are listed. */}
        {playlists.length > 0 && (
          <fieldset className="border border-purple-800/40 rounded-lg px-2 py-1.5" aria-label="Filter by setlists">
            <legend className="text-[10px] uppercase tracking-wide text-gray-500 px-1">Setlists</legend>
            <div className="max-h-28 overflow-y-auto space-y-1">
              {playlists.map(p => (
                <label key={p._id} className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="accent-purple-600 shrink-0"
                    checked={selectedSetlistIds.has(String(p._id))}
                    onChange={() => toggleSetlist(String(p._id))}
                  />
                  <span className="truncate">{p.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <label className="flex items-center gap-2 text-xs text-gray-300 px-0.5 py-0.5 cursor-pointer select-none">
          <input type="checkbox" checked={invert} onChange={e => setInvert(e.target.checked)} className="accent-purple-600" />
          Hide songs matching the filters
        </label>
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
        {visibleSongs.map(song => <DraggableSongCard key={song._id} song={song} />)}
        {visibleSongs.length === 0 && <p className="text-gray-600 text-xs text-center py-6">No songs found</p>}
      </div>
    </div>
  )
}
