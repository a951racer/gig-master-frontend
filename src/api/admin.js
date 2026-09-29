import api from './axiosInstance'

// Users — GET/POST /admin/users, PATCH /admin/users/:id/role
export const listUsers = () =>
  api.get('/admin/users')

export const createUser = ({ email, password, role }) =>
  api.post('/admin/users', { email, password, role })

export const setUserRole = (id, role) =>
  api.patch(`/admin/users/${id}/role`, { role })

// Bands — GET/POST /admin/bands, POST /admin/bands/:id/members,
//         PATCH /admin/bands/:id/administrator, PATCH /admin/bands/:id (rename)
export const listBands = () =>
  api.get('/admin/bands')
export const createBand = ({ name, administrator }) =>
  api.post('/admin/bands', { name, administrator })

export const addBandMember = (bandId, userId) =>
  api.post(`/admin/bands/${bandId}/members`, { userId })

export const setBandAdministrator = (bandId, userId) =>
  api.patch(`/admin/bands/${bandId}/administrator`, { userId })

export const renameBand = (bandId, name) =>
  api.patch(`/admin/bands/${bandId}`, { name })

// Seed genres — GET/PUT /admin/seed-genres
export const getSeedGenres = () =>
  api.get('/admin/seed-genres')

export const updateSeedGenres = (genres) =>
  api.put('/admin/seed-genres', { genres })
