import React, { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import SuccessModal from '../components/SuccessModal'
import SchedulePicker from '../components/SchedulePicker'
import { 
  FiPlus, 
  FiX,
  FiEdit3,
  FiTrash2,
  FiImage
} from 'react-icons/fi'
import { HiCalendar } from 'react-icons/hi'
import gradient from '../assets/gradiantRight.png'

function Banners() {
  // State management
  const [banners, setBanners] = useState([])
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState({ isOpen: false, type: 'success', message: '', onConfirm: null })
  const [showForm, setShowForm] = useState(false)
  const [editingBanner, setEditingBanner] = useState(null)
  const [fileInputs, setFileInputs] = useState({})
  
  // Form data
  const [formData, setFormData] = useState({
    title: '',
    image: '',
    imageFile: null,
    pdf: '',
    pdfFile: null
  })

  // API Base URL
  const API_BASE = import.meta.env.VITE_API_BASE_URL

  // Schedule state
  const [scheduleEnabled, setScheduleEnabled] = useState(false)
  const [scheduledAt, setScheduledAt] = useState('')

  // Show modal
  const showModal = (type, message, onConfirm = null) => {
    setModal({ isOpen: true, type, message, onConfirm })
  }

  // Close modal
  const closeModal = () => {
    setModal({ isOpen: false, type: 'success', message: '', onConfirm: null })
  }

  // Fetch banners
  const fetchBanners = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/banners`)
      const data = await response.json()
      if (data.success) {
        setBanners(data.data.banners || [])
      } else {
        showModal('error', 'Failed to fetch banners')
      }
    } catch (error) {
      showModal('error', 'Error fetching banners')
    } finally {
      setLoading(false)
    }
  }

  // Reset form
  const resetForm = () => {
    setFormData({
      title: '',
      image: '',
      imageFile: null,
      pdf: '',
      pdfFile: null
    })
    setEditingBanner(null)
    setFileInputs({})
    setShowForm(false)
    setScheduleEnabled(false)
    setScheduledAt('')
  }

  // Create banner
  const createBanner = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      // --- Scheduled upload flow ---
      if (scheduleEnabled) {
        if (!scheduledAt) {
          showModal('error', 'Please select a date and time to schedule this upload.')
          setLoading(false)
          return
        }
        const hasImageFile = fileInputs.image?.files?.[0]
        const hasPdfFile = fileInputs.pdf?.files?.[0]
        if (!hasImageFile && !formData.image && !hasPdfFile && !formData.pdf) {
          showModal('error', 'Either an image or a PDF is required.')
          setLoading(false)
          return
        }
        let imageUrl = formData.image || ''
        let pdfUrl = formData.pdf || ''
        if (hasImageFile) {
          const fd = new FormData()
          fd.append('file', fileInputs.image.files[0])
          const upRes = await fetch(`${API_BASE}/admin/upload-file`, { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }, body: fd })
          const upData = await upRes.json()
          if (!upData.success) throw new Error('Failed to upload image')
          imageUrl = upData.url
        }
        if (hasPdfFile) {
          const fd = new FormData()
          fd.append('file', fileInputs.pdf.files[0])
          const upRes = await fetch(`${API_BASE}/admin/upload-file`, { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }, body: fd })
          const upData = await upRes.json()
          if (!upData.success) throw new Error('Failed to upload PDF')
          pdfUrl = upData.url
        }
        const schedRes = await fetch(`${API_BASE}/schedule`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('adminToken')}` },
          body: JSON.stringify({
            contentType: 'banner',
            title: formData.title || 'Banner',
            thumbnailUrl: imageUrl,
            contentData: { title: formData.title, image: imageUrl, pdf: pdfUrl },
            publishAt: scheduledAt
          })
        })
        const schedData = await schedRes.json()
        if (schedData.success) {
          showModal('success', `Banner scheduled for ${new Date(scheduledAt).toLocaleString()}`)
          resetForm()
        } else {
          showModal('error', schedData.message || 'Failed to schedule banner')
        }
        return
      }

      // --- Normal immediate upload flow ---
      const formDataToSend = new FormData()
      formDataToSend.append('title', formData.title)
      
      // Determine presence of image / pdf (file or URL)
      const hasImageFile = fileInputs.image && fileInputs.image.files && fileInputs.image.files[0]
      const hasImageUrl = !!formData.image
      const hasPdfFile = fileInputs.pdf && fileInputs.pdf.files && fileInputs.pdf.files[0]
      const hasPdfUrl = !!formData.pdf

      const hasImage = !!(hasImageFile || hasImageUrl)
      const hasPdf = !!(hasPdfFile || hasPdfUrl)

      // Require at least one: image OR pdf
      if (!hasImage && !hasPdf) {
        showModal('error', 'Either an image or a PDF is required.')
        setLoading(false)
        return
      }

      // Handle image file upload or URL (optional if PDF is present)
      if (hasImageFile) {
        formDataToSend.append('image', fileInputs.image.files[0])
      } else if (hasImageUrl) {
        formDataToSend.append('image', formData.image)
      }

      // Handle PDF file upload or URL (optional)
      if (hasPdfFile) {
        formDataToSend.append('pdf', fileInputs.pdf.files[0])
      } else if (hasPdfUrl) {
        formDataToSend.append('pdf', formData.pdf)
      }
      
      const response = await fetch(`${API_BASE}/banners`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: formDataToSend
      })
      
      const data = await response.json()
      if (data.success) {
        showModal('success', 'Banner created successfully!')
        resetForm()
        fetchBanners()
      } else {
        showModal('error', data.message || 'Failed to create banner')
      }
    } catch (error) {
      showModal('error', 'Error creating banner')
    } finally {
      setLoading(false)
    }
  }

  // Update banner
  const updateBanner = async (e) => {
    e.preventDefault()
    if (!editingBanner) return
    setLoading(true)
    
    try {
      const formDataToSend = new FormData()
      formDataToSend.append('title', formData.title)
      
      // Handle image file upload or URL
      if (fileInputs.image && fileInputs.image.files[0]) {
        formDataToSend.append('image', fileInputs.image.files[0])
      } else if (formData.image) {
        formDataToSend.append('image', formData.image)
      }

      // Handle PDF file upload or URL (optional)
      if (fileInputs.pdf && fileInputs.pdf.files[0]) {
        formDataToSend.append('pdf', fileInputs.pdf.files[0])
      } else if (formData.pdf) {
        formDataToSend.append('pdf', formData.pdf)
      }
      
      const response = await fetch(`${API_BASE}/banners/${editingBanner._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: formDataToSend
      })
      
      const data = await response.json()
      if (data.success) {
        showModal('success', 'Banner updated successfully!')
        resetForm()
        fetchBanners()
      } else {
        showModal('error', data.message || 'Failed to update banner')
      }
    } catch (error) {
      showModal('error', 'Error updating banner')
    } finally {
      setLoading(false)
    }
  }

  // Delete banner
  const deleteBanner = async (bannerId) => {
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/banners/${bannerId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      })
      
      const data = await response.json()
      if (data.success) {
        showModal('success', 'Banner deleted successfully!')
        fetchBanners()
      } else {
        showModal('error', data.message || 'Failed to delete banner')
      }
    } catch (error) {
      showModal('error', 'Error deleting banner')
    } finally {
      setLoading(false)
    }
  }

  // Edit handler
  const editBanner = (banner) => {
    setEditingBanner(banner)
    setFormData({
      title: banner.title || '',
      image: banner.image || '',
      imageFile: null,
      pdf: banner.pdf || '',
      pdfFile: null
    })
    setShowForm(true)
  }

  // Load data on component mount
  useEffect(() => {
    fetchBanners()
  }, [])

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
                Banners
                <div 
                  className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 h-0.5 w-32"
                  style={{
                    background: 'linear-gradient(90.05deg, #AC28DC 6.68%, #7E1EB7 49.26%, #501392 91.85%)'
                  }}
                ></div>
              </h1>
            </div>
            <div>
              <button
                onClick={() => setShowForm(true)}
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
                <span>Add Banner</span>
              </button>
            </div>
          </div>
        </div>

        {/* Banners List */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          {loading && banners.length === 0 ? (
            <div className="flex justify-center items-center py-20">
              <div className="text-white text-lg">Loading banners...</div>
            </div>
          ) : banners.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-gray-400 text-lg mb-6">No banners found</div>
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center space-x-2 mx-auto px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition duration-200"
              >
                <FiPlus className="w-4 h-4" />
                <span>Add Your First Banner</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {banners.map((banner) => (
                <div 
                  key={banner._id}
                  className="relative bg-gray-900 rounded-lg overflow-hidden transition-all duration-300 border-2 border-transparent hover:border-gray-600 hover:scale-105 hover:shadow-2xl group"
                >
                  {/* Banner Image */}
                  <div className="relative aspect-[16/9] overflow-hidden">
                    {banner.image ? (
                      <img
                        src={banner.image}
                        alt={banner.title || 'Banner'}
                        className="w-full h-full object-cover transition duration-300"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                        <FiImage className="w-12 h-12 text-gray-500" />
                      </div>
                    )}
                    
                    {/* Overlay with Actions */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center space-x-3">
                      <button
                        onClick={() => editBanner(banner)}
                        className="p-2 text-purple-400 hover:text-purple-300 hover:bg-purple-500/20 rounded-lg transition duration-200"
                        title="Edit Banner"
                      >
                        <FiEdit3 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => {
                          showModal('confirmation', 'Are you sure you want to delete this banner?', () => deleteBanner(banner._id))
                        }}
                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition duration-200"
                        title="Delete Banner"
                      >
                        <FiTrash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Banner Info */}
                  <div className="p-4">
                    <h3 className="text-white text-sm font-semibold truncate mb-1">
                      {banner.title || 'Untitled Banner'}
                    </h3>
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center space-x-1 text-xs text-gray-400">
                        <HiCalendar className="w-3 h-3" />
                        <span>
                          {new Date(banner.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </span>
                      </div>
                      {banner.pdf && (
                        <a
                          href={banner.pdf}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-purple-400 hover:text-purple-200 underline"
                        >
                          View PDF
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Banner Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-md flex items-center justify-center z-[10000] p-4 overflow-y-auto">
            <div className="bg-gray-900/80 backdrop-blur-lg rounded-2xl p-4 sm:p-6 lg:p-8 w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto shadow-2xl border border-gray-600/50 scrollbar-hide scroll-smooth my-auto">
              <div className="flex justify-between items-center mb-4 sm:mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-white" style={{ fontFamily: 'Archivo Black' }}>
                  {editingBanner ? 'Edit Banner' : 'Add New Banner'}
                </h2>
                <button
                  onClick={resetForm}
                  className="text-gray-400 hover:text-white transition duration-200"
                >
                  <FiX className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={editingBanner ? updateBanner : createBanner} className="space-y-4 sm:space-y-6">
                {/* Title */}
                <div>
                  <label className="block text-white text-sm font-semibold mb-3" style={{ fontFamily: 'Archivo Black' }}>
                    Title
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Enter banner title (optional)"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200 placeholder-gray-400"
                  />
                </div>

                {/* Image */}
                <div>
                  <label className="block text-white text-sm font-semibold mb-3" style={{ fontFamily: 'Archivo Black' }}>
                    Image *
                  </label>
                  
                  {editingBanner && editingBanner.image && (
                    <div className="mb-3">
                      <p className="text-gray-400 text-sm mb-2">Current image:</p>
                      <img 
                        src={editingBanner.image} 
                        alt="Current banner" 
                        className="w-full max-w-xs h-32 object-cover rounded-lg border border-gray-600" 
                      />
                    </div>
                  )}
                  
                  {/* File Upload */}
                  <div className="mb-3">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setFileInputs({ ...fileInputs, image: e.target })}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-purple-500 file:text-white hover:file:bg-purple-600"
                    />
                    <p className="text-gray-400 text-xs mt-2">Or enter image URL below</p>
                  </div>
                  
                  {/* Image URL Input */}
                  <input
                    type="url"
                    value={formData.image}
                    onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                    placeholder="Enter image URL"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200 placeholder-gray-400"
                  />
                </div>

                {/* PDF (optional) */}
                <div>
                  <label className="block text-white text-sm font-semibold mb-3" style={{ fontFamily: 'Archivo Black' }}>
                    PDF (optional)
                  </label>

                  {editingBanner && editingBanner.pdf && (
                    <div className="mb-3">
                      <p className="text-gray-400 text-sm mb-1">Current PDF:</p>
                      <a
                        href={editingBanner.pdf}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-purple-400 hover:text-purple-200 underline break-all"
                      >
                        {editingBanner.pdf}
                      </a>
                    </div>
                  )}

                  {/* File Upload */}
                  <div className="mb-3">
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => setFileInputs({ ...fileInputs, pdf: e.target })}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-purple-500 file:text-white hover:file:bg-purple-600"
                    />
                    <p className="text-gray-400 text-xs mt-2">Or enter PDF URL below</p>
                  </div>

                  {/* PDF URL Input */}
                  <input
                    type="url"
                    value={formData.pdf}
                    onChange={(e) => setFormData({ ...formData, pdf: e.target.value })}
                    placeholder="Enter PDF URL"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200 placeholder-gray-400"
                  />
                </div>

                {/* Schedule Upload — only for new banners */}
                {!editingBanner && (
                  <SchedulePicker
                    enabled={scheduleEnabled}
                    onToggle={setScheduleEnabled}
                    scheduledAt={scheduledAt}
                    onDateChange={setScheduledAt}
                  />
                )}

                {/* Submit Buttons */}
                <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4 pt-6 sm:pt-8">
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
                    <span>{loading ? (editingBanner ? 'Updating...' : 'Creating...') : (editingBanner ? 'Update' : (scheduleEnabled ? 'Schedule' : 'Create'))}</span>
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

export default Banners
