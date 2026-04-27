import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const navLinks = [
  { to: '/songs', label: 'Songs' },
  { to: '/playlists', label: 'Playlists' },
  { to: '/gigs', label: 'Gigs' },
  { to: '/admin/genres', label: 'Admin' },
]

export default function NavBar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  if (!user) return null

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <nav className="bg-[#1e1b2e] border-b border-purple-900/40 px-6 py-3 flex items-center gap-6">
      <span className="text-purple-400 font-bold text-lg tracking-wide mr-4">🎸 GigMaster</span>
      <div className="flex items-center gap-1 flex-1">
        {navLinks.map(({ to, label }) => {
          const active = pathname.startsWith(to)
          return (
            <Link
              key={to}
              to={to}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                active
                  ? 'bg-purple-700 text-white'
                  : 'text-gray-300 hover:bg-purple-900/40 hover:text-white'
              }`}
            >
              {label}
            </Link>
          )
        })}
      </div>
      <button
        onClick={handleLogout}
        className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded hover:bg-red-900/40"
      >
        Logout
      </button>
    </nav>
  )
}
