import api from './axiosInstance'

export const register = (email, password) =>
  api.post('/auth/register', { email, password })

export const login = (email, password) =>
  api.post('/auth/login', { email, password })

export const logout = () =>
  api.post('/auth/logout')

export const refresh = () =>
  api.post('/auth/refresh')

export const getMe = () =>
  api.get('/auth/me')

export const updateMe = (data) =>
  api.patch('/auth/me', data)

export const deleteMe = () =>
  api.delete('/auth/me')

export const forgotPassword = (email) =>
  api.post('/auth/forgot-password', { email })

export const resetPassword = (token, newPassword) =>
  api.post('/auth/reset-password', { token, newPassword })
