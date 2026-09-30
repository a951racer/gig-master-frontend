import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { getInvite, acceptInvite } from '../../api/invites'
import { useAuth } from '../../auth/AuthContext'
import { refreshMembershipAndGo } from '../bands/refreshMembership'

// Accept-invite landing page at /invites/accept?token=...
//
// Flow:
//   1. Look up the invite by token (public GET) to show band name + status and
//      whether the invited email already has an account.
//   2. If the invite is not pending (expired/revoked/accepted/unknown), show a
//      terminal message.
//   3. If the visitor is logged in, offer an Accept button. Acceptance is
//      enforced server-side to require the logged-in email to match the invited
//      email; a 403 surfaces a clear "signed in as a different account" message.
//   4. If the visitor is logged out, route them to log in (has account) or
//      register (no account), carrying the token in `next` so they return here.
//
// On success we refresh the session (so the new band appears in bands[]) and
// land the user on /songs with the joined band selected.
export default function AcceptInvitePage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const { token: authToken, isLoading: authLoading } = useAuth()
  const isLoggedIn = Boolean(authToken)

  const [invite, setInvite] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [accepting, setAccepting] = useState(false)
  const [acceptError, setAcceptError] = useState(null)

  const load = useCallback(async () => {
    if (!token) {
      setLoadError('This invite link is missing its token.')
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadError(null)
    try {
      const res = await getInvite(token)
      setInvite(res.data)
    } catch (err) {
      if (err?.response?.status === 404) {
        setLoadError('This invite could not be found. It may have been revoked.')
      } else {
        setLoadError(
          err?.response?.data?.error?.message ||
            err?.response?.data?.message ||
            'Failed to load this invite.'
        )
      }
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  async function handleAccept() {
    setAccepting(true)
    setAcceptError(null)
    try {
      const res = await acceptInvite(token)
      const bandId = res?.data?.bandId
      // Refresh session so bands[] carries the newly-joined band, select it,
      // and land on the app home.
      await refreshMembershipAndGo('/songs', bandId ? { selectBandId: bandId } : {})
    } catch (err) {
      const status = err?.response?.status
      if (status === 403) {
        setAcceptError(
          `This invite was sent to ${invite?.email || 'a different email'}. ` +
            'Sign in with that account to accept it.'
        )
      } else if (status === 409) {
        setAcceptError('This invite is no longer valid.')
      } else {
        setAcceptError(
          err?.response?.data?.error?.message ||
            err?.response?.data?.message ||
            'Failed to accept this invite.'
        )
      }
      setAccepting(false)
    }
  }

  const nextParam = `/invites/accept?token=${encodeURIComponent(token)}`

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🎸</div>
          <h1 className="text-3xl font-bold text-white">Band Invite</h1>
        </div>
        <div className="bg-[#2a2640] border border-purple-800/40 rounded-2xl p-8 shadow-2xl">
          {loading || authLoading ? (
            <p className="text-gray-400 text-sm text-center">Loading invite…</p>
          ) : loadError ? (
            <div>
              <p role="alert" className="text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2 mb-4">
                {loadError}
              </p>
              <Link to="/login" className="text-purple-400 hover:text-purple-300 text-sm">
                Go to sign in
              </Link>
            </div>
          ) : invite && invite.status !== 'pending' ? (
            <div>
              <p className="text-gray-300 text-sm mb-4">
                {invite.status === 'accepted'
                  ? 'This invite has already been accepted.'
                  : invite.status === 'expired'
                    ? 'This invite has expired. Ask the band admin to send a new one.'
                    : 'This invite is no longer valid.'}
              </p>
              <Link to="/login" className="text-purple-400 hover:text-purple-300 text-sm">
                Go to sign in
              </Link>
            </div>
          ) : (
            <div>
              <p className="text-gray-300 text-sm mb-2">
                You&apos;ve been invited to join{' '}
                <span className="text-purple-300 font-medium">
                  {invite?.bandName || 'a band'}
                </span>
                .
              </p>
              <p className="text-gray-500 text-xs mb-6">
                Invite sent to {invite?.email}
              </p>

              {isLoggedIn ? (
                <>
                  <button
                    onClick={handleAccept}
                    disabled={accepting}
                    className="w-full bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
                  >
                    {accepting ? 'Joining…' : 'Accept invite'}
                  </button>
                  {acceptError && (
                    <p role="alert" className="text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2 mt-4">
                      {acceptError}
                    </p>
                  )}
                </>
              ) : invite?.hasAccount ? (
                <>
                  <p className="text-gray-400 text-sm mb-4">
                    Sign in as {invite?.email} to accept this invite.
                  </p>
                  <Link
                    to={`/login?next=${encodeURIComponent(nextParam)}`}
                    className="block w-full text-center bg-purple-700 hover:bg-purple-600 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
                  >
                    Sign in
                  </Link>
                </>
              ) : (
                <>
                  <p className="text-gray-400 text-sm mb-4">
                    Create an account with {invite?.email} to accept this invite.
                  </p>
                  <Link
                    to={`/register?next=${encodeURIComponent(nextParam)}&email=${encodeURIComponent(invite?.email || '')}`}
                    className="block w-full text-center bg-purple-700 hover:bg-purple-600 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
                  >
                    Create account
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
