import api from './axiosInstance'

// Create a band — POST /bands → 201 { id, name }
export const createBand = ({ name }) =>
  api.post('/bands', { name })

// List caller's memberships — GET /me/bands → 200 [{ id, name, isAdmin }]
export const listMyBands = () =>
  api.get('/me/bands')

// List the current band's members — GET /bands/:id/members → 200 [{ id, email, isAdmin }]
export const listBandMembers = (bandId) =>
  api.get(`/bands/${bandId}/members`)

// Request to join a band — POST /bands/:id/join-requests → 201 { id, status: 'pending' }
export const requestToJoin = (bandId) =>
  api.post(`/bands/${bandId}/join-requests`)

// List pending join requests for the current band (band-admin) — GET /bands/:id/join-requests
export const listJoinRequests = (bandId) =>
  api.get(`/bands/${bandId}/join-requests`)

// Approve/deny a join request (band-admin) — PATCH /bands/:id/join-requests/:reqId { status }
export const resolveJoinRequest = (bandId, reqId, status) =>
  api.patch(`/bands/${bandId}/join-requests/${reqId}`, { status })

// Caller's own join-request statuses — GET /me/join-requests → 200 [{ band, status }]
export const listMyJoinRequests = () =>
  api.get('/me/join-requests')
