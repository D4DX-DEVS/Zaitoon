import React, { useState, useEffect, useRef } from 'react'
import Sidebar from '../components/Sidebar'
import SuccessModal from '../components/SuccessModal'
import { FiPlus, FiEdit3, FiTrash2, FiX, FiCheck, FiUpload, FiLink, FiImage } from 'react-icons/fi'
import { HiCalendar } from 'react-icons/hi'

function Notices() {
  const [notices, setNotices] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingNotice, setEditingNotice] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [modal, setModal] = useState({ isOpen: false, type: 'success', message: '', onConfirm: null })

  const [formData, setFormData] = useState({ title: '', message: '', senderName: '' })
  const [imageFile, setImageFile] = useState(null)
  const [imageLink, setImageLink] = useState('')
  const [imagePreview, setImagePreview] = useState(null)
  const [imageMode, setImageMode] = useState('none') // 'none' | 'upload' | 'link'
  const fileInputRef = useRef(null)

  const API_BASE = import.meta.env.VITE_API_BASE_URL

  const getAuthHeaders = () => {
    const token = localStorage.getItem('adminToken')
    return { Authorization: token ? `Bearer ${token}` : '' }
  }

  const showModal = (type, message, onConfirm = null) => {
    setModal({ isOpen: true, type, message, onConfirm })
  }

  const closeModal = () => {
    setModal({ isOpen: false, type: 'success', message: '', onConfirm: null })
  }

  const fetchNotices = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/admin/notices`, { headers: getAuthHeaders() })
      const data = await res.json()
      if (data.success) {
        setNotices(data.data)
      } else {
        showModal('error', 'Failed to fetch notices')
      }
    } catch {
      showModal('error', 'Error fetching notices')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchNotices() }, [])

  const openCreateForm = () => {
    setEditingNotice(null)
    setFormData({ title: '', message: '', senderName: '' })
    setImageFile(null)
    setImageLink('')
    setImagePreview(null)
    setImageMode('none')
    setShowForm(true)
  }

  const openEditForm = (notice) => {
    setEditingNotice(notice)
    setFormData({ title: notice.title, message: notice.message, senderName: notice.senderName || '' })
    setImageFile(null)
    setImageLink('')
    setImagePreview(notice.image || null)
    setImageMode(notice.image ? 'link' : 'none')
    if (notice.image) setImageLink(notice.image)
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingNotice(null)
    setFormData({ title: '', message: '', senderName: '' })
    setImageFile(null)
    setImageLink('')
    setImagePreview(null)
    setImageMode('none')
  }

  const handleImageFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
    }
  }

  const clearImage = () => {
    setImageFile(null)
    setImageLink('')
    setImagePreview(null)
    setImageMode('none')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.title.trim() || !formData.message.trim()) {
      showModal('error', 'Title and message are required')
      return
    }

    try {
      const url = editingNotice
        ? `${API_BASE}/admin/notices/${editingNotice._id}`
        : `${API_BASE}/admin/notices`
      const method = editingNotice ? 'PUT' : 'POST'

      const body = new FormData()
      body.append('type', 'app')
      body.append('title', formData.title)
      body.append('message', formData.message)
      if (formData.senderName.trim()) body.append('senderName', formData.senderName.trim())
      else body.append('senderName', '')

      if (imageMode === 'upload' && imageFile) {
        body.append('image', imageFile)
      } else if (imageMode === 'link' && imageLink.trim()) {
        body.append('imageLink', imageLink.trim())
      } else if (editingNotice && editingNotice.image && imageMode === 'none') {
        body.append('removeImage', 'true')
      }

      const res = await fetch(url, {
        method,
        headers: { ...getAuthHeaders() },
        body
      })
      const data = await res.json()

      if (data.success) {
        showModal('success', editingNotice ? 'Notice updated successfully' : 'Notice created successfully')
        closeForm()
        fetchNotices()
      } else {
        showModal('error', data.message || 'Operation failed')
      }
    } catch {
      showModal('error', 'Server error')
    }
  }

  const handleToggleActive = async (notice) => {
    try {
      const body = new FormData()
      body.append('active', !notice.active)
      const res = await fetch(`${API_BASE}/admin/notices/${notice._id}`, {
        method: 'PUT',
        headers: { ...getAuthHeaders() },
        body
      })
      const data = await res.json()
      if (data.success) {
        fetchNotices()
      } else {
        showModal('error', 'Failed to update notice')
      }
    } catch {
      showModal('error', 'Server error')
    }
  }

  const handleDelete = async (notice) => {
    try {
      const res = await fetch(`${API_BASE}/admin/notices/${notice._id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      })
      const data = await res.json()
      if (data.success) {
        setConfirmDeleteId(null)
        fetchNotices()
      } else {
        showModal('error', 'Failed to delete notice')
      }
    } catch {
      showModal('error', 'Server error')
    }
  }

  const filteredNotices = notices.filter(n => n.type === 'app')

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <Sidebar />
      <div className="flex-1 ml-56 h-screen overflow-y-auto scrollbar-hide">
        <div className="max-w-4xl mx-auto px-4 py-8">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white" style={{ fontFamily: 'Archivo Black' }}>
                Notices
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                Manage app announcements shown to all users
              </p>
            </div>
            <button
              onClick={openCreateForm}
              className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium transition-colors"
            >
              <FiPlus className="w-4 h-4" />
              <span>New Notice</span>
            </button>
          </div>

          <p className="text-gray-500 text-xs mb-6">
            These notices are fetched by the mobile app and displayed as a persistent in-app banner for all users.
          </p>

          {/* Create / Edit Form */}
          {showForm && (
            <div className="bg-gray-900/80 border border-purple-500/30 rounded-2xl p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-semibold text-lg">
                  {editingNotice ? 'Edit Notice' : 'New Notice'}
                </h2>
                <button onClick={closeForm} className="text-gray-400 hover:text-white transition-colors">
                  <FiX className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Notice title..."
                    maxLength={120}
                    className="w-full bg-gray-800/60 border border-gray-700/60 text-white placeholder-gray-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500/60 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">
                    Sender Name <span className="text-gray-500 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.senderName}
                    onChange={e => setFormData(prev => ({ ...prev, senderName: e.target.value }))}
                    placeholder="e.g. Zaitoon Team, Editor, etc."
                    className="w-full bg-gray-800/60 border border-gray-700/60 text-white placeholder-gray-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500/60 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">Message</label>
                  <textarea
                    value={formData.message}
                    onChange={e => setFormData(prev => ({ ...prev, message: e.target.value }))}
                    placeholder="Notice message..."
                    rows={4}
                    className="w-full bg-gray-800/60 border border-gray-700/60 text-white placeholder-gray-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500/60 transition-colors resize-none"
                  />
                </div>

                {/* Image Section (Optional) */}
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">
                    Image <span className="text-gray-500 font-normal">(optional)</span>
                  </label>

                  {/* Mode Selector */}
                  <div className="flex items-center space-x-2 mb-3">
                    <button
                      type="button"
                      onClick={() => { setImageMode('none'); clearImage() }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        imageMode === 'none'
                          ? 'bg-gray-700 text-white'
                          : 'bg-gray-800/60 text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      No Image
                    </button>
                    <button
                      type="button"
                      onClick={() => { setImageMode('upload'); setImageLink(''); setImagePreview(null) }}
                      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        imageMode === 'upload'
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-800/60 text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      <FiUpload className="w-3 h-3" />
                      <span>Upload File</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setImageMode('link'); setImageFile(null); setImagePreview(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        imageMode === 'link'
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-800/60 text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      <FiLink className="w-3 h-3" />
                      <span>Image Link</span>
                    </button>
                  </div>

                  {/* Upload File Input */}
                  {imageMode === 'upload' && (
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileChange}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center space-x-2 px-4 py-3 bg-gray-800/60 border border-dashed border-gray-600 hover:border-purple-500/50 text-gray-400 hover:text-gray-300 rounded-xl text-sm transition-colors w-full justify-center"
                      >
                        <FiImage className="w-4 h-4" />
                        <span>{imageFile ? imageFile.name : 'Click to select an image'}</span>
                      </button>
                    </div>
                  )}

                  {/* Image Link Input */}
                  {imageMode === 'link' && (
                    <input
                      type="url"
                      value={imageLink}
                      onChange={e => { setImageLink(e.target.value); setImagePreview(e.target.value) }}
                      placeholder="https://example.com/image.jpg"
                      className="w-full bg-gray-800/60 border border-gray-700/60 text-white placeholder-gray-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500/60 transition-colors"
                    />
                  )}

                  {/* Image Preview */}
                  {imagePreview && (
                    <div className="mt-3 relative inline-block">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="max-h-40 rounded-xl border border-gray-700/40 object-cover"
                        onError={e => { e.target.style.display = 'none' }}
                      />
                      <button
                        type="button"
                        onClick={clearImage}
                        className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-0.5 hover:bg-red-700 transition-colors"
                      >
                        <FiX className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex space-x-3 pt-1">
                  <button
                    type="submit"
                    className="flex items-center space-x-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium transition-colors"
                  >
                    <FiCheck className="w-4 h-4" />
                    <span>{editingNotice ? 'Update' : 'Create'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={closeForm}
                    className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Notices List */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
            </div>
          ) : filteredNotices.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <p className="text-lg">No app notices yet.</p>
              <p className="text-sm mt-1">Click "New Notice" to create one.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredNotices.map(notice => (
                <div
                  key={notice._id}
                  className={`bg-gray-900/80 border rounded-2xl p-5 transition-colors ${
                    notice.active
                      ? 'border-purple-500/20'
                      : 'border-gray-700/30 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <h3 className="text-white font-semibold text-sm">{notice.title}</h3>
                        {notice.senderName && (
                          <span className="text-xs text-purple-400/80">— {notice.senderName}</span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          notice.active
                            ? 'bg-green-500/15 text-green-400'
                            : 'bg-gray-700/50 text-gray-500'
                        }`}>
                          {notice.active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="text-gray-400 text-sm leading-relaxed whitespace-pre-line">
                        {notice.message}
                      </p>
                      {notice.image && (
                        <img
                          src={notice.image}
                          alt=""
                          className="mt-3 max-h-48 rounded-xl border border-gray-700/30 object-cover"
                          onError={e => { e.target.style.display = 'none' }}
                        />
                      )}
                      <div className="flex items-center space-x-1 mt-2 text-gray-600 text-xs">
                        <HiCalendar className="w-3 h-3" />
                        <span>{formatDate(notice.createdAt)}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 flex-shrink-0">
                      {/* Active toggle */}
                      <button
                        onClick={() => handleToggleActive(notice)}
                        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          notice.active
                            ? 'bg-green-500/10 text-green-400 hover:bg-red-500/10 hover:text-red-400'
                            : 'bg-gray-800 text-gray-400 hover:bg-green-500/10 hover:text-green-400'
                        }`}
                      >
                        <FiCheck className="w-3.5 h-3.5" />
                        <span>{notice.active ? 'Deactivate' : 'Activate'}</span>
                      </button>
                      {/* Edit */}
                      <button
                        onClick={() => openEditForm(notice)}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                      >
                        <FiEdit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      {/* Delete */}
                      {confirmDeleteId === notice._id ? (
                        <div className="flex items-center space-x-1.5">
                          <span className="text-red-400 text-xs font-medium">Sure?</span>
                          <button
                            onClick={() => handleDelete(notice)}
                            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
                          >
                            <FiTrash2 className="w-3.5 h-3.5" />
                            <span>Yes, delete</span>
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(notice._id)}
                          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                        >
                          <FiTrash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <SuccessModal
        isOpen={modal.isOpen}
        type={modal.type}
        message={modal.message}
        onConfirm={modal.onConfirm}
        onClose={closeModal}
      />
    </div>
  )
}

export default Notices
