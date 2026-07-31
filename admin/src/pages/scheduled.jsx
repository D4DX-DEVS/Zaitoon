import React, { useState, useEffect, useCallback } from 'react'
import Sidebar from '../components/Sidebar'
import SuccessModal from '../components/SuccessModal'
import {
  FiClock,
  FiTrash2,
  FiEdit3,
  FiX,
  FiCheckCircle,
  FiAlertCircle,
  FiRefreshCw,
  FiCalendar
} from 'react-icons/fi'
import gradient from '../assets/gradiantRight.png'

const API_BASE = import.meta.env.VITE_API_BASE_URL

const CONTENT_TYPE_LABELS = {
  'story': 'Story',
  'single-story': 'Single Story',
  'video': 'Video',
  'banner': 'Banner',
  'payment-banner': 'Payment Banner',
  'bright-box': 'Bright Box',
  'bright-box-story': 'Bright Box Story',
  'puzzle': 'Puzzle',
  'kids-submission': 'Kids Submission',
  'quiz': 'Quiz',
  'question': 'Question',
  'notification': 'Notification'
}

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   color: 'text-yellow-400',  bg: 'bg-yellow-500/10 border-yellow-500/30', icon: FiClock },
  published: { label: 'Published', color: 'text-green-400',   bg: 'bg-green-500/10 border-green-500/30',   icon: FiCheckCircle },
  failed:    { label: 'Failed',    color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/30',       icon: FiAlertCircle }
}

