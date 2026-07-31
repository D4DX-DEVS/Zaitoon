import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import CustomDropdown from '../components/CustomDropdown'
import { 
  BookOpenIcon, 
  DocumentTextIcon, 
  VideoCameraIcon,
  EyeIcon,
  CalendarIcon,
  TagIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import axios from 'axios'
import logo from '../assets/logo.png'
import gradient from '../assets/gradiantRight.png'

function Dashboard() {
  const resolveMediaUrl = (url) => {
    if (!url) return url
    const trimmed = String(url).trim()
    if (/^https?:\/\//i.test(trimmed)) return trimmed
    if (trimmed.startsWith('//')) return `https:${trimmed}`
    if (/^[a-z0-9.-]+\.digitaloceanspaces\.com\//i.test(trimmed)) return `https://${trimmed}`
    if (/^[a-z0-9.-]+\.cdn\.digitaloceanspaces\.com\//i.test(trimmed)) return `https://${trimmed}`
    return trimmed
  }
  const navigate = useNavigate()
  const [stories, setStories] = useState([])
  const [videos, setVideos] = useState([])
  const [singleStories, setSingleStories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Story expansion states
  const [expandedCard, setExpandedCard] = useState(null)
  const [selectedStory, setSelectedStory] = useState(null)
  const [selectedSeasonId, setSelectedSeasonId] = useState(null)
  const [selectedEpisode, setSelectedEpisode] = useState(null)
  const [showEpisodeDetails, setShowEpisodeDetails] = useState(false)
  
  // Single story expansion states
  const [expandedSingleStory, setExpandedSingleStory] = useState(null)
  const [selectedSingleStory, setSelectedSingleStory] = useState(null)
  
  // Video expansion states
  const [expandedVideo, setExpandedVideo] = useState(null)
  const [selectedVideo, setSelectedVideo] = useState(null)
  
  // Ref for modal scroll position
  const modalRef = useRef(null)
  
  // Refs for horizontal scroll containers
  const storiesScrollRef = useRef(null)
  const singleStoriesScrollRef = useRef(null)
  const videosScrollRef = useRef(null)

  // Store wheel event handlers for proper cleanup
  const wheelHandlers = useRef({
    stories: null,
    singleStories: null,
    videos: null
  })

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

  // Download single story PDF - open tab immediately to avoid popup blocking, then load URL
  const handleDownloadSingleStoryPdf = async (storyId, lang = 'en') => {
    if (!storyId) return
    const downloadWindow = window.open('', '_blank', 'noopener,noreferrer')
    try {
      const res = await axios.get(`${API_BASE_URL}/single-stories/${storyId}/download-pdf`, { params: { lang } })
      const url = res.data?.data?.downloadUrl
      if (res.data?.success && url) {
        if (downloadWindow) {
          downloadWindow.location = url
        } else {
          window.location.href = url
        }
      } else {
        if (downloadWindow) downloadWindow.close()
        console.error('Download PDF error:', res.data?.message || 'Could not get download link')
      }
    } catch (err) {
      if (downloadWindow) downloadWindow.close()
      console.error('Download PDF error:', err)
    }
  }

  // Download story episode PDF (storyId = expandedCard, seasonId = selectedSeasonId when episode modal is open)
  const handleDownloadEpisodePdf = async (storyId, seasonId, episodeId, lang = 'en') => {
    if (!storyId || !seasonId || !episodeId) return
    const downloadWindow = window.open('', '_blank', 'noopener,noreferrer')
    try {
      const res = await axios.get(`${API_BASE_URL}/stories/${storyId}/seasons/${seasonId}/episodes/${episodeId}/download-pdf`, { params: { lang } })
      const url = res.data?.data?.downloadUrl
      if (res.data?.success && url) {
        if (downloadWindow) {
          downloadWindow.location = url
        } else {
          window.location.href = url
        }
      } else {
        if (downloadWindow) downloadWindow.close()
        console.error('Download PDF error:', res.data?.message || 'Could not get download link')
      }
    } catch (err) {
      if (downloadWindow) downloadWindow.close()
      console.error('Download PDF error:', err)
    }
  }

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

  // Check if any popup/modal is currently open (optimized - no logging)
  const isAnyPopupOpen = () => {
    return expandedCard !== null || expandedSingleStory !== null || expandedVideo !== null || showEpisodeDetails
  }

  // Handle wheel events for horizontal scrolling
  const handleWheel = (e, scrollRef) => {
    // If any popup is open, don't allow background scrolling
    if (isAnyPopupOpen()) {
      return
    }
    
    if (scrollRef.current) {
      // Check if scrolling is actually possible
      const canScroll = scrollRef.current.scrollWidth > scrollRef.current.clientWidth
      if (!canScroll) {
        return // No need to prevent default if can't scroll
      }
      
      // Only prevent default and handle if there's actual delta
      const deltaY = e.deltaY
      // Ignore zero or near-zero deltas (like -0, 0, or very small values)
      if (Math.abs(deltaY) < 1) {
        return
      }
      
      e.preventDefault()
      e.stopPropagation()
      const scrollAmount = deltaY * 1.5
      scrollRef.current.scrollLeft += scrollAmount
    }
  }

  useEffect(() => {
    fetchAllData()
  }, [])

  // Re-attach wheel listeners when popup closes
  useEffect(() => {
    const popupOpen = isAnyPopupOpen()
    
    // If no popup is open, re-attach listeners for all containers
    if (!popupOpen) {
      const refs = [
        { ref: storiesScrollRef, key: 'stories' },
        { ref: singleStoriesScrollRef, key: 'singleStories' },
        { ref: videosScrollRef, key: 'videos' }
      ]
      
      refs.forEach(({ ref, key }) => {
        if (ref.current && !wheelHandlers.current[key]) {
          const handler = (e) => handleWheel(e, ref)
          wheelHandlers.current[key] = handler
          ref.current.addEventListener('wheel', handler, { passive: false })
        }
      })
    }
  }, [expandedCard, expandedSingleStory, expandedVideo, showEpisodeDetails])

  // Handle mouse enter/leave for scroll containers
  const handleMouseEnter = (scrollRef, containerType) => {
    // Don't attach wheel listener if any popup is open
    if (isAnyPopupOpen()) {
      return
    }
    
    if (scrollRef.current && !wheelHandlers.current[containerType]) {
      // Create handler function
      const handler = (e) => handleWheel(e, scrollRef)
      wheelHandlers.current[containerType] = handler
      scrollRef.current.addEventListener('wheel', handler, { passive: false })
    }
  }

  const handleMouseLeave = (scrollRef, containerType) => {
    if (scrollRef.current && wheelHandlers.current[containerType]) {
      scrollRef.current.removeEventListener('wheel', wheelHandlers.current[containerType])
      wheelHandlers.current[containerType] = null
    }
  }

  const fetchAllData = async () => {
    try {
      setLoading(true)
      const [storiesRes, videosRes, singleStoriesRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/stories?limit=6&sort=-createdAt`),
        axios.get(`${API_BASE_URL}/videos?limit=6&sort=-createdAt`),
        axios.get(`${API_BASE_URL}/single-stories?limit=6&sort=-createdAt`)
      ])

      setStories(storiesRes.data.data.stories || [])
      setVideos(videosRes.data.data.videos || [])
      setSingleStories(singleStoriesRes.data.data || [])
    } catch (err) {
      console.error('Error fetching data:', err)
      setError('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const truncateText = (text, maxLength = 100) => {
    if (!text) return ''
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
  }

  // Fetch single story details
  const fetchStoryDetails = async (storyId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/stories/${storyId}`)
      if (response.data.success) {
        setSelectedStory(response.data.data)
        // Auto-select first season if available
        if (response.data.data.seasons && response.data.data.seasons.length > 0) {
          setSelectedSeasonId(response.data.data.seasons[0]._id)
        }
      } else {
        setError('Failed to fetch story details')
      }
    } catch (error) {
      console.error('Error in fetchStoryDetails:', error)
      setError('Error fetching story details')
    }
  }

  // Handle card expand
  const handleCardExpand = (storyId) => {
    setExpandedCard(storyId)
    fetchStoryDetails(storyId)
    // Remove all active wheel listeners when popup opens
    removeAllWheelListeners()
  }

  // Handle season selection without scroll reset
  const handleSeasonSelect = (seasonId) => {
    // Store current scroll position
    const currentScrollTop = modalRef.current?.scrollTop || 0
    
    setSelectedSeasonId(seasonId)
    
    // Restore scroll position after state update
    setTimeout(() => {
      if (modalRef.current) {
        modalRef.current.scrollTop = currentScrollTop
      }
    }, 0)
  }

  // Handle card collapse
  const handleCardCollapse = () => {
    setExpandedCard(null)
    setSelectedStory(null)
    setSelectedSeasonId(null)
    setSelectedEpisode(null)
    setShowEpisodeDetails(false)
  }

  // Handle episode selection
  const handleEpisodeSelect = (episode) => {
    setSelectedEpisode(episode)
    setShowEpisodeDetails(true)
    // Remove all active wheel listeners when popup opens
    removeAllWheelListeners()
  }

  // Handle episode details close
  const handleEpisodeDetailsClose = () => {
    setSelectedEpisode(null)
    setShowEpisodeDetails(false)
  }

  // Remove all active wheel listeners from scroll containers
  const removeAllWheelListeners = () => {
    const refs = [
      { ref: storiesScrollRef, key: 'stories' },
      { ref: singleStoriesScrollRef, key: 'singleStories' },
      { ref: videosScrollRef, key: 'videos' }
    ]
    
    refs.forEach(({ ref, key }) => {
      if (ref.current && wheelHandlers.current[key]) {
        ref.current.removeEventListener('wheel', wheelHandlers.current[key])
        wheelHandlers.current[key] = null
      }
    })
  }

  // Fetch single story details
  const fetchSingleStoryDetails = async (storyId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/single-stories/${storyId}`)
      if (response.data.success) {
        setSelectedSingleStory(response.data.data)
      } else {
        setError('Failed to fetch single story details')
      }
    } catch (error) {
      console.error('Error in fetchSingleStoryDetails:', error)
      setError('Error fetching single story details')
    }
  }

  // Handle single story card expand
  const handleSingleStoryExpand = (storyId) => {
    setExpandedSingleStory(storyId)
    fetchSingleStoryDetails(storyId)
    // Remove all active wheel listeners when popup opens
    removeAllWheelListeners()
  }

  // Handle single story card collapse
  const handleSingleStoryCollapse = () => {
    setExpandedSingleStory(null)
    setSelectedSingleStory(null)
  }

  // Fetch video details
  const fetchVideoDetails = async (videoId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/videos/${videoId}`)
      if (response.data.success) {
        setSelectedVideo(response.data.data)
      } else {
        setError('Failed to fetch video details')
      }
    } catch (error) {
      console.error('Error in fetchVideoDetails:', error)
      setError('Error fetching video details')
    }
  }

  // Handle video card expand
  const handleVideoExpand = (videoId) => {
    setExpandedVideo(videoId)
    fetchVideoDetails(videoId)
    // Remove all active wheel listeners when popup opens
    removeAllWheelListeners()
  }

  // Handle video card collapse
  const handleVideoCollapse = () => {
    setExpandedVideo(null)
    setSelectedVideo(null)
  }

  const ViewAllCard = ({ type, onClick }) => {
    return (
      <div 
        onClick={onClick}
        className="relative bg-gray-900 rounded-lg overflow-hidden transition-all duration-300 cursor-pointer border-2 hover:scale-105 hover:shadow-2xl border-transparent hover:border-violet-500 w-[180px] h-[220px]"
      >
        {/* Full Card - Gradient Background */}
        <div className="relative w-full h-full overflow-hidden bg-gradient-to-br from-violet-600/20 to-purple-600/20 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-violet-600/30 flex items-center justify-center mb-3 mx-auto">
              <svg className="w-6 h-6 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <p className="text-violet-300 text-xs font-medium">View All</p>
          </div>
        </div>
      </div>
    )
  }

  const ContentCard = ({ item, type, onClick }) => {
    const isThisCardExpanded = expandedCard === item._id
    const isThisSingleStoryExpanded = expandedSingleStory === item._id
    const isThisVideoExpanded = expandedVideo === item._id
    const currentStory = expandedCard === item._id && selectedStory ? selectedStory : item
    const currentSingleStory = expandedSingleStory === item._id && selectedSingleStory ? selectedSingleStory : item
    const currentVideo = expandedVideo === item._id && selectedVideo ? selectedVideo : item

    return (
      <div key={item._id}>
        {/* Content Card */}
        <div 
          className={`relative bg-gray-900 rounded-lg overflow-hidden transition-all duration-300 cursor-pointer border-2 w-[180px] h-[220px] ${
            isThisCardExpanded || isThisSingleStoryExpanded || isThisVideoExpanded
              ? 'scale-110 z-10 shadow-2xl border-blue-500' 
              : 'hover:scale-105 hover:shadow-2xl border-transparent hover:border-gray-600'
          }`}
          onClick={() => {
            if (type === 'story') {
              if (isThisCardExpanded) {
                handleCardCollapse()
              } else {
                handleCardExpand(item._id)
              }
            } else if (type === 'singleStory') {
              if (isThisSingleStoryExpanded) {
                handleSingleStoryCollapse()
              } else {
                handleSingleStoryExpand(item._id)
              }
            } else if (type === 'video') {
              if (isThisVideoExpanded) {
                handleVideoCollapse()
              } else {
                handleVideoExpand(item._id)
              }
            } else {
              onClick()
            }
          }}
        >
          {/* Cover Image with Overlay Titles */}
          <div className="relative w-full h-full overflow-hidden">
            {item.coverImage ? (
              <img
                src={resolveMediaUrl(item.coverImage)}
                alt={item.title || item.mlTitle || 'Cover'}
                className="w-full h-full object-cover transition duration-300"
                loading="lazy"
                onError={(e) => {
                  e.target.style.display = 'none'
                  e.target.nextSibling && (e.target.nextSibling.style.display = 'flex')
                }}
              />
            ) : (
              <div className="w-full h-full bg-gray-800 flex items-center justify-center p-4">
                <img 
                  src={logo} 
                  alt="Zai Toon Logo" 
                  className="max-w-[80%] max-h-[80%] object-contain opacity-70"
                />
              </div>
            )}
            
            {/* Title Overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 z-10">
              <h3 className="text-white text-base font-semibold truncate mb-1">
                {item.title || item.mlTitle || 'Untitled'}
              </h3>
              {item.mlTitle && item.title !== item.mlTitle && (
                <p className="text-gray-300 text-sm truncate">
                  {item.mlTitle}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Full Screen Modal for Story Details */}
        {type === 'story' && isThisCardExpanded && (
          <div 
            className="fixed inset-0 bg-black/20 backdrop-blur-md z-[9999] flex items-center justify-center p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                handleCardCollapse()
              }
            }}
            onWheel={(e) => {
              e.stopPropagation()
            }}
          >
            <div 
              ref={modalRef}
              className="bg-gray-900/80 backdrop-blur-lg rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-600/50 scrollbar-hide scroll-smooth"
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
              }}
              onWheel={(e) => {
                e.stopPropagation()
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
                      <XMarkIcon className="w-5 h-5" />
                    </button>
                  </div>
                  
                  {/* Cover Image */}
                  {currentStory.coverImage && (
                    <div className="mb-6 flex justify-center">
                      <img
                        src={resolveMediaUrl(currentStory.coverImage)}
                        alt={currentStory.title}
                        className="max-w-full max-h-64 object-contain rounded-xl shadow-lg"
                        loading="lazy"
                        onError={(e) => { e.target.style.display = 'none' }}
                      />
                    </div>
                  )}

                  {/* Description */}
                  {currentStory.description && (
                    <div className="mb-3">
                      <h2 className="text-white text-lg font-semibold mb-3" style={{ fontFamily: 'Archivo Black' }}>Description</h2>
                      <p className="text-gray-300 text-sm leading-relaxed">
                        {currentStory.description}
                      </p>
                    </div>
                  )}

                  {/* Malayalam Description */}
                  {currentStory.mlDescription && (
                    <div className="mb-3">
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

                  {/* Seasons & Episodes */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-white text-lg font-semibold" style={{ fontFamily: 'Archivo Black' }}>
                        Seasons & Episodes
                      </h3>
                      
                      {/* Season Selection Dropdown - Compact */}
                      {currentStory.seasons && currentStory.seasons.length > 0 && (
                        <div className="w-64">
                          <CustomDropdown
                            options={currentStory.seasons.map((season) => ({
                              value: season._id,
                              label: `Season ${season.seasonNumber} (${season.episodes?.length || 0} episodes)`
                            }))}
                            value={selectedSeasonId || ''}
                            onChange={handleSeasonSelect}
                            placeholder="Select season..."
                            className="w-full"
                          />
                        </div>
                      )}
                    </div>
                    
                    {currentStory.seasons && currentStory.seasons.length > 0 ? (
                      <div className="space-y-4">

                        {/* Episodes List for Selected Season */}
                        {selectedSeasonId && (() => {
                          const selectedSeason = currentStory.seasons.find(s => s._id === selectedSeasonId);
                          return selectedSeason ? (
                            <div className="bg-gray-800/50 rounded-lg border border-gray-700/50 p-4">
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center space-x-3">
                                  {selectedSeason.seasonBanner && (
                                    <img
                                      src={resolveMediaUrl(selectedSeason.seasonBanner)}
                                      alt={`Season ${selectedSeason.seasonNumber}`}
                                      className="w-12 h-12 object-cover rounded-lg"
                                      loading="lazy"
                                      onError={(e) => { e.target.style.display = 'none' }}
                                    />
                                  )}
                                  <div>
                                    <h4 className="text-white font-medium">Season {selectedSeason.seasonNumber}</h4>
                                    <p className="text-gray-400 text-sm">
                                      {selectedSeason.episodes?.length || 0} episodes
                                    </p>
                                  </div>
                                </div>
                              </div>

                              {/* Episodes List (sorted ascending by episode number in title) */}
                              {selectedSeason.episodes && selectedSeason.episodes.length > 0 ? (
                                <div className="space-y-2">
                                  {sortEpisodesAsc(selectedSeason.episodes).map((episode) => (
                                    <div key={episode._id} className="bg-gray-700/20 backdrop-blur-sm rounded-lg p-3 cursor-pointer hover:bg-gray-700/30 transition duration-200"
                                         onClick={() => handleEpisodeSelect(episode)}>
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-3">
                                          {episode.coverImage && (
                                            <img
                                              src={resolveMediaUrl(episode.coverImage)}
                                              alt={episode.title}
                                              className="w-10 h-10 object-cover rounded-lg"
                                              loading="lazy"
                                              onError={(e) => { e.target.style.display = 'none' }}
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
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-center py-6">
                                  <p className="text-gray-400 text-sm">No episodes in this season</p>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-center py-8">
                              <p className="text-gray-400 text-sm">Season not found</p>
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-gray-400 text-sm">No seasons found</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Footer with Date */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-700/50">
                    <div className="flex items-center space-x-1 text-sm text-gray-400">
                      <CalendarIcon className="w-4 h-4" />
                      <span>
                        {new Date(currentStory.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Full Screen Modal for Single Story Details */}
        {type === 'singleStory' && isThisSingleStoryExpanded && (
          <div 
            className="fixed inset-0 bg-black/20 backdrop-blur-md z-[9999] flex items-center justify-center p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                handleSingleStoryCollapse()
              }
            }}
            onWheel={(e) => {
              e.stopPropagation()
            }}
          >
            <div 
              ref={modalRef}
              className="bg-gray-900/80 backdrop-blur-lg rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-600/50 scrollbar-hide scroll-smooth"
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
              }}
              onWheel={(e) => {
                e.stopPropagation()
              }}
            >
              {!currentSingleStory.description ? (
                <div className="flex items-center justify-center py-20">
                  <div className="text-white text-lg">Loading details...</div>
                </div>
              ) : (
                <div className="p-6">
                  {/* Header with Close Button */}
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex-1">
                      <h1 className="text-white text-2xl font-bold mb-2" style={{ fontFamily: 'Archivo Black' }}>
                        {currentSingleStory.title}
                      </h1>
                      {currentSingleStory.mlTitle && (
                        <p className="text-gray-300 text-base mb-3">
                          {currentSingleStory.mlTitle}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSingleStoryCollapse()
                      }}
                      className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition duration-200"
                    >
                      <XMarkIcon className="w-5 h-5" />
                    </button>
                  </div>
                  
                  {/* Cover Image */}
                  {currentSingleStory.coverImage && (
                    <div className="mb-6 flex justify-center">
                      <img
                        src={resolveMediaUrl(currentSingleStory.coverImage)}
                        alt={currentSingleStory.title}
                        className="max-w-full max-h-64 object-contain rounded-xl shadow-lg"
                        loading="lazy"
                        onError={(e) => { e.target.style.display = 'none' }}
                      />
                    </div>
                  )}

                  {/* Description */}
                  {currentSingleStory.description && (
                    <div className="mb-3">
                      <h2 className="text-white text-lg font-semibold mb-3" style={{ fontFamily: 'Archivo Black' }}>Description</h2>
                      <p className="text-gray-300 text-sm leading-relaxed">
                        {currentSingleStory.description}
                      </p>
                    </div>
                  )}

                  {/* Tag and Read Time */}
                  <div className="flex flex-col space-y-2 mb-6">
                    {currentSingleStory.tag && (
                      <span className="inline-block bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-medium w-fit">
                        {currentSingleStory.tag}
                      </span>
                    )}
                    {currentSingleStory.readTime && (
                      <div className="flex items-center space-x-1 text-sm text-gray-400">
                        <span>Reading time:</span>
                        <span>{currentSingleStory.readTime} min</span>
                      </div>
                    )}
                  </div>

                  {/* File Links */}
                  <div className="mb-3">
                    <h3 className="text-white text-sm font-medium mb-4 text-gray-300">Story Files</h3>
                    <div className="flex flex-wrap items-center gap-3">
                      {currentSingleStory.enStoryFile ? (
                        <>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation()
                              e.preventDefault()
                              window.open(currentSingleStory.enStoryFile, '_blank', 'noopener,noreferrer')
                            }}
                            className="flex items-center justify-center px-4 py-3 bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 hover:text-white rounded-lg transition duration-200 border border-gray-600/50 hover:border-gray-500/50"
                          >
                            <span className="text-base font-medium">English</span>
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation()
                              e.preventDefault()
                              handleDownloadSingleStoryPdf(currentSingleStory._id, 'en')
                            }}
                            className="flex items-center justify-center px-4 py-3 bg-purple-600/80 hover:bg-purple-600 text-white rounded-lg transition duration-200 border border-purple-500/50"
                          >
                            <span className="text-base font-medium">Download PDF (EN)</span>
                          </button>
                        </>
                      ) : (
                        <div className="flex items-center justify-center px-4 py-3 text-gray-500">
                          <span className="text-base">No English File</span>
                        </div>
                      )}
                      {currentSingleStory.mlStoryFile ? (
                        <>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation()
                              e.preventDefault()
                              window.open(currentSingleStory.mlStoryFile, '_blank', 'noopener,noreferrer')
                            }}
                            className="flex items-center justify-center px-4 py-3 bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 hover:text-white rounded-lg transition duration-200 border border-gray-600/50 hover:border-gray-500/50"
                          >
                            <span className="text-base font-medium">Malayalam</span>
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation()
                              e.preventDefault()
                              handleDownloadSingleStoryPdf(currentSingleStory._id, 'ml')
                            }}
                            className="flex items-center justify-center px-4 py-3 bg-purple-600/80 hover:bg-purple-600 text-white rounded-lg transition duration-200 border border-purple-500/50"
                          >
                            <span className="text-base font-medium">Download PDF (ML)</span>
                          </button>
                        </>
                      ) : (
                        <div className="flex items-center justify-center px-4 py-3 text-gray-500">
                          <span className="text-base">No Malayalam File</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Footer with Date */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-700/50">
                    <div className="flex items-center space-x-1 text-sm text-gray-400">
                      <CalendarIcon className="w-4 h-4" />
                      <span>
                        {new Date(currentSingleStory.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Full Screen Modal for Video Details */}
        {type === 'video' && isThisVideoExpanded && (
          <div 
            className="fixed inset-0 bg-black/20 backdrop-blur-md z-[9999] flex items-center justify-center p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                handleVideoCollapse()
              }
            }}
            onWheel={(e) => {
              e.stopPropagation()
            }}
          >
            <div 
              ref={modalRef}
              className="bg-gray-900/80 backdrop-blur-lg rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-600/50 scrollbar-hide scroll-smooth"
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
              }}
              onWheel={(e) => {
                e.stopPropagation()
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
                        handleVideoCollapse()
                      }}
                      className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition duration-200"
                    >
                      <XMarkIcon className="w-5 h-5" />
                    </button>
                  </div>
                  
                  {/* Video Player */}
                  {currentVideo.video && (
                    <div className="mb-6 flex justify-center">
                      <video
                        src={resolveMediaUrl(currentVideo.video)}
                        controls
                        className="max-w-full max-h-96 rounded-xl shadow-lg"
                      >
                        Your browser does not support the video tag.
                      </video>
                    </div>
                  )}

                  {/* Video Details */}
                  <div className="mb-3">
                    <h3 className="text-white text-sm font-medium mb-4 text-gray-300">Video Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {currentVideo.category && (
                        <div className="bg-gray-800/50 rounded-lg p-3">
                          <span className="text-gray-400 text-xs mb-2 block">Category</span>
                          <div className="flex items-center space-x-3">
                            {currentVideo.category.image && (
                              <img
                                src={resolveMediaUrl(currentVideo.category.image)}
                                alt={currentVideo.category.title}
                                className="w-8 h-8 object-cover rounded-lg"
                                loading="lazy"
                                onError={(e) => { e.target.style.display = 'none' }}
                              />
                            )}
                            <span className="text-white text-sm">{currentVideo.category.title}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Footer with Date */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-700/50">
                    <div className="flex items-center space-x-1 text-sm text-gray-400">
                      <CalendarIcon className="w-4 h-4" />
                      <span>
                        {new Date(currentVideo.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <Sidebar />
        <div className="flex-1 ml-64">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
              <p className="text-gray-400 mt-4">Loading content...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <Sidebar />
        <div className="flex-1 ml-64">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center">
              <p className="text-red-400">{error}</p>
              <button 
                onClick={fetchAllData}
                className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 ml-64 h-screen overflow-y-auto scrollbar-hide">
        <div className="max-w-7xl mx-auto px-2 py-6">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 
                  className="text-4xl font-bold text-white mb-2"
                  style={{ fontFamily: 'Archivo Black' }}
                >
                  Admin Dashboard
                </h1>
              </div>
            </div>
          </div>

          {/* Stories Section */}
          <div className="mb-6">
            <div className="mb-3">
              <h2 
                onClick={() => navigate('/stories')}
                className="text-2xl font-semibold text-white cursor-pointer hover:text-violet-400 transition duration-200 group flex items-center"
              >
                Stories
                <span className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">→</span>
              </h2>
            </div>
            <div 
              ref={storiesScrollRef}
              className="overflow-x-auto scrollbar-hide"
              onMouseEnter={() => handleMouseEnter(storiesScrollRef, 'stories')}
              onMouseLeave={() => handleMouseLeave(storiesScrollRef, 'stories')}
            >
              <div className="flex gap-4 pb-4" style={{ width: 'max-content' }}>
                {stories.slice(0, 8).map((story) => (
                  <ContentCard
                    key={story._id}
                    item={story}
                    type="story"
                    onClick={() => navigate('/stories')}
                  />
                ))}
                <ViewAllCard
                  type="story"
                  onClick={() => navigate('/stories')}
                />
                {stories.length === 0 && (
                  <div className="flex items-center justify-center py-12 text-gray-400">
                    <p>No stories found</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Single Stories Section */}
          <div className="mb-6">
            <div className="mb-3">
              <h2 
            onClick={() => navigate('/single-stories')}
                className="text-2xl font-semibold text-white cursor-pointer hover:text-violet-400 transition duration-200 group flex items-center"
              >
                Single Stories
                <span className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">→</span>
              </h2>
            </div>
            <div 
              ref={singleStoriesScrollRef}
              className="overflow-x-auto scrollbar-hide"
              onMouseEnter={() => handleMouseEnter(singleStoriesScrollRef, 'singleStories')}
              onMouseLeave={() => handleMouseLeave(singleStoriesScrollRef, 'singleStories')}
            >
              <div className="flex gap-4 pb-4" style={{ width: 'max-content' }}>
                {singleStories.slice(0, 8).map((singleStory) => (
                  <ContentCard
                    key={singleStory._id}
                    item={singleStory}
                    type="singleStory"
                    onClick={() => {}} // No navigation needed, handled by expansion
                  />
                ))}
                <ViewAllCard
                  type="singleStory"
                  onClick={() => navigate('/single-stories')}
                />
                {singleStories.length === 0 && (
                  <div className="flex items-center justify-center py-12 text-gray-400">
                    <p>No single stories found</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Videos Section */}
          <div className="mb-6">
            <div className="mb-3">
              <h2 
                onClick={() => navigate('/videos')}
                className="text-2xl font-semibold text-white cursor-pointer hover:text-violet-400 transition duration-200 group flex items-center"
              >
                Videos
                <span className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">→</span>
              </h2>
            </div>
            <div 
              ref={videosScrollRef}
              className="overflow-x-auto scrollbar-hide"
              onMouseEnter={() => handleMouseEnter(videosScrollRef, 'videos')}
              onMouseLeave={() => handleMouseLeave(videosScrollRef, 'videos')}
            >
              <div className="flex gap-4 pb-4" style={{ width: 'max-content' }}>
                {videos.slice(0, 8).map((video) => (
                  <ContentCard
                    key={video._id}
                    item={video}
                    type="video"
                    onClick={() => {}} // No navigation needed, handled by expansion
                  />
                ))}
                <ViewAllCard
                  type="video"
                  onClick={() => navigate('/videos')}
                />
                {videos.length === 0 && (
                  <div className="flex items-center justify-center py-12 text-gray-400">
                    <p>No videos found</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Episode Details Modal */}
      {showEpisodeDetails && selectedEpisode && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-md z-[10000] flex items-center justify-center p-4"
          onWheel={(e) => {
            e.stopPropagation()
          }}
        >
          <div 
            className="bg-gray-900/80 backdrop-blur-lg rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-600/50 scrollbar-hide scroll-smooth"
            onWheel={(e) => {
              e.stopPropagation()
            }}
          >
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
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              {/* Cover Image */}
              {selectedEpisode.coverImage && (
                <div className="mb-6 flex justify-center">
                  <img
                    src={resolveMediaUrl(selectedEpisode.coverImage)}
                    alt={selectedEpisode.title}
                    className="max-w-full max-h-64 object-contain rounded-xl shadow-lg"
                    loading="lazy"
                    onError={(e) => { e.target.style.display = 'none' }}
                  />
                </div>
              )}

              {/* Episode Details */}
              <div className="mb-3">
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
              <div className="mb-3">
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
                          onClick={() => expandedCard && selectedSeasonId && handleDownloadEpisodePdf(expandedCard, selectedSeasonId, selectedEpisode._id, 'en')}
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
                          onClick={() => expandedCard && selectedSeasonId && handleDownloadEpisodePdf(expandedCard, selectedSeasonId, selectedEpisode._id, 'ml')}
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
                          onClick={() => expandedCard && selectedSeasonId && handleDownloadEpisodePdf(expandedCard, selectedSeasonId, selectedEpisode._id, 'ur')}
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
                          onClick={() => expandedCard && selectedSeasonId && handleDownloadEpisodePdf(expandedCard, selectedSeasonId, selectedEpisode._id, 'hin')}
                          className="text-sm px-3 py-1.5 bg-purple-600/80 hover:bg-purple-600 text-white rounded-lg"
                        >
                          Download PDF
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Banners Section */}
              <div className="mb-3">
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
                          loading="lazy"
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
                          loading="lazy"
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
                          loading="lazy"
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
                          loading="lazy"
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
        </div>
        </div>
      </div>
      )}

      {/* Gradient Background - Bottom Right Corner */}
      <div className="fixed -bottom-80 right-0 z-10 pointer-events-none">
        <img 
          src={gradient} 
          alt="Gradient" 
          className="w-[800px] h-[800px] opacity-60"
          loading="lazy"
        />
      </div>
    </div>
  )
}

export default Dashboard
