import api from './axiosInstance'

// --- Band-admin invite management (scoped to the current band) ---

// Invite an email to the current band — POST /bands/:id/invites { email } → 201
export const createInvite = (bandId, email) =>
  api.post(`/bands/${bandId}/invites`, { email })

// List the current band's pending invites — GET /bands/:id/invites → 200 [{ id, email, expiresAt, createdAt }]
export const listInvites = (bandId) =>
  api.get(`/bands/${bandId}/invites`)

// Revoke a pending invite — DELETE /bands/:id/invites/:inviteId → 200
export const revokeInvite = (bandId, inviteId) =>
  api.delete(`/bands/${bandId}/invites/${inviteId}`)

// --- Invite acceptance (by raw token) ---

// Look up an invite by its raw token (public) — GET /invites/:token
//   → 200 { bandName, email, status, hasAccount }
export const getInvite = (token) =>
  api.get(`/invites/${encodeURIComponent(token)}`)

// Accept an invite as the logged-in user — POST /invites/:token/accept
//   → 200 { bandId, status: 'accepted' }
export const acceptInvite = (token) =>
  api.post(`/invites/${encodeURIComponent(token)}/accept`)
