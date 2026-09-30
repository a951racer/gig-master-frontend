import { useEffect, useState, useCallback } from 'react'
import { listUsers, createUser, setUserRole, updateUser } from '../../../api/admin'
import { useBand } from '../../../auth/BandContext'
import { ROLE_OPTIONS } from '../../../constants/roles'
import { userLabel } from '../../../constants/users'

const inputCls = 'bg-[#1e1b2e] border border-purple-800/40 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600 text-sm'

function errMsg(err, fallback) {
  return err?.response?.data?.error?.message || err?.response?.data?.message || fallback
}

export default function UserListPage() {
  const { role } = useBand()
  const isSysAdmin = role === 'system_administrator'

  const [users, setUsers] = useState([])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [newRole, setNewRole] = useState('user')
  const [createError, setCreateError] = useState(null)
  const [createSuccess, setCreateSuccess] = useState(null)

  const [roleUserId, setRoleUserId] = useState('')
  const [assignRole, setAssignRole] = useState('user')
  const [roleError, setRoleError] = useState(null)
  const [roleSuccess, setRoleSuccess] = useState(null)

  // Edit-user (#40): pick a user, populate the fields, and PATCH them.
  const [editUserId, setEditUserId] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')
  const [editRole, setEditRole] = useState('user')
  const [editPassword, setEditPassword] = useState('')
  const [editError, setEditError] = useState(null)
  const [editSuccess, setEditSuccess] = useState(null)
  const [savingEdit, setSavingEdit] = useState(false)

  const fetchUsers = useCallback(async () => {
    if (!isSysAdmin) return
    try {
      const res = await listUsers()
      setUsers(Array.isArray(res.data) ? res.data : [])
    } catch {
      /* ignore load errors; the picker just stays empty */
    }
  }, [isSysAdmin])

  // Load the user list for the assign-role picker (only when authorized).
  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // Page-level role gating (Req 18.4/18.5): only system_administrator may use
  // this screen. Non-sysadmins see a not-authorized state and no admin API is called.
  if (!isSysAdmin) {
    return (
      <div className="max-w-xl mx-auto px-6 py-8">
        <p className="text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">
          You are not authorized to manage users.
        </p>
      </div>
    )
  }

  async function handleCreate(e) {
    e.preventDefault()
    setCreateError(null)
    setCreateSuccess(null)
    if (!email.trim() || !password) return
    try {
      const res = await createUser({
        email: email.trim(),
        password,
        role: newRole,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      })
      const created = res?.data
      setCreateSuccess(`Created ${created?.email || email.trim()}.`)
      setEmail('')
      setPassword('')
      setFirstName('')
      setLastName('')
      setNewRole('user')
      // Refresh the picker so the new user is selectable for role assignment.
      await fetchUsers()
    } catch (err) {
      setCreateError(errMsg(err, 'Failed to create user.'))
    }
  }

  async function handleAssignRole(e) {
    e.preventDefault()
    setRoleError(null)
    setRoleSuccess(null)
    if (!roleUserId) return
    try {
      await setUserRole(roleUserId, assignRole)
      const target = users.find((u) => (u.id || u._id) === roleUserId)
      setRoleSuccess(`Role for ${target?.email || roleUserId} set to ${assignRole}.`)
      setRoleUserId('')
      // Reflect the role change in the loaded list.
      await fetchUsers()
    } catch (err) {
      setRoleError(errMsg(err, 'Failed to assign role.'))
    }
  }

  // Populate the edit form from the selected user.
  function handleSelectEditUser(uid) {
    setEditUserId(uid)
    setEditError(null)
    setEditSuccess(null)
    setEditPassword('')
    const u = users.find((x) => (x.id || x._id) === uid)
    setEditEmail(u?.email || '')
    setEditFirstName(u?.firstName || '')
    setEditLastName(u?.lastName || '')
    setEditRole(u?.role || 'user')
  }

  async function handleEditSubmit(e) {
    e.preventDefault()
    setEditError(null)
    setEditSuccess(null)
    if (!editUserId) return
    if (!editEmail.trim()) {
      setEditError('Email is required.')
      return
    }
    if (editPassword && editPassword.length < 8) {
      setEditError('New password must be at least 8 characters.')
      return
    }
    setSavingEdit(true)
    try {
      const payload = {
        email: editEmail.trim(),
        firstName: editFirstName.trim(),
        lastName: editLastName.trim(),
        role: editRole,
      }
      // Only send a password when the admin actually entered one.
      if (editPassword) payload.newPassword = editPassword
      const res = await updateUser(editUserId, payload)
      setEditSuccess(`Updated ${res?.data?.email || editEmail.trim()}.`)
      setEditPassword('')
      await fetchUsers()
    } catch (err) {
      setEditError(errMsg(err, 'Failed to update user.'))
    } finally {
      setSavingEdit(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-white mb-6">User Management</h1>

      {/* Create user */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-white mb-3">Create User</h2>
        <form onSubmit={handleCreate} className="flex flex-col gap-3">
          <input
            type="email" placeholder="Email" value={email}
            onChange={e => setEmail(e.target.value)}
            className={inputCls}
          />
          <input
            type="password" placeholder="Password" value={password}
            onChange={e => setPassword(e.target.value)}
            className={inputCls}
          />
          <input
            type="text" placeholder="First name (optional)" value={firstName}
            onChange={e => setFirstName(e.target.value)}
            className={inputCls}
          />
          <input
            type="text" placeholder="Last name (optional)" value={lastName}
            onChange={e => setLastName(e.target.value)}
            className={inputCls}
          />
          <select aria-label="New user role" value={newRole} onChange={e => setNewRole(e.target.value)} className={inputCls}>
            {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <button type="submit" className="bg-purple-700 hover:bg-purple-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors self-start">
            Create User
          </button>
        </form>
        {createError && <p className="text-red-400 text-sm mt-3">{createError}</p>}
        {createSuccess && <p className="text-green-400 text-sm mt-3">{createSuccess}</p>}
      </section>

      {/* Assign role */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-3">Assign Role</h2>
        <form onSubmit={handleAssignRole} className="flex flex-col gap-3">
          <select
            aria-label="User"
            value={roleUserId}
            onChange={e => setRoleUserId(e.target.value)}
            className={inputCls}
          >
            <option value="">Select a user…</option>
            {users.map(u => {
              const uid = u.id || u._id
              return <option key={uid} value={uid}>{userLabel(u)}</option>
            })}
          </select>
          <select aria-label="Role to assign" value={assignRole} onChange={e => setAssignRole(e.target.value)} className={inputCls}>
            {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <button type="submit" className="bg-purple-700 hover:bg-purple-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors self-start">
            Assign Role
          </button>
        </form>
        {roleError && <p className="text-red-400 text-sm mt-3">{roleError}</p>}
        {roleSuccess && <p className="text-green-400 text-sm mt-3">{roleSuccess}</p>}
      </section>

      {/* Edit user (#40) */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-white mb-3">Edit User</h2>
        <form onSubmit={handleEditSubmit} className="flex flex-col gap-3">
          <select
            aria-label="User to edit"
            value={editUserId}
            onChange={e => handleSelectEditUser(e.target.value)}
            className={inputCls}
          >
            <option value="">Select a user to edit…</option>
            {users.map(u => {
              const uid = u.id || u._id
              return <option key={uid} value={uid}>{userLabel(u)}</option>
            })}
          </select>

          {editUserId && (
            <>
              <input
                type="email" aria-label="Edit email" placeholder="Email" value={editEmail}
                onChange={e => setEditEmail(e.target.value)}
                className={inputCls}
              />
              <input
                type="text" aria-label="Edit first name" placeholder="First name" value={editFirstName}
                onChange={e => setEditFirstName(e.target.value)}
                className={inputCls}
              />
              <input
                type="text" aria-label="Edit last name" placeholder="Last name" value={editLastName}
                onChange={e => setEditLastName(e.target.value)}
                className={inputCls}
              />
              <select aria-label="Edit role" value={editRole} onChange={e => setEditRole(e.target.value)} className={inputCls}>
                {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <input
                type="password" aria-label="Reset password" placeholder="New password (leave blank to keep current)" value={editPassword}
                onChange={e => setEditPassword(e.target.value)}
                className={inputCls}
              />
              <button
                type="submit" disabled={savingEdit}
                className="bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors self-start"
              >
                {savingEdit ? 'Saving…' : 'Save changes'}
              </button>
            </>
          )}
        </form>
        {editError && <p role="alert" className="text-red-400 text-sm mt-3">{editError}</p>}
        {editSuccess && <p className="text-green-400 text-sm mt-3">{editSuccess}</p>}
      </section>
    </div>
  )
}
