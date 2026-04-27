import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listGigs, deleteGig } from '../../api/gigs'
import ConfirmDialog from '../../components/ConfirmDialog'

export default function GigListPage() {
  const navigate = useNavigate()
  const [gigs, setGigs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)

  useEffect(() => {
    listGigs()
      .then(res => setGigs(res.data))
      .catch(() => setError('Failed to load gigs'))
      .finally(() => setLoading(false))
  }, [])

  const handleDelete = async (gig) => {
    try {
      await deleteGig(gig._id)
      setGigs(prev => prev.filter(g => g._id !== gig._id))
    } catch { setError('Failed to delete gig') }
    finally { setConfirmDelete(null) }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Gigs</h1>
        <Link to="/gigs/new">
          <button className="bg-purple-700 hover:bg-purple-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            + New Gig
          </button>
        </Link>
      </div>

      {error && <p role="alert" className="text-red-400 text-sm mb-4">{error}</p>}

      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : gigs.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <div className="text-4xl mb-3">🎤</div>
          <p>No gigs yet. Add your first performance!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {gigs.map(g => (
            <div key={g._id} className="bg-[#2a2640] border border-purple-800/30 rounded-xl px-5 py-4 flex items-center gap-4 hover:border-purple-600/50 transition-colors">
              <div className="flex-1 min-w-0">
                <Link to={`/gigs/${g._id}`} className="font-semibold text-white hover:text-purple-300 transition-colors">
                  {g.name}
                </Link>
                {g.location && <p className="text-gray-400 text-sm mt-0.5 truncate">📍 {g.location}</p>}
              </div>
              <span className="text-xs text-gray-400 bg-[#1e1b2e] px-3 py-1 rounded-full whitespace-nowrap">
                {new Date(g.date).toLocaleDateString(undefined, { dateStyle: 'medium' })}
              </span>
              <div className="flex gap-2">
                <button onClick={() => navigate(`/gigs/${g._id}/edit`)} className="text-xs text-purple-400 hover:text-purple-300 transition-colors px-2 py-1">Edit</button>
                <button onClick={() => setConfirmDelete(g)} className="text-xs text-red-400 hover:text-red-300 transition-colors px-2 py-1">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          message={`Delete gig "${confirmDelete.name}"?`}
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
