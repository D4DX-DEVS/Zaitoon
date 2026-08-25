import React, { useState, useEffect, useCallback } from 'react'
import Sidebar from '../components/Sidebar'
import StatusModal from '../components/SuccessModal'
import { getMemberships, deleteMembership } from '../services/membershipService'
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

  const removeMember = async (member) => {
    if (!window.confirm(`Delete membership of "${member.name}"?`)) return
    try {
      await deleteMembership(member._id)
      notify('success', 'Membership deleted')
      setSelected(null)
      loadMembers()
    } catch (err) {
      notify('error', err?.response?.data?.message || 'Failed to delete membership')
    }
  }

  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : '—')

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white overflow-x-clip">
      <Sidebar />
      <div className="flex-1 min-w-0 ml-0 md:ml-56 pb-20 md:pb-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold">Membership</h1>
            <p className="text-gray-400 mt-1">Members who signed up from the app, with the details their card is printed from.</p>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
            <div className="bg-gray-900/70 border border-purple-500/20 rounded-2xl px-5 py-3">
              <span className="text-gray-400 text-sm">Total members</span>
              <span className="ml-3 text-xl font-bold text-purple-300">{total}</span>
            </div>
            <input
              value={search}
              onChange={(e) => {
                setPage(1)
                setSearch(e.target.value)
              }}
              placeholder="Search name / phone / class / member no"
              className="bg-black/20 border border-purple-500/30 rounded-lg px-3 py-2 text-sm w-full md:w-80 focus:outline-none focus:ring-2 focus:ring-purple-500"
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
