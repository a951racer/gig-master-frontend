import { Outlet, NavLink } from 'react-router-dom'
import { useBand } from '../../auth/BandContext'

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
      </nav>
      <Outlet />
    </div>
  )
}
