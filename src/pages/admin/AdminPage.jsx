import { Outlet, NavLink } from 'react-router-dom'
import { useBand } from '../../auth/BandContext'

export default function AdminPage() {
  const { role } = useBand()
  const isSysAdmin = role === 'system_administrator'

  return (
    <div>
      <h1>Admin</h1>
      <nav>
        <NavLink to="/admin/genres">Genres</NavLink>
        {/* Sysadmin-only links, gated on the decoded token role (Req 18.4/18.5). */}
        {isSysAdmin && (
          <>
            <NavLink to="/admin/users">Users</NavLink>
            <NavLink to="/admin/bands">Bands</NavLink>
            <NavLink to="/admin/seed-genres">Seed Genres</NavLink>
          </>
        )}
      </nav>
      <Outlet />
    </div>
  )
}
