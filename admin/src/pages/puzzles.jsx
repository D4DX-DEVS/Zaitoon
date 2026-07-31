import React, { useState, useEffect, useMemo } from 'react'
import { FiPlus, FiTrash2, FiEdit3, FiImage, FiAlertCircle, FiCheckCircle, FiX } from 'react-icons/fi'
import Sidebar from '../components/Sidebar'
import SuccessModal from '../components/SuccessModal'
import SchedulePicker from '../components/SchedulePicker'
import gradient from '../assets/gradiantRight.png'

function Puzzles() {
  const [puzzles, setPuzzles] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalPuzzles, setTotalPuzzles] = useState(0)
  const ITEMS_PER_PAGE = 9
  const [editingPuzzle, setEditingPuzzle] = useState(null)
  const [imagefilePreview, setImagefilePreview] = useState('')
  const [modal, setModal] = useState({ isOpen: false, type: 'success', message: '', onConfirm: null })
  const [formData, setFormData] = useState({
    difficulty: 'easy',
    isActive: 'true',
    translations: {
      en: { title: '', description: '', explanation: '' },
      ml: { title: '', description: '', explanation: '' },
      hi: { title: '', description: '', explanation: '' },
      ur: { title: '', description: '', explanation: '' }
    },
    imageUrl: '',
    imagefileFile: null
  })

  const API_BASE = import.meta.env.VITE_API_BASE_URL

  // Schedule state
  const [scheduleEnabled, setScheduleEnabled] = useState(false)
  const [scheduledAt, setScheduledAt] = useState('')

  const showModal = (type, message, onConfirm = null) => {
    setModal({ isOpen: true, type, message, onConfirm })
  }

  const closeModal = () => {
    setModal({ isOpen: false, type: 'success', message: '', onConfirm: null })
  }

  const resetForm = () => {
    setEditingPuzzle(null)
    setFormData({
      difficulty: 'easy',
      isActive: 'true',
      translations: {
        en: { title: '', description: '', explanation: '' },
        ml: { title: '', description: '', explanation: '' },
        hi: { title: '', description: '', explanation: '' },
        ur: { title: '', description: '', explanation: '' }
      },
      imageUrl: '',
      imagefileFile: null
    })
    setImagefilePreview('')
    setShowForm(false)
    setScheduleEnabled(false)
    setScheduledAt('')
  }

  const fetchPuzzles = async (page = 1) => {
    console.log('[Puzzles] Fetching puzzles', { page })
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/puzzles?page=${page}&limit=${ITEMS_PER_PAGE}`)
      const result = await response.json()
      console.log('[Puzzles] Fetch response', result)
      if (result.success) {
        setPuzzles(result.data?.puzzles || [])
        const pagination = result.data?.pagination
        if (pagination) {
          setCurrentPage(pagination.currentPage)
          setTotalPages(pagination.totalPages)
          setTotalPuzzles(pagination.totalPuzzles)
        }
      } else {
        showModal('error', result.message || 'Failed to fetch puzzles')
      }
    } catch (error) {
      console.error('[Puzzles] Fetch error', error)
      showModal('error', 'Error fetching puzzles')
    } finally {
      setLoading(false)
    }
  }

  const handleImagefileChange = (event) => {
    const file = event.target.files?.[0]
    if (file) {
      setFormData((prev) => ({ ...prev, imagefileFile: file }))
      const previewUrl = URL.createObjectURL(file)
      setImagefilePreview(previewUrl)
    }
  }

  const updateTranslationField = (lang, field, value) => {
    setFormData((prev) => ({
      ...prev,
      translations: {
        ...prev.translations,
        [lang]: {
          ...prev.translations[lang],
          [field]: value
        }
      }
    }))
  }

  const serializeTranslations = () => {
    return JSON.stringify(formData.translations)
  }

  const buildPuzzleFormPayload = () => {
    const payload = new FormData()
    
    // imageUrl - only URL input (no file upload)
    if (formData.imageUrl) {
      payload.append('imageUrl', formData.imageUrl)
    }
    
    // imagefile - only file upload (no URL input)
    if (formData.imagefileFile) {
      payload.append('imagefile', formData.imagefileFile)
    }
    
    payload.append('difficulty', formData.difficulty)
    payload.append('isActive', formData.isActive)
    payload.append('translations', serializeTranslations())
    return payload
  }

  const createPuzzle = async (event) => {
    event.preventDefault()
    setLoading(true)

    try {
      // --- Scheduled upload flow ---
      if (scheduleEnabled) {
        if (!scheduledAt) {
          showModal('error', 'Please select a date and time to schedule this upload.')
          setLoading(false)
          return
        }
        let imagefileUrl = ''
        if (formData.imagefileFile) {
          const fd = new FormData()
          fd.append('file', formData.imagefileFile)
          const upRes = await fetch(`${API_BASE}/admin/upload-file`, { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }, body: fd })
          const upData = await upRes.json()
          if (!upData.success) throw new Error('Failed to upload puzzle image')
          imagefileUrl = upData.url
        }
        const schedRes = await fetch(`${API_BASE}/schedule`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('adminToken')}` },
          body: JSON.stringify({
            contentType: 'puzzle',
            title: formData.translations?.en?.title || 'Puzzle',
            thumbnailUrl: formData.imageUrl || imagefileUrl,
            contentData: {
              imageUrl: formData.imageUrl,
              imagefile: imagefileUrl,
              difficulty: formData.difficulty,
              isActive: formData.isActive,
              translations: formData.translations
            },
            publishAt: scheduledAt
          })
        })
        const schedData = await schedRes.json()
        if (schedData.success) {
          showModal('success', `Puzzle scheduled for ${new Date(scheduledAt).toLocaleString()}`)
          resetForm()
        } else {
          showModal('error', schedData.message || 'Failed to schedule puzzle')
        }
        return
      }

      // --- Normal immediate upload flow ---
      console.log('[Puzzles] Creating puzzle', formData)
      const payload = buildPuzzleFormPayload()
      const response = await fetch(`${API_BASE}/puzzles`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('adminToken') || ''}`
        },
        body: payload
      })
      const result = await response.json()
      console.log('[Puzzles] Create response', result)
      if (result.success) {
        showModal('success', 'Puzzle created successfully!')
        resetForm()
        fetchPuzzles(1)
        setCurrentPage(1)
      } else {
        showModal('error', result.message || 'Failed to create puzzle')
      }
    } catch (error) {
      console.error('[Puzzles] Create error', error)
      showModal('error', 'Error creating puzzle')
    } finally {
      setLoading(false)
    }
  }

  const updatePuzzle = async (event) => {
    event.preventDefault()
    if (!editingPuzzle) return
    setLoading(true)
    console.log('[Puzzles] Updating puzzle', editingPuzzle._id, formData)
    try {
      const payload = buildPuzzleFormPayload()
      const response = await fetch(`${API_BASE}/puzzles/${editingPuzzle._id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('adminToken') || ''}`
        },
        body: payload
      })
      const result = await response.json()
      console.log('[Puzzles] Update response', result)
      if (result.success) {
        showModal('success', 'Puzzle updated successfully!')
        resetForm()
        fetchPuzzles(currentPage)
      } else {
        showModal('error', result.message || 'Failed to update puzzle')
      }
    } catch (error) {
      console.error('[Puzzles] Update error', error)
      showModal('error', 'Error updating puzzle')
    } finally {
      setLoading(false)
    }
  }

  const prepareEditPuzzle = (puzzle) => {
    setEditingPuzzle(puzzle)
    setFormData({
      difficulty: puzzle.difficulty || 'easy',
      isActive: puzzle.isActive || 'true',
      translations: {
        en: {
          title: puzzle.translations?.en?.title || '',
          description: puzzle.translations?.en?.description || '',
          explanation: puzzle.translations?.en?.explanation || ''
        },
        ml: {
          title: puzzle.translations?.ml?.title || '',
          description: puzzle.translations?.ml?.description || '',
          explanation: puzzle.translations?.ml?.explanation || ''
        },
        hi: {
          title: puzzle.translations?.hi?.title || '',
          description: puzzle.translations?.hi?.description || '',
          explanation: puzzle.translations?.hi?.explanation || ''
        },
        ur: {
          title: puzzle.translations?.ur?.title || '',
          description: puzzle.translations?.ur?.description || '',
          explanation: puzzle.translations?.ur?.explanation || ''
        }
      },
      imageUrl: puzzle.imageUrl || '',
      imagefileFile: null
    })
    setImagefilePreview(puzzle.imagefile || '')
    setShowForm(true)
  }

  const deletePuzzle = async (puzzleId) => {
    console.log('[Puzzles] Deleting puzzle', puzzleId)
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/puzzles/${puzzleId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('adminToken') || ''}`
        }
      })
      const result = await response.json()
      console.log('[Puzzles] Delete response', result)
      if (result.success) {
        showModal('success', 'Puzzle deleted successfully!')
        const newPage = puzzles.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage
        fetchPuzzles(newPage)
        setCurrentPage(newPage)
      } else {
        showModal('error', result.message || 'Failed to delete puzzle')
      }
    } catch (error) {
      console.error('[Puzzles] Delete error', error)
      showModal('error', 'Error deleting puzzle')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPuzzles(currentPage)
  }, [currentPage])

  return (
    <div className="min-h-screen bg-black flex">
      <Sidebar />
      <div className="flex-1 ml-64 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 
                className="text-white text-5xl font-bold mb-1 relative"
                style={{ fontFamily: 'Archivo Black' }}
              >
                Puzzles
                <div 
                  className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 h-0.5 w-32"
                  style={{
                    background: 'linear-gradient(90.05deg, #AC28DC 6.68%, #7E1EB7 49.26%, #501392 91.85%)'
                  }}
                ></div>
              </h1>
              <p className="text-gray-400 mt-3">
                Manage puzzle library, translations, and CDN-backed media from one place.
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  resetForm()
                  setShowForm(true)
                }}
                className="flex items-center justify-center space-x-2 text-white transition duration-200"
                style={{
                  background: 'linear-gradient(90.05deg, #AC28DC 6.68%, #7E1EB7 49.26%, #501392 91.85%)',
                  width: '160px',
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
                <span>Add Puzzle</span>
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {loading && puzzles.length === 0 ? (
            <div className="flex justify-center items-center py-20">
              <div className="text-white text-lg">Loading puzzles...</div>
            </div>
          ) : puzzles.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-gray-400 text-lg mb-6">No puzzles found</div>
              <button
                onClick={() => {
                  resetForm()
                  setShowForm(true)
                }}
                className="flex items-center space-x-2 mx-auto px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition duration-200"
              >
                <FiPlus className="w-4 h-4" />
                <span>Add Your First Puzzle</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-6">
              {puzzles.map((puzzle) => (
                <div 
                  key={puzzle._id}
                  className="bg-gray-900/80 border border-gray-700/60 rounded-3xl overflow-hidden shadow-lg hover:shadow-purple-900/20 transition duration-300 flex flex-col"
                >
                  <div className="relative">
                    {puzzle.imageUrl || puzzle.imagefile ? (
                      <img 
                        src={puzzle.imageUrl || puzzle.imagefile} 
                        alt={puzzle.translations?.en?.title || 'Puzzle'} 
                        className="w-full h-52 object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none'
                          const placeholder = e.target.parentElement.querySelector('.image-placeholder')
                          if (placeholder) placeholder.style.display = 'flex'
                        }}
                      />
                    ) : null}
                    <div className={`w-full h-52 bg-gray-800 flex items-center justify-center ${puzzle.imageUrl || puzzle.imagefile ? 'hidden' : ''} image-placeholder`}>
                      <FiImage className="w-12 h-12 text-gray-500" />
                    </div>
                    <div className="absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-semibold bg-white/90 text-gray-900 uppercase tracking-wide">
                      {puzzle.difficulty}
                    </div>
                    <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${puzzle.isActive === 'true' ? 'bg-emerald-500/90 text-white' : 'bg-red-500/80 text-white'}`}>
                      {puzzle.isActive === 'true' ? 'Active' : 'Inactive'}
                    </div>
                  </div>

                  <div className="flex-1 p-5 space-y-4">
                    <div>
                      <h2 className="text-white text-xl font-bold mb-1" style={{ fontFamily: 'Archivo Black' }}>
                        {puzzle.translations?.en?.title || 'Untitled Puzzle'}
                      </h2>
                      <p className="text-gray-400 text-sm line-clamp-2">
                        {puzzle.translations?.en?.description || 'No description provided.'}
                      </p>
                    </div>

                    <div className="bg-gray-800/40 rounded-2xl p-3 space-y-2">
                      <p className="flex items-center text-sm text-purple-300 font-semibold">
                        <FiCheckCircle className="mr-2" /> Translations
                      </p>
                      <div className="grid grid-cols-4 gap-2">
                        {['en', 'ml', 'hi', 'ur'].map((lang) => (
                          <div key={lang} className="bg-gray-900/70 rounded-xl p-2">
                            <p className="text-gray-300 text-xs uppercase font-semibold">{lang}</p>
                            <p className="text-white text-sm font-medium truncate">
                              {puzzle.translations?.[lang]?.title || 'No title'}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="p-5 border-t border-gray-800/80 flex items-center justify-between">
                    <div className="text-gray-500 text-xs">
                      Updated {new Date(puzzle.updatedAt || puzzle.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => prepareEditPuzzle(puzzle)}
                        className="p-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 transition duration-200"
                        title="Edit puzzle"
                      >
                        <FiEdit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => showModal(
                          'confirmation',
                          'Are you sure you want to delete this puzzle? This action cannot be undone.',
                          () => deletePuzzle(puzzle._id)
                        )}
                        className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/30 text-red-300 transition duration-200"
                        title="Delete puzzle"
                      >
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
            <div className="flex items-center justify-between mt-6">
              <p className="text-gray-400 text-sm">
                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, totalPuzzles)} of {totalPuzzles} puzzles
              </p>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-2 py-1 rounded-lg text-xs font-medium text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition duration-200"
                >
                  «
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition duration-200"
                >
                  ‹
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .reduce((acc, p, idx, arr) => {
                    if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...')
                    acc.push(p)
                    return acc
                  }, [])
                  .map((item, idx) =>
                    item === '...' ? (
                      <span key={`ellipsis-${idx}`} className="px-2 py-1 text-gray-500 text-sm">…</span>
                    ) : (
                      <button
                        key={item}
                        onClick={() => setCurrentPage(item)}
                        className={`px-3 py-1 rounded-lg text-sm font-medium transition duration-200 ${
                          currentPage === item
                            ? 'text-white'
                            : 'text-gray-400 hover:text-white hover:bg-white/10'
                        }`}
                        style={currentPage === item ? {
                          background: 'linear-gradient(90.05deg, #AC28DC 6.68%, #7E1EB7 49.26%, #501392 91.85%)'
                        } : {}}
                      >
                        {item}
                      </button>
                    )
                  )
                }
                <button
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition duration-200"
                >
                  ›
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1 rounded-lg text-xs font-medium text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition duration-200"
                >
                  »
                </button>
              </div>
            </div>
          </div>
        )}

        {showForm && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-[10000] p-4">
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl border border-white/10 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'Archivo Black' }}>
                    {editingPuzzle ? 'Edit Puzzle' : 'Add New Puzzle'}
                  </h2>
                  <p className="text-gray-400 mt-1 text-xs flex items-center">
                    <FiAlertCircle className="mr-1" /> English copy is required; other translations are optional but recommended.
                  </p>
                </div>
                <button
                  onClick={resetForm}
                  className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition duration-200"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={editingPuzzle ? updatePuzzle : createPuzzle} className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white text-xs font-semibold mb-2 uppercase tracking-wide">
                      Difficulty *
                    </label>
                    <div className="flex gap-3">
                      {['easy', 'medium', 'hard'].map((level) => (
                        <label key={level} className="flex items-center cursor-pointer">
                          <input
                            type="radio"
                            name="difficulty"
                            value={level}
                            checked={formData.difficulty === level}
                            onChange={(e) => setFormData((prev) => ({ ...prev, difficulty: e.target.value }))}
                            className="sr-only"
                          />
                          <span className={`px-3 py-1.5 rounded-lg text-sm font-medium transition duration-200 ${
                            formData.difficulty === level
                              ? 'bg-purple-600 text-white'
                              : 'bg-white/5 text-gray-300 hover:bg-white/10'
                          }`}>
                            {level.charAt(0).toUpperCase() + level.slice(1)}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-white text-xs font-semibold mb-2 uppercase tracking-wide">
                      Status *
                    </label>
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, isActive: prev.isActive === 'true' ? 'false' : 'true' }))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          formData.isActive === 'true' ? 'bg-purple-600' : 'bg-gray-600'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            formData.isActive === 'true' ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                      <span className="ml-3 text-sm text-gray-300">
                        {formData.isActive === 'true' ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white text-xs font-semibold mb-2 uppercase tracking-wide">
                      Puzzle Image URL (imageUrl)
                    </label>
                    {formData.imageUrl && (
                      <div className="relative mb-2">
                        <img 
                          src={formData.imageUrl} 
                          alt="Puzzle preview" 
                          className="w-full h-40 object-cover rounded-xl border border-white/10"
                        />
                        <button
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, imageUrl: '' }))}
                          className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-600 text-white rounded-full p-1.5"
                          title="Clear URL"
                        >
                          <FiX className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    <input
                      type="url"
                      value={formData.imageUrl}
                      onChange={(e) => setFormData((prev) => ({ ...prev, imageUrl: e.target.value }))}
                      placeholder="Enter image CDN URL (optional)"
                      className="w-full h-10 px-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200 placeholder-gray-500"
                    />
                  </div>

                  <div>
                    <label className="block text-white text-xs font-semibold mb-2 uppercase tracking-wide">
                      Image File (imagefile)
                    </label>
                    {imagefilePreview ? (
                      <div className="relative mb-2">
                        <img 
                          src={imagefilePreview} 
                          alt="Imagefile preview" 
                          className="w-full h-40 object-cover rounded-xl border border-white/10"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setFormData((prev) => ({ ...prev, imagefileFile: null }))
                            setImagefilePreview('')
                          }}
                          className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-600 text-white rounded-full p-1.5"
                          title="Remove image"
                        >
                          <FiX className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-full h-40 bg-white/5 border border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center text-gray-400 mb-2">
                        <FiImage className="w-8 h-8 mb-2" />
                        <p className="text-xs text-center max-w-xs px-2">
                          Upload imagefile to CDN
                        </p>
                      </div>
                    )}

                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImagefileChange}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-purple-500 file:text-white hover:file:bg-purple-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {['en', 'ml', 'hi', 'ur'].map((lang) => {
                    const isRequired = lang === 'en'
                    return (
                      <div key={lang} className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-white text-sm font-semibold uppercase" style={{ fontFamily: 'Archivo Black' }}>
                            {lang}
                          </h3>
                          <span className="text-xs text-gray-400 uppercase">{isRequired ? 'Required' : 'Optional'}</span>
                        </div>

                        <div>
                          <label className="block text-white text-xs font-semibold mb-1.5">Title</label>
                          <input
                            type="text"
                            value={formData.translations[lang].title}
                            onChange={(e) => updateTranslationField(lang, 'title', e.target.value)}
                            required={isRequired}
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200"
                          />
                        </div>

                        <div>
                          <label className="block text-white text-xs font-semibold mb-1.5">Description</label>
                          <textarea
                            value={formData.translations[lang].description}
                            onChange={(e) => updateTranslationField(lang, 'description', e.target.value)}
                            required={isRequired}
                            rows={2}
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200 resize-none"
                          />
                        </div>

                        <div>
                          <label className="block text-white text-xs font-semibold mb-1.5">Explanation</label>
                          <textarea
                            value={formData.translations[lang].explanation}
                            onChange={(e) => updateTranslationField(lang, 'explanation', e.target.value)}
                            required={isRequired}
                            rows={3}
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200 resize-none"
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Schedule Upload — only for new puzzles */}
                {!editingPuzzle && (
                  <SchedulePicker
                    enabled={scheduleEnabled}
                    onToggle={setScheduleEnabled}
                    scheduledAt={scheduledAt}
                    onDateChange={setScheduledAt}
                  />
                )}

                <div className="flex justify-end space-x-3 pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex items-center justify-center space-x-2 text-white transition duration-200"
                    style={{
                      background: 'linear-gradient(90.05deg, #374151 6.68%, #4B5563 49.26%, #6B7280 91.85%)',
                      width: '120px',
                      height: '36px',
                      borderRadius: '18px',
                      fontFamily: 'Fredoka One',
                      fontWeight: '400',
                      fontSize: '13px',
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
                    className="flex items-center justify-center space-x-2 text-white transition duration-200 disabled:opacity-50"
                    style={{
                      background: 'linear-gradient(90.05deg, #AC28DC 6.68%, #7E1EB7 49.26%, #501392 91.85%)',
                      width: '140px',
                      height: '36px',
                      borderRadius: '18px',
                      fontFamily: 'Fredoka One',
                      fontWeight: '400',
                      fontSize: '13px',
                      lineHeight: '100%',
                      letterSpacing: '0%',
                      textAlign: 'center'
                    }}
                  >
                    <FiPlus className="w-3 h-3" />
                    <span>{loading ? 'Saving...' : editingPuzzle ? 'Update' : (scheduleEnabled ? 'Schedule' : 'Create')}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="fixed -bottom-80 right-0 z-10 pointer-events-none opacity-60">
          <img 
            src={gradient} 
            alt="Gradient" 
            className="w-[800px] h-[800px]"
          />
        </div>

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

export default Puzzles
