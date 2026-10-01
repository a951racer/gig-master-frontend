import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import {
  getUser,
  updateUser,
  listBands,
  addBandMember,
  removeBandMember,
} from '../../../api/admin'
import { useBand } from '../../../auth/BandContext'
import { useAuth } from '../../../auth/AuthContext'
import { ROLE_OPTIONS } from '../../../constants/roles'
import { DetailShell, Section, AdminTable, inputCls, btnPrimary, errMsg } from '../components/AdminUI'

// Sysadmin user-detail page (#55): edit a single user's fields, reset their
// password, and view/edit their band memberships. Gated on sysadmin role.
export default function UserDetailPage() {
  const { id } = useParams()
  const { role } = useBand()
  const { user: authUser, refresh } = useAuth()
  const isSysAdmin = role === 'system_administrator'

  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState(null)

  const load = useCallback(async () => {
    if (!isSysAdmin) return
    setLoadError(null)
    try {
      const res = await getUser(id)
      setData(res.data)
    } catch (err) {
      setLoadError(errMsg(err, 'Failed to load user.'))
    }
  }, [id, isSysAdmin])

  useEffect(() => {
    load()
  }, [load])

  if (!isSysAdmin) {
    return (
      <p className="text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">
        You are not authorized to manage users.
      </p>
    )
  }

  return (
    <DetailShell backTo="/admin/users" backLabel="Users" title={data ? (data.email || 'User') : 'User'}>
      {loadError && <p role="alert" className="text-red-400 text-sm mb-4">{loadError}</p>}
      {!data ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : (
        <>
          <EditFields user={data} onSaved={load} isSelf={String(authUser?.id) === String(data.id)} refresh={refresh} />
          <ChangePassword userId={data.id} />
          <Memberships user={data} onChanged={load} />
        </>
      )}
    </DetailShell>
  )
}

function EditFields({ user, onSaved, isSelf, refresh }) {
  const [email, setEmail] = useState(user.email || '')
  const [firstName, setFirstName] = useState(user.firstName || '')
  const [lastName, setLastName] = useState(user.lastName || '')
  const [roleVal, setRoleVal] = useState(user.role || 'user')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    if (!email.trim()) {
      setError('Email is required.')
      return
    }
    setSaving(true)
    try {
      await updateUser(user.id, {
        email: email.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role: roleVal,
      })
      setSuccess('Saved.')
      // If the sysadmin changed their OWN role, refresh the session so nav
      // gating reflects it.
      if (isSelf && roleVal !== user.role) {
        try { await refresh() } catch { /* non-fatal */ }
      }
      await onSaved()
    } catch (err) {
      setError(errMsg(err, 'Failed to save user.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Section title="Details">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input type="email" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
        <input type="text" aria-label="First name" placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} />
        <input type="text" aria-label="Last name" placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} />
        <select aria-label="Role" value={roleVal} onChange={(e) => setRoleVal(e.target.value)} className={inputCls}>
          {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <div>
          <button type="submit" disabled={saving} className={btnPrimary}>{saving ? 'Saving…' : 'Save details'}</button>
        </div>
        {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
        {success && <p className="text-green-400 text-sm">{success}</p>}
      </form>
    </Section>
  )
}

function ChangePassword({ userId }) {
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.')
      return
    }
    setSaving(true)
    try {
      await updateUser(userId, { newPassword })
      setSuccess('Password changed.')
      setNewPassword('')
    } catch (err) {
      setError(errMsg(err, 'Failed to change password.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Section title="Change password">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input type="password" aria-label="New password" placeholder="New password (min 8 characters)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputCls} />
        <div>
          <button type="submit" disabled={saving} className={btnPrimary}>{saving ? 'Saving…' : 'Set password'}</button>
        </div>
        {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
        {success && <p className="text-green-400 text-sm">{success}</p>}
      </form>
    </Section>
  )
}

function Memberships({ user, onChanged }) {
  const [allBands, setAllBands] = useState([])
  const [addBandId, setAddBandId] = useState('')
  const [error, setError] = useState(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    listBands().then((res) => setAllBands(Array.isArray(res.data) ? res.data : [])).catch(() => {})
  }, [])

  // Bands the user is not already a member of (candidates for adding).
  const memberBandIds = new Set((user.bands || []).map((b) => String(b.id)))
  const addable = allBands.filter((b) => !memberBandIds.has(String(b.id || b._id)))

  async function handleAdd(e) {
    e.preventDefault()
    if (!addBandId) return
    setError(null)
    setPending(true)
    try {
      await addBandMember(addBandId, user.id)
      setAddBandId('')
      await onChanged()
    } catch (err) {
      setError(errMsg(err, 'Failed to add to band.'))
    } finally {
      setPending(false)
    }
  }

  async function handleRemove(bandId) {
    setError(null)
    setPending(true)
    try {
      await removeBandMember(bandId, user.id)
      await onChanged()
    } catch (err) {
      setError(errMsg(err, 'Failed to remove from band.'))
    } finally {
      setPending(false)
    }
  }

  const columns = [
    { key: 'name', header: 'Band' },
    {
      key: 'role',
      header: '',
      className: 'w-24',
      render: (b) => (b.isAdmin ? <span className="text-xs font-medium text-purple-200 bg-purple-800/60 rounded-full px-2 py-0.5">Admin</span> : null),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-24 text-right',
      render: (b) =>
        b.isAdmin ? (
          <span className="text-xs text-gray-500">admin</span>
        ) : (
          <button onClick={() => handleRemove(b.id)} disabled={pending} className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50 px-2 py-1">
            Remove
          </button>
        ),
    },
  ]

  return (
    <Section title="Band memberships">
      {error && <p role="alert" className="text-red-400 text-sm mb-3">{error}</p>}

      <AdminTable
        columns={columns}
        rows={user.bands || []}
        rowKey={(b) => b.id}
        empty="Not a member of any band"
      />

      <form onSubmit={handleAdd} className="flex gap-2 mt-4">
        <select aria-label="Add to band" value={addBandId} onChange={(e) => setAddBandId(e.target.value)} className={inputCls + ' flex-1'}>
          <option value="">Add to a band…</option>
          {addable.map((b) => {
            const bid = b.id || b._id
            return <option key={bid} value={bid}>{b.name}</option>
          })}
        </select>
        <button type="submit" disabled={pending || !addBandId} className={btnPrimary}>Add</button>
      </form>
    </Section>
  )
}
