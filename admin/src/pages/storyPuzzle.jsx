import React, { useState, useEffect, useCallback } from 'react'
import {
  FiPlus, FiTrash2, FiEdit3, FiX, FiCheckCircle, FiAlertCircle,
  FiArrowUp, FiArrowDown, FiStar, FiClock, FiRefreshCw, FiSearch,
  FiChevronLeft, FiChevronRight
} from 'react-icons/fi'
import { BookOpenIcon, TrophyIcon } from '@heroicons/react/24/outline'
import Sidebar from '../components/Sidebar'
import SuccessModal from '../components/SuccessModal'
import gradient from '../assets/gradiantRight.png'

const ITEMS_PER_PAGE = 10
const DIFFICULTIES = ['easy', 'medium', 'hard']
const DIFFICULTY_COLORS = { easy: 'text-green-400', medium: 'text-yellow-400', hard: 'text-red-400' }
const DIFFICULTY_BG = { easy: 'bg-green-500/20 text-green-400', medium: 'bg-yellow-500/20 text-yellow-400', hard: 'bg-red-500/20 text-red-400' }

const emptyEvent = (order) => ({ order, text: '', textMl: '' })
const emptyForm = () => ({
  prophetName: '',
  prophetNameMl: '',
  icon: '🌟',
  difficulty: 'easy',
  description: '',
  descriptionMl: '',
  moral: '',
  moralMl: '',
  color: 'from-purple-400 to-purple-600',
  isActive: true,
  events: [emptyEvent(1), emptyEvent(2), emptyEvent(3)],
})

