import { useState } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { useBand } from '../../auth/BandContext'
import { renameBand } from '../../api/bands'
import { useRefreshMembership } from '../bands/refreshMembership'

const inputCls = 'bg-[#1e1b2e] border border-purple-800/40 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600 text-sm'

// Band-administrator layout. Renders the sub-page nav + Outlet only when the
// current band is one the user administers (Req 17.3, 17.4). Otherwise it shows
// a "not authorized / select a band you administer" state and never exposes the
// admin sub-pages.
export default function BandAdminPage() {
  const { currentBand } = useBand()
  const isBandAdmin = currentBand?.isAdmin === true

  if (!isBandAdmin) {
    return (
      <div className="max-w-xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-white mb-4">Band Administration</h1>
        <p className="text-gray-400 text-sm">
          You don&apos;t administer the current band. Select a band you administer
          to manage its join requests and genres.
        </p>
      </div>
    )
  }

  const linkCls = ({ isActive }) =>
    `text-sm px-3 py-2 rounded-lg transition-colors ${
      isActive
        ? 'bg-purple-700 text-white'
        : 'text-gray-300 hover:text-white hover:bg-purple-900/30'
    }`

  return (
    <div className="max-w-xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-white mb-2">Band Administration</h1>
      <p className="text-gray-400 text-sm mb-6">
        Managing <span className="text-purple-300">{currentBand.name}</span>
      </p>
      <nav className="flex gap-2 mb-6">
        <NavLink to="/band-admin/join-requests" className={linkCls}>
          Join Requests
        </NavLink>
        <NavLink to="/band-admin/genres" className={linkCls}>
          Genres
        </NavLink>
        <NavLink to="/band-admin/invites" className={linkCls}>
          Invites
        </NavLink>
      </nav>

      <BandSettings currentBand={currentBand} />

      <Outlet />
    </div>
  )
}

// "Band settings" section — lets a band admin rename the current band. Because
// the band name is embedded in the JWT bands[] claim, on success we refresh the
// session (refreshMembershipAndGo) so the NavBar switcher shows the new name.
function BandSettings({ currentBand }) {
  const refreshMembershipAndGo = useRefreshMembership()
  const [name, setName] = useState(currentBand.name)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Band name is required.')
      return
    }
    setSaving(true)
    try {
      await renameBand(currentBand.id, trimmed)
      // Refresh the token so bands[] carries the new name, then full-page
      // navigate back to band-admin with this band re-selected.
      await refreshMembershipAndGo('/band-admin', { selectBandId: currentBand.id })
    } catch (err) {
      setSaving(false)
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          'Failed to rename band.'
      )
    }
  }

  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-white mb-3">Band settings</h2>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          aria-label="Band name"
          placeholder="Band name"
          value={name}
          onChange={e => setName(e.target.value)}
          className={inputCls + ' flex-1'}
        />
        <button
          type="submit"
          disabled={saving}
          className="bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
        >
          Save
        </button>
      </form>
      {error && (
        <p role="alert" className="text-red-400 text-sm mt-2">
          {error}
        </p>
      )}
    </section>
  )
}
