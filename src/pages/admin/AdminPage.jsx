import { Outlet, NavLink } from 'react-router-dom'

export default function AdminPage() {
  return (
    <div>
      <h1>Admin</h1>
      <nav>
        <NavLink to="/admin/genres">Genres</NavLink>
      </nav>
      <Outlet />
    </div>
  )
}
