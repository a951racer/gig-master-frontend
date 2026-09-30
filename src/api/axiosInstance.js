import axios from 'axios'

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  withCredentials: true, // send httpOnly refresh token cookie automatically
})

// Token storage — module-level so interceptors can access it
let accessToken = null

export function setAccessToken(token) {
  accessToken = token
}

export function getAccessToken() {
  return accessToken
}

export function clearAccessToken() {
  accessToken = null
}

// Current band storage — module-level so the request interceptor can attach the
// active band on every band-scoped request without touching React state. It is
// initialized from localStorage so a hard reload keeps sending the last-selected
// band before BandContext mounts and re-syncs it.
const CURRENT_BAND_ID_KEY = 'currentBandId'

let currentBandId = null
try {
  currentBandId = localStorage.getItem(CURRENT_BAND_ID_KEY)
} catch {
  currentBandId = null
}

// Keep the module-level current band id in sync with localStorage. BandContext
// calls this when the user selects/switches a band (or clears it). Persisting
// here means a subsequent module load re-reads the same value above.
export function setCurrentBandId(id) {
  if (id === null || id === undefined || id === '') {
    currentBandId = null
    try {
      localStorage.removeItem(CURRENT_BAND_ID_KEY)
    } catch {
      // ignore storage errors
    }
    return
  }
  currentBandId = String(id)
  try {
    localStorage.setItem(CURRENT_BAND_ID_KEY, currentBandId)
  } catch {
    // ignore storage errors
  }
}

export function getCurrentBandId() {
  return currentBandId
}

// Token-refresh hook — BandContext registers a callback so that after a silent
// 401 refresh (which may return a token with a different bands[] claim) it can
// re-derive `bands` and re-validate the persisted `currentBandId`. Optional and
// a no-op until registered.
let tokenRefreshedCb = null

export function onTokenRefreshed(cb) {
  tokenRefreshedCb = typeof cb === 'function' ? cb : null
}

function notifyTokenRefreshed(token) {
  if (tokenRefreshedCb) {
    try {
      tokenRefreshedCb(token)
    } catch {
      // A misbehaving listener must not break the request/refresh flow.
    }
  }
}

// A 403 carrying one of these codes is a band-selection problem, not an auth
// failure. It must NOT trigger the /login redirect — callers/BandContext route
// to the no-band (create-or-join / re-select) state instead.
const NO_BAND_ERROR_CODES = ['BAND_REQUIRED', 'BAND_NOT_A_MEMBER']

export function isNoBandError(error) {
  return (
    error?.response?.status === 403 &&
    NO_BAND_ERROR_CODES.includes(error?.response?.data?.error?.code)
  )
}

// Request interceptor — attach Bearer token and, when a band is selected, the
// active band via X-Band-Id (no token rotation on band switch).
axiosInstance.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers['Authorization'] = `Bearer ${accessToken}`
  }
  if (currentBandId) {
    config.headers['X-Band-Id'] = currentBandId
  }
  return config
})

// Auth endpoints (login/refresh/register) must NOT trigger the silent-refresh
// retry: a 401 from them is a genuine credential/session failure that should
// reject straight through so the calling page can show the error. Running the
// refresh flow for these caused the login form to hang and forced a redirect
// instead of surfacing 'invalid credentials'.
const AUTH_ENDPOINTS = ['/auth/login', '/auth/refresh', '/auth/register']
function isAuthEndpoint(url) {
  return typeof url === 'string' && AUTH_ENDPOINTS.some((p) => url.includes(p))
}

// Response interceptor — on 401, attempt silent refresh then retry
let isRefreshing = false
let failedQueue = []

function processQueue(error, token = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // A no-band 403 (BAND_REQUIRED / BAND_NOT_A_MEMBER) is a band-selection
    // issue, not an auth failure: reject so callers/BandContext can route to the
    // no-band state. Never attempt refresh or redirect to /login for these.
    if (isNoBandError(error)) {
      return Promise.reject(error)
    }

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isAuthEndpoint(originalRequest?.url)
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`
            return axiosInstance(originalRequest)
          })
          .catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const res = await axiosInstance.post('/auth/refresh')
        const newToken = res.data.accessToken
        setAccessToken(newToken)
        // The refreshed token's bands[] may differ — let BandContext re-derive
        // bands and re-validate the current band before the retry goes out.
        notifyTokenRefreshed(newToken)
        processQueue(null, newToken)
        originalRequest.headers['Authorization'] = `Bearer ${newToken}`
        return axiosInstance(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        clearAccessToken()
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

export default axiosInstance
