import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import axiosInstance, {
  setAccessToken,
  clearAccessToken,
  resolveApiBaseUrl,
} from './axiosInstance'

// ---------------------------------------------------------------------------
// These tests exercise the REAL response interceptor in axiosInstance.js by
// swapping in a custom axios adapter. The adapter never touches the network:
// it consults a per-test router that decides, based on the request url, whether
// to resolve (2xx) or reject (4xx) and records how many times each url was hit.
// Driving the real instance this way makes these true regression tests of the
// silent-refresh / auth-endpoint-guard logic rather than a mock of a wrapper.
// ---------------------------------------------------------------------------

// Records url -> call count so tests can assert e.g. /auth/refresh was never
// attempted, or /songs was retried exactly once.
let calls
// Router: (config) => queued response descriptor for that request. Each test
// installs its own via `route(...)`.
let router

/**
 * Match a config's url against a path fragment the way the interceptor's
 * isAuthEndpoint does (substring match), so baseURL prefixes don't matter.
 */
function urlIncludes(config, fragment) {
  return typeof config.url === 'string' && config.url.includes(fragment)
}

/**
 * Build an axios-shaped response object bound to the request config.
 */
function makeResponse(config, { status, data }) {
  return {
    data,
    status,
    statusText: String(status),
    headers: {},
    config,
    request: {},
  }
}

/**
 * Build an axios error the way the real adapter would for a non-2xx status:
 * an Error carrying `.config` and `.response`, which is what the interceptor
 * reads (error.config, error.response.status, error.response.data).
 */
function makeError(config, response) {
  const err = new Error(`Request failed with status code ${response.status}`)
  err.config = config
  err.response = response
  err.isAxiosError = true
  return err
}

// The custom adapter installed on the shared instance for the whole suite.
// It defers all decisions to the current test's `router`.
function adapter(config) {
  const key = config.url
  calls.set(key, (calls.get(key) || 0) + 1)

  const descriptor = router(config)
  if (!descriptor) {
    return Promise.reject(
      makeError(
        config,
        makeResponse(config, { status: 500, data: { error: 'no route' } })
      )
    )
  }

  const response = makeResponse(config, descriptor)
  if (descriptor.status >= 200 && descriptor.status < 300) {
    return Promise.resolve(response)
  }
  return Promise.reject(makeError(config, response))
}

function callCount(fragment) {
  let total = 0
  for (const [url, count] of calls.entries()) {
    if (typeof url === 'string' && url.includes(fragment)) total += count
  }
  return total
}

// window.location stubbing — the interceptor does `window.location.href =
// '/login'` on refresh failure, which throws "Not implemented: navigation" in
// jsdom. We replace window.location with a plain object exposing a writable
// href so the assignment is observable and harmless, then restore it.
let originalLocation
function stubLocation() {
  originalLocation = window.location
  delete window.location
  window.location = { href: 'http://localhost/', assign: vi.fn() }
}
function restoreLocation() {
  window.location = originalLocation
}

const originalAdapter = axiosInstance.defaults.adapter

beforeEach(() => {
  calls = new Map()
  router = () => null
  axiosInstance.defaults.adapter = adapter
  setAccessToken('tok')
  stubLocation()
})

afterEach(() => {
  axiosInstance.defaults.adapter = originalAdapter
  clearAccessToken()
  restoreLocation()
  vi.restoreAllMocks()
})

