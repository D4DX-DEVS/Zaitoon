import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { 
  HomeIcon, 
  BookOpenIcon, 
  DocumentTextIcon, 
  VideoCameraIcon, 
  UserGroupIcon,
  PuzzlePieceIcon,
  PhotoIcon,
  ArrowRightOnRectangleIcon,
  AcademicCapIcon,
  QuestionMarkCircleIcon,
  TrophyIcon,
  Cog6ToothIcon,
  ListBulletIcon,
  BellAlertIcon,
  CreditCardIcon,
  ChartBarIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
  CommandLineIcon,
  Square3Stack3DIcon,
  SparklesIcon,
  MegaphoneIcon,
  ClockIcon,
  PaintBrushIcon
} from '@heroicons/react/24/outline'
import logo from '../assets/logo.png'
import dxLogo from '../assets/dxLogoWhite.png'

// Menu configuration with groups
const menuGroups = [
  {
    items: [
      { label: 'Dashboard', path: '/dashboard', icon: HomeIcon }
    ]
  },
  {
    label: 'Content',
    icon: Square3Stack3DIcon,
    items: [
      { label: 'Stories', path: '/stories', icon: BookOpenIcon },
      { label: 'Single Stories', path: '/single-stories', icon: DocumentTextIcon },
      { label: 'Videos', path: '/videos', icon: VideoCameraIcon },
      { label: 'Bright Box', path: '/bright-box', icon: SparklesIcon },
    ]
  },
  {
    label: 'Engagement',
    icon: UserGroupIcon,
    items: [
      { label: 'Kids Submissions', path: '/kids-submissions', icon: UserGroupIcon },
      { label: 'Notices', path: '/notices', icon: MegaphoneIcon },
      { label: 'Puzzles', path: '/puzzles', icon: PuzzlePieceIcon },
      { label: 'Story Puzzle', path: '/story-puzzle', icon: BookOpenIcon },
      { label: 'Coloring', path: '/coloring', icon: PaintBrushIcon },
      { label: 'Gallery', path: '/gallery', icon: PhotoIcon },
    ]
  },
  {
    label: 'Quizzes',
    icon: AcademicCapIcon,
    items: [
      { label: 'Quizzes', path: '/quizzes', icon: AcademicCapIcon },
      { label: 'Question Bank', path: '/questions', icon: QuestionMarkCircleIcon },
      { label: 'Quiz Management', path: '/quiz-management', icon: Cog6ToothIcon },
      { label: 'Quiz Attempts', path: '/quiz-attempts', icon: ListBulletIcon },
      { label: 'Leaderboard', path: '/leaderboard', icon: TrophyIcon },
    ]
  },
  {
    label: 'Marketing',
    icon: MegaphoneIcon,
    items: [
      { label: 'Home Banner', path: '/home-banner', icon: SparklesIcon },
      { label: 'Banners', path: '/banners', icon: PhotoIcon },
      { label: 'Payment Banner', path: '/payment-banner', icon: CreditCardIcon },
      { label: 'Subscriptions', path: '/subscriptions', icon: CreditCardIcon },
      { label: 'Notifications', path: '/notifications', icon: BellAlertIcon },
    ]
  },
  {
    label: 'Analytics',
    icon: ChartBarIcon,
    items: [
     
      { label: 'Scheduled Uploads', path: '/scheduled', icon: ClockIcon },
      { label: 'Analytics', path: '/analytics', icon: ChartBarIcon },
      { label: 'Growth & Activity', path: '/activity', icon: ChartBarIcon },
    ]
  },
  {
    label: 'System',
    icon: Cog6ToothIcon,
    items: [
      { label: 'Settings', path: '/settings', icon: Cog6ToothIcon },
    ]
  }
]

// Flatten all items for command palette
const allMenuItems = menuGroups.flatMap(group => 
  group.items.map(item => ({
    ...item,
    group: group.label || 'General'
  }))
)

