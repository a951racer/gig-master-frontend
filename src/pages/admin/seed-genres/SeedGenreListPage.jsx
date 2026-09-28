import { useEffect, useState } from 'react'
import { getSeedGenres, updateSeedGenres } from '../../../api/admin'
import { useBand } from '../../../auth/BandContext'

const inputCls = 'bg-[#1e1b2e] border border-purple-800/40 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600 text-sm'

function errMsg(err, fallback) {
  return err?.response?.data?.error?.message || err?.response?.data?.message || fallback
}

// The seed genre list may be returned as an array of strings or an array of
// objects ({ name }). Normalize to a plain list of names for editing.
function toNames(data) {
  const list = Array.isArray(data) ? data : Array.isArray(data?.genres) ? data.genres : []
  return list.map(g => (typeof g === 'string' ? g : g?.name)).filter(Boolean)
}

export default function SeedGenreListPage() {
  const { role } = useBand()

  const [genres, setGenres] = useState([])
  const [newName, setNewName] = useState('')
  const [loadError, setLoadError] = useState(null)
  const [saveError, setSaveError] = useState(null)
  const [saveSuccess, setSaveSuccess] = useState(null)

  const isSysAdmin = role === 'system_administrator'

  useEffect(() => {
    // Only load seed genres for a system_administrator (Req 18.4/18.5): do not
    // call the admin API when the user is not authorized.
    if (isSysAdmin) fetchSeedGenres()
  }, [isSysAdmin])

  async function fetchSeedGenres() {
    setLoadError(null)
    try {
      const res = await getSeedGenres()
      setGenres(toNames(res.data))
    } catch (err) {
      setLoadError(errMsg(err, 'Failed to load seed genres.'))
    }
  }

  // Page-level role gating (Req 18.4/18.5).
  if (!isSysAdmin) {
    return (
      <div className="max-w-xl mx-auto px-6 py-8">
        <p className="text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">
          You are not authorized to maintain the seed genre list.
        </p>
      </div>
    )
  }

  function handleAdd(e) {
    e.preventDefault()
    const name = newName.trim()
    if (!name || genres.includes(name)) return
    setGenres([...genres, name])
    setNewName('')
  }

  function handleRemove(name) {
    setGenres(genres.filter(g => g !== name))
  }

  async function handleSave() {
    setSaveError(null)
    setSaveSuccess(null)
    try {
      await updateSeedGenres(genres)
      setSaveSuccess('Seed genre list saved.')
    } catch (err) {
      setSaveError(errMsg(err, 'Failed to save seed genres.'))
    }
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-white mb-6">Seed Genre List</h1>

      {loadError && (
        <div className="text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2 mb-4">
          {loadError}
        </div>
      )}

      {/* Add form */}
      <form onSubmit={handleAdd} className="flex gap-2 mb-6">
        <input
          type="text" placeholder="New seed genre name" value={newName}
          onChange={e => setNewName(e.target.value)}
          className={inputCls + ' flex-1'}
        />
        <button type="submit" className="bg-purple-700 hover:bg-purple-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap">
          Add
        </button>
      </form>

      {/* List */}
      <div className="bg-[#2a2640] border border-purple-800/30 rounded-xl overflow-hidden mb-6">
        {genres.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">No seed genres yet</p>
        ) : (
          genres.map((name, i) => (
            <div key={name} className={`flex items-center gap-3 px-4 py-3 ${i < genres.length - 1 ? 'border-b border-purple-900/30' : ''}`}>
              <span className="flex-1 text-white text-sm">{name}</span>
              <button
                onClick={() => handleRemove(name)}
                className="text-xs text-red-400 hover:text-red-300 transition-colors px-2 py-1"
              >
                Remove
              </button>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          className="bg-purple-700 hover:bg-purple-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          Save Seed Genres
        </button>
        {saveError && <p className="text-red-400 text-sm">{saveError}</p>}
        {saveSuccess && <p className="text-green-400 text-sm">{saveSuccess}</p>}
      </div>
    </div>
  )
}
