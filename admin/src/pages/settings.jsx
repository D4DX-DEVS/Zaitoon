import React, { useState, useEffect } from 'react'
import axios from 'axios'
import Sidebar from '../components/Sidebar'
import { FiRefreshCw, FiSave, FiCheckCircle, FiSmartphone, FiBookOpen, FiAlertTriangle } from 'react-icons/fi'
import { getAppConfig, updateAppConfig } from '../services/appConfigService'
import SuccessModal from '../components/SuccessModal'

const MODES = [
  {
    value: 'instagram',
    title: 'Instagram View',
    icon: FiSmartphone,
    desc: 'Swipe right through pages, swipe down for the next story. Story-style reading.'
  },
  {
    value: 'vertical',
    title: 'Full Vertical View',
    icon: FiBookOpen,
    desc: 'Classic continuous vertical scroll through the PDF with pinch-to-zoom.'
  }
]

function Settings() {
  const [mode, setMode] = useState('instagram')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // Danger zone
  const API_BASE = import.meta.env.VITE_API_BASE_URL
  const [clearConfirm, setClearConfirm] = useState('')
  const [clearing, setClearing] = useState(false)
  const [modal, setModal] = useState({ isOpen: false, type: 'success', message: '' })

  useEffect(() => { fetchConfig() }, [])

  const fetchConfig = async () => {
    setLoading(true)
    setError('')
    try {
      const cfg = await getAppConfig()
      if (cfg.pdfReadingMode) setMode(cfg.pdfReadingMode)
    } catch (err) {
      console.error('Failed to load app config:', err)
      setError('Failed to load settings.')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      await updateAppConfig({ pdfReadingMode: mode })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error('Failed to save app config:', err)
      setError(err?.response?.data?.message || 'Failed to save settings.')
    } finally {
      setSaving(false)
    }
  }

  const handleClearAll = async () => {
    setClearing(true)
    try {
      const token = localStorage.getItem('adminToken')
      const response = await axios.post(
        `${API_BASE}/quiz-attempts/admin/clear-all`,
        {},
        { headers: { Authorization: `Bearer ${token}` }, responseType: 'blob' }
      )

      // Nothing to clear: the API answers with JSON instead of a file.
      if (response.data.type === 'application/json') {
        const text = await response.data.text()
        setModal({ isOpen: true, type: 'success', message: JSON.parse(text).message })
        setClearConfirm('')
        return
      }

      const deleted = response.headers['x-deleted-count'] || 'All'
      const url = URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.download = `quiz-attempts-backup-${new Date().toISOString().split('T')[0]}.ndjson`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      setClearConfirm('')
      setModal({
        isOpen: true,
        type: 'success',
        message: `${deleted} quiz attempt(s) deleted. Backup file downloaded.`
      })
    } catch (err) {
      console.error('Failed to clear leaderboard:', err)
      setModal({ isOpen: true, type: 'error', message: 'Failed to clear leaderboard points.' })
    } finally {
      setClearing(false)
    }
  }

  const confirmClearAll = () => {
    setModal({
      isOpen: true,
      type: 'confirmation',
      message: 'Permanently delete every quiz attempt? A backup file will download first. This cannot be undone.',
      onConfirm: handleClearAll
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 overflow-x-clip">
      <Sidebar />
      <div className="flex-1 min-w-0 ml-0 md:ml-56 pb-20 md:pb-0">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="flex flex-wrap justify-between items-center gap-3 mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-1" style={{ fontFamily: 'Archivo Black' }}>
                Settings
              </h1>
              <p className="text-gray-400">Global app configuration</p>
            </div>
            <button
              onClick={fetchConfig}
              className="p-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
              title="Reload"
            >
              <FiRefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* PDF reading mode */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <h2 className="text-xl font-bold text-white mb-1">Story PDF Reading Mode</h2>
            <p className="text-gray-400 mb-6">Choose how stories are displayed to kids in the app.</p>

            <div className="grid gap-4 sm:grid-cols-2">
              {MODES.map((m) => {
                const active = mode === m.value
                const Icon = m.icon
                return (
                  <button
                    key={m.value}
                    onClick={() => setMode(m.value)}
                    className={`text-left rounded-xl border-2 p-5 transition-all ${
                      active
                        ? 'border-purple-500 bg-purple-500/10'
                        : 'border-gray-700 bg-gray-900 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <Icon className={`w-6 h-6 ${active ? 'text-purple-400' : 'text-gray-400'}`} />
                      <span className="text-lg font-semibold text-white">{m.title}</span>
                      {active && (
                        <span className="ml-auto flex items-center gap-1 text-purple-400 text-sm">
                          <FiCheckCircle className="w-4 h-4" /> Selected
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400">{m.desc}</p>
                  </button>
                )
              })}
            </div>

            {error && <p className="text-red-400 mt-4">{error}</p>}

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50"
              >
                <FiSave className="w-5 h-5" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              {saved && (
                <span className="flex items-center gap-1 text-green-400">
                  <FiCheckCircle className="w-5 h-5" /> Saved
                </span>
              )}
            </div>
          </div>

          {/* Danger zone */}
          <div className="mt-8 bg-red-950/30 rounded-xl border border-red-800 p-6">
            <div className="flex items-center gap-2 mb-1">
              <FiAlertTriangle className="w-5 h-5 text-red-400" />
              <h2 className="text-xl font-bold text-red-400">Danger Zone</h2>
            </div>
            <p className="text-gray-400 mb-2">
              Permanently deletes every quiz attempt, clearing all leaderboard points.
              A backup file is downloaded automatically before anything is deleted.
            </p>
            <p className="text-gray-500 text-sm mb-5">
              Puzzle stars are not affected. This cannot be undone from the admin panel.
            </p>

            <div className="max-w-2xl">
              <label htmlFor="clear-confirm" className="block text-sm text-gray-300 mb-2">
                To confirm, type{' '}
                <span className="font-mono font-semibold text-white bg-gray-800 px-1.5 py-0.5 rounded">
                  CLEAR
                </span>{' '}
                in the box below
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  id="clear-confirm"
                  type="text"
                  value={clearConfirm}
                  onChange={(e) => setClearConfirm(e.target.value)}
                  autoComplete="off"
                  spellCheck="false"
                  className="flex-1 min-w-[180px] px-4 py-2 bg-gray-900 text-white rounded-lg border border-gray-700 focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
                <button
                  onClick={confirmClearAll}
                  disabled={clearConfirm !== 'CLEAR' || clearing}
                  className="shrink-0 px-5 py-2.5 bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {clearing ? 'Clearing...' : 'Clear All Leaderboard Points'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <SuccessModal
        isOpen={modal.isOpen}
        type={modal.type}
        message={modal.message}
        onConfirm={modal.onConfirm}
        onClose={() => setModal({ isOpen: false, type: 'success', message: '' })}
        onCancel={() => setModal({ isOpen: false, type: 'success', message: '' })}
      />
    </div>
  )
}

export default Settings
