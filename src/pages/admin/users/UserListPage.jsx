import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { listUsers, createUser } from '../../../api/admin'
import { useBand } from '../../../auth/BandContext'
import { ROLE_OPTIONS, roleLabel } from '../../../constants/roles'
import { userLabel } from '../../../constants/users'
import { AdminTable, Modal, inputCls, btnPrimary, errMsg } from '../components/AdminUI'

// Sysadmin Users page (#54): a table of users with a Create User action. Row
// click navigates to the user detail page (#55) where editing happens. Gated on
// role === 'system_administrator' (Req 18.4/18.5).
export default function UserListPage() {
  const { role } = useBand()
  const isSysAdmin = role === 'system_administrator'
  const navigate = useNavigate()

  const [users, setUsers] = useState([])
  const [loadError, setLoadError] = useState(null)
  const [showCreate, setShowCreate] = useState(false)

  const fetchUsers = useCallback(async () => {
    if (!isSysAdmin) return
    try {
      const res = await listUsers()
      setUsers(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      setLoadError(errMsg(err, 'Failed to load users.'))
    }
  }, [isSysAdmin])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  if (!isSysAdmin) {
    return (
      <p className="text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">
        You are not authorized to manage users.
      </p>
    )
  }

  const columns = [
    { key: 'name', header: 'Name', render: (u) => userLabel(u) || '—' },
    { key: 'email', header: 'Email' },
    { key: 'role', header: 'Role', render: (u) => roleLabel(u.role) },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Users</h1>
        <button className={btnPrimary} onClick={() => setShowCreate(true)}>
          Create User
        </button>
      </div>

      {loadError && <p className="text-red-400 text-sm mb-4">{loadError}</p>}

      <AdminTable
        columns={columns}
        rows={users}
        rowKey={(u) => u.id || u._id}
        onRowClick={(u) => navigate(`/admin/users/${u.id || u._id}`)}
        empty="No users"
      />

      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={async () => {
            setShowCreate(false)
            await fetchUsers()
          }}
        />
      )}
    </div>
  )
}

// Create-user modal — email, password, first/last name, role. Reuses createUser.
function CreateUserModal({ onClose, onCreated }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [newRole, setNewRole] = useState('user')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!email.trim() || !password) {
      setError('Email and password are required.')
      return
    }
    setSaving(true)
    try {
      await createUser({
        email: email.trim(),
        password,
        role: newRole,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      })
      await onCreated()
    } catch (err) {
      setError(errMsg(err, 'Failed to create user.'))
      setSaving(false)
    }
  }

  return (
    <Modal title="Create User" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
        <input type="text" placeholder="First name (optional)" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} />
        <input type="text" placeholder="Last name (optional)" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} />
        <select aria-label="New user role" value={newRole} onChange={(e) => setNewRole(e.target.value)} className={inputCls}>
          {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
        <div className="flex items-center gap-3 mt-1">
          <button type="submit" disabled={saving} className={btnPrimary}>
            {saving ? 'Creating…' : 'Create User'}
          </button>
          <button type="button" onClick={onClose} className="text-sm text-gray-400 hover:text-white px-3 py-2">
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  )
}
