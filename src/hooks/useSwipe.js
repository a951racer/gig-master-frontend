import { useEffect, useRef } from 'react'

// Reusable swipe-gesture hook for the Gig Master Live performance view (Req 3).
//
// Attaches `pointerdown`/`pointerup`/`pointercancel` to `targetRef.current` and
// classifies a completed drag into a directional swipe. Pointer Events unify
// touch and mouse and are well-supported on iPadOS Safari.
//
// IMPORTANT (iOS Safari): a vertical finger drag is, by default, consumed by the
// browser's native scroll / rubber-band overscroll BEFORE it completes as a
// pointer gesture — the page visibly moves and the browser fires
// `pointercancel` instead of `pointerup`, so a vertical swipe would never be
// classified. To fix this we set `touch-action: none` on the target while the
// hook is mounted, which tells the browser not to handle touch panning/zoom on
// that element so the full gesture reaches us. We also capture the pointer on
// down so the whole drag is delivered even if the finger drifts off the
// element, and we treat `pointercancel` as a reset. The previous inline
// `touch-action` value is restored on cleanup.
//
// A swipe fires only when the dominant-axis distance is `>= threshold` AND the
// off-axis drift is `<= restraint` (Req 3.6). The dominant axis is horizontal
// when `|dx| >= |dy|`, else vertical:
//   - horizontal, dx < 0 (right-to-left) → onSwipeLeft   (next)
//   - horizontal, dx > 0 (left-to-right) → onSwipeRight  (prev)
//   - vertical,   dy < 0 (bottom-to-top) → onSwipeUp     (exit)
//   - vertical,   dy > 0 (top-to-bottom) → onSwipeDown
// A sub-threshold or off-axis gesture fires nothing and is treated as a tap, so
// taps on child controls are never hijacked (Req 3.8).
//
// `allowMouse` (default false): pointer events already include mouse, so when
// false we IGNORE `pointerType === 'mouse'` events; set it true to enable mouse
// drags (desktop testing). Touch and pen always count.
//
// Callbacks + options are read through a ref refreshed every render, so the
// bind effect runs ONCE per target (and `allowMouse`) and never re-attaches for
// inline-function callers. A `pointerup` with no recorded `pointerdown` is
// ignored.
export function useSwipe(targetRef, options = {}) {
  const optionsRef = useRef(options)
  optionsRef.current = options

  const allowMouse = options.allowMouse ?? false

  useEffect(() => {
    const el = targetRef.current
    if (!el) return undefined

    // Disable the browser's own touch gestures on this element so vertical
    // swipes aren't swallowed by native scroll/overscroll (see header note).
    // Restore whatever was there before on cleanup.
    const prevTouchAction = el.style.touchAction
    el.style.touchAction = 'none'

    // Transient pointer start for the in-flight gesture; null between gestures.
    let start = null

    const onPointerDown = (e) => {
      if (!allowMouse && e.pointerType === 'mouse') return
      start = { x: e.clientX, y: e.clientY }
      // Capture so the full drag is delivered to this element even if the
      // finger drifts off it before lifting.
      try {
        el.setPointerCapture?.(e.pointerId)
      } catch {
        // ignore — capture is a best-effort enhancement
      }
    }

    const onPointerUp = (e) => {
      if (!allowMouse && e.pointerType === 'mouse') return
      if (!start) return

      const dx = e.clientX - start.x
      const dy = e.clientY - start.y
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
        if (absX >= threshold && absY <= restraint) {
          if (dx < 0) onSwipeLeft?.()
          else if (dx > 0) onSwipeRight?.()
        }
      } else {
        if (absY >= threshold && absX <= restraint) {
          if (dy < 0) onSwipeUp?.()
          else if (dy > 0) onSwipeDown?.()
        }
      }
    }

    // A canceled gesture (e.g. the OS took over) must not leave stale start
    // state that a later stray up could consume.
    const onPointerCancel = () => {
      start = null
    }

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerCancel)

    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointercancel', onPointerCancel)
      el.style.touchAction = prevTouchAction
    }
  }, [targetRef, allowMouse])
}

export default useSwipe
