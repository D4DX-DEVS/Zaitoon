import React, { useState, useEffect } from 'react'
import { ChevronDownIcon, MegaphoneIcon } from '@heroicons/react/24/outline'

function NoticeBar() {
  const [notices, setNotices] = useState([])
  const [expanded, setExpanded] = useState(true)

  useEffect(() => {
    const fetchAdminNotices = async () => {
      try {
        const token = localStorage.getItem('adminToken')
        const apiBase = import.meta.env.VITE_API_BASE_URL
        const res = await fetch(`${apiBase}/admin/notices`, {
          headers: { Authorization: token ? `Bearer ${token}` : '' }
        })
        const data = await res.json()
        if (data.success) {
          setNotices(data.data.filter(n => n.type === 'admin' && n.active))
        }
      } catch {
        // silently ignore — sidebar should not break if notices fail
      }
    }

    fetchAdminNotices()
  }, [])

  if (notices.length === 0) return null

  return (
    <div className="flex-shrink-0 mb-3">
      {/* Header row */}
      <button
        onClick={() => setExpanded(prev => !prev)}
        className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/15 transition-colors"
      >
        <div className="flex items-center space-x-1.5">
          <MegaphoneIcon className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          <span className="text-amber-300 text-xs font-semibold tracking-wide">
            NOTICES
          </span>
          <span className="bg-amber-500/30 text-amber-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            {notices.length}
          </span>
        </div>
        <ChevronDownIcon
          className={`w-3.5 h-3.5 text-amber-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Notices list */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-in-out"
        style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="space-y-1.5 mt-1.5">
            {notices.map(notice => (
              <div
                key={notice._id}
                className="bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2"
              >
                <p className="text-amber-200 text-xs font-semibold leading-snug mb-0.5">
                  {notice.title}
                </p>
                <p className="text-amber-100/70 text-[11px] leading-relaxed whitespace-pre-line">
                  {notice.message}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default NoticeBar
