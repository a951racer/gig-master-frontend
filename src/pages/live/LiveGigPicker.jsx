import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { listGigs } from '../../api/gigs'
import { useAuth } from '../../auth/AuthContext'
import { useBand } from '../../auth/BandContext'
import NoBandPrompt from '../bands/NoBandPrompt'
import BandSwitcher from './BandSwitcher'

/**
 * Gig Master Live — gig picker (Req 1.1, 1.2, 1.3).
 *
 * The entry screen of the `/live` performance flow. Renders a touch-first list
 * of the band's gigs with LARGE tap targets (sized for an iPad on a stage, not
 * the admin gig list). Selecting a performable gig — one whose setlist has at
 * least one song — navigates to that gig's live setup (`/live/gigs/:id`). A gig
 * with no setlist songs is shown as non-performable: visibly disabled with a
 * "No setlist" hint, and it does NOT navigate.
 *
 * Rendered inside LiveLayout's chromeless full-viewport wrapper, so this screen
 * owns its own flex column + internal scroll region.
 */

// A gig is performable only if its setlist has at least one song.
function isPerformable(gig) {
  return (gig?.playlist?.songs?.length ?? 0) > 0
}

function formatDate(date) {
  if (!date) return null
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { dateStyle: 'medium' })
}

export default function LiveGigPicker() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const { currentBand, hasNoBand } = useBand()
  const [gigs, setGigs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Logout always lands the user on /login — even if the logout network call
  // fails. `logout()` already swallows API errors and clears local auth state;
  // the `finally` guarantees navigation regardless (Req 1.4).
  async function handleLogout() {
    try {
      await logout()
    } finally {
      navigate('/login')
    }
  }

  useEffect(() => {
    if (hasNoBand) return
    setLoading(true)
    setError('')
    listGigs()
      .then(res => setGigs(res.data))
      .catch(() => setError('Failed to load gigs'))
      .finally(() => setLoading(false))
  }, [hasNoBand, currentBand?.id])

  return (
    // Full-height flex column: fixed heading on top, scrollable gig list below.
    <div className="h-full flex flex-col">
      <header className="shrink-0 px-6 pt-8 pb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-white">Gig Master Live</h1>
          <p className="text-gray-400 text-base mt-1">Choose a gig to perform</p>
        </div>
        <div className="shrink-0 flex items-center gap-3">
          <BandSwitcher />
          <button
            type="button"
            onClick={handleLogout}
            className="bg-[#2a2640] border border-purple-800/40 text-gray-200 rounded-lg px-4 py-2 text-base hover:bg-[#322d4d] transition-colors"
          >
            Log out
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-10">
        {hasNoBand ? (
          <div className="max-w-xl mx-auto">
            <NoBandPrompt />
          </div>
        ) : error ? (
          <p role="alert" className="text-red-400 text-lg">{error}</p>
        ) : loading ? (
          <p className="text-gray-400 text-lg">Loading...</p>
        ) : gigs.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <div className="text-5xl mb-4">🎤</div>
            <p className="text-lg">No gigs yet.</p>
          </div>
        ) : (
          <ul className="space-y-4 max-w-3xl mx-auto">
            {gigs.map(gig => {
              const performable = isPerformable(gig)
              const date = formatDate(gig.date)
              return (
                <li key={gig._id}>
                  {performable ? (
                    <button
                      type="button"
                      onClick={() => navigate(`/live/gigs/${gig._id}`)}
                      className="w-full text-left bg-[#2a2640] border border-purple-800/40 rounded-2xl px-7 py-6 flex items-center gap-4 hover:border-purple-500 hover:bg-[#322d4d] active:bg-[#3a3458] transition-colors cursor-pointer"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-2xl font-semibold text-white truncate">{gig.name}</p>
                        {(date || gig.location) && (
                          <p className="text-gray-300 text-lg mt-1 truncate">
                            {date}
                            {date && gig.location ? ' · ' : ''}
                            {gig.location ? `📍 ${gig.location}` : ''}
                          </p>
                        )}
                      </div>
                      <span className="text-3xl text-purple-300" aria-hidden="true">›</span>
                    </button>
                  ) : (
                    <div
                      aria-disabled="true"
                      className="w-full text-left bg-[#201d33] border border-white/5 rounded-2xl px-7 py-6 flex items-center gap-4 opacity-60 cursor-not-allowed"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-2xl font-semibold text-gray-400 truncate">{gig.name}</p>
                        {(date || gig.location) && (
                          <p className="text-gray-500 text-lg mt-1 truncate">
                            {date}
                            {date && gig.location ? ' · ' : ''}
                            {gig.location ? `📍 ${gig.location}` : ''}
                          </p>
                        )}
                      </div>
                      <span className="text-base text-gray-500 bg-[#16132a] px-3 py-1.5 rounded-full whitespace-nowrap">
                        No setlist
                      </span>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
