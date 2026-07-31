import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import axios from 'axios'
import { 
  FiAward,
  FiCalendar,
  FiRefreshCw,
  FiSearch,
  FiChevronLeft,
  FiChevronRight,
  FiX,
  FiEye,
  FiClock
} from 'react-icons/fi'

const today = () => new Date().toISOString().split('T')[0]
const LIMIT = 10

function Leaderboard() {
  const navigate = useNavigate()
  const API_BASE = import.meta.env.VITE_API_BASE_URL
  const [leaderboard, setLeaderboard] = useState([])
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 })
  const [loading, setLoading] = useState(false)
  const [fromDate, setFromDate] = useState(today())
  const [toDate, setToDate] = useState(today())
  const [viewMode, setViewMode] = useState('daily')
  const [totalAllTime, setTotalAllTime] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const searchTimerRef = useRef(null)

  // Quiz config filter
  const [configs, setConfigs] = useState([])
  const [selectedConfigId, setSelectedConfigId] = useState('')

  // User detail modal
  const [selectedUser, setSelectedUser] = useState(null)
  const [userAttempts, setUserAttempts] = useState([])
  const [userAttemptsLoading, setUserAttemptsLoading] = useState(false)

  // ─── Global Leaderboard state ────────────────────────────────────────────
  const [globalLeaderboard, setGlobalLeaderboard] = useState([])
  const [globalPeriod, setGlobalPeriod] = useState('alltime')
  const [globalLoading, setGlobalLoading] = useState(false)
  const [globalPage, setGlobalPage] = useState(1)
  const [globalPagination, setGlobalPagination] = useState({ total: 0, page: 1, totalPages: 1 })

  useEffect(() => {
    fetchData()
    fetchConfigs()
  }, [])

  const fetchConfigs = async () => {
    try {
      const token = localStorage.getItem('adminToken')
      const res = await axios.get(`${API_BASE}/quizzes/config/all`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.data.success) setConfigs(res.data.data || [])
    } catch (e) {
      console.error('Failed to fetch quiz configs:', e)
    }
  }

  const fetchData = useCallback(async (
    from = fromDate, to = toDate, mode = viewMode,
    allTime = totalAllTime, p = page, s = search, configId = selectedConfigId
  ) => {
    const isByEmail = mode === 'byEmail'
    if (!isByEmail && (!from || !to)) return
    if (isByEmail && !allTime && (!from || !to || from > to)) return
    setLoading(true)
    try {
      const token = localStorage.getItem('adminToken')
      const params = new URLSearchParams()
      params.set('page', p)
      params.set('limit', LIMIT)
      if (s && s.trim()) params.set('search', s.trim())
      if (configId) params.set('configId', configId)

      let url
      if (isByEmail) {
        if (!allTime) { params.set('startDate', from); params.set('endDate', to) }
        url = `${API_BASE}/quizzes/leaderboard/by-email?${params}`
      } else {
        // Use date range when from !== to, otherwise single date
        if (from && to && from !== to) {
          params.set('startDate', from)
          params.set('endDate', to)
        } else {
          params.set('date', from || to)
        }
        url = `${API_BASE}/quizzes/leaderboard/daily?${params}`
      }

      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.data.success) {
        const data = response.data.data
        const pg = data.pagination || { total: 0, page: 1, totalPages: 1 }
        setPagination(pg)

        if (isByEmail) {
          setLeaderboard((data.leaderboard || []).map(e => ({
            ...e, score: e.totalScore, userEmail: e.email,
            userClass: e.userClass ?? 'N/A', userPhone: e.userPhone ?? '—',
            percentage: null
          })))
        } else {
          setLeaderboard(data.attendees || [])
        }
      } else {
        setLeaderboard([])
        setPagination({ total: 0, page: 1, totalPages: 1 })
      }
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error)
      setLeaderboard([])
      setPagination({ total: 0, page: 1, totalPages: 1 })
    } finally {
      setLoading(false)
    }
  }, [fromDate, toDate, viewMode, totalAllTime, page, search, API_BASE, selectedConfigId])

  // Debounced search
  const handleSearchChange = (val) => {
    setSearch(val)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      if (viewMode === 'global') {
        fetchGlobalData(globalPeriod, 1, val)
      } else {
        setPage(1)
        fetchData(fromDate, toDate, viewMode, totalAllTime, 1, val, selectedConfigId)
      }
    }, 400)
  }

  const handlePageChange = (newPage) => {
    setPage(newPage)
    fetchData(fromDate, toDate, viewMode, totalAllTime, newPage, search, selectedConfigId)
  }

  const handleApplyRange = () => {
    setPage(1)
    if (viewMode === 'byEmail' && totalAllTime) {
      fetchData(fromDate, toDate, viewMode, true, 1, search, selectedConfigId)
    } else if (fromDate && toDate && fromDate <= toDate) {
      fetchData(fromDate, toDate, viewMode, totalAllTime, 1, search, selectedConfigId)
    }
  }

  const setMode = (mode) => {
    setViewMode(mode)
    setPage(1)
    if (mode === 'global') {
      fetchGlobalData('alltime')
    } else if (mode === 'byEmail') {
      setTotalAllTime(true)
      fetchData(fromDate, toDate, 'byEmail', true, 1, search, selectedConfigId)
    } else {
      fetchData(fromDate, toDate, 'daily', false, 1, search, selectedConfigId)
    }
  }

  const fetchGlobalData = async (period = 'alltime', p = 1, s = search) => {
    setGlobalPeriod(period)
    setGlobalPage(p)
    setGlobalLoading(true)
    try {
      const params = new URLSearchParams({ period, page: p, limit: LIMIT })
      if (s && s.trim()) params.set('search', s.trim())
      const response = await axios.get(`${API_BASE}/leaderboard?${params}`)
      if (response.data.success) {
        const pg = response.data.data.pagination || { total: 0, page: p, totalPages: 1 }
        setGlobalLeaderboard(response.data.data.leaderboard || [])
        setGlobalPagination(pg)
      } else {
        setGlobalLeaderboard([])
        setGlobalPagination({ total: 0, page: 1, totalPages: 1 })
      }
    } catch (error) {
      console.error('Failed to fetch global leaderboard:', error)
      setGlobalLeaderboard([])
      setGlobalPagination({ total: 0, page: 1, totalPages: 1 })
    } finally {
      setGlobalLoading(false)
    }
  }

  const handleAllTimeChange = (e) => {
    const checked = e.target.checked
    setTotalAllTime(checked)
    setPage(1)
    if (viewMode === 'byEmail') {
      if (checked) fetchData(fromDate, toDate, viewMode, true, 1, search, selectedConfigId)
      else if (fromDate && toDate) fetchData(fromDate, toDate, viewMode, false, 1, search, selectedConfigId)
    }
  }

  const fetchTodayLeaderboard = () => {
    setFromDate(today())
    setToDate(today())
    setTotalAllTime(false)
    setPage(1)
    setSearch('')
    fetchData(today(), today(), viewMode, false, 1, '', selectedConfigId)
  }

  // Fetch user's individual attempts for the modal
  const openUserDetail = async (entry) => {
    const email = entry.userEmail || entry.email || ''
    if (!email) return
    setSelectedUser(entry)
    setUserAttempts([])
    setUserAttemptsLoading(true)
    try {
      const token = localStorage.getItem('adminToken')
      const params = new URLSearchParams()
      params.set('email', email)
      params.set('limit', '50')
      if (selectedConfigId) params.set('configId', selectedConfigId)
      const response = await axios.get(
        `${API_BASE}/quiz-attempts/admin/all?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (response.data.success) {
        setUserAttempts(response.data.data.attendees || [])
      }
    } catch (error) {
      console.error('Failed to fetch user attempts:', error)
    } finally {
      setUserAttemptsLoading(false)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return ''
    if (typeof dateString === 'string' && (dateString.includes(' to ') || dateString === 'All time')) return dateString
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    })
  }

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  }

  const formatTime = (seconds) => {
    if (!seconds) return 'N/A'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}m ${secs}s`
  }

  const getRankIcon = (rank) => {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return null
  }

  const isTotal = viewMode === 'byEmail'

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <Sidebar />
      
      <div className="flex-1 ml-56">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
            <h1 className="text-4xl font-bold text-white" style={{ fontFamily: 'Archivo Black' }}>
              Leaderboard
            </h1>
            <div className="flex flex-wrap items-center gap-3">
              {/* View mode tabs */}
              <div className="flex bg-gray-800 rounded-lg p-1 border border-gray-700">
                {[
                  { key: 'daily', label: 'Daily Quiz' },
                  { key: 'byEmail', label: 'Quiz Total' },
                  { key: 'global', label: '🌍 Global' },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setMode(tab.key)}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      viewMode === tab.key
                        ? 'bg-purple-600 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <button
                onClick={fetchTodayLeaderboard}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
              >
                <FiRefreshCw className="w-4 h-4" />
                <span>Today</span>
              </button>
            </div>
          </div>

          {/* Filters row */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            {/* Quiz selector — only when not Global mode */}
            {viewMode !== 'global' && configs.length > 0 && (
              <select
                value={selectedConfigId}
                onChange={(e) => {
                  const val = e.target.value
                  setSelectedConfigId(val)
                  setPage(1)
                  fetchData(fromDate, toDate, viewMode, totalAllTime, 1, search, val)
                }}
                className="px-3 py-2 bg-gray-800 text-white text-sm rounded-lg border border-gray-700 focus:ring-2 focus:ring-purple-500"
              >
                <option value="">All Quizzes</option>
                {configs.map(c => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            )}

            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search name, email, phone..."
                className="w-full pl-10 pr-4 py-2 bg-gray-800 text-white text-sm rounded-lg border border-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder-gray-500"
              />
              {search && (
                <button onClick={() => handleSearchChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                  <FiX className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Date inputs */}
            <div className="flex items-center space-x-2">
              <FiCalendar className="w-4 h-4 text-gray-400" />
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                className="px-3 py-2 bg-gray-800 text-white text-sm rounded-lg border border-gray-700 focus:ring-2 focus:ring-purple-500" />
              <span className="text-gray-500 text-sm">to</span>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                className="px-3 py-2 bg-gray-800 text-white text-sm rounded-lg border border-gray-700 focus:ring-2 focus:ring-purple-500" />
            </div>
            <button onClick={handleApplyRange}
              className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors">
              Apply
            </button>

            {isTotal && (
              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input type="checkbox" checked={totalAllTime} onChange={handleAllTimeChange}
                  className="rounded border-gray-600 bg-gray-800 text-purple-500 focus:ring-purple-500" />
                All time
              </label>
            )}
          </div>

          {/* Table */}
          {viewMode === 'global' ? (
            /* ── Global Leaderboard ──────────────────────────────── */
            <div>
              {/* Period filter */}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-gray-400 text-sm">Period:</span>
                {['weekly', 'monthly', 'alltime'].map(p => (
                  <button
                    key={p}
                    onClick={() => fetchGlobalData(p, 1, search)}
                    className={`px-3 py-1 rounded-md text-sm transition-colors ${
                      globalPeriod === p
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'
                    }`}
                  >
                    {p === 'weekly' ? 'This Week' : p === 'monthly' ? 'This Month' : 'All Time'}
                  </button>
                ))}
                <button
                  onClick={() => fetchGlobalData(globalPeriod, 1, search)}
                  className="ml-2 flex items-center space-x-1 px-3 py-1 bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600 text-sm"
                >
                  <FiRefreshCw className="w-3 h-3" />
                  <span>Refresh</span>
                </button>
                <span className="ml-auto text-xs text-gray-500">
                  Points: 1 pt/quiz score + 10 pts/puzzle ⭐
                </span>
              </div>
              {globalLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
                  <p className="text-gray-400 mt-4">Loading global leaderboard...</p>
                </div>
              ) : globalLeaderboard.length === 0 ? (
                <div className="text-center py-12">
                  <FiAward className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No data found for this period.</p>
                </div>
              ) : (
                  <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                  <div className="px-4 py-2 bg-gray-700/50 flex items-center justify-between text-sm text-gray-400">
                    <span>Showing {(globalPagination.page - 1) * LIMIT + 1}–{Math.min(globalPagination.page * LIMIT, globalPagination.total)} of {globalPagination.total} user(s)</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-700">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Rank</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">User</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Class</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Quiz Pts</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Puzzle Pts</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Total</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Quizzes</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Puzzles</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700">
                        {globalLeaderboard.map((entry) => (
                          <tr
                            key={entry.firebaseUid || entry.rank}
                            className={`hover:bg-gray-700/50 transition-colors ${
                              entry.rank <= 3 ? 'bg-purple-900/20' : ''
                            }`}
                          >
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="text-lg font-bold text-white">
                                {getRankIcon(entry.rank) || `#${entry.rank}`}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm font-medium text-white">{entry.name}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">
                              {entry.userClass || 'N/A'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="text-blue-400 font-semibold">{entry.quizPoints}</span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="text-orange-400 font-semibold">{entry.puzzlePoints}</span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="text-xl font-bold text-purple-400">{entry.totalPoints}</span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400">
                              {entry.quizAttempts}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400">
                              {entry.puzzlesCompleted}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {globalPagination.totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-t border-gray-700">
                      <p className="text-sm text-gray-400">Page {globalPagination.page} of {globalPagination.totalPages}</p>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => fetchGlobalData(globalPeriod, globalPagination.page - 1, search)}
                          disabled={globalPagination.page <= 1}
                          className="flex items-center space-x-1 px-3 py-1.5 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm"
                        >
                          <FiChevronLeft className="w-4 h-4" />
                          <span>Prev</span>
                        </button>
                        <button
                          onClick={() => fetchGlobalData(globalPeriod, globalPagination.page + 1, search)}
                          disabled={globalPagination.page >= globalPagination.totalPages}
                          className="flex items-center space-x-1 px-3 py-1.5 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm"
                        >
                          <span>Next</span>
                          <FiChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
              <p className="text-gray-400 mt-4">Loading leaderboard...</p>
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="text-center py-12">
              <FiAward className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">
                {search ? 'No results for this search.' : 'No attempts found for this range.'}
              </p>
            </div>
          ) : (
            <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
              <div className="px-4 py-2 bg-gray-700/50 flex items-center justify-between text-sm text-gray-400">
                <span>
                  Showing {(pagination.page - 1) * LIMIT + 1}–{Math.min(pagination.page * LIMIT, pagination.total)} of {pagination.total}
                  {' '}{viewMode === 'byEmail' ? 'email(s)' : 'attempt(s)'}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Rank</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">User</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Class</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Phone</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Score</th>
                      {viewMode === 'daily' && (
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Correct</th>
                      )}
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Time</th>
                      {isTotal && (
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Attempts</th>
                      )}
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {leaderboard.map((entry) => (
                      <tr
                        key={entry.attemptId || entry.userId || entry.email || entry.rank}
                        className={`hover:bg-gray-700/50 transition-colors cursor-pointer ${
                          entry.rank <= 3 ? 'bg-purple-900/20' : ''
                        }`}
                        onClick={() => openUserDetail(entry)}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <span className="text-lg font-bold text-white">
                              {getRankIcon(entry.rank) || `#${entry.rank}`}
                            </span>
                            {entry.rank <= 3 && (
                              <FiAward className={`w-4 h-4 ${
                                entry.rank === 1 ? 'text-yellow-400' :
                                entry.rank === 2 ? 'text-gray-300' :
                                'text-orange-400'
                              }`} />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm font-medium text-white">{entry.userName || ''}</div>
                          <div className="text-xs text-gray-400">{entry.userEmail || entry.email || ''}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">
                          {entry.userClass || 'N/A'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">
                          {entry.userPhone || '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-lg font-bold text-purple-400">
                            {entry.score ?? entry.totalScore ?? 0}
                          </span>
                        </td>
                        {viewMode === 'daily' && (
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">
                            {entry.percentage != null ? `${entry.percentage.toFixed(1)}%` : 'N/A'}
                          </td>
                        )}
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">
                          {formatTime(entry.totalDuration)}
                        </td>
                        {isTotal && (
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">
                            {entry.attemptsCount ?? '—'}
                          </td>
                        )}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button
                            onClick={(e) => { e.stopPropagation(); openUserDetail(entry) }}
                            className="flex items-center space-x-1 px-3 py-1 bg-blue-600/20 text-blue-400 rounded hover:bg-blue-600/30 transition-colors text-xs"
                          >
                            <FiEye className="w-3 h-3" />
                            <span>View</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-t border-gray-700">
                  <p className="text-sm text-gray-400">
                    Page {pagination.page} of {pagination.totalPages}
                  </p>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page <= 1}
                      className="flex items-center space-x-1 px-3 py-1.5 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm"
                    >
                      <FiChevronLeft className="w-4 h-4" />
                      <span>Prev</span>
                    </button>
                    <button
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page >= pagination.totalPages}
                      className="flex items-center space-x-1 px-3 py-1.5 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm"
                    >
                      <span>Next</span>
                      <FiChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedUser(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}>
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
              <div>
                <h3 className="text-lg font-bold text-white">{selectedUser.userName || 'User'}</h3>
                <p className="text-sm text-gray-400">{selectedUser.userEmail || selectedUser.email || ''}</p>
                {selectedUser.userPhone && selectedUser.userPhone !== '—' && (
                  <p className="text-sm text-gray-500">{selectedUser.userPhone}</p>
                )}
              </div>
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <p className="text-xs text-gray-500">Total Score</p>
                  <p className="text-2xl font-bold text-purple-400">{selectedUser.score ?? selectedUser.totalScore ?? 0}</p>
                </div>
                <button onClick={() => setSelectedUser(null)} className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-white">
                  <FiX className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal body — user's attempts */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                All Attempts ({userAttempts.length})
              </h4>
              {userAttemptsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto"></div>
                  <p className="text-gray-500 mt-3 text-sm">Loading attempts...</p>
                </div>
              ) : userAttempts.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">No attempts found.</p>
              ) : (
                <div className="space-y-3">
                  {userAttempts.map((attempt, i) => (
                    <div key={attempt.attemptId || i}
                      className="flex items-center justify-between bg-gray-800 rounded-xl p-4 border border-gray-700/50 hover:border-gray-600 transition-colors">
                      <div className="flex items-center space-x-4">
                        <div className="w-8 h-8 rounded-full bg-purple-600/20 flex items-center justify-center text-sm font-bold text-purple-400">
                          {i + 1}
                        </div>
                        <div>
                          <p className="text-sm text-white font-medium">
                            Score: <span className="text-purple-400">{attempt.score}</span>
                            {attempt.percentage != null && (
                              <span className="text-gray-500 ml-2">({attempt.percentage.toFixed(1)}%)</span>
                            )}
                          </p>
                          <div className="flex items-center space-x-3 text-xs text-gray-500 mt-1">
                            <span className="flex items-center space-x-1">
                              <FiClock className="w-3 h-3" />
                              <span>{formatTime(attempt.totalDuration)}</span>
                            </span>
                            <span>{formatDateTime(attempt.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => navigate(`/quiz-attempts/${attempt.attemptId}`)}
                        className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <FiEye className="w-3 h-3" />
                        <span>Detail</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Leaderboard
