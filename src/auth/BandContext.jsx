import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { setCurrentBandId } from '../api/axiosInstance'

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
      // Persisted id matches a member band: restore it as the current band and
      // sync the axios X-Band-Id header var.
      setCurrentBandId(match.id)
      setCurrentBandState(match)
    } else if (nextBands.length > 0) {
      // No valid persisted selection but the user belongs to bands: auto-select
      // the first band alphabetically by name and persist it, so the user lands
      // on a working band context immediately after login (rather than a null
      // selection that would make band-scoped requests fail).
      const firstAlphabetical = [...nextBands].sort((a, b) =>
        String(a.name || '').localeCompare(String(b.name || ''))
      )[0]
      // setCurrentBandId persists to localStorage AND syncs the axios header var.
      setCurrentBandId(firstAlphabetical.id)
      setCurrentBandState(firstAlphabetical)
    } else {
      // The user belongs to no bands: clear any stale persisted value and enter
      // the no-band state (the UI prompts them to create or join a band).
      setCurrentBandId(null) // clears the axios header var + localStorage
      setCurrentBandState(null)
    }
  }, [token])

  // Select a band by id: validate against the current bands[], persist, and set.
  const setCurrentBand = useCallback(
    (id) => {
      const match = bands.find((b) => String(b.id) === String(id))
      if (match) {
        // setCurrentBandId persists to localStorage AND syncs the axios header.
        setCurrentBandId(match.id)
        setCurrentBandState(match)
      } else {
        // Unknown id: fall back to no-band state and clear persistence + header.
        setCurrentBandId(null)
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
