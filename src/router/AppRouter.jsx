import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '../auth/AuthContext'
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
const AdminPage = lazy(() => import('../pages/admin/AdminPage'))
const GenreListPage = lazy(() => import('../pages/admin/genres/GenreListPage'))

export default function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NavBar />
        <div className="min-h-screen bg-[#16132a] text-gray-100">
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
            <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>}>
              <Route path="genres" element={<GenreListPage />} />
            </Route>

            {/* Default redirect */}
            <Route path="*" element={<LoginPage />} />
          </Routes>
          </Suspense>
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}
