// Reusable chart-type selection UI shared by the gig charts setup step
// (GigChartsPage) and the Gig Master Live setup screen (LiveSetup).
//
// It owns NO state: selections live in the parent via `modes` and are mutated
// through the `onSetAll` / `onSetOne` callbacks. The markup, DOM roles, aria
// attributes, button text, and class names are preserved exactly as they were
// inline in GigChartsPage so existing behavior and tests are unaffected.

// Shared source of truth for the two chart modes. Importers (e.g.
// GigChartsPage) should pull these from here rather than redefining them.
export const MODE_NUMBERS = 'Numbers'
export const MODE_CHORDS = 'Chords'

// Toggle-button classes: filled when active, outlined otherwise.
const toggleBtn = (active) =>
  active
    ? 'text-sm px-3 py-1.5 rounded-lg bg-purple-700 text-white transition-colors'
    : 'text-sm px-3 py-1.5 rounded-lg border border-purple-800/40 text-gray-300 hover:bg-purple-800/30 transition-colors'

// Props:
//   songRows: [{ songId, title, playedKey }]      — setlist rows in order
//   modes:    { [songId]: 'Numbers' | 'Chords' }  — current per-song selection
//   onSetAll: (mode) => void                      — set every song to `mode`
//   onSetOne: (songId, mode) => void              — set one song to `mode`
export default function ChartSelection({ songRows, modes, onSetAll, onSetOne }) {
  const allNumbers =
    songRows.length > 0 && songRows.every((r) => (modes[r.songId] || MODE_NUMBERS) === MODE_NUMBERS)
  const allChords = songRows.length > 0 && songRows.every((r) => modes[r.songId] === MODE_CHORDS)

  return (
    <>
      {/* Global choice: All Numbers (default) vs All Chords. */}
      <div className="bg-[#2a2640] border border-purple-800/30 rounded-2xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Set all songs to</h2>
        <div className="flex gap-2" role="group" aria-label="Set all songs mode">
          <button type="button" onClick={() => onSetAll(MODE_NUMBERS)} className={toggleBtn(allNumbers)}>
            All Numbers
          </button>
          <button type="button" onClick={() => onSetAll(MODE_CHORDS)} className={toggleBtn(allChords)}>
            All Chords
          </button>
        </div>
      </div>

      {/* Per-song mode controls. */}
      <div className="bg-[#2a2640] border border-purple-800/30 rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Songs</h2>
        <ul className="space-y-3">
          {songRows.map((row, i) => {
            const mode = modes[row.songId] || MODE_NUMBERS
            return (
              <li key={row.songId} className="flex items-center gap-3 text-sm">
                <span className="text-gray-600 w-5 text-right shrink-0">{i + 1}</span>
                <span className="text-white font-medium">{row.title}</span>
                {row.playedKey && (
                  <span className="text-purple-300 font-mono text-xs font-normal">[{row.playedKey}]</span>
                )}
                <div className="ml-auto flex gap-2" role="group" aria-label={`Mode for ${row.title}`}>
                  <button
                    type="button"
                    aria-pressed={mode === MODE_NUMBERS}
                    onClick={() => onSetOne(row.songId, MODE_NUMBERS)}
                    className={toggleBtn(mode === MODE_NUMBERS)}
                  >
                    Numbers
                  </button>
                  <button
                    type="button"
                    aria-pressed={mode === MODE_CHORDS}
                    onClick={() => onSetOne(row.songId, MODE_CHORDS)}
                    className={toggleBtn(mode === MODE_CHORDS)}
                  >
                    Chords
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </>
  )
}
