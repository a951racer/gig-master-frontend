import { useState, useRef, useLayoutEffect } from 'react'
import { PAGE_WIDTH, PAGE_HEIGHT } from '../pages/charts/ChartPages'

// Scale an 816×1056 page down to fit the available container (both width and
// height), so a whole page shows at once. Measures the container and never
// scales above 1.
export default function FitToScreen({ children }) {
  const ref = useRef(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      if (w > 0 && h > 0) {
        setScale(Math.min(1, w / PAGE_WIDTH, h / PAGE_HEIGHT))
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
  }, [])

  return (
    <div ref={ref} className="flex-1 w-full flex items-start justify-center overflow-hidden">
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
