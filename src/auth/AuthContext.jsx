import { createContext, useContext, useState, useEffect } from 'react'
import { refresh as refreshApi, login as loginApi, logout as logoutApi, getMe } from '../api/auth'
import { setAccessToken, clearAccessToken } from '../api/axiosInstance'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  // The current user's profile ({ firstName, lastName, email }), loaded from
  // GET /auth/me. Needed for display (e.g. the NavBar user menu) because names
  // are NOT in the JWT, so AuthContext.user (derived from the token after a
  // silent refresh) only has the id. Kept in sync with `token` via the effect
  // below so it is correct after mount, login, and in-place refresh.
  const [profile, setProfile] = useState(null)

  // On mount, attempt silent refresh to restore session
  useEffect(() => {
    refreshApi()
      .then((res) => {
        const newToken = res.data.accessToken
        setAccessToken(newToken)
        setToken(newToken)
        // Decode user from token payload (base64)
        try {
          const payload = JSON.parse(atob(newToken.split('.')[1]))
          setUser({ id: payload.sub })
        } catch {
          setUser({})
        }
      })
      .catch(() => {
        clearAccessToken()
        setToken(null)
        setUser(null)
      })
      .finally(() => setIsLoading(false))
  }, [])

  // Load the current user's profile whenever we have a token (and clear it when
  // we don't). Centralizes the GET /auth/me fetch so consumers get a reliable
  // name/email across mount, login, and refresh without each wiring it up.
  useEffect(() => {
    let active = true
    if (!token) {
      setProfile(null)
      return
    }
    getMe()
      .then((res) => {
        if (active) setProfile(res.data)
      })
      .catch(() => {
        // Non-fatal: the menu falls back to any email it has, or shows nothing.
        if (active) setProfile(null)
      })
    return () => {
      active = false
    }
  }, [token])

  const login = async (email, password) => {
    const res = await loginApi(email, password)
    const { accessToken, user: userData } = res.data
    setAccessToken(accessToken)
    setToken(accessToken)
    setUser(userData)
    return res
  }

  // Refresh the access token in place and push it into React state so consumers
  // (notably BandContext, which derives bands[]/role from `token`) re-derive
  // WITHOUT a full-page reload. Used after membership-changing actions
  // (create band, join approved, band rename, invite accept). Returns the new
  // token, or null if the refresh failed (callers can decide how to proceed).
  const refresh = async () => {
    const res = await refreshApi()
    const newToken = res?.data?.accessToken
    if (!newToken) return null
    setAccessToken(newToken)
    setToken(newToken)
    try {
      const payload = JSON.parse(atob(newToken.split('.')[1]))
      setUser({ id: payload.sub })
    } catch {
      setUser({})
    }
    return newToken
  }

  const logout = async () => {
    try {
      await logoutApi()
    } catch {
      // ignore errors on logout
    }
    clearAccessToken()
    setToken(null)
    setUser(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoading, profile, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
