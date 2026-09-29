import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

// Mock AuthContext so BandProvider consumes a controlled token via useAuth().
vi.mock('./AuthContext', () => {
  return {
    // Value is set per-test through the mutable holder below.
    useAuth: () => ({ token: authState.token }),
  }
})

import { BandProvider, useBand } from './BandContext'

// Mutable holder the mocked useAuth reads from.
const authState = { token: null }

const CURRENT_BAND_ID_KEY = 'currentBandId'

// jsdom in this project runs without a persistent localStorage backend, so we
// install a minimal in-memory implementation that both BandContext and these
// tests share. Guards in BandContext tolerate its absence, but the tests need a
// real store to seed/read persisted ids.
function installMemoryLocalStorage() {
  const store = new Map()
  const mock = {
    getItem: (k) => (store.has(String(k)) ? store.get(String(k)) : null),
    setItem: (k, v) => {
      store.set(String(k), String(v))
    },
    removeItem: (k) => {
      store.delete(String(k))
    },
    clear: () => {
      store.clear()
    },
  }
  Object.defineProperty(globalThis, 'localStorage', {
    value: mock,
    configurable: true,
    writable: true,
  })
  return mock
}

installMemoryLocalStorage()

// Build a fake JWT string `header.<base64(payload)>.sig` whose middle segment
// decodes via atob() exactly like BandContext/AuthContext expect.
function makeToken({ sub = 'user-1', role, bands = [] } = {}) {
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }))
  const payload = btoa(JSON.stringify({ sub, role, bands }))
  return `${header}.${payload}.sig`
}

// Test consumer that surfaces the useBand() values for assertions.
function BandProbe() {
  const { bands, role, currentBand, hasNoBand } = useBand()
  return (
    <div>
      <span data-testid="bands">{JSON.stringify(bands)}</span>
      <span data-testid="role">{String(role)}</span>
      <span data-testid="currentBand">{JSON.stringify(currentBand)}</span>
      <span data-testid="hasNoBand">{String(hasNoBand)}</span>
    </div>
  )
}

function renderWithToken(token) {
  authState.token = token
  return render(
    <BandProvider>
      <BandProbe />
    </BandProvider>
  )
}

function readBands() {
  return JSON.parse(screen.getByTestId('bands').textContent)
}
function readRole() {
  return screen.getByTestId('role').textContent
}
function readCurrentBand() {
  return JSON.parse(screen.getByTestId('currentBand').textContent)
}
function readHasNoBand() {
  return screen.getByTestId('hasNoBand').textContent === 'true'
}

beforeEach(() => {
  authState.token = null
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  localStorage.clear()
})

// Generated, representative decoded-token shapes covering empty membership,
// single band, several bands, and varying roles.
const TOKEN_CASES = [
  { name: 'empty bands / user role', role: 'user', bands: [] },
  {
    name: 'single band, band-admin membership',
    role: 'user',
    bands: [{ id: 'b1', name: 'The Ones', isAdmin: true }],
  },
  {
    name: 'several bands, mixed isAdmin',
    role: 'user',
    bands: [
      { id: 'b1', name: 'Alpha', isAdmin: false },
      { id: 'b2', name: 'Beta', isAdmin: true },
      { id: 'b3', name: 'Gamma', isAdmin: false },
    ],
  },
  {
    name: 'system administrator with bands',
    role: 'system_administrator',
    bands: [
      { id: 'b7', name: 'Sysadmin Band', isAdmin: false },
      { id: 'b8', name: 'Second', isAdmin: true },
    ],
  },
  {
    name: 'system administrator, no bands',
    role: 'system_administrator',
    bands: [],
  },
  { name: 'no token (null)', token: null },
]

describe('BandContext — band selection logic (property-style)', () => {
  // Feature: bands, Property 19: Switcher options mirror the token membership claim
  describe('Property 19: Switcher options mirror the token membership claim', () => {
    for (const c of TOKEN_CASES) {
      it(`derives bands/role/hasNoBand from token: ${c.name}`, () => {
        const token = 'token' in c ? c.token : makeToken({ role: c.role, bands: c.bands })
        const expectedBands = 'token' in c ? [] : c.bands
        const expectedRole = 'token' in c ? undefined : c.role

        renderWithToken(token)

        // Switcher options == token bands[] (the data the switcher renders from).
        expect(readBands()).toEqual(expectedBands)

        // Role == token role (drives sysadmin visibility elsewhere).
        expect(readRole()).toBe(String(expectedRole))

        // hasNoBand === (bands.length === 0).
        expect(readHasNoBand()).toBe(expectedBands.length === 0)

        // Sanity: the per-band isAdmin flag (drives band-admin visibility) is
        // preserved exactly as claimed in the token.
        const bands = readBands()
        bands.forEach((b, i) => {
          expect(b.isAdmin).toBe(expectedBands[i].isAdmin)
        })
      })
    }
  })

  // Feature: bands, Property 20: Persisted current band is validated against the token
  describe('Property 20: Persisted current band is validated against the token', () => {
    const bandsFixture = [
      { id: 'b1', name: 'Alpha', isAdmin: false },
      { id: 'b2', name: 'Beta', isAdmin: true },
    ]

    // Each case: what id is persisted before mount, and whether it is a member.
    const PERSIST_CASES = [
      {
        name: 'persisted id present in token bands[] (b1)',
        persisted: 'b1',
        bands: bandsFixture,
        expectMatchId: 'b1',
      },
      {
        name: 'persisted id present in token bands[] (b2)',
        persisted: 'b2',
        bands: bandsFixture,
        expectMatchId: 'b2',
      },
      {
        name: 'persisted id absent from token bands[] (stale)',
        persisted: 'b-stale',
        bands: bandsFixture,
        expectMatchId: null,
      },
      {
        name: 'persisted id but token has no bands',
        persisted: 'b1',
        bands: [],
        expectMatchId: null,
      },
      {
        name: 'no persisted id, several bands (no auto-pick)',
        persisted: null,
        bands: bandsFixture,
        expectMatchId: null,
      },
      {
        name: 'no persisted id, empty bands',
        persisted: null,
        bands: [],
        expectMatchId: null,
      },
    ]

    for (const c of PERSIST_CASES) {
      it(`validates persisted current band: ${c.name}`, () => {
        localStorage.clear()
        if (c.persisted !== null) {
          localStorage.setItem(CURRENT_BAND_ID_KEY, c.persisted)
        }

        const token = makeToken({ role: 'user', bands: c.bands })
        renderWithToken(token)

        const currentBand = readCurrentBand()

        if (c.expectMatchId) {
          // currentBand is set IFF persisted id is a member band.
          expect(currentBand).not.toBeNull()
          expect(currentBand.id).toBe(c.expectMatchId)
          // Valid persisted value is retained.
          expect(localStorage.getItem(CURRENT_BAND_ID_KEY)).toBe(c.expectMatchId)
        } else {
          // Otherwise: no-band fallback (currentBand null).
          expect(currentBand).toBeNull()

          if (c.persisted !== null) {
            // Stale persisted value is cleared.
            expect(localStorage.getItem(CURRENT_BAND_ID_KEY)).toBeNull()
          }
        }
      })
    }
  })
})
