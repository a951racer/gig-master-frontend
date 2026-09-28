import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'

const BandContext = createContext(null)

const CURRENT_BAND_ID_KEY = 'currentBandId'

// Decode the JWT payload the same way AuthContext does (base64 middle segment).
// Returns { bands, role } derived from the token claims, with safe defaults.
function decodeTokenClaims(token) {
  if (!token) {
    return { bands: [], role: undefined }
  }
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return {
      bands: Array.isArray(payload.bands) ? payload.bands : [],
      role: payload.role,
    }
  } catch {
    return { bands: [], role: undefined }
  }
}

export function BandProvider({ children }) {
  // Consume the token from AuthContext so decoding stays consistent with how
  // AuthContext obtains/decodes it. BandProvider must be nested inside AuthProvider.
  const { token } = useAuth()

  const [bands, setBands] = useState([])
  const [role, setRole] = useState(undefined)
  const [currentBand, setCurrentBandState] = useState(null)

  // Re-derive bands/role and re-validate the persisted current band whenever the
  // token changes (login, refresh, membership change).
  useEffect(() => {
    const { bands: nextBands, role: nextRole } = decodeTokenClaims(token)
    setBands(nextBands)
    setRole(nextRole)

    // Validate any persisted currentBandId against the token bands[].
    let persistedId = null
    try {
      persistedId = localStorage.getItem(CURRENT_BAND_ID_KEY)
    } catch {
      persistedId = null
    }

    const match = persistedId
      ? nextBands.find((b) => String(b.id) === String(persistedId))
      : undefined

    if (match) {
      // Persisted id matches a member band: restore it as the current band.
      setCurrentBandState(match)
    } else {
      // Stale/removed persisted id, or nothing persisted: fall back to the
      // no-band state and clear any stale persisted value. We do not auto-pick.
      if (persistedId) {
        try {
          localStorage.removeItem(CURRENT_BAND_ID_KEY)
        } catch {
          // ignore storage errors
        }
      }
      setCurrentBandState(null)
    }
  }, [token])

  // Select a band by id: validate against the current bands[], persist, and set.
  const setCurrentBand = useCallback(
    (id) => {
      const match = bands.find((b) => String(b.id) === String(id))
      if (match) {
        try {
          localStorage.setItem(CURRENT_BAND_ID_KEY, String(match.id))
        } catch {
          // ignore storage errors
        }
        setCurrentBandState(match)
      } else {
        // Unknown id: fall back to no-band state and clear persistence.
        try {
          localStorage.removeItem(CURRENT_BAND_ID_KEY)
        } catch {
          // ignore storage errors
        }
        setCurrentBandState(null)
      }
    },
    [bands]
  )

  const hasNoBand = bands.length === 0

  return (
    <BandContext.Provider
      value={{ bands, role, currentBand, setCurrentBand, hasNoBand }}
    >
      {children}
    </BandContext.Provider>
  )
}

export function useBand() {
  return useContext(BandContext)
}
