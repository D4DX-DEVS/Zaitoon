import React, { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import SuccessModal from '../components/SuccessModal'
import {
  FiPlus,
  FiX,
  FiEdit3,
  FiTrash2,
  FiImage,
  FiEye,
  FiEyeOff,
  FiUpload,
  FiArrowLeft,
  FiFolder,
} from 'react-icons/fi'
import { HiCalendar } from 'react-icons/hi'

function Gallery() {
  const [albums, setAlbums] = useState([])
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState({ isOpen: false, type: 'success', message: '', onConfirm: null })

  // View: 'list' (folders) or 'detail' (inside a folder)
  const [view, setView] = useState('list')
  const [openAlbum, setOpenAlbum] = useState(null)

  // Modals
  const [showCreate, setShowCreate] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showAddImages, setShowAddImages] = useState(false)

  // Form (create / edit meta)
  const [formData, setFormData] = useState({
    title: '',
    titleMl: '',
    description: '',
    sortOrder: 1,
    isActive: true,
  })

  // Selected files for upload [{ file, preview }]
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)

  const API_BASE = import.meta.env.VITE_API_BASE_URL

  const showModal = (type, message, onConfirm = null) => setModal({ isOpen: true, type, message, onConfirm })
  const closeModal = () => setModal({ isOpen: false, type: 'success', message: '', onConfirm: null })

  // ─── Fetch ──────────────────────────────────────────────
  const fetchAlbums = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/gallery?active=all&limit=200`)
      const data = await response.json()
      if (data.success) {
        const list = data.data.albums || []
        setAlbums(list)
        // Keep the open album in sync if we're inside one
        if (openAlbum) {
          const refreshed = list.find(a => a._id === openAlbum._id)
          if (refreshed) setOpenAlbum(refreshed)
        }
      } else {
        showModal('error', 'Failed to fetch gallery albums')
      }
    } catch (error) {
      showModal('error', 'Error fetching gallery albums')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAlbums() }, [])

  // ─── File selection ────────────────────────────────────
  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files)
    if (!selected.length) return
    const items = selected.map(file => ({ file, preview: null }))
    setFiles(prev => [...prev, ...items])
    items.forEach((item, i) => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        setFiles(prev => {
          const next = [...prev]
          const idx = next.findIndex(f => f.file === item.file)
          if (idx !== -1) next[idx] = { ...next[idx], preview: ev.target.result }
          return next
        })
      }
      reader.readAsDataURL(item.file)
    })
    e.target.value = ''
  }

  const removeFile = (idx) => setFiles(prev => prev.filter((_, i) => i !== idx))

  // ─── Reset ─────────────────────────────────────────────
  const resetForm = () => {
    setFormData({ title: '', titleMl: '', description: '', sortOrder: 1, isActive: true })
    setFiles([])
    setUploading(false)
    setShowCreate(false)
    setShowEdit(false)
    setShowAddImages(false)
  }

  // ─── Create album ──────────────────────────────────────
  const createAlbum = async (e) => {
    e.preventDefault()
    if (!formData.title.trim()) {
      showModal('error', 'Please enter a title for the folder.')
      return
    }
    if (files.length === 0) {
      showModal('error', 'Please select at least one image.')
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('title', formData.title)
      fd.append('titleMl', formData.titleMl)
      fd.append('description', formData.description)
      fd.append('sortOrder', formData.sortOrder)
      files.forEach(f => fd.append('images', f.file))

      const response = await fetch(`${API_BASE}/gallery`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` },
        body: fd,
      })
      const data = await response.json()
      if (data.success) {
        showModal('success', 'Folder created successfully!')
        resetForm()
        fetchAlbums()
      } else {
        showModal('error', data.message || 'Failed to create folder')
      }
    } catch (error) {
      showModal('error', 'Error creating folder')
    } finally {
      setUploading(false)
    }
  }

  // ─── Add images to existing album ──────────────────────
  const addImages = async (e) => {
    e.preventDefault()
    if (!openAlbum) return
    if (files.length === 0) {
      showModal('error', 'Please select at least one image.')
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      files.forEach(f => fd.append('images', f.file))

      const response = await fetch(`${API_BASE}/gallery/${openAlbum._id}/images`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` },
        body: fd,
      })
      const data = await response.json()
      if (data.success) {
        showModal('success', 'Images added successfully!')
        setOpenAlbum(data.data)
        resetForm()
        fetchAlbums()
      } else {
        showModal('error', data.message || 'Failed to add images')
      }
    } catch (error) {
      showModal('error', 'Error adding images')
    } finally {
      setUploading(false)
    }
  }

  // ─── Update album meta ─────────────────────────────────
  const updateAlbum = async (e) => {
    e.preventDefault()
    if (!openAlbum) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('title', formData.title)
      fd.append('titleMl', formData.titleMl)
      fd.append('description', formData.description)
      fd.append('sortOrder', formData.sortOrder)
      fd.append('isActive', formData.isActive)

      const response = await fetch(`${API_BASE}/gallery/${openAlbum._id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` },
        body: fd,
      })
      const data = await response.json()
      if (data.success) {
        showModal('success', 'Folder updated successfully!')
        setOpenAlbum(data.data)
        resetForm()
        fetchAlbums()
      } else {
        showModal('error', data.message || 'Failed to update folder')
      }
    } catch (error) {
      showModal('error', 'Error updating folder')
    } finally {
      setUploading(false)
    }
  }

  // ─── Toggle visibility ─────────────────────────────────
  const toggleActive = async (album) => {
    try {
      const fd = new FormData()
      fd.append('isActive', !album.isActive)
      const response = await fetch(`${API_BASE}/gallery/${album._id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` },
        body: fd,
      })
      const data = await response.json()
      if (data.success) fetchAlbums()
    } catch (_) {}
  }

  // ─── Delete album ──────────────────────────────────────
  const deleteAlbum = async (id) => {
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/gallery/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` },
      })
      const data = await response.json()
      if (data.success) {
        showModal('success', 'Folder deleted successfully!')
        if (openAlbum && openAlbum._id === id) {
          setOpenAlbum(null)
          setView('list')
        }
        fetchAlbums()
      } else {
        showModal('error', data.message || 'Failed to delete')
      }
    } catch (error) {
      showModal('error', 'Error deleting folder')
    } finally {
      setLoading(false)
    }
  }

  // ─── Delete single image from album ────────────────────
  const deleteImage = async (albumId, imageId) => {
    try {
      const response = await fetch(`${API_BASE}/gallery/${albumId}/images/${imageId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` },
      })
      const data = await response.json()
      if (data.success) {
        setOpenAlbum(data.data)
        fetchAlbums()
      } else {
        showModal('error', data.message || 'Failed to remove image')
      }
    } catch (_) {
      showModal('error', 'Error removing image')
    }
  }

  // ─── Open handlers ─────────────────────────────────────
  const openFolder = (album) => {
    setOpenAlbum(album)
    setView('detail')
  }

  const openCreate = () => {
    resetForm()
    setShowCreate(true)
  }

  const openEdit = () => {
    if (!openAlbum) return
    setFormData({
      title: openAlbum.title || '',
      titleMl: openAlbum.titleMl || '',
      description: openAlbum.description || '',
      sortOrder: openAlbum.sortOrder || 0,
      isActive: openAlbum.isActive !== false,
    })
    setFiles([])
    setShowEdit(true)
  }

  const openAddImages = () => {
    setFiles([])
    setShowAddImages(true)
  }

  // ─── Derived stats ─────────────────────────────────────
  const totalAlbums = albums.length
  const activeAlbums = albums.filter(a => a.isActive).length
  const hiddenAlbums = albums.filter(a => !a.isActive).length

  // ─── Reusable file picker block ────────────────────────
  const filePicker = (
    <div className="space-y-3">
      <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-600 rounded-2xl cursor-pointer bg-gray-800/30 hover:border-purple-500/60 hover:bg-purple-500/5 transition-all duration-200 group">
        <FiUpload className="w-6 h-6 text-gray-500 group-hover:text-purple-400 transition mb-1" />
        <span className="text-gray-400 text-sm group-hover:text-gray-300 transition">
          {files.length > 0 ? `${files.length} image${files.length > 1 ? 's' : ''} selected — click to add more` : 'Click to choose images'}
        </span>
        <span className="text-gray-600 text-xs mt-0.5">Select multiple — no limit</span>
        <input type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" />
      </label>

      {files.length > 0 && (
        <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto scrollbar-hide">
          {files.map((item, idx) => (
            <div key={idx} className="relative group/item rounded-xl overflow-hidden border border-gray-700 aspect-square bg-gray-800">
              {item.preview
                ? <img src={item.preview} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center"><FiImage className="w-6 h-6 text-gray-500" /></div>}
              {!uploading && (
                <button
                  type="button"
                  onClick={() => removeFile(idx)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover/item:opacity-100 transition"
                >
                  <FiX className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-black flex">
      <Sidebar />
      <div className="flex-1 ml-64">
        {/* ─── LIST VIEW ─────────────────────────────────── */}
        {view === 'list' && (
          <>
            {/* Header */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-white text-5xl font-bold mb-1 relative" style={{ fontFamily: 'Archivo Black' }}>
                    Gallery
                    <div
                      className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 h-0.5 w-48"
                      style={{ background: 'linear-gradient(90.05deg, #AC28DC 6.68%, #7E1EB7 49.26%, #501392 91.85%)' }}
                    ></div>
                  </h1>
                  <p className="text-gray-400 text-sm mt-3">Organize gallery images into folders</p>
                </div>
                <button
                  onClick={openCreate}
                  className="flex items-center justify-center space-x-2 text-white transition duration-200"
                  style={{
                    background: 'linear-gradient(90.05deg, #AC28DC 6.68%, #7E1EB7 49.26%, #501392 91.85%)',
                    width: '180px', height: '36px', borderRadius: '18px',
                    fontFamily: 'Fredoka One', fontWeight: '400', fontSize: '14px',
                  }}
                >
                  <FiPlus className="w-3 h-3" />
                  <span>New Folder</span>
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
              <div className="flex space-x-4">
                <div className="bg-gray-900/60 border border-gray-700 rounded-xl px-4 py-2">
                  <span className="text-gray-400 text-xs">Folders</span>
                  <p className="text-white text-lg font-bold">{totalAlbums}</p>
                </div>
                <div className="bg-gray-900/60 border border-gray-700 rounded-xl px-4 py-2">
                  <span className="text-gray-400 text-xs">Active</span>
                  <p className="text-green-400 text-lg font-bold">{activeAlbums}</p>
                </div>
                <div className="bg-gray-900/60 border border-gray-700 rounded-xl px-4 py-2">
                  <span className="text-gray-400 text-xs">Hidden</span>
                  <p className="text-red-400 text-lg font-bold">{hiddenAlbums}</p>
                </div>
              </div>
            </div>

            {/* Folders grid */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
              {loading && albums.length === 0 ? (
                <div className="flex justify-center items-center py-20">
                  <div className="text-white text-lg">Loading folders...</div>
                </div>
              ) : albums.length === 0 ? (
                <div className="text-center py-20">
                  <FiFolder className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <div className="text-gray-400 text-lg mb-6">No folders yet</div>
                  <button
                    onClick={openCreate}
                    className="flex items-center space-x-2 mx-auto px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition duration-200"
                  >
                    <FiPlus className="w-4 h-4" />
                    <span>Create Your First Folder</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {albums.map((album) => {
                    const cover = album.images && album.images.length > 0 ? album.images[0].imageUrl : null
                    const count = album.images ? album.images.length : 0
                    return (
                      <div
                        key={album._id}
                        className={`relative bg-gray-900 rounded-lg overflow-hidden transition-all duration-300 border-2 ${album.isActive ? 'border-transparent' : 'border-red-500/30'} hover:border-gray-600 hover:scale-105 hover:shadow-2xl group cursor-pointer`}
                        onClick={() => openFolder(album)}
                      >
                        <div className="relative aspect-[4/3] overflow-hidden bg-gray-800">
                          {cover ? (
                            <img src={cover} alt={album.title || 'Folder'} className="w-full h-full object-cover transition duration-300" />
                          ) : (
                            <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                              <FiFolder className="w-12 h-12 text-gray-500" />
                            </div>
                          )}

                          {!album.isActive && (
                            <div className="absolute top-2 left-2 bg-red-500/80 text-white text-xs px-2 py-0.5 rounded-full">Hidden</div>
                          )}

                          <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded-full flex items-center space-x-1">
                            <FiImage className="w-3 h-3" />
                            <span>{count}</span>
                          </div>

                          {/* Hover actions */}
                          <div
                            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center space-x-3"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => openFolder(album)}
                              className="p-2 text-white hover:text-purple-300 hover:bg-purple-500/20 rounded-lg transition duration-200"
                              title="Open"
                            >
                              <FiEye className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => toggleActive(album)}
                              className="p-2 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/20 rounded-lg transition duration-200"
                              title={album.isActive ? 'Hide' : 'Show'}
                            >
                              {album.isActive ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                            </button>
                            <button
                              onClick={() => showModal('confirmation', 'Delete this folder and all its images?', () => deleteAlbum(album._id))}
                              className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition duration-200"
                              title="Delete"
                            >
                              <FiTrash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>

                        <div className="p-3">
                          <h3 className="text-white text-sm font-semibold truncate mb-1">{album.title || 'Untitled'}</h3>
                          {album.titleMl && <p className="text-gray-400 text-xs truncate mb-1">{album.titleMl}</p>}
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-purple-400">{count} photo{count !== 1 ? 's' : ''}</span>
                            <div className="flex items-center space-x-1 text-xs text-gray-400">
                              <HiCalendar className="w-3 h-3" />
                              <span>{new Date(album.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* ─── DETAIL VIEW ───────────────────────────────── */}
        {view === 'detail' && openAlbum && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <button
              onClick={() => { setView('list'); setOpenAlbum(null) }}
              className="flex items-center space-x-2 text-gray-400 hover:text-white transition mb-5"
            >
              <FiArrowLeft className="w-5 h-5" />
              <span>Back to folders</span>
            </button>

            {/* Folder header: title + description on top */}
            <div className="bg-gray-900/60 border border-gray-700 rounded-2xl p-6 mb-6">
              <div className="flex justify-between items-start gap-4">
                <div className="min-w-0">
                  <h1 className="text-white text-3xl font-bold mb-1 break-words" style={{ fontFamily: 'Archivo Black' }}>
                    {openAlbum.title || 'Untitled'}
                  </h1>
                  {openAlbum.titleMl && <p className="text-purple-300 text-base mb-2">{openAlbum.titleMl}</p>}
                  {openAlbum.description && <p className="text-gray-400 text-sm whitespace-pre-line">{openAlbum.description}</p>}
                  <p className="text-gray-500 text-xs mt-3">
                    {openAlbum.images ? openAlbum.images.length : 0} photo{(openAlbum.images && openAlbum.images.length !== 1) ? 's' : ''}
                    {!openAlbum.isActive && <span className="ml-2 text-red-400">• Hidden</span>}
                  </p>
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    onClick={openAddImages}
                    className="flex items-center space-x-1 px-4 py-2 text-white text-sm rounded-xl transition"
                    style={{ background: 'linear-gradient(90.05deg, #AC28DC 6.68%, #7E1EB7 49.26%, #501392 91.85%)' }}
                  >
                    <FiPlus className="w-4 h-4" />
                    <span>Add Images</span>
                  </button>
                  <button
                    onClick={openEdit}
                    className="p-2 text-purple-400 hover:text-purple-300 hover:bg-purple-500/20 rounded-lg transition"
                    title="Edit folder"
                  >
                    <FiEdit3 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => showModal('confirmation', 'Delete this folder and all its images?', () => deleteAlbum(openAlbum._id))}
                    className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition"
                    title="Delete folder"
                  >
                    <FiTrash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Images grid (below description) */}
            {(!openAlbum.images || openAlbum.images.length === 0) ? (
              <div className="text-center py-16">
                <FiImage className="w-14 h-14 text-gray-600 mx-auto mb-3" />
                <div className="text-gray-400 mb-5">No images in this folder yet</div>
                <button
                  onClick={openAddImages}
                  className="flex items-center space-x-2 mx-auto px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition"
                >
                  <FiPlus className="w-4 h-4" />
                  <span>Add Images</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {openAlbum.images.map((img) => (
                  <div key={img._id} className="relative group rounded-xl overflow-hidden border border-gray-700 aspect-square bg-gray-800">
                    <img src={img.imageUrl} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        onClick={() => showModal('confirmation', 'Remove this image?', () => deleteImage(openAlbum._id, img._id))}
                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition"
                        title="Remove image"
                      >
                        <FiTrash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── CREATE FOLDER MODAL ───────────────────────── */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-md flex items-center justify-center z-[10000] p-4 overflow-y-auto">
            <div className="bg-gray-900/80 backdrop-blur-lg rounded-2xl p-6 lg:p-8 w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto shadow-2xl border border-gray-600/50 scrollbar-hide my-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'Archivo Black' }}>New Folder</h2>
                <button onClick={resetForm} className="text-gray-400 hover:text-white transition"><FiX className="w-6 h-6" /></button>
              </div>
              <form onSubmit={createAlbum} className="space-y-4">
                <div>
                  <label className="block text-white text-sm font-semibold mb-2" style={{ fontFamily: 'Archivo Black' }}>Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Annual Day 2026"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-white text-sm font-semibold mb-2" style={{ fontFamily: 'Archivo Black' }}>Title (Malayalam)</label>
                  <input
                    type="text"
                    value={formData.titleMl}
                    onChange={(e) => setFormData({ ...formData, titleMl: e.target.value })}
                    placeholder="മലയാളം ടൈറ്റിൽ"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-white text-sm font-semibold mb-2" style={{ fontFamily: 'Archivo Black' }}>Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Shown at the top when the folder is opened..."
                    rows={3}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-400 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-white text-sm font-semibold mb-2" style={{ fontFamily: 'Archivo Black' }}>Sort Order</label>
                  <input
                    type="number"
                    value={formData.sortOrder}
                    onChange={(e) => { const v = e.target.value; setFormData({ ...formData, sortOrder: v === '' ? v : parseInt(v) || 0 }) }}
                    min="0"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-white text-sm font-semibold mb-2" style={{ fontFamily: 'Archivo Black' }}>Images *</label>
                  {filePicker}
                </div>
                <button
                  type="submit"
                  disabled={uploading}
                  className="w-full py-3 rounded-2xl text-white font-bold transition disabled:opacity-50"
                  style={{ background: 'linear-gradient(90.05deg, #AC28DC 6.68%, #7E1EB7 49.26%, #501392 91.85%)', fontFamily: 'Fredoka One' }}
                >
                  {uploading ? 'Uploading...' : `Create Folder${files.length ? ` (${files.length})` : ''}`}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ─── EDIT FOLDER MODAL ─────────────────────────── */}
        {showEdit && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-md flex items-center justify-center z-[10000] p-4 overflow-y-auto">
            <div className="bg-gray-900/80 backdrop-blur-lg rounded-2xl p-6 lg:p-8 w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto shadow-2xl border border-gray-600/50 scrollbar-hide my-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'Archivo Black' }}>Edit Folder</h2>
                <button onClick={resetForm} className="text-gray-400 hover:text-white transition"><FiX className="w-6 h-6" /></button>
              </div>
              <form onSubmit={updateAlbum} className="space-y-4">
                <div>
                  <label className="block text-white text-sm font-semibold mb-2" style={{ fontFamily: 'Archivo Black' }}>Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-white text-sm font-semibold mb-2" style={{ fontFamily: 'Archivo Black' }}>Title (Malayalam)</label>
                  <input
                    type="text"
                    value={formData.titleMl}
                    onChange={(e) => setFormData({ ...formData, titleMl: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-white text-sm font-semibold mb-2" style={{ fontFamily: 'Archivo Black' }}>Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-400 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-white text-sm font-semibold mb-2" style={{ fontFamily: 'Archivo Black' }}>Sort Order</label>
                  <input
                    type="number"
                    value={formData.sortOrder}
                    onChange={(e) => { const v = e.target.value; setFormData({ ...formData, sortOrder: v === '' ? v : parseInt(v) || 0 }) }}
                    min="0"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div className="flex items-center space-x-3">
                  <label className="text-white text-sm font-semibold" style={{ fontFamily: 'Archivo Black' }}>Active</label>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                    className={`w-12 h-6 rounded-full transition-colors duration-200 ${formData.isActive ? 'bg-purple-600' : 'bg-gray-600'}`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white transition-transform duration-200 ${formData.isActive ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={uploading}
                  className="w-full py-3 rounded-2xl text-white font-bold transition disabled:opacity-50"
                  style={{ background: 'linear-gradient(90.05deg, #AC28DC 6.68%, #7E1EB7 49.26%, #501392 91.85%)', fontFamily: 'Fredoka One' }}
                >
                  {uploading ? 'Saving...' : 'Update Folder'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ─── ADD IMAGES MODAL ──────────────────────────── */}
        {showAddImages && openAlbum && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-md flex items-center justify-center z-[10000] p-4 overflow-y-auto">
            <div className="bg-gray-900/80 backdrop-blur-lg rounded-2xl p-6 lg:p-8 w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto shadow-2xl border border-gray-600/50 scrollbar-hide my-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'Archivo Black' }}>Add Images</h2>
                <button onClick={resetForm} className="text-gray-400 hover:text-white transition"><FiX className="w-6 h-6" /></button>
              </div>
              <p className="text-gray-400 text-sm mb-4">Adding to <span className="text-purple-300">{openAlbum.title}</span></p>
              <form onSubmit={addImages} className="space-y-4">
                {filePicker}
                <button
                  type="submit"
                  disabled={uploading}
                  className="w-full py-3 rounded-2xl text-white font-bold transition disabled:opacity-50"
                  style={{ background: 'linear-gradient(90.05deg, #AC28DC 6.68%, #7E1EB7 49.26%, #501392 91.85%)', fontFamily: 'Fredoka One' }}
                >
                  {uploading ? 'Uploading...' : `Add ${files.length || ''} Image${files.length !== 1 ? 's' : ''}`}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Success/Error Modal */}
        <SuccessModal
          isOpen={modal.isOpen}
          type={modal.type}
          message={modal.message}
          onClose={closeModal}
          onConfirm={modal.onConfirm}
        />
      </div>
    </div>
  )
}

export default Gallery
