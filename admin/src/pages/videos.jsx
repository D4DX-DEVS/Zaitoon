import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import SuccessModal from '../components/SuccessModal'
import CustomDropdown from '../components/CustomDropdown'
import SchedulePicker from '../components/SchedulePicker'
import { 
  FiPlus, 
  FiX,
  FiSave,
  FiEdit3,
  FiTrash2,
  FiPlay,
  FiVideo,
  FiTrendingUp,
  FiMenu
} from 'react-icons/fi'
import { HiCalendar } from 'react-icons/hi'
import gradient from '../assets/gradiantRight.png'

function Videos() {
  const navigate = useNavigate()
  
  // State management
  const [videos, setVideos] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState({ isOpen: false, type: 'success', message: '', onConfirm: null })
  const [selectedVideo, setSelectedVideo] = useState(null)
  const [expandedCard, setExpandedCard] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [categoryVideos, setCategoryVideos] = useState([])
  const [categoryVideosLoading, setCategoryVideosLoading] = useState(false)
  const [draggingVideoId, setDraggingVideoId] = useState(null)
  const [draggingMainVideoId, setDraggingMainVideoId] = useState(null)
  const [pendingVideoOrder, setPendingVideoOrder] = useState(false)
  const [draggingCategoryId, setDraggingCategoryId] = useState(null)
  const [dragOverCategoryId, setDragOverCategoryId] = useState(null)
  const [pendingCategoryOrder, setPendingCategoryOrder] = useState(false)
  const [draggingTrendingId, setDraggingTrendingId] = useState(null)
  const [dragOverTrendingId, setDragOverTrendingId] = useState(null)
  const [pendingTrendingOrder, setPendingTrendingOrder] = useState(false)
  const [showCategoryTable, setShowCategoryTable] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, limit: 10 })
  
  // Form states
  const [showVideoForm, setShowVideoForm] = useState(false)
  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [editingVideo, setEditingVideo] = useState(null)
  const [editingCategory, setEditingCategory] = useState(null)
  
  // Form data
  const [videoForm, setVideoForm] = useState({
    title: '',
    category: '',
    videoLink: '',
    language: '',
    thumbnail: ''
  })
  
  const [fileInputs, setFileInputs] = useState({
    image: null,
    thumbnail: null
  })
  
  const [categoryForm, setCategoryForm] = useState({
    title: '',
    image: ''
  })

  // Trending section
  const [trending, setTrending] = useState([])
  const [trendingLoading, setTrendingLoading] = useState(false)
  const [showAddTrendingModal, setShowAddTrendingModal] = useState(false)
  const [allVideosForDropdown, setAllVideosForDropdown] = useState([])
  const [addTrendingVideoId, setAddTrendingVideoId] = useState('')
  const [addTrendingLoading, setAddTrendingLoading] = useState(false)

  // API Base URL
  const API_BASE = import.meta.env.VITE_API_BASE_URL

  // Schedule state
  const [scheduleEnabled, setScheduleEnabled] = useState(false)
  const [scheduledAt, setScheduledAt] = useState('')
  
  // Debug logging

  // Fetch videos (paginated for performance)
  const fetchVideos = async (page = 1) => {
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/videos?page=${page}&limit=10`)
      const data = await response.json()
      if (data.success) {
        setVideos(data.data.videos)
        if (data.data.pagination) {
          setPagination(data.data.pagination)
          setCurrentPage(data.data.pagination.page || page)
        }
      } else {
        showModal('error', 'Failed to fetch videos')
      }
    } catch (error) {
      showModal('error', 'Error fetching videos')
    } finally {
      setLoading(false)
    }
  }

  // Fetch categories
  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_BASE}/videos-categories?limit=200`)
      const data = await response.json()
      if (data.success) {
        setCategories(data.data.categories)
      } else {
        showModal('error', 'Failed to fetch categories')
      }
    } catch (error) {
      showModal('error', 'Error fetching categories')
    }
  }

  // Fetch trending videos
  const fetchTrending = async () => {
    setTrendingLoading(true)
    try {
      const response = await fetch(`${API_BASE}/videos/trending`)
      const data = await response.json()
      if (data.success) {
        setTrending(data.data.trending || [])
      } else {
        showModal('error', 'Failed to fetch trending')
      }
    } catch (error) {
      showModal('error', 'Error fetching trending')
    } finally {
      setTrendingLoading(false)
    }
  }

  // Fetch all videos for "Add to Trending" dropdown
  const fetchAllVideosForDropdown = async () => {
    try {
      const response = await fetch(`${API_BASE}/videos?page=1&limit=200`)
      const data = await response.json()
      if (data.success) {
        setAllVideosForDropdown(data.data.videos || [])
      }
    } catch (error) {
      showModal('error', 'Error loading videos list')
    }
  }

  // Add video to trending
  const addToTrending = async (e) => {
    e.preventDefault()
    if (!addTrendingVideoId) {
      showModal('error', 'Please select a video')
      return
    }
    setAddTrendingLoading(true)
    try {
      const response = await fetch(`${API_BASE}/videos/trending`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify({ video: addTrendingVideoId })
      })
      const data = await response.json()
      if (data.success) {
        showModal('success', 'Video added to trending!')
        setShowAddTrendingModal(false)
        setAddTrendingVideoId('')
        fetchTrending()
      } else {
        showModal('error', data.message || 'Failed to add to trending')
      }
    } catch (error) {
      showModal('error', 'Error adding to trending')
    } finally {
      setAddTrendingLoading(false)
    }
  }

  // Save trending order
  const saveTrendingOrder = async () => {
    setTrendingLoading(true)
    try {
      const trendingIds = trending.map((t) => t._id)
      const response = await fetch(`${API_BASE}/videos/trending/reorder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify({ trendingIds })
      })
      const data = await response.json()
      if (data.success) {
        showModal('success', 'Trending order saved!')
        setPendingTrendingOrder(false)
      } else {
        showModal('error', data.message || 'Failed to save trending order')
      }
    } catch (error) {
      showModal('error', 'Error saving trending order')
    } finally {
      setTrendingLoading(false)
    }
  }

  // Remove video from trending
  const removeFromTrending = async (trendingEntryId) => {
    setTrendingLoading(true)
    try {
      const response = await fetch(`${API_BASE}/videos/trending/${trendingEntryId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      })
      const data = await response.json()
      if (data.success) {
        showModal('success', 'Removed from trending')
        fetchTrending()
      } else {
        showModal('error', data.message || 'Failed to remove')
      }
    } catch (error) {
      showModal('error', 'Error removing from trending')
    } finally {
      setTrendingLoading(false)
    }
  }

  // Check if a video is already in trending
  const isVideoInTrending = (videoId) => {
    if (!videoId) return false
    return trending.some((t) => t.video && (t.video._id === videoId || t.video === videoId))
  }

  // Add a video to trending from video section (card modal or category list)
  const addVideoToTrendingById = async (videoId) => {
    if (!videoId || isVideoInTrending(videoId)) return
    try {
      const response = await fetch(`${API_BASE}/videos/trending`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify({ video: videoId })
      })
      const data = await response.json()
      if (data.success) {
        showModal('success', 'Video added to trending!')
        fetchTrending()
      } else {
        showModal('error', data.message || 'Failed to add to trending')
      }
    } catch (error) {
      showModal('error', 'Error adding to trending')
    }
  }

  // Show modal
  const showModal = (type, message, onConfirm = null) => {
    setModal({ isOpen: true, type, message, onConfirm })
  }

  // Close modal
  const closeModal = () => {
    setModal({ isOpen: false, type: 'success', message: '', onConfirm: null })
  }

  // Create video
  const createVideo = async (e) => {
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
        let thumbnailUrl = videoForm.thumbnail || ''
        if (fileInputs.thumbnail?.files?.[0]) {
          const fd = new FormData()
          fd.append('file', fileInputs.thumbnail.files[0])
          const upRes = await fetch(`${API_BASE}/admin/upload-file`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` },
            body: fd
          })
          const upData = await upRes.json()
          if (!upData.success) throw new Error('Failed to upload thumbnail')
          thumbnailUrl = upData.url
        }
        const schedRes = await fetch(`${API_BASE}/schedule`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('adminToken')}` },
          body: JSON.stringify({
            contentType: 'video',
            title: videoForm.title || 'Video',
            thumbnailUrl,
            contentData: {
              title: videoForm.title,
              category: videoForm.category,
              video: videoForm.videoLink,
              language: videoForm.language,
              thumbnail: thumbnailUrl
            },
            publishAt: scheduledAt
          })
        })
        const schedData = await schedRes.json()
        if (schedData.success) {
          showModal('success', `Video scheduled for ${new Date(scheduledAt).toLocaleString()}`)
          resetVideoForm()
          setShowVideoForm(false)
        } else {
          showModal('error', schedData.message || 'Failed to schedule video')
        }
        return
      }

      // --- Normal immediate upload flow ---
      const formData = new FormData()
      formData.append('title', videoForm.title)
      formData.append('category', videoForm.category)
      formData.append('videoType', 'link')
      formData.append('video', videoForm.videoLink)
      if (videoForm.language) {
        formData.append('language', videoForm.language)
      }
      if (fileInputs.thumbnail?.files?.[0]) {
        formData.append('thumbnail', fileInputs.thumbnail.files[0])
      } else if (videoForm.thumbnail) {
        formData.append('thumbnail', videoForm.thumbnail)
      }

      const response = await fetch(`${API_BASE}/videos`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: formData
      })
      
      const data = await response.json()
      if (data.success) {
        showModal('success', 'Video created successfully!')
        resetVideoForm()
        setShowVideoForm(false)
        fetchVideos(currentPage)
      } else {
        showModal('error', data.message || 'Failed to create video')
      }
    } catch (error) {
      showModal('error', 'Error creating video')
    } finally {
      setLoading(false)
    }
  }

  // Update video
  const updateVideo = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const formData = new FormData()
      formData.append('title', videoForm.title)
      formData.append('category', videoForm.category)
      formData.append('videoType', 'link')
      formData.append('video', videoForm.videoLink)
      if (videoForm.language) {
        formData.append('language', videoForm.language)
      }
      if (fileInputs.thumbnail?.files?.[0]) {
        formData.append('thumbnail', fileInputs.thumbnail.files[0])
      } else if (videoForm.thumbnail !== undefined && videoForm.thumbnail !== '') {
        formData.append('thumbnail', videoForm.thumbnail)
      }

      const response = await fetch(`${API_BASE}/videos/${editingVideo._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: formData
      })
      
      const data = await response.json()
      if (data.success) {
        showModal('success', 'Video updated successfully!')
        resetVideoForm()
        setShowVideoForm(false)
        fetchVideos(currentPage)
      } else {
        showModal('error', data.message || 'Failed to update video')
      }
    } catch (error) {
      showModal('error', 'Error updating video')
    } finally {
      setLoading(false)
    }
  }

  // Delete video
  const deleteVideo = async (videoId) => {
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/videos/${videoId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      })
      
      const data = await response.json()
      if (data.success) {
        showModal('success', 'Video deleted successfully!')
        const newPage = videos.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage
        fetchVideos(newPage)
      } else {
        showModal('error', data.message || 'Failed to delete video')
      }
    } catch (error) {
      showModal('error', 'Error deleting video')
    } finally {
      setLoading(false)
    }
  }

  // Create category
  const createCategory = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const formData = new FormData()
      formData.append('title', categoryForm.title)
      
      // Handle image file upload
      if (fileInputs.image && fileInputs.image.files[0]) {
        formData.append('image', fileInputs.image.files[0])
      } else if (categoryForm.image) {
        formData.append('image', categoryForm.image)
      }
      
      const response = await fetch(`${API_BASE}/videos-categories`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: formData
      })
      
      const data = await response.json()
      if (data.success) {
        showModal('success', 'Category created successfully!')
        resetCategoryForm()
        setShowCategoryForm(false)
        fetchCategories()
      } else {
        showModal('error', data.message || 'Failed to create category')
      }
    } catch (error) {
      showModal('error', 'Error creating category')
    } finally {
      setLoading(false)
    }
  }

  // Update category
  const updateCategory = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const formData = new FormData()
      formData.append('title', categoryForm.title)
      
      // Handle image file upload
      if (fileInputs.image && fileInputs.image.files[0]) {
        formData.append('image', fileInputs.image.files[0])
      } else if (categoryForm.image) {
        formData.append('image', categoryForm.image)
      }
      
      const response = await fetch(`${API_BASE}/videos-categories/${editingCategory._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: formData
      })
      
      const data = await response.json()
      if (data.success) {
        showModal('success', 'Category updated successfully!')
        resetCategoryForm()
        setShowCategoryForm(false)
        fetchCategories()
      } else {
        showModal('error', data.message || 'Failed to update category')
      }
    } catch (error) {
      showModal('error', 'Error updating category')
    } finally {
      setLoading(false)
    }
  }

  // Reorder categories
  const saveCategoryPriority = async () => {
    setLoading(true)
    try {
      const order = categories.map((cat, index) => ({ id: cat._id, priority: index }))
      const response = await fetch(`${API_BASE}/videos-categories/reorder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify({ order })
      })
      const data = await response.json()
      if (data.success) {
        showModal('success', 'Category order saved!')
        setPendingCategoryOrder(false)
      } else {
        showModal('error', data.message || 'Failed to save order')
      }
    } catch (error) {
      showModal('error', 'Error saving category order')
    } finally {
      setLoading(false)
    }
  }

  // Delete category
  const deleteCategory = async (categoryId) => {
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/videos-categories/${categoryId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      })
      
      const data = await response.json()
      if (data.success) {
        showModal('success', 'Category deleted successfully!')
        fetchCategories()
      } else {
        showModal('error', data.message || 'Failed to delete category')
      }
    } catch (error) {
      showModal('error', 'Error deleting category')
    } finally {
      setLoading(false)
    }
  }

  // Reset forms
  const resetVideoForm = () => {
    setVideoForm({
      title: '',
      category: '',
      videoLink: '',
      language: '',
      thumbnail: ''
    })
    setEditingVideo(null)
    setShowVideoForm(false)
    setScheduleEnabled(false)
    setScheduledAt('')
  }

  const resetCategoryForm = () => {
    setCategoryForm({
      title: '',
      image: ''
    })
    setEditingCategory(null)
    setShowCategoryForm(false)
  }

  // Fetch single video details
  const fetchVideoDetails = async (videoId) => {
    try {
      const response = await fetch(`${API_BASE}/videos/${videoId}`)
      const data = await response.json()
      if (data.success) {
        setSelectedVideo(data.data)
      } else {
        showModal('error', 'Failed to fetch video details')
      }
    } catch (error) {
      showModal('error', 'Error fetching video details')
    }
  }

  // Fetch videos for a specific category (used in category modal)
  const fetchVideosByCategory = async (categoryId) => {
    setCategoryVideosLoading(true)
    try {
      const response = await fetch(`${API_BASE}/videos/category/${categoryId}?page=1&limit=100`)
      const data = await response.json()
      if (data.success) {
        setCategoryVideos(data.data.videos || [])
      } else {
        showModal('error', data.message || 'Failed to fetch videos for this category')
      }
    } catch (error) {
      showModal('error', 'Error fetching videos for this category')
    } finally {
      setCategoryVideosLoading(false)
    }
  }

  // Handle card expand
  const handleCardExpand = (videoId) => {
    setExpandedCard(videoId)
    fetchVideoDetails(videoId)
  }

  // Handle card collapse
  const handleCardCollapse = () => {
    setExpandedCard(null)
    setSelectedVideo(null)
  }

  // Open category modal and load its videos
  const openCategoryModal = (category) => {
    setSelectedCategory(category)
    fetchVideosByCategory(category._id)
  }

  // Close category modal
  const closeCategoryModal = () => {
    setSelectedCategory(null)
    setCategoryVideos([])
    setDraggingVideoId(null)
  }

  // Save new order for videos in a category (backend + local state are already in sync)
  const saveCategoryOrder = async (videosInOrder) => {
    if (!selectedCategory) return
    try {
      await fetch(`${API_BASE}/videos/category/${selectedCategory._id}/reorder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify({
          videos: videosInOrder.map((v) => v._id)
        })
      })
      // No toast here – ordering is a quiet background save
    } catch (error) {
      showModal('error', 'Error saving new order for videos in this category')
    }
  }

  // Drag and drop handlers for videos inside category modal
  const handleVideoDragStart = (e, videoId) => {
    setDraggingVideoId(videoId)
  }

  const handleVideoDragOver = (e, targetId) => {
    e.preventDefault()
    if (!draggingVideoId || draggingVideoId === targetId) return

    setCategoryVideos((prev) => {
      const fromIndex = prev.findIndex((v) => v._id === draggingVideoId)
      const toIndex = prev.findIndex((v) => v._id === targetId)
      if (fromIndex === -1 || toIndex === -1) return prev

      const updated = [...prev]
      const [moved] = updated.splice(fromIndex, 1)
      updated.splice(toIndex, 0, moved)
      return updated
    })
  }

  const handleVideoDrop = (e) => {
    e.preventDefault()
    // Persist the new order to backend using current state
    if (categoryVideos.length > 0) {
      saveCategoryOrder(categoryVideos)
    }
    setDraggingVideoId(null)
  }

  const handleVideoDragEnd = () => {
    setDraggingVideoId(null)
  }

  // ── Main video list drag-and-drop reorder ─────────────────────────────────
  const handleMainVideoDragStart = (_e, id) => {
    setDraggingMainVideoId(id)
  }

  const handleMainVideoDragOver = (e, targetId) => {
    e.preventDefault()
    if (!draggingMainVideoId || draggingMainVideoId === targetId) return
    setVideos((prev) => {
      const fromIndex = prev.findIndex((v) => v._id === draggingMainVideoId)
      const toIndex = prev.findIndex((v) => v._id === targetId)
      if (fromIndex === -1 || toIndex === -1) return prev
      const updated = [...prev]
      const [moved] = updated.splice(fromIndex, 1)
      updated.splice(toIndex, 0, moved)
      return updated
    })
  }

  const handleMainVideoDrop = async (e) => {
    e.preventDefault()
    setDraggingMainVideoId(null)
    setPendingVideoOrder(true)
  }

  const handleMainVideoDragEnd = () => {
    setDraggingMainVideoId(null)
  }

  const saveMainVideoOrder = async () => {
    try {
      const token = localStorage.getItem('adminToken')
      await fetch(`${API_BASE}/videos/reorder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ videoIds: videos.map((v) => v._id) })
      })
      setPendingVideoOrder(false)
    } catch (err) {
      console.error('Failed to save video order:', err)
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  // Edit handlers
  const editVideo = (video) => {
    setEditingVideo(video)
    setVideoForm({
      title: video.title || '',
      category: video.category?._id || '',
      videoLink: video.videoLink || video.video || '',
      language: video.language || '',
      thumbnail: video.thumbnail || ''
    })
    setExpandedCard(null)
    setSelectedVideo(null)
    setShowVideoForm(true)
  }

  const editCategory = (category) => {
    setEditingCategory(category)
    setCategoryForm({
      title: category.title || '',
      image: category.image || ''
    })
    setShowCategoryForm(true)
  }

  // Load data on component mount
  useEffect(() => {
    fetchVideos()
    fetchCategories()
    fetchTrending()
  }, [])

  // When opening Add to Trending modal, load videos for dropdown
  useEffect(() => {
    if (showAddTrendingModal && allVideosForDropdown.length === 0) {
      fetchAllVideosForDropdown()
    }
  }, [showAddTrendingModal])

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
                Videos
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
                onClick={() => setShowVideoForm(true)}
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
                <span>Add Video</span>
              </button>
            </div>
          </div>
        </div>

        {/* Video Categories Section */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="mb-8">
            <h2 
              className="text-white text-2xl font-bold mb-6 relative"
              style={{ fontFamily: 'Archivo Black' }}
            >
              Video Categories
              <div 
                className="absolute -bottom-1 left-0 h-0.5 w-24"
                style={{
                  background: 'linear-gradient(90.05deg, #AC28DC 6.68%, #7E1EB7 49.26%, #501392 91.85%)'
                }}
              ></div>
            </h2>
            
            {categories.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 text-lg mb-6">No categories found</div>
                <button
                  onClick={() => setShowCategoryForm(true)}
                  className="flex items-center space-x-2 mx-auto px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition duration-200"
                >
                  <FiPlus className="w-4 h-4" />
                  <span>Add Your First Category</span>
                </button>
              </div>
             ) : (
               <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-4">
                {/* Category Cards - Limited Display */}
                     {categories.slice(0, 5).map((category) => (
                   <div 
                     key={category._id}
                    className="relative bg-gray-900 rounded-lg overflow-hidden transition-all duration-300 cursor-pointer border-2 border-transparent hover:border-gray-600 hover:scale-105 hover:shadow-2xl"
                    onClick={() => openCategoryModal(category)}
                   >
                     {/* Category Image */}
                     <div className="relative aspect-square overflow-hidden">
                      {category.image ? (
                        <img
                          src={category.image}
                          alt={category.title}
                          className="w-full h-full object-cover transition duration-300"
                          loading="lazy"
                        />
                       ) : (
                         <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                           <FiVideo className="w-8 h-8 text-gray-500" />
                         </div>
                       )}
                     </div>

                     {/* Category Info */}
                     <div className="p-3">
                       <h3 className="text-white text-sm font-semibold truncate">
                         {category.title}
                       </h3>
                     </div>
                   </div>
                 ))}

                 {/* Management Card - Always Last */}
                 <div 
                   onClick={() => setShowCategoryTable(!showCategoryTable)}
                   className={`relative bg-gray-900 rounded-lg overflow-hidden transition-all duration-300 cursor-pointer border-2 ${
                     showCategoryTable 
                       ? 'border-purple-500 scale-105 shadow-2xl' 
                       : 'border-dashed border-gray-600 hover:border-purple-500 hover:scale-105 hover:shadow-2xl'
                   }`}
                 >
                   <div className="relative aspect-square overflow-hidden flex items-center justify-center">
                     <div className="text-center">
                       <div className={`w-16 h-16 mx-auto mb-3 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                         showCategoryTable 
                           ? 'bg-purple-600/30 border-purple-400' 
                           : 'bg-purple-600/20 border-purple-500/30'
                       }`}>
                         <svg 
                           className={`w-8 h-8 text-purple-400 transition-transform duration-300 ${
                             showCategoryTable ? 'rotate-90' : 'rotate-0'
                           }`}
                           fill="none" 
                           stroke="currentColor" 
                           viewBox="0 0 24 24"
                         >
                           <path 
                             strokeLinecap="round" 
                             strokeLinejoin="round" 
                             strokeWidth={2} 
                             d="M9 5l7 7-7 7" 
                           />
                         </svg>
                       </div>
                       <p className="text-white text-sm font-semibold">Manage</p>
                       <p className="text-gray-400 text-xs">Categories</p>
                     </div>
                   </div>
                 </div>
               </div>
             )}
          </div>
        </div>

        {/* Expandable Category Management Container - Overlay */}
        {showCategoryTable && (
          <div 
            className="fixed inset-0 bg-black/20 backdrop-blur-md z-[9999] flex items-center justify-center p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowCategoryTable(false)
              }
            }}
          >
            <div 
              className="bg-gray-900/80 backdrop-blur-lg rounded-2xl w-full max-w-5xl max-h-[95vh] overflow-y-auto shadow-2xl border border-gray-600/50 scrollbar-hide scroll-smooth animate-in slide-in-from-top-4 duration-500 ease-out"
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
              }}
            >
              <div className="p-6">
                {/* Header with Close Button */}
                <div className="flex justify-between items-start mb-6">
                  <div className="flex-1">
                    <h1 className="text-white text-2xl font-bold mb-2" style={{ fontFamily: 'Archivo Black' }}>
                      Category Management
                    </h1>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => {
                        setShowCategoryForm(true)
                        setShowCategoryTable(false)
                      }}
                      className="flex items-center justify-center space-x-2 text-white transition duration-200"
                      style={{
                        background: 'linear-gradient(90.05deg, #AC28DC 6.68%, #7E1EB7 49.26%, #501392 91.85%)',
                        width: '140px',
                        height: '32px',
                        borderRadius: '16px',
                        fontFamily: 'Fredoka One',
                        fontWeight: '400',
                        fontSize: '12px',
                        lineHeight: '100%',
                        letterSpacing: '0%',
                        textAlign: 'center'
                      }}
                    >
                      <FiPlus className="w-3 h-3" />
                      <span>Add Category</span>
                    </button>
                    <button
                      onClick={() => setShowCategoryTable(false)}
                      className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition duration-200"
                    >
                      <FiX className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                
                {/* Management Table */}
                <div className="scroll-indicator">
                  {pendingCategoryOrder && (
                    <div className="flex justify-end px-4 pb-3">
                      <button
                        onClick={saveCategoryPriority}
                        disabled={loading}
                        className="flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition duration-200 text-sm"
                        style={{ background: 'linear-gradient(90.05deg, #AC28DC 6.68%, #7E1EB7 49.26%, #501392 91.85%)', borderRadius: '12px' }}
                      >
                        <FiSave className="w-4 h-4" />
                        <span>{loading ? 'Saving...' : 'Save Order'}</span>
                      </button>
                    </div>
                  )}
                  <div className="max-h-[60vh] overflow-y-auto overflow-x-auto scrollbar-hide scroll-smooth">
                    <table className="w-full">
                      <thead className="sticky top-0 bg-transparent backdrop-blur-sm z-10">
                        <tr className="border-b border-gray-700/50">
                          <th className="text-left py-3 px-2 text-gray-500 font-semibold w-8"></th>
                          <th className="text-left py-3 px-4 text-gray-300 font-semibold">Image</th>
                          <th className="text-left py-3 px-4 text-gray-300 font-semibold">Title</th>
                          <th className="text-left py-3 px-4 text-gray-300 font-semibold">Videos Count</th>
                          <th className="text-left py-3 px-4 text-gray-300 font-semibold">Created</th>
                          <th className="text-left py-3 px-4 text-gray-300 font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categories.map((category) => (
                          <tr
                            key={category._id}
                            draggable
                            onDragStart={() => setDraggingCategoryId(category._id)}
                            onDragOver={(e) => { e.preventDefault(); setDragOverCategoryId(category._id) }}
                            onDrop={() => {
                              if (!draggingCategoryId || draggingCategoryId === category._id) return
                              const from = categories.findIndex(c => c._id === draggingCategoryId)
                              const to = categories.findIndex(c => c._id === category._id)
                              if (from === -1 || to === -1) return
                              const reordered = [...categories]
                              const [moved] = reordered.splice(from, 1)
                              reordered.splice(to, 0, moved)
                              setCategories(reordered)
                              setPendingCategoryOrder(true)
                              setDraggingCategoryId(null)
                              setDragOverCategoryId(null)
                            }}
                            onDragEnd={() => { setDraggingCategoryId(null); setDragOverCategoryId(null) }}
                            className={`border-b border-gray-800/50 transition duration-200 ${
                              draggingCategoryId === category._id
                                ? 'opacity-40'
                                : dragOverCategoryId === category._id
                                ? 'bg-purple-900/30 border-purple-500/50'
                                : 'hover:bg-gray-800/30'
                            }`}
                          >
                            <td className="py-4 px-2">
                              <span className="cursor-grab active:cursor-grabbing text-gray-500 hover:text-gray-300 flex items-center justify-center">
                                <FiMenu className="w-4 h-4" />
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              {category.image ? (
                                <img
                                  src={category.image}
                                  alt={category.title}
                                  className="w-12 h-12 object-cover rounded-lg"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="w-12 h-12 bg-gray-800 rounded-lg flex items-center justify-center">
                                  <FiVideo className="w-6 h-6 text-gray-500" />
                                </div>
                              )}
                            </td>
                            <td className="py-4 px-4">
                              <span className="text-white font-medium">{category.title}</span>
                            </td>
                            <td className="py-4 px-4">
                              <span className="text-gray-400">
                                {videos.filter(video => video.category?._id === category._id).length}
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              <span className="text-gray-400 text-sm">
                                {new Date(category.createdAt).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric'
                                })}
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => {
                                    editCategory(category)
                                    setShowCategoryTable(false)
                                  }}
                                  className="p-2 text-gray-400 hover:text-purple-400 hover:bg-purple-500/10 rounded-lg transition duration-200"
                                  title="Edit Category"
                                >
                                  <FiEdit3 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    showModal('confirmation', 'Are you sure you want to delete this category? This will also delete all videos in this category.', () => deleteCategory(category._id))
                                  }}
                                  className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition duration-200"
                                  title="Delete Category"
                                >
                                  <FiTrash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                
                {categories.length === 0 && (
                  <div className="text-center py-12">
                    <div className="text-gray-400 text-lg mb-4">No categories found</div>
                    <button
                      onClick={() => {
                        setShowCategoryForm(true)
                        setShowCategoryTable(false)
                      }}
                      className="flex items-center space-x-2 mx-auto px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition duration-200"
                    >
                      <FiPlus className="w-4 h-4" />
                      <span>Add Category</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Category Videos Modal (when clicking a category card) */}
        {selectedCategory && (
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-md z-[9999] flex items-center justify-center p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                closeCategoryModal()
              }
            }}
          >
            <div 
              className="bg-gray-900/90 backdrop-blur-lg rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-700/60 scrollbar-hide scroll-smooth"
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
              }}
            >
              <div className="p-6">
                {/* Header */}
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center space-x-4">
                    {selectedCategory.image && (
                      <img
                        src={selectedCategory.image}
                        alt={selectedCategory.title}
                        className="w-14 h-14 rounded-xl object-cover border border-gray-700"
                      />
                    )}
                    <div>
                      <h2 
                        className="text-white text-2xl font-bold mb-1"
                        style={{ fontFamily: 'Archivo Black' }}
                      >
                        {selectedCategory.title}
                      </h2>
                      <p className="text-gray-400 text-sm">
                        Drag & drop to reorder videos inside this category
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={closeCategoryModal}
                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition duration-200"
                  >
                    <FiX className="w-5 h-5" />
                  </button>
                </div>

                {/* Videos list inside category */}
                {categoryVideosLoading ? (
                  <div className="flex justify-center items-center py-16">
                    <div className="text-white text-base">Loading videos...</div>
                  </div>
                ) : categoryVideos.length === 0 ? (
                  <div className="text-center py-16">
                    <p className="text-gray-400 text-base mb-4">
                      No videos found in this category.
                    </p>
                    <p className="text-gray-500 text-sm">
                      Add new videos from the main <span className="font-semibold text-gray-300">Videos</span> section.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {categoryVideos.map((video) => (
                      <div
                        key={video._id}
                        draggable
                        onDragStart={(e) => handleVideoDragStart(e, video._id)}
                        onDragOver={(e) => handleVideoDragOver(e, video._id)}
                        onDrop={handleVideoDrop}
                        onDragEnd={handleVideoDragEnd}
                        className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-150 bg-gray-900/80 ${
                          draggingVideoId === video._id
                            ? 'border-purple-500 bg-purple-500/10 scale-[1.01]'
                            : 'border-gray-700 hover:border-purple-500/70 hover:bg-gray-800/80'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          {/* Drag handle */}
                          <div className="cursor-grab active:cursor-grabbing text-gray-500 hover:text-gray-300">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                            >
                              <path d="M10 4h.01M14 4h.01M10 9h.01M14 9h.01M10 14h.01M14 14h.01M10 19h.01M14 19h.01" />
                            </svg>
                          </div>

                          {/* Thumbnail / icon */}
                          <div className="w-16 h-10 rounded-lg overflow-hidden bg-gray-800 flex items-center justify-center">
                            {video.thumbnail ? (
                              <img src={video.thumbnail} alt="" className="w-full h-full object-cover" />
                            ) : video.video ? (
                              <video
                                src={video.video}
                                className="w-full h-full object-cover"
                                muted
                              />
                            ) : (
                              <FiVideo className="w-5 h-5 text-gray-500" />
                            )}
                          </div>

                          {/* Title + meta */}
                          <div>
                            <p className="text-white text-sm font-semibold line-clamp-1">
                              {video.title}
                            </p>
                            <div className="flex items-center space-x-2 text-xs text-gray-400 mt-1">
                              {video.language && (
                                <span>{video.language}</span>
                              )}
                              {video.createdAt && (
                                <>
                                  <span className="text-gray-600">•</span>
                                  <span>
                                    {new Date(video.createdAt).toLocaleDateString('en-US', {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric'
                                    })}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Quick actions (Add to Trending / edit / delete) */}
                        <div className="flex items-center space-x-2">
                          {isVideoInTrending(video._id) ? (
                            <span className="flex items-center text-green-400 text-xs px-1" title="In Trending">
                              <FiTrendingUp className="w-4 h-4" />
                            </span>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                addVideoToTrendingById(video._id)
                              }}
                              className="p-2 text-green-400 hover:text-green-300 hover:bg-green-500/10 rounded-lg transition duration-150"
                              title="Add to Trending"
                            >
                              <FiTrendingUp className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              editVideo(video)
                              closeCategoryModal()
                            }}
                            className="p-2 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 rounded-lg transition duration-150"
                            title="Edit video"
                          >
                            <FiEdit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              showModal(
                                'confirmation',
                                'Are you sure you want to delete this video?',
                                () => {
                                  deleteVideo(video._id)
                                  setCategoryVideos((prev) =>
                                    prev.filter((v) => v._id !== video._id)
                                  )
                                }
                              )
                            }}
                            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition duration-150"
                            title="Delete video"
                          >
                            <FiTrash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Trending Section */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="mb-8">
            <div className="flex justify-between items-center mb-6">
              <h2 
                className="text-white text-2xl font-bold relative"
                style={{ fontFamily: 'Archivo Black' }}
              >
                Trending
                <div 
                  className="absolute -bottom-1 left-0 h-0.5 w-24"
                  style={{
                    background: 'linear-gradient(90.05deg, #AC28DC 6.68%, #7E1EB7 49.26%, #501392 91.85%)'
                  }}
                ></div>
              </h2>
              <button
                onClick={() => setShowAddTrendingModal(true)}
                className="flex items-center justify-center space-x-2 text-white transition duration-200"
                style={{
                  background: 'linear-gradient(90.05deg, #AC28DC 6.68%, #7E1EB7 49.26%, #501392 91.85%)',
                  width: '160px',
                  height: '36px',
                  borderRadius: '18px',
                  fontFamily: 'Fredoka One',
                  fontWeight: '400',
                  fontSize: '14px'
                }}
              >
                <FiPlus className="w-3 h-3" />
                <span>Add to Trending</span>
              </button>
            </div>
            {trendingLoading ? (
              <div className="text-gray-400">Loading trending...</div>
            ) : trending.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                No trending videos. Add videos from your existing video list.
              </div>
            ) : (
              <>
                {pendingTrendingOrder && (
                  <div className="flex items-center justify-between px-4 py-2 mb-4 bg-purple-500/10 border border-purple-500/40 rounded-xl">
                    <span className="text-purple-400 text-sm font-medium">Drag to reorder — save when done</span>
                    <button
                      onClick={saveTrendingOrder}
                      disabled={trendingLoading}
                      className="flex items-center space-x-2 px-4 py-1.5 text-white text-sm font-semibold rounded-lg transition"
                      style={{ background: 'linear-gradient(90.05deg, #AC28DC 6.68%, #7E1EB7 49.26%, #501392 91.85%)' }}
                    >
                      <FiSave className="w-4 h-4" />
                      <span>{trendingLoading ? 'Saving...' : 'Save Order'}</span>
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {trending.map((entry) => {
                    const v = entry.video
                    if (!v) return null
                    return (
                      <div
                        key={entry._id}
                        draggable
                        onDragStart={() => setDraggingTrendingId(entry._id)}
                        onDragOver={(e) => { e.preventDefault(); setDragOverTrendingId(entry._id) }}
                        onDrop={() => {
                          if (!draggingTrendingId || draggingTrendingId === entry._id) return
                          const from = trending.findIndex(t => t._id === draggingTrendingId)
                          const to = trending.findIndex(t => t._id === entry._id)
                          if (from === -1 || to === -1) return
                          const reordered = [...trending]
                          const [moved] = reordered.splice(from, 1)
                          reordered.splice(to, 0, moved)
                          setTrending(reordered)
                          setPendingTrendingOrder(true)
                          setDraggingTrendingId(null)
                          setDragOverTrendingId(null)
                        }}
                        onDragEnd={() => { setDraggingTrendingId(null); setDragOverTrendingId(null) }}
                        className={`relative bg-gray-900 rounded-lg overflow-hidden border transition-all ${
                          draggingTrendingId === entry._id
                            ? 'opacity-40 border-gray-700'
                            : dragOverTrendingId === entry._id
                            ? 'border-purple-500 shadow-lg shadow-purple-500/20'
                            : 'border-gray-700 hover:border-gray-600'
                        }`}
                      >
                        <div className="relative aspect-[16/9] overflow-hidden cursor-grab active:cursor-grabbing">
                          {v.thumbnail ? (
                            <img src={v.thumbnail} alt={v.title} className="w-full h-full object-cover" />
                          ) : v.video ? (
                            <video src={v.video} className="w-full h-full object-cover" muted />
                          ) : (
                            <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                              <FiVideo className="w-10 h-10 text-gray-500" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                            <FiPlay className="w-10 h-10 text-white" />
                          </div>
                          <div className="absolute top-2 left-2 text-gray-400 bg-black/50 rounded p-1">
                            <FiMenu className="w-3 h-3" />
                          </div>
                        </div>
                        <div className="p-3 flex justify-between items-center">
                          <h3 className="text-white text-sm font-semibold truncate flex-1 mr-2">{v.title}</h3>
                          <button
                            onClick={() => removeFromTrending(entry._id)}
                            className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition"
                            title="Remove from trending"
                          >
                            <FiTrash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Videos List */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <div className="mb-8">
            <h2 
              className="text-white text-2xl font-bold mb-6 relative"
              style={{ fontFamily: 'Archivo Black' }}
            >
              Videos
              <div 
                className="absolute -bottom-1 left-0 h-0.5 w-16"
                style={{
                  background: 'linear-gradient(90.05deg, #AC28DC 6.68%, #7E1EB7 49.26%, #501392 91.85%)'
                }}
              ></div>
            </h2>
          </div>
          
          {loading && videos.length === 0 ? (
            <div className="flex justify-center items-center py-20">
              <div className="text-white text-lg">Loading videos...</div>
            </div>
          ) : videos.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-gray-400 text-lg mb-6">No videos found</div>
              <button
                onClick={() => setShowVideoForm(true)}
                className="flex items-center space-x-2 mx-auto px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition duration-200"
              >
                <FiPlus className="w-4 h-4" />
                <span>Add Your First Video</span>
              </button>
            </div>
          ) : (
            <>
              {pendingVideoOrder && (
                <div className="flex items-center justify-between px-4 py-2 mb-4 bg-green-500/10 border border-green-500/40 rounded-xl">
                  <span className="text-green-400 text-sm font-medium">Drag to reorder — save when done</span>
                  <button
                    onClick={saveMainVideoOrder}
                    className="px-4 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-lg transition"
                  >
                    Save Order
                  </button>
                </div>
              )}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {videos.map((video) => {
                const isThisCardExpanded = expandedCard === video._id
                const currentVideo = expandedCard === video._id && selectedVideo ? selectedVideo : video
                
                return (
                  <div
                    key={video._id}
                    draggable
                    onDragStart={(e) => handleMainVideoDragStart(e, video._id)}
                    onDragOver={(e) => handleMainVideoDragOver(e, video._id)}
                    onDrop={handleMainVideoDrop}
                    onDragEnd={handleMainVideoDragEnd}
                    className={`group transition-opacity duration-150 rounded-lg ${draggingMainVideoId === video._id ? 'opacity-40' : 'opacity-100'} ${pendingVideoOrder && draggingMainVideoId !== video._id ? 'ring-1 ring-green-500/40' : ''}`}
                  >
                    {/* Video Card */}
                    <div 
                      className={`relative bg-gray-900 rounded-lg overflow-hidden transition-all duration-300 cursor-pointer border-2 ${
                        isThisCardExpanded 
                          ? 'scale-110 z-10 shadow-2xl border-blue-500' 
                          : 'hover:scale-105 hover:shadow-2xl border-transparent hover:border-gray-600'
                      }`}
                      onClick={() => {
                        if (isThisCardExpanded) {
                          handleCardCollapse()
                        } else {
                          handleCardExpand(video._id)
                        }
                      }}
                    >
                      {/* Drag handle badge */}
                      <div className="absolute top-1 left-1 z-20 rounded bg-black/50 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M10 4h.01M14 4h.01M10 9h.01M14 9h.01M10 14h.01M14 14h.01M10 19h.01M14 19h.01" />
                        </svg>
                      </div>
                      {/* Video Thumbnail */}
                      <div className="relative aspect-[16/9] overflow-hidden">
                        {video.thumbnail ? (
                          <div className="relative w-full h-full bg-gray-800 flex items-center justify-center">
                            <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                              <FiPlay className="w-12 h-12 text-white" />
                            </div>
                          </div>
                        ) : video.video ? (
                          <div className="relative w-full h-full bg-gray-800 flex items-center justify-center">
                            <video
                              src={video.video}
                              className="w-full h-full object-cover"
                              muted
                            />
                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                              <FiPlay className="w-12 h-12 text-white" />
                            </div>
                          </div>
                        ) : (
                          <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                            <FiVideo className="w-12 h-12 text-gray-500" />
                          </div>
                        )}
                      </div>

                      {/* Video Info */}
                      <div className="p-4">
                        <h3 className="text-white text-sm font-semibold truncate mb-1">
                          {video.title}
                        </h3>
                        {video.category && (
                          <p className="text-gray-400 text-xs truncate">
                            {video.category.title}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {/* Full Screen Modal - Rendered outside the card */}
                    {isThisCardExpanded && (
                      <div 
                        className="fixed inset-0 bg-black/20 backdrop-blur-md z-[9999] flex items-center justify-center p-4"
                        onClick={(e) => {
                          if (e.target === e.currentTarget) {
                            handleCardCollapse()
                          }
                        }}
                      >
                        <div 
                          className="bg-gray-900/80 backdrop-blur-lg rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-600/50 scrollbar-hide scroll-smooth"
                          onClick={(e) => {
                            e.stopPropagation()
                            e.preventDefault()
                          }}
                        >
                          {!currentVideo.title ? (
                            <div className="flex items-center justify-center py-20">
                              <div className="text-white text-lg">Loading details...</div>
                            </div>
                          ) : (
                            <div className="p-6">
                              {/* Header with Close Button */}
                              <div className="flex justify-between items-start mb-6">
                                <div className="flex-1">
                                  <h1 className="text-white text-2xl font-bold mb-2" style={{ fontFamily: 'Archivo Black' }}>
                                    {currentVideo.title}
                                  </h1>
                                  {currentVideo.category && (
                                    <p className="text-gray-300 text-base mb-3">
                                      Category: {currentVideo.category.title}
                                    </p>
                                  )}
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleCardCollapse()
                                  }}
                                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition duration-200"
                                >
                                  <FiX className="w-5 h-5" />
                                </button>
                              </div>
                              
                              {/* Video Player */}
                              {currentVideo.video && (
                                <div className="mb-6 flex justify-center">
                                  <video
                                    src={currentVideo.video}
                                    controls
                                    className="max-w-full max-h-96 rounded-xl shadow-lg"
                                  >
                                    Your browser does not support the video tag.
                                  </video>
                                </div>
                              )}

                              {/* Video Details */}
                              <div className="mb-6">
                                <h3 className="text-white text-sm font-medium mb-4 text-gray-300">Video Details</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {currentVideo.category && (
                                    <div className="bg-gray-800/50 rounded-lg p-3">
                                      <span className="text-gray-400 text-xs mb-2 block">Category</span>
                                      <div className="flex items-center space-x-3">
                                        {currentVideo.category.image && (
                                          <img
                                            src={currentVideo.category.image}
                                            alt={currentVideo.category.title}
                                            className="w-8 h-8 object-cover rounded-lg"
                                          />
                                        )}
                                        <span className="text-white text-sm">{currentVideo.category.title}</span>
                                      </div>
                                    </div>
                                  )}
                                  {currentVideo.language && (
                                    <div className="bg-gray-800/50 rounded-lg p-3">
                                      <span className="text-gray-400 text-xs mb-2 block">Language</span>
                                      <span className="text-white text-sm">{currentVideo.language}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                                          
                              {/* Footer with Date and Action Icons */}
                              <div className="flex items-center justify-between pt-4 border-t border-gray-700/50">
                                {/* Create Date */}
                                <div className="flex items-center space-x-1 text-sm text-gray-400">
                                  <HiCalendar className="w-4 h-4" />
                                  <span>
                                    {new Date(currentVideo.createdAt).toLocaleDateString('en-US', {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric'
                                    })}
                                  </span>
                                </div>
                                
                                {/* Action Icons */}
                                <div className="flex items-center space-x-3">
                                  {isVideoInTrending(currentVideo._id) ? (
                                    <span className="flex items-center space-x-1 px-2 py-1 text-green-400 text-sm" title="In Trending">
                                      <FiTrendingUp className="w-4 h-4" />
                                      <span>In Trending</span>
                                    </span>
                                  ) : (
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        addVideoToTrendingById(currentVideo._id)
                                      }}
                                      className="p-2 text-green-400 hover:text-green-300 hover:bg-green-500/10 rounded-lg transition duration-200"
                                      title="Add to Trending"
                                    >
                                      <FiTrendingUp className="w-5 h-5" />
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      editVideo(currentVideo)
                                    }}
                                    className="p-2 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 rounded-lg transition duration-200"
                                    title="Edit Video"
                                  >
                                    <FiEdit3 className="w-5 h-5" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      showModal('confirmation', 'Are you sure you want to delete this video?', () => deleteVideo(currentVideo._id))
                                    }}
                                    className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition duration-200"
                                    title="Delete Video"
                                  >
                                    <FiTrash2 className="w-5 h-5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            </>
          )}

          {/* Pagination */}
          {!loading && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-8 pb-4">
              <p className="text-gray-400 text-sm">
                Showing {(currentPage - 1) * pagination.limit + 1}–{Math.min(currentPage * pagination.limit, pagination.total)} of {pagination.total} videos
              </p>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => fetchVideos(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition duration-200"
                >
                  Previous
                </button>
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    onClick={() => fetchVideos(p)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition duration-200 ${
                      p === currentPage
                        ? 'text-white'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                    style={p === currentPage ? {
                      background: 'linear-gradient(90.05deg, #AC28DC 6.68%, #7E1EB7 49.26%, #501392 91.85%)'
                    } : {}}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => fetchVideos(currentPage + 1)}
                  disabled={currentPage >= pagination.totalPages}
                  className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition duration-200"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Video Form Modal */}
        {showVideoForm && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-md flex items-center justify-center z-[10000] p-4">
            <div className="bg-gray-900/80 backdrop-blur-lg rounded-2xl p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-600/50 scrollbar-hide scroll-smooth scroll-indicator">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">
                  {editingVideo ? 'Edit Video' : 'Add New Video'}
                </h2>
                <button
                  onClick={resetVideoForm}
                  className="text-gray-400 hover:text-white transition duration-200"
                >
                  <FiX className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={editingVideo ? updateVideo : createVideo} className="space-y-6">
                {/* Title */}
                <div>
                  <label className="block text-white text-sm font-semibold mb-3" style={{ fontFamily: 'Archivo Black' }}>Title *</label>
                  <input
                    type="text"
                    value={videoForm.title}
                    onChange={(e) => setVideoForm({ ...videoForm, title: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-white text-sm font-semibold mb-3" style={{ fontFamily: 'Archivo Black' }}>Category *</label>
                  <CustomDropdown
                    options={categories.map((category) => ({
                      value: category._id,
                      label: category.title
                    }))}
                    value={videoForm.category}
                    onChange={(value) => setVideoForm({ ...videoForm, category: value })}
                    placeholder="Select category..."
                    className="w-full"
                  />
                </div>

                {/* Language */}
                <div>
                  <label className="block text-white text-sm font-semibold mb-3" style={{ fontFamily: 'Archivo Black' }}>Language</label>
                  <CustomDropdown
                    options={[
                      { value: 'English', label: 'English' },
                      { value: 'Malayalam', label: 'Malayalam' },
                      { value: 'Hindi', label: 'Hindi' },
                      { value: 'Urdu', label: 'Urdu' }
                    ]}
                    value={videoForm.language}
                    onChange={(value) => setVideoForm({ ...videoForm, language: value })}
                    placeholder="Select language..."
                    className="w-full"
                  />
                </div>

                {/* Thumbnail */}
                <div>
                  <label className="block text-white text-sm font-semibold mb-3" style={{ fontFamily: 'Archivo Black' }}>Thumbnail</label>
                  {editingVideo && (editingVideo.thumbnail || videoForm.thumbnail) && (
                    <div className="mb-3">
                      <p className="text-gray-400 text-sm mb-2">Current thumbnail:</p>
                      <img src={editingVideo.thumbnail || videoForm.thumbnail} alt="Thumbnail" className="w-20 h-20 object-cover rounded-lg" />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFileInputs({ ...fileInputs, thumbnail: e.target })}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-purple-500 file:text-white hover:file:bg-purple-600"
                  />
                </div>

                {/* Video Link Input */}
                <div>
                  <label className="block text-white text-sm font-semibold mb-3" style={{ fontFamily: 'Archivo Black' }}>Video Link *</label>
                  
                  {editingVideo && (editingVideo.videoLink || editingVideo.video) && (
                    <div className="mb-3">
                      <p className="text-gray-400 text-sm mb-2">Current video link:</p>
                      <a 
                        href={editingVideo.videoLink || editingVideo.video} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-purple-400 hover:text-purple-300 text-sm underline"
                      >
                        {editingVideo.videoLink || editingVideo.video}
                      </a>
                    </div>
                  )}
                  <input
                    type="url"
                    value={videoForm.videoLink}
                    onChange={(e) => setVideoForm({ ...videoForm, videoLink: e.target.value })}
                    placeholder="Enter video URL (YouTube, Vimeo, etc.)"
                    required
                    className="w-full h-12 px-4 bg-gray-800/50 border border-gray-600 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200 placeholder-gray-400"
                  />
                </div>

                {/* Submit Buttons */}
                {!editingVideo && (
                  <SchedulePicker
                    enabled={scheduleEnabled}
                    onToggle={setScheduleEnabled}
                    scheduledAt={scheduledAt}
                    onDateChange={setScheduledAt}
                  />
                )}
                <div className="flex justify-end space-x-4 pt-8">
                  <button
                    type="button"
                    onClick={resetVideoForm}
                    className="flex items-center justify-center space-x-2 text-white transition duration-200"
                    style={{
                      background: 'linear-gradient(90.05deg, #374151 6.68%, #4B5563 49.26%, #6B7280 91.85%)',
                      width: '140px',
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
                    <span>Cancel</span>
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center justify-center space-x-2 text-white transition duration-200 disabled:opacity-50"
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
                    <span>{loading ? 'Saving...' : (editingVideo ? 'Update' : (scheduleEnabled ? 'Schedule' : 'Create'))}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Category Form Modal */}
        {showCategoryForm && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-md flex items-center justify-center z-[10000] p-4">
            <div className="bg-gray-900/80 backdrop-blur-lg rounded-2xl p-8 w-full max-w-md shadow-2xl border border-gray-600/50 scrollbar-hide scroll-smooth scroll-indicator">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'Archivo Black' }}>
                  {editingCategory ? 'Edit Category' : 'Add New Category'}
                </h2>
                <button
                  onClick={resetCategoryForm}
                  className="text-gray-400 hover:text-white transition duration-200"
                >
                  <FiX className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={editingCategory ? updateCategory : createCategory} className="space-y-6">
                <div>
                  <label className="block text-white text-sm font-semibold mb-3" style={{ fontFamily: 'Archivo Black' }}>Title *</label>
                  <input
                    type="text"
                    value={categoryForm.title}
                    onChange={(e) => setCategoryForm({ ...categoryForm, title: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200"
                    required
                  />
                </div>

                <div>
                  <label className="block text-white text-sm font-semibold mb-3" style={{ fontFamily: 'Archivo Black' }}>Image</label>
                  {editingCategory && editingCategory.image && (
                    <div className="mb-3">
                      <p className="text-gray-400 text-sm mb-2">Current image:</p>
                      <img src={editingCategory.image} alt="Current category" className="w-20 h-20 object-cover rounded-lg" />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFileInputs({ ...fileInputs, image: e.target })}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-purple-500 file:text-white hover:file:bg-purple-600"
                  />
                </div>

                <div className="flex justify-end space-x-4 pt-8">
                  <button
                    type="button"
                    onClick={resetCategoryForm}
                    className="flex items-center justify-center space-x-2 text-white transition duration-200"
                    style={{
                      background: 'linear-gradient(90.05deg, #374151 6.68%, #4B5563 49.26%, #6B7280 91.85%)',
                      width: '140px',
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
                    <span>Cancel</span>
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center justify-center space-x-2 text-white transition duration-200 disabled:opacity-50"
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
                    <span>{loading ? (editingCategory ? 'Updating...' : 'Creating...') : (editingCategory ? 'Update' : 'Create')}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add to Trending Modal */}
        {showAddTrendingModal && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-md flex items-center justify-center z-[10000] p-4">
            <div className="bg-gray-900/80 backdrop-blur-lg rounded-2xl p-8 w-full max-w-md shadow-2xl border border-gray-600/50">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'Archivo Black' }}>
                  Add to Trending
                </h2>
                <button
                  onClick={() => {
                    setShowAddTrendingModal(false)
                    setAddTrendingVideoId('')
                  }}
                  className="text-gray-400 hover:text-white transition"
                >
                  <FiX className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={addToTrending} className="space-y-6">
                <div>
                  <label className="block text-white text-sm font-semibold mb-3" style={{ fontFamily: 'Archivo Black' }}>Select Video</label>
                  <CustomDropdown
                    options={allVideosForDropdown
                      .filter((v) => !trending.some((t) => t.video && t.video._id === v._id))
                      .map((v) => ({ value: v._id, label: v.title }))}
                    value={addTrendingVideoId}
                    onChange={(value) => setAddTrendingVideoId(value)}
                    placeholder="Choose a video..."
                    className="w-full"
                  />
                  {trending.length > 0 && allVideosForDropdown.length > 0 && (
                    <p className="text-gray-400 text-xs mt-2">Videos already in trending are hidden.</p>
                  )}
                </div>
                <div className="flex justify-end space-x-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddTrendingModal(false)
                      setAddTrendingVideoId('')
                    }}
                    className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-500 text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addTrendingLoading || !addTrendingVideoId}
                    className="flex items-center justify-center space-x-2 text-white disabled:opacity-50"
                    style={{
                      background: 'linear-gradient(90.05deg, #AC28DC 6.68%, #7E1EB7 49.26%, #501392 91.85%)',
                      width: '140px',
                      height: '36px',
                      borderRadius: '18px',
                      fontFamily: 'Fredoka One',
                      fontSize: '14px'
                    }}
                  >
                    <span>{addTrendingLoading ? 'Adding...' : 'Add'}</span>
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

export default Videos
