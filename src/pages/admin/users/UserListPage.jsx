import { useEffect, useState, useCallback } from 'react'
import { listUsers, createUser, setUserRole } from '../../../api/admin'
import { useBand } from '../../../auth/BandContext'
import { ROLE_OPTIONS } from '../../../constants/roles'

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
  const [newRole, setNewRole] = useState('user')
  const [createError, setCreateError] = useState(null)
  const [createSuccess, setCreateSuccess] = useState(null)

  const [roleUserId, setRoleUserId] = useState('')
  const [assignRole, setAssignRole] = useState('user')
  const [roleError, setRoleError] = useState(null)
  const [roleSuccess, setRoleSuccess] = useState(null)

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
      const res = await createUser({ email: email.trim(), password, role: newRole })
      const created = res?.data
      setCreateSuccess(`Created ${created?.email || email.trim()}.`)
      setEmail('')
      setPassword('')
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
          <select value={newRole} onChange={e => setNewRole(e.target.value)} className={inputCls}>
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
              return <option key={uid} value={uid}>{u.email}</option>
            })}
          </select>
          <select value={assignRole} onChange={e => setAssignRole(e.target.value)} className={inputCls}>
            {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <button type="submit" className="bg-purple-700 hover:bg-purple-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors self-start">
            Assign Role
          </button>
        </form>
        {roleError && <p className="text-red-400 text-sm mt-3">{roleError}</p>}
        {roleSuccess && <p className="text-green-400 text-sm mt-3">{roleSuccess}</p>}
      </section>
    </div>
  )
}
