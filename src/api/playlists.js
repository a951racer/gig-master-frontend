import api from './axiosInstance'

export const listPlaylists = () =>
  api.get('/playlists')

export const getPlaylist = (id) =>
  api.get(`/playlists/${id}`)

export const createPlaylist = (data) =>
  api.post('/playlists', data)

export const updatePlaylist = (id, data) =>
  api.patch(`/playlists/${id}`, data)

export const deletePlaylist = (id) =>
  api.delete(`/playlists/${id}`)

export const addSong = (playlistId, songId) =>
  api.post(`/playlists/${playlistId}/songs`, { songId })

export const removeSong = (playlistId, songId) =>
  api.delete(`/playlists/${playlistId}/songs/${songId}`)

export const reorderSongs = (playlistId, songs) =>
  api.put(`/playlists/${playlistId}/songs`, { songs })
