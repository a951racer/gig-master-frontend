import { useMemo } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import ChartPages, { PAGE_WIDTH, PAGE_HEIGHT } from '../charts/ChartPages'
import { useChartNavigation } from '../../hooks/useChartNavigation'
import useWakeLock from '../../hooks/useWakeLock'
import FitToScreen from '../../components/FitToScreen'
import { buildFlatPages } from '../gigs/GigChartsPage'

/**
 * Gig Master Live — full-screen performance view (Req 3, 4, 7).
 *
 * The third and final `/live` screen: a chromeless, full-viewport reader that
 * displays a gig's whole setlist as a flattened page sequence, one page at a
 * time, scaled to fill the viewport. Reached from LiveSetup's "Start Gig",
 * which navigates to `/live/gigs/:id/play` carrying the loaded `allCharts`
 * payload via React Router location state `{ charts, truncated, selections }`.
 *
 * Reuse, don't reimplement (Req 7):
 *   - `buildFlatPages` (exported from GigChartsPage) flattens the charts array
 *     into the identical page sequence used by the gig charts performance view,
 *     so online/offline and gig-charts/live render identically (Req 7.2).
 *   - `useChartNavigation` owns the page index, clamped actions, and the
 *     keyboard bindings (Arrow / PageUp / PageDown / Space / Home) that an HID
 *     foot pedal emits — enabled so a pedal flips pages hands-free (Req 7.1,
 *     3.5).
 *   - `ChartPages` renders each page inside the shared `FitToScreen` wrapper so
 *     a whole page shows at once (Req 3.1, 3.2).
 *   - `useWakeLock(true)` holds a screen wake lock while mounted and releases
 *     it on exit/unmount, so the iPad never dims mid-song (Req 4.1).
 *
 * Rendered inside LiveLayout's chromeless wrapper (no NavBar), so this screen
 * owns a full-height flex column: the chart fills the available space and a
 * slim bottom bar carries the Exit control, Start/Prev/Next controls, and the
 * "Page X of N" indicator, positioned so they don't obscure the chart (Req
 * 3.5).
 *
 * No-state fallback: if there is no location state (the user opened `/play`
 * directly or refreshed and lost the forwarded charts), render a non-crashing
 * screen offering to go back to setup rather than crashing on undefined charts.
 *
 * Why not reload from the cache here (Task 13)? The offline chart cache is
 * keyed by gig + the per-song `selections`, and selections are NOT in the URL —
 * they live in location state, which is exactly what's missing on a cold direct
 * `/play` hit. Fabricating selections (e.g. an all-Numbers default) could key a
 * DIFFERENT cache entry than the one the performer actually loaded, so we do
 * NOT guess them. Instead, offline replay is realized through the setup screen:
 * reopening the gig in `/live` and tapping "Start Gig" runs `useGigCharts.load`,
 * which serves the previously-cached charts (`source: 'cache'`) and forwards
 * them here via state. A cold direct `/play` hit (no state) still correctly
 * routes back to setup.
 */