describe('axiosInstance response interceptor', () => {
  it('rejects a 401 from an auth endpoint WITHOUT attempting refresh or redirect (regression)', async () => {
    // /auth/login always returns 401 (bad credentials).
    router = (config) => {
      if (urlIncludes(config, '/auth/login')) {
        return { status: 401, data: { error: 'invalid credentials' } }
      }
      return null
    }

    await expect(
      axiosInstance.post('/auth/login', { email: 'a@b.c', password: 'bad' })
    ).rejects.toMatchObject({ response: { status: 401 } })

    // The core of the fix: no silent refresh was attempted...
    expect(callCount('/auth/refresh')).toBe(0)
    // ...and the login endpoint was hit exactly once (no retry loop).
    expect(callCount('/auth/login')).toBe(1)
    // ...and the user was NOT redirected to /login.
    expect(window.location.href).toBe('http://localhost/')
  })

  it('rejects a 401 from /auth/refresh without recursing into another refresh', async () => {
    router = (config) => {
      if (urlIncludes(config, '/auth/refresh')) {
        return { status: 401, data: { error: 'expired session' } }
      }
      return null
    }

    await expect(axiosInstance.post('/auth/refresh')).rejects.toMatchObject({
      response: { status: 401 },
    })

    // Only the single direct call; the interceptor must not re-refresh.
    expect(callCount('/auth/refresh')).toBe(1)
    expect(window.location.href).toBe('http://localhost/')
  })

  it('on a normal-endpoint 401 refreshes then retries the original request', async () => {
    // /songs 401s the first time, succeeds the second (post-refresh) time.
    let songsCalls = 0
    router = (config) => {
      if (urlIncludes(config, '/auth/refresh')) {
        return { status: 200, data: { accessToken: 'new' } }
      }
      if (urlIncludes(config, '/songs')) {
        songsCalls += 1
        if (songsCalls === 1) return { status: 401, data: { error: 'expired' } }
        return { status: 200, data: [{ id: 1, title: 'retry ok' }] }
      }
      return null
    }

    const res = await axiosInstance.get('/songs')

    expect(res.status).toBe(200)
    expect(res.data).toEqual([{ id: 1, title: 'retry ok' }])
    expect(callCount('/auth/refresh')).toBe(1)
    // Original request attempted twice: initial 401 + post-refresh retry.
    expect(callCount('/songs')).toBe(2)
    expect(window.location.href).toBe('http://localhost/')
  })

  it('on a normal-endpoint 401 with a failed refresh, rejects and redirects to /login', async () => {
    router = (config) => {
      if (urlIncludes(config, '/auth/refresh')) {
        return { status: 401, data: { error: 'refresh failed' } }
      }
      if (urlIncludes(config, '/protected')) {
        return { status: 401, data: { error: 'expired' } }
      }
      return null
    }

    await expect(axiosInstance.get('/protected')).rejects.toBeTruthy()

    expect(callCount('/auth/refresh')).toBe(1)
    // /protected was only attempted once — no retry since refresh failed.
    expect(callCount('/protected')).toBe(1)
    expect(window.location.href).toBe('/login')
  })

  it('rejects a no-band 403 without attempting refresh or redirect', async () => {
    router = (config) => {
      if (urlIncludes(config, '/band-scoped')) {
        return {
          status: 403,
          data: { error: { code: 'BAND_NOT_A_MEMBER' } },
        }
      }
      return null
    }

    await expect(axiosInstance.get('/band-scoped')).rejects.toMatchObject({
      response: { status: 403, data: { error: { code: 'BAND_NOT_A_MEMBER' } } },
    })

    expect(callCount('/auth/refresh')).toBe(0)
    expect(callCount('/band-scoped')).toBe(1)
    expect(window.location.href).toBe('http://localhost/')
  })
})

// Runtime API base URL resolution (#8): runtime config wins over the build-time
// env var, which wins over the localhost fallback.
describe('resolveApiBaseUrl (#8 runtime config)', () => {
  afterEach(() => {
    delete window.__APP_CONFIG__
  })

  it('prefers window.__APP_CONFIG__.apiUrl when set', () => {
    window.__APP_CONFIG__ = { apiUrl: 'https://runtime-api.example.com' }
    expect(resolveApiBaseUrl()).toBe('https://runtime-api.example.com')
  })

  it('falls back past an empty runtime apiUrl', () => {
    // An empty runtime value (the committed default) must not win; it falls
    // through to the build-time env or localhost.
    window.__APP_CONFIG__ = { apiUrl: '' }
    const resolved = resolveApiBaseUrl()
    expect(resolved).not.toBe('')
    // In the test env VITE_API_URL is unset, so it lands on the localhost default.
    expect(resolved).toBe(import.meta.env.VITE_API_URL || 'http://localhost:3001')
  })

  it('uses the localhost default when neither runtime nor build-time is set', () => {
    expect(resolveApiBaseUrl()).toBe(import.meta.env.VITE_API_URL || 'http://localhost:3001')
  })
})
