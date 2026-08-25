import React, { useState, useEffect } from 'react'
import { FiPlus, FiEdit, FiTrash2, FiEye, FiX, FiUpload, FiImage, FiFile, FiFolder, FiChevronRight, FiChevronDown } from 'react-icons/fi'
import SuccessModal from '../components/SuccessModal'
import CustomDropdown from '../components/CustomDropdown'
import Sidebar from '../components/Sidebar'
import SchedulePicker from '../components/SchedulePicker'
import HighlightDurationPicker from '../components/HighlightDurationPicker'
import gradient from '../assets/gradiantRight.png'
import { SkeletonCards } from '../components/Skeleton'

const SPACES_CDN_DOMAIN = import.meta.env.VITE_SPACES_CDN_DOMAIN

// Fixes malformed DigitalOcean Spaces URLs stored without a scheme
// (e.g. "blr1.digitaloceanspaces.com/space/key.jpg" instead of
// "https://space.blr1.digitaloceanspaces.com/key.jpg").
const normalizeSpacesUrl = (input) => {
  if (!input) return input

  const pathStyleMatch = input.match(/^https?:\/\/([a-z0-9-]+)\.digitaloceanspaces\.com\/([a-z0-9-]+)\/(.+)$/i)
  if (pathStyleMatch) {
    const [, region, space, key] = pathStyleMatch
    if (SPACES_CDN_DOMAIN) {
      return `https://${SPACES_CDN_DOMAIN}/${key}`
    }
    return `https://${space}.${region}.digitaloceanspaces.com/${key}`
  }

  if (SPACES_CDN_DOMAIN) {
    const cdnMissingProtocol = input.match(new RegExp(`^${SPACES_CDN_DOMAIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/(.+)$`, 'i'))
    if (cdnMissingProtocol) {
      return `https://${SPACES_CDN_DOMAIN}/${cdnMissingProtocol[1]}`
    }
  }

  return input
}

