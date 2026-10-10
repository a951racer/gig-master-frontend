import { useCallback, useEffect, useState } from 'react'

// Reusable page-navigation hook for the gig charts performance view (and the
// future Phase 2 mobile play-mode). Owns a zero-based page index and exposes
// clamped navigation actions plus the current index and total count.
//
// Phase 1 scope lives across several tasks:
//   - index state + clamped actions (this file)
//   - re-clamp when `total` changes (Task 2)
//   - keydown key bindings when `enabled` (Task 3)
//
// All setters go through `clamp` so the index never leaves
// `[0, Math.max(0, total - 1)]`; for `total === 0` the index stays at 0.
export function useChartNavigation({ total, enabled = true, initialIndex = 0 }) {
  const [index, setIndex] = useState(initialIndex)

  // Bound an index to the valid range for the current total.
  const clamp = (i) => Math.min(Math.max(0, i), Math.max(0, total - 1))

  // Stable actions; the functional updater form composes correctly under rapid
  // repeats and never exceeds bounds.
  const goStart = useCallback(() => setIndex(() => clamp(0)), [total])
  const goPrev = useCallback(() => setIndex((i) => clamp(i - 1)), [total])
  const goNext = useCallback(() => setIndex((i) => clamp(i + 1)), [total])
  const goTo = useCallback((n) => setIndex(() => clamp(n)), [total])

  // Re-clamp when `total` changes (Req 2.3): if the current index is now out of
  // range (e.g. regenerating a shorter setlist), correct it DOWN to the new
  // last page `max(0, total - 1)`. We only touch an out-of-range index — a
  // caller legitimately changing `total` while the index stays in range is left
  // alone, and `total === 0` keeps the index pinned at 0.
  useEffect(() => {
    const max = Math.max(0, total - 1)
    setIndex((i) => (i > max ? max : i))
  }, [total])

  // Bind the expanded navigation key set while `enabled` (Req 1, 2.4/2.5). We
  // attach a single `window` `keydown` listener and detach it on cleanup — which
  // also fires whenever `enabled` flips false, so a non-active view (e.g. the
  // setup step) never captures keys (Req 1.7). The effect depends on the actions
  // too, so it re-binds if they change identity.
  //
  // The handler reads `e.key` ONLY (never `e.code`), which keeps HID pedals that
  // emit standard keys working. Space is matched on `e.key === ' '`. For any
  // mapped key we call `e.preventDefault()` (Req 1.6) so Space / Page Down don't
  // scroll; unmapped keys are ignored and pass through untouched.
  useEffect(() => {
    if (!enabled) return undefined

    const onKeyDown = (e) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
          e.preventDefault()
          goNext()
          break
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault()
          goPrev()
          break
        case 'Home':
          e.preventDefault()
          goStart()
          break
        default:
          // Unmapped key: do nothing, do not preventDefault.
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled, goNext, goPrev, goStart])

  return { index, total, goStart, goPrev, goNext, goTo }
}

export default useChartNavigation
