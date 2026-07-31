import React, { useState, useEffect, useCallback } from 'react'
import Sidebar from '../components/Sidebar'
import StatusModal from '../components/SuccessModal'
import {
  getPlans,
  createPlan,
  updatePlan,
  deletePlan,
  getSubscriptions
} from '../services/subscriptionService'

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'paid', label: 'Paid' },
  { key: 'created', label: 'Pending' },
  { key: 'failed', label: 'Failed' }
]

const emptyPlan = { name: '', description: '', amount: '', durationDays: '', sortOrder: 0, isActive: true }

function StatusBadge({ status, isActive }) {
  const label = status === 'paid' ? (isActive ? 'Active' : 'Expired') : status
  const cls =
    status === 'paid'
      ? isActive
        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-400/40'
        : 'bg-gray-500/10 text-gray-300 border-gray-400/40'
      : status === 'failed'
        ? 'bg-red-500/10 text-red-300 border-red-400/40'
        : 'bg-yellow-500/10 text-yellow-300 border-yellow-400/40'
  return <span className={`px-2.5 py-1 rounded-full text-xs border capitalize ${cls}`}>{label}</span>
}

function Subscriptions() {
  // Plans
  const [plans, setPlans] = useState([])
  const [plansLoading, setPlansLoading] = useState(true)
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [editingPlan, setEditingPlan] = useState(null)
  const [planForm, setPlanForm] = useState(emptyPlan)
  const [savingPlan, setSavingPlan] = useState(false)

  // Subscriptions
  const [subscriptions, setSubscriptions] = useState([])
  const [subsLoading, setSubsLoading] = useState(true)
  const [summary, setSummary] = useState({ created: 0, paid: 0, failed: 0 })
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const [modal, setModal] = useState({ open: false, type: 'success', message: '' })
  const notify = (type, message) => setModal({ open: true, type, message })

  const loadPlans = useCallback(async () => {
    setPlansLoading(true)
    try {
      const res = await getPlans()
      setPlans(res?.data || [])
    } catch (err) {
      notify('error', err?.response?.data?.message || 'Failed to load plans')
    } finally {
      setPlansLoading(false)
    }
  }, [])

  const loadSubscriptions = useCallback(async () => {
    setSubsLoading(true)
    try {
      const res = await getSubscriptions({ page, limit: 20, status, search })
      setSubscriptions(res?.data || [])
      setTotalPages(res?.meta?.totalPages || 1)
      setSummary(res?.summary || { created: 0, paid: 0, failed: 0 })
    } catch (err) {
      notify('error', err?.response?.data?.message || 'Failed to load subscriptions')
    } finally {
      setSubsLoading(false)
    }
  }, [page, status, search])

  useEffect(() => {
    loadPlans()
  }, [loadPlans])

  useEffect(() => {
    loadSubscriptions()
  }, [loadSubscriptions])

  const openCreatePlan = () => {
    setEditingPlan(null)
    setPlanForm(emptyPlan)
    setShowPlanModal(true)
  }

  const openEditPlan = (plan) => {
    setEditingPlan(plan)
    setPlanForm({
      name: plan.name || '',
      description: plan.description || '',
      amount: plan.amount ?? '',
      durationDays: plan.durationDays ?? '',
      sortOrder: plan.sortOrder ?? 0,
      isActive: plan.isActive ?? true
    })
    setShowPlanModal(true)
  }

  const savePlan = async (e) => {
    e.preventDefault()
    if (!planForm.name || !planForm.amount || !planForm.durationDays) {
      notify('error', 'Name, amount and duration are required')
      return
    }
    setSavingPlan(true)
    try {
      const payload = {
        name: planForm.name,
        description: planForm.description,
        amount: Number(planForm.amount),
        durationDays: Number(planForm.durationDays),
        sortOrder: Number(planForm.sortOrder) || 0,
        isActive: planForm.isActive
      }
      if (editingPlan) {
        await updatePlan(editingPlan._id, payload)
        notify('success', 'Plan updated')
      } else {
        await createPlan(payload)
        notify('success', 'Plan created')
      }
      setShowPlanModal(false)
      loadPlans()
    } catch (err) {
      notify('error', err?.response?.data?.message || 'Failed to save plan')
    } finally {
      setSavingPlan(false)
    }
  }

  const removePlan = async (plan) => {
    if (!window.confirm(`Delete plan "${plan.name}"?`)) return
    try {
      await deletePlan(plan._id)
      notify('success', 'Plan deleted')
      loadPlans()
    } catch (err) {
      notify('error', err?.response?.data?.message || 'Failed to delete plan')
    }
  }

  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : '—')
  const fmtRupees = (paise) => `₹${((paise || 0) / 100).toLocaleString('en-IN')}`

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white">
      <Sidebar />
      <div className="flex-1 ml-64">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold">Subscriptions</h1>
            <p className="text-gray-400 mt-1">Manage subscription plans and view user subscriptions.</p>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-gray-900/70 border border-emerald-500/20 rounded-2xl p-5">
              <p className="text-gray-400 text-sm">Paid</p>
              <p className="text-2xl font-bold text-emerald-300">{summary.paid || 0}</p>
            </div>
            <div className="bg-gray-900/70 border border-yellow-500/20 rounded-2xl p-5">
              <p className="text-gray-400 text-sm">Pending</p>
              <p className="text-2xl font-bold text-yellow-300">{summary.created || 0}</p>
            </div>
            <div className="bg-gray-900/70 border border-red-500/20 rounded-2xl p-5">
              <p className="text-gray-400 text-sm">Failed</p>
              <p className="text-2xl font-bold text-red-300">{summary.failed || 0}</p>
            </div>
          </div>

          {/* Plans */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Plans</h2>
            <button
              onClick={openCreatePlan}
              className="bg-purple-600 hover:bg-purple-700 transition px-4 py-2 rounded-xl text-sm font-semibold"
            >
              + Add Plan
            </button>
          </div>

          {plansLoading ? (
            <p className="text-gray-400 mb-10">Loading plans...</p>
          ) : plans.length === 0 ? (
            <p className="text-gray-400 mb-10">No plans yet. Add one to get started.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
              {plans.map((plan) => (
                <div key={plan._id} className="bg-gray-900/70 border border-purple-500/20 rounded-2xl p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-bold">{plan.name}</h3>
                      <p className="text-gray-400 text-sm">{plan.description || '—'}</p>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full border ${
                        plan.isActive
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-400/40'
                          : 'bg-gray-500/10 text-gray-300 border-gray-400/40'
                      }`}
                    >
                      {plan.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-2xl font-extrabold mt-4">
                    ₹{plan.amount}
                    <span className="text-sm font-normal text-gray-400"> / {plan.durationDays} days</span>
                  </p>
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => openEditPlan(plan)}
                      className="flex-1 border border-purple-500/40 hover:bg-purple-600/20 transition py-2 rounded-lg text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => removePlan(plan)}
                      className="flex-1 border border-red-500/40 text-red-300 hover:bg-red-600/20 transition py-2 rounded-lg text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Subscriptions list */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
            <h2 className="text-xl font-bold">User Subscriptions</h2>
            <div className="flex gap-2 flex-wrap">
              <input
                value={search}
                onChange={(e) => {
                  setPage(1)
                  setSearch(e.target.value)
                }}
                placeholder="Search plan / order / payment"
                className="bg-black/20 border border-purple-500/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => {
                    setPage(1)
                    setStatus(tab.key)
                  }}
                  className={`px-3 py-2 rounded-lg text-sm border transition ${
                    status === tab.key
                      ? 'bg-purple-600 border-purple-500'
                      : 'bg-black/20 border-purple-500/30 hover:border-purple-400'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-gray-900/70 border border-purple-500/20 rounded-2xl overflow-hidden">
            {subsLoading ? (
              <p className="text-gray-400 p-6">Loading subscriptions...</p>
            ) : subscriptions.length === 0 ? (
              <p className="text-gray-400 p-6">No subscriptions found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-black/30 text-gray-400 text-left">
                    <tr>
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">Plan</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Start</th>
                      <th className="px-4 py-3">End</th>
                      <th className="px-4 py-3">Order ID</th>
                      <th className="px-4 py-3">Payment ID</th>
                      <th className="px-4 py-3">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptions.map((sub) => (
                      <tr key={sub._id} className="border-t border-white/5 hover:bg-white/5">
                        <td className="px-4 py-3">
                          <div className="font-medium">{sub.user?.name || '—'}</div>
                          <div className="text-gray-400 text-xs">{sub.user?.email || ''}</div>
                        </td>
                        <td className="px-4 py-3">{sub.planName || '—'}</td>
                        <td className="px-4 py-3">{fmtRupees(sub.amount)}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={sub.status} isActive={sub.isActive} />
                        </td>
                        <td className="px-4 py-3">{fmtDate(sub.startDate)}</td>
                        <td className="px-4 py-3">{fmtDate(sub.endDate)}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{sub.orderId}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{sub.paymentId || '—'}</td>
                        <td className="px-4 py-3">{fmtDate(sub.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination */}
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

      {/* Plan create/edit modal */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <form
            onSubmit={savePlan}
            className="w-full max-w-md bg-gray-900 border border-purple-500/30 rounded-2xl p-6 space-y-4"
          >
            <h3 className="text-xl font-bold">{editingPlan ? 'Edit Plan' : 'Add Plan'}</h3>

            <div>
              <label className="block text-sm text-gray-300 mb-1">Name</label>
              <input
                value={planForm.name}
                onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                className="w-full bg-black/20 border border-purple-500/30 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="e.g. Monthly"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Description</label>
              <input
                value={planForm.description}
                onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                className="w-full bg-black/20 border border-purple-500/30 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Short description"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Amount (₹)</label>
                <input
                  type="number"
                  min="1"
                  value={planForm.amount}
                  onChange={(e) => setPlanForm({ ...planForm, amount: e.target.value })}
                  className="w-full bg-black/20 border border-purple-500/30 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Duration (days)</label>
                <input
                  type="number"
                  min="1"
                  value={planForm.durationDays}
                  onChange={(e) => setPlanForm({ ...planForm, durationDays: e.target.value })}
                  className="w-full bg-black/20 border border-purple-500/30 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Sort order</label>
                <input
                  type="number"
                  value={planForm.sortOrder}
                  onChange={(e) => setPlanForm({ ...planForm, sortOrder: e.target.value })}
                  className="w-full bg-black/20 border border-purple-500/30 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <label className="flex items-center gap-2 pb-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={planForm.isActive}
                  onChange={(e) => setPlanForm({ ...planForm, isActive: e.target.checked })}
                />
                Active
              </label>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowPlanModal(false)}
                className="flex-1 border border-gray-500/40 py-2 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingPlan}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 py-2 rounded-lg font-semibold"
              >
                {savingPlan ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
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

export default Subscriptions