const resolveImageUrl = (url) => {
  if (!url) return url
  const trimmed = normalizeSpacesUrl(String(url).trim())
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (trimmed.startsWith('//')) return `https:${trimmed}`
  if (/^[a-z0-9.-]+\.digitaloceanspaces\.com\//i.test(trimmed)) return `https://${trimmed}`
  if (/^[a-z0-9.-]+\.cdn\.digitaloceanspaces\.com\//i.test(trimmed)) return `https://${trimmed}`
  return trimmed
}

const BrightBox = () => {
  // States
  const [brightBoxes, setBrightBoxes] = useState([])
  const [brightBoxStories, setBrightBoxStories] = useState([])
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState({ isOpen: false, type: 'success', message: '', onConfirm: null })
  const [draggingBrightBoxId, setDraggingBrightBoxId] = useState(null)
  const [pendingBbOrder, setPendingBbOrder] = useState(false)
  const [draggingBsId, setDraggingBsId] = useState(null)
  const [pendingBsOrder, setPendingBsOrder] = useState(false)
  
  // Form states
  const [showBrightBoxForm, setShowBrightBoxForm] = useState(false)
  const [showBrightBoxStoryForm, setShowBrightBoxStoryForm] = useState(false)
  const [editingBrightBox, setEditingBrightBox] = useState(null)
  const [editingBrightBoxStory, setEditingBrightBoxStory] = useState(null)
  
  // View states
  const [expandedBrightBox, setExpandedBrightBox] = useState(null)
  const [selectedBrightBoxStory, setSelectedBrightBoxStory] = useState(null)
  const [showStoryDetails, setShowStoryDetails] = useState(false)
  const [expandedCategory, setExpandedCategory] = useState(null)
  const [showCategoryTable, setShowCategoryTable] = useState(false)
  const [expandedStory, setExpandedStory] = useState(null)
  const [showStoriesTable, setShowStoriesTable] = useState(false)
  const [categoryStories, setCategoryStories] = useState([])
  const [categoryStoriesLoading, setCategoryStoriesLoading] = useState(false)

  // Pagination states
  const [bbPage, setBbPage] = useState(1)
  const [bbTotalPages, setBbTotalPages] = useState(1)
  const [bbTotal, setBbTotal] = useState(0)
  const [storiesPage, setStoriesPage] = useState(1)
  const [storiesTotalPages, setStoriesTotalPages] = useState(1)
  const [storiesTotal, setStoriesTotal] = useState(0)
  const ITEMS_PER_PAGE = 20
  
  // Form data
  const [brightBoxForm, setBrightBoxForm] = useState({
    title: '',
    mlTitle: '',
    urTitle: '',
    hinTitle: ''
  })
  
  const [brightBoxStoryForm, setBrightBoxStoryForm] = useState({
    title: '',
    mlTitle: '',
    urTitle: '',
    hinTitle: '',
    category: '',
    highlight: 'Disable',
    highlightExpiresAt: ''
  })

  // File upload states
  const [fileInputs, setFileInputs] = useState({})
  const [selectedFileNames, setSelectedFileNames] = useState({})

  // Schedule state
  const [scheduleEnabled, setScheduleEnabled] = useState(false)
  const [scheduledAt, setScheduledAt] = useState('')
  const [storyScheduleEnabled, setStoryScheduleEnabled] = useState(false)
  const [storyScheduledAt, setStoryScheduledAt] = useState('')

  // API Base URL
  const API_BASE = import.meta.env.VITE_API_BASE_URL 

  // ── Drag-and-drop reorder handlers ──────────────────────────────────────
  const handleBrightBoxDragStart = (_e, id) => {
    setDraggingBrightBoxId(id)
  }

  const handleBrightBoxDragOver = (e, targetId) => {
    e.preventDefault()
    if (!draggingBrightBoxId || draggingBrightBoxId === targetId) return
    setBrightBoxes((prev) => {
      const fromIndex = prev.findIndex((b) => b._id === draggingBrightBoxId)
      const toIndex = prev.findIndex((b) => b._id === targetId)
      if (fromIndex === -1 || toIndex === -1) return prev
      const updated = [...prev]
      const [moved] = updated.splice(fromIndex, 1)
      updated.splice(toIndex, 0, moved)
      return updated
    })
  }

  const handleBrightBoxDrop = async (e) => {
    e.preventDefault()
    setDraggingBrightBoxId(null)
    setPendingBbOrder(true)
  }

  const handleBrightBoxDragEnd = () => {
    setDraggingBrightBoxId(null)
  }

  const saveBrightBoxOrder = async () => {
    try {
      const token = localStorage.getItem('adminToken')
      await fetch(`${API_BASE}/bright-boxes/reorder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ brightBoxIds: brightBoxes.map((b) => b._id) })
      })
      setPendingBbOrder(false)
    } catch (err) {
      console.error('Failed to save bright box order:', err)
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  // ── BrightBox Stories drag-and-drop reorder ──────────────────────────────
  const handleBsDragStart = (_e, id) => {
    setDraggingBsId(id)
  }

  const handleBsDragOver = (e, targetId) => {
    e.preventDefault()
    if (!draggingBsId || draggingBsId === targetId) return
    setBrightBoxStories((prev) => {
      const fromIndex = prev.findIndex((s) => s._id === draggingBsId)
      const toIndex = prev.findIndex((s) => s._id === targetId)
      if (fromIndex === -1 || toIndex === -1) return prev
      const updated = [...prev]
      const [moved] = updated.splice(fromIndex, 1)
      updated.splice(toIndex, 0, moved)
      return updated
    })
  }

  const handleBsDrop = (e) => {
    e.preventDefault()
    setDraggingBsId(null)
    setPendingBsOrder(true)
  }

  const handleBsDragEnd = () => {
    setDraggingBsId(null)
  }

  const saveBsOrder = async () => {
    try {
      const token = localStorage.getItem('adminToken')
      await fetch(`${API_BASE}/bright-box-stories/reorder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ storyIds: brightBoxStories.map((s) => s._id) })
      })
      setPendingBsOrder(false)
    } catch (err) {
      console.error('Failed to save story order:', err)
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  // Fetch bright box categories with pagination
  const fetchBrightBoxes = async (page = bbPage) => {
    try {
      const response = await fetch(`${API_BASE}/bright-boxes?page=${page}&limit=${ITEMS_PER_PAGE}`)
      const data = await response.json()
      if (data.success) {
        setBrightBoxes(data.data.brightBoxes)
        if (data.data.pagination) {
          setBbTotalPages(data.data.pagination.totalPages)
          setBbTotal(data.data.pagination.totalBrightBoxes)
        }
      }
    } catch (error) {
      console.error('Error fetching bright boxes:', error)
    }
  }

  // Fetch bright box stories with pagination
  const fetchBrightBoxStories = async (page = storiesPage) => {
    try {
      const response = await fetch(`${API_BASE}/bright-box-stories?page=${page}&limit=${ITEMS_PER_PAGE}`)
      const data = await response.json()
      if (data.success) {
        setBrightBoxStories(data.data.brightBoxStories)
        if (data.data.pagination) {
          setStoriesTotalPages(data.data.pagination.totalPages)
          setStoriesTotal(data.data.pagination.totalBrightBoxStories)
        }
      }
    } catch (error) {
      console.error('Error fetching bright box stories:', error)
    }
  }

  const normalizeUrl = (url) => {
    if (!url) return ''
    // If starts with //, prefix https:
    if (url.startsWith('//')) return `https:${url}`
    // If missing protocol but looks like domain/path, prefix https://
    if (!/^https?:\/\//i.test(url)) return `https://${url.replace(/^\//, '')}`
    return url
  }

  const openFileInNewTab = (url) => {
    if (!url) return
    try {
      const absoluteUrl = normalizeUrl(url)
      window.open(absoluteUrl, '_blank', 'noopener,noreferrer')
    } catch (err) {
      console.error('Failed to open file:', err)
    }
  }

  // Download PDF: open a tab immediately to avoid popup blocking, then load URL
  const handleDownloadBrightBoxStoryPdf = async (storyId, lang = 'en') => {
    if (!storyId) return
    const downloadWindow = window.open('', '_blank', 'noopener,noreferrer')
    try {
      const res = await fetch(`${API_BASE}/bright-box-stories/${storyId}/download-pdf?lang=${encodeURIComponent(lang)}`)
      const data = await res.json()
      const url = data?.data?.downloadUrl
      if (data?.success && url) {
        if (downloadWindow) {
          downloadWindow.location = url
        } else {
          window.location.href = url
        }
      } else {
        if (downloadWindow) downloadWindow.close()
        showModal('error', data?.message || 'Could not get download link')
      }
    } catch (err) {
      if (downloadWindow) downloadWindow.close()
      showModal('error', 'Failed to get PDF download link')
    }
  }

  useEffect(() => {
    fetchBrightBoxes(bbPage)
  }, [bbPage])

  useEffect(() => {
    fetchBrightBoxStories(storiesPage)
  }, [storiesPage])

  // Fetch all stories for the selected category when the modal opens
  useEffect(() => {
    if (!expandedCategory) {
      setCategoryStories([])
      return
    }
    const fetchCategoryStories = async () => {
      setCategoryStoriesLoading(true)
      try {
        const response = await fetch(`${API_BASE}/bright-box-stories?category=${expandedCategory._id}&all=true`)
        const data = await response.json()
        if (data.success) {
          setCategoryStories(data.data.brightBoxStories)
        }
      } catch (error) {
        console.error('Error fetching category stories:', error)
      } finally {
        setCategoryStoriesLoading(false)
      }
    }
    fetchCategoryStories()
  }, [expandedCategory])

  // Modal functions
  const showModal = (type, message, onConfirm = null) => {
    setModal({ isOpen: true, type, message, onConfirm })
  }

  const closeModal = () => {
    setModal({ isOpen: false, type: 'success', message: '', onConfirm: null })
  }

  // BrightBox CRUD operations
  const createBrightBox = async (e) => {
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
        let imageUrl = ''
        if (fileInputs.image?.files?.[0]) {
          const fd = new FormData()
          fd.append('file', fileInputs.image.files[0])
          const upRes = await fetch(`${API_BASE}/admin/upload-file`, { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }, body: fd })
          const upData = await upRes.json()
          if (!upData.success) throw new Error('Failed to upload image')
          imageUrl = upData.url
        }
        const schedRes = await fetch(`${API_BASE}/schedule`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('adminToken')}` },
          body: JSON.stringify({
            contentType: 'bright-box',
            title: brightBoxForm.title || 'Bright Box',
            thumbnailUrl: imageUrl,
            contentData: { ...brightBoxForm, image: imageUrl },
            publishAt: scheduledAt
          })
        })
        const schedData = await schedRes.json()
        if (schedData.success) {
          showModal('success', `Bright Box scheduled for ${new Date(scheduledAt).toLocaleString()}`)
          resetBrightBoxForm()
          setShowBrightBoxForm(false)
        } else {
          showModal('error', schedData.message || 'Failed to schedule')
        }
        return
      }

      // --- Normal immediate upload flow ---
      const formData = new FormData()
      Object.keys(brightBoxForm).forEach(key => {
        if (brightBoxForm[key]) {
          formData.append(key, brightBoxForm[key])
        }
      })
      
      if (fileInputs.image && fileInputs.image.files[0]) {
        formData.append('image', fileInputs.image.files[0])
      }

      const response = await fetch(`${API_BASE}/bright-boxes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: formData
      })
      
      const data = await response.json()
      if (data.success) {
        showModal('success', 'Bright Box created successfully!')
        resetBrightBoxForm()
        setShowBrightBoxForm(false)
        setBbPage(1)
        fetchBrightBoxes(1)
      } else {
        showModal('error', data.message || 'Failed to create bright box')
      }
    } catch (error) {
      showModal('error', 'Error creating bright box')
    } finally {
      setLoading(false)
    }
  }

  const updateBrightBox = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const formData = new FormData()
      Object.keys(brightBoxForm).forEach(key => {
        if (brightBoxForm[key]) {
          formData.append(key, brightBoxForm[key])
        }
      })
      
      if (fileInputs.image && fileInputs.image.files[0]) {
        formData.append('image', fileInputs.image.files[0])
      }

      const response = await fetch(`${API_BASE}/bright-boxes/${editingBrightBox._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: formData
      })
      
      const data = await response.json()
      if (data.success) {
        showModal('success', 'Bright Box updated successfully!')
        resetBrightBoxForm()
        setShowBrightBoxForm(false)
        fetchBrightBoxes(bbPage)
      } else {
        showModal('error', data.message || 'Failed to update bright box')
      }
    } catch (error) {
      showModal('error', 'Error updating bright box')
    } finally {
      setLoading(false)
    }
  }

  const deleteBrightBox = async (id) => {
    showModal('confirmation', 'Are you sure you want to delete this bright box? This will also delete all stories in this category.', async () => {
      setLoading(true)
      try {
        const response = await fetch(`${API_BASE}/bright-boxes/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
          }
        })
        
        
        if (!response.ok) {
          const errorData = await response.json()
          console.error('Delete error response:', errorData)
          showModal('error', errorData.message || `Failed to delete bright box (${response.status})`)
          return
        }
        
        const data = await response.json()
        
        if (data.success) {
          showModal('success', 'Bright Box deleted successfully!')
          setBbPage(1)
          setStoriesPage(1)
          fetchBrightBoxes(1)
          fetchBrightBoxStories(1)
        } else {
          showModal('error', data.message || 'Failed to delete bright box')
        }
      } catch (error) {
        console.error('Delete bright box error:', error)
        showModal('error', `Error deleting bright box: ${error.message}`)
      } finally {
        setLoading(false)
      }
    })
  }

  // BrightBoxStory CRUD operations
  const createBrightBoxStory = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      // --- Scheduled upload flow ---
      if (storyScheduleEnabled) {
        if (!storyScheduledAt) {
          showModal('error', 'Please select a date and time to schedule this upload.')
          setLoading(false)
          return
        }
        // Upload all files first
        const fileFields = ['storyImage', 'enFile', 'mlFile', 'urFile', 'hinFile', 'adBanner', 'mlBanner', 'urBanner', 'hinBanner']
        const fileUrls = {}
        for (const fieldKey of fileFields) {
          if (fileInputs[fieldKey]?.files?.[0]) {
            const fd = new FormData()
            fd.append('file', fileInputs[fieldKey].files[0])
            const upRes = await fetch(`${API_BASE}/admin/upload-file`, { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }, body: fd })
            const upData = await upRes.json()
            if (!upData.success) throw new Error(`Failed to upload ${fieldKey}`)
            // Map fieldKey to model field name
            const modelKey = fieldKey === 'storyImage' ? 'image' : fieldKey
            fileUrls[modelKey] = upData.url
          }
        }
        const schedRes = await fetch(`${API_BASE}/schedule`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('adminToken')}` },
          body: JSON.stringify({
            contentType: 'bright-box-story',
            title: brightBoxStoryForm.title || 'Bright Box Story',
            thumbnailUrl: fileUrls.image || '',
            contentData: { ...brightBoxStoryForm, ...fileUrls },
            publishAt: storyScheduledAt
          })
        })
        const schedData = await schedRes.json()
        if (schedData.success) {
          showModal('success', `Bright Box Story scheduled for ${new Date(storyScheduledAt).toLocaleString()}`)
          resetBrightBoxStoryForm()
          setShowBrightBoxStoryForm(false)
        } else {
          showModal('error', schedData.message || 'Failed to schedule story')
        }
        return
      }

      // --- Normal immediate upload flow ---
      const formData = new FormData()
      Object.keys(brightBoxStoryForm).forEach(key => {
        if (brightBoxStoryForm[key]) {
          formData.append(key, brightBoxStoryForm[key])
        }
      })
      
      // Handle file uploads
      if (fileInputs.storyImage && fileInputs.storyImage.files[0]) {
        formData.append('image', fileInputs.storyImage.files[0])
      }
      if (fileInputs.enFile && fileInputs.enFile.files[0]) {
        formData.append('enFile', fileInputs.enFile.files[0])
      }
      if (fileInputs.mlFile && fileInputs.mlFile.files[0]) {
        formData.append('mlFile', fileInputs.mlFile.files[0])
      }
      if (fileInputs.urFile && fileInputs.urFile.files[0]) {
        formData.append('urFile', fileInputs.urFile.files[0])
      }
      if (fileInputs.hinFile && fileInputs.hinFile.files[0]) {
        formData.append('hinFile', fileInputs.hinFile.files[0])
      }
      if (fileInputs.adBanner && fileInputs.adBanner.files[0]) {
        formData.append('adBanner', fileInputs.adBanner.files[0])
      }
      if (fileInputs.mlBanner && fileInputs.mlBanner.files[0]) {
        formData.append('mlBanner', fileInputs.mlBanner.files[0])
      }
      if (fileInputs.urBanner && fileInputs.urBanner.files[0]) {
        formData.append('urBanner', fileInputs.urBanner.files[0])
      }
      if (fileInputs.hinBanner && fileInputs.hinBanner.files[0]) {
        formData.append('hinBanner', fileInputs.hinBanner.files[0])
      }

      const response = await fetch(`${API_BASE}/bright-box-stories`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: formData
      })
      
      const data = await response.json()
      if (data.success) {
        showModal('success', 'Bright Box Story created successfully!')
        resetBrightBoxStoryForm()
        setShowBrightBoxStoryForm(false)
        setStoriesPage(1)
        fetchBrightBoxStories(1)
        fetchBrightBoxes(bbPage)
      } else {
        showModal('error', data.message || 'Failed to create bright box story')
      }
    } catch (error) {
      showModal('error', 'Error creating bright box story')
    } finally {
      setLoading(false)
    }
  }

  const updateBrightBoxStory = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const formData = new FormData()
      Object.keys(brightBoxStoryForm).forEach(key => {
        if (brightBoxStoryForm[key]) {
          formData.append(key, brightBoxStoryForm[key])
        }
      })
      
      // Handle file uploads
      if (fileInputs.storyImage && fileInputs.storyImage.files[0]) {
        formData.append('image', fileInputs.storyImage.files[0])
      }
      if (fileInputs.enFile && fileInputs.enFile.files[0]) {
        formData.append('enFile', fileInputs.enFile.files[0])
      }
      if (fileInputs.mlFile && fileInputs.mlFile.files[0]) {
        formData.append('mlFile', fileInputs.mlFile.files[0])
      }
      if (fileInputs.urFile && fileInputs.urFile.files[0]) {
        formData.append('urFile', fileInputs.urFile.files[0])
      }
      if (fileInputs.hinFile && fileInputs.hinFile.files[0]) {
        formData.append('hinFile', fileInputs.hinFile.files[0])
      }
      if (fileInputs.adBanner && fileInputs.adBanner.files[0]) {
        formData.append('adBanner', fileInputs.adBanner.files[0])
      }
      if (fileInputs.mlBanner && fileInputs.mlBanner.files[0]) {
        formData.append('mlBanner', fileInputs.mlBanner.files[0])
      }
      if (fileInputs.urBanner && fileInputs.urBanner.files[0]) {
        formData.append('urBanner', fileInputs.urBanner.files[0])
      }
      if (fileInputs.hinBanner && fileInputs.hinBanner.files[0]) {
        formData.append('hinBanner', fileInputs.hinBanner.files[0])
      }

      const response = await fetch(`${API_BASE}/bright-box-stories/${editingBrightBoxStory._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: formData
      })
      
      const data = await response.json()
      if (data.success) {
        showModal('success', 'Bright Box Story updated successfully!')
        resetBrightBoxStoryForm()
        setShowBrightBoxStoryForm(false)
        fetchBrightBoxStories(storiesPage)
      } else {
        showModal('error', data.message || 'Failed to update bright box story')
      }
    } catch (error) {
      showModal('error', 'Error updating bright box story')
    } finally {
      setLoading(false)
    }
  }

  const deleteBrightBoxStory = async (id) => {
    showModal('confirmation', 'Are you sure you want to delete this bright box story?', async () => {
      setLoading(true)
      try {
        const response = await fetch(`${API_BASE}/bright-box-stories/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
          }
        })
        
        
        if (!response.ok) {
          const errorData = await response.json()
          console.error('Delete error response:', errorData)
          showModal('error', errorData.message || `Failed to delete bright box story (${response.status})`)
          return
        }
        
        const data = await response.json()
        
        if (data.success) {
          showModal('success', 'Bright Box Story deleted successfully!')
          // Refresh category modal list if open
          setCategoryStories(prev => prev.filter(s => s._id !== id))
          const newStoriesPage = brightBoxStories.length === 1 && storiesPage > 1 ? storiesPage - 1 : storiesPage
          setStoriesPage(newStoriesPage)
          fetchBrightBoxStories(newStoriesPage)
          fetchBrightBoxes(bbPage)
        } else {
          showModal('error', data.message || 'Failed to delete bright box story')
        }
      } catch (error) {
        console.error('Delete bright box story error:', error)
        showModal('error', `Error deleting bright box story: ${error.message}`)
      } finally {
        setLoading(false)
      }
    })
  }

  // Reset forms
  const resetBrightBoxForm = () => {
    setBrightBoxForm({
      title: '',
      mlTitle: '',
      urTitle: '',
      hinTitle: ''
    })
    setEditingBrightBox(null)
    setShowBrightBoxForm(false)
    setFileInputs(prev => ({ ...prev, image: null }))
    setSelectedFileNames(prev => ({ ...prev, image: '' }))
    setScheduleEnabled(false)
    setScheduledAt('')
  }

  const resetBrightBoxStoryForm = () => {
    setBrightBoxStoryForm({
      title: '',
      mlTitle: '',
      urTitle: '',
      hinTitle: '',
      category: '',
      highlight: 'Disable',
      highlightExpiresAt: ''
    })
    setEditingBrightBoxStory(null)
    setShowBrightBoxStoryForm(false)
    setFileInputs({})
    setSelectedFileNames({})
    setStoryScheduleEnabled(false)
    setStoryScheduledAt('')
  }

  // Edit handlers
  const editBrightBox = (brightBox) => {
    setEditingBrightBox(brightBox)
    setBrightBoxForm({
      title: brightBox.title || '',
      mlTitle: brightBox.mlTitle || '',
      urTitle: brightBox.urTitle || '',
      hinTitle: brightBox.hinTitle || ''
    })
    setSelectedFileNames(prev => ({ 
      ...prev, 
      image: brightBox.image ? brightBox.image.split('/').pop() : '' 
    }))
    setShowBrightBoxForm(true)
  }

  const editBrightBoxStory = (brightBoxStory) => {
    setEditingBrightBoxStory(brightBoxStory)
    setBrightBoxStoryForm({
      title: brightBoxStory.title || '',
      mlTitle: brightBoxStory.mlTitle || '',
      urTitle: brightBoxStory.urTitle || '',
      hinTitle: brightBoxStory.hinTitle || '',
      category: brightBoxStory.category?._id || '',
      highlight: brightBoxStory.highlight || 'Disable',
      highlightExpiresAt: brightBoxStory.highlightExpiresAt || ''
    })
    setSelectedFileNames({
      storyImage: brightBoxStory.image ? brightBoxStory.image.split('/').pop() : '',
      enFile: brightBoxStory.enFile ? brightBoxStory.enFile.split('/').pop() : '',
      mlFile: brightBoxStory.mlFile ? brightBoxStory.mlFile.split('/').pop() : '',
      urFile: brightBoxStory.urFile ? brightBoxStory.urFile.split('/').pop() : '',
      hinFile: brightBoxStory.hinFile ? brightBoxStory.hinFile.split('/').pop() : '',
      adBanner: brightBoxStory.adBanner ? brightBoxStory.adBanner.split('/').pop() : '',
      mlBanner: brightBoxStory.mlBanner ? brightBoxStory.mlBanner.split('/').pop() : '',
      urBanner: brightBoxStory.urBanner ? brightBoxStory.urBanner.split('/').pop() : '',
      hinBanner: brightBoxStory.hinBanner ? brightBoxStory.hinBanner.split('/').pop() : ''
    })
    setShowBrightBoxStoryForm(true)
  }

  const viewBrightBoxStory = (story) => {
    setSelectedBrightBoxStory(story)
    setShowStoryDetails(true)
  }

  // Get stories for a category
  const getStoriesByCategory = (categoryId) => {
    return brightBoxStories.filter(story => story.category?._id === categoryId)
  }

  return (
    <div className="min-h-screen bg-black flex overflow-hidden">
      {/* Sidebar */}
      <Sidebar />
      
      <div className="flex-1 min-w-0 ml-0 md:ml-56 pb-20 md:pb-0 h-screen overflow-y-auto scrollbar-hide">
        {/* Page Header */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <div>
              <h1 
                className="text-white text-3xl sm:text-4xl lg:text-3xl sm:text-4xl lg:text-5xl font-bold mb-1 relative"
                style={{ fontFamily: 'Archivo Black' }}
              >
                Bright Box
                <div 
                  className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 h-0.5 w-32"
                  style={{
                    background: 'linear-gradient(90.05deg, #AC28DC 6.68%, #7E1EB7 49.26%, #501392 91.85%)'
                  }}
                ></div>
              </h1>
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <button
                onClick={() => setShowBrightBoxStoryForm(true)}
                className="flex items-center justify-center space-x-2 text-white transition duration-200"
                style={{
                  background: 'linear-gradient(90.05deg, #501392 6.68%, #3B0F73 49.26%, #2A0A5C 91.85%)',
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
                <FiPlus className="w-3 h-3" />
                <span>Add Story</span>
              </button>
              <button
                onClick={() => setShowBrightBoxForm(true)}
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
                <span>Add Category</span>
              </button>
            </div>
          </div>
        </div>

        {/* Bright Box Categories Section */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="mb-8">
            <h2 
              className="text-white text-xl sm:text-2xl font-bold mb-4 sm:mb-6 relative"
              style={{ fontFamily: 'Archivo Black' }}
            >
              Bright Box Categories
              <div 
                className="absolute -bottom-1 left-0 h-0.5 w-24"
                style={{
                  background: 'linear-gradient(90.05deg, #AC28DC 6.68%, #7E1EB7 49.26%, #501392 91.85%)'
                }}
              ></div>
            </h2>
            
            {brightBoxes.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 text-lg mb-6">No categories found</div>
                <button
                  onClick={() => setShowBrightBoxForm(true)}
                  className="flex items-center space-x-2 mx-auto px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition duration-200"
                >
                  <FiPlus className="w-4 h-4" />
                  <span>Add Your First Category</span>
                </button>
              </div>
             ) : (
               <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4 mb-4">
                 {/* Category Cards - Limited Display */}
                 {brightBoxes.slice(0, 5).map((brightBox) => {
                   const storyCount = brightBox.storyCount ?? 0
                   
                   return (
                     <div 
                       key={brightBox._id}
                       onClick={() => setExpandedCategory(brightBox)}
                       className="relative bg-gray-900 rounded-lg overflow-hidden transition-all duration-300 cursor-pointer border-2 border-transparent hover:border-gray-600 hover:scale-105 hover:shadow-2xl"
                     >
                       {/* Category Image */}
                       <div className="relative h-24 sm:h-32 overflow-hidden">
                         {brightBox.image ? (
                           <img
                             src={resolveImageUrl(brightBox.image)}
                             alt={brightBox.title}
                             className="w-full h-full object-cover transition duration-300"
                           />
                         ) : (
                           <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                             <FiFolder className="w-10 h-10 text-gray-500" />
                           </div>
                         )}
                       </div>

                       {/* Category Info */}
                       <div className="p-2.5 sm:p-4">
                         <h3 className="text-white text-sm font-semibold truncate mb-2">
                           {brightBox.title}
                         </h3>
                         <div className="flex items-center space-x-1 text-purple-400">
                           <FiFile className="w-3 h-3" />
                           <span className="text-xs">{storyCount} stories</span>
                         </div>
                       </div>
                     </div>
                   )
                 })}

                 {/* Management Card - Always Last */}
                 <div 
                   onClick={() => setShowCategoryTable(!showCategoryTable)}
                   className={`relative bg-gray-900 rounded-lg overflow-hidden transition-all duration-300 cursor-pointer border-2 ${
                     showCategoryTable 
                       ? 'border-purple-500 scale-105 shadow-2xl' 
                       : 'border-dashed border-gray-600 hover:border-purple-500 hover:scale-105 hover:shadow-2xl'
                   }`}
                 >
                   <div className="relative h-full min-h-[120px] sm:min-h-[176px] w-full flex items-center justify-center p-2">
                     <div className="flex flex-col items-center justify-center">
                       <div className={`w-12 h-12 mb-3 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                         showCategoryTable 
                           ? 'bg-purple-600/30 border-purple-400' 
                           : 'bg-purple-600/20 border-purple-500/30'
                       }`}>
                         <svg 
                           className={`w-6 h-6 text-purple-400 transition-transform duration-300 ${
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
                       <p className="text-white text-sm font-semibold text-center">View All</p>
                       <p className="text-gray-400 text-xs text-center">Categories</p>
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
              <div className="p-4 sm:p-6">
                {/* Header with Close Button */}
                <div className="flex flex-wrap justify-between items-start gap-3 mb-6">
                  <div className="flex-1">
                    <h1 className="text-white text-2xl font-bold mb-2" style={{ fontFamily: 'Archivo Black' }}>
                      Category Management
                    </h1>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => {
                        setShowBrightBoxForm(true)
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
                  <div className="max-h-[60vh] overflow-y-auto overflow-x-auto scrollbar-hide scroll-smooth">
                    {pendingBbOrder && (
                      <div className="flex items-center justify-between px-4 py-2 mb-2 bg-green-500/10 border border-green-500/40 rounded-xl">
                        <span className="text-green-400 text-sm font-medium">Drag to reorder — save when done</span>
                        <button
                          onClick={saveBrightBoxOrder}
                          className="px-4 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-lg transition"
                        >
                          Save Order
                        </button>
                      </div>
                    )}
                    <table className="w-full">
                      <thead className="sticky top-0 bg-transparent backdrop-blur-sm z-10">
                        <tr className="border-b border-gray-700/50">
                          <th className="text-left py-3 px-2 sm:px-4 text-gray-300 font-semibold w-8"></th>
                          <th className="text-left py-3 px-2 sm:px-4 text-gray-300 font-semibold">Image</th>
                          <th className="text-left py-3 px-2 sm:px-4 text-gray-300 font-semibold">Title</th>
                          <th className="text-left py-3 px-2 sm:px-4 text-gray-300 font-semibold">Stories</th>
                          <th className="text-left py-3 px-2 sm:px-4 text-gray-300 font-semibold">Created</th>
                          <th className="text-left py-3 px-2 sm:px-4 text-gray-300 font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {brightBoxes.map((brightBox) => {
                          const totalStories = brightBox.storyCount ?? 0
                          
                          return (
                            <tr
                              key={brightBox._id}
                              draggable
                              onDragStart={(e) => handleBrightBoxDragStart(e, brightBox._id)}
                              onDragOver={(e) => handleBrightBoxDragOver(e, brightBox._id)}
                              onDrop={handleBrightBoxDrop}
                              onDragEnd={handleBrightBoxDragEnd}
                                                          className={`border-b transition duration-200 ${
                                draggingBrightBoxId === brightBox._id
                                  ? 'opacity-50 bg-purple-500/10 border-purple-500/50'
                                  : pendingBbOrder
                                    ? 'border-green-500/40 hover:bg-gray-800/30'
                                    : 'border-gray-800/50 hover:bg-gray-800/30'
                              }`}
                            >
                              {/* Drag handle */}
                              <td className="py-4 px-4 w-8">
                                <div className="cursor-grab active:cursor-grabbing text-gray-500 hover:text-gray-300 flex items-center justify-center">
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                    <path d="M10 4h.01M14 4h.01M10 9h.01M14 9h.01M10 14h.01M14 14h.01M10 19h.01M14 19h.01" />
                                  </svg>
                                </div>
                              </td>
                              <td className="py-4 px-4">
                                {brightBox.image ? (
                                  <img
                                    src={resolveImageUrl(brightBox.image)}
                                    alt={brightBox.title}
                                    className="w-12 h-12 object-cover rounded-lg"
                                  />
                                ) : (
                                  <div className="w-12 h-12 bg-gray-800 rounded-lg flex items-center justify-center">
                                    <FiFolder className="w-6 h-6 text-gray-500" />
                                  </div>
                                )}
                              </td>
                              <td className="py-4 px-4">
                                <span className="text-white font-medium">{brightBox.title}</span>
                              </td>
                              <td className="py-4 px-4">
                                <span className="text-gray-400">
                                  {totalStories}
                                </span>
                              </td>
                              <td className="py-4 px-4">
                                <span className="text-gray-400 text-sm">
                                  {new Date(brightBox.createdAt).toLocaleDateString('en-US', {
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
                                      setExpandedCategory(brightBox)
                                      setShowCategoryTable(false)
                                    }}
                                    className="p-2 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition duration-200"
                                    title="View Details"
                                  >
                                    <FiEye className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      editBrightBox(brightBox)
                                      setShowCategoryTable(false)
                                    }}
                                    className="p-2 text-gray-400 hover:text-purple-400 hover:bg-purple-500/10 rounded-lg transition duration-200"
                                    title="Edit Category"
                                  >
                                    <FiEdit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      deleteBrightBox(brightBox._id)
                                      setShowCategoryTable(false)
                                    }}
                                    className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition duration-200"
                                    title="Delete Category"
                                  >
                                    <FiTrash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                
                {brightBoxes.length === 0 && (
                  <div className="text-center py-12">
                    <div className="text-gray-400 text-lg mb-4">No categories found</div>
                    <button
                      onClick={() => {
                        setShowBrightBoxForm(true)
                        setShowCategoryTable(false)
                      }}
                      className="flex items-center space-x-2 mx-auto px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition duration-200"
                    >
                      <FiPlus className="w-4 h-4" />
                      <span>Add Category</span>
                    </button>
                  </div>
                )}

                {/* Categories Pagination */}
                {bbTotalPages > 1 && (
                  <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-gray-400 text-sm">
                      Showing {Math.min((bbPage - 1) * ITEMS_PER_PAGE + 1, bbTotal)}–{Math.min(bbPage * ITEMS_PER_PAGE, bbTotal)} of {bbTotal}
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setBbPage(p => Math.max(1, p - 1))}
                        disabled={bbPage === 1}
                        className="px-3 py-2 rounded-xl text-sm font-medium transition duration-200 disabled:opacity-30 disabled:cursor-not-allowed text-gray-300 hover:text-white hover:bg-gray-700/60"
                      >
                        ← Prev
                      </button>
                      {(() => {
                        const pages = []
                        const delta = 2
                        const left = Math.max(2, bbPage - delta)
                        const right = Math.min(bbTotalPages - 1, bbPage + delta)
                        pages.push(1)
                        if (left > 2) pages.push('...')
                        for (let i = left; i <= right; i++) pages.push(i)
                        if (right < bbTotalPages - 1) pages.push('...')
                        if (bbTotalPages > 1) pages.push(bbTotalPages)
                        return pages.map((p, idx) =>
                          p === '...' ? (
                            <span key={`bbe-${idx}`} className="px-2 py-2 text-gray-500 text-sm select-none">…</span>
                          ) : (
                            <button
                              key={p}
                              onClick={() => setBbPage(p)}
                              className={`w-9 h-9 rounded-xl text-sm font-semibold transition duration-200 ${
                                bbPage === p ? 'text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700/60'
                              }`}
                              style={bbPage === p ? { background: 'linear-gradient(90.05deg, #AC28DC 6.68%, #7E1EB7 49.26%, #501392 91.85%)' } : {}}
                            >
                              {p}
                            </button>
                          )
                        )
                      })()}
                      <button
                        onClick={() => setBbPage(p => Math.min(bbTotalPages, p + 1))}
                        disabled={bbPage === bbTotalPages}
                        className="px-3 py-2 rounded-xl text-sm font-medium transition duration-200 disabled:opacity-30 disabled:cursor-not-allowed text-gray-300 hover:text-white hover:bg-gray-700/60"
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* All Stories Section */}
        {brightBoxStories.length > 0 && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-8">
              <h2 
                className="text-white text-2xl font-bold mb-2 relative"
                style={{ fontFamily: 'Archivo Black' }}
              >
                All Stories
                <div 
                  className="absolute -bottom-1 left-0 h-0.5 w-24"
                  style={{
                    background: 'linear-gradient(90.05deg, #AC28DC 6.68%, #7E1EB7 49.26%, #501392 91.85%)'
                  }}
                ></div>
              </h2>
            </div>

            {/* Stories Row - Limited Display */}
            <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-7 gap-3 sm:gap-4">
              {/* Display first 5 stories */}
              {brightBoxStories.slice(0, 5).map((story) => (
                <div 
                  key={story._id} 
                  onClick={() => setExpandedStory(story)}
                  className="bg-gradient-to-br from-gray-900/80 to-gray-800/60 backdrop-blur-sm border border-gray-700/50 rounded-2xl overflow-hidden hover:border-purple-500/50 transition-all duration-300 group cursor-pointer"
                >
                  {/* Story Image */}
                  <div className="relative h-24 sm:h-32 bg-gradient-to-br from-green-600/20 to-blue-600/20 overflow-hidden">
                    {story.image ? (
                      <img
                        src={resolveImageUrl(story.image)}
                        alt={story.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FiFile className="w-10 h-10 text-green-400/50" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                  </div>

                  {/* Story Content */}
                  <div className="p-2.5 sm:p-4">
                    <div className="mb-2">
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="text-white text-sm font-bold truncate flex-1" style={{ fontFamily: 'Archivo Black' }}>
                          {story.title}
                        </h4>
                        {story.highlight === 'Enable' && (
                          <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs font-semibold rounded-full whitespace-nowrap">
                            Highlighted
                          </span>
                        )}
                      </div>
                    </div>

                    {/* File Count */}
                    <div className="flex items-center space-x-1 text-xs text-purple-400">
                      <FiFile className="w-3 h-3" />
                      <span>
                        {[story.enFile, story.mlFile, story.urFile, story.hinFile].filter(Boolean).length} files
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {/* Management Card - Always Last */}
              <div 
                onClick={() => setShowStoriesTable(!showStoriesTable)}
                className={`relative bg-gray-900 rounded-lg overflow-hidden transition-all duration-300 cursor-pointer border-2 ${
                  showStoriesTable 
                    ? 'border-purple-500 scale-105 shadow-2xl' 
                    : 'border-dashed border-gray-600 hover:border-purple-500 hover:scale-105 hover:shadow-2xl'
                }`}
              >
                <div className="relative h-full min-h-[120px] sm:min-h-[176px] w-full flex items-center justify-center p-2">
                  <div className="flex flex-col items-center justify-center">
                    <div className={`w-12 h-12 mb-3 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                      showStoriesTable 
                        ? 'bg-purple-600/30 border-purple-400' 
                        : 'bg-purple-600/20 border-purple-500/30'
                    }`}>
                      <svg 
                        className={`w-6 h-6 text-purple-400 transition-transform duration-300 ${
                          showStoriesTable ? 'rotate-90' : 'rotate-0'
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
                    <p className="text-white text-sm font-semibold text-center">View All</p>
                    <p className="text-gray-400 text-xs text-center">Stories</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Gradient Background */}
        <div className="fixed -bottom-80 right-0 z-10 pointer-events-none">
          <img 
            src={gradient} 
            alt="Gradient" 
            className="w-[350px] h-[350px] md:w-[800px] md:h-[800px] opacity-60"
          />
        </div>
      </div>

      {/* Expanded Category Details Modal */}
      {expandedCategory && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
          <div className="bg-gray-900/80 backdrop-blur-lg rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-600/50 scrollbar-hide scroll-smooth">
            <div className="p-4 sm:p-6">
              {/* Header with Close Button */}
              <div className="flex flex-wrap justify-between items-start gap-3 mb-6">
                <div className="flex-1">
                  <h1 className="text-white text-2xl font-bold mb-2" style={{ fontFamily: 'Archivo Black' }}>
                    {expandedCategory.title}
                  </h1>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-400">
                    <div className="flex items-center space-x-1">
                      <FiFile className="w-4 h-4 text-green-400" />
                      <span>{categoryStoriesLoading ? '…' : categoryStories.length} stories</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setExpandedCategory(null)}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition duration-200"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>

              {/* Stories in this category */}
              <div className="mb-6">
                <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                  <h3 className="text-white text-lg font-semibold" style={{ fontFamily: 'Archivo Black' }}>
                    Stories
                  </h3>
                  <button
                    onClick={() => {
                      setBrightBoxStoryForm(prev => ({ ...prev, category: expandedCategory._id }))
                      setShowBrightBoxStoryForm(true)
                      setExpandedCategory(null)
                    }}
                    className="flex items-center space-x-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition duration-200 text-sm"
                  >
                    <FiPlus className="w-4 h-4" />
                    <span>Add Story</span>
                  </button>
                </div>
                {categoryStoriesLoading ? (
                  <SkeletonCards count={4} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" />
                ) : categoryStories.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-400 text-sm mb-4">No stories in this category yet</p>
                    <button
                      onClick={() => {
                        setBrightBoxStoryForm(prev => ({ ...prev, category: expandedCategory._id }))
                        setShowBrightBoxStoryForm(true)
                        setExpandedCategory(null)
                      }}
                      className="flex items-center space-x-2 mx-auto px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition duration-200 text-sm"
                    >
                      <FiPlus className="w-4 h-4" />
                      <span>Add First Story</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {categoryStories.map((story) => (
                      <div key={story._id} className="flex items-center justify-between bg-gray-800/50 rounded-lg border border-gray-700/50 p-3 hover:bg-gray-800/70 transition duration-200">
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          {story.image ? (
                            <img src={resolveImageUrl(story.image)} alt={story.title} className="w-10 h-10 object-cover rounded" />
                          ) : (
                            <div className="w-10 h-10 bg-gray-700 rounded flex items-center justify-center">
                              <FiFile className="w-5 h-5 text-gray-500" />
                            </div>
                          )}
                          <span className="text-white font-medium truncate">{story.title}</span>
                        </div>
                        <div className="flex items-center space-x-2 flex-shrink-0">
                          <button
                            onClick={() => { setExpandedStory(story); setExpandedCategory(null) }}
                            className="p-1 text-gray-400 hover:text-green-400 rounded"
                            title="View"
                          >
                            <FiEye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { editBrightBoxStory(story); setExpandedCategory(null) }}
                            className="p-1 text-gray-400 hover:text-purple-400 rounded"
                            title="Edit"
                          >
                            <FiEdit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteBrightBoxStory(story._id)}
                            className="p-1 text-gray-400 hover:text-red-400 rounded"
                            title="Delete"
                          >
                            <FiTrash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Footer with Date and Action Icons */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-700/50">
                {/* Create Date */}
                <div className="flex items-center space-x-1 text-sm text-gray-400">
                  <span>
                    {new Date(expandedCategory.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </span>
                </div>
                
                {/* Action Icons */}
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => {
                      editBrightBox(expandedCategory)
                      setExpandedCategory(null)
                    }}
                    className="p-2 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 rounded-lg transition duration-200"
                    title="Edit Category"
                  >
                    <FiEdit className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      deleteBrightBox(expandedCategory._id)
                      setExpandedCategory(null)
                    }}
                    className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition duration-200"
                    title="Delete Category"
                  >
                    <FiTrash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expanded Story Details Modal */}
      {expandedStory && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
          <div className="bg-gray-900/80 backdrop-blur-lg rounded-2xl w-full max-w-4xl max-h-[85vh] overflow-y-auto shadow-2xl border border-gray-600/50 scrollbar-hide scroll-smooth">
            <div className="p-4 sm:p-6">
              {/* Header with Close Button */}
              <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h1 className="text-white text-2xl font-bold" style={{ fontFamily: 'Archivo Black' }}>
                      {expandedStory.title}
                    </h1>
                    {expandedStory.highlight === 'Enable' && (
                      <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 text-xs font-semibold rounded-full">
                        Highlighted
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-1 text-sm text-gray-400">
                    <span className="text-purple-400">{expandedStory.category?.title}</span>
                  </div>
                </div>
                <button
                  onClick={() => setExpandedStory(null)}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition duration-200"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>

              {/* Story Image - Full View */}
              {expandedStory.image && (
                <div className="mb-4">
                  <div className="relative h-80 bg-gradient-to-br from-green-600/20 to-blue-600/20 rounded-lg overflow-hidden">
                    <img
                      src={resolveImageUrl(expandedStory.image)}
                      alt={expandedStory.title}
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                  </div>
                </div>
              )}

              {/* Story Details - Compact */}
              <div className="mb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {expandedStory.mlTitle && (
                    <div className="bg-gray-800/50 rounded-lg p-3">
                      <h4 className="text-purple-400 text-sm font-medium mb-1">Malayalam Title</h4>
                      <p className="text-white text-sm">{expandedStory.mlTitle}</p>
                    </div>
                  )}
                  {expandedStory.urTitle && (
                    <div className="bg-gray-800/50 rounded-lg p-3">
                      <h4 className="text-purple-400 text-sm font-medium mb-1">Urdu Title</h4>
                      <p className="text-white text-sm">{expandedStory.urTitle}</p>
                    </div>
                  )}
                  {expandedStory.hinTitle && (
                    <div className="bg-gray-800/50 rounded-lg p-3">
                      <h4 className="text-purple-400 text-sm font-medium mb-1">Hindi Title</h4>
                      <p className="text-white text-sm">{expandedStory.hinTitle}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* File Information - Compact */}
              <div className="mb-4">
                <h3 className="text-white text-lg font-semibold mb-3" style={{ fontFamily: 'Archivo Black' }}>
                  Available Files
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {expandedStory.enFile && (
                    <div
                      className="bg-gray-800/50 rounded-lg p-3 text-center cursor-pointer hover:bg-gray-800/70 transition"
                      onClick={() => openFileInNewTab(expandedStory.enFile)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && openFileInNewTab(expandedStory.enFile)}
                    >
                      <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                        <FiFile className="w-5 h-5 text-blue-400" />
                      </div>
                      <h4 className="text-blue-400 text-sm font-medium">English</h4>
                    </div>
                  )}
                  {expandedStory.mlFile && (
                    <div
                      className="bg-gray-800/50 rounded-lg p-3 text-center cursor-pointer hover:bg-gray-800/70 transition"
                      onClick={() => openFileInNewTab(expandedStory.mlFile)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && openFileInNewTab(expandedStory.mlFile)}
                    >
                      <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                        <FiFile className="w-5 h-5 text-green-400" />
                      </div>
                      <h4 className="text-green-400 text-sm font-medium">Malayalam</h4>
                    </div>
                  )}
                  {expandedStory.urFile && (
                    <div
                      className="bg-gray-800/50 rounded-lg p-3 text-center cursor-pointer hover:bg-gray-800/70 transition"
                      onClick={() => openFileInNewTab(expandedStory.urFile)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && openFileInNewTab(expandedStory.urFile)}
                    >
                      <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                        <FiFile className="w-5 h-5 text-purple-400" />
                      </div>
                      <h4 className="text-purple-400 text-sm font-medium">Urdu</h4>
                    </div>
                  )}
                  {expandedStory.hinFile && (
                    <div
                      className="bg-gray-800/50 rounded-lg p-3 text-center cursor-pointer hover:bg-gray-800/70 transition"
                      onClick={() => openFileInNewTab(expandedStory.hinFile)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && openFileInNewTab(expandedStory.hinFile)}
                    >
                      <div className="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                        <FiFile className="w-5 h-5 text-orange-400" />
                      </div>
                      <h4 className="text-orange-400 text-sm font-medium">Hindi</h4>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {expandedStory.enFile && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDownloadBrightBoxStoryPdf(expandedStory._id, 'en') }}
                      className="px-3 py-1.5 bg-purple-600/80 hover:bg-purple-600 text-white text-sm rounded-lg"
                    >
                      Download PDF (EN)
                    </button>
                  )}
                  {expandedStory.mlFile && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDownloadBrightBoxStoryPdf(expandedStory._id, 'ml') }}
                      className="px-3 py-1.5 bg-purple-600/80 hover:bg-purple-600 text-white text-sm rounded-lg"
                    >
                      Download PDF (ML)
                    </button>
                  )}
                  {expandedStory.urFile && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDownloadBrightBoxStoryPdf(expandedStory._id, 'ur') }}
                      className="px-3 py-1.5 bg-purple-600/80 hover:bg-purple-600 text-white text-sm rounded-lg"
                    >
                      Download PDF (UR)
                    </button>
                  )}
                  {expandedStory.hinFile && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDownloadBrightBoxStoryPdf(expandedStory._id, 'hin') }}
                      className="px-3 py-1.5 bg-purple-600/80 hover:bg-purple-600 text-white text-sm rounded-lg"
                    >
                      Download PDF (HIN)
                    </button>
                  )}
                </div>
              </div>

              {/* Banners Section */}
              {(expandedStory.adBanner || expandedStory.mlBanner || expandedStory.urBanner || expandedStory.hinBanner) && (
                <div className="mb-4">
                  <h3 className="text-white text-lg font-semibold mb-3" style={{ fontFamily: 'Archivo Black' }}>
                    Ad Banners
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {expandedStory.adBanner && (
                      <div
                        className="bg-gray-800/50 rounded-lg p-2 cursor-pointer hover:bg-gray-800/70 transition"
                        onClick={() => openFileInNewTab(expandedStory.adBanner)}
                      >
                        <img src={expandedStory.adBanner} alt="Ad Banner" className="w-full h-20 object-cover rounded mb-1" />
                        <h4 className="text-yellow-400 text-xs font-medium text-center">English</h4>
                      </div>
                    )}
                    {expandedStory.mlBanner && (
                      <div
                        className="bg-gray-800/50 rounded-lg p-2 cursor-pointer hover:bg-gray-800/70 transition"
                        onClick={() => openFileInNewTab(expandedStory.mlBanner)}
                      >
                        <img src={expandedStory.mlBanner} alt="ML Banner" className="w-full h-20 object-cover rounded mb-1" />
                        <h4 className="text-yellow-400 text-xs font-medium text-center">Malayalam</h4>
                      </div>
                    )}
                    {expandedStory.urBanner && (
                      <div
                        className="bg-gray-800/50 rounded-lg p-2 cursor-pointer hover:bg-gray-800/70 transition"
                        onClick={() => openFileInNewTab(expandedStory.urBanner)}
                      >
                        <img src={expandedStory.urBanner} alt="UR Banner" className="w-full h-20 object-cover rounded mb-1" />
                        <h4 className="text-yellow-400 text-xs font-medium text-center">Urdu</h4>
                      </div>
                    )}
                    {expandedStory.hinBanner && (
                      <div
                        className="bg-gray-800/50 rounded-lg p-2 cursor-pointer hover:bg-gray-800/70 transition"
                        onClick={() => openFileInNewTab(expandedStory.hinBanner)}
                      >
                        <img src={expandedStory.hinBanner} alt="HIN Banner" className="w-full h-20 object-cover rounded mb-1" />
                        <h4 className="text-yellow-400 text-xs font-medium text-center">Hindi</h4>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Footer with Date and Action Icons */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-700/50">
                {/* Create Date */}
                <div className="flex items-center space-x-1 text-sm text-gray-400">
                  <span>
                    {new Date(expandedStory.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </span>
                </div>
                
                {/* Action Icons */}
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => {
                      editBrightBoxStory(expandedStory)
                      setExpandedStory(null)
                    }}
                    className="p-2 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 rounded-lg transition duration-200"
                    title="Edit Story"
                  >
                    <FiEdit className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      deleteBrightBoxStory(expandedStory._id)
                      setExpandedStory(null)
                    }}
                    className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition duration-200"
                    title="Delete Story"
                  >
                    <FiTrash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expandable Stories Management Container */}
      {showStoriesTable && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
          <div className="bg-gray-900/80 backdrop-blur-lg rounded-2xl w-full max-w-5xl max-h-[95vh] overflow-y-auto shadow-2xl border border-gray-600/50 scrollbar-hide scroll-smooth animate-in slide-in-from-top-4 duration-500 ease-out">
            <div className="p-4 sm:p-6">
              {/* Header */}
              <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
                <h2 className="text-white text-2xl font-bold" style={{ fontFamily: 'Archivo Black' }}>
                  Stories Management
                </h2>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => setShowBrightBoxStoryForm(true)}
                    className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition duration-200 text-sm font-medium"
                  >
                    <FiPlus className="w-4 h-4" />
                    <span>Add Story</span>
                  </button>
                  <button
                    onClick={() => setShowStoriesTable(false)}
                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition duration-200"
                  >
                    <FiX className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Stories Table */}
              {brightBoxStories.length > 0 ? (
                <div className="overflow-x-auto">
                  {pendingBsOrder && (
                    <div className="flex items-center justify-between px-4 py-2 mb-2 bg-green-500/10 border border-green-500/40 rounded-xl">
                      <span className="text-green-400 text-sm font-medium">Drag to reorder — save when done</span>
                      <button
                        onClick={saveBsOrder}
                        className="px-4 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-lg transition"
                      >
                        Save Order
                      </button>
                    </div>
                  )}
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-700/50">
                        <th className="text-left py-3 px-2 sm:px-4 text-gray-400 font-medium w-8"></th>
                        <th className="text-left py-3 px-2 sm:px-4 text-gray-400 font-medium">Image</th>
                        <th className="text-left py-3 px-2 sm:px-4 text-gray-400 font-medium">Title</th>
                        <th className="text-left py-3 px-2 sm:px-4 text-gray-400 font-medium">Category</th>
                        <th className="text-left py-3 px-2 sm:px-4 text-gray-400 font-medium">Files</th>
                        <th className="text-left py-3 px-2 sm:px-4 text-gray-400 font-medium">Created</th>
                        <th className="text-left py-3 px-2 sm:px-4 text-gray-400 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {brightBoxStories.map((story) => (
                        <tr
                          key={story._id}
                          draggable
                          onDragStart={(e) => handleBsDragStart(e, story._id)}
                          onDragOver={(e) => handleBsDragOver(e, story._id)}
                          onDrop={handleBsDrop}
                          onDragEnd={handleBsDragEnd}
                          className={`border-b transition duration-200 ${
                            draggingBsId === story._id
                              ? 'opacity-50 bg-purple-500/10 border-purple-500/50'
                              : pendingBsOrder
                                ? 'border-green-500/40 hover:bg-gray-800/30'
                                : 'border-gray-800/50 hover:bg-gray-800/30'
                          }`}
                        >
                          {/* Drag handle */}
                          <td className="py-3 px-4 w-8">
                            <div className="cursor-grab active:cursor-grabbing text-gray-500 hover:text-gray-300 flex items-center justify-center">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <path d="M10 4h.01M14 4h.01M10 9h.01M14 9h.01M10 14h.01M14 14h.01M10 19h.01M14 19h.01" />
                              </svg>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-green-600/20 to-blue-600/20 rounded-lg overflow-hidden">
                              {story.image ? (
                                <img
                                  src={resolveImageUrl(story.image)}
                                  alt={story.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <FiFile className="w-6 h-6 text-green-400/50" />
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div>
                              <div className="flex items-center space-x-2">
                                <h4 className="text-white font-medium text-sm">{story.title}</h4>
                                {story.highlight === 'Enable' && (
                                  <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs font-semibold rounded-full">
                                    Highlighted
                                  </span>
                                )}
                              </div>
                              {story.mlTitle && (
                                <p className="text-gray-400 text-xs">{story.mlTitle}</p>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-purple-400 text-sm">
                              {story.category?.title || 'N/A'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-1">
                              <FiFile className="w-4 h-4 text-green-400" />
                              <span className="text-gray-400 text-sm">
                                {[story.enFile, story.mlFile, story.urFile, story.hinFile].filter(Boolean).length}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-gray-400 text-sm">
                              {new Date(story.createdAt).toLocaleDateString()}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => {
                                  setExpandedStory(story)
                                  setShowStoriesTable(false)
                                }}
                                className="p-1 text-gray-400 hover:text-green-400 rounded transition duration-200"
                                title="View Details"
                              >
                                <FiEye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  editBrightBoxStory(story)
                                  setShowStoriesTable(false)
                                }}
                                className="p-1 text-gray-400 hover:text-purple-400 rounded transition duration-200"
                                title="Edit Story"
                              >
                                <FiEdit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => deleteBrightBoxStory(story._id)}
                                className="p-1 text-gray-400 hover:text-red-400 rounded transition duration-200"
                                title="Delete Story"
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
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FiFile className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-white text-lg font-medium mb-2">No Stories Found</h3>
                  <p className="text-gray-400 text-sm mb-6">Get started by creating your first story</p>
                  <button
                    onClick={() => setShowBrightBoxStoryForm(true)}
                    className="flex items-center space-x-2 mx-auto px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition duration-200 text-sm font-medium"
                  >
                    <FiPlus className="w-4 h-4" />
                    <span>Add First Story</span>
                  </button>
                </div>
              )}

              {/* Stories Pagination */}
              {storiesTotalPages > 1 && (
                <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <p className="text-gray-400 text-sm">
                    Showing {Math.min((storiesPage - 1) * ITEMS_PER_PAGE + 1, storiesTotal)}–{Math.min(storiesPage * ITEMS_PER_PAGE, storiesTotal)} of {storiesTotal}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setStoriesPage(p => Math.max(1, p - 1))}
                      disabled={storiesPage === 1}
                      className="px-3 py-2 rounded-xl text-sm font-medium transition duration-200 disabled:opacity-30 disabled:cursor-not-allowed text-gray-300 hover:text-white hover:bg-gray-700/60"
                    >
                      ← Prev
                    </button>
                    {(() => {
                      const pages = []
                      const delta = 2
                      const left = Math.max(2, storiesPage - delta)
                      const right = Math.min(storiesTotalPages - 1, storiesPage + delta)
                      pages.push(1)
                      if (left > 2) pages.push('...')
                      for (let i = left; i <= right; i++) pages.push(i)
                      if (right < storiesTotalPages - 1) pages.push('...')
                      if (storiesTotalPages > 1) pages.push(storiesTotalPages)
                      return pages.map((p, idx) =>
                        p === '...' ? (
                          <span key={`se-${idx}`} className="px-2 py-2 text-gray-500 text-sm select-none">…</span>
                        ) : (
                          <button
                            key={p}
                            onClick={() => setStoriesPage(p)}
                            className={`w-9 h-9 rounded-xl text-sm font-semibold transition duration-200 ${
                              storiesPage === p ? 'text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700/60'
                            }`}
                            style={storiesPage === p ? { background: 'linear-gradient(90.05deg, #AC28DC 6.68%, #7E1EB7 49.26%, #501392 91.85%)' } : {}}
                          >
                            {p}
                          </button>
                        )
                      )
                    })()}
                    <button
                      onClick={() => setStoriesPage(p => Math.min(storiesTotalPages, p + 1))}
                      disabled={storiesPage === storiesTotalPages}
                      className="px-3 py-2 rounded-xl text-sm font-medium transition duration-200 disabled:opacity-30 disabled:cursor-not-allowed text-gray-300 hover:text-white hover:bg-gray-700/60"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bright Box Form Modal */}
      {showBrightBoxForm && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
          <div className="bg-gray-900/80 backdrop-blur-lg rounded-2xl p-4 sm:p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-2xl border border-gray-600/50 scrollbar-hide scroll-smooth scroll-indicator">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'Archivo Black' }}>
                {editingBrightBox ? 'Edit Bright Box' : 'Add New Bright Box'}
              </h2>
              <button
                onClick={resetBrightBoxForm}
                className="text-gray-400 hover:text-white transition duration-200"
              >
                <FiX className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={editingBrightBox ? updateBrightBox : createBrightBox} className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-white text-sm font-semibold mb-2" style={{ fontFamily: 'Archivo Black' }}>Title *</label>
                <input
                  type="text"
                  value={brightBoxForm.title}
                  onChange={(e) => setBrightBoxForm({ ...brightBoxForm, title: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200 placeholder-gray-400"
                  placeholder="Enter title"
                />
              </div>

              {/* ML Title */}
              <div>
                <label className="block text-white text-sm font-semibold mb-2" style={{ fontFamily: 'Archivo Black' }}>ML Title</label>
                <input
                  type="text"
                  value={brightBoxForm.mlTitle}
                  onChange={(e) => setBrightBoxForm({ ...brightBoxForm, mlTitle: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200 placeholder-gray-400"
                  placeholder="Enter Malayalam title"
                />
              </div>

              {/* UR Title */}
              <div>
                <label className="block text-white text-sm font-semibold mb-2" style={{ fontFamily: 'Archivo Black' }}>UR Title</label>
                <input
                  type="text"
                  value={brightBoxForm.urTitle}
                  onChange={(e) => setBrightBoxForm({ ...brightBoxForm, urTitle: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200 placeholder-gray-400"
                  placeholder="Enter Urdu title"
                />
              </div>

              {/* HIN Title */}
              <div>
                <label className="block text-white text-sm font-semibold mb-2" style={{ fontFamily: 'Archivo Black' }}>HIN Title</label>
                <input
                  type="text"
                  value={brightBoxForm.hinTitle}
                  onChange={(e) => setBrightBoxForm({ ...brightBoxForm, hinTitle: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200 placeholder-gray-400"
                  placeholder="Enter Hindi title"
                />
              </div>

              {/* Image Upload */}
              <div>
                <label className="block text-white text-sm font-semibold mb-2" style={{ fontFamily: 'Archivo Black' }}>Image</label>
                <div className="relative w-full h-10 bg-gray-800/50 border border-gray-600 rounded-xl overflow-hidden">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      setFileInputs({ ...fileInputs, image: e.target })
                      setSelectedFileNames({ ...selectedFileNames, image: e.target.files[0]?.name || '' })
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex items-center h-full px-3">
                    <div className="mr-3 py-1.5 px-3 bg-purple-500 hover:bg-purple-600 text-white text-xs font-semibold rounded-lg transition duration-200">
                      Choose Image
                    </div>
                    <span className="text-gray-400 text-xs">
                      {selectedFileNames.image || 'No file chosen'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Schedule Upload — only for new bright boxes */}
              {!editingBrightBox && (
                <SchedulePicker
                  enabled={scheduleEnabled}
                  onToggle={setScheduleEnabled}
                  scheduledAt={scheduledAt}
                  onDateChange={setScheduledAt}
                />
              )}

              {/* Submit Buttons */}
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={resetBrightBoxForm}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-xl transition duration-200 font-semibold text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-xl transition duration-200 font-semibold flex items-center justify-center space-x-2 text-sm"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <FiPlus className="w-4 h-4" />
                      <span>{editingBrightBox ? 'Update' : (scheduleEnabled ? 'Schedule' : 'Create')}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bright Box Story Form Modal */}
      {showBrightBoxStoryForm && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
          <div className="bg-gray-900/80 backdrop-blur-lg rounded-2xl p-4 sm:p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto shadow-2xl border border-gray-600/50 scrollbar-hide scroll-smooth scroll-indicator">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'Archivo Black' }}>
                {editingBrightBoxStory ? 'Edit Bright Box Story' : 'Add New Bright Box Story'}
              </h2>
              <button
                onClick={resetBrightBoxStoryForm}
                className="text-gray-400 hover:text-white transition duration-200"
              >
                <FiX className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={editingBrightBoxStory ? updateBrightBoxStory : createBrightBoxStory} className="space-y-4">
              {/* Category Selection */}
              <div>
                <label className="block text-white text-sm font-semibold mb-2" style={{ fontFamily: 'Archivo Black' }}>Category *</label>
                <CustomDropdown
                  options={brightBoxes.map((cat) => ({
                    value: cat._id,
                    label: cat.title
                  }))}
                  value={brightBoxStoryForm.category}
                  onChange={(value) => setBrightBoxStoryForm({ ...brightBoxStoryForm, category: value })}
                  placeholder="Select category..."
                  className="w-full"
                />
              </div>

              {/* Title */}
              <div>
                <label className="block text-white text-sm font-semibold mb-2" style={{ fontFamily: 'Archivo Black' }}>Title *</label>
                <input
                  type="text"
                  value={brightBoxStoryForm.title}
                  onChange={(e) => setBrightBoxStoryForm({ ...brightBoxStoryForm, title: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200 placeholder-gray-400"
                  placeholder="Enter title"
                />
              </div>

              {/* ML Title */}
              <div>
                <label className="block text-white text-sm font-semibold mb-2" style={{ fontFamily: 'Archivo Black' }}>ML Title</label>
                <input
                  type="text"
                  value={brightBoxStoryForm.mlTitle}
                  onChange={(e) => setBrightBoxStoryForm({ ...brightBoxStoryForm, mlTitle: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200 placeholder-gray-400"
                  placeholder="Enter Malayalam title"
                />
              </div>

              {/* UR Title */}
              <div>
                <label className="block text-white text-sm font-semibold mb-2" style={{ fontFamily: 'Archivo Black' }}>UR Title</label>
                <input
                  type="text"
                  value={brightBoxStoryForm.urTitle}
                  onChange={(e) => setBrightBoxStoryForm({ ...brightBoxStoryForm, urTitle: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200 placeholder-gray-400"
                  placeholder="Enter Urdu title"
                />
              </div>

              {/* HIN Title */}
              <div>
                <label className="block text-white text-sm font-semibold mb-2" style={{ fontFamily: 'Archivo Black' }}>HIN Title</label>
                <input
                  type="text"
                  value={brightBoxStoryForm.hinTitle}
                  onChange={(e) => setBrightBoxStoryForm({ ...brightBoxStoryForm, hinTitle: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200 placeholder-gray-400"
                  placeholder="Enter Hindi title"
                />
              </div>

              {/* Highlight */}
              <div>
                <label className="block text-white text-sm font-semibold mb-2" style={{ fontFamily: 'Archivo Black' }}>Highlight</label>
                <CustomDropdown
                  options={[
                    { value: 'Enable', label: 'Enable' },
                    { value: 'Disable', label: 'Disable' }
                  ]}
                  value={brightBoxStoryForm.highlight}
                  onChange={(value) => setBrightBoxStoryForm({ ...brightBoxStoryForm, highlight: value, highlightExpiresAt: value === 'Disable' ? '' : brightBoxStoryForm.highlightExpiresAt })}
                  placeholder="Select highlight status..."
                  className="w-full"
                />
                {brightBoxStoryForm.highlight === 'Enable' && (
                  <HighlightDurationPicker
                    value={brightBoxStoryForm.highlightExpiresAt}
                    onChange={(val) => setBrightBoxStoryForm({ ...brightBoxStoryForm, highlightExpiresAt: val })}
                  />
                )}
              </div>

              {/* File Uploads */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Image */}
                <div>
                  <label className="block text-white text-sm font-semibold mb-2" style={{ fontFamily: 'Archivo Black' }}>Image</label>
                  <div className="relative w-full h-10 bg-gray-800/50 border border-gray-600 rounded-xl overflow-hidden">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        setFileInputs({ ...fileInputs, storyImage: e.target })
                        setSelectedFileNames({ ...selectedFileNames, storyImage: e.target.files[0]?.name || '' })
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="flex items-center h-full px-3">
                      <div className="mr-3 py-1.5 px-3 bg-purple-500 hover:bg-purple-600 text-white text-xs font-semibold rounded-lg transition duration-200">
                        Choose Image
                      </div>
                      <span className="text-gray-400 text-xs">
                        {selectedFileNames.storyImage || 'No file chosen'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* EN File */}
                <div>
                  <label className="block text-white text-sm font-semibold mb-2" style={{ fontFamily: 'Archivo Black' }}>EN File *</label>
                  <div className="relative w-full h-10 bg-gray-800/50 border border-gray-600 rounded-xl overflow-hidden">
                    <input
                      type="file"
                      onChange={(e) => {
                        setFileInputs({ ...fileInputs, enFile: e.target })
                        setSelectedFileNames({ ...selectedFileNames, enFile: e.target.files[0]?.name || '' })
                      }}
                      required={!editingBrightBoxStory}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="flex items-center h-full px-3">
                      <div className="mr-3 py-1.5 px-3 bg-purple-500 hover:bg-purple-600 text-white text-xs font-semibold rounded-lg transition duration-200">
                        Choose EN File
                      </div>
                      <span className="text-gray-400 text-xs">
                        {selectedFileNames.enFile || 'No file chosen'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ML File */}
                <div>
                  <label className="block text-white text-sm font-semibold mb-2" style={{ fontFamily: 'Archivo Black' }}>ML File</label>
                  <div className="relative w-full h-10 bg-gray-800/50 border border-gray-600 rounded-xl overflow-hidden">
                    <input
                      type="file"
                      onChange={(e) => {
                        setFileInputs({ ...fileInputs, mlFile: e.target })
                        setSelectedFileNames({ ...selectedFileNames, mlFile: e.target.files[0]?.name || '' })
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="flex items-center h-full px-3">
                      <div className="mr-3 py-1.5 px-3 bg-purple-500 hover:bg-purple-600 text-white text-xs font-semibold rounded-lg transition duration-200">
                        Choose ML File
                      </div>
                      <span className="text-gray-400 text-xs">
                        {selectedFileNames.mlFile || 'No file chosen'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* UR File */}
                <div>
                  <label className="block text-white text-sm font-semibold mb-2" style={{ fontFamily: 'Archivo Black' }}>UR File</label>
                  <div className="relative w-full h-10 bg-gray-800/50 border border-gray-600 rounded-xl overflow-hidden">
                    <input
                      type="file"
                      onChange={(e) => {
                        setFileInputs({ ...fileInputs, urFile: e.target })
                        setSelectedFileNames({ ...selectedFileNames, urFile: e.target.files[0]?.name || '' })
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="flex items-center h-full px-3">
                      <div className="mr-3 py-1.5 px-3 bg-purple-500 hover:bg-purple-600 text-white text-xs font-semibold rounded-lg transition duration-200">
                        Choose UR File
                      </div>
                      <span className="text-gray-400 text-xs">
                        {selectedFileNames.urFile || 'No file chosen'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* HIN File */}
                <div>
                  <label className="block text-white text-sm font-semibold mb-2" style={{ fontFamily: 'Archivo Black' }}>HIN File</label>
                  <div className="relative w-full h-10 bg-gray-800/50 border border-gray-600 rounded-xl overflow-hidden">
                    <input
                      type="file"
                      onChange={(e) => {
                        setFileInputs({ ...fileInputs, hinFile: e.target })
                        setSelectedFileNames({ ...selectedFileNames, hinFile: e.target.files[0]?.name || '' })
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="flex items-center h-full px-3">
                      <div className="mr-3 py-1.5 px-3 bg-purple-500 hover:bg-purple-600 text-white text-xs font-semibold rounded-lg transition duration-200">
                        Choose HIN File
                      </div>
                      <span className="text-gray-400 text-xs">
                        {selectedFileNames.hinFile || 'No file chosen'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Banner Uploads */}
              <div>
                <h3 className="text-white text-sm font-semibold mb-3" style={{ fontFamily: 'Archivo Black' }}>Ad Banners</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Ad Banner (English) */}
                  <div>
                    <label className="block text-white text-sm font-semibold mb-2" style={{ fontFamily: 'Archivo Black' }}>Ad Banner</label>
                    <div className="relative w-full h-10 bg-gray-800/50 border border-gray-600 rounded-xl overflow-hidden">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          setFileInputs({ ...fileInputs, adBanner: e.target })
                          setSelectedFileNames({ ...selectedFileNames, adBanner: e.target.files[0]?.name || '' })
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div className="flex items-center h-full px-3">
                        <div className="mr-3 py-1.5 px-3 bg-yellow-600 hover:bg-yellow-700 text-white text-xs font-semibold rounded-lg transition duration-200">
                          Choose Banner
                        </div>
                        <span className="text-gray-400 text-xs">
                          {selectedFileNames.adBanner || 'No file chosen'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ML Banner */}
                  <div>
                    <label className="block text-white text-sm font-semibold mb-2" style={{ fontFamily: 'Archivo Black' }}>ML Banner</label>
                    <div className="relative w-full h-10 bg-gray-800/50 border border-gray-600 rounded-xl overflow-hidden">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          setFileInputs({ ...fileInputs, mlBanner: e.target })
                          setSelectedFileNames({ ...selectedFileNames, mlBanner: e.target.files[0]?.name || '' })
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div className="flex items-center h-full px-3">
                        <div className="mr-3 py-1.5 px-3 bg-yellow-600 hover:bg-yellow-700 text-white text-xs font-semibold rounded-lg transition duration-200">
                          Choose Banner
                        </div>
                        <span className="text-gray-400 text-xs">
                          {selectedFileNames.mlBanner || 'No file chosen'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* UR Banner */}
                  <div>
                    <label className="block text-white text-sm font-semibold mb-2" style={{ fontFamily: 'Archivo Black' }}>UR Banner</label>
                    <div className="relative w-full h-10 bg-gray-800/50 border border-gray-600 rounded-xl overflow-hidden">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          setFileInputs({ ...fileInputs, urBanner: e.target })
                          setSelectedFileNames({ ...selectedFileNames, urBanner: e.target.files[0]?.name || '' })
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div className="flex items-center h-full px-3">
                        <div className="mr-3 py-1.5 px-3 bg-yellow-600 hover:bg-yellow-700 text-white text-xs font-semibold rounded-lg transition duration-200">
                          Choose Banner
                        </div>
                        <span className="text-gray-400 text-xs">
                          {selectedFileNames.urBanner || 'No file chosen'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* HIN Banner */}
                  <div>
                    <label className="block text-white text-sm font-semibold mb-2" style={{ fontFamily: 'Archivo Black' }}>HIN Banner</label>
                    <div className="relative w-full h-10 bg-gray-800/50 border border-gray-600 rounded-xl overflow-hidden">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          setFileInputs({ ...fileInputs, hinBanner: e.target })
                          setSelectedFileNames({ ...selectedFileNames, hinBanner: e.target.files[0]?.name || '' })
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div className="flex items-center h-full px-3">
                        <div className="mr-3 py-1.5 px-3 bg-yellow-600 hover:bg-yellow-700 text-white text-xs font-semibold rounded-lg transition duration-200">
                          Choose Banner
                        </div>
                        <span className="text-gray-400 text-xs">
                          {selectedFileNames.hinBanner || 'No file chosen'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Schedule Upload — only for new bright box stories */}
              {!editingBrightBoxStory && (
                <SchedulePicker
                  enabled={storyScheduleEnabled}
                  onToggle={setStoryScheduleEnabled}
                  scheduledAt={storyScheduledAt}
                  onDateChange={setStoryScheduledAt}
                />
              )}

              {/* Submit Buttons */}
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={resetBrightBoxStoryForm}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-xl transition duration-200 font-semibold text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-xl transition duration-200 font-semibold flex items-center justify-center space-x-2 text-sm"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <FiPlus className="w-4 h-4" />
                      <span>{editingBrightBoxStory ? 'Update' : (storyScheduleEnabled ? 'Schedule' : 'Create')}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Story Details Modal */}
      {showStoryDetails && selectedBrightBoxStory && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
          <div className="bg-gray-900/80 backdrop-blur-lg rounded-2xl p-4 sm:p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto shadow-2xl border border-gray-600/50 scrollbar-hide scroll-smooth scroll-indicator">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'Archivo Black' }}>
                Story Details
              </h2>
              <button
                onClick={() => setShowStoryDetails(false)}
                className="text-gray-400 hover:text-white transition duration-200"
              >
                <FiX className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Header Info */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold text-white">{selectedBrightBoxStory.title}</h3>
                  {selectedBrightBoxStory.mlTitle && <p className="text-gray-400">{selectedBrightBoxStory.mlTitle}</p>}
                </div>
                <div className="text-sm text-gray-400">
                  <div>Category: {selectedBrightBoxStory.category?.title}</div>
                </div>
              </div>

              {/* Image */}
              {selectedBrightBoxStory.image && (
                <div>
                  <img
                    src={resolveImageUrl(selectedBrightBoxStory.image)}
                    alt={selectedBrightBoxStory.title}
                    className="w-full h-64 object-cover rounded-xl"
                  />
                </div>
              )}

              {/* File Links */}
              <div>
                <h4 className="text-white font-semibold mb-3">Story Files</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {selectedBrightBoxStory.enFile && (
                    <a
                      href={normalizeUrl(selectedBrightBoxStory.enFile)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center px-4 py-3 bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 hover:text-white rounded-lg transition duration-200 border border-gray-600/50 hover:border-gray-500/50"
                    >
                      <FiFile className="w-4 h-4 mr-2" />
                      <span className="text-sm font-medium">English</span>
                    </a>
                  )}
                  {selectedBrightBoxStory.mlFile && (
                    <a
                      href={normalizeUrl(selectedBrightBoxStory.mlFile)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center px-4 py-3 bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 hover:text-white rounded-lg transition duration-200 border border-gray-600/50 hover:border-gray-500/50"
                    >
                      <FiFile className="w-4 h-4 mr-2" />
                      <span className="text-sm font-medium">Malayalam</span>
                    </a>
                  )}
                  {selectedBrightBoxStory.urFile && (
                    <a
                      href={normalizeUrl(selectedBrightBoxStory.urFile)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center px-4 py-3 bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 hover:text-white rounded-lg transition duration-200 border border-gray-600/50 hover:border-gray-500/50"
                    >
                      <FiFile className="w-4 h-4 mr-2" />
                      <span className="text-sm font-medium">Urdu</span>
                    </a>
                  )}
                  {selectedBrightBoxStory.hinFile && (
                    <a
                      href={normalizeUrl(selectedBrightBoxStory.hinFile)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center px-4 py-3 bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 hover:text-white rounded-lg transition duration-200 border border-gray-600/50 hover:border-gray-500/50"
                    >
                      <FiFile className="w-4 h-4 mr-2" />
                      <span className="text-sm font-medium">Hindi</span>
                    </a>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {selectedBrightBoxStory.enFile && (
                    <button
                      type="button"
                      onClick={() => handleDownloadBrightBoxStoryPdf(selectedBrightBoxStory._id, 'en')}
                      className="px-3 py-1.5 bg-purple-600/80 hover:bg-purple-600 text-white text-sm rounded-lg"
                    >
                      Download PDF (EN)
                    </button>
                  )}
                  {selectedBrightBoxStory.mlFile && (
                    <button
                      type="button"
                      onClick={() => handleDownloadBrightBoxStoryPdf(selectedBrightBoxStory._id, 'ml')}
                      className="px-3 py-1.5 bg-purple-600/80 hover:bg-purple-600 text-white text-sm rounded-lg"
                    >
                      Download PDF (ML)
                    </button>
                  )}
                  {selectedBrightBoxStory.urFile && (
                    <button
                      type="button"
                      onClick={() => handleDownloadBrightBoxStoryPdf(selectedBrightBoxStory._id, 'ur')}
                      className="px-3 py-1.5 bg-purple-600/80 hover:bg-purple-600 text-white text-sm rounded-lg"
                    >
                      Download PDF (UR)
                    </button>
                  )}
                  {selectedBrightBoxStory.hinFile && (
                    <button
                      type="button"
                      onClick={() => handleDownloadBrightBoxStoryPdf(selectedBrightBoxStory._id, 'hin')}
                      className="px-3 py-1.5 bg-purple-600/80 hover:bg-purple-600 text-white text-sm rounded-lg"
                    >
                      Download PDF (HIN)
                    </button>
                  )}
                </div>
              </div>

              {/* Timestamps */}
              <div className="text-gray-400 text-sm">
                <div>Created: {new Date(selectedBrightBoxStory.createdAt).toLocaleDateString()}</div>
                <div>Updated: {new Date(selectedBrightBoxStory.updatedAt).toLocaleDateString()}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      <SuccessModal
        isOpen={modal.isOpen}
        onClose={closeModal}
        type={modal.type}
        message={modal.message}
        onConfirm={modal.onConfirm}
      />
    </div>
  )
}

export default BrightBox
