import { useState, useRef, useLayoutEffect } from 'react'
import { PAGE_WIDTH, PAGE_HEIGHT } from '../pages/charts/ChartPages'

// Scale an 816×1056 page to fit the available container (both width and
// height), preserving aspect ratio, so a whole page shows at once.
//
// `allowUpscale` controls the maximum scale:
//   - false (default): never scale ABOVE 1 — the embedded gig-charts view
//     shows pages at up to their native size inside a normal panel, so a small
//     page isn't blown up past 100%.
//   - true: allow scaling above 1 so the page FILLS the viewport — the Gig
//     Master Live full-screen performance view wants the chart as large as the
//     screen allows (on a portrait iPad the native 816px-wide page would
//     otherwise float in the middle with large empty margins).
//
// The page is centered on BOTH axes within the container so leftover space
// (from the non-matching aspect ratio) is balanced rather than top/left-pinned.
export default function FitToScreen({ children, allowUpscale = false }) {
  const ref = useRef(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      if (w > 0 && h > 0) {
        const fit = Math.min(w / PAGE_WIDTH, h / PAGE_HEIGHT)
        setScale(allowUpscale ? fit : Math.min(1, fit))
      }
    }
    measure()
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure)
      ro.observe(el)
      return () => ro.disconnect()
    }
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [allowUpscale])

  return (
    <div ref={ref} className="flex-1 w-full flex items-center justify-center overflow-hidden">
      <div
        style={{
          width: `${PAGE_WIDTH * scale}px`,
          height: `${PAGE_HEIGHT * scale}px`,
        }}
      >
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            width: `${PAGE_WIDTH}px`,
            height: `${PAGE_HEIGHT}px`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
