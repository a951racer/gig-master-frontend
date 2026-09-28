import { useState } from 'react'
import { Link } from 'react-router-dom'
import { requestToJoin } from '../../api/bands'

const inputCls =
  'w-full bg-[#1e1b2e] border border-purple-800/40 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600 text-sm'

// Route: /bands/join
// Join-band flow (Req 16.2, 16.3). Submits a join request for an existing band
// by id. No public band-browse endpoint is specified in the design, so a band
// id input is the accepted approach; on success we confirm the request is
// pending and point the user to the requests-status page (Req 16.3).
export default function JoinBandPage() {
  const [bandId, setBandId] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const trimmed = bandId.trim()
    if (!trimmed) {
      setError('Band id is required.')
      return
    }
    setSubmitting(true)
    try {
      await requestToJoin(trimmed)
      setSubmitted(true)
    } catch (err) {
      const status = err?.response?.status
      if (status === 409) {
        setError('You already have a pending request to join this band.')
      } else if (status === 404) {
        setError('No band found with that id.')
      } else {
        setError(
          err?.response?.data?.error?.message ||
            err?.response?.data?.message ||
            'Failed to submit join request.'
        )
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-md mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-white mb-2">Join a band</h1>
      <p className="text-gray-400 text-sm mb-6">
        Enter the id of the band you want to join. A request will be sent to that
        band's administrator for approval.
      </p>

      {submitted ? (
        <div className="bg-[#2a2640] border border-purple-800/30 rounded-xl px-6 py-8 text-center">
          <div className="text-3xl mb-3">⏳</div>
          <h2 className="text-lg font-semibold text-white mb-1">Request pending</h2>
          <p className="text-gray-400 text-sm mb-6">
            Your request to join is now pending approval by the band's
            administrator.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              to="/bands/requests"
              className="bg-purple-700 hover:bg-purple-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              View request status
            </Link>
            <button
              onClick={() => {
                setSubmitted(false)
                setBandId('')
              }}
              className="text-purple-300 hover:text-purple-200 text-sm font-medium px-4 py-2"
            >
              Request another
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="band-id" className="block text-sm font-medium text-gray-300 mb-1.5">
              Band id
            </label>
            <input
              id="band-id"
              type="text"
              value={bandId}
              onChange={(e) => setBandId(e.target.value)}
              placeholder="Paste the band id"
              className={inputCls}
              autoFocus
            />
          </div>

          {error && (
            <p
              role="alert"
              className="text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2"
            >
              {error}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
            >
              {submitting ? 'Submitting…' : 'Request to join'}
            </button>
            <Link
              to="/bands/new"
              className="text-purple-300 hover:text-purple-200 text-sm font-medium"
            >
              Create a new band instead
            </Link>
          </div>
        </form>
      )}
    </div>
  )
}
