import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../api/auth', () => ({
  getMe: vi.fn(),
  updateMe: vi.fn(),
}))

import ProfilePage from './ProfilePage'
import { getMe, updateMe } from '../../api/auth'

beforeEach(() => {
  vi.clearAllMocks()
  getMe.mockResolvedValue({
    data: { id: 'me', email: 'me@band.com', firstName: 'Ada', lastName: 'Lovelace' },
  })
})

describe('ProfilePage', () => {
  it('loads and populates the current profile', async () => {
    render(<ProfilePage />)

    expect(await screen.findByDisplayValue('me@band.com')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Ada')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Lovelace')).toBeInTheDocument()
  })

  it('saving details calls updateMe with trimmed name/email (no password)', async () => {
    updateMe.mockResolvedValueOnce({ data: {} })
    const user = userEvent.setup()
    render(<ProfilePage />)

    const first = await screen.findByDisplayValue('Ada')
    await user.clear(first)
    await user.type(first, 'Grace')
    await user.click(screen.getByRole('button', { name: /save details/i }))

    await waitFor(() => {
      expect(updateMe).toHaveBeenCalledWith({
        firstName: 'Grace',
        lastName: 'Lovelace',
        email: 'me@band.com',
      })
    })
    expect(await screen.findByText(/profile updated/i)).toBeInTheDocument()
  })

  it('changing password calls updateMe with current + new password', async () => {
    updateMe.mockResolvedValueOnce({ data: {} })
    const user = userEvent.setup()
    render(<ProfilePage />)

    await screen.findByDisplayValue('me@band.com')

    await user.type(screen.getByLabelText(/current password/i), 'old-password')
    await user.type(screen.getByLabelText(/new password/i), 'new-password-1')
    await user.click(screen.getByRole('button', { name: /change password/i }))

    await waitFor(() => {
      expect(updateMe).toHaveBeenCalledWith({
        currentPassword: 'old-password',
        newPassword: 'new-password-1',
      })
    })
    expect(await screen.findByText(/password changed/i)).toBeInTheDocument()
  })

  it('rejects a short new password client-side without calling updateMe', async () => {
    const user = userEvent.setup()
    render(<ProfilePage />)

    await screen.findByDisplayValue('me@band.com')

    await user.type(screen.getByLabelText(/current password/i), 'old-password')
    await user.type(screen.getByLabelText(/new password/i), 'short')
    await user.click(screen.getByRole('button', { name: /change password/i }))

    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument()
    expect(updateMe).not.toHaveBeenCalled()
  })

  it('surfaces a server error on details save (e.g. EMAIL_TAKEN)', async () => {
    updateMe.mockRejectedValueOnce({
      response: { data: { error: { code: 'EMAIL_TAKEN', message: 'Email already in use' } } },
    })
    const user = userEvent.setup()
    render(<ProfilePage />)

    await screen.findByDisplayValue('me@band.com')
    await user.click(screen.getByRole('button', { name: /save details/i }))

    expect(await screen.findByText(/email already in use/i)).toBeInTheDocument()
  })
})