function Toast({ toast, onClose }) {
  if (!toast) return null
  return (
    <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border ${
      toast.type === 'success' ? 'bg-green-900/80 border-green-500/40 text-green-300' : 'bg-red-900/80 border-red-500/40 text-red-300'
    }`}>
      {toast.type === 'success' ? <FiCheckCircle size={18} /> : <FiAlertCircle size={18} />}
      <span className="text-sm font-medium">{toast.message}</span>
      <button onClick={onClose} className="ml-2 hover:opacity-70"><FiX size={16} /></button>
    </div>
  )
}

// ─── Event Row ───────────────────────────────────────────────────────────────
function EventRow({ event, index, total, onChange, onMove, onDelete }) {
  return (
    <div className="flex gap-2 items-start bg-gray-800/60 rounded-lg p-3 border border-gray-700">
      <div className="flex flex-col gap-1 mt-1">
        <button type="button" onClick={() => onMove(index, -1)} disabled={index === 0}
          className="text-gray-500 hover:text-purple-400 disabled:opacity-30">
          <FiArrowUp size={14} />
        </button>
        <span className="text-center text-xs text-gray-500 font-mono w-4">{event.order}</span>
        <button type="button" onClick={() => onMove(index, 1)} disabled={index === total - 1}
          className="text-gray-500 hover:text-purple-400 disabled:opacity-30">
          <FiArrowDown size={14} />
        </button>
      </div>
      <div className="flex-1 flex flex-col gap-2">
        <input
          type="text"
          placeholder="Event text (English) *"
          value={event.text}
          onChange={e => onChange(index, 'text', e.target.value)}
          className="w-full bg-gray-900 text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:border-purple-500 outline-none"
        />
        <input
          type="text"
          placeholder="Event text (Malayalam) - optional"
          value={event.textMl}
          onChange={e => onChange(index, 'textMl', e.target.value)}
          className="w-full bg-gray-900 text-gray-300 text-sm rounded-lg px-3 py-2 border border-gray-700 focus:border-purple-500 outline-none"
          dir="auto"
        />
      </div>
      <button type="button" onClick={() => onDelete(index)}
        className="text-gray-500 hover:text-red-400 mt-1 flex-shrink-0">
        <FiX size={16} />
      </button>
    </div>
  )
}

// ─── Puzzle Form Modal ────────────────────────────────────────────────────────
function PuzzleFormModal({ puzzle, onClose, onSaved }) {
  const [form, setForm] = useState(puzzle ? { ...puzzle, events: puzzle.events.map(e => ({ ...e })) } : emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const API_BASE = import.meta.env.VITE_API_BASE_URL

  const setField = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const updateEvent = (idx, key, val) =>
    setForm(f => ({ ...f, events: f.events.map((e, i) => i === idx ? { ...e, [key]: val } : e) }))

  const addEvent = () =>
    setForm(f => ({ ...f, events: [...f.events, emptyEvent(f.events.length + 1)] }))

  const deleteEvent = (idx) =>
    setForm(f => {
      const evts = f.events.filter((_, i) => i !== idx).map((e, i) => ({ ...e, order: i + 1 }))
      return { ...f, events: evts }
    })

  const moveEvent = (idx, dir) =>
    setForm(f => {
      const evts = [...f.events]
      const target = idx + dir
      if (target < 0 || target >= evts.length) return f
      ;[evts[idx], evts[target]] = [evts[target], evts[idx]]
      evts.forEach((e, i) => { e.order = i + 1 })
      return { ...f, events: evts }
    })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.prophetName.trim()) { setError('Prophet name is required'); return }
    if (form.events.length < 2) { setError('At least 2 events are required'); return }
    if (form.events.some(ev => !ev.text.trim())) { setError('All event texts are required'); return }

    setSaving(true)
    try {
      const token = localStorage.getItem('adminToken')
      const url = puzzle
        ? `${API_BASE}/story-puzzles/${puzzle._id}`
        : `${API_BASE}/story-puzzles`
      const method = puzzle ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...form,
          isActive: Boolean(form.isActive),
        }),
      })
      const data = await res.json()
      if (data.success) {
        onSaved(data.data, !!puzzle)
        onClose()
      } else {
        setError(data.message || 'Failed to save puzzle')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto p-4">
      <div className="bg-gray-900 border border-purple-500/30 rounded-2xl w-full max-w-2xl my-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-white font-bold text-lg">
            {puzzle ? '✏️ Edit Puzzle' : '➕ New Story Puzzle'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><FiX size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Prophet details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Prophet Name (EN) *</label>
              <input value={form.prophetName} onChange={e => setField('prophetName', e.target.value)}
                placeholder="e.g. Nuh, Ibrahim, Musa..."
                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:border-purple-500 outline-none text-sm" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Prophet Name (ML)</label>
              <input value={form.prophetNameMl} onChange={e => setField('prophetNameMl', e.target.value)}
                placeholder="nabi name malayalam"
                className="w-full bg-gray-800 text-gray-300 rounded-lg px-3 py-2 border border-gray-700 focus:border-purple-500 outline-none text-sm"
                dir="auto" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Icon (Emoji)</label>
              <input value={form.icon} onChange={e => setField('icon', e.target.value)}
                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:border-purple-500 outline-none text-sm text-center text-lg" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Difficulty</label>
              <select value={form.difficulty} onChange={e => setField('difficulty', e.target.value)}
                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:border-purple-500 outline-none text-sm">
                {DIFFICULTIES.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Status</label>
              <select value={form.isActive ? 'true' : 'false'} onChange={e => setField('isActive', e.target.value === 'true')}
                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:border-purple-500 outline-none text-sm">
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Description (EN)</label>
              <textarea value={form.description} onChange={e => setField('description', e.target.value)}
                rows={2} placeholder="Short description..."
                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:border-purple-500 outline-none text-sm resize-none" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Description (ML)</label>
              <textarea value={form.descriptionMl} onChange={e => setField('descriptionMl', e.target.value)}
                rows={2} placeholder="Malayalam description..."
                className="w-full bg-gray-800 text-gray-300 rounded-lg px-3 py-2 border border-gray-700 focus:border-purple-500 outline-none text-sm resize-none"
                dir="auto" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Moral (EN)</label>
              <textarea value={form.moral} onChange={e => setField('moral', e.target.value)}
                rows={2} placeholder="Lesson / moral of the story..."
                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:border-purple-500 outline-none text-sm resize-none" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Moral (ML)</label>
              <textarea value={form.moralMl} onChange={e => setField('moralMl', e.target.value)}
                rows={2} placeholder="Malayalam moral..."
                className="w-full bg-gray-800 text-gray-300 rounded-lg px-3 py-2 border border-gray-700 focus:border-purple-500 outline-none text-sm resize-none"
                dir="auto" />
            </div>
          </div>

          <div>
            <label className="text-gray-400 text-xs mb-1 block">Card Color (Tailwind gradient classes)</label>
            <input value={form.color} onChange={e => setField('color', e.target.value)}
              placeholder="e.g. from-purple-400 to-purple-600"
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:border-purple-500 outline-none text-sm" />
          </div>

          {/* Events */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-gray-300 text-sm font-semibold">
                Story Events <span className="text-red-400">*</span>
                <span className="text-gray-500 text-xs font-normal ml-2">({form.events.length} events — order matters)</span>
              </label>
              <button type="button" onClick={addEvent}
                className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 bg-purple-500/10 px-3 py-1 rounded-lg border border-purple-500/30">
                <FiPlus size={12} /> Add Event
              </button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {form.events.map((evt, idx) => (
                <EventRow key={idx} event={evt} index={idx} total={form.events.length}
                  onChange={updateEvent} onMove={moveEvent} onDelete={deleteEvent} />
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-2 text-sm">
              <FiAlertCircle size={16} /> {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-5 py-2 rounded-xl text-gray-400 border border-gray-700 hover:bg-gray-800 text-sm">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-6 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-purple-800 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
              {saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {puzzle ? 'Update Puzzle' : 'Create Puzzle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── View Puzzle Modal ────────────────────────────────────────────────────────
function ViewPuzzleModal({ puzzle, onClose, onEdit }) {
  if (!puzzle) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-purple-500/30 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{puzzle.icon}</span>
            <div>
              <h2 className="text-white font-bold">Prophet {puzzle.prophetName}</h2>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${DIFFICULTY_BG[puzzle.difficulty]}`}>
                {puzzle.difficulty}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><FiX size={20} /></button>
        </div>
        <div className="px-6 py-4 space-y-4">
          {puzzle.description && (
            <p className="text-gray-400 text-sm">{puzzle.description}</p>
          )}
          <div>
            <h4 className="text-gray-300 text-sm font-semibold mb-2">📖 Story Events ({puzzle.events?.length})</h4>
            <div className="space-y-2">
              {(puzzle.events || []).sort((a, b) => a.order - b.order).map((ev, i) => (
                <div key={i} className="flex gap-3 bg-gray-800/50 rounded-lg p-3">
                  <span className="text-purple-400 font-mono text-sm w-5 flex-shrink-0">{ev.order}.</span>
                  <div>
                    <p className="text-white text-sm">{ev.text}</p>
                    {ev.textMl && <p className="text-gray-400 text-xs mt-1" dir="auto">{ev.textMl}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {puzzle.moral && (
            <div className="bg-purple-900/20 border border-purple-500/20 rounded-lg p-3">
              <p className="text-purple-300 text-xs font-semibold mb-1">💡 Moral</p>
              <p className="text-gray-300 text-sm">{puzzle.moral}</p>
            </div>
          )}
        </div>
        <div className="px-6 pb-4 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-gray-400 border border-gray-700 rounded-xl text-sm hover:bg-gray-800">
            Close
          </button>
          <button onClick={() => { onClose(); onEdit(puzzle) }}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl text-sm hover:bg-purple-700">
            <FiEdit3 size={14} /> Edit
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Puzzles Tab ─────────────────────────────────────────────────────────────
function PuzzlesTab() {
  const [puzzles, setPuzzles] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingPuzzle, setEditingPuzzle] = useState(null)
  const [viewPuzzle, setViewPuzzle] = useState(null)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState({ isOpen: false, type: 'success', message: '', onConfirm: null })
  const [toast, setToast] = useState(null)
  const API_BASE = import.meta.env.VITE_API_BASE_URL

  const showToast = (type, message) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 3500)
  }

  const showModal = (type, message, onConfirm = null) =>
    setModal({ isOpen: true, type, message, onConfirm })
  const closeModal = () =>
    setModal({ isOpen: false, type: 'success', message: '', onConfirm: null })

  const fetchPuzzles = useCallback(async () => {
    setLoading(true)
    try {
      const url = filter === 'all'
        ? `${API_BASE}/story-puzzles?active=all`
        : `${API_BASE}/story-puzzles?difficulty=${filter}&active=all`
      const res = await fetch(url)
      const data = await res.json()
      if (data.success) {
        const raw = data.data
        setPuzzles(Array.isArray(raw) ? raw : raw.puzzles || [])
      } else {
        showToast('error', data.message || 'Failed to load puzzles')
      }
    } catch {
      showToast('error', 'Network error loading puzzles')
    } finally {
      setLoading(false)
    }
  }, [API_BASE, filter])

  useEffect(() => { fetchPuzzles() }, [fetchPuzzles])

  const handleDelete = (puzzle) => {
    showModal('confirmation', `Delete "${puzzle.prophetName}" puzzle? This cannot be undone.`, async () => {
      closeModal()
      try {
        const token = localStorage.getItem('adminToken')
        const res = await fetch(`${API_BASE}/story-puzzles/${puzzle._id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        if (data.success) {
          setPuzzles(prev => prev.filter(p => p._id !== puzzle._id))
          showToast('success', 'Puzzle deleted successfully')
        } else {
          showToast('error', data.message || 'Failed to delete')
        }
      } catch {
        showToast('error', 'Network error deleting puzzle')
      }
    })
  }

  const handleSaved = (saved, isEdit) => {
    if (isEdit) {
      setPuzzles(prev => prev.map(p => p._id === saved._id ? saved : p))
    } else {
      setPuzzles(prev => [saved, ...prev])
    }
    showToast('success', isEdit ? 'Puzzle updated!' : 'Puzzle created!')
  }

  const filtered = puzzles.filter(p => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return p.prophetName?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const paged = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

  return (
    <div>
      <Toast toast={toast} onClose={() => setToast(null)} />
      {(showForm || editingPuzzle) && (
        <PuzzleFormModal
          puzzle={editingPuzzle}
          onClose={() => { setShowForm(false); setEditingPuzzle(null) }}
          onSaved={handleSaved}
        />
      )}
      {viewPuzzle && (
        <ViewPuzzleModal
          puzzle={viewPuzzle}
          onClose={() => setViewPuzzle(null)}
          onEdit={(p) => setEditingPuzzle(p)}
        />
      )}
      <SuccessModal
        isOpen={modal.isOpen}
        type={modal.type}
        message={modal.message}
        onClose={closeModal}
        onConfirm={modal.onConfirm}
      />

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search by prophet name..."
            className="w-full bg-gray-800/60 text-white pl-9 pr-4 py-2.5 rounded-xl border border-gray-700 focus:border-purple-500 outline-none text-sm" />
        </div>
        {/* Difficulty filter */}
        <div className="flex gap-2">
          {['all', ...DIFFICULTIES].map(d => (
            <button key={d} onClick={() => { setFilter(d); setPage(1) }}
              className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                filter === d
                  ? 'bg-purple-600 border-purple-500 text-white'
                  : 'bg-gray-800/60 border-gray-700 text-gray-400 hover:border-purple-500/50'
              }`}>
              {d === 'all' ? 'All' : d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>
        <button onClick={fetchPuzzles} className="p-2.5 bg-gray-800/60 border border-gray-700 rounded-xl text-gray-400 hover:text-white">
          <FiRefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
        <button onClick={() => { setEditingPuzzle(null); setShowForm(true) }}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-purple-800 text-white rounded-xl text-sm font-semibold hover:opacity-90">
          <FiPlus size={16} /> New Puzzle
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {DIFFICULTIES.map(d => {
          const cnt = puzzles.filter(p => p.difficulty === d).length
          return (
            <div key={d} className="bg-gray-800/40 border border-gray-700 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs">{d.charAt(0).toUpperCase() + d.slice(1)}</p>
                <p className={`text-2xl font-bold ${DIFFICULTY_COLORS[d]}`}>{cnt}</p>
              </div>
              <span className="text-2xl">{d === 'easy' ? '🌱' : d === 'medium' ? '🍀' : '🔥'}</span>
            </div>
          )
        })}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500" />
        </div>
      ) : paged.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <BookOpenIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No puzzles found</p>
          <button onClick={() => { setEditingPuzzle(null); setShowForm(true) }}
            className="mt-4 text-purple-400 text-sm hover:underline">Create the first puzzle →</button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-800/80 text-gray-400 text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Prophet</th>
                <th className="px-4 py-3 text-left">Difficulty</th>
                <th className="px-4 py-3 text-center">Events</th>
                <th className="px-4 py-3 text-left">Description</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {paged.map(puzzle => (
                <tr key={puzzle._id} className="hover:bg-gray-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{puzzle.icon}</span>
                      <div>
                        <p className="text-white font-medium">Prophet {puzzle.prophetName}</p>
                        {puzzle.prophetNameMl && <p className="text-gray-500 text-xs" dir="auto">{puzzle.prophetNameMl}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${DIFFICULTY_BG[puzzle.difficulty] || 'bg-gray-700 text-gray-300'}`}>
                      {puzzle.difficulty}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-purple-400 font-semibold">{puzzle.events?.length ?? 0}</span>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="text-gray-400 truncate">{puzzle.description || '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-1 rounded-full ${puzzle.isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                      {puzzle.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => setViewPuzzle(puzzle)}
                        className="p-1.5 text-gray-400 hover:text-purple-400 bg-gray-800 rounded-lg border border-gray-700 hover:border-purple-500/50"
                        title="View">
                        <BookOpenIcon className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditingPuzzle(puzzle)}
                        className="p-1.5 text-gray-400 hover:text-blue-400 bg-gray-800 rounded-lg border border-gray-700 hover:border-blue-500/50"
                        title="Edit">
                        <FiEdit3 size={14} />
                      </button>
                      <button onClick={() => handleDelete(puzzle)}
                        className="p-1.5 text-gray-400 hover:text-red-400 bg-gray-800 rounded-lg border border-gray-700 hover:border-red-500/50"
                        title="Delete">
                        <FiTrash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
          <span>{filtered.length} puzzle{filtered.length !== 1 ? 's' : ''}</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="p-1.5 bg-gray-800 border border-gray-700 rounded-lg disabled:opacity-30 hover:text-white">
              <FiChevronLeft size={16} />
            </button>
            <span className="text-white px-2">{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="p-1.5 bg-gray-800 border border-gray-700 rounded-lg disabled:opacity-30 hover:text-white">
              <FiChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Leaderboard Tab ─────────────────────────────────────────────────────────
function LeaderboardTab() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const API_BASE = import.meta.env.VITE_API_BASE_URL
  const LIMIT = 20

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/story-puzzles/leaderboard?limit=100`)
      const data = await res.json()
      if (data.success) {
        const raw = data.data
        setEntries(Array.isArray(raw) ? raw : raw.leaderboard || [])
      }
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [API_BASE])

  useEffect(() => { fetchLeaderboard() }, [fetchLeaderboard])

  const totalPages = Math.max(1, Math.ceil(entries.length / LIMIT))
  const paged = entries.slice((page - 1) * LIMIT, page * LIMIT)

  const formatTime = (ms) => {
    if (!ms) return '—'
    const s = Math.floor(ms / 1000)
    const m = Math.floor(s / 60)
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`
  }

  const rankBadge = (rank) => {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return `#${rank}`
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-gray-400 text-sm">{entries.length} player{entries.length !== 1 ? 's' : ''} on the board</p>
        <button onClick={fetchLeaderboard} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white bg-gray-800 px-3 py-2 rounded-xl border border-gray-700">
          <FiRefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500" />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <TrophyIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No scores yet</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-gray-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-800/80 text-gray-400 text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">Rank</th>
                  <th className="px-4 py-3 text-left">Player</th>
                  <th className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1"><FiStar size={12} /> Stars</div>
                  </th>
                  <th className="px-4 py-3 text-center">Puzzles Solved</th>
                  <th className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1"><FiClock size={12} /> Total Time</div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {paged.map((entry, i) => {
                  const rank = (page - 1) * LIMIT + i + 1
                  const isTop3 = rank <= 3
                  return (
                    <tr key={entry._id || entry.firebaseUid || i}
                      className={`transition-colors ${isTop3 ? 'bg-purple-900/10' : 'hover:bg-gray-800/40'}`}>
                      <td className="px-4 py-3">
                        <span className={`font-bold text-lg ${isTop3 ? '' : 'text-gray-400 text-sm'}`}>
                          {rankBadge(rank)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-white font-medium">{entry.userName || entry.name || 'Anonymous'}</p>
                        {entry.firebaseUid && (
                          <p className="text-gray-600 text-xs font-mono truncate max-w-32">{entry.firebaseUid.slice(0, 12)}…</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-yellow-400 font-bold">{entry.starsEarned ?? entry.totalStars ?? 0}</span>
                          <span className="text-yellow-400 text-xs">⭐</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-300">{entry.puzzlesSolved ?? entry.completed ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-gray-400 font-mono text-xs">
                        {formatTime(entry.timeSpentMs ?? entry.totalTimeMs)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
              <span>{entries.length} entries</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-1.5 bg-gray-800 border border-gray-700 rounded-lg disabled:opacity-30 hover:text-white">
                  <FiChevronLeft size={16} />
                </button>
                <span className="text-white px-2">{page} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="p-1.5 bg-gray-800 border border-gray-700 rounded-lg disabled:opacity-30 hover:text-white">
                  <FiChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
function StoryPuzzle() {
  const [activeTab, setActiveTab] = useState('puzzles')

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <Sidebar />
      <div className="ml-56">
        {/* Header */}
        <div className="relative overflow-hidden bg-gray-900/60 border-b border-gray-800 px-8 py-6">
          <img src={gradient} className="absolute right-0 top-0 h-full object-cover opacity-20 pointer-events-none" alt="" />
          <div className="relative flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-purple-900 rounded-xl flex items-center justify-center text-2xl shadow-lg">
              📖
            </div>
            <div>
              <h1 className="text-white text-2xl font-bold">Story Puzzle</h1>
              <p className="text-gray-400 text-sm">Manage Prophet story puzzles and track player leaderboard</p>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-8 py-6">
          {/* Tabs */}
          <div className="flex gap-2 mb-6 bg-gray-800/40 p-1 rounded-xl w-fit border border-gray-700">
            {[
              { key: 'puzzles', label: '📖 Puzzles', icon: BookOpenIcon },
              { key: 'leaderboard', label: '🏆 Leaderboard', icon: TrophyIcon },
            ].map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === t.key
                    ? 'bg-gradient-to-r from-purple-600 to-purple-800 text-white shadow-lg'
                    : 'text-gray-400 hover:text-white'
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 'puzzles' ? <PuzzlesTab /> : <LeaderboardTab />}
        </div>
      </div>
    </div>
  )
}

export default StoryPuzzle
