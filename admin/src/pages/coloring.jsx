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
  FiEyeOff
} from 'react-icons/fi'
import { HiCalendar } from 'react-icons/hi'
import gradient from '../assets/gradiantRight.png'

const CATEGORIES = ['mosque', 'nature', 'calligraphy', 'animals', 'ramadan', 'patterns', 'characters', 'general']
const DIFFICULTIES = ['easy', 'medium', 'hard']

function Coloring() {
  // State management
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState({ isOpen: false, type: 'success', message: '', onConfirm: null })
  const [showForm, setShowForm] = useState(false)
  const [editingImage, setEditingImage] = useState(null)
  const [filterCategory, setFilterCategory] = useState('')
  const [imagePreview, setImagePreview] = useState(null)
  const [thumbnailPreview, setThumbnailPreview] = useState(null)
  
  // Form data
  const [formData, setFormData] = useState({
    title: '',
    titleMl: '',
    category: 'general',
    difficulty: 'easy',
    sortOrder: 0,
    tags: '',
    imageUrl: '',
    thumbnailUrl: '',
    isActive: true,
    imageFile: null,
    thumbnailFile: null,
  })

  // API Base URL
  const API_BASE = import.meta.env.VITE_API_BASE_URL

  // Show / close modal
  const showModal = (type, message, onConfirm = null) => {
    setModal({ isOpen: true, type, message, onConfirm })
  }
  const closeModal = () => {
    setModal({ isOpen: false, type: 'success', message: '', onConfirm: null })
  }

  // ─── Fetch ──────────────────────────────────────────────
  const fetchImages = async () => {
    setLoading(true)
    try {
      let url = `${API_BASE}/coloring?active=all`
      if (filterCategory) url += `&category=${filterCategory}`
      const response = await fetch(url)
      const data = await response.json()
      if (data.success) {
        setImages(data.data.images || [])
      } else {
        showModal('error', 'Failed to fetch coloring images')
      }
    } catch (error) {
      showModal('error', 'Error fetching coloring images')
    } finally {
      setLoading(false)
    }
  }

  // ─── Reset ─────────────────────────────────────────────
  const resetForm = () => {
    setFormData({
      title: '',
      titleMl: '',
      category: 'general',
      difficulty: 'easy',
      sortOrder: 0,
      tags: '',
      imageUrl: '',
      thumbnailUrl: '',
      isActive: true,
      imageFile: null,
      thumbnailFile: null,
    })
    setEditingImage(null)
    setImagePreview(null)
    setThumbnailPreview(null)
    setShowForm(false)
  }

  // ─── Create ────────────────────────────────────────────
  const createImage = async (e) => {
    e.preventDefault()
    if (!formData.title || !formData.category) {
      showModal('error', 'Title and category are required.')
      return
    }
    if (!formData.imageFile && !formData.imageUrl) {
      showModal('error', 'Please upload an image or provide a URL.')
      return
    }
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('title', formData.title)
      fd.append('titleMl', formData.titleMl)
      fd.append('category', formData.category)
      fd.append('difficulty', formData.difficulty)
      fd.append('sortOrder', formData.sortOrder)
      fd.append('tags', formData.tags)

      if (formData.imageFile) {
        fd.append('image', formData.imageFile)
      } else if (formData.imageUrl) {
        fd.append('imageUrl', formData.imageUrl)
      }

      if (formData.thumbnailFile) {
        fd.append('thumbnail', formData.thumbnailFile)
      } else if (formData.thumbnailUrl) {
        fd.append('thumbnailUrl', formData.thumbnailUrl)
      }

      const response = await fetch(`${API_BASE}/coloring`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: fd
      })
      const data = await response.json()
      if (data.success) {
        showModal('success', 'Coloring image created successfully!')
        resetForm()
        fetchImages()
      } else {
        showModal('error', data.message || 'Failed to create coloring image')
      }
    } catch (error) {
      showModal('error', 'Error creating coloring image')
    } finally {
      setLoading(false)
    }
  }

  // ─── Update ────────────────────────────────────────────
  const updateImage = async (e) => {
    e.preventDefault()
    if (!editingImage) return
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('title', formData.title)
      fd.append('titleMl', formData.titleMl)
      fd.append('category', formData.category)
      fd.append('difficulty', formData.difficulty)
      fd.append('sortOrder', formData.sortOrder)
      fd.append('tags', formData.tags)
      fd.append('isActive', formData.isActive)

      if (formData.imageFile) {
        fd.append('image', formData.imageFile)
      } else if (formData.imageUrl) {
        fd.append('imageUrl', formData.imageUrl)
      }

      if (formData.thumbnailFile) {
        fd.append('thumbnail', formData.thumbnailFile)
      } else if (formData.thumbnailUrl) {
        fd.append('thumbnailUrl', formData.thumbnailUrl)
      }

      const response = await fetch(`${API_BASE}/coloring/${editingImage._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: fd
      })
      const data = await response.json()
      if (data.success) {
        showModal('success', 'Coloring image updated successfully!')
        resetForm()
        fetchImages()
      } else {
        showModal('error', data.message || 'Failed to update coloring image')
      }
    } catch (error) {
      showModal('error', 'Error updating coloring image')
    } finally {
      setLoading(false)
    }
  }

  // ─── Delete ────────────────────────────────────────────
  const deleteImage = async (id) => {
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/coloring/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      })
      const data = await response.json()
      if (data.success) {
        showModal('success', 'Coloring image deleted successfully!')
        fetchImages()
      } else {
        showModal('error', data.message || 'Failed to delete')
      }
    } catch (error) {
      showModal('error', 'Error deleting coloring image')
    } finally {
      setLoading(false)
    }
  }

  // ─── Toggle Active ────────────────────────────────────
  const toggleActive = async (img) => {
    try {
      const fd = new FormData()
      fd.append('isActive', !img.isActive)
      const response = await fetch(`${API_BASE}/coloring/${img._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: fd
      })
      const data = await response.json()
      if (data.success) fetchImages()
    } catch (_) {}
  }

  // ─── Edit handler ──────────────────────────────────────
  const editImage = (img) => {
    setEditingImage(img)
    setFormData({
      title: img.title || '',
      titleMl: img.titleMl || '',
      category: img.category || 'general',
      difficulty: img.difficulty || 'easy',
      sortOrder: img.sortOrder || 0,
      tags: (img.tags || []).join(', '),
      imageUrl: img.imageUrl || '',
      thumbnailUrl: img.thumbnailUrl || '',
      isActive: img.isActive !== false,
      imageFile: null,
      thumbnailFile: null,
    })
    setImagePreview(img.imageUrl || null)
    setThumbnailPreview(img.thumbnailUrl || null)
    setShowForm(true)
  }

  // Handle file selection with preview
  const handleFileChange = (e, field) => {
    const file = e.target.files[0]
    if (!file) return
    setFormData({ ...formData, [field]: file })
    const reader = new FileReader()
    reader.onload = (ev) => {
      if (field === 'imageFile') setImagePreview(ev.target.result)
      else setThumbnailPreview(ev.target.result)
    }
    reader.readAsDataURL(file)
  }

  useEffect(() => { fetchImages() }, [filterCategory])

  // Difficulty badge color
  const diffColor = (d) => {
    if (d === 'easy') return 'bg-green-500/20 text-green-400'
    if (d === 'medium') return 'bg-yellow-500/20 text-yellow-400'
    return 'bg-red-500/20 text-red-400'
  }

  return (
    <div className="min-h-screen bg-black flex">
      <Sidebar />
      <div className="flex-1 ml-64">
        {/* Page Header */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1
                className="text-white text-5xl font-bold mb-1 relative"
                style={{ fontFamily: 'Archivo Black' }}
              >
                Painting & Coloring
                <div
                  className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 h-0.5 w-48"
                  style={{
                    background: 'linear-gradient(90.05deg, #AC28DC 6.68%, #7E1EB7 49.26%, #501392 91.85%)'
                  }}
                ></div>
              </h1>
              <p className="text-gray-400 text-sm mt-3">Manage coloring book images for the kids painting feature</p>
            </div>
            <div className="flex items-center space-x-3">
              {/* Category filter */}
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-4 py-2 bg-gray-800 border border-gray-600 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">All Categories</option>
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
              <button
                onClick={() => { resetForm(); setShowForm(true) }}
                className="flex items-center justify-center space-x-2 text-white transition duration-200"
                style={{
                  background: 'linear-gradient(90.05deg, #AC28DC 6.68%, #7E1EB7 49.26%, #501392 91.85%)',
                  width: '180px',
                  height: '36px',
                  borderRadius: '18px',
                  fontFamily: 'Fredoka One',
                  fontWeight: '400',
                  fontSize: '14px',
                  lineHeight: '100%',
                  letterSpacing: '0%',
                  textAlign: 'center'
                }}
              >
                <FiPlus className="w-3 h-3" />
                <span>Add Image</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
          <div className="flex space-x-4">
            <div className="bg-gray-900/60 border border-gray-700 rounded-xl px-4 py-2">
              <span className="text-gray-400 text-xs">Total</span>
              <p className="text-white text-lg font-bold">{images.length}</p>
            </div>
            <div className="bg-gray-900/60 border border-gray-700 rounded-xl px-4 py-2">
              <span className="text-gray-400 text-xs">Active</span>
              <p className="text-green-400 text-lg font-bold">{images.filter(i => i.isActive).length}</p>
            </div>
            <div className="bg-gray-900/60 border border-gray-700 rounded-xl px-4 py-2">
              <span className="text-gray-400 text-xs">Hidden</span>
              <p className="text-red-400 text-lg font-bold">{images.filter(i => !i.isActive).length}</p>
            </div>
          </div>
        </div>

        {/* Images Grid */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          {loading && images.length === 0 ? (
            <div className="flex justify-center items-center py-20">
              <div className="text-white text-lg">Loading coloring images...</div>
            </div>
          ) : images.length === 0 ? (
            <div className="text-center py-20">
              <FiImage className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <div className="text-gray-400 text-lg mb-6">No coloring images found</div>
              <button
                onClick={() => { resetForm(); setShowForm(true) }}
                className="flex items-center space-x-2 mx-auto px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition duration-200"
              >
                <FiPlus className="w-4 h-4" />
                <span>Add Your First Image</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {images.map((img) => (
                <div
                  key={img._id}
                  className={`relative bg-gray-900 rounded-lg overflow-hidden transition-all duration-300 border-2 ${img.isActive ? 'border-transparent' : 'border-red-500/30'} hover:border-gray-600 hover:scale-105 hover:shadow-2xl group`}
                >
                  {/* Image */}
                  <div className="relative aspect-square overflow-hidden bg-white">
                    {img.imageUrl ? (
                      <img
                        src={img.thumbnailUrl || img.imageUrl}
                        alt={img.title || 'Coloring image'}
                        className="w-full h-full object-contain p-2 transition duration-300"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                        <FiImage className="w-12 h-12 text-gray-500" />
                      </div>
                    )}

                    {/* Inactive overlay */}
                    {!img.isActive && (
                      <div className="absolute top-2 left-2 bg-red-500/80 text-white text-xs px-2 py-0.5 rounded-full">
                        Hidden
                      </div>
                    )}

                    {/* Difficulty badge */}
                    <div className={`absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full ${diffColor(img.difficulty)}`}>
                      {img.difficulty}
                    </div>

                    {/* Hover actions */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center space-x-3">
                      <button
                        onClick={() => editImage(img)}
                        className="p-2 text-purple-400 hover:text-purple-300 hover:bg-purple-500/20 rounded-lg transition duration-200"
                        title="Edit"
                      >
                        <FiEdit3 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => toggleActive(img)}
                        className="p-2 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/20 rounded-lg transition duration-200"
                        title={img.isActive ? 'Hide' : 'Show'}
                      >
                        {img.isActive ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                      </button>
                      <button
                        onClick={() => showModal('confirmation', 'Are you sure you want to delete this image?', () => deleteImage(img._id))}
                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition duration-200"
                        title="Delete"
                      >
                        <FiTrash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    <h3 className="text-white text-sm font-semibold truncate mb-1">
                      {img.title || 'Untitled'}
                    </h3>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-purple-400 capitalize">{img.category}</span>
                      <div className="flex items-center space-x-1 text-xs text-gray-400">
                        <HiCalendar className="w-3 h-3" />
                        <span>
                          {new Date(img.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric'
                          })}
                        </span>
                      </div>
                    </div>
                    {img.tags && img.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {img.tags.slice(0, 3).map((tag, i) => (
                          <span key={i} className="text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">
                            {tag}
                          </span>
                        ))}
                        {img.tags.length > 3 && (
                          <span className="text-[10px] text-gray-500">+{img.tags.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─── Form Modal ─────────────────────────────────── */}
        {showForm && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-md flex items-center justify-center z-[10000] p-4 overflow-y-auto">
            <div className="bg-gray-900/80 backdrop-blur-lg rounded-2xl p-4 sm:p-6 lg:p-8 w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto shadow-2xl border border-gray-600/50 scrollbar-hide scroll-smooth my-auto">
              <div className="flex justify-between items-center mb-4 sm:mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-white" style={{ fontFamily: 'Archivo Black' }}>
                  {editingImage ? 'Edit Coloring Image' : 'Add New Coloring Image'}
                </h2>
                <button
                  onClick={resetForm}
                  className="text-gray-400 hover:text-white transition duration-200"
                >
                  <FiX className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={editingImage ? updateImage : createImage} className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-white text-sm font-semibold mb-2" style={{ fontFamily: 'Archivo Black' }}>
                    Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Beautiful Mosque"
                    required
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200 placeholder-gray-400"
                  />
                </div>

                {/* Title ML */}
                <div>
                  <label className="block text-white text-sm font-semibold mb-2" style={{ fontFamily: 'Archivo Black' }}>
                    Title (Malayalam)
                  </label>
                  <input
                    type="text"
                    value={formData.titleMl}
                    onChange={(e) => setFormData({ ...formData, titleMl: e.target.value })}
                    placeholder="മലയാളം ടൈറ്റിൽ"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200 placeholder-gray-400"
                  />
                </div>

                {/* Category & Difficulty row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white text-sm font-semibold mb-2" style={{ fontFamily: 'Archivo Black' }}>
                      Category *
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {CATEGORIES.map(c => (
                        <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-white text-sm font-semibold mb-2" style={{ fontFamily: 'Archivo Black' }}>
                      Difficulty
                    </label>
                    <select
                      value={formData.difficulty}
                      onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {DIFFICULTIES.map(d => (
                        <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Sort Order & Active row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white text-sm font-semibold mb-2" style={{ fontFamily: 'Archivo Black' }}>
                      Sort Order
                    </label>
                    <input
                      type="number"
                      value={formData.sortOrder}
                      onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  {editingImage && (
                    <div className="flex items-end pb-1">
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.isActive}
                          onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                          className="w-5 h-5 rounded border-gray-600 bg-gray-800 text-purple-500 focus:ring-purple-500"
                        />
                        <span className="text-white text-sm font-semibold">Active</span>
                      </label>
                    </div>
                  )}
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-white text-sm font-semibold mb-2" style={{ fontFamily: 'Archivo Black' }}>
                    Tags
                  </label>
                  <input
                    type="text"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    placeholder="islamic, mosque, kids (comma separated)"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200 placeholder-gray-400"
                  />
                </div>

                {/* Image Upload */}
                <div>
                  <label className="block text-white text-sm font-semibold mb-2" style={{ fontFamily: 'Archivo Black' }}>
                    Coloring Image *
                  </label>
                  
                  {imagePreview && (
                    <div className="mb-3 bg-white rounded-lg p-2 inline-block">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="max-w-full max-h-40 object-contain rounded"
                      />
                    </div>
                  )}

                  <div className="mb-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, 'imageFile')}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-purple-500 file:text-white hover:file:bg-purple-600"
                    />
                    <p className="text-gray-400 text-xs mt-1">Upload file or enter URL below</p>
                  </div>

                  <input
                    type="url"
                    value={formData.imageUrl}
                    onChange={(e) => {
                      setFormData({ ...formData, imageUrl: e.target.value, imageFile: null })
                      setImagePreview(e.target.value || null)
                    }}
                    placeholder="Or paste image URL"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200 placeholder-gray-400"
                  />
                </div>

                {/* Thumbnail Upload */}
                <div>
                  <label className="block text-white text-sm font-semibold mb-2" style={{ fontFamily: 'Archivo Black' }}>
                    Thumbnail (optional)
                  </label>

                  {thumbnailPreview && (
                    <div className="mb-3 bg-white rounded-lg p-2 inline-block">
                      <img
                        src={thumbnailPreview}
                        alt="Thumbnail preview"
                        className="max-w-full max-h-24 object-contain rounded"
                      />
                    </div>
                  )}

                  <div className="mb-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, 'thumbnailFile')}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-purple-500 file:text-white hover:file:bg-purple-600"
                    />
                  </div>

                  <input
                    type="url"
                    value={formData.thumbnailUrl}
                    onChange={(e) => {
                      setFormData({ ...formData, thumbnailUrl: e.target.value, thumbnailFile: null })
                      setThumbnailPreview(e.target.value || null)
                    }}
                    placeholder="Or paste thumbnail URL"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200 placeholder-gray-400"
                  />
                </div>

                {/* Submit Buttons */}
                <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex items-center justify-center space-x-2 text-white transition duration-200 w-full sm:w-[140px] min-h-[36px] rounded-[18px]"
                    style={{
                      background: 'linear-gradient(90.05deg, #374151 6.68%, #4B5563 49.26%, #6B7280 91.85%)',
                      fontFamily: 'Fredoka One',
                      fontWeight: '400',
                      fontSize: '14px',
                      lineHeight: '100%',
                      letterSpacing: '0%',
                      textAlign: 'center'
                    }}
                  >
                    <span>Cancel</span>
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center justify-center space-x-2 text-white transition duration-200 disabled:opacity-50 w-full sm:w-[160px] min-h-[36px] rounded-[18px]"
                    style={{
                      background: 'linear-gradient(90.05deg, #AC28DC 6.68%, #7E1EB7 49.26%, #501392 91.85%)',
                      fontFamily: 'Fredoka One',
                      fontWeight: '400',
                      fontSize: '14px',
                      lineHeight: '100%',
                      letterSpacing: '0%',
                      textAlign: 'center'
                    }}
                  >
                    <FiPlus className="w-3 h-3" />
                    <span>{loading ? (editingImage ? 'Updating...' : 'Creating...') : (editingImage ? 'Update' : 'Create')}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Gradient Background */}
        <div className="fixed -bottom-80 right-0 z-10 pointer-events-none">
          <img
            src={gradient}
            alt="Gradient"
            className="w-[800px] h-[800px] opacity-60"
          />
        </div>

        {/* Status Modal */}
        <SuccessModal
          isOpen={modal.isOpen}
          onClose={closeModal}
          type={modal.type}
          message={modal.message}
          onConfirm={modal.onConfirm}
        />
      </div>
    </div>
  )
}

export default Coloring
