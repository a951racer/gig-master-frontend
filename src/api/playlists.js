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

export const addSong = (playlistId, songId, playedKey) =>
  api.post(`/playlists/${playlistId}/songs`, playedKey !== undefined ? { songId, playedKey } : { songId })

// Set/clear a song's Played Key within a playlist. playedKey is a supported
// major key or '' to clear (never "Numbers").
export const setPlayedKey = (playlistId, songId, playedKey) =>
  api.patch(`/playlists/${playlistId}/songs/${songId}`, { playedKey })

export const removeSong = (playlistId, songId) =>
  api.delete(`/playlists/${playlistId}/songs/${songId}`)

export const reorderSongs = (playlistId, songs) =>
  api.put(`/playlists/${playlistId}/songs`, { songs })
