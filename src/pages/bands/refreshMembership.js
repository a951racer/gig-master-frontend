import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { setCurrentBandId } from '../../api/axiosInstance'

// useRefreshMembership — in-place membership refresh (replaces the old
// full-page-reload workaround).
//
// After a membership-changing action (create band, join approved, band rename,
// invite accept) the JWT bands[] claim is stale. This hook refreshes the token
// IN PLACE via AuthContext.refresh() — which pushes the new token into
// AuthContext state, so BandContext re-derives bands[]/role without a reload —
// then navigates with the router (no window.location.assign).
//
// Band selection: when selectBandId is given, we persist it (setCurrentBandId)
// BEFORE refreshing, so when BandContext's effect runs against the new token it
// validates that persisted id against the fresh bands[] and restores it as the
// current band. This avoids a race with BandContext not having re-derived yet.
export function useRefreshMembership() {
  const { refresh } = useAuth()
  const navigate = useNavigate()

  return useCallback(
    async (destination, { selectBandId } = {}) => {
      if (selectBandId) {
        // Persist the intended selection first; BandContext restores it from
        // localStorage once it re-derives bands[] from the refreshed token.
        setCurrentBandId(selectBandId)
      }

      try {
        await refresh()
      } catch {
        // If the in-place refresh fails, fall back to a full navigation so
        // AuthContext's mount-time silent refresh re-syncs bands[]. (The axios
        // 401 interceptor is the ultimate backstop.)
        window.location.assign(destination)
        return
      }

      // In-place client-side navigation — AuthContext/BandContext have already
      // re-derived from the fresh token, so no reload is needed.
      navigate(destination)
    },
    [refresh, navigate]
  )
}
