import { createContext, useContext, useState, useEffect } from 'react'
import { refresh as refreshApi, login as loginApi, logout as logoutApi } from '../api/auth'
import { setAccessToken, clearAccessToken } from '../api/axiosInstance'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

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

  const login = async (email, password) => {
    const res = await loginApi(email, password)
    const { accessToken, user: userData } = res.data
    setAccessToken(accessToken)
    setToken(accessToken)
    setUser(userData)
    return res
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
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
