import { useEffect, useRef } from 'react'

// Reusable swipe-gesture hook for the Gig Master Live performance view (Req 3).
//
// Attaches a single `pointerdown`/`pointerup` pair to `targetRef.current` and
// classifies a completed drag into a directional swipe. Pointer Events unify
// touch and mouse and are well-supported on iPadOS Safari, so touch gestures
// come for free (Req 3.1–3.3).
//
// A swipe fires only when the dominant-axis distance is `>= threshold` AND the
// off-axis drift is `<= restraint` (Req 3.6). The dominant axis is horizontal
// when `|dx| >= |dy|`, else vertical. This makes horizontal (page) vs vertical
// (exit) intent unambiguous and keeps diagonal drags from firing:
//   - horizontal, dx < 0 (right-to-left) → onSwipeLeft   (next)
//   - horizontal, dx > 0 (left-to-right) → onSwipeRight  (prev)
//   - vertical,   dy < 0 (bottom-to-top) → onSwipeUp     (exit)
//   - vertical,   dy > 0 (top-to-bottom) → onSwipeDown
// A sub-threshold or off-axis gesture fires nothing and is treated as a tap, so
// taps on child controls are never hijacked (Req 3.8).
//
// `allowMouse` (default false): pointer events already include mouse, so when
// false we IGNORE `pointerType === 'mouse'` events — on a desktop a plain mouse
// drag won't trigger navigation; set it true to enable mouse drags (handy for
// desktop testing). Touch and pen always count.
//
// The callbacks + options are read through a ref that is refreshed every render,
// so the effect binds listeners ONCE per target (and `allowMouse`) and never
// re-attaches when callers pass inline functions. Listeners are cleaned up on
// unmount / ref change. A `pointerup` with no recorded `pointerdown` (e.g. the
// gesture started off-element) is ignored.
export function useSwipe(targetRef, options = {}) {
  // Latest callbacks + tuning, refreshed each render so the bind effect stays
  // stable while still seeing current values at gesture time.
  const optionsRef = useRef(options)
  optionsRef.current = options

  // `allowMouse` affects which events we honor; read it once for the dep array
  // (it does not change behavior of the listener wiring itself, only filtering).
  const allowMouse = options.allowMouse ?? false

  useEffect(() => {
    const el = targetRef.current
    if (!el) return undefined

    // Transient pointer start for the in-flight gesture; null between gestures.
    let start = null

    const onPointerDown = (e) => {
      if (!allowMouse && e.pointerType === 'mouse') return
      start = { x: e.clientX, y: e.clientY }
    }

    const onPointerUp = (e) => {
      if (!allowMouse && e.pointerType === 'mouse') return
      // Ignore an up with no recorded down (gesture started off-element).
      if (!start) return

      const dx = e.clientX - start.x
      const dy = e.clientY - start.y
      // Reset immediately so a stray second up can't re-fire this gesture.
      start = null

      const {
        onSwipeLeft,
        onSwipeRight,
        onSwipeUp,
        onSwipeDown,
        threshold = 50,
        restraint = 40,
      } = optionsRef.current

      const absX = Math.abs(dx)
      const absY = Math.abs(dy)

      if (absX >= absY) {
        // Horizontal intent: enough travel on X, little drift on Y.
        if (absX >= threshold && absY <= restraint) {
          if (dx < 0) onSwipeLeft?.()
          else if (dx > 0) onSwipeRight?.()
        }
      } else {
        // Vertical intent: enough travel on Y, little drift on X.
        if (absY >= threshold && absX <= restraint) {
          if (dy < 0) onSwipeUp?.()
          else if (dy > 0) onSwipeDown?.()
        }
      }
    }

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointerup', onPointerUp)

    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointerup', onPointerUp)
    }
  }, [targetRef, allowMouse])
}

export default useSwipe
