import { useEffect, useState, useCallback } from 'react'
import {
  listUsers,
  listBands,
  createBand,
  addBandMember,
  setBandAdministrator,
  renameBand,
} from '../../../api/admin'
import { useBand } from '../../../auth/BandContext'

const inputCls = 'bg-[#1e1b2e] border border-purple-800/40 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600 text-sm'

function errMsg(err, fallback) {
  return err?.response?.data?.error?.message || err?.response?.data?.message || fallback
}

// Resolve a friendly label from the loaded lists, falling back to the id if the
// list has not populated (so a message is never blank).
function labelFor(list, id, key) {
  const match = (list || []).find((item) => (item.id || item._id) === id)
  return (match && match[key]) || id
}

export default function BandAdminListPage() {
  const { role } = useBand()
  const isSysAdmin = role === 'system_administrator'

  const [users, setUsers] = useState([])
  const [bands, setBands] = useState([])

  const [name, setName] = useState('')
  const [administrator, setAdministrator] = useState('')
  const [createError, setCreateError] = useState(null)
  const [createSuccess, setCreateSuccess] = useState(null)

  const [memberBandId, setMemberBandId] = useState('')
  const [memberUserId, setMemberUserId] = useState('')
  const [memberError, setMemberError] = useState(null)
  const [memberSuccess, setMemberSuccess] = useState(null)

  const [adminBandId, setAdminBandId] = useState('')
  const [adminUserId, setAdminUserId] = useState('')
  const [adminError, setAdminError] = useState(null)
  const [adminSuccess, setAdminSuccess] = useState(null)

  const [renameBandId, setRenameBandId] = useState('')
  const [renameName, setRenameName] = useState('')
  const [renameError, setRenameError] = useState(null)
  const [renameSuccess, setRenameSuccess] = useState(null)

  const fetchUsers = useCallback(async () => {
    if (!isSysAdmin) return
    try {
      const res = await listUsers()
      setUsers(Array.isArray(res.data) ? res.data : [])
    } catch {
      /* ignore load errors; the picker just stays empty */
    }
  }, [isSysAdmin])

  const fetchBands = useCallback(async () => {
    if (!isSysAdmin) return
    try {
      const res = await listBands()
      setBands(Array.isArray(res.data) ? res.data : [])
    } catch {
      /* ignore load errors; the picker just stays empty */
    }
  }, [isSysAdmin])

  // Load the user and band lists for the dropdowns (only when authorized).
  useEffect(() => {
    fetchUsers()
    fetchBands()
  }, [fetchUsers, fetchBands])

  // Page-level role gating (Req 18.4/18.5): only system_administrator may use
  // this screen. Non-sysadmins see a not-authorized state and no admin API is called.
  if (!isSysAdmin) {
    return (
      <div className="max-w-xl mx-auto px-6 py-8">
        <p className="text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">
          You are not authorized to manage bands.
        </p>
      </div>
    )
  }

  async function handleCreate(e) {
    e.preventDefault()
    setCreateError(null)
    setCreateSuccess(null)
    if (!name.trim() || !administrator) return
    try {
      const res = await createBand({ name: name.trim(), administrator })
      const created = res?.data
      setCreateSuccess(`Created band ${created?.name || name.trim()}.`)
      setName('')
      setAdministrator('')
      // Refresh the band picker so the new band is selectable.
      await fetchBands()
    } catch (err) {
      setCreateError(errMsg(err, 'Failed to create band.'))
    }
  }

  async function handleAddMember(e) {
    e.preventDefault()
    setMemberError(null)
    setMemberSuccess(null)
    if (!memberBandId || !memberUserId) return
    try {
      await addBandMember(memberBandId, memberUserId)
      setMemberSuccess(`Added ${labelFor(users, memberUserId, 'email')} to ${labelFor(bands, memberBandId, 'name')}.`)
      setMemberUserId('')
    } catch (err) {
      setMemberError(errMsg(err, 'Failed to add member.'))
    }
  }

  async function handleSetAdministrator(e) {
    e.preventDefault()
    setAdminError(null)
    setAdminSuccess(null)
    if (!adminBandId || !adminUserId) return
    try {
      await setBandAdministrator(adminBandId, adminUserId)
      setAdminSuccess(`Administrator of ${labelFor(bands, adminBandId, 'name')} set to ${labelFor(users, adminUserId, 'email')}.`)
      setAdminUserId('')
    } catch (err) {
      setAdminError(errMsg(err, 'Failed to set administrator.'))
    }
  }

  async function handleRename(e) {
    e.preventDefault()
    setRenameError(null)
    setRenameSuccess(null)
    if (!renameBandId || !renameName.trim()) return
    try {
      await renameBand(renameBandId, renameName.trim())
      setRenameSuccess(`Renamed band to ${renameName.trim()}.`)
      setRenameName('')
      // Refresh the band pickers so the new name is reflected.
      await fetchBands()
    } catch (err) {
      setRenameError(errMsg(err, 'Failed to rename band.'))
    }
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-white mb-6">Band Management</h1>

      {/* Create band */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-white mb-3">Create Band</h2>
        <form onSubmit={handleCreate} className="flex flex-col gap-3">
          <input
            type="text" placeholder="Band name" value={name}
            onChange={e => setName(e.target.value)}
            className={inputCls}
          />
          <select
            aria-label="Create band administrator"
            value={administrator}
            onChange={e => setAdministrator(e.target.value)}
            className={inputCls}
          >
            <option value="">Select a user…</option>
            {users.map(u => {
              const uid = u.id || u._id
              return <option key={uid} value={uid}>{u.email}</option>
            })}
          </select>
          <button type="submit" className="bg-purple-700 hover:bg-purple-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors self-start">
            Create Band
          </button>
        </form>
        {createError && <p className="text-red-400 text-sm mt-3">{createError}</p>}
        {createSuccess && <p className="text-green-400 text-sm mt-3">{createSuccess}</p>}
      </section>

      {/* Add member directly */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-white mb-3">Add Member</h2>
        <form onSubmit={handleAddMember} className="flex flex-col gap-3">
          <select
            aria-label="Add member band"
            value={memberBandId}
            onChange={e => setMemberBandId(e.target.value)}
            className={inputCls}
          >
            <option value="">Select a band…</option>
            {bands.map(b => {
              const bid = b.id || b._id
              return <option key={bid} value={bid}>{b.name}</option>
            })}
          </select>
          <select
            aria-label="Add member user"
            value={memberUserId}
            onChange={e => setMemberUserId(e.target.value)}
            className={inputCls}
          >
            <option value="">Select a user…</option>
            {users.map(u => {
              const uid = u.id || u._id
              return <option key={uid} value={uid}>{u.email}</option>
            })}
          </select>
          <button type="submit" className="bg-purple-700 hover:bg-purple-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors self-start">
            Add Member
          </button>
        </form>
        {memberError && <p className="text-red-400 text-sm mt-3">{memberError}</p>}
        {memberSuccess && <p className="text-green-400 text-sm mt-3">{memberSuccess}</p>}
      </section>

      {/* Designate / reassign administrator */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-white mb-3">Designate / Reassign Administrator</h2>
        <form onSubmit={handleSetAdministrator} className="flex flex-col gap-3">
          <select
            aria-label="Set administrator band"
            value={adminBandId}
            onChange={e => setAdminBandId(e.target.value)}
            className={inputCls}
          >
            <option value="">Select a band…</option>
            {bands.map(b => {
              const bid = b.id || b._id
              return <option key={bid} value={bid}>{b.name}</option>
            })}
          </select>
          <select
            aria-label="Set administrator user"
            value={adminUserId}
            onChange={e => setAdminUserId(e.target.value)}
            className={inputCls}
          >
            <option value="">Select a user…</option>
            {users.map(u => {
              const uid = u.id || u._id
              return <option key={uid} value={uid}>{u.email}</option>
            })}
          </select>
          <button type="submit" className="bg-purple-700 hover:bg-purple-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors self-start">
            Set Administrator
          </button>
        </form>
        {adminError && <p className="text-red-400 text-sm mt-3">{adminError}</p>}
        {adminSuccess && <p className="text-green-400 text-sm mt-3">{adminSuccess}</p>}
      </section>

      {/* Rename band */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-3">Rename Band</h2>
        <form onSubmit={handleRename} className="flex flex-col gap-3">
          <select
            aria-label="Rename band"
            value={renameBandId}
            onChange={e => setRenameBandId(e.target.value)}
            className={inputCls}
          >
            <option value="">Select a band…</option>
            {bands.map(b => {
              const bid = b.id || b._id
              return <option key={bid} value={bid}>{b.name}</option>
            })}
          </select>
          <input
            type="text" placeholder="New band name" value={renameName}
            onChange={e => setRenameName(e.target.value)}
            className={inputCls}
          />
          <button type="submit" className="bg-purple-700 hover:bg-purple-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors self-start">
            Save
          </button>
        </form>
        {renameError && <p className="text-red-400 text-sm mt-3">{renameError}</p>}
        {renameSuccess && <p className="text-green-400 text-sm mt-3">{renameSuccess}</p>}
      </section>
    </div>
  )
}
