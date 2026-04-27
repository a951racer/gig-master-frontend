import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getGig } from '../../api/gigs'

export default function GigDetailPage() {
  const { id } = useParams()
  const [gig, setGig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getGig(id)
      .then(res => setGig(res.data))
      .catch(() => setError('Failed to load gig'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>
  if (error) return <p role="alert" className="text-red-400 text-center py-16">{error}</p>
  if (!gig) return <p className="text-gray-500 text-center py-16">Gig not found</p>

  const formattedDate = gig.date
    ? new Date(gig.date).toLocaleDateString(undefined, { dateStyle: 'long' })
    : null

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/gigs" className="text-gray-400 hover:text-white transition-colors text-sm">← Gigs</Link>
        <Link to={`/gigs/${id}/edit`} className="ml-auto text-sm text-purple-400 hover:text-purple-300 border border-purple-800/40 px-3 py-1.5 rounded-lg transition-colors">
          Edit Gig
        </Link>
      </div>

      <div className="bg-[#2a2640] border border-purple-800/30 rounded-2xl p-6 mb-6">
        <h1 className="text-2xl font-bold text-white mb-4">{gig.name}</h1>
        <div className="space-y-2 text-sm">
          {formattedDate && (
            <div className="flex gap-2 text-gray-300">
              <span className="text-gray-500">📅</span>
              <span>{formattedDate}</span>
            </div>
          )}
          {gig.location && (
            <div className="flex gap-2 text-gray-300">
              <span className="text-gray-500">📍</span>
              <span>{gig.location}</span>
            </div>
          )}
          {gig.description && (
            <div className="flex gap-2 text-gray-300">
              <span className="text-gray-500">📝</span>
              <span>{gig.description}</span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-[#2a2640] border border-purple-800/30 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Playlist</h2>
        {gig.playlist ? (
          <>
            <p className="text-purple-300 font-medium mb-3">{gig.playlist.name}</p>
            {gig.playlist.songs?.length > 0 ? (
              <ol className="space-y-2">
                {gig.playlist.songs.map((song, i) => (
                  <li key={song._id} className="flex items-center gap-3 text-sm">
                    <span className="text-gray-600 w-5 text-right shrink-0">{i + 1}</span>
                    <span className="text-white font-medium">{song.title}</span>
                    <span className="text-gray-400">— {song.artist}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-gray-500 text-sm">No songs in this playlist</p>
            )}
          </>
        ) : (
          <p className="text-gray-500 text-sm">No playlist assigned</p>
        )}
      </div>
    </div>
  )
}
