import { useEffect, useState, useCallback } from 'react'
import { listJoinRequests, resolveJoinRequest } from '../../api/bands'
import { useBand } from '../../auth/BandContext'

// Band-admin join-request queue (Req 17.1). Loads the current band's pending
// join requests and lets the admin approve/deny each, refreshing after every
// action. Gated on currentBand.isAdmin (Req 17.3, 17.4): while the current band
// is not one the user administers, we render a not-authorized state and never
// call the admin APIs.
export default function JoinRequestQueuePage() {
  const { currentBand } = useBand()
  const isBandAdmin = currentBand?.isAdmin === true
  const bandId = currentBand?.id

  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [pendingId, setPendingId] = useState(null)

  const fetchRequests = useCallback(async () => {
    if (!isBandAdmin || !bandId) return
    setLoading(true)
    setError(null)
    try {
      const res = await listJoinRequests(bandId)
      setRequests(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          'Failed to load join requests.'
      )
    } finally {
      setLoading(false)
    }
  }, [isBandAdmin, bandId])

  // Refetch on mount and whenever the current band changes.
  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  async function handleResolve(reqId, status) {
    if (!isBandAdmin || !bandId) return
    setPendingId(reqId)
    setError(null)
    try {
      await resolveJoinRequest(bandId, reqId, status)
      await fetchRequests()
    } catch (err) {
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          'Failed to update join request.'
      )
    } finally {
      setPendingId(null)
    }
  }

  // Do not render the queue or call admin APIs unless the current band is
  // administered by the user (Req 17.3, 17.4).
  if (!isBandAdmin) {
    return (
      <p className="text-gray-400 text-sm">
        You don&apos;t administer the current band. Select a band you administer to
        review its join requests.
      </p>
    )
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">Join Requests</h2>

      {error && (
        <div className="text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2 mb-4">
          {error}
        </div>
      )}

      <div className="bg-[#2a2640] border border-purple-800/30 rounded-xl overflow-hidden">
        {loading ? (
          <p className="text-gray-500 text-sm text-center py-8">Loading…</p>
        ) : requests.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">
            No pending join requests
          </p>
        ) : (
          requests.map((req, i) => {
            const rid = req.id || req._id
            const label =
              req.user?.email || req.user?.name || req.user || 'Unknown user'
            return (
              <div
                key={rid}
                className={`flex items-center gap-3 px-4 py-3 ${
                  i < requests.length - 1 ? 'border-b border-purple-900/30' : ''
                }`}
              >
                <span className="flex-1 text-white text-sm">{label}</span>
                <button
                  onClick={() => handleResolve(rid, 'approved')}
                  disabled={pendingId === rid}
                  className="text-xs text-green-400 hover:text-green-300 disabled:opacity-50 transition-colors px-2 py-1"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleResolve(rid, 'denied')}
                  disabled={pendingId === rid}
                  className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors px-2 py-1"
                >
                  Deny
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
