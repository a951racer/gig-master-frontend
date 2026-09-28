import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listMyJoinRequests } from '../../api/bands'
import { useBand } from '../../auth/BandContext'
import { setCurrentBandId } from '../../api/axiosInstance'
import { refreshMembershipAndGo } from './refreshMembership'

// Normalize the band reference on a join request. The API returns
// [{ band, status }] where `band` may be an id string or a populated object
// ({ id/_id, name }); handle both defensively.
function bandRef(band) {
  if (band && typeof band === 'object') {
    return { id: band.id || band._id, name: band.name }
  }
  return { id: band, name: undefined }
}

const statusStyles = {
  pending: 'bg-yellow-900/30 text-yellow-300 border-yellow-800/40',
  approved: 'bg-green-900/30 text-green-300 border-green-800/40',
  denied: 'bg-red-900/30 text-red-300 border-red-800/40',
}

function StatusBadge({ status }) {
  const cls = statusStyles[status] || 'bg-gray-800/40 text-gray-300 border-gray-700/40'
  return (
    <span className={`text-xs font-medium px-2 py-1 rounded border ${cls} capitalize`}>
      {status}
    </span>
  )
}

// Route: /bands/requests
// Own join-request status (Req 16.3, 16.4, 16.5). Lists the caller's requests
// with pending/approved/denied status. An approved band is made selectable via
// a switch action: if it is already in the token bands[] we select it directly;
// otherwise we refresh the session so the newly-joined band appears in bands[]
// and becomes selectable (Req 7.1).
export default function JoinRequestsPage() {
  const { bands = [], setCurrentBand } = useBand() || {}
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await listMyJoinRequests()
        if (active) setRequests(Array.isArray(res.data) ? res.data : [])
      } catch (err) {
        if (active) {
          setError(
            err?.response?.data?.error?.message ||
              err?.response?.data?.message ||
              'Failed to load your join requests.'
          )
        }
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const handleSwitchTo = (id) => {
    const inClaim = bands.some((b) => String(b.id) === String(id))
    if (inClaim) {
      // Already in the token's bands[] — select directly and go to songs.
      setCurrentBand?.(id)
      setCurrentBandId(id)
      window.location.assign('/songs')
    } else {
      // Recently approved but not yet in this session's token — refresh the
      // session so the band appears in bands[], select it, and navigate.
      refreshMembershipAndGo('/songs', { selectBandId: id })
    }
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Your join requests</h1>
        <Link
          to="/bands/join"
          className="text-purple-300 hover:text-purple-200 text-sm font-medium"
        >
          Request another
        </Link>
      </div>

      {error && (
        <p
          role="alert"
          className="text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2 mb-4"
        >
          {error}
        </p>
      )}

      <div className="bg-[#2a2640] border border-purple-800/30 rounded-xl overflow-hidden">
        {loading ? (
          <p className="text-gray-500 text-sm text-center py-8">Loading…</p>
        ) : requests.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">
            You have no join requests yet.
          </p>
        ) : (
          requests.map((req, i) => {
            const { id, name } = bandRef(req.band)
            return (
              <div
                key={`${id}-${i}`}
                className={`flex items-center gap-3 px-4 py-3 ${
                  i < requests.length - 1 ? 'border-b border-purple-900/30' : ''
                }`}
              >
                <span className="flex-1 text-white text-sm">
                  {name || `Band ${id}`}
                </span>
                <StatusBadge status={req.status} />
                {req.status === 'approved' && (
                  <button
                    onClick={() => handleSwitchTo(id)}
                    className="text-xs text-purple-300 hover:text-purple-200 transition-colors px-2 py-1 border border-purple-800/40 rounded"
                  >
                    Switch to band
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
