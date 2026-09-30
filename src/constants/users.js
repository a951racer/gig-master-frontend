// Helpers for displaying users in the UI. Names are optional on the API side
// (a user may have empty firstName/lastName), so the label falls back through
// name → email so a user is always identifiable in dropdowns and messages.

// Build a friendly display label for a user:
//   - "Last, First" when both names are present,
//   - just the present name ("Last" or "First") when only one is present,
//   - the email otherwise.
// Returns '' for a null/undefined user.
export function userLabel(user) {
  if (!user) return ''
  const first = (user.firstName || '').trim()
  const last = (user.lastName || '').trim()
  if (first && last) return `${last}, ${first}`
  if (last) return last
  if (first) return first
  return user.email || ''
}
