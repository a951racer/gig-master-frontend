import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '../auth/AuthContext'
import { BandProvider } from '../auth/BandContext'
import ProtectedRoute from './ProtectedRoute'
import NavBar from '../components/NavBar'

import LoginPage from '../pages/auth/LoginPage'
import RegisterPage from '../pages/auth/RegisterPage'
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage'
import ResetPasswordPage from '../pages/auth/ResetPasswordPage'

// Lazy placeholders — will be replaced as pages are implemented
import { lazy, Suspense } from 'react'
const SongListPage = lazy(() => import('../pages/songs/SongListPage'))
const SongFormPage = lazy(() => import('../pages/songs/SongFormPage'))
const PlaylistListPage = lazy(() => import('../pages/playlists/PlaylistListPage'))
const PlaylistDetailPage = lazy(() => import('../pages/playlists/PlaylistDetailPage'))
const PlaylistFormPage = lazy(() => import('../pages/playlists/PlaylistFormPage'))
const GigListPage = lazy(() => import('../pages/gigs/GigListPage'))
const GigDetailPage = lazy(() => import('../pages/gigs/GigDetailPage'))
const GigFormPage = lazy(() => import('../pages/gigs/GigFormPage'))

// Band member pages
const CreateBandPage = lazy(() => import('../pages/bands/CreateBandPage'))
const JoinBandPage = lazy(() => import('../pages/bands/JoinBandPage'))
const JoinRequestsPage = lazy(() => import('../pages/bands/JoinRequestsPage'))

// Self-service profile page
const ProfilePage = lazy(() => import('../pages/profile/ProfilePage'))

// Band-admin pages (self-gate on currentBand.isAdmin)
const BandAdminPage = lazy(() => import('../pages/band-admin/BandAdminPage'))
const JoinRequestQueuePage = lazy(() => import('../pages/band-admin/JoinRequestQueuePage'))
const BandGenreEditorPage = lazy(() => import('../pages/band-admin/BandGenreEditorPage'))
const InvitesPage = lazy(() => import('../pages/band-admin/InvitesPage'))

// Public invite-accept landing page
const AcceptInvitePage = lazy(() => import('../pages/invites/AcceptInvitePage'))

// Sysadmin pages (self-gate on role === 'system_administrator')
const AdminPage = lazy(() => import('../pages/admin/AdminPage'))
const UserListPage = lazy(() => import('../pages/admin/users/UserListPage'))
const BandAdminListPage = lazy(() => import('../pages/admin/bands/BandAdminListPage'))
const SeedGenreListPage = lazy(() => import('../pages/admin/seed-genres/SeedGenreListPage'))

// Auth-aware fallback for unknown routes. Authenticated users go to the app
// home (/songs); everyone else goes to /login. Redirects rather than rendering
// the login form inline (which previously left the NavBar visible on dead
// routes like the removed /admin/genres).
function RootRedirect() {
  const { token, isLoading } = useAuth()
  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>
  }
  return <Navigate to={token ? '/songs' : '/login'} replace />
}

export default function AppRouter() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <AuthProvider>
        <BandProvider>
          <NavBar />
          <div
            className="min-h-screen bg-[#16132a] text-gray-100 bg-cover bg-center bg-no-repeat bg-fixed relative"
            style={{ backgroundImage: "linear-gradient(rgba(22, 19, 42, 0.7), rgba(22, 19, 42, 0.7)), url('/images/app-bg.png')" }}
          >
            <Suspense fallback={<div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>}>
              <Routes>
              {/* Public routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/invites/accept" element={<AcceptInvitePage />} />

              {/* Protected routes */}
              <Route path="/songs" element={<ProtectedRoute><SongListPage /></ProtectedRoute>} />
              <Route path="/songs/new" element={<ProtectedRoute><SongFormPage /></ProtectedRoute>} />
              <Route path="/songs/:id/edit" element={<ProtectedRoute><SongFormPage /></ProtectedRoute>} />
              <Route path="/playlists" element={<ProtectedRoute><PlaylistListPage /></ProtectedRoute>} />
              <Route path="/playlists/new" element={<ProtectedRoute><PlaylistFormPage /></ProtectedRoute>} />
              <Route path="/playlists/:id" element={<ProtectedRoute><PlaylistDetailPage /></ProtectedRoute>} />
              <Route path="/gigs" element={<ProtectedRoute><GigListPage /></ProtectedRoute>} />
              <Route path="/gigs/new" element={<ProtectedRoute><GigFormPage /></ProtectedRoute>} />
              <Route path="/gigs/:id/edit" element={<ProtectedRoute><GigFormPage /></ProtectedRoute>} />
              <Route path="/gigs/:id" element={<ProtectedRoute><GigDetailPage /></ProtectedRoute>} />

              {/* Self-service profile */}
              <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

              {/* Band member routes */}
              <Route path="/bands/new" element={<ProtectedRoute><CreateBandPage /></ProtectedRoute>} />
              <Route path="/bands/join" element={<ProtectedRoute><JoinBandPage /></ProtectedRoute>} />
              <Route path="/bands/requests" element={<ProtectedRoute><JoinRequestsPage /></ProtectedRoute>} />

              {/* Band-admin routes (pages self-gate on currentBand.isAdmin) */}
              <Route path="/band-admin" element={<ProtectedRoute><BandAdminPage /></ProtectedRoute>}>
                <Route index element={<Navigate to="/band-admin/join-requests" replace />} />
                <Route path="join-requests" element={<JoinRequestQueuePage />} />
                <Route path="genres" element={<BandGenreEditorPage />} />
                <Route path="invites" element={<InvitesPage />} />
              </Route>

              {/* Sysadmin routes (pages self-gate on role) */}
              <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>}>
                <Route index element={<Navigate to="/admin/users" replace />} />
                <Route path="users" element={<UserListPage />} />
                <Route path="bands" element={<BandAdminListPage />} />
                <Route path="seed-genres" element={<SeedGenreListPage />} />
              </Route>

              {/* Default redirect */}
              <Route path="*" element={<RootRedirect />} />
            </Routes>
            </Suspense>
          </div>
        </BandProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
