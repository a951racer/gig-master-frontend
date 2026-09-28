import { refresh as refreshApi } from '../../api/auth'
import { setAccessToken, setCurrentBandId } from '../../api/axiosInstance'

// Refresh the session so a membership change (band created, join approved)
// appears in the token's bands[] and the band becomes selectable (Req 7.1,
// 7.2, 16.1, 16.4).
//
// AuthContext limitation: AuthContext exposes only { user, token, isLoading,
// login, logout } — there is no setter to push a freshly-refreshed token into
// its `token` state, and BandContext derives `bands`/`role` from that state.
// So calling /auth/refresh here alone would update the axios access token but
// NOT the React-side bands[] until the next silent refresh (AuthContext's mount
// effect) runs. To make the new/joined band reliably selectable right away, we
// fetch the refreshed token, store it for outgoing requests, optionally select
// the target band, then trigger a full-page navigation. AuthContext re-mounts,
// runs its own silent refresh, and BandContext re-derives bands[] from the new
// token — after which the band is selectable in the switcher.
export async function refreshMembershipAndGo(destination, { selectBandId } = {}) {
  try {
    const res = await refreshApi()
    const newToken = res?.data?.accessToken
    if (newToken) {
      setAccessToken(newToken)
    }
  } catch {
    // If the refresh call fails we still navigate; AuthContext's mount-time
    // silent refresh is the backstop for syncing bands[].
  }

  if (selectBandId) {
    // Persist the selection so the switcher restores it once BandContext
    // re-derives bands[] from the refreshed token after reload.
    setCurrentBandId(selectBandId)
  }

  // Full-page navigation so AuthContext/BandContext re-derive from the fresh
  // token (see limitation note above).
  window.location.assign(destination)
}