export default function Scheduled() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')
  const [modal, setModal] = useState({ isOpen: false, type: 'success', message: '', onConfirm: null })

  // Edit reschedule state
  const [editingItem, setEditingItem] = useState(null)
  const [newPublishAt, setNewPublishAt] = useState('')

  const showModal = (type, message, onConfirm = null) => {
    setModal({ isOpen: true, type, message, onConfirm })
  }
  const closeModal = () => {
    setModal({ isOpen: false, type: 'success', message: '', onConfirm: null })
  }

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const query = filterStatus !== 'all' ? `?status=${filterStatus}` : ''
      const res = await fetch(`${API_BASE}/schedule${query}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
      })
      const data = await res.json()
      if (data.success) setItems(data.data.items)
      else showModal('error', 'Failed to load scheduled content')
    } catch {
      showModal('error', 'Error loading scheduled content')
    } finally {
      setLoading(false)
    }
  }, [filterStatus])

  useEffect(() => { fetchItems() }, [fetchItems])

  const handleDelete = (item) => {
    showModal('confirm', `Cancel scheduled upload of "${item.title}"?`, async () => {
      try {
        const res = await fetch(`${API_BASE}/schedule/${item._id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
        })
        const data = await res.json()
        if (data.success) {
          showModal('success', 'Scheduled upload cancelled.')
          fetchItems()
        } else {
          showModal('error', data.message || 'Failed to cancel')
        }
      } catch {
        showModal('error', 'Error cancelling scheduled upload')
      }
    })
  }

  const openReschedule = (item) => {
    setEditingItem(item)
    // Pre-fill with current publishAt
    const d = new Date(item.publishAt)
    setNewPublishAt(d.toISOString().slice(0, 16))
  }

  const handleReschedule = async (e) => {
    e.preventDefault()
    if (!newPublishAt) return
    try {
      const res = await fetch(`${API_BASE}/schedule/${editingItem._id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify({ publishAt: newPublishAt })
      })
      const data = await res.json()
      if (data.success) {
        showModal('success', 'Rescheduled successfully!')
        setEditingItem(null)
        fetchItems()
      } else {
        showModal('error', data.message || 'Failed to reschedule')
      }
    } catch {
      showModal('error', 'Error rescheduling')
    }
  }

  const nowMin = () => {
    const d = new Date(Date.now() + 60_000)
    d.setSeconds(0, 0)
    return d.toISOString().slice(0, 16)
  }

  const groupedByStatus = { pending: [], published: [], failed: [] }
  items.forEach(item => {
    if (groupedByStatus[item.status]) groupedByStatus[item.status].push(item)
  })

  const displayItems = filterStatus === 'all' ? items : (groupedByStatus[filterStatus] || [])

  return (
    <div className="min-h-screen bg-black flex">
      <Sidebar />
      <div className="flex-1 ml-64">
        {/* Right gradient decoration */}
        <img src={gradient} alt="" className="fixed right-0 top-0 h-full object-cover opacity-30 pointer-events-none select-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1
                className="text-white text-4xl font-bold mb-1 relative"
                style={{ fontFamily: 'Archivo Black' }}
              >
                Scheduled Uploads
                <div
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-0.5 w-40"
                  style={{ background: 'linear-gradient(90.05deg, #AC28DC 6.68%, #7E1EB7 49.26%, #501392 91.85%)' }}
                />
              </h1>
              <p className="text-gray-400 text-sm mt-3">Content scheduled for future publishing</p>
            </div>
            <button
              onClick={fetchItems}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition"
            >
              <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
              const Icon = cfg.icon
              return (
                <div
                  key={key}
                  onClick={() => setFilterStatus(filterStatus === key ? 'all' : key)}
                  className={`cursor-pointer rounded-xl border p-4 flex items-center gap-3 transition-all ${cfg.bg} ${filterStatus === key ? 'ring-2 ring-purple-500' : ''}`}
                >
                  <Icon className={`w-5 h-5 ${cfg.color}`} />
                  <div>
                    <p className={`font-semibold ${cfg.color}`}>{groupedByStatus[key].length}</p>
                    <p className="text-gray-400 text-xs">{cfg.label}</p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 mb-6">
            {['all', 'pending', 'published', 'failed'].map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-4 py-1.5 rounded-full text-sm capitalize transition ${
                  filterStatus === s
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {s === 'all' ? `All (${items.length})` : `${STATUS_CONFIG[s].label} (${groupedByStatus[s].length})`}
              </button>
            ))}
          </div>

          {/* Content list */}
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
            </div>
          ) : displayItems.length === 0 ? (
            <div className="text-center py-20">
              <FiClock className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No {filterStatus !== 'all' ? filterStatus : ''} scheduled uploads</p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayItems.map(item => {
                const cfg = STATUS_CONFIG[item.status]
                const StatusIcon = cfg.icon
                const isPast = item.status === 'pending' && new Date(item.publishAt) < new Date()

                return (
                  <div
                    key={item._id}
                    className="bg-gray-900/60 border border-gray-700/50 rounded-xl p-4 flex items-center gap-4"
                  >
                    {/* Thumbnail */}
                    <div className="w-14 h-14 rounded-lg bg-gray-800 overflow-hidden shrink-0">
                      {item.thumbnailUrl ? (
                        <img src={item.thumbnailUrl} alt={item.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <FiCalendar className="w-6 h-6 text-gray-600" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-white font-medium truncate">{item.title}</h3>
                        <span className="px-2 py-0.5 rounded-full text-xs bg-gray-700 text-gray-300">
                          {CONTENT_TYPE_LABELS[item.contentType] || item.contentType}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className={`flex items-center gap-1 text-xs ${cfg.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {cfg.label}
                          {isPast && item.status === 'pending' && ' (processing…)'}
                        </span>
                        <span className="text-gray-500 text-xs flex items-center gap-1">
                          <FiClock className="w-3 h-3" />
                          {new Date(item.publishAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                        {item.status === 'published' && item.publishedId && (
                          <span className="text-gray-500 text-xs">ID: {item.publishedId}</span>
                        )}
                      </div>

                      {item.status === 'failed' && item.errorMessage && (
                        <p className="text-red-400 text-xs mt-1 truncate">{item.errorMessage}</p>
                      )}
                    </div>

                    {/* Actions (only for pending items) */}
                    {item.status === 'pending' && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => openReschedule(item)}
                          className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition"
                          title="Reschedule"
                        >
                          <FiEdit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          className="p-2 rounded-lg bg-gray-800 hover:bg-red-900/50 text-gray-400 hover:text-red-400 transition"
                          title="Cancel"
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Reschedule Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-white text-lg font-bold">Reschedule Upload</h2>
              <button onClick={() => setEditingItem(null)} className="text-gray-400 hover:text-white">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-400 text-sm mb-4">"{editingItem.title}"</p>
            <form onSubmit={handleReschedule}>
              <label className="block text-sm text-gray-400 mb-1">New date & time</label>
              <input
                type="datetime-local"
                value={newPublishAt}
                min={nowMin()}
                onChange={e => setNewPublishAt(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-white text-sm focus:border-purple-500 focus:outline-none"
              />
              <div className="flex gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="flex-1 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 text-sm transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-lg text-white text-sm transition"
                  style={{ background: 'linear-gradient(90.05deg, #AC28DC 6.68%, #7E1EB7 49.26%, #501392 91.85%)' }}
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <SuccessModal
        isOpen={modal.isOpen}
        type={modal.type}
        message={modal.message}
        onClose={closeModal}
        onConfirm={modal.onConfirm}
      />
    </div>
  )
}