function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Initialize with the active group already expanded (avoids jump on remount)
  const [expandedGroups, setExpandedGroups] = useState(() => {
    const initial = {}
    const path = window.location.pathname
    menuGroups.forEach(group => {
      if (group.label && group.items.some(item => path === item.path)) {
        initial[group.label] = true
      }
    })
    return initial
  })

  // Keep active group expanded when navigating within sidebar
  useEffect(() => {
    setExpandedGroups(prev => {
      const updates = {}
      menuGroups.forEach(group => {
        if (group.label && group.items.some(item => location.pathname === item.path) && !prev[group.label]) {
          updates[group.label] = true
        }
      })
      return Object.keys(updates).length > 0 ? { ...prev, ...updates } : prev
    })
  }, [location.pathname])

  // Command+K listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowCommandPalette(prev => !prev)
        setSearchQuery('')
      }
      if (e.key === 'Escape') {
        setShowCommandPalette(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('adminToken')
    localStorage.removeItem('adminUser')
    window.dispatchEvent(new Event('authStateChange'))
    navigate('/login')
  }

  const isActive = (path) => location.pathname === path

  const isGroupActive = (group) => {
    return group.items.some(item => location.pathname === item.path)
  }

  const toggleGroup = (label) => {
    setExpandedGroups(prev => ({ ...prev, [label]: !prev[label] }))
  }

  const getButtonClasses = (path) => {
    const baseClasses = "w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-all duration-200 group"
    const activeClasses = "text-white bg-gradient-to-r from-purple-600/20 to-purple-700/20 border border-purple-500/30"
    const inactiveClasses = "text-violet-200 hover:text-white hover:bg-violet-800/60"
    return `${baseClasses} ${isActive(path) ? activeClasses : inactiveClasses}`
  }

  // Filtered items for command palette
  const filteredItems = searchQuery.trim()
    ? allMenuItems.filter(item => 
        item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.group.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allMenuItems

  const handleCommandSelect = useCallback((path) => {
    navigate(path)
    setShowCommandPalette(false)
    setSearchQuery('')
  }, [navigate])

  return (
    <>
      <div className="bg-violet-900/95 backdrop-blur-sm border-r border-violet-800/60 h-screen w-56 fixed left-0 top-0 z-40 shadow-xl flex flex-col">
        <div className="p-4 flex flex-col h-full min-h-0">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center mb-5 px-2">
            <img src={logo} alt="Zai Toon Logo" className="h-10 w-auto mr-3" />
            <h1 style={{ fontFamily: 'Archivo Black', fontSize: '20px', color: '#FFFFFF' }}>
              ZaiToon
            </h1>
          </div>

          {/* Search / Command K trigger */}
          <button
            onClick={() => { setShowCommandPalette(true); setSearchQuery('') }}
            className="flex-shrink-0 flex items-center space-x-2 w-full px-3 py-2 mb-4 rounded-lg bg-violet-800/40 border border-violet-700/50 text-violet-300 hover:text-white hover:bg-violet-800/60 transition-all duration-200 text-xs"
          >
            <MagnifyingGlassIcon className="w-4 h-4" />
            <span className="flex-1 text-left">Search...</span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-violet-700/50 rounded text-[10px] text-violet-300 border border-violet-600/50">
              ⌘K
            </kbd>
          </button>

          {/* Navigation */}
          <nav className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-0.5 scroll-smooth scrollbar-hide">
            {menuGroups.map((group, groupIdx) => {
              // Standalone items (no group label)
              if (!group.label) {
                return group.items.map(item => (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={getButtonClasses(item.path)}
                  >
                    <item.icon className={`w-5 h-5 ${isActive(item.path) ? 'text-purple-400' : 'group-hover:text-purple-400'}`} />
                    <span className="text-sm font-medium">{item.label}</span>
                  </button>
                ))
              }

              // Grouped items with collapsible sub-menu
              const isExpanded = expandedGroups[group.label]
              const groupActive = isGroupActive(group)

              return (
                <div key={group.label} className="mb-0.5">
                  {/* Group header */}
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-200 ${
                      groupActive
                        ? 'text-white bg-violet-800/40'
                        : 'text-violet-300 hover:text-white hover:bg-violet-800/40'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <group.icon className={`w-5 h-5 ${groupActive ? 'text-purple-400' : ''}`} />
                      <span className="text-sm font-semibold">{group.label}</span>
                    </div>
                    <ChevronDownIcon 
                      className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
                    />
                  </button>

                  {/* Sub-items — CSS Grid rows for smooth animation */}
                  <div 
                    className="grid transition-[grid-template-rows] duration-200 ease-in-out"
                    style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
                  >
                    <div className="overflow-hidden">
                    <div className="ml-3 pl-3 border-l border-violet-700/40 mt-0.5 space-y-0.5">
                      {group.items.map(item => (
                        <button
                          key={item.path}
                          onClick={() => navigate(item.path)}
                          className={getButtonClasses(item.path)}
                        >
                          <item.icon className={`w-4 h-4 ${isActive(item.path) ? 'text-purple-400' : 'group-hover:text-purple-400'}`} />
                          <span className="text-xs font-medium">{item.label}</span>
                        </button>
                      ))}
                    </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </nav>

          {/* Logout */}
          <div className="flex-shrink-0 mt-auto pt-4 border-t border-violet-800/50">
            <button
              onClick={handleLogout}
              className="w-full flex items-center space-x-3 px-3 py-2.5 text-violet-300 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all duration-200 group mb-4"
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5 group-hover:text-red-400" />
              <span className="text-sm font-medium">Logout</span>
            </button>
            
            <div className="flex items-center justify-center space-x-2 px-3">
              <img src={dxLogo} alt="D4DX Logo" className="h-6 w-auto opacity-80" />
              <p className="text-xs text-violet-300/70 font-medium tracking-wide">
                POWERED BY D4DX
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Command Palette (⌘K) */}
      {showCommandPalette && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[99999] flex items-start justify-center pt-[15vh]"
          onClick={() => setShowCommandPalette(false)}
        >
          <div 
            className="bg-gray-900/95 backdrop-blur-lg border border-gray-700/60 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search input */}
            <div className="flex items-center px-4 border-b border-gray-700/50">
              <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search pages..."
                autoFocus
                className="flex-1 bg-transparent border-none outline-none text-white text-sm py-4 px-3 placeholder-gray-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && filteredItems.length > 0) {
                    handleCommandSelect(filteredItems[0].path)
                  }
                }}
              />
              <kbd className="px-2 py-1 bg-gray-800 rounded text-[10px] text-gray-400 border border-gray-700">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div className="max-h-80 overflow-y-auto scrollbar-hide py-2">
              {filteredItems.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  No results found
                </div>
              ) : (
                <>
                  {Object.entries(
                    filteredItems.reduce((acc, item) => {
                      if (!acc[item.group]) acc[item.group] = []
                      acc[item.group].push(item)
                      return acc
                    }, {})
                  ).map(([groupName, items]) => (
                    <div key={groupName}>
                      <div className="px-4 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                        {groupName}
                      </div>
                      {items.map(item => (
                        <button
                          key={item.path}
                          onClick={() => handleCommandSelect(item.path)}
                          className={`w-full flex items-center space-x-3 px-4 py-2.5 text-sm transition-all duration-150 ${
                            isActive(item.path)
                              ? 'text-purple-400 bg-purple-500/10'
                              : 'text-gray-300 hover:text-white hover:bg-gray-800/60'
                          }`}
                        >
                          <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive(item.path) ? 'text-purple-400' : 'text-gray-500'}`} />
                          <span className="flex-1 text-left">{item.label}</span>
                          {isActive(item.path) && (
                            <span className="text-[10px] text-purple-400 bg-purple-500/20 px-2 py-0.5 rounded-full">
                              Active
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Footer hints */}
            <div className="border-t border-gray-700/50 px-4 py-2.5 flex items-center justify-between text-[10px] text-gray-500">
              <div className="flex items-center space-x-3">
                <span className="flex items-center space-x-1">
                  <kbd className="px-1.5 py-0.5 bg-gray-800 rounded border border-gray-700">↵</kbd>
                  <span>Select</span>
                </span>
                <span className="flex items-center space-x-1">
                  <kbd className="px-1.5 py-0.5 bg-gray-800 rounded border border-gray-700">ESC</kbd>
                  <span>Close</span>
                </span>
              </div>
              <span className="flex items-center space-x-1">
                <CommandLineIcon className="w-3 h-3" />
                <span>Quick Actions</span>
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default Sidebar