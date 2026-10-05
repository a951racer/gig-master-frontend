import { Link } from 'react-router-dom'

// Shared empty-state prompt shown when the user has no band (Req 16.6).
// Points the user to the create-band and join-band flows. Rendered inline by
// the bands pages (and reusable by band-scoped pages that redirect here while
// in the no-band state).
export default function NoBandPrompt({
  title = 'You are not in a band yet',
  message = 'Create a new band to start managing songs, setlists, and gigs, or request to join an existing band.',
}) {
  return (
    <div className="bg-[#2a2640] border border-purple-800/30 rounded-xl px-6 py-8 text-center">
      <div className="text-4xl mb-3">🎸</div>
      <h2 className="text-lg font-semibold text-white mb-1">{title}</h2>
      <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">{message}</p>
      <div className="flex items-center justify-center gap-3">
        <Link
          to="/bands/new"
          className="bg-purple-700 hover:bg-purple-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          Create a band
        </Link>
        <Link
          to="/bands/join"
          className="text-purple-300 hover:text-purple-200 text-sm font-medium px-4 py-2 rounded-lg border border-purple-800/40 hover:bg-purple-900/30 transition-colors"
        >
          Join a band
        </Link>
      </div>
    </div>
  )
}
