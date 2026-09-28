import api from './axiosInstance'

// Users — POST /admin/users, PATCH /admin/users/:id/role
export const createUser = ({ email, password, role }) =>
  api.post('/admin/users', { email, password, role })

export const setUserRole = (id, role) =>
  api.patch(`/admin/users/${id}/role`, { role })

// Bands — POST /admin/bands, POST /admin/bands/:id/members, PATCH /admin/bands/:id/administrator
export const createBand = ({ name, administrator }) =>
  api.post('/admin/bands', { name, administrator })

export const addBandMember = (bandId, userId) =>
  api.post(`/admin/bands/${bandId}/members`, { userId })

export const setBandAdministrator = (bandId, userId) =>
  api.patch(`/admin/bands/${bandId}/administrator`, { userId })

// Seed genres — GET/PUT /admin/seed-genres
export const getSeedGenres = () =>
  api.get('/admin/seed-genres')

export const updateSeedGenres = (genres) =>
  api.put('/admin/seed-genres', { genres })
