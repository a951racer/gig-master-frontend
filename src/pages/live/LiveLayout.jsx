import { Outlet } from 'react-router-dom'

/**
 * Chromeless container for all Gig Master Live (`/live`) screens.
 *
 * Renders ONLY an <Outlet/> inside a full-viewport wrapper — no NavBar, no
 * surrounding chrome — so the performance experience fills the screen.
 *
 * NOTE (iOS standalone top band): installed to the Home Screen, iPadOS overlays
 * a translucent system status bar over the top inset and blurs the content
 * beneath it, which reads as a faint lighter band at the very top. An earlier
 * attempt reserved that inset with `viewport-fit=cover` + an
 * `env(safe-area-inset-top)` spacer, but `viewport-fit=cover` made `100vh`
 * span the full physical screen (including the bottom home-indicator inset), so
 * every page overflowed past the bottom. We reverted `viewport-fit=cover` to
 * fix the overflow; without it `env(safe-area-inset-*)` is 0, so no spacer is
 * used here. The top band is a known cosmetic tradeoff to revisit separately
 * with a standalone-safe technique that does not resize the whole viewport.
 */
export default function LiveLayout() {
  return (
    <div className="h-screen w-screen overflow-hidden bg-[#16132a] text-gray-100">
      <Outlet />
    </div>
  )
}