export default function LivePerformance() {
  const { id } = useParams()
  const { state } = useLocation()
  const navigate = useNavigate()

  // Hold a screen wake lock for the whole life of the performance view. Called
  // unconditionally (before any early return) so hook order stays stable; it
  // no-ops gracefully when the API is unsupported or rejects (Req 4.1, 4.4).
  useWakeLock(true)

  // Flatten the forwarded charts into the page sequence. `state?.charts` is the
  // `allCharts` `charts` array; buildFlatPages tolerates null/undefined (→ []).
  const flatPages = useMemo(() => buildFlatPages(state?.charts), [state])
  const truncated = Boolean(state?.truncated)
  const total = flatPages.length

  // Navigation (index + clamped actions + key bindings). Keys are enabled so a
  // HID pedal / keyboard flips pages; the hook clamps to [0, total - 1].
  const nav = useChartNavigation({ total, enabled: true })

  const exitToSetup = () => navigate(`/live/gigs/${id}`)

  // No forwarded charts (direct hit / refresh lost the state). Non-crashing
  // fallback with a back-to-setup action. We can't cache-load here because the
  // cache is keyed by selections, which only arrive via state (see header note)
  // — so offline replay goes back through setup → Start Gig.
  if (!state) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-6 text-center">
        <div className="text-5xl mb-4">🎵</div>
        <h1 className="text-2xl font-bold text-white mb-2">Performance not loaded</h1>
        <p className="text-gray-400 text-base mb-8 max-w-md">
          This performance needs to be started from the setup screen. Head back
          and tap Start Gig to load the charts.
        </p>
        <button
          type="button"
          onClick={exitToSetup}
          className="bg-purple-700 hover:bg-purple-600 active:bg-purple-500 text-white text-lg font-semibold px-6 py-4 rounded-2xl transition-colors"
        >
          ← Back to setup
        </button>
      </div>
    )
  }

  const current = total > 0 ? flatPages[nav.index] : null

  return (
    <div className="h-full flex flex-col">
      {truncated && (
        <p className="shrink-0 text-amber-300 text-sm text-center bg-amber-900/20 border-b border-amber-800/40 px-3 py-2">
          Some songs were omitted because the setlist is large.
        </p>
      )}

      {/* The one visible page, scaled to fill the viewport. Mirrors the gig
          charts performance view: placeholder entries render a titled empty
          page; real entries render through ChartPages. */}
      {current ? (
        current.placeholder ? (
          <FitToScreen>
            <div
              className="bg-white text-gray-900 shadow-lg border border-gray-300 flex flex-col"
              style={{ width: `${PAGE_WIDTH}px`, height: `${PAGE_HEIGHT}px`, padding: '48px' }}
            >
              <div className="border-b border-gray-300 pb-2 mb-6 font-bold text-2xl text-gray-900">
                {current.title} [{current.keyLabel}]
              </div>
              <p className="text-gray-500 text-lg">No chart for this song</p>
            </div>
          </FitToScreen>
        ) : (
          <FitToScreen>
            <ChartPages representation={current.representation} />
          </FitToScreen>
        )
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          No pages to show
        </div>
      )}

      {/* Slim bottom control bar — Exit on the left, navigation + position
          centered. Pinned below the chart so it never obscures the music. */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-t border-purple-800/40 bg-[#16132a]">
        <button
          type="button"
          onClick={exitToSetup}
          aria-label="Exit performance"
          className="text-sm text-gray-300 hover:text-white border border-purple-800/40 hover:bg-purple-800/30 px-3 py-2 rounded-lg transition-colors"
        >
          ✕ Exit
        </button>

        <div className="flex-1 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={nav.goStart}
            disabled={nav.index === 0}
            aria-label="Jump to beginning"
            className={
              nav.index === 0
                ? 'text-sm text-gray-600 border border-purple-800/40 px-3 py-2 rounded-lg cursor-not-allowed'
                : 'text-sm text-white border border-purple-800/40 hover:bg-purple-800/30 px-3 py-2 rounded-lg transition-colors'
            }
          >
            ⏮ Start
          </button>
          <button
            type="button"
            onClick={nav.goPrev}
            disabled={nav.index === 0}
            aria-label="Previous page"
            className={
              nav.index === 0
                ? 'text-sm text-gray-600 border border-purple-800/40 px-3 py-2 rounded-lg cursor-not-allowed'
                : 'text-sm text-white border border-purple-800/40 hover:bg-purple-800/30 px-3 py-2 rounded-lg transition-colors'
            }
          >
            ← Prev
          </button>
          <span className="text-sm text-gray-300 min-w-[7rem] text-center">
            Page {total === 0 ? 0 : nav.index + 1} of {total}
          </span>
          <button
            type="button"
            onClick={nav.goNext}
            disabled={nav.index >= total - 1}
            aria-label="Next page"
            className={
              nav.index >= total - 1
                ? 'text-sm text-gray-600 border border-purple-800/40 px-3 py-2 rounded-lg cursor-not-allowed'
                : 'text-sm text-white border border-purple-800/40 hover:bg-purple-800/30 px-3 py-2 rounded-lg transition-colors'
            }
          >
            Next →
          </button>
        </div>

        {/* Spacer to balance the Exit button so the nav cluster stays centered. */}
        <div className="w-[72px] shrink-0" aria-hidden="true" />
      </div>
    </div>
  )
}
