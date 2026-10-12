import { Outlet } from 'react-router-dom'

/**
 * Chromeless container for all Gig Master Live (`/live`) screens.
 *
 * Unlike the main app shell (NavBar + internal scroll region), this layout
 * renders ONLY an <Outlet/> inside a full-viewport wrapper — no NavBar, no
 * surrounding chrome — so the performance experience can fill the screen.
 *
 * iOS standalone top inset: when installed to the Home Screen, iPadOS overlays
 * a translucent system status bar across the top safe-area inset and blurs
 * whatever app content sits beneath it — which read as a lighter "gradient"
 * band fading in from the top on every /live screen. There is no reliable
 * `apple-mobile-web-app-status-bar-style` value that forces a flat opaque bar
 * on iPad, so instead we RESERVE that inset as a solid #16132a bar: a
 * non-shrinking spacer of height `env(safe-area-inset-top)` sits at the top
 * (requires `viewport-fit=cover`, set in index.html), and the screen content
 * fills the rest below it. iOS then blurs a flat dark bar (invisible) instead
 * of our content, so the band is gone.
 */
export default function LiveLayout() {
  return (
    <div className="h-screen w-screen overflow-hidden bg-[#16132a] text-gray-100 flex flex-col">
      {/* Solid dark bar occupying the top safe-area inset (status bar region). */}
      <div
        className="shrink-0 bg-[#16132a]"
        style={{ height: 'env(safe-area-inset-top, 0px)' }}
        aria-hidden="true"
      />
      {/* The active /live screen fills the remaining space and manages its own
          layout/scroll. min-h-0 lets flex children scroll internally. */}
      <div className="flex-1 min-h-0">
        <Outlet />
      </div>
    </div>
  )
}
