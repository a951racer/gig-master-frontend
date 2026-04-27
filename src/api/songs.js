import api from './axiosInstance'

export const listSongs = (params) =>
  api.get('/songs', { params })

export const createSong = (data) =>
  api.post('/songs', data)

export const getSong = (id) =>
  api.get(`/songs/${id}`)

export const updateSong = (id, data) =>
  api.patch(`/songs/${id}`, data)

export const deleteSong = (id) =>
  api.delete(`/songs/${id}`)
