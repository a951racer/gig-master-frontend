import { Outlet } from 'react-router-dom'

/**
 * Chromeless container for all Gig Master Live (`/live`) screens.
 *
 * Unlike the main app shell (NavBar + internal scroll region), this layout
 * renders ONLY an <Outlet/> inside a full-viewport wrapper — no NavBar, no
 * surrounding chrome — so the performance experience can fill the screen.
 */
export default function LiveLayout() {
  return (
    <div className="h-screen w-screen overflow-hidden bg-[#16132a] text-gray-100">
      <Outlet />
    </div>
  )
}
