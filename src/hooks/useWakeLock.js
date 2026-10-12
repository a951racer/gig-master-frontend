import { useEffect, useRef, useState } from 'react'

// Screen Wake Lock hook for Gig Master Live performance mode (Phase 2, Req 4).
//
// While `active` and the Screen Wake Lock API is supported, hold a `'screen'`
// wake lock so the iPad display never dims or sleeps mid-song (Req 4.1). The
// sentinel is released when `active` flips false or the component unmounts
// (Req 4.2). The platform auto-releases the sentinel whenever the document is
// hidden, so we re-acquire on `visibilitychange` → `visible` while still active
// (Req 4.3). If the API is missing or `request(...)` rejects we no-op quietly —
// performance mode keeps working and no blocking error is surfaced (Req 4.4).
//
// Lifecycle safety (Design Property 4): never hold more than one sentinel and
// always release on deactivate/unmount. Requests are async, so an effect run
// that is torn down (StrictMode double-invoke, rapid `active` toggles, unmount)
// before its request resolves must release the just-acquired sentinel rather
// than leak it. We guard every effect run with a `cancelled` flag and keep the
// live sentinel in a ref so cleanup can release whatever is currently held.
//
// Returns `{ supported, active }` where `supported` reflects API availability
// and `active` reflects whether a sentinel is currently held.

const SUPPORTED =
  typeof navigator !== 'undefined' && 'wakeLock' in navigator

export function useWakeLock(active = true) {
  // The sentinel currently held (or null). A ref so async callbacks and the
  // cleanup function always see the latest value without re-running the effect.
  const sentinelRef = useRef(null)
  // Whether a sentinel is currently held — surfaced to callers as `active`.
  const [isHeld, setIsHeld] = useState(false)

  useEffect(() => {
    // Nothing to do when deactivated or on an unsupported platform (Req 4.4).
    if (!active || !SUPPORTED) return undefined

    // Marks THIS effect run as torn down. A request that resolves after cleanup
    // must release immediately instead of leaking a sentinel (Property 4).
    let cancelled = false

    // Release the held sentinel if present, guarding against a double release.
    const release = () => {
      const sentinel = sentinelRef.current
      if (!sentinel) return
      sentinelRef.current = null
      // `release()` returns a promise; swallow rejections — releasing a lock
      // that the platform already auto-released must not surface an error.
      Promise.resolve()
        .then(() => sentinel.release())
        .catch(() => {})
      setIsHeld(false)
    }

    // Request a fresh screen wake lock and store the sentinel. Resilient to the
    // request rejecting (Req 4.4) and to the run being cancelled mid-flight.
    const acquire = async () => {
      // Already holding one for this run — never double-request (Property 4).
      if (sentinelRef.current) return
      try {
        const sentinel = await navigator.wakeLock.request('screen')
        if (cancelled) {
          // Deactivated/unmounted while the request was in flight: release the
          // sentinel we just got rather than leak it.
          try {
            await sentinel.release()
          } catch {
            // ignore — platform may have already released it
          }
          return
        }
        sentinelRef.current = sentinel
        setIsHeld(true)
        // The platform fires `release` when it auto-releases (e.g. the document
        // was hidden). Reflect that so our held state stays accurate; the
        // visibility handler re-acquires when we return to visible.
        sentinel.addEventListener('release', () => {
          if (sentinelRef.current === sentinel) {
            sentinelRef.current = null
            setIsHeld(false)
          }
        })
      } catch {
        // API rejected (e.g. not focused, not visible): no-op (Req 4.4).
      }
    }

    // Re-acquire when the document returns to visible while still active, since
    // the platform auto-releases the sentinel on hide (Req 4.3).
    const onVisibilityChange = () => {
      if (!cancelled && document.visibilityState === 'visible') {
        acquire()
      }
    }

    acquire()
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibilityChange)
      release()
    }
  }, [active])

  return { supported: SUPPORTED, active: isHeld }
}

export default useWakeLock
