import { useBand } from '../../auth/BandContext'

/**
 * Gig Master Live — band switcher (Req 2.1, 2.2, 2.3).
 *
 * A self-contained control for the `/live` gig-picker header that lets a
 * performer in more than one band change the current band. It reads the band
 * context directly, so it needs no props.
 *
 * Rendering rules:
 * - When the user belongs to 0 or 1 band there is nothing to switch, so the
 *   component renders nothing (Req 2.3).
 * - When the user belongs to >1 band it renders a NATIVE `<select>` (Req 2.1):
 *   native pickers give a reliable touch target and accessible picker wheel on
 *   iPadOS, with no custom dropdown/focus-trap bugs.
 *
 * Selecting a band calls `setCurrentBand(id)`, which validates the id against
 * the member bands, persists the selection (`currentBandId` localStorage), and
 * re-syncs the axios `X-Band-Id` header. The picker's load effect is keyed on
 * `currentBand?.id`, so the gigs list re-fetches for the new band automatically
 * (Req 2.2) — this component does not refresh the list itself.
 */
export default function BandSwitcher() {
  const { bands, currentBand, setCurrentBand } = useBand()

  // Nothing to switch when the user is in a single band (or none).
  if (bands.length <= 1) return null

  return (
    <select
      aria-label="Current band"
      value={currentBand?.id ?? ''}
      onChange={(e) => setCurrentBand(e.target.value)}
      className="bg-[#2a2640] border border-purple-800/40 text-gray-100 rounded-lg px-3 py-2 text-base"
    >
      {bands.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
        </option>
      ))}
    </select>
  )
}
