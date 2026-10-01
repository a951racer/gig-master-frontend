import { useState } from 'react'
import { Link } from 'react-router-dom'
import { createBand } from '../../api/bands'
import { useRefreshMembership } from './refreshMembership'

const inputCls =
  'w-full bg-[#1e1b2e] border border-purple-800/40 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600 text-sm'

// Route: /bands/new
// Create-band flow (Req 16.1, 7.1). On success the new band is made selectable
// by refreshing the session token so its bands[] includes the new band, then
// selecting it and navigating to the songs view.
export default function CreateBandPage() {
  const refreshMembershipAndGo = useRefreshMembership()
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Band name is required.')
      return
    }
    setSubmitting(true)
    try {
      const res = await createBand({ name: trimmed })
      const newBandId = res?.data?.id
      // Refresh membership so the new band appears in bands[] and select it,
      // then land on the band's songs view.
      await refreshMembershipAndGo('/songs', { selectBandId: newBandId })
    } catch (err) {
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          'Failed to create band.'
      )
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-md mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-white mb-2">Create a band</h1>
      <p className="text-gray-400 text-sm mb-6">
        You become the administrator of any band you create.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="band-name" className="block text-sm font-medium text-gray-300 mb-1.5">
            Band name
          </label>
          <input
            id="band-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. The Night Owls"
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
            {submitting ? 'Creating…' : 'Create band'}
          </button>
          <Link
            to="/bands/join"
            className="text-purple-300 hover:text-purple-200 text-sm font-medium"
          >
            Join an existing band instead
          </Link>
        </div>
      </form>
    </div>
  )
}
