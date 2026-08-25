import React, { useState, useEffect, useCallback } from 'react'
import Sidebar from '../components/Sidebar'
import StatusModal from '../components/SuccessModal'
import { getMemberships, deleteMembership } from '../services/membershipService'
import { getAppConfig, updateAppConfig } from '../services/appConfigService'
import { SkeletonTable } from '../components/Skeleton'

function Avatar({ src, name, size = 'h-10 w-10' }) {
  if (src) {
    return <img src={src} alt={name} className={`${size} rounded-full object-cover border border-purple-500/30`} />
  }
  return (
    <div className={`${size} rounded-full bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-200 font-bold`}>
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  )
}

function Membership() {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selected, setSelected] = useState(null)

  const [modal, setModal] = useState({ open: false, type: 'success', message: '' })
  const notify = (type, message) => setModal({ open: true, type, message })

  // Global membership on/off switch (stored in app config)
  const [membershipEnabled, setMembershipEnabled] = useState(null)
  const [togglingStatus, setTogglingStatus] = useState(false)
  // { title, message, confirmLabel, danger, onConfirm } | null
  const [confirm, setConfirm] = useState(null)

  useEffect(() => {
    getAppConfig()
      .then((cfg) => setMembershipEnabled(cfg.membershipEnabled !== false))
      .catch(() => setMembershipEnabled(true))
  }, [])

  const toggleMembership = () => {
    const next = !membershipEnabled
    setConfirm({
      title: next ? 'Activate membership?' : 'Deactivate membership?',
      message: next
        ? 'Membership will be visible in the app and new signups will be accepted.'
        : 'Membership will be hidden in the app and new signups will be blocked.',
      confirmLabel: next ? 'Activate' : 'Deactivate',
      danger: !next,
      onConfirm: async () => {
        setConfirm(null)
        setTogglingStatus(true)
        try {
          const cfg = await updateAppConfig({ membershipEnabled: next })
          setMembershipEnabled(cfg.membershipEnabled !== false)
          notify('success', next ? 'Membership activated' : 'Membership deactivated')
        } catch (err) {
          notify('error', err?.response?.data?.message || 'Failed to update membership status')
        } finally {
          setTogglingStatus(false)
        }
      }
    })
  }

  const loadMembers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getMemberships({ page, limit: 20, search })
      setMembers(res?.data || [])
      setTotal(res?.pagination?.total || 0)
      setTotalPages(res?.pagination?.totalPages || 1)
    } catch (err) {
      notify('error', err?.response?.data?.message || 'Failed to load memberships')
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    // Debounced so typing in search doesn't fire a request per keystroke
    const timer = setTimeout(loadMembers, 300)
    return () => clearTimeout(timer)
  }, [loadMembers])

  const removeMember = (member) => {
    setConfirm({
      title: 'Delete membership?',
      message: `This will permanently remove ${member.name}'s membership and selfie. This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        setConfirm(null)
        try {
          await deleteMembership(member._id)
          notify('success', 'Membership deleted')
          setSelected(null)
          loadMembers()
        } catch (err) {
          notify('error', err?.response?.data?.message || 'Failed to delete membership')
        }
      }
    })
  }

  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : '—')

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white overflow-x-clip">
      <Sidebar />
      <div className="flex-1 min-w-0 ml-0 md:ml-56 pb-20 md:pb-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8 flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold">Membership</h1>
              <p className="text-gray-400 mt-1">Members who signed up from the app, with the details their card is printed from.</p>
            </div>
            {membershipEnabled !== null && (
              <div className="flex items-center gap-4 bg-gray-900/70 border border-purple-500/20 rounded-2xl px-5 py-3">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    {membershipEnabled && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>
                    )}
                    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${membershipEnabled ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                  </span>
                  <span className="text-sm font-medium">{membershipEnabled ? 'Active' : 'Inactive'}</span>
                </div>
                <button
                  onClick={toggleMembership}
                  disabled={togglingStatus}
                  role="switch"
                  aria-checked={membershipEnabled}
                  aria-label="Toggle membership"
                  className={`relative inline-flex h-7 w-[3.25rem] shrink-0 items-center rounded-full transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 disabled:opacity-50 ${
                    membershipEnabled ? 'bg-emerald-500' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-300 ${
                      membershipEnabled ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-row items-center justify-between gap-3 mb-4">
            <div className="shrink-0 bg-gray-900/70 border border-purple-500/20 rounded-2xl px-4 py-2.5 sm:px-5 sm:py-3 whitespace-nowrap">
              <span className="text-gray-400 text-xs sm:text-sm">Total</span>
              <span className="ml-2 sm:ml-3 text-lg sm:text-xl font-bold text-purple-300">{total}</span>
            </div>
            <input
              value={search}
              onChange={(e) => {
                setPage(1)
                setSearch(e.target.value)
              }}
              placeholder="Search name / phone / class / member no"
              className="bg-black/20 border border-purple-500/30 rounded-lg px-3 py-2.5 text-sm flex-1 min-w-0 md:flex-none md:w-80 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="bg-gray-900/70 border border-purple-500/20 rounded-2xl overflow-hidden">
            {loading ? (
              <div className="p-4 sm:p-6"><SkeletonTable rows={6} cols={5} /></div>
            ) : members.length === 0 ? (
              <p className="text-gray-400 p-6">No memberships found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-black/30 text-gray-400 text-left">
                    <tr>
                      <th className="px-2 py-3 sm:px-4">Photo</th>
                      <th className="px-2 py-3 sm:px-4">Name</th>
                      <th className="px-2 py-3 sm:px-4">Phone</th>
                      <th className="px-2 py-3 sm:px-4">Class</th>
                      <th className="px-2 py-3 sm:px-4">Member No</th>
                      <th className="px-2 py-3 sm:px-4">Joined</th>
                      <th className="px-2 py-3 sm:px-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => (
                      <tr key={member._id} className="border-t border-white/5 hover:bg-white/5">
                        <td className="px-2 py-3 sm:px-4">
                          <Avatar src={member.photo} name={member.name} />
                        </td>
                        <td className="px-2 py-3 sm:px-4 font-medium">{member.name}</td>
                        <td className="px-2 py-3 sm:px-4">{member.phone}</td>
                        <td className="px-2 py-3 sm:px-4">{member.className}</td>
                        <td className="px-2 py-3 sm:px-4 text-gray-400 text-xs">{member.membershipNo}</td>
                        <td className="px-2 py-3 sm:px-4">{fmtDate(member.createdAt)}</td>
                        <td className="px-2 py-3 sm:px-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => setSelected(member)}
                            className="border border-purple-500/40 hover:bg-purple-600/20 transition px-3 py-1.5 rounded-lg text-xs"
                          >
                            View
                          </button>
                          <button
                            onClick={() => removeMember(member)}
                            className="ml-2 border border-red-500/40 text-red-300 hover:bg-red-600/20 transition px-3 py-1.5 rounded-lg text-xs"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-4 py-2 rounded-lg border border-purple-500/30 disabled:opacity-40"
              >
                Prev
              </button>
              <span className="text-gray-400 text-sm">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-4 py-2 rounded-lg border border-purple-500/30 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Member detail - the data the printed card is built from */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="w-full max-w-md bg-gray-900 border border-purple-500/30 rounded-2xl p-4 sm:p-6">
            <div className="flex items-center gap-4">
              <Avatar src={selected.photo} name={selected.name} size="h-20 w-20" />
              <div>
                <h3 className="text-xl font-bold">{selected.name}</h3>
                <p className="text-gray-400 text-sm">{selected.membershipNo}</p>
              </div>
            </div>

            <dl className="mt-6 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-400">Phone</dt>
                <dd>{selected.phone}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">Class</dt>
                <dd>{selected.className}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">App user ID</dt>
                <dd className="text-gray-400 text-xs">{selected.userId}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">Joined</dt>
                <dd>{fmtDate(selected.createdAt)}</dd>
              </div>
            </dl>

            <button
              onClick={() => setSelected(null)}
              className="w-full mt-6 border border-gray-500/40 py-2 rounded-lg"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Modern confirmation modal (replaces native confirm) */}
      {confirm && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 px-4"
          onClick={() => setConfirm(null)}
        >
          <div
            className="w-full max-w-sm bg-gradient-to-b from-gray-900 to-gray-950 border border-purple-500/30 rounded-3xl p-6 shadow-2xl shadow-purple-900/40"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`mx-auto mb-4 h-12 w-12 rounded-2xl flex items-center justify-center ${
                confirm.danger ? 'bg-red-500/15 text-red-300' : 'bg-emerald-500/15 text-emerald-300'
              }`}
            >
              {confirm.danger ? (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            <h3 className="text-lg font-bold text-center">{confirm.title}</h3>
            <p className="text-gray-400 text-sm text-center mt-2 leading-relaxed">{confirm.message}</p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setConfirm(null)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-300 hover:bg-white/5 transition text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirm.onConfirm}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition shadow-lg ${
                  confirm.danger
                    ? 'bg-red-600 hover:bg-red-500 shadow-red-900/40'
                    : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/40'
                }`}
              >
                {confirm.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      <StatusModal
        isOpen={modal.open}
        onClose={() => setModal({ ...modal, open: false })}
        type={modal.type}
        message={modal.message}
      />
    </div>
  )
}

export default Membership
