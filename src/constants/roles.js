// Role definitions for UI display. Roles are code identifiers on the API side
// (the User.role enum); these give each a user-friendly label. Option `value`
// stays the code identifier so role gating and API calls are unaffected — only
// the displayed text changes.
export const ROLE_OPTIONS = [
  { value: 'user', label: 'User' },
  { value: 'system_administrator', label: 'System Administrator' },
]

// Map a role code identifier to its friendly label (falls back to the raw value).
export function roleLabel(value) {
  const match = ROLE_OPTIONS.find((r) => r.value === value)
  return match ? match.label : value
}
