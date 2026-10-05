import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  listBands,
  listUsers,
  listBandMembers,
  renameBand,
  setBandAdministrator,
  addBandMember,
  removeBandMember,
  archiveBand,
  unarchiveBand,
  deleteBand,
} from '../../../api/admin'
import { useBand } from '../../../auth/BandContext'
import { useAuth } from '../../../auth/AuthContext'
import { userLabel } from '../../../constants/users'
import ConfirmDialog from '../../../components/ConfirmDialog'
import { DetailShell, Section, AdminTable, inputCls, btnPrimary, errMsg } from '../components/AdminUI'
import { bandErrorMessage } from '../../../constants/bandErrors'

// Sysadmin band-detail page (#57): rename, reassign administrator, manage
// members (add/remove with admin indicator), and archive/delete. Gated on
// sysadmin role.
export default function BandDetailPage() {
  const { id } = useParams()
  const { role } = useBand()
  const { user: authUser, refresh } = useAuth()
  const navigate = useNavigate()
  const isSysAdmin = role === 'system_administrator'

  const [band, setBand] = useState(null)
  const [members, setMembers] = useState([])
  const [users, setUsers] = useState([])
  const [loadError, setLoadError] = useState(null)

  const load = useCallback(async () => {
    if (!isSysAdmin) return
    setLoadError(null)
    try {
      const [bandsRes, membersRes, usersRes] = await Promise.all([
        listBands(),
        listBandMembers(id),
        listUsers(),
      ])
      const found = (bandsRes.data || []).find((b) => String(b.id || b._id) === String(id))
      setBand(found || null)
      setMembers(Array.isArray(membersRes.data) ? membersRes.data : [])
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : [])
      if (!found) setLoadError('Band not found.')
    } catch (err) {
      setLoadError(errMsg(err, 'Failed to load band.'))
    }
  }, [id, isSysAdmin])

  useEffect(() => {
    load()
  }, [load])

  // Refresh the session if an action affects the current user's own membership
  // (so the NavBar switcher reflects it without a reload).
  const refreshIfSelf = useCallback(
    async (userId) => {
      if (authUser?.id && String(userId) === String(authUser.id)) {
        try { await refresh() } catch { /* non-fatal */ }
      }
    },
    [authUser, refresh]
  )

  if (!isSysAdmin) {
    return (
      <p className="text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">
        You are not authorized to manage bands.
      </p>
    )
  }

  return (
    <DetailShell backTo="/admin/bands" backLabel="Bands" title={band ? band.name : 'Band'}>
      {loadError && <p role="alert" className="text-red-400 text-sm mb-4">{loadError}</p>}
      {!band ? (
        !loadError && <p className="text-gray-400 text-sm">Loading…</p>
      ) : (
        <>
          <RenameWidget band={band} onChanged={load} />
          <AdministratorWidget band={band} members={members} onChanged={load} refreshIfSelf={refreshIfSelf} />
          <MembersWidget band={band} members={members} users={users} onChanged={load} refreshIfSelf={refreshIfSelf} />
          <DangerZone band={band} onChanged={load} onDeleted={() => navigate('/admin/bands')} />
        </>
      )}
    </DetailShell>
  )
}

