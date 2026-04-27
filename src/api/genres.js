import api from './axiosInstance'

export const listGenres = () =>
  api.get('/genres')

export const createGenre = (name) =>
  api.post('/genres', { name })

export const updateGenre = (id, name) =>
  api.patch(`/genres/${id}`, { name })

export const deleteGenre = (id) =>
  api.delete(`/genres/${id}`)
