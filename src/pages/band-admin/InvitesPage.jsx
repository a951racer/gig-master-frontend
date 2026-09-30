import { useEffect, useState, useCallback } from 'react'
import { listInvites, createInvite, revokeInvite } from '../../api/invites'
import { useBand } from '../../auth/BandContext'

// Band-admin invites screen. Lets an admin invite an email address to the
// current band and see/revoke pending invites. Gated on currentBand.isAdmin
// (mirrors the join-request queue): while the current band is not administered,
// we render a not-authorized state and never call the admin APIs.
export default function InvitesPage() {
  const { currentBand } = useBand()
  const isBandAdmin = currentBand?.isAdmin === true
  const bandId = currentBand?.id

  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [email, setEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [notice, setNotice] = useState(null)
  const [revokingId, setRevokingId] = useState(null)

  const fetchInvites = useCallback(async () => {
    if (!isBandAdmin || !bandId) return
    setLoading(true)
    setError(null)
    try {
      const res = await listInvites(bandId)
      setInvites(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          'Failed to load invites.'
      )
    } finally {
      setLoading(false)
    }
  }, [isBandAdmin, bandId])

  useEffect(() => {
    fetchInvites()
  }, [fetchInvites])

  async function handleInvite(e) {
    e.preventDefault()
    if (!isBandAdmin || !bandId) return
    const trimmed = email.trim()
    if (!trimmed) {
      setError('Email is required.')
      return
    }
    setInviting(true)
    setError(null)
    setNotice(null)
    try {
      await createInvite(bandId, trimmed)
      setNotice(`Invite sent to ${trimmed}.`)
      setEmail('')
      await fetchInvites()
    } catch (err) {
      const code = err?.response?.data?.error?.code
      if (code === 'DUPLICATE' || err?.response?.status === 409) {
        setError('There is already a pending invite for that email.')
      } else {
        setError(
          err?.response?.data?.error?.message ||
            err?.response?.data?.message ||
            'Failed to send invite.'
        )
      }
    } finally {
      setInviting(false)
    }
  }

  async function handleRevoke(inviteId) {
    if (!isBandAdmin || !bandId) return
    setRevokingId(inviteId)
    setError(null)
    setNotice(null)
    try {
      await revokeInvite(bandId, inviteId)
      await fetchInvites()
    } catch (err) {
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          'Failed to revoke invite.'
      )
    } finally {
      setRevokingId(null)
    }
  }

  if (!isBandAdmin) {
    return (
      <p className="text-gray-400 text-sm">
        You don&apos;t administer the current band. Select a band you administer to
        invite members.
      </p>
    )
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">Invites</h2>

      <form onSubmit={handleInvite} className="flex gap-2 mb-4">
        <input
          type="email"
          aria-label="Invite email"
          placeholder="invitee@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 bg-[#1e1b2e] border border-purple-800/40 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600 text-sm"
        />
        <button
          type="submit"
          disabled={inviting}
          className="bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
        >
          {inviting ? 'Sending…' : 'Send invite'}
        </button>
      </form>

      {notice && (
        <div className="text-green-400 text-sm bg-green-900/20 border border-green-800/40 rounded-lg px-3 py-2 mb-4">
          {notice}
        </div>
      )}
      {error && (
        <div role="alert" className="text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2 mb-4">
          {error}
        </div>
      )}

      <h3 className="text-sm font-medium text-gray-300 mb-2">Pending invites</h3>
      <div className="bg-[#2a2640] border border-purple-800/30 rounded-xl overflow-hidden">
        {loading ? (
          <p className="text-gray-500 text-sm text-center py-8">Loading…</p>
        ) : invites.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">
            No pending invites
          </p>
        ) : (
          invites.map((inv, i) => {
            const iid = inv.id || inv._id
            return (
              <div
                key={iid}
                className={`flex items-center gap-3 px-4 py-3 ${
                  i < invites.length - 1 ? 'border-b border-purple-900/30' : ''
                }`}
              >
                <span className="flex-1 text-white text-sm">{inv.email}</span>
                <button
                  onClick={() => handleRevoke(iid)}
                  disabled={revokingId === iid}
                  className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors px-2 py-1"
                >
                  Revoke
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
