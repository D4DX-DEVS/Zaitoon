import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import SuccessModal from '../components/SuccessModal'
import axios from 'axios'
import {
  FiPlus,
  FiEdit3,
  FiTrash2,
  FiSettings,
  FiToggleLeft,
  FiToggleRight,
  FiRefreshCw,
  FiX,
  FiSave,
  FiCalendar,
  FiCheckCircle,
  FiXCircle
} from 'react-icons/fi'

const EMPTY_FORM = {
  name: '',
  startDate: '',
  startTime: '00:00',
  endDate: '',
  endTime: '23:59',
  numberOfQuestions: 10,
  questionsRandomization: false,
  isEnable: true
}

function QuizManagement() {
  const navigate = useNavigate()
  const API_BASE = import.meta.env.VITE_API_BASE_URL
  const [configs, setConfigs] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingConfig, setEditingConfig] = useState(null) // null = new, object = editing
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [modal, setModal] = useState({ isOpen: false, type: 'success', message: '', onConfirm: null, onCancel: null })

  useEffect(() => { fetchConfigs() }, [])

  const fetchConfigs = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('adminToken')
      const res = await axios.get(`${API_BASE}/quizzes/config/all`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.data.success) setConfigs(res.data.data || [])
    } catch (err) {
      console.error('Failed to fetch configs:', err)
    } finally {
      setLoading(false)
    }
  }

  const showModal = (type, message, onConfirm = null, onCancel = null) =>
    setModal({ isOpen: true, type, message, onConfirm, onCancel })

  const closeModal = () =>
    setModal({ isOpen: false, type: 'success', message: '', onConfirm: null, onCancel: null })

  const openNewForm = () => {
    setEditingConfig(null)
    setFormData(EMPTY_FORM)
    setShowForm(true)
  }

  const openEditForm = (cfg) => {
    const start = new Date(cfg.startDate)
    const end = new Date(cfg.endDate)
    setEditingConfig(cfg)
    setFormData({
      name: cfg.name || '',
      startDate: start.toISOString().split('T')[0],
      startTime: start.toTimeString().slice(0, 5),
      endDate: end.toISOString().split('T')[0],
      endTime: end.toTimeString().slice(0, 5),
      numberOfQuestions: cfg.numberOfQuestions || 10,
      questionsRandomization: cfg.questionsRandomization || false,
      isEnable: cfg.isEnable !== undefined ? cfg.isEnable : true
    })
    setShowForm(true)
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name.trim()) { showModal('error', 'Please enter a quiz name'); return }
    if (!formData.startDate || !formData.startTime || !formData.endDate || !formData.endTime) {
      showModal('error', 'Please fill all date and time fields'); return
    }
    if (formData.numberOfQuestions < 1) { showModal('error', 'Number of questions must be at least 1'); return }

    const startDateTime = new Date(`${formData.startDate}T${formData.startTime}`)
    const endDateTime = new Date(`${formData.endDate}T${formData.endTime}`)
    if (startDateTime >= endDateTime) { showModal('error', 'Start date/time must be before end date/time'); return }

    setSaving(true)
    try {
      const token = localStorage.getItem('adminToken')
      const payload = {
        name: formData.name.trim(),
        startDate: startDateTime.toISOString(),
        endDate: endDateTime.toISOString(),
        numberOfQuestions: parseInt(formData.numberOfQuestions, 10),
        questionsRandomization: formData.questionsRandomization,
        isEnable: formData.isEnable
      }

      let res
      if (editingConfig) {
        res = await axios.put(`${API_BASE}/quizzes/config/${editingConfig._id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        })
      } else {
        res = await axios.post(`${API_BASE}/quizzes/config`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        })
      }

      if (res.data.success) {
        showModal('success', editingConfig ? 'Quiz updated successfully' : 'New quiz configured successfully')
        setShowForm(false)
        fetchConfigs()
      }
    } catch (err) {
      showModal('error', err.response?.data?.message || 'Failed to save quiz configuration')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleEnable = async (cfg) => {
    try {
      const token = localStorage.getItem('adminToken')
      await axios.put(`${API_BASE}/quizzes/config/${cfg._id}`,
        { isEnable: !cfg.isEnable },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      fetchConfigs()
    } catch (err) {
      showModal('error', err.response?.data?.message || 'Failed to toggle quiz status')
    }
  }

  const handleClaimUnlinked = (cfg) => {
    setModal({
      isOpen: true,
      type: 'confirmation',
      message: `This will assign ALL quizzes and questions not yet linked to any programme → "${cfg.name}". Proceed?`,
      confirmText: 'Migrate',
      confirmClass: 'bg-yellow-500 hover:bg-yellow-600',
      onConfirm: async () => {
        closeModal()
        try {
          const token = localStorage.getItem('adminToken')
          const res = await axios.post(
            `${API_BASE}/quizzes/config/${cfg._id}/claim-unlinked`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
          )
          if (res.data.success) showModal('success', res.data.message)
          else showModal('error', res.data.message || 'Failed')
        } catch (err) {
          showModal('error', err.response?.data?.message || 'Failed to claim unlinked quizzes')
        }
      },
      onCancel: null
    })
  }

  const handleDelete = (cfg) => {
    showModal('confirmation', `Delete "${cfg.name}"? This cannot be undone.`,
      async () => {
        closeModal()
        try {
          const token = localStorage.getItem('adminToken')
          await axios.delete(`${API_BASE}/quizzes/config/${cfg._id}`, {
            headers: { Authorization: `Bearer ${token}` }
          })
          fetchConfigs()
        } catch (err) {
          showModal('error', err.response?.data?.message || 'Failed to delete quiz')
        }
      },
      () => closeModal()
    )
  }

  const formatDate = (d) => {
    if (!d) return 'N/A'
    return new Date(d).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <Sidebar />
      <div className="flex-1 ml-64">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-4xl font-bold text-white mb-1" style={{ fontFamily: 'Archivo Black' }}>
                Quiz Management
              </h1>
              <p className="text-gray-400">Configure and manage your quiz programmes</p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={fetchConfigs}
                className="p-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                <FiRefreshCw className="w-5 h-5" />
              </button>
              <button
                onClick={openNewForm}
                className="flex items-center space-x-2 px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
              >
                <FiPlus className="w-5 h-5" />
                <span>Configure New Quiz</span>
              </button>
            </div>
          </div>

          {/* Config cards */}
          {loading ? (
            <div className="text-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto" />
              <p className="text-gray-400 mt-4">Loading configurations...</p>
            </div>
          ) : configs.length === 0 ? (
            <div className="text-center py-20 bg-gray-800/50 rounded-xl border border-gray-700 border-dashed">
              <FiSettings className="w-14 h-14 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-lg mb-2">No quiz configured yet</p>
              <p className="text-gray-500 text-sm mb-6">Click "Configure New Quiz" to get started</p>
              <button
                onClick={openNewForm}
                className="px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <span>Configure New Quiz</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {configs.map(cfg => {
                const now = new Date()
                const isLive = cfg.isEnable && new Date(cfg.startDate) <= now && new Date(cfg.endDate) >= now
                return (
                  <div key={cfg._id} className="bg-gray-800 rounded-xl border border-gray-700 p-6 flex flex-col gap-4">
                    {/* Card header */}
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <h2 className="text-xl font-bold text-white truncate">{cfg.name}</h2>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {isLive ? (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full text-xs font-medium">
                              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                              Live
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-gray-700 text-gray-400 rounded-full text-xs">Offline</span>
                          )}
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.isEnable ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'}`}>
                            {cfg.isEnable ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                      </div>
                      {/* Toggle */}
                      <button
                        onClick={() => handleToggleEnable(cfg)}
                        className="text-3xl ml-3 flex-shrink-0"
                        title={cfg.isEnable ? 'Disable quiz' : 'Enable quiz'}
                      >
                        {cfg.isEnable
                          ? <FiToggleRight className="text-green-400 hover:text-green-300 transition-colors" />
                          : <FiToggleLeft className="text-gray-500 hover:text-gray-300 transition-colors" />}
                      </button>
                    </div>

                    {/* Info grid */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="bg-gray-700/50 rounded-lg p-3">
                        <p className="text-gray-400 text-xs mb-1 flex items-center gap-1"><FiCalendar className="w-3 h-3" /> Start</p>
                        <p className="text-white font-medium">{formatDate(cfg.startDate)}</p>
                      </div>
                      <div className="bg-gray-700/50 rounded-lg p-3">
                        <p className="text-gray-400 text-xs mb-1 flex items-center gap-1"><FiCalendar className="w-3 h-3" /> End</p>
                        <p className="text-white font-medium">{formatDate(cfg.endDate)}</p>
                      </div>
                      <div className="bg-gray-700/50 rounded-lg p-3">
                        <p className="text-gray-400 text-xs mb-1">Questions/Day</p>
                        <p className="text-white font-medium">{cfg.numberOfQuestions}</p>
                      </div>
                      <div className="bg-gray-700/50 rounded-lg p-3">
                        <p className="text-gray-400 text-xs mb-1">Randomize</p>
                        <p className="text-white font-medium flex items-center gap-1">
                          {cfg.questionsRandomization
                            ? <><FiCheckCircle className="text-green-400 w-4 h-4" /> Yes</>
                            : <><FiXCircle className="text-gray-500 w-4 h-4" /> No</>}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2 mt-auto pt-2 border-t border-gray-700">
                      <button
                        onClick={() => navigate(`/questions?configId=${cfg._id}&configName=${encodeURIComponent(cfg.name)}`)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30 transition-colors text-sm"
                      >
                        <FiSettings className="w-4 h-4" />
                        <span>Manage Questions</span>
                      </button>
                      <button
                        onClick={() => openEditForm(cfg)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/20 text-purple-400 rounded-lg hover:bg-purple-600/30 transition-colors text-sm"
                      >
                        <FiEdit3 className="w-4 h-4" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleClaimUnlinked(cfg)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-600/20 text-yellow-400 rounded-lg hover:bg-yellow-600/30 transition-colors text-sm"
                        title="Link all unlinked quizzes & questions to this programme"
                      >
                        <FiCheckCircle className="w-4 h-4" />
                        <span>Claim Unlinked</span>
                      </button>
                      <button
                        onClick={() => handleDelete(cfg)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition-colors text-sm ml-auto"
                      >
                        <FiTrash2 className="w-4 h-4" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowForm(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
              <h2 className="text-xl font-bold text-white">
                {editingConfig ? `Edit: ${editingConfig.name}` : 'Configure New Quiz'}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors">
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Quiz name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Quiz Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g. Daily General Quiz"
                  className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-600 focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder-gray-500"
                  required
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Start Date *</label>
                  <input type="date" name="startDate" value={formData.startDate} onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-600 focus:ring-2 focus:ring-purple-500" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Start Time *</label>
                  <input type="time" name="startTime" value={formData.startTime} onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-600 focus:ring-2 focus:ring-purple-500" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">End Date *</label>
                  <input type="date" name="endDate" value={formData.endDate} onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-600 focus:ring-2 focus:ring-purple-500" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">End Time *</label>
                  <input type="time" name="endTime" value={formData.endTime} onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-600 focus:ring-2 focus:ring-purple-500" required />
                </div>
              </div>

              {/* Number of questions + randomization */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Questions Per Day *</label>
                  <input type="number" name="numberOfQuestions" value={formData.numberOfQuestions} onChange={handleInputChange}
                    min="1"
                    className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-600 focus:ring-2 focus:ring-purple-500" required />
                </div>
                <div className="flex flex-col justify-end">
                  <label className="flex items-center space-x-3 cursor-pointer py-2">
                    <input type="checkbox" name="questionsRandomization" checked={formData.questionsRandomization} onChange={handleInputChange}
                      className="w-5 h-5 rounded accent-purple-500" />
                    <span className="text-gray-300 text-sm">Randomize question order</span>
                  </label>
                  <label className="flex items-center space-x-3 cursor-pointer py-1">
                    <input type="checkbox" name="isEnable" checked={formData.isEnable} onChange={handleInputChange}
                      className="w-5 h-5 rounded accent-purple-500" />
                    <span className="text-gray-300 text-sm">Enable quiz</span>
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2 border-t border-gray-700">
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-5 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors font-medium">
                  <FiSave className="w-4 h-4" />
                  <span>{saving ? 'Saving...' : editingConfig ? 'Update Quiz' : 'Create Quiz'}</span>
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
        onCancel={modal.onCancel}
        confirmText={modal.confirmText || 'Delete'}
        confirmClass={modal.confirmClass || 'bg-red-600 hover:bg-red-700'}
      />
    </div>
  )
}

export default QuizManagement
