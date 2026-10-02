import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { listUsers, listBands, createBand } from '../../../api/admin'
import { useBand } from '../../../auth/BandContext'
import { useAuth } from '../../../auth/AuthContext'
import { userLabel } from '../../../constants/users'
import { AdminTable, Modal, inputCls, btnPrimary, errMsg } from '../components/AdminUI'
import { bandErrorMessage } from '../../../constants/bandErrors'

// Sysadmin Bands page (#56): a table of bands with a Create Band action. Row
// click navigates to the band detail page (#57) where management happens. Gated
// on role === 'system_administrator'.
export default function BandAdminListPage() {
  const { role } = useBand()
  const { user, refresh } = useAuth()
  const isSysAdmin = role === 'system_administrator'
  const navigate = useNavigate()

  const [bands, setBands] = useState([])
  const [users, setUsers] = useState([])
  const [loadError, setLoadError] = useState(null)
  const [showCreate, setShowCreate] = useState(false)

  const fetchBands = useCallback(async () => {
    if (!isSysAdmin) return
    try {
      const res = await listBands()
      setBands(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      setLoadError(errMsg(err, 'Failed to load bands.'))
    }
  }, [isSysAdmin])

  const fetchUsers = useCallback(async () => {
    if (!isSysAdmin) return
    try {
      const res = await listUsers()
      setUsers(Array.isArray(res.data) ? res.data : [])
    } catch {
      /* picker stays empty on error */
    }
  }, [isSysAdmin])

  useEffect(() => {
    fetchBands()
    fetchUsers()
  }, [fetchBands, fetchUsers])

  if (!isSysAdmin) {
    return (
      <p className="text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">
        You are not authorized to manage bands.
      </p>
    )
  }

  // Map administrator id -> friendly label from the loaded users list.
  const adminLabel = (band) => {
    const u = users.find((x) => String(x.id || x._id) === String(band.administrator))
    return u ? userLabel(u) : '—'
  }

  const columns = [
    { key: 'name', header: 'Band' },
    { key: 'administrator', header: 'Administrator', render: adminLabel },
    {
      key: 'archived',
      header: '',
      className: 'w-28',
      render: (b) =>
        b.archivedAt ? (
          <span className="text-xs font-medium text-amber-200 bg-amber-800/50 rounded-full px-2 py-0.5">Archived</span>
        ) : null,
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Bands</h1>
        <button className={btnPrimary} onClick={() => setShowCreate(true)}>
          Create Band
        </button>
      </div>

      {loadError && <p className="text-red-400 text-sm mb-4">{loadError}</p>}

      <AdminTable
        columns={columns}
        rows={bands}
        rowKey={(b) => b.id || b._id}
        onRowClick={(b) => navigate(`/admin/bands/${b.id || b._id}`)}
        empty="No bands"
      />

      {showCreate && (
        <CreateBandModal
          users={users}
          currentUserId={user?.id}
          refresh={refresh}
          onClose={() => setShowCreate(false)}
          onCreated={async () => {
            setShowCreate(false)
            await fetchBands()
          }}
        />
      )}
    </div>
  )
}

// Create-band modal — name + administrator picker. If the admin makes THEMSELVES
// the administrator, refresh the session so the NavBar switcher updates.
function CreateBandModal({ users, currentUserId, refresh, onClose, onCreated }) {
  const [name, setName] = useState('')
  const [administrator, setAdministrator] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!name.trim() || !administrator) {
      setError('Band name and administrator are required.')
      return
    }
    setSaving(true)
    try {
      await createBand({ name: name.trim(), administrator })
      if (currentUserId && String(administrator) === String(currentUserId)) {
        try { await refresh() } catch { /* non-fatal */ }
      }
      await onCreated()
    } catch (err) {
      setError(bandErrorMessage(err, 'Failed to create band.'))
      setSaving(false)
    }
  }

  return (
    <Modal title="Create Band" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input type="text" placeholder="Band name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        <select aria-label="Create band administrator" value={administrator} onChange={(e) => setAdministrator(e.target.value)} className={inputCls}>
          <option value="">Select an administrator…</option>
          {users.map((u) => {
            const uid = u.id || u._id
            return <option key={uid} value={uid}>{userLabel(u)}</option>
          })}
        </select>
        {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
        <div className="flex items-center gap-3 mt-1">
          <button type="submit" disabled={saving} className={btnPrimary}>{saving ? 'Creating…' : 'Create Band'}</button>
          <button type="button" onClick={onClose} className="text-sm text-gray-400 hover:text-white px-3 py-2">Cancel</button>
        </div>
      </form>
    </Modal>
  )
}
