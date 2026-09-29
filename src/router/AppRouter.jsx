import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '../auth/AuthContext'
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

// Band-admin pages (self-gate on currentBand.isAdmin)
const BandAdminPage = lazy(() => import('../pages/band-admin/BandAdminPage'))
const JoinRequestQueuePage = lazy(() => import('../pages/band-admin/JoinRequestQueuePage'))
const BandGenreEditorPage = lazy(() => import('../pages/band-admin/BandGenreEditorPage'))

// Sysadmin pages (self-gate on role === 'system_administrator')
const AdminPage = lazy(() => import('../pages/admin/AdminPage'))
const GenreListPage = lazy(() => import('../pages/admin/genres/GenreListPage'))
const UserListPage = lazy(() => import('../pages/admin/users/UserListPage'))
const BandAdminListPage = lazy(() => import('../pages/admin/bands/BandAdminListPage'))
const SeedGenreListPage = lazy(() => import('../pages/admin/seed-genres/SeedGenreListPage'))

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

              {/* Band member routes */}
              <Route path="/bands/new" element={<ProtectedRoute><CreateBandPage /></ProtectedRoute>} />
              <Route path="/bands/join" element={<ProtectedRoute><JoinBandPage /></ProtectedRoute>} />
              <Route path="/bands/requests" element={<ProtectedRoute><JoinRequestsPage /></ProtectedRoute>} />

              {/* Band-admin routes (pages self-gate on currentBand.isAdmin) */}
              <Route path="/band-admin" element={<ProtectedRoute><BandAdminPage /></ProtectedRoute>}>
                <Route index element={<JoinRequestQueuePage />} />
                <Route path="join-requests" element={<JoinRequestQueuePage />} />
                <Route path="genres" element={<BandGenreEditorPage />} />
              </Route>

              {/* Sysadmin routes (pages self-gate on role) */}
              <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>}>
                <Route path="genres" element={<GenreListPage />} />
                <Route path="users" element={<UserListPage />} />
                <Route path="bands" element={<BandAdminListPage />} />
                <Route path="seed-genres" element={<SeedGenreListPage />} />
              </Route>

              {/* Default redirect */}
              <Route path="*" element={<LoginPage />} />
            </Routes>
            </Suspense>
          </div>
        </BandProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
