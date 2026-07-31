import React, { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import SuccessModal from '../components/SuccessModal'

const API_BASE = import.meta.env.VITE_API_BASE_URL

function PaymentBanner() {
  const [data, setData] = useState({ active: false, image: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [imageFile, setImageFile] = useState(null)
  const [msg, setMsg] = useState({ show: false, type: 'success', text: '' })

  const fetchBanner = async () => {
    try {
      const res = await fetch(`${API_BASE}/payment-banner/admin`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
      })
      const json = await res.json()
      if (json.success && json.data) setData({ active: json.data.active, image: json.data.image || '' })
    } catch (_) {
      setMsg({ show: true, type: 'error', text: 'Failed to load' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchBanner() }, [])

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const form = new FormData()
      form.append('active', data.active)
      if (imageFile) form.append('image', imageFile)
      else if (data.image) form.append('image', data.image)

      const res = await fetch(`${API_BASE}/payment-banner`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` },
        body: form
      })
      const json = await res.json()
      if (json.success) {
        setMsg({ show: true, type: 'success', text: 'Saved' })
        setImageFile(null)
        fetchBanner()
      } else setMsg({ show: true, type: 'error', text: json.message || 'Failed' })
    } catch (_) {
      setMsg({ show: true, type: 'error', text: 'Failed to save' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex">
        <Sidebar />
        <div className="flex-1 ml-64 flex items-center justify-center text-white">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black flex">
      <Sidebar />
      <div className="flex-1 ml-64 p-8 max-w-2xl">
        <h1 className="text-white text-3xl font-bold mb-6" style={{ fontFamily: 'Archivo Black' }}>Payment Banner</h1>
        <p className="text-gray-400 text-sm mb-6">Banner is shown on the app only when Active is on.</p>

        <form onSubmit={save} className="space-y-6">
          <div>
            <label className="block text-white text-sm font-semibold mb-2">Active</label>
            <button
              type="button"
              onClick={() => setData((d) => ({ ...d, active: !d.active }))}
              className={`px-4 py-2 rounded-lg font-medium ${data.active ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300'}`}
            >
              {data.active ? 'On' : 'Off'}
            </button>
          </div>

          <div>
            <label className="block text-white text-sm font-semibold mb-2">Banner image</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-purple-600 file:text-white"
            />
            {!imageFile && data.image && (
              <img src={data.image} alt="Banner" className="mt-2 max-h-32 rounded-lg object-contain" />
            )}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </form>

        <SuccessModal
          isOpen={msg.show}
          onClose={() => setMsg((m) => ({ ...m, show: false }))}
          type={msg.type}
          message={msg.text}
        />
      </div>
    </div>
  )
}

export default PaymentBanner
