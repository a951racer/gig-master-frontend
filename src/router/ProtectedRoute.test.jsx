import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

// Mock useAuth so each test controls token/isLoading.
const authState = { token: null, isLoading: false }
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => authState,
}))

import ProtectedRoute from './ProtectedRoute'

// Render ProtectedRoute at `initialPath`, with a /login route that echoes the
// full location (path + query) so we can assert the preserved `next` param.
function renderAt(initialPath) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/login"
          element={
            <LocationEcho />
          }
        />
        <Route
          path="*"
          element={
            <ProtectedRoute>
              <div>protected content</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  )
}

import { useLocation } from 'react-router-dom'
function LocationEcho() {
  const loc = useLocation()
  return <div data-testid="login">{`${loc.pathname}${loc.search}`}</div>
}

beforeEach(() => {
  authState.token = null
  authState.isLoading = false
})

describe('ProtectedRoute', () => {
  it('shows a loading state while auth is resolving', () => {
    authState.isLoading = true
    renderAt('/live')
    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(screen.queryByText('protected content')).not.toBeInTheDocument()
  })

  it('redirects an unauthenticated user to /login preserving the attempted path as ?next=', () => {
    authState.token = null
    renderAt('/live')
    // The /login route rendered, and next encodes the original /live path.
    expect(screen.getByTestId('login')).toHaveTextContent('/login?next=%2Flive')
  })

  it('preserves a nested path + query in next', () => {
    authState.token = null
    renderAt('/live/gigs/abc?x=1')
    expect(screen.getByTestId('login')).toHaveTextContent(
      '/login?next=%2Flive%2Fgigs%2Fabc%3Fx%3D1'
    )
  })

  it('renders the protected content when authenticated', () => {
    authState.token = 'jwt-token'
    renderAt('/live')
    expect(screen.getByText('protected content')).toBeInTheDocument()
  })
})
