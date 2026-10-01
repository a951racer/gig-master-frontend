import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act, cleanup } from '@testing-library/react'

// Mock the auth API: AuthProvider calls refresh() on mount (silent restore) and
// again when its exposed refresh() is invoked. login/logout are unused here.
vi.mock('../api/auth', () => ({
  refresh: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}))

// Stub the axios token setters so no real axios runs. Back setCurrentBandId with
// an in-memory localStorage-like store so BandContext's persisted-id validation
// works (BandContext imports setCurrentBandId from axiosInstance).
const store = new Map()
vi.mock('../api/axiosInstance', () => ({
  setAccessToken: vi.fn(),
  clearAccessToken: vi.fn(),
  setCurrentBandId: (id) => {
    if (id === null || id === undefined || id === '') store.delete('currentBandId')
    else store.set('currentBandId', String(id))
  },
}))

import { AuthProvider, useAuth } from './AuthContext'
import { BandProvider, useBand } from './BandContext'
import { refresh as refreshApi } from '../api/auth'

// Build a fake JWT whose middle segment base64-decodes to the given claims,
// matching how AuthContext/BandContext decode (atob of the payload segment).
function makeToken({ sub = 'u1', role = 'user', bands = [] } = {}) {
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }))
  const payload = btoa(JSON.stringify({ sub, role, bands }))
  return `${header}.${payload}.sig`
}

// Install a minimal in-memory localStorage (jsdom here has none persistent),
// shared with the setCurrentBandId mock above.
beforeEach(() => {
  store.clear()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
    },
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// Probe exposes the in-place refresh() and the derived band context so the test
// can trigger a refresh and assert the band switcher data updated with no reload.
let doRefresh
function Probe() {
  const { refresh, token } = useAuth()
  const { bands } = useBand()
  doRefresh = refresh
  return (
    <div>
      <span data-testid="token">{token || ''}</span>
      <span data-testid="bands">{JSON.stringify(bands)}</span>
    </div>
  )
}

describe('AuthContext in-place refresh (#44)', () => {
  it('refresh() updates the token so BandContext re-derives bands[] without a reload', async () => {
    const initialToken = makeToken({ bands: [{ id: 'b1', name: 'Alpha', isAdmin: false }] })
    const refreshedToken = makeToken({
      bands: [
        { id: 'b1', name: 'Alpha', isAdmin: false },
        { id: 'b2', name: 'Beta', isAdmin: true },
      ],
    })

    // Mount-time silent refresh returns the initial (one-band) token.
    refreshApi.mockResolvedValueOnce({ data: { accessToken: initialToken } })

    render(
      <AuthProvider>
        <BandProvider>
          <Probe />
        </BandProvider>
      </AuthProvider>
    )

    // After mount, band context reflects the initial single band.
    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId('bands').textContent)).toHaveLength(1)
    })

    // Next refresh (the in-place one) returns a token with a second band.
    refreshApi.mockResolvedValueOnce({ data: { accessToken: refreshedToken } })

    await act(async () => {
      await doRefresh()
    })

    // Band context re-derived from the new token — WITHOUT any navigation/reload.
    await waitFor(() => {
      const bands = JSON.parse(screen.getByTestId('bands').textContent)
      expect(bands).toHaveLength(2)
      expect(bands.map((b) => b.id)).toEqual(['b1', 'b2'])
    })
  })

  it('refresh() returns null when the refresh yields no token', async () => {
    refreshApi.mockResolvedValueOnce({ data: { accessToken: makeToken() } })

    render(
      <AuthProvider>
        <BandProvider>
          <Probe />
        </BandProvider>
      </AuthProvider>
    )
    await waitFor(() => expect(doRefresh).toBeTypeOf('function'))

    refreshApi.mockResolvedValueOnce({ data: {} })
    let result
    await act(async () => {
      result = await doRefresh()
    })
    expect(result).toBeNull()
  })
})
