import { useEffect, useState } from 'react'
import { listGenres, createGenre, updateGenre, deleteGenre } from '../../api/genres'
import ConfirmDialog from '../../components/ConfirmDialog'
import { useBand } from '../../auth/BandContext'

const inputCls =
  'bg-[#1e1b2e] border border-purple-800/40 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600 text-sm'

// Band-admin genre editor (Req 17.2). CRUD on the current band's genres. The
// /genres endpoints are scoped by X-Band-Id, so this operates on the current
// band implicitly. Gated on currentBand.isAdmin (Req 17.3, 17.4): while the
// current band is not administered, we render a not-authorized state and never
// call the genre APIs. Structure adapted from the admin GenreListPage.
export default function BandGenreEditorPage() {
  const { currentBand } = useBand()
  const isBandAdmin = currentBand?.isAdmin === true
  const bandId = currentBand?.id

  const [genres, setGenres] = useState([])
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteError, setDeleteError] = useState(null)
  const [createError, setCreateError] = useState(null)

  // Refetch on mount and whenever the current band changes. Skip when the user
  // does not administer the current band so no admin API is called.
  useEffect(() => {
    if (isBandAdmin && bandId) fetchGenres()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBandAdmin, bandId])

  async function fetchGenres() {
    try {
      const res = await listGenres()
      setGenres(Array.isArray(res.data) ? res.data : [])
    } catch {
      /* ignore load errors */
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    setCreateError(null)
    if (!newName.trim()) return
    try {
      await createGenre(newName.trim())
      setNewName('')
      await fetchGenres()
    } catch (err) {
      setCreateError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          'Failed to create genre.'
      )
    }
  }

  async function handleSaveEdit(id) {
    if (!editingName.trim()) return
    try {
      await updateGenre(id, editingName.trim())
      setEditingId(null)
      setEditingName('')
      await fetchGenres()
    } catch {
      /* ignore edit errors */
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    try {
      await deleteGenre(deleteTarget.id || deleteTarget._id)
      setDeleteTarget(null)
      await fetchGenres()
    } catch (err) {
      setDeleteTarget(null)
      setDeleteError(
        err?.response?.status === 409
          ? 'This genre is in use by one or more songs and cannot be deleted.'
          : err?.response?.data?.message || 'Failed to delete genre.'
      )
    }
  }

  // Do not render the editor or call genre APIs unless the current band is
  // administered by the user (Req 17.3, 17.4).
  if (!isBandAdmin) {
    return (
      <p className="text-gray-400 text-sm">
        You don&apos;t administer the current band. Select a band you administer to
        edit its genres.
      </p>
    )
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">Genres</h2>

      {deleteError && (
        <div className="text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2 mb-4">
          {deleteError}
        </div>
      )}

      {/* Create form */}
      <form onSubmit={handleCreate} className="flex gap-2 mb-6">
        <input
          type="text"
          placeholder="New genre name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className={inputCls + ' flex-1'}
        />
        <button
          type="submit"
          className="bg-purple-700 hover:bg-purple-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
        >
          Add Genre
        </button>
      </form>
      {createError && <p className="text-red-400 text-sm mb-4">{createError}</p>}

      {/* Genre list */}
      <div className="bg-[#2a2640] border border-purple-800/30 rounded-xl overflow-hidden">
        {genres.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">No genres yet</p>
        ) : (
          genres.map((genre, i) => {
            const gid = genre.id || genre._id
            return (
              <div
                key={gid}
                className={`flex items-center gap-3 px-4 py-3 ${
                  i < genres.length - 1 ? 'border-b border-purple-900/30' : ''
                }`}
              >
                {editingId === gid ? (
                  <>
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className={inputCls + ' flex-1'}
                      autoFocus
                    />
                    <button
                      onClick={() => handleSaveEdit(gid)}
                      className="text-xs text-green-400 hover:text-green-300 transition-colors px-2 py-1"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(null)
                        setEditingName('')
                      }}
                      className="text-xs text-gray-400 hover:text-gray-300 transition-colors px-2 py-1"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span
                      className="flex-1 text-white text-sm cursor-pointer hover:text-purple-300 transition-colors"
                      onClick={() => {
                        setEditingId(gid)
                        setEditingName(genre.name)
                      }}
                      title="Click to edit"
                    >
                      {genre.name}
                    </span>
                    <button
                      onClick={() => {
                        setDeleteError(null)
                        setDeleteTarget(genre)
                      }}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors px-2 py-1"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            )
          })
        )}
      </div>

      {deleteTarget && (
        <ConfirmDialog
          message={`Delete genre "${deleteTarget.name}"?`}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
