import React, { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import { FiRefreshCw, FiSave, FiCheckCircle, FiSmartphone, FiBookOpen } from 'react-icons/fi'
import { getAppConfig, updateAppConfig } from '../services/appConfigService'

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <Sidebar />
      <div className="flex-1 ml-64">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-4xl font-bold text-white mb-1" style={{ fontFamily: 'Archivo Black' }}>
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
        </div>
      </div>
    </div>
  )
}

export default Settings
