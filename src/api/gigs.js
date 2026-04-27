import api from './axiosInstance'

export const listGigs = () =>
  api.get('/gigs')

export const getGig = (id) =>
  api.get(`/gigs/${id}`)

export const createGig = (data) =>
  api.post('/gigs', data)

export const updateGig = (id, data) =>
  api.patch(`/gigs/${id}`, data)

export const deleteGig = (id) =>
  api.delete(`/gigs/${id}`)
