import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import SuccessModal from '../components/SuccessModal'
import CustomDropdown from '../components/CustomDropdown'
import SchedulePicker from '../components/SchedulePicker'
import HighlightDurationPicker from '../components/HighlightDurationPicker'
import { 
  FiPlus, 
  FiX,
  FiSave,
  FiEdit3,
  FiTrash2,
  FiMenu
} from 'react-icons/fi'
import { HiCalendar } from 'react-icons/hi'
import gradient from '../assets/gradiantRight.png'

function Stories() {
  const navigate = useNavigate()
  
  // State management
  const [stories, setStories] = useState([])
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState({ isOpen: false, type: 'success', message: '', onConfirm: null })
  const [selectedStory, setSelectedStory] = useState(null)
  const [expandedCard, setExpandedCard] = useState(null)
  
  // Form states
  const [showStoryForm, setShowStoryForm] = useState(false)
  const [showSeasonForm, setShowSeasonForm] = useState(false)
  const [showEpisodeForm, setShowEpisodeForm] = useState(false)
  const [editingStory, setEditingStory] = useState(null)
  const [editingSeason, setEditingSeason] = useState(null)
  const [editingEpisode, setEditingEpisode] = useState(null)
  const [selectedStoryId, setSelectedStoryId] = useState(null)
  const [selectedSeasonId, setSelectedSeasonId] = useState(null)
  const [selectedEpisode, setSelectedEpisode] = useState(null)
  const [showEpisodeDetails, setShowEpisodeDetails] = useState(false)
  const [dragEpisodeId, setDragEpisodeId] = useState(null)
  const [draggingStoryId, setDraggingStoryId] = useState(null)
  const [pendingStoryOrder, setPendingStoryOrder] = useState(false)
  
  // Form data
  const [storyForm, setStoryForm] = useState({
    title: '',
    description: '',
    Tag: '',
    coverImage: '',
    mlTitle: '',
    mlDescription: '',
    status: 'Active',
    // Priority as string for form, normalized to >= 1.
    priority: '1',
    hinTitle: '',
    hinDescription: '',
    urTiitle: '',
    urDescription: ''
  })
  
  const [seasonForm, setSeasonForm] = useState({
    seasonNumber: '',
    seasonBanner: ''
  })
  
  const [episodeForm, setEpisodeForm] = useState({
    title: '',
    mlTitle: '',
    urTitle: '',
    hinTitle: '',
    status: 'Disable',
    coverImage: '',
    readTime: '',
    storyFile: '',
    mlStoryFile: '',
    urStoryFile: '',
    hinStoryFile: '',
    adBanner: '',
    mlBanner: '',
    urBanner: '',
    hinBanner: '',
    highlight: 'Disable',
    highlightExpiresAt: '',
    music: ''
  })

  // File upload states
  const [uploadingFiles, setUploadingFiles] = useState({})
  const [fileInputs, setFileInputs] = useState({})

  // Schedule state
  const [scheduleEnabled, setScheduleEnabled] = useState(false)
  const [scheduledAt, setScheduledAt] = useState('')
  const [files, setFiles] = useState({
    coverImage: null,
    storyFile: null,
    mlStoryFile: null,
    urStoryFile: null,
    hinStoryFile: null,
    adBanner: null,
    mlBanner: null,
    urBanner: null,
    hinBanner: null,
    music: null
  })

  // Sort episodes by leading number in title (ascending: 01, 02, 03, ...)
  const sortEpisodesAsc = (episodes) => {
    if (!Array.isArray(episodes) || episodes.length === 0) return []
    const key = (ep) => {
      const t = (ep.title || '').trim()
      const m = t.match(/^\d+/)
      return m ? parseInt(m[0], 10) : Number.MAX_SAFE_INTEGER
    }
    return [...episodes].sort((a, b) => {
      const ka = key(a), kb = key(b)
      if (ka !== kb) return ka - kb
      return (a.title || '').localeCompare(b.title || '', undefined, { numeric: true })
    })
  }

  // API Base URL
  const API_BASE = import.meta.env.VITE_API_BASE_URL
  const STORIES_PER_PAGE = 18
  const [currentPage, setCurrentPage] = useState(1)

  // Download episode PDF: open a tab immediately to avoid popup blocking, then load URL
  const handleDownloadEpisodePdf = async (storyId, seasonId, episodeId, lang = 'en') => {
    if (!storyId || !seasonId || !episodeId) return
    const downloadWindow = window.open('', '_blank', 'noopener,noreferrer')
    try {
      const res = await fetch(`${API_BASE}/stories/${storyId}/seasons/${seasonId}/episodes/${episodeId}/download-pdf?lang=${encodeURIComponent(lang)}`)
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
  const [totalPages, setTotalPages] = useState(1)
  const [totalStories, setTotalStories] = useState(0)
  
  // Debug logging

  // Fetch stories with pagination
  const fetchStories = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/stories?page=${page}&limit=${STORIES_PER_PAGE}`)
      const data = await response.json()
      if (data.success) {
        const storiesListRaw = data.data?.stories || []
        // Order: priority 1 = first column first row, 2 = next, etc. No priority = last.
        const PRIORITY_LAST = 999999
        const storiesList = [...storiesListRaw].sort((a, b) => {
          const pa = (Number(a.priority) >= 1) ? Number(a.priority) : PRIORITY_LAST
          const pb = (Number(b.priority) >= 1) ? Number(b.priority) : PRIORITY_LAST
          if (pa !== pb) return pa - pb
          const da = a.createdAt ? new Date(a.createdAt).getTime() : 0
          const db = b.createdAt ? new Date(b.createdAt).getTime() : 0
          return db - da
        })
        const pagination = data.data?.pagination || {}
        const total = pagination.totalStories || 0
        const safeTotalPages = pagination.totalPages || Math.max(1, Math.ceil(total / STORIES_PER_PAGE))

        setStories(storiesList)
        setTotalStories(total)
        setTotalPages(safeTotalPages)

        if (total > 0 && page > safeTotalPages) {
          setCurrentPage(safeTotalPages)
        } else if (total === 0 && page !== 1) {
          setCurrentPage(1)
        }
      } else {
        showModal('error', data.message || 'Failed to fetch stories')
      }
    } catch (error) {
      showModal('error', 'Error fetching stories')
    } finally {
      setLoading(false)
    }
  }, [API_BASE, STORIES_PER_PAGE])

  // Show modal
  const showModal = (type, message, onConfirm = null) => {
    setModal({ isOpen: true, type, message, onConfirm })
  }

  // Close modal
  const closeModal = () => {
    setModal({ isOpen: false, type: 'success', message: '', onConfirm: null })
  }

  // Handle file upload
  const handleFileUpload = async (file, fieldName, formType) => {
    if (!file) return ''

    setUploadingFiles(prev => ({ ...prev, [fieldName]: true }))
    
    try {
      const formData = new FormData()
      formData.append(fieldName, file)
      
      const response = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: formData
      })
      
      const data = await response.json()
      if (data.success) {
        return data.data[fieldName]
      } else {
        throw new Error(data.message)
      }
    } catch (error) {
      showModal('error', `Failed to upload ${fieldName}`)
      return ''
    } finally {
      setUploadingFiles(prev => ({ ...prev, [fieldName]: false }))
    }
  }

  // Create story
  const createStory = async (e) => {
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
        // Upload coverImage first to get URL
        let coverImageUrl = storyForm.coverImage || ''
        if (fileInputs.coverImage && fileInputs.coverImage.files[0]) {
          const fd = new FormData()
          fd.append('file', fileInputs.coverImage.files[0])
          const upRes = await fetch(`${API_BASE}/admin/upload-file`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` },
            body: fd
          })
          const upData = await upRes.json()
          if (!upData.success) throw new Error('Failed to upload cover image')
          coverImageUrl = upData.url
        }
        const payload = { ...storyForm, coverImage: coverImageUrl }
        const schedRes = await fetch(`${API_BASE}/schedule`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('adminToken')}`
          },
          body: JSON.stringify({
            contentType: 'story',
            title: storyForm.title || 'Story',
            thumbnailUrl: coverImageUrl,
            contentData: payload,
            publishAt: scheduledAt
          })
        })
        const schedData = await schedRes.json()
        if (schedData.success) {
          showModal('success', `Story scheduled for ${new Date(scheduledAt).toLocaleString()}`)
          resetStoryForm()
          setShowStoryForm(false)
          setScheduleEnabled(false)
          setScheduledAt('')
        } else {
          showModal('error', schedData.message || 'Failed to schedule story')
        }
        return
      }

      // --- Normal immediate upload flow ---
      const formData = new FormData()
      Object.keys(storyForm).forEach(key => {
        if (storyForm[key] !== '') {
          formData.append(key, storyForm[key])
        }
      })
      
      // Handle cover image upload
      if (fileInputs.coverImage && fileInputs.coverImage.files[0]) {
        formData.append('coverImage', fileInputs.coverImage.files[0])
      }
      
      const response = await fetch(`${API_BASE}/stories`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: formData
      })
      
      const data = await response.json()
      if (data.success) {
        showModal('success', 'Story created successfully!')
        resetStoryForm()
        setShowStoryForm(false) // Close the story form
        if (currentPage !== 1) {
          setCurrentPage(1)
        } else {
          fetchStories(1)
        }
      } else {
        showModal('error', data.message || 'Failed to create story')
      }
    } catch (error) {
      showModal('error', 'Error creating story')
    } finally {
      setLoading(false)
    }
  }

  // Update story
  const updateStory = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const formData = new FormData()
      Object.keys(storyForm).forEach(key => {
        if (storyForm[key] !== '') {
          formData.append(key, storyForm[key])
        }
      })
      
      // Handle cover image upload
      if (fileInputs.coverImage && fileInputs.coverImage.files[0]) {
        formData.append('coverImage', fileInputs.coverImage.files[0])
      }
      
      const response = await fetch(`${API_BASE}/stories/${editingStory._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: formData
      })
      
      const data = await response.json()
      if (data.success) {
        showModal('success', 'Story updated successfully!')
        resetStoryForm()
        setShowStoryForm(false) // Close the story form
        fetchStories(currentPage)
      } else {
        showModal('error', data.message || 'Failed to update story')
      }
    } catch (error) {
      showModal('error', 'Error updating story')
    } finally {
      setLoading(false)
    }
  }

  // Delete story
  const deleteStory = async (storyId) => {
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/stories/${storyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      })
      
      const data = await response.json()
      if (data.success) {
        showModal('success', 'Story deleted successfully!')
        const shouldGoToPrevPage = stories.length === 1 && currentPage > 1
        const targetPage = shouldGoToPrevPage ? currentPage - 1 : currentPage
        if (targetPage !== currentPage) {
          setCurrentPage(targetPage)
        } else {
          fetchStories(targetPage)
        }
      } else {
        showModal('error', data.message || 'Failed to delete story')
      }
    } catch (error) {
      showModal('error', 'Error deleting story')
    } finally {
      setLoading(false)
    }
  }

  // Create season
  const createSeason = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const formData = new FormData()
      formData.append('seasonNumber', seasonForm.seasonNumber)
      
      // Handle season banner upload
      if (fileInputs.seasonBanner && fileInputs.seasonBanner.files[0]) {
        formData.append('seasonBanner', fileInputs.seasonBanner.files[0])
      } else if (seasonForm.seasonBanner) {
        formData.append('seasonBanner', seasonForm.seasonBanner)
      }
      
      const response = await fetch(`${API_BASE}/stories/${selectedStoryId}/seasons`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: formData
      })
      
      const data = await response.json()
      if (data.success) {
        showModal('success', 'Season created successfully!')
        resetSeasonForm()
        setShowSeasonForm(false) // Close the season form
        fetchStories(currentPage)
      } else {
        showModal('error', data.message || 'Failed to create season')
      }
    } catch (error) {
      showModal('error', 'Error creating season')
    } finally {
      setLoading(false)
    }
  }

  // Create episode
  const createEpisode = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const formData = new FormData()
      Object.keys(episodeForm).forEach(key => {
        if (episodeForm[key] !== '') {
          formData.append(key, episodeForm[key])
        }
      })
      
      // Handle file uploads
      const fileFields = [
        'coverImage', 'storyFile', 'mlStoryFile', 'urStoryFile', 'hinStoryFile',
        'adBanner', 'mlBanner', 'urBanner', 'hinBanner', 'music'
      ]
      
      fileFields.forEach(field => {
        if (fileInputs[field] && fileInputs[field].files[0]) {
          formData.append(field, fileInputs[field].files[0])
        }
      })
      
      const response = await fetch(`${API_BASE}/stories/${selectedStoryId}/seasons/${selectedSeasonId}/episodes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: formData
      })
      
      const data = await response.json()
      if (data.success) {
        showModal('success', 'Episode created successfully!')
        resetEpisodeForm()
        setShowEpisodeForm(false) // Close the episode form
        fetchStories(currentPage)
      } else {
        showModal('error', data.message || 'Failed to create episode')
      }
    } catch (error) {
      showModal('error', 'Error creating episode')
    } finally {
      setLoading(false)
    }
  }

  // Reset forms
  const resetStoryForm = () => {
    setStoryForm({
      title: '',
      description: '',
      Tag: '',
      coverImage: '',
      mlTitle: '',
      mlDescription: '',
      status: 'Active',
      priority: '1',
      hinTitle: '',
      hinDescription: '',
      urTiitle: '',
      urDescription: ''
    })
    setEditingStory(null)
    setShowStoryForm(false)
    setFileInputs(prev => ({ ...prev, coverImage: null }))
    setScheduleEnabled(false)
    setScheduledAt('')
  }

  const resetSeasonForm = () => {
    setSeasonForm({
      seasonNumber: '',
      seasonBanner: ''
    })
    setEditingSeason(null)
    setShowSeasonForm(false)
    setFileInputs(prev => ({ ...prev, seasonBanner: null }))
  }

  const resetEpisodeForm = () => {
    setEpisodeForm({
      title: '',
      mlTitle: '',
      urTitle: '',
      hinTitle: '',
      status: 'Disable',
      coverImage: '',
      readTime: '',
      storyFile: '',
      mlStoryFile: '',
      urStoryFile: '',
      hinStoryFile: '',
      adBanner: '',
      mlBanner: '',
      urBanner: '',
      hinBanner: '',
      highlight: 'Disable',
      highlightExpiresAt: '',
      music: ''
    })
    setEditingEpisode(null)
    setShowEpisodeForm(false)
    setFileInputs({})
    setFiles({
      coverImage: null,
      storyFile: null,
      mlStoryFile: null,
      urStoryFile: null,
      hinStoryFile: null,
      adBanner: null,
      mlBanner: null,
      urBanner: null,
      hinBanner: null,
      music: null
    })
  }

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) return
    setCurrentPage(newPage)
  }

  const startIndex = totalStories === 0 ? 0 : Math.min((currentPage - 1) * STORIES_PER_PAGE + 1, totalStories)
  const endIndex = Math.min(totalStories, currentPage * STORIES_PER_PAGE)

  // Fetch single story details
  const fetchStoryDetails = async (storyId, keepSeasonId = null) => {
    try {
      const response = await fetch(`${API_BASE}/stories/${storyId}`)
      const data = await response.json()
      if (data.success) {
        setSelectedStory(data.data)
        if (keepSeasonId) setSelectedSeasonId(keepSeasonId)
        else if (data.data.seasons?.length > 0) setSelectedSeasonId(data.data.seasons[0]._id)
      } else {
        showModal('error', 'Failed to fetch story details')
      }
    } catch (error) {
      console.error('Error in fetchStoryDetails:', error)
      showModal('error', 'Error fetching story details')
    }
  }

  // Reorder episodes (after drag-drop), then refetch story
  const reorderEpisodes = async (newOrderedIds) => {
    const storyId = selectedStory?._id
    const seasonId = selectedSeasonId
    if (!storyId || !seasonId || !newOrderedIds?.length) return
    try {
      const token = localStorage.getItem('adminToken')
      const res = await fetch(`${API_BASE}/stories/${storyId}/seasons/${seasonId}/episodes/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
        body: JSON.stringify({ episodeIds: newOrderedIds })
      })
      const data = await res.json()
      if (data.success) fetchStoryDetails(storyId, seasonId)
      else showModal('error', data.message || 'Failed to reorder')
    } catch (e) {
      showModal('error', 'Failed to reorder episodes')
    }
  }

  // ── Story-level drag-and-drop reorder ─────────────────────────────────────
  const handleStoryDragStart = (_e, id) => {
    setDraggingStoryId(id)
  }

  const handleStoryDragOver = (e, targetId) => {
    e.preventDefault()
    if (!draggingStoryId || draggingStoryId === targetId) return
    setStories((prev) => {
      const fromIndex = prev.findIndex((s) => s._id === draggingStoryId)
      const toIndex = prev.findIndex((s) => s._id === targetId)
      if (fromIndex === -1 || toIndex === -1) return prev
      const updated = [...prev]
      const [moved] = updated.splice(fromIndex, 1)
      updated.splice(toIndex, 0, moved)
      return updated
    })
  }

  const handleStoryDrop = async (e) => {
    e.preventDefault()
    setDraggingStoryId(null)
    setPendingStoryOrder(true)
  }

  const handleStoryDragEnd = () => {
    setDraggingStoryId(null)
  }

  const saveStoryOrder = async () => {
    try {
      const token = localStorage.getItem('adminToken')
      await fetch(`${API_BASE}/stories/reorder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ storyIds: stories.map((s) => s._id) })
      })
      setPendingStoryOrder(false)
    } catch (err) {
      console.error('Failed to save story order:', err)
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  // Handle card expand
  const handleCardExpand = (storyId) => {
    // Keep track of which story is currently expanded so actions
    // (like episode PDF download) know the active story context.
    setExpandedCard(storyId)
    setSelectedStoryId(storyId)
    fetchStoryDetails(storyId)
  }

  // Handle card collapse
  const handleCardCollapse = () => {
    setExpandedCard(null)
    setSelectedStory(null)
    setSelectedStoryId(null)
    setSelectedSeasonId(null)
    setSelectedEpisode(null)
    setShowEpisodeDetails(false)
  }

  // Handle episode selection
  const handleEpisodeSelect = (episode) => {
    setSelectedEpisode(episode)
    setShowEpisodeDetails(true)
  }

  // Handle episode details close
  const handleEpisodeDetailsClose = () => {
    setSelectedEpisode(null)
    setShowEpisodeDetails(false)
  }

  // Edit handlers
  const editStory = (story) => {
    setEditingStory(story)
    setStoryForm({
      title: story.title || '',
      description: story.description || '',
      Tag: story.Tag || '',
      coverImage: story.coverImage || '',
      mlTitle: story.mlTitle || '',
      mlDescription: story.mlDescription || '',
      status: story.status || 'Active',
      priority: (() => {
        const n = parseInt(story.priority, 10)
        return !Number.isNaN(n) && n >= 1 ? String(n) : '1'
      })(),
      hinTitle: story.hinTitle || '',
      hinDescription: story.hinDescription || '',
      urTiitle: story.urTiitle || '',
      urDescription: story.urDescription || ''
    })
    setExpandedCard(null) // Close the expanded card
    setSelectedStory(null)
    setShowStoryForm(true)
  }

  const editSeason = (season) => {
    setEditingSeason(season)
    setSeasonForm({
      seasonNumber: season.seasonNumber || '',
      seasonBanner: season.seasonBanner || ''
    })
    setShowSeasonForm(true)
  }

  const editEpisode = (episode) => {
    setEditingEpisode(episode)
    setEpisodeForm({
      title: episode.title || '',
      mlTitle: episode.mlTitle || '',
      urTitle: episode.urTitle || '',
      hinTitle: episode.hinTitle || '',
      status: episode.status || 'Disable',
      readTime: episode.readTime || '',
      highlight: episode.highlight || 'Disable',
      highlightExpiresAt: episode.highlightExpiresAt || ''
    })
    setFiles({
      coverImage: null,
      storyFile: null,
      mlStoryFile: null,
      urStoryFile: null,
      hinStoryFile: null,
      adBanner: null,
      mlBanner: null,
      urBanner: null,
      hinBanner: null,
      music: null
    })
    setShowEpisodeForm(true)
  }

  // Handle season update
  const handleSeasonUpdate = async (e) => {
    e.preventDefault()
    
    
    try {
      setLoading(true)
      showModal('loading', 'Updating season...')
      
      const formData = new FormData()
      formData.append('seasonNumber', seasonForm.seasonNumber)

      // Add seasonBanner file if it exists
      if (fileInputs.seasonBanner) {
        formData.append('seasonBanner', fileInputs.seasonBanner)
      }

      // Use selectedStory._id as fallback if selectedStoryId is null
      const storyId = selectedStoryId || selectedStory?._id
      if (!storyId) {
        throw new Error('Story ID is missing')
      }
      
      const response = await fetch(`${API_BASE}/stories/${storyId}/seasons/${editingSeason._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: formData
      })

      const data = await response.json()

      if (data.success) {
        showModal('success', 'Season updated successfully!')
        resetSeasonForm()
        setShowSeasonForm(false) // Close the season form
        // Refresh the story details to show updated data
        if (expandedCard) {
          fetchStoryDetails(expandedCard)
        }
    } else {
        showModal('error', data.message || 'Failed to update season')
      }
    } catch (error) {
      showModal('error', 'Error updating season')
    } finally {
      setLoading(false)
    }
  }

  // Handle episode update
  const handleEpisodeUpdate = async (e) => {
    e.preventDefault()
    
    
    try {
      setLoading(true)
      showModal('loading', 'Updating episode...')
      
      const formData = new FormData()
      formData.append('title', episodeForm.title)
      formData.append('mlTitle', episodeForm.mlTitle)
      formData.append('urTitle', episodeForm.urTitle)
      formData.append('hinTitle', episodeForm.hinTitle)
      formData.append('status', episodeForm.status)
      formData.append('readTime', episodeForm.readTime)
      formData.append('highlight', episodeForm.highlight)
      if (episodeForm.highlightExpiresAt) {
        formData.append('highlightExpiresAt', episodeForm.highlightExpiresAt)
      } else {
        // Pass empty string so the route knows to clear it if highlight is Disable
        formData.append('highlightExpiresAt', '')
      }

      // Handle file uploads from fileInputs
      const fileFields = [
        'coverImage', 'storyFile', 'mlStoryFile', 'urStoryFile', 'hinStoryFile',
        'adBanner', 'mlBanner', 'urBanner', 'hinBanner', 'music'
      ]
      
      fileFields.forEach(field => {
        if (fileInputs[field] && fileInputs[field].files[0]) {
          formData.append(field, fileInputs[field].files[0])
        }
      })

      // Use selectedStory._id as fallback if selectedStoryId is null
      const storyId = selectedStoryId || selectedStory?._id
      if (!storyId) {
        throw new Error('Story ID is missing')
      }
      
      const response = await fetch(`${API_BASE}/stories/${storyId}/seasons/${selectedSeasonId}/episodes/${editingEpisode._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: formData
      })

      const data = await response.json()

      if (data.success) {
        showModal('success', 'Episode updated successfully!')
        resetEpisodeForm()
        setShowEpisodeForm(false) // Close the episode form
        // Refresh the story details to show updated data
        if (expandedCard) {
          fetchStoryDetails(expandedCard)
        }
    } else {
        showModal('error', data.message || 'Failed to update episode')
      }
    } catch (error) {
      showModal('error', 'Error updating episode')
    } finally {
      setLoading(false)
    }
  }

  // Handle season delete
  const handleSeasonDelete = async (seasonId) => {
    try {
      setLoading(true)
      showModal('loading', 'Deleting season...')
      
      // Use selectedStory._id as fallback if selectedStoryId is null
      const storyId = selectedStoryId || selectedStory?._id
      if (!storyId) {
        throw new Error('Story ID is missing')
      }
      
      const response = await fetch(`${API_BASE}/stories/${storyId}/seasons/${seasonId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      })

      const data = await response.json()

      if (data.success) {
        showModal('success', 'Season deleted successfully!')
        // Refresh the story details to show updated data
        if (expandedCard) {
          fetchStoryDetails(expandedCard)
        }
        // Reset selected season if it was deleted
        if (selectedSeasonId === seasonId) {
          setSelectedSeasonId(null)
        }
      } else {
        showModal('error', data.message || 'Failed to delete season')
      }
    } catch (error) {
      showModal('error', 'Error deleting season')
    } finally {
      setLoading(false)
    }
  }

  // Handle episode delete
  const handleEpisodeDelete = async (episodeId) => {
    try {
      setLoading(true)
      showModal('loading', 'Deleting episode...')
      
      // Use selectedStory._id as fallback if selectedStoryId is null
      const storyId = selectedStoryId || selectedStory?._id
      if (!storyId) {
        throw new Error('Story ID is missing')
      }
      
      // Use first season as fallback if selectedSeasonId is null
      let seasonId = selectedSeasonId
      if (!seasonId && selectedStory?.seasons?.length > 0) {
        seasonId = selectedStory.seasons[0]._id
      }
      
      if (!seasonId) {
        throw new Error('Season ID is missing')
      }
      
      
      const response = await fetch(`${API_BASE}/stories/${storyId}/seasons/${seasonId}/episodes/${episodeId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      })

      const data = await response.json()

      if (data.success) {
        showModal('success', 'Episode deleted successfully!')
        // Refresh the story details to show updated data
        if (expandedCard) {
          fetchStoryDetails(expandedCard)
        }
      } else {
        showModal('error', data.message || 'Failed to delete episode')
      }
    } catch (error) {
      console.error('Error in handleEpisodeDelete:', error)
      showModal('error', `Error deleting episode: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }


  // Load data on component mount
  useEffect(() => {
    fetchStories(currentPage)
  }, [currentPage, fetchStories])

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
                Stories
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
                onClick={() => setShowStoryForm(true)}
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
                <span>Add Story</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stories List */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {loading && stories.length === 0 ? (
            <div className="flex justify-center items-center py-20">
              <div className="text-white text-lg">Loading stories...</div>
            </div>
          ) : stories.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-gray-400 text-lg mb-6">No stories found</div>
              <button
                onClick={() => setShowStoryForm(true)}
                className="flex items-center space-x-2 mx-auto px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition duration-200"
              >
                <FiPlus className="w-4 h-4" />
                <span>Add Your First Story</span>
              </button>
            </div>
          ) : (
            <>
              {pendingStoryOrder && (
                <div className="flex items-center justify-between px-4 py-2 mb-4 bg-green-500/10 border border-green-500/40 rounded-xl">
                  <span className="text-green-400 text-sm font-medium">Drag to reorder — save when done</span>
                  <button
                    onClick={saveStoryOrder}
                    className="px-4 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-lg transition"
                  >
                    Save Order
                  </button>
                </div>
              )}
            <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {stories.map((story) => {
                const isThisCardExpanded = expandedCard === story._id
                const currentStory = expandedCard === story._id && selectedStory ? selectedStory : story
                
                return (
                  <div
                    key={story._id}
                    draggable
                    onDragStart={(e) => handleStoryDragStart(e, story._id)}
                    onDragOver={(e) => handleStoryDragOver(e, story._id)}
                    onDrop={handleStoryDrop}
                    onDragEnd={handleStoryDragEnd}
                    className={`transition-opacity duration-150 group rounded-lg ${draggingStoryId === story._id ? 'opacity-40' : 'opacity-100'} ${pendingStoryOrder && draggingStoryId !== story._id ? 'ring-1 ring-green-500/40' : ''}`}
                  >
                    {/* Story Card */}
                    <div 
                      className={`relative bg-gray-900 rounded-lg overflow-hidden transition-all duration-300 cursor-pointer border-2 w-[180px] h-[220px] ${
                        isThisCardExpanded 
                          ? 'scale-110 z-10 shadow-2xl border-blue-500' 
                          : 'hover:scale-105 hover:shadow-2xl border-transparent hover:border-gray-600'
                      }`}
                      onClick={() => {
                        if (isThisCardExpanded) {
                          handleCardCollapse()
                        } else {
                          handleCardExpand(story._id)
                        }
                      }}
                    >
                      {/* Drag handle badge – hidden until hover on outer wrapper */}
                      <div className="absolute top-1 left-1 z-20 rounded bg-black/50 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M10 4h.01M14 4h.01M10 9h.01M14 9h.01M10 14h.01M14 14h.01M10 19h.01M14 19h.01" />
                        </svg>
                      </div>
                      {/* Cover Image with Overlay Titles */}
                      <div className="relative w-full h-full overflow-hidden">
                        {story.coverImage ? (
                        <img
                          src={story.coverImage}
                          alt={story.title}
                            className="w-full h-full object-cover transition duration-300"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                            <span className="text-gray-500 text-sm">No Image</span>
                          </div>
                        )}
                        
                        {/* Title Overlay */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 z-10">
                          <h3 className="text-white text-sm font-semibold truncate mb-1">
                            {story.title}
                          </h3>
                          {story.mlTitle && (
                            <p className="text-gray-300 text-xs truncate">
                              {story.mlTitle}
                            </p>
                          )}
                        </div>
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
                          {!currentStory.description ? (
                            <div className="flex items-center justify-center py-20">
                              <div className="text-white text-lg">Loading details...</div>
                    </div>
                          ) : (
                            <div className="p-6">
                              {/* Header with Close Button */}
                              <div className="flex justify-between items-start mb-6">
                                <div className="flex-1">
                                  <h1 className="text-white text-2xl font-bold mb-2" style={{ fontFamily: 'Archivo Black' }}>
                                    {currentStory.title}
                                  </h1>
                                  {currentStory.mlTitle && (
                                    <p className="text-gray-300 text-base mb-3">
                                      {currentStory.mlTitle}
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
                    
                              {/* Cover Image */}
                              {currentStory.coverImage && (
                                <div className="mb-6 flex justify-center">
                                  <img
                                    src={currentStory.coverImage}
                                    alt={currentStory.title}
                                    className="max-w-full max-h-64 object-contain rounded-xl shadow-lg"
                                  />
                  </div>
                              )}

                              {/* Description */}
                              {currentStory.description && (
                                <div className="mb-6">
                                  <h2 className="text-white text-lg font-semibold mb-3" style={{ fontFamily: 'Archivo Black' }}>Description</h2>
                                  <p className="text-gray-300 text-sm leading-relaxed">
                                    {currentStory.description}
                                    </p>
                </div>
                              )}

                              {/* Malayalam Description */}
                              {currentStory.mlDescription && (
                                <div className="mb-6">
                                  <h2 className="text-white text-lg font-semibold mb-3" style={{ fontFamily: 'Archivo Black' }}>Malayalam Description</h2>
                                  <p className="text-gray-300 text-sm leading-relaxed">
                                    {currentStory.mlDescription}
                                  </p>
                                </div>
                              )}

                              {/* Tag and Status */}
                              <div className="flex flex-col space-y-2 mb-6">
                                {currentStory.Tag && (
                                  <span className="inline-block bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-medium w-fit">
                                    {currentStory.Tag}
                                                </span>
                                )}
                                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium w-fit ${
                                  currentStory.status === 'Active' 
                                    ? 'bg-green-600 text-white' 
                                    : 'bg-red-600 text-white'
                                }`}>
                                  {currentStory.status}
                                                  </span>
                              </div>

                              {/* Story Details */}
                              <div className="mb-6">
                                <h3 className="text-white text-sm font-medium mb-4 text-gray-300">Story Details</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {currentStory.priority && (
                                    <div className="bg-gray-800/30 rounded-lg p-2 w-fit">
                                      <span className="text-gray-400 text-xs">Priority</span>
                                      <p className="text-white text-sm">{currentStory.priority}</p>
                                    </div>
                                  )}
                                  {currentStory.seasons && (
                                    <div className="bg-gray-800/50 rounded-lg p-3">
                                      <span className="text-gray-400 text-xs mb-2 block">Seasons</span>
                                      <CustomDropdown
                                        options={currentStory.seasons.map((season) => ({
                                          value: season._id,
                                          label: `Season ${season.seasonNumber} (${season.episodes?.length || 0} episodes)`
                                        }))}
                                        value={selectedSeasonId || ''}
                                        onChange={(value) => setSelectedSeasonId(value)}
                                        placeholder="Select a season..."
                                        className="w-full"
                                      />
                                    </div>
                                  )}
                  </div>
                </div>

                              {/* Episodes Management */}
                              <div className="mb-6">
                    <div className="flex justify-between items-center mb-4">
                                  <h3 className="text-white text-lg font-semibold" style={{ fontFamily: 'Archivo Black' }}>
                                    {selectedSeasonId ? 'Episodes' : 'Seasons & Episodes'}
                                  </h3>
                                  <div className="flex items-center space-x-2">
                                    {selectedSeasonId ? (
                      <button
                                        onClick={(e) => {
                                          e.preventDefault()
                                          e.stopPropagation()
                                          setSelectedStoryId(currentStory._id)
                                          setShowEpisodeForm(true)
                                        }}
                                        className="flex items-center space-x-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition duration-200 text-sm"
                                      >
                                        <FiPlus className="w-4 h-4" />
                                        <span>Add Episode</span>
                                      </button>
                                    ) : (
                                      <button
                                        onClick={(e) => {
                                          e.preventDefault()
                                          e.stopPropagation()
                                          setSelectedStoryId(currentStory._id)
                          setShowSeasonForm(true)
                        }}
                                        className="flex items-center space-x-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition duration-200 text-sm"
                      >
                                        <FiPlus className="w-4 h-4" />
                        <span>Add Season</span>
                      </button>
                                    )}
                                  </div>
                    </div>
                    
                                {currentStory.seasons && currentStory.seasons.length > 0 ? (
                                  selectedSeasonId ? (
                                    // Show episodes for selected season
                                    (() => {
                                      const selectedSeason = currentStory.seasons.find(s => s._id === selectedSeasonId);
                                      return selectedSeason ? (
                                        <div className="space-y-4">
                                          {/* Selected Season Info */}
                                          <div className="bg-gray-800/50 rounded-lg border border-gray-700/50 p-4">
                                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center space-x-3">
                                                {selectedSeason.seasonBanner && (
                                                  <img
                                                    src={selectedSeason.seasonBanner}
                                                    alt={`Season ${selectedSeason.seasonNumber}`}
                                      className="w-12 h-12 object-cover rounded-lg"
                                    />
                                  )}
                                  <div>
                                                  <h4 className="text-white font-medium">Season {selectedSeason.seasonNumber}</h4>
                                    <p className="text-gray-400 text-sm">
                                                    {selectedSeason.episodes?.length || 0} episodes
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <button
                                                  onClick={(e) => {
                                                    e.preventDefault()
                                                    e.stopPropagation()
                                                    setSelectedSeasonId(null)
                                                  }}
                                                  className="px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded text-xs transition duration-200"
                                                >
                                                  Back to Seasons
                                  </button>
                              </div>
                            </div>

                            {/* Episodes List (drag handle to reorder) */}
                                            {selectedSeason.episodes && selectedSeason.episodes.length > 0 ? (
                                  <div className="space-y-2">
                                                {selectedSeason.episodes.map((episode) => (
                                                  <div
                                                    key={episode._id}
                                                    data-episode-id={episode._id}
                                                    draggable
                                                    onDragStart={(e) => {
                                                      e.dataTransfer.setData('text/plain', episode._id)
                                                      e.dataTransfer.effectAllowed = 'move'
                                                      setDragEpisodeId(episode._id)
                                                    }}
                                                    onDragOver={(e) => e.preventDefault()}
                                                    onDrop={(e) => {
                                                      e.preventDefault()
                                                      const toId = e.currentTarget.getAttribute('data-episode-id')
                                                      const fromId = e.dataTransfer.getData('text/plain')
                                                      setDragEpisodeId(null)
                                                      if (!toId || toId === fromId) return
                                                      const list = selectedSeason.episodes
                                                      const fromIdx = list.findIndex((ep) => String(ep._id) === String(fromId))
                                                      const toIdx = list.findIndex((ep) => String(ep._id) === String(toId))
                                                      if (fromIdx === -1 || toIdx === -1) return
                                                      const newList = [...list]
                                                      const [removed] = newList.splice(fromIdx, 1)
                                                      newList.splice(toIdx, 0, removed)
                                                      reorderEpisodes(newList.map((ep) => ep._id))
                                                    }}
                                                    onDragEnd={() => setDragEpisodeId(null)}
                                                    className={`bg-gray-700/20 backdrop-blur-sm rounded-lg p-3 cursor-pointer hover:bg-gray-700/30 transition duration-200 flex items-center gap-2 ${dragEpisodeId === episode._id ? 'opacity-50' : ''}`}
                                                    onClick={() => handleEpisodeSelect(episode)}
                                                  >
                                                    <span className="text-gray-500 shrink-0 cursor-grab active:cursor-grabbing" onClick={(e) => e.stopPropagation()} title="Drag to reorder">
                                                      <FiMenu className="w-4 h-4" />
                                                    </span>
                                        <div className="flex items-center justify-between flex-1 min-w-0">
                                          <div className="flex items-center space-x-3 min-w-0">
                                            {episode.coverImage && (
                                              <img
                                                src={episode.coverImage}
                                                alt={episode.title}
                                                className="w-10 h-10 object-cover rounded-lg"
                                              />
                                            )}
                                            <div>
                                                          <h6 className="text-white text-sm font-medium">{episode.title}</h6>
                                              <div className="flex items-center space-x-2 mt-1">
                                                <span className={`px-2 py-1 rounded-full text-xs ${
                                                  episode.status === 'Enable' 
                                                    ? 'bg-green-500/20 text-green-400' 
                                                    : 'bg-red-500/20 text-red-400'
                                                }`}>
                                                  {episode.status}
                                                </span>
                                                {episode.readTime && (
                                                  <span className="text-gray-400 text-xs">{episode.readTime}</span>
                                                )}
                                                {episode.highlight === 'Enable' && (
                                                  <span className="px-2 py-1 rounded-full text-xs bg-yellow-500/20 text-yellow-400">
                                                    Highlighted
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                          <div className="flex items-center space-x-1">
                                                        <button
                                                          onClick={(e) => {
                                                            e.preventDefault()
                                                            e.stopPropagation()
                                                            editEpisode(episode)
                                                          }}
                                                          className="p-1 text-gray-400 hover:text-purple-400 rounded"
                                                          title="Edit Episode"
                                                        >
                                                          <FiEdit3 className="w-3 h-3" />
                                            </button>
                                                        <button
                                                          onClick={(e) => {
                                                            e.preventDefault()
                                                            e.stopPropagation()
                                                            showModal('confirmation', 'Are you sure you want to delete this episode?', 
                                                              () => handleEpisodeDelete(episode._id),
                                                              () => showModal(null, '')
                                                            )
                                                          }}
                                                          className="p-1 text-gray-400 hover:text-red-400 rounded"
                                                          title="Delete Episode"
                                                        >
                                              <FiTrash2 className="w-3 h-3" />
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                            ) : (
                                              <div className="text-center py-6">
                                                <p className="text-gray-400 text-sm mb-3">No episodes in this season</p>
                                                <button
                                                  onClick={(e) => {
                                                    e.preventDefault()
                                                    e.stopPropagation()
                                                    setSelectedStoryId(currentStory._id)
                                                    setShowEpisodeForm(true)
                                                  }}
                                                  className="flex items-center space-x-2 mx-auto px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition duration-200 text-sm"
                                                >
                                                  <FiPlus className="w-4 h-4" />
                                                  <span>Add First Episode</span>
                                                </button>
                                </div>
                                            )}
                              </div>
                                        </div>
                                      ) : (
                                        <div className="text-center py-8">
                                          <p className="text-gray-400 text-sm">Season not found</p>
                                        </div>
                                      );
                                    })()
                                  ) : (
                                    // Show seasons list when no season is selected
                                    <div className="text-center py-8">
                                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {currentStory.seasons.map((season) => (
                                          <div key={season._id} className="bg-gray-800/50 rounded-lg border border-gray-700/50 p-4 hover:bg-gray-800/70 transition duration-200">
                                            <div className="flex items-center justify-between mb-3">
                                              <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setSelectedSeasonId(season._id)}>
                                                {season.seasonBanner && (
                                                  <img
                                                    src={season.seasonBanner}
                                                    alt={`Season ${season.seasonNumber}`}
                                                    className="w-12 h-12 object-cover rounded-lg"
                                                  />
                                                )}
                                                <div>
                                                  <h4 className="text-white font-medium">Season {season.seasonNumber}</h4>
                                                  <p className="text-gray-400 text-sm">
                                                    {season.episodes?.length || 0} episodes
                                                  </p>
                                                </div>
                                              </div>
                                              <div className="flex items-center space-x-2">
                                                <button
                                                  onClick={(e) => {
                                                    e.preventDefault()
                                                    e.stopPropagation()
                                                    editSeason(season)
                                                  }}
                                                  className="p-1 text-gray-400 hover:text-purple-400 rounded"
                                                  title="Edit Season"
                                                >
                                                  <FiEdit3 className="w-4 h-4" />
                                                </button>
                                                <button
                                                  onClick={(e) => {
                                                    e.preventDefault()
                                                    e.stopPropagation()
                                                    showModal('confirmation', 'Are you sure you want to delete this season? This will also delete all episodes in this season.', 
                                                      () => handleSeasonDelete(season._id),
                                                      () => showModal(null, '')
                                                    )
                                                  }}
                                                  className="p-1 text-gray-400 hover:text-red-400 rounded"
                                                  title="Delete Season"
                                                >
                                                  <FiTrash2 className="w-4 h-4" />
                                                </button>
                                              </div>
                                            </div>
                                            <p className="text-gray-500 text-xs cursor-pointer" onClick={() => setSelectedSeasonId(season._id)}>Click to view episodes</p>
                          </div>
                        ))}
                      </div>
                                    </div>
                                  )
                                ) : (
                                  <div className="text-center py-8">
                                    <p className="text-gray-400 text-sm mb-4">No seasons found</p>
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        setSelectedStoryId(currentStory._id)
                                        setShowSeasonForm(true)
                                      }}
                                      className="flex items-center space-x-2 mx-auto px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition duration-200 text-sm"
                                    >
                                      <FiPlus className="w-4 h-4" />
                                      <span>Add First Season</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                                          
                              {/* Footer with Date and Action Icons */}
                              <div className="flex items-center justify-between pt-4 border-t border-gray-700/50">
                                {/* Create Date */}
                                <div className="flex items-center space-x-1 text-sm text-gray-400">
                                  <HiCalendar className="w-4 h-4" />
                                  <span>
                                    {new Date(currentStory.createdAt).toLocaleDateString('en-US', {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric'
                                    })}
                                  </span>
                                </div>
                                
                                {/* Action Icons */}
                                <div className="flex items-center space-x-3">
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      editStory(currentStory)
                                    }}
                                    className="p-2 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 rounded-lg transition duration-200"
                                    title="Edit Story"
                                  >
                                    <FiEdit3 className="w-5 h-5" />
                                            </button>
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      showModal('confirmation', 'Are you sure you want to delete this story?', () => deleteStory(currentStory._id))
                                    }}
                                    className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition duration-200"
                                    title="Delete Story"
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
      </div>

        {totalStories > 0 && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
            <div className="flex flex-col items-center justify-center gap-3 text-sm text-gray-300 text-center">
              <div className="text-center">
                Showing {startIndex}-{endIndex} of {totalStories} stories
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-4 py-2 rounded-lg border border-gray-600 text-white hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Previous
                </button>
                <span className="text-gray-400">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 rounded-lg border border-gray-600 text-white hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Story Form Modal */}
        {showStoryForm && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-md flex items-center justify-center z-[10000] p-4">
            <div className="bg-gray-900/80 backdrop-blur-lg rounded-2xl p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-600/50 scrollbar-hide scroll-smooth scroll-indicator">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">
                  {editingStory ? 'Edit Story' : 'Add New Story'}
                </h2>
                <button
                  onClick={resetStoryForm}
                  className="text-gray-400 hover:text-white transition duration-200"
                >
                  <FiX className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={editingStory ? updateStory : createStory} className="space-y-6">
                {/* Title */}
                <div>
                  <label className="block text-white text-sm font-semibold mb-3" style={{ fontFamily: 'Archivo Black' }}>Title *</label>
                  <input
                    type="text"
                    value={storyForm.title}
                    onChange={(e) => setStoryForm({ ...storyForm, title: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200"
                  />
                </div>

                {/* Tag */}
                <div>
                  <label className="block text-white text-sm font-semibold mb-3" style={{ fontFamily: 'Archivo Black' }}>Tag *</label>
                  <input
                    type="text"
                    value={storyForm.Tag}
                    onChange={(e) => setStoryForm({ ...storyForm, Tag: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-white text-sm font-semibold mb-3" style={{ fontFamily: 'Archivo Black' }}>Description *</label>
                  <textarea
                    value={storyForm.description}
                    onChange={(e) => setStoryForm({ ...storyForm, description: e.target.value })}
                    required
                    rows={4}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200 resize-none scrollbar-hide scroll-smooth"
                  />
                </div>

                {/* Cover Image */}
                <div>
                  <label className="block text-white text-sm font-semibold mb-3" style={{ fontFamily: 'Archivo Black' }}>Cover Image</label>
                  {editingStory && editingStory.coverImage && (
                    <div className="mb-3">
                      <p className="text-gray-400 text-sm mb-2">Current image:</p>
                      <img src={editingStory.coverImage} alt="Current cover" className="w-20 h-20 object-cover rounded-lg" />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFileInputs({ ...fileInputs, coverImage: e.target })}
                    required={!editingStory}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-purple-500 file:text-white hover:file:bg-purple-600"
                  />
                </div>

                {/* Malayalam Title */}
                <div>
                  <label className="block text-white text-sm font-semibold mb-3" style={{ fontFamily: 'Archivo Black' }}>Malayalam Title *</label>
                  <input
                    type="text"
                    value={storyForm.mlTitle}
                    onChange={(e) => setStoryForm({ ...storyForm, mlTitle: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200"
                  />
                </div>

                {/* Malayalam Description */}
                <div>
                  <label className="block text-white text-sm font-semibold mb-3" style={{ fontFamily: 'Archivo Black' }}>Malayalam Description *</label>
                  <textarea
                    value={storyForm.mlDescription}
                    onChange={(e) => setStoryForm({ ...storyForm, mlDescription: e.target.value })}
                    required
                    rows={4}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200 resize-none scrollbar-hide scroll-smooth"
                  />
                </div>

              {/* Priority */}
              <div>
                <label className="block text-white text-sm font-semibold mb-3" style={{ fontFamily: 'Archivo Black' }}>Priority</label>
                <input
                  type="number"
                  value={storyForm.priority}
                  onChange={(e) => {
                    const value = e.target.value
                    const num = Number(value)
                    const safe =
                      !Number.isNaN(num) && num >= 1
                        ? String(Math.floor(num))
                        : '1'
                    setStoryForm({ ...storyForm, priority: safe })
                  }}
                  min={1}
                  step={1}
                  placeholder="1 for top story, 2 for second, etc."
                  className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200"
                />
                <p className="text-gray-400 text-xs mt-1">
                  Use 1 for highest priority, 2 for second, and so on.
                </p>
              </div>

                {/* Status */}
                <div>
                  <label className="block text-white text-sm font-semibold mb-3" style={{ fontFamily: 'Archivo Black' }}>Status</label>
                  <CustomDropdown
                    options={[
                      { value: 'Active', label: 'Active' },
                      { value: 'Inactive', label: 'Inactive' }
                    ]}
                    value={storyForm.status}
                    onChange={(value) => setStoryForm({ ...storyForm, status: value })}
                    placeholder="Select status..."
                    className="w-full"
                  />
                </div>

                {/* Schedule Upload — only for new stories */}
                {!editingStory && (
                  <SchedulePicker
                    enabled={scheduleEnabled}
                    onToggle={setScheduleEnabled}
                    scheduledAt={scheduledAt}
                    onDateChange={setScheduledAt}
                  />
                )}

                {/* Submit Buttons */}
                <div className="flex justify-end space-x-4 pt-8">
                  <button
                    type="button"
                    onClick={resetStoryForm}
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
                    <span>{loading ? 'Saving...' : (editingStory ? 'Update' : (scheduleEnabled ? 'Schedule' : 'Create'))}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Season Form Modal */}
        {showSeasonForm && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-md flex items-center justify-center z-[10000] p-4">
            <div className="bg-gray-900/80 backdrop-blur-lg rounded-2xl p-8 w-full max-w-md shadow-2xl border border-gray-600/50 scrollbar-hide scroll-smooth scroll-indicator">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'Archivo Black' }}>
                  {editingSeason ? 'Edit Season' : 'Add New Season'}
                </h2>
                <button
                  onClick={resetSeasonForm}
                  className="text-gray-400 hover:text-white transition duration-200"
                >
                  <FiX className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={editingSeason ? handleSeasonUpdate : createSeason} className="space-y-6">
                <div>
                  <label className="block text-white text-sm font-semibold mb-3" style={{ fontFamily: 'Archivo Black' }}>Season Number *</label>
                  <input
                    type="number"
                    value={seasonForm.seasonNumber}
                    onChange={(e) => setSeasonForm({ ...seasonForm, seasonNumber: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200"
                    required
                  />
                </div>

                <div>
                  <label className="block text-white text-sm font-semibold mb-3" style={{ fontFamily: 'Archivo Black' }}>Season Banner *</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFileInputs({ ...fileInputs, seasonBanner: e.target })}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-purple-500 file:text-white hover:file:bg-purple-600"
                    required
                  />
                </div>

                <div className="flex justify-end space-x-4 pt-8">
                  <button
                    type="button"
                    onClick={resetSeasonForm}
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
                    <span>{loading ? (editingSeason ? 'Updating...' : 'Creating...') : (editingSeason ? 'Update' : 'Create')}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Episode Form Modal */}
        {showEpisodeForm && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-md flex items-center justify-center z-[10000] p-4">
            <div className="bg-gray-900/80 backdrop-blur-lg rounded-2xl p-8 w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-600/50 scrollbar-hide scroll-smooth scroll-indicator">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'Archivo Black' }}>
                  {editingEpisode ? 'Edit Episode' : 'Add New Episode'}
                </h2>
                <button
                  onClick={resetEpisodeForm}
                  className="text-gray-400 hover:text-white transition duration-200"
                >
                  <FiX className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={editingEpisode ? handleEpisodeUpdate : createEpisode} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-white text-sm font-semibold mb-3" style={{ fontFamily: 'Archivo Black' }}>Title *</label>
                    <input
                      type="text"
                      value={episodeForm.title}
                      onChange={(e) => setEpisodeForm({ ...episodeForm, title: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-800/20 backdrop-blur-sm border border-gray-600/50 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-white text-sm font-semibold mb-3" style={{ fontFamily: 'Archivo Black' }}>Read Time</label>
                    <input
                      type="text"
                      value={episodeForm.readTime}
                      onChange={(e) => setEpisodeForm({ ...episodeForm, readTime: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-800/20 backdrop-blur-sm border border-gray-600/50 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-white text-sm font-semibold mb-3" style={{ fontFamily: 'Archivo Black' }}>Malayalam Title</label>
                    <input
                      type="text"
                      value={episodeForm.mlTitle}
                      onChange={(e) => setEpisodeForm({ ...episodeForm, mlTitle: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-800/20 backdrop-blur-sm border border-gray-600/50 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-white text-sm font-semibold mb-3" style={{ fontFamily: 'Archivo Black' }}>Urdu Title</label>
                    <input
                      type="text"
                      value={episodeForm.urTitle}
                      onChange={(e) => setEpisodeForm({ ...episodeForm, urTitle: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-800/20 backdrop-blur-sm border border-gray-600/50 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-white text-sm font-semibold mb-3" style={{ fontFamily: 'Archivo Black' }}>Hindi Title</label>
                    <input
                      type="text"
                      value={episodeForm.hinTitle}
                      onChange={(e) => setEpisodeForm({ ...episodeForm, hinTitle: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-800/20 backdrop-blur-sm border border-gray-600/50 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-white text-sm font-semibold mb-3" style={{ fontFamily: 'Archivo Black' }}>Status</label>
                    <CustomDropdown
                      options={[
                        { value: 'Enable', label: 'Enable' },
                        { value: 'Disable', label: 'Disable' }
                      ]}
                      value={episodeForm.status}
                      onChange={(value) => setEpisodeForm({ ...episodeForm, status: value })}
                      placeholder="Select status..."
                      className="w-full"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-white text-sm font-semibold mb-3" style={{ fontFamily: 'Archivo Black' }}>Highlight</label>
                    <CustomDropdown
                      options={[
                        { value: 'Enable', label: 'Enable' },
                        { value: 'Disable', label: 'Disable' }
                      ]}
                      value={episodeForm.highlight}
                      onChange={(value) => setEpisodeForm({ ...episodeForm, highlight: value, highlightExpiresAt: value === 'Disable' ? '' : episodeForm.highlightExpiresAt })}
                      placeholder="Select highlight..."
                      className="w-full"
                    />
                    {episodeForm.highlight === 'Enable' && (
                      <HighlightDurationPicker
                        value={episodeForm.highlightExpiresAt}
                        onChange={(val) => setEpisodeForm({ ...episodeForm, highlightExpiresAt: val })}
                      />
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-white text-sm font-semibold mb-3" style={{ fontFamily: 'Archivo Black' }}>Cover Image</label>
                  {editingEpisode && editingEpisode.coverImage && (
                    <div className="mb-3">
                      <p className="text-gray-400 text-sm mb-2">Current image:</p>
                      <img src={editingEpisode.coverImage} alt="Current cover" className="w-20 h-20 object-cover rounded-lg" />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFileInputs({ ...fileInputs, coverImage: e.target })}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-purple-500 file:text-white hover:file:bg-purple-600"
                  />
                </div>

                <div>
                  <label className="block text-white text-sm font-semibold mb-3" style={{ fontFamily: 'Archivo Black' }}>Story File *</label>
                  {editingEpisode && editingEpisode.storyFile && (
                    <div className="mb-3">
                      <p className="text-gray-400 text-sm mb-2">Current file:</p>
                      <button 
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          window.open(editingEpisode.storyFile, '_blank', 'noopener,noreferrer')
                        }}
                        className="text-purple-400 hover:text-purple-300 text-sm underline"
                      >
                        View current story file
                      </button>
                    </div>
                  )}
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => setFileInputs({ ...fileInputs, storyFile: e.target })}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-purple-500 file:text-white hover:file:bg-purple-600"
                    required={!editingEpisode}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-white text-sm font-semibold mb-3" style={{ fontFamily: 'Archivo Black' }}>Malayalam Story File</label>
                    {editingEpisode && editingEpisode.mlStoryFile && (
                      <div className="mb-3">
                        <p className="text-gray-400 text-sm mb-2">Current file:</p>
                        <button 
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            window.open(editingEpisode.mlStoryFile, '_blank', 'noopener,noreferrer')
                          }}
                          className="text-purple-400 hover:text-purple-300 text-sm underline"
                        >
                          View current ML story file
                        </button>
                      </div>
                    )}
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => setFileInputs({ ...fileInputs, mlStoryFile: e.target })}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-purple-500 file:text-white hover:file:bg-purple-600"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-white text-sm font-semibold mb-3" style={{ fontFamily: 'Archivo Black' }}>Urdu Story File</label>
                    {editingEpisode && editingEpisode.urStoryFile && (
                      <div className="mb-3">
                        <p className="text-gray-400 text-sm mb-2">Current file:</p>
                        <button 
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            window.open(editingEpisode.urStoryFile, '_blank', 'noopener,noreferrer')
                          }}
                          className="text-purple-400 hover:text-purple-300 text-sm underline"
                        >
                          View current UR story file
                        </button>
                      </div>
                    )}
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => setFileInputs({ ...fileInputs, urStoryFile: e.target })}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-purple-500 file:text-white hover:file:bg-purple-600"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-white text-sm font-semibold mb-3" style={{ fontFamily: 'Archivo Black' }}>Hindi Story File</label>
                    {editingEpisode && editingEpisode.hinStoryFile && (
                      <div className="mb-3">
                        <p className="text-gray-400 text-sm mb-2">Current file:</p>
                        <button 
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            window.open(editingEpisode.hinStoryFile, '_blank', 'noopener,noreferrer')
                          }}
                          className="text-purple-400 hover:text-purple-300 text-sm underline"
                        >
                          View current HIN story file
                        </button>
                      </div>
                    )}
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => setFileInputs({ ...fileInputs, hinStoryFile: e.target })}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-purple-500 file:text-white hover:file:bg-purple-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div>
                    <label className="block text-white text-sm font-semibold mb-3" style={{ fontFamily: 'Archivo Black' }}>Ad Banner</label>
                    {editingEpisode && editingEpisode.adBanner && (
                      <div className="mb-3">
                        <p className="text-gray-400 text-sm mb-2">Current banner:</p>
                        <img 
                          src={editingEpisode.adBanner} 
                          alt="Current ad banner" 
                          className="w-20 h-12 object-cover rounded-lg"
                          onError={(e) => {
                            e.target.style.display = 'none'
                            e.target.nextSibling.style.display = 'flex'
                          }}
                        />
                        <div 
                          className="w-20 h-12 bg-gray-700/50 rounded-lg flex items-center justify-center text-gray-400 text-xs hidden"
                        >
                          No banner available
                        </div>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setFileInputs({ ...fileInputs, adBanner: e.target })}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-purple-500 file:text-white hover:file:bg-purple-600"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-white text-sm font-semibold mb-3" style={{ fontFamily: 'Archivo Black' }}>Malayalam Banner</label>
                    {editingEpisode && editingEpisode.mlBanner && (
                      <div className="mb-3">
                        <p className="text-gray-400 text-sm mb-2">Current banner:</p>
                        <img 
                          src={editingEpisode.mlBanner} 
                          alt="Current ML banner" 
                          className="w-20 h-12 object-cover rounded-lg"
                          onError={(e) => {
                            e.target.style.display = 'none'
                            e.target.nextSibling.style.display = 'flex'
                          }}
                        />
                        <div 
                          className="w-20 h-12 bg-gray-700/50 rounded-lg flex items-center justify-center text-gray-400 text-xs hidden"
                        >
                          No banner available
                        </div>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setFileInputs({ ...fileInputs, mlBanner: e.target })}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-purple-500 file:text-white hover:file:bg-purple-600"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-white text-sm font-semibold mb-3" style={{ fontFamily: 'Archivo Black' }}>Urdu Banner</label>
                    {editingEpisode && editingEpisode.urBanner && (
                      <div className="mb-3">
                        <p className="text-gray-400 text-sm mb-2">Current banner:</p>
                        <img 
                          src={editingEpisode.urBanner} 
                          alt="Current UR banner" 
                          className="w-20 h-12 object-cover rounded-lg"
                          onError={(e) => {
                            e.target.style.display = 'none'
                            e.target.nextSibling.style.display = 'flex'
                          }}
                        />
                        <div 
                          className="w-20 h-12 bg-gray-700/50 rounded-lg flex items-center justify-center text-gray-400 text-xs hidden"
                        >
                          No banner available
                        </div>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setFileInputs({ ...fileInputs, urBanner: e.target })}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-purple-500 file:text-white hover:file:bg-purple-600"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-white text-sm font-semibold mb-3" style={{ fontFamily: 'Archivo Black' }}>Hindi Banner</label>
                    {editingEpisode && editingEpisode.hinBanner && (
                      <div className="mb-3">
                        <p className="text-gray-400 text-sm mb-2">Current banner:</p>
                        <img 
                          src={editingEpisode.hinBanner} 
                          alt="Current HIN banner" 
                          className="w-20 h-12 object-cover rounded-lg"
                          onError={(e) => {
                            e.target.style.display = 'none'
                            e.target.nextSibling.style.display = 'flex'
                          }}
                        />
                        <div 
                          className="w-20 h-12 bg-gray-700/50 rounded-lg flex items-center justify-center text-gray-400 text-xs hidden"
                        >
                          No banner available
                        </div>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setFileInputs({ ...fileInputs, hinBanner: e.target })}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-purple-500 file:text-white hover:file:bg-purple-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-white text-sm font-semibold mb-3" style={{ fontFamily: 'Archivo Black' }}>Music (MP3)</label>
                  {editingEpisode && editingEpisode.music && (
                    <div className="mb-3">
                      <p className="text-gray-400 text-sm mb-2">Current music:</p>
                      <audio 
                        controls 
                        className="w-full mb-2"
                        src={editingEpisode.music}
                      >
                        Your browser does not support the audio element.
                      </audio>
                      <button 
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          window.open(editingEpisode.music, '_blank', 'noopener,noreferrer')
                        }}
                        className="text-purple-400 hover:text-purple-300 text-sm underline"
                      >
                        Open music file
                      </button>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="audio/mpeg,audio/mp3,.mp3"
                    onChange={(e) => setFileInputs({ ...fileInputs, music: e.target })}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-purple-500 file:text-white hover:file:bg-purple-600"
                  />
                  <p className="text-gray-400 text-xs mt-2">Only MP3 format is supported</p>
                </div>

                <div className="flex justify-end space-x-4 pt-8">
                  <button
                    type="button"
                    onClick={resetEpisodeForm}
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
                    <span>{loading ? (editingEpisode ? 'Updating...' : 'Creating...') : (editingEpisode ? 'Update' : 'Create')}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Episode Details Modal */}
        {showEpisodeDetails && selectedEpisode && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-md z-[10000] flex items-center justify-center p-4">
            <div className="bg-gray-900/80 backdrop-blur-lg rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-600/50 scrollbar-hide scroll-smooth">
              <div className="p-6">
                {/* Header with Close Button */}
                <div className="flex justify-between items-start mb-6">
                  <div className="flex-1">
                    <h1 className="text-white text-2xl font-bold mb-2" style={{ fontFamily: 'Archivo Black' }}>
                      {selectedEpisode.title}
                    </h1>
                    {selectedEpisode.mlTitle && (
                      <p className="text-gray-300 text-base mb-3">
                        {selectedEpisode.mlTitle}
                      </p>
                    )}
                    {selectedEpisode.urTitle && (
                      <p className="text-gray-300 text-base mb-3">
                        Urdu: {selectedEpisode.urTitle}
                      </p>
                    )}
                    {selectedEpisode.hinTitle && (
                      <p className="text-gray-300 text-base mb-3">
                        Hindi: {selectedEpisode.hinTitle}
                      </p>
        )}
      </div>
                  <button
                    onClick={handleEpisodeDetailsClose}
                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition duration-200"
                  >
                    <FiX className="w-5 h-5" />
                  </button>
      </div>

                {/* Cover Image */}
                {selectedEpisode.coverImage && (
                  <div className="mb-6 flex justify-center">
                    <img
                      src={selectedEpisode.coverImage}
                      alt={selectedEpisode.title}
                      className="max-w-full max-h-64 object-contain rounded-xl shadow-lg"
                    />
                  </div>
                )}

                {/* Episode Details */}
                <div className="mb-6">
                  <h3 className="text-white text-sm font-medium mb-4 text-gray-300">Episode Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-800/50 rounded-lg p-3">
                      <span className="text-gray-400 text-xs">Status</span>
                      <p className={`text-sm ${
                        selectedEpisode.status === 'Enable' ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {selectedEpisode.status}
                      </p>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-3">
                      <span className="text-gray-400 text-xs">Read Time</span>
                      <p className="text-white text-sm">{selectedEpisode.readTime || 'N/A'}</p>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-3">
                      <span className="text-gray-400 text-xs">Highlight</span>
                      <p className={`text-sm ${
                        selectedEpisode.highlight === 'Enable' ? 'text-yellow-400' : 'text-gray-400'
                      }`}>
                        {selectedEpisode.highlight}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Files Section */}
                <div className="mb-6">
                  <h3 className="text-white text-lg font-semibold mb-4" style={{ fontFamily: 'Archivo Black' }}>Files</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedEpisode.storyFile && (
                      <div className="bg-gray-800/50 rounded-lg p-3">
                        <span className="text-gray-400 text-xs">Story File (EN)</span>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            onClick={() => window.open(selectedEpisode.storyFile, '_blank', 'noopener,noreferrer')}
                            className="text-purple-400 hover:text-purple-300 text-sm underline"
                          >
                            View Story File
                          </button>
                          <button
                            onClick={() => selectedStoryId && selectedSeasonId && handleDownloadEpisodePdf(selectedStoryId, selectedSeasonId, selectedEpisode._id, 'en')}
                            className="text-sm px-3 py-1.5 bg-purple-600/80 hover:bg-purple-600 text-white rounded-lg"
                          >
                            Download PDF
                          </button>
                        </div>
                      </div>
                    )}
                    {selectedEpisode.mlStoryFile && (
                      <div className="bg-gray-800/50 rounded-lg p-3">
                        <span className="text-gray-400 text-xs">Story File (ML)</span>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            onClick={() => window.open(selectedEpisode.mlStoryFile, '_blank', 'noopener,noreferrer')}
                            className="text-purple-400 hover:text-purple-300 text-sm underline"
                          >
                            View Malayalam Story
                          </button>
                          <button
                            onClick={() => selectedStoryId && selectedSeasonId && handleDownloadEpisodePdf(selectedStoryId, selectedSeasonId, selectedEpisode._id, 'ml')}
                            className="text-sm px-3 py-1.5 bg-purple-600/80 hover:bg-purple-600 text-white rounded-lg"
                          >
                            Download PDF
                          </button>
                        </div>
                      </div>
                    )}
                    {selectedEpisode.urStoryFile && (
                      <div className="bg-gray-800/50 rounded-lg p-3">
                        <span className="text-gray-400 text-xs">Story File (UR)</span>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            onClick={() => window.open(selectedEpisode.urStoryFile, '_blank', 'noopener,noreferrer')}
                            className="text-purple-400 hover:text-purple-300 text-sm underline"
                          >
                            View Urdu Story
                          </button>
                          <button
                            onClick={() => selectedStoryId && selectedSeasonId && handleDownloadEpisodePdf(selectedStoryId, selectedSeasonId, selectedEpisode._id, 'ur')}
                            className="text-sm px-3 py-1.5 bg-purple-600/80 hover:bg-purple-600 text-white rounded-lg"
                          >
                            Download PDF
                          </button>
                        </div>
                      </div>
                    )}
                    {selectedEpisode.hinStoryFile && (
                      <div className="bg-gray-800/50 rounded-lg p-3">
                        <span className="text-gray-400 text-xs">Story File (HIN)</span>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            onClick={() => window.open(selectedEpisode.hinStoryFile, '_blank', 'noopener,noreferrer')}
                            className="text-purple-400 hover:text-purple-300 text-sm underline"
                          >
                            View Hindi Story
                          </button>
                          <button
                            onClick={() => selectedStoryId && selectedSeasonId && handleDownloadEpisodePdf(selectedStoryId, selectedSeasonId, selectedEpisode._id, 'hin')}
                            className="text-sm px-3 py-1.5 bg-purple-600/80 hover:bg-purple-600 text-white rounded-lg"
                          >
                            Download PDF
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Music Section */}
                {selectedEpisode.music && (
                  <div className="mb-6">
                    <h3 className="text-white text-lg font-semibold mb-4" style={{ fontFamily: 'Archivo Black' }}>Music</h3>
                    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-600/50">
                      <audio 
                        controls 
                        className="w-full"
                        src={selectedEpisode.music}
                      >
                        Your browser does not support the audio element.
                      </audio>
                      <button 
                        onClick={() => window.open(selectedEpisode.music, '_blank', 'noopener,noreferrer')}
                        className="mt-2 text-purple-400 hover:text-purple-300 text-sm underline"
                      >
                        Open music file in new tab
                      </button>
                    </div>
                  </div>
                )}

                {/* Banners Section */}
                <div className="mb-6">
                  <h3 className="text-white text-lg font-semibold mb-4" style={{ fontFamily: 'Archivo Black' }}>Banners</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Ad Banner */}
                    <div className="bg-gray-800/50 rounded-lg p-3">
                      <span className="text-gray-400 text-xs">Ad Banner</span>
                      <div className="mt-2">
                        {selectedEpisode.adBanner ? (
                          <img
                            src={selectedEpisode.adBanner}
                            alt="Ad Banner"
                            className="w-full h-20 object-cover rounded-lg"
                            onError={(e) => {
                              e.target.style.display = 'none'
                              e.target.nextSibling.style.display = 'flex'
                            }}
                          />
                        ) : null}
                        <div 
                          className={`w-full h-20 bg-gray-700/50 rounded-lg flex items-center justify-center text-gray-400 text-xs ${selectedEpisode.adBanner ? 'hidden' : 'flex'}`}
                        >
                          No banner available
                        </div>
                      </div>
                    </div>

                    {/* ML Banner */}
                    <div className="bg-gray-800/50 rounded-lg p-3">
                      <span className="text-gray-400 text-xs">ML Banner</span>
                      <div className="mt-2">
                        {selectedEpisode.mlBanner ? (
                          <img
                            src={selectedEpisode.mlBanner}
                            alt="Malayalam Banner"
                            className="w-full h-20 object-cover rounded-lg"
                            onError={(e) => {
                              e.target.style.display = 'none'
                              e.target.nextSibling.style.display = 'flex'
                            }}
                          />
                        ) : null}
                        <div 
                          className={`w-full h-20 bg-gray-700/50 rounded-lg flex items-center justify-center text-gray-400 text-xs ${selectedEpisode.mlBanner ? 'hidden' : 'flex'}`}
                        >
                          No banner available
                        </div>
                      </div>
                    </div>

                    {/* UR Banner */}
                    <div className="bg-gray-800/50 rounded-lg p-3">
                      <span className="text-gray-400 text-xs">UR Banner</span>
                      <div className="mt-2">
                        {selectedEpisode.urBanner ? (
                          <img
                            src={selectedEpisode.urBanner}
                            alt="Urdu Banner"
                            className="w-full h-20 object-cover rounded-lg"
                            onError={(e) => {
                              e.target.style.display = 'none'
                              e.target.nextSibling.style.display = 'flex'
                            }}
                          />
                        ) : null}
                        <div 
                          className={`w-full h-20 bg-gray-700/50 rounded-lg flex items-center justify-center text-gray-400 text-xs ${selectedEpisode.urBanner ? 'hidden' : 'flex'}`}
                        >
                          No banner available
                        </div>
                      </div>
                    </div>

                    {/* HIN Banner */}
                    <div className="bg-gray-800/50 rounded-lg p-3">
                      <span className="text-gray-400 text-xs">HIN Banner</span>
                      <div className="mt-2">
                        {selectedEpisode.hinBanner ? (
                          <img
                            src={selectedEpisode.hinBanner}
                            alt="Hindi Banner"
                            className="w-full h-20 object-cover rounded-lg"
                            onError={(e) => {
                              e.target.style.display = 'none'
                              e.target.nextSibling.style.display = 'flex'
                            }}
                          />
                        ) : null}
                        <div 
                          className={`w-full h-20 bg-gray-700/50 rounded-lg flex items-center justify-center text-gray-400 text-xs ${selectedEpisode.hinBanner ? 'hidden' : 'flex'}`}
                        >
                          No banner available
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-4 pt-6 border-t border-gray-700/50">
                  <button
                    onClick={() => {
                      handleEpisodeDetailsClose()
                      editEpisode(selectedEpisode)
                    }}
                    className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition duration-200 text-sm"
                  >
                    <FiEdit3 className="w-4 h-4" />
                    <span>Edit Episode</span>
                  </button>
                  <button
                    onClick={() => {
                      handleEpisodeDetailsClose()
                      showModal('confirmation', 'Are you sure you want to delete this episode?', 
                        () => handleEpisodeDelete(selectedEpisode._id),
                        () => showModal(null, '')
                      )
                    }}
                    className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition duration-200 text-sm"
                  >
                    <FiTrash2 className="w-4 h-4" />
                    <span>Delete Episode</span>
                  </button>
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

export default Stories
