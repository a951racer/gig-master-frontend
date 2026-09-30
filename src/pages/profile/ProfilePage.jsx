import { useEffect, useState } from 'react'
import { getMe, updateMe } from '../../api/auth'

const inputCls = 'w-full bg-[#1e1b2e] border border-purple-800/40 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600 text-sm'

function errMsg(err, fallback) {
  return err?.response?.data?.error?.message || err?.response?.data?.message || fallback
}

// Self-service profile page (#39). A signed-in user can edit their first/last
// name and email, and change their password (current + new). Profile details
// and password changes are submitted separately so a name/email edit doesn't
// require re-entering the password, and vice versa.
export default function ProfilePage() {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [profileError, setProfileError] = useState(null)
  const [profileSuccess, setProfileSuccess] = useState(null)
  const [savingProfile, setSavingProfile] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [pwError, setPwError] = useState(null)
  const [pwSuccess, setPwSuccess] = useState(null)
  const [savingPw, setSavingPw] = useState(false)

  useEffect(() => {
    let active = true
    getMe()
      .then((res) => {
        if (!active) return
        setFirstName(res.data.firstName || '')
        setLastName(res.data.lastName || '')
        setEmail(res.data.email || '')
      })
      .catch((err) => {
        if (active) setLoadError(errMsg(err, 'Failed to load your profile.'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  async function handleProfileSubmit(e) {
    e.preventDefault()
    setProfileError(null)
    setProfileSuccess(null)
    if (!email.trim()) {
      setProfileError('Email is required.')
      return
    }
    setSavingProfile(true)
    try {
      await updateMe({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
      })
      setProfileSuccess('Profile updated.')
    } catch (err) {
      setProfileError(errMsg(err, 'Failed to update profile.'))
    } finally {
      setSavingProfile(false)
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault()
    setPwError(null)
    setPwSuccess(null)
    if (!currentPassword || !newPassword) {
      setPwError('Enter your current and new password.')
      return
    }
    if (newPassword.length < 8) {
      setPwError('New password must be at least 8 characters.')
      return
    }
    setSavingPw(true)
    try {
      await updateMe({ currentPassword, newPassword })
      setPwSuccess('Password changed.')
      setCurrentPassword('')
      setNewPassword('')
    } catch (err) {
      setPwError(errMsg(err, 'Failed to change password.'))
    } finally {
      setSavingPw(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-xl mx-auto px-6 py-8">
        <p className="text-gray-400 text-sm">Loading your profile…</p>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-white mb-6">Your Profile</h1>

      {loadError && (
        <p role="alert" className="text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2 mb-6">
          {loadError}
        </p>
      )}

      {/* Profile details */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-white mb-3">Details</h2>
        <form onSubmit={handleProfileSubmit} className="flex flex-col gap-3">
          <label className="text-sm text-gray-300">
            First name
            <input
              type="text" value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={inputCls + ' mt-1'} placeholder="Jane"
            />
          </label>
          <label className="text-sm text-gray-300">
            Last name
            <input
              type="text" value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className={inputCls + ' mt-1'} placeholder="Doe"
            />
          </label>
          <label className="text-sm text-gray-300">
            Email
            <input
              type="email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls + ' mt-1'} placeholder="you@example.com"
            />
          </label>
          <button
            type="submit" disabled={savingProfile}
            className="bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors self-start"
          >
            {savingProfile ? 'Saving…' : 'Save details'}
          </button>
        </form>
        {profileError && <p role="alert" className="text-red-400 text-sm mt-3">{profileError}</p>}
        {profileSuccess && <p className="text-green-400 text-sm mt-3">{profileSuccess}</p>}
      </section>

      {/* Change password */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-3">Change password</h2>
        <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-3">
          <label className="text-sm text-gray-300">
            Current password
            <input
              type="password" value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={inputCls + ' mt-1'} placeholder="••••••••"
            />
          </label>
          <label className="text-sm text-gray-300">
            New password <span className="text-gray-500">(min 8 characters)</span>
            <input
              type="password" value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputCls + ' mt-1'} placeholder="••••••••"
            />
          </label>
          <button
            type="submit" disabled={savingPw}
            className="bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors self-start"
          >
            {savingPw ? 'Saving…' : 'Change password'}
          </button>
        </form>
        {pwError && <p role="alert" className="text-red-400 text-sm mt-3">{pwError}</p>}
        {pwSuccess && <p className="text-green-400 text-sm mt-3">{pwSuccess}</p>}
      </section>
    </div>
  )
}