function RenameWidget({ band, onChanged }) {
  const [name, setName] = useState(band.name)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    if (!name.trim()) { setError('Name is required.'); return }
    setSaving(true)
    try {
      await renameBand(band.id || band._id, name.trim())
      setSuccess('Renamed.')
      await onChanged()
    } catch (err) {
      setError(bandErrorMessage(err, 'Failed to rename band.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Section title="Rename">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input aria-label="Band name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls + ' flex-1'} />
        <button type="submit" disabled={saving} className={btnPrimary}>Save</button>
      </form>
      {error && <p role="alert" className="text-red-400 text-sm mt-2">{error}</p>}
      {success && <p className="text-green-400 text-sm mt-2">{success}</p>}
    </Section>
  )
}

function AdministratorWidget({ band, members, onChanged, refreshIfSelf }) {
  const [userId, setUserId] = useState('')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    if (!userId) return
    setSaving(true)
    try {
      await setBandAdministrator(band.id || band._id, userId)
      setSuccess('Administrator updated.')
      await refreshIfSelf(userId)
      setUserId('')
      await onChanged()
    } catch (err) {
      setError(errMsg(err, 'Failed to set administrator.'))
    } finally {
      setSaving(false)
    }
  }

  // The administrator must be a current member; pick from the members list.
  return (
    <Section title="Administrator">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <select aria-label="Set administrator" value={userId} onChange={(e) => setUserId(e.target.value)} className={inputCls + ' flex-1'}>
          <option value="">Reassign administrator to…</option>
          {members.map((m) => {
            const mid = m.id || m._id
            return <option key={mid} value={mid}>{userLabel(m)}</option>
          })}
        </select>
        <button type="submit" disabled={saving || !userId} className={btnPrimary}>Set</button>
      </form>
      {error && <p role="alert" className="text-red-400 text-sm mt-2">{error}</p>}
      {success && <p className="text-green-400 text-sm mt-2">{success}</p>}
    </Section>
  )
}

function MembersWidget({ band, members, users, onChanged, refreshIfSelf }) {
  const [addUserId, setAddUserId] = useState('')
  const [error, setError] = useState(null)
  const [pending, setPending] = useState(false)

  const memberIds = new Set(members.map((m) => String(m.id || m._id)))
  const addable = users.filter((u) => !memberIds.has(String(u.id || u._id)))

  async function handleAdd(e) {
    e.preventDefault()
    if (!addUserId) return
    setError(null)
    setPending(true)
    try {
      await addBandMember(band.id || band._id, addUserId)
      await refreshIfSelf(addUserId)
      setAddUserId('')
      await onChanged()
    } catch (err) {
      setError(errMsg(err, 'Failed to add member.'))
    } finally {
      setPending(false)
    }
  }

  async function handleRemove(userId) {
    setError(null)
    setPending(true)
    try {
      await removeBandMember(band.id || band._id, userId)
      await refreshIfSelf(userId)
      await onChanged()
    } catch (err) {
      setError(errMsg(err, 'Failed to remove member.'))
    } finally {
      setPending(false)
    }
  }

  const columns = [
    { key: 'name', header: 'Member', render: (m) => userLabel(m) },
    {
      // Single indicator per row: the band administrator shows an Admin badge;
      // other members show a Remove action.
      key: 'actions',
      header: '',
      className: 'w-28 text-right',
      render: (m) =>
        m.isAdmin ? (
          <span className="text-xs font-medium text-purple-200 bg-purple-800/60 rounded-full px-2 py-0.5">Admin</span>
        ) : (
          <button onClick={() => handleRemove(m.id || m._id)} disabled={pending} className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50 px-2 py-1">
            Remove
          </button>
        ),
    },
  ]

  return (
    <Section title="Members">
      {error && <p role="alert" className="text-red-400 text-sm mb-3">{error}</p>}
      <AdminTable columns={columns} rows={members} rowKey={(m) => m.id || m._id} empty="No members" />
      <form onSubmit={handleAdd} className="flex gap-2 mt-4">
        <select aria-label="Add member" value={addUserId} onChange={(e) => setAddUserId(e.target.value)} className={inputCls + ' flex-1'}>
          <option value="">Add a member…</option>
          {addable.map((u) => {
            const uid = u.id || u._id
            return <option key={uid} value={uid}>{userLabel(u)}</option>
          })}
        </select>
        <button type="submit" disabled={pending || !addUserId} className={btnPrimary}>Add</button>
      </form>
    </Section>
  )
}

function DangerZone({ band, onChanged, onDeleted }) {
  const bandId = band.id || band._id
  const isArchived = Boolean(band.archivedAt)
  const [error, setError] = useState(null)
  const [pending, setPending] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function doArchive() {
    setError(null); setPending(true)
    try { await archiveBand(bandId); await onChanged() }
    catch (err) { setError(errMsg(err, 'Failed to archive band.')) }
    finally { setPending(false) }
  }
  async function doUnarchive() {
    setError(null); setPending(true)
    try { await unarchiveBand(bandId); await onChanged() }
    catch (err) { setError(errMsg(err, 'Failed to unarchive band.')) }
    finally { setPending(false) }
  }
  async function doDelete() {
    setConfirmDelete(false)
    setError(null); setPending(true)
    try { await deleteBand(bandId); onDeleted() }
    catch (err) { setError(errMsg(err, 'Failed to delete band.')); setPending(false) }
  }

  return (
    <Section title="Archive / Delete">
      <p className="text-gray-400 text-xs mb-3">
        A band must be archived before it can be permanently deleted. Deleting removes
        the band&apos;s songs, setlists, gigs, genres, and memberships.
      </p>
      {error && <p role="alert" className="text-red-400 text-sm mb-3">{error}</p>}
      <div className="flex items-center gap-3">
        {isArchived ? (
          <>
            <button onClick={doUnarchive} disabled={pending} className="text-sm text-gray-300 hover:text-white px-3 py-2 rounded-lg hover:bg-purple-900/30 disabled:opacity-50">
              Unarchive
            </button>
            <button onClick={() => setConfirmDelete(true)} disabled={pending} className="text-sm text-white bg-red-700 hover:bg-red-600 px-4 py-2 rounded-lg disabled:opacity-50">
              Delete permanently
            </button>
          </>
        ) : (
          <button onClick={doArchive} disabled={pending} className="text-sm text-amber-200 bg-amber-800/40 hover:bg-amber-800/60 px-4 py-2 rounded-lg disabled:opacity-50">
            Archive
          </button>
        )}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          message={`Permanently delete ${band.name}? This removes all of its songs, setlists, gigs, genres, and memberships. This cannot be undone.`}
          onConfirm={doDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </Section>
  )
}
