import React, { useState, useEffect, useCallback } from 'react'
import Sidebar from '../components/Sidebar'
import { FiStar } from 'react-icons/fi'
import { HiOutlineSparkles } from 'react-icons/hi'

const API_BASE = import.meta.env.VITE_API_BASE_URL

const TYPE_LABELS = {
  story: { label: 'Story', color: 'bg-purple-600' },
  single_story: { label: 'Single Story', color: 'bg-blue-600' },
  video: { label: 'Video', color: 'bg-red-600' },
  brightbox: { label: 'Bright Box', color: 'bg-amber-500' }
}

export default function HomeBanner() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`${API_BASE}/highlights`)
      const data = await r.json()
      if (data.success) setItems(data.data?.highlights || [])
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  return (
    <div className="min-h-screen bg-black flex">
      <Sidebar />
      <div className="flex-1 ml-56">
        {/* Header */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1
                className="text-white text-5xl font-bold mb-1 relative"
                style={{ fontFamily: 'Archivo Black' }}
              >
                Home Banner
                <div
                  className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 h-0.5 w-44"
                  style={{ background: 'linear-gradient(90.05deg, #AC28DC 6.68%, #7E1EB7 49.26%, #501392 91.85%)' }}
                />
              </h1>
              <p className="text-violet-300 text-sm mt-3" style={{ fontFamily: 'Fredoka One' }}>
                Auto-updated — latest 5 highlighted items shown as banners in the app
              </p>
            </div>
            <button
              onClick={fetchAll}
              className="text-white px-4 h-9 rounded-full transition duration-200"
              style={{
                background: 'linear-gradient(90.05deg, #AC28DC 6.68%, #7E1EB7 49.26%, #501392 91.85%)',
                fontFamily: 'Fredoka One',
                fontSize: '14px'
              }}
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-20">
              <HiOutlineSparkles className="w-12 h-12 text-violet-400 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">No highlighted content found</p>
              <p className="text-gray-600 text-sm mt-1">
                Highlight items in Stories, Single Stories, Videos, or Bright Box to show them here
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item, index) => {
                const typeInfo = TYPE_LABELS[item.type] || { label: item.type, color: 'bg-gray-600' }

                return (
                  <div
                    key={item._id}
                    className="flex items-center gap-4 bg-gray-900 rounded-xl p-3 border border-gray-800"
                  >
                    {/* Position badge */}
                    <div
                      className="w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ background: 'linear-gradient(135deg, #AC28DC, #501392)' }}
                    >
                      {index + 1}
                    </div>

                    {/* Thumbnail */}
                    <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-gray-800">
                      {item.image ? (
                        <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <FiStar className="w-6 h-6 text-gray-600" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-xs text-white px-2 py-0.5 rounded-full ${typeInfo.color}`}
                          style={{ fontFamily: 'Fredoka One' }}
                        >
                          {typeInfo.label}
                        </span>
                        {item.type === 'story' && item.storyTitle && (
                          <span className="text-xs text-gray-500 truncate">
                            {item.storyTitle} · S{item.seasonNumber}
                          </span>
                        )}
                        {item.type === 'brightbox' && item.category?.title && (
                          <span className="text-xs text-gray-500 truncate">{item.category.title}</span>
                        )}
                      </div>
                      <p className="text-white text-sm font-semibold truncate" style={{ fontFamily: 'Archivo Black' }}>
                        {item.title || item.mlTitle || 'Untitled'}
                      </p>
                      <span className="text-xs text-gray-500 mt-0.5 inline-block">
                        {new Date(item.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </span>
                    </div>

                    {/* Live badge */}
                    <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-xs text-emerald-400" style={{ fontFamily: 'Fredoka One' }}>Live</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
