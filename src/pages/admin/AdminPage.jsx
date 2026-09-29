import { Outlet, NavLink } from 'react-router-dom'
import { useBand } from '../../auth/BandContext'

export default function AdminPage() {
  const { role } = useBand()
  const isSysAdmin = role === 'system_administrator'

  const linkCls = ({ isActive }) =>
    `text-sm px-3 py-2 rounded-lg transition-colors ${
      isActive
        ? 'bg-purple-700 text-white'
        : 'text-gray-300 hover:text-white hover:bg-purple-900/30'
    }`

  return (
    <div className="max-w-xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-white mb-6">Admin</h1>
      <nav className="flex flex-wrap gap-2 mb-6">
        {/* Sysadmin-only links, gated on the decoded token role (Req 18.4/18.5). */}
        {isSysAdmin && (
          <>
            <NavLink to="/admin/users" className={linkCls}>
              Users
            </NavLink>
            <NavLink to="/admin/bands" className={linkCls}>
              Bands
            </NavLink>
            <NavLink to="/admin/seed-genres" className={linkCls}>
              Seed Genres
            </NavLink>
          </>
        )}
      </nav>
      <Outlet />
    </div>
  )
}
