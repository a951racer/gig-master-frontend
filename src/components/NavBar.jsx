import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useBand } from '../auth/BandContext'
import { setCurrentBandId } from '../api/axiosInstance'

// Core links available to any band member. These pages require a current band
// to load their data, which the pages themselves handle.
const memberLinks = [
  { to: '/songs', label: 'Songs' },
  { to: '/playlists', label: 'Playlists' },
  { to: '/gigs', label: 'Gigs' },
]

export default function NavBar() {
  const { user, token, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  // Defensive: BandProvider may not yet be wrapped around the app (task 19.1),
  // in which case useBand() returns null. Fall back to safe empty defaults.
  const { bands = [], role, currentBand, setCurrentBand, hasNoBand = true } =
    useBand() || {}

  // Hide the nav for unauthenticated users. Gate on `token` (the same
  // auth-validity signal ProtectedRoute uses) so the nav never shows on public
  // routes or when the session is invalid, even if a stale `user` lingers.
  if (!token || !user) return null

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  // Switch the active band: update BandContext state (persists currentBandId)
  // and sync the axios module-level id so the X-Band-Id header updates on the
  // very next request without waiting for a re-render/effect.
  const handleBandChange = (e) => {
    const id = e.target.value
    setCurrentBand?.(id)
    setCurrentBandId(id)
  }

  const isBandAdmin = Boolean(currentBand?.isAdmin)
  const isSystemAdmin = role === 'system_administrator'

  // Bands arrive in JWT membership order; sort the switcher alphabetically by name.
  const sortedBands = [...bands].sort((a, b) =>
    String(a.name || '').localeCompare(String(b.name || ''))
  )

  const linkClass = (active) =>
    `px-3 py-1.5 rounded text-sm font-medium transition-colors ${
      active
        ? 'bg-purple-700 text-white'
        : 'text-gray-300 hover:bg-purple-900/40 hover:text-white'
    }`

  return (
    <nav className="sticky top-0 z-50 bg-[#1e1b2e] border-b border-purple-900/40 px-6 py-3 flex items-center gap-6">
      <span className="text-purple-400 font-bold text-lg tracking-wide mr-4">🎸 GigMaster</span>

      <div className="flex items-center gap-1 flex-1">
        {memberLinks.map(({ to, label }) => (
          <Link key={to} to={to} className={linkClass(pathname.startsWith(to))}>
            {label}
          </Link>
        ))}

        {/* Band-admin link: only when the current band is administered by the user. */}
        {isBandAdmin && (
          <Link to="/band-admin" className={linkClass(pathname.startsWith('/band-admin'))}>
            Band Admin
          </Link>
        )}

        {/* Sysadmin link: only for system administrators, independent of current band. */}
        {isSystemAdmin && (
          <Link to="/admin" className={linkClass(pathname.startsWith('/admin'))}>
            Admin
          </Link>
        )}
      </div>

      {/* Band switcher, or a create/join prompt when the user has no bands. */}
      {hasNoBand ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-400">No band</span>
          <Link
            to="/bands/new"
            className="px-3 py-1.5 rounded text-sm font-medium bg-purple-700 text-white hover:bg-purple-600 transition-colors"
          >
            Create
          </Link>
          <Link
            to="/bands/join"
            className="px-3 py-1.5 rounded text-sm font-medium text-gray-300 hover:bg-purple-900/40 hover:text-white transition-colors"
          >
            Join
          </Link>
        </div>
      ) : (
        <label className="flex items-center gap-2 text-sm text-gray-300">
          <span className="sr-only">Current band</span>
          <select
            value={currentBand?.id ?? ''}
            onChange={handleBandChange}
            className="bg-[#2a2640] border border-purple-900/60 text-gray-100 text-sm rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-600"
          >
            {!currentBand && (
              <option value="" disabled>
                Select a band…
              </option>
            )}
            {sortedBands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <Link
        to="/profile"
        className={linkClass(pathname.startsWith('/profile'))}
      >
        Profile
      </Link>

      <button
        onClick={handleLogout}
        className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded hover:bg-red-900/40"
      >
        Logout
      </button>
    </nav>
  )
}
