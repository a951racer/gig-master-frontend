import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export default function ProtectedRoute({ children }) {
  const { token, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (!token) {
    // Preserve where the user was headed so LoginPage can return them there
    // after sign-in (e.g. a deep link into /live). Without this, an
    // unauthenticated hit on /live bounces to the app default (/songs) after
    // login instead of back to the mobile performance flow.
    const next = `${location.pathname}${location.search}`
    const to = next && next !== '/' ? `/login?next=${encodeURIComponent(next)}` : '/login'
    return <Navigate to={to} replace />
  }

  return children
}
