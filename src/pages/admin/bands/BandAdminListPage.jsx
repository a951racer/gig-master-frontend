import { useState } from 'react'
import { createBand, addBandMember, setBandAdministrator } from '../../../api/admin'
import { useBand } from '../../../auth/BandContext'

const inputCls = 'bg-[#1e1b2e] border border-purple-800/40 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600 text-sm'

function errMsg(err, fallback) {
  return err?.response?.data?.error?.message || err?.response?.data?.message || fallback
}

export default function BandAdminListPage() {
  const { role } = useBand()

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

  // Page-level role gating (Req 18.4/18.5): only system_administrator may use
  // this screen. Non-sysadmins see a not-authorized state and no admin API is called.
  if (role !== 'system_administrator') {
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
    if (!name.trim() || !administrator.trim()) return
    try {
      const res = await createBand({ name: name.trim(), administrator: administrator.trim() })
      const created = res?.data
      setCreateSuccess(`Created band ${created?.name || name.trim()}${created?.id ? ` (id ${created.id})` : ''}.`)
      setName('')
      setAdministrator('')
    } catch (err) {
      setCreateError(errMsg(err, 'Failed to create band.'))
    }
  }

  async function handleAddMember(e) {
    e.preventDefault()
    setMemberError(null)
    setMemberSuccess(null)
    if (!memberBandId.trim() || !memberUserId.trim()) return
    try {
      await addBandMember(memberBandId.trim(), memberUserId.trim())
      setMemberSuccess(`Added user ${memberUserId.trim()} to band ${memberBandId.trim()}.`)
      setMemberUserId('')
    } catch (err) {
      setMemberError(errMsg(err, 'Failed to add member.'))
    }
  }

  async function handleSetAdministrator(e) {
    e.preventDefault()
    setAdminError(null)
    setAdminSuccess(null)
    if (!adminBandId.trim() || !adminUserId.trim()) return
    try {
      await setBandAdministrator(adminBandId.trim(), adminUserId.trim())
      setAdminSuccess(`Administrator of band ${adminBandId.trim()} set to user ${adminUserId.trim()}.`)
      setAdminUserId('')
    } catch (err) {
      setAdminError(errMsg(err, 'Failed to set administrator.'))
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
          <input
            type="text" placeholder="Administrator user ID" value={administrator}
            onChange={e => setAdministrator(e.target.value)}
            className={inputCls}
          />
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
          <input
            type="text" placeholder="Band ID" value={memberBandId}
            onChange={e => setMemberBandId(e.target.value)}
            className={inputCls}
          />
          <input
            type="text" placeholder="User ID" value={memberUserId}
            onChange={e => setMemberUserId(e.target.value)}
            className={inputCls}
          />
          <button type="submit" className="bg-purple-700 hover:bg-purple-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors self-start">
            Add Member
          </button>
        </form>
        {memberError && <p className="text-red-400 text-sm mt-3">{memberError}</p>}
        {memberSuccess && <p className="text-green-400 text-sm mt-3">{memberSuccess}</p>}
      </section>

      {/* Designate / reassign administrator */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-3">Designate / Reassign Administrator</h2>
        <form onSubmit={handleSetAdministrator} className="flex flex-col gap-3">
          <input
            type="text" placeholder="Band ID" value={adminBandId}
            onChange={e => setAdminBandId(e.target.value)}
            className={inputCls}
          />
          <input
            type="text" placeholder="User ID" value={adminUserId}
            onChange={e => setAdminUserId(e.target.value)}
            className={inputCls}
          />
          <button type="submit" className="bg-purple-700 hover:bg-purple-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors self-start">
            Set Administrator
          </button>
        </form>
        {adminError && <p className="text-red-400 text-sm mt-3">{adminError}</p>}
        {adminSuccess && <p className="text-green-400 text-sm mt-3">{adminSuccess}</p>}
      </section>
    </div>
  )
}
