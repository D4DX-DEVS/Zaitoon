import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import SuccessModal from '../components/SuccessModal'
import axios from 'axios'
import { 
  FiAward,
  FiRefreshCw,
  FiEye,
  FiTrash2,
  FiClock,
  FiSearch,
  FiCalendar,
  FiChevronLeft,
  FiChevronRight,
  FiX
} from 'react-icons/fi'

const today = () => new Date().toISOString().split('T')[0]
const LIMIT = 10

function QuizAttempts() {
  const navigate = useNavigate()
  const API_BASE = import.meta.env.VITE_API_BASE_URL

  const [attendees, setAttendees] = useState([])
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 })
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [modal, setModal] = useState({ isOpen: false, type: 'success', message: '', onConfirm: null, onCancel: null })

  const showModal = (type, message, onConfirm = null, onCancel = null) => {
    setModal({ isOpen: true, type, message, onConfirm, onCancel })
  }

  const closeModal = () => {
    setModal({ isOpen: false, type: 'success', message: '', onConfirm: null, onCancel: null })
  }

  // Filters
  const [search, setSearch] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(1)
  const searchTimerRef = useRef(null)

  // Quiz config (separate call to keep the summary banner)
  const [quizConfig, setQuizConfig] = useState(null)
  const [configs, setConfigs] = useState([])
  const [selectedConfigId, setSelectedConfigId] = useState('')

  useEffect(() => {
    fetchAttempts()
    fetchQuizConfig()
    fetchConfigs()
  }, [])

  const fetchConfigs = async () => {
    try {
      const token = localStorage.getItem('adminToken')
      const response = await axios.get(`${API_BASE}/quizzes/config/all`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (response.data.success) setConfigs(response.data.data || [])
    } catch (error) {
      console.error('Failed to fetch configs:', error)
    }
  }

  const fetchQuizConfig = async () => {
    try {
      const token = localStorage.getItem('adminToken')
      const response = await axios.get(`${API_BASE}/quizzes/config`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (response.data.success) {
        setQuizConfig(response.data.data)
      }
    } catch (error) {
      // Config might not exist, that's OK
      console.error('Failed to fetch quiz config:', error)
    }
  }

  const fetchAttempts = useCallback(async (p = page, s = search, from = fromDate, to = toDate, cfgId = selectedConfigId) => {
    setLoading(true)
    try {
      const token = localStorage.getItem('adminToken')
      const params = new URLSearchParams()
      params.set('page', p)
      params.set('limit', LIMIT)
      if (s && s.trim()) params.set('search', s.trim())
      if (from) params.set('startDate', from)
      if (to) params.set('endDate', to)
      if (cfgId) params.set('configId', cfgId)

      const response = await axios.get(
        `${API_BASE}/quiz-attempts/admin/all?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (response.data.success) {
        setAttendees(response.data.data.attendees || [])
        setPagination(response.data.data.pagination || { total: 0, page: 1, totalPages: 1 })
      } else {
        setAttendees([])
        setPagination({ total: 0, page: 1, totalPages: 1 })
      }
    } catch (error) {
      console.error('Failed to fetch attempts:', error)
      setAttendees([])
      setPagination({ total: 0, page: 1, totalPages: 1 })
    } finally {
      setLoading(false)
    }
  }, [page, search, fromDate, toDate, selectedConfigId, API_BASE])

  const handleSearchChange = (val) => {
    setSearch(val)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      setPage(1)
      fetchAttempts(1, val, fromDate, toDate, selectedConfigId)
    }, 400)
  }

  const handleApplyDateRange = () => {
    setPage(1)
    fetchAttempts(1, search, fromDate, toDate, selectedConfigId)
  }

  const handleClearDates = () => {
    setFromDate('')
    setToDate('')
    setPage(1)
    fetchAttempts(1, search, '', '', selectedConfigId)
  }

  const handlePageChange = (newPage) => {
    setPage(newPage)
    fetchAttempts(newPage, search, fromDate, toDate, selectedConfigId)
  }

  const handleRefresh = () => {
    fetchAttempts(page, search, fromDate, toDate, selectedConfigId)
  }

  const formatDate = (dateString) => {
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

  const handleViewDetails = (attemptId) => {
    navigate(`/quiz-attempts/${attemptId}`)
  }

  const confirmDeleteAttempt = async (attemptId) => {
    setDeletingId(attemptId)
    try {
      const token = localStorage.getItem('adminToken')
      const response = await axios.delete(`${API_BASE}/quiz-attempts/${attemptId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (response.data.success) {
        await fetchAttempts(page, search, fromDate, toDate, selectedConfigId)
      } else {
        showModal('error', response.data.message || 'Failed to delete attempt')
      }
    } catch (error) {
      console.error('Failed to delete attempt:', error)
      showModal('error', error.response?.data?.message || 'Failed to delete quiz attempt')
    } finally {
      setDeletingId(null)
    }
  }

  const handleDeleteAttempt = (attemptId) => {
    showModal('confirmation', 'Are you sure you want to delete this quiz attempt? This action cannot be undone.', () => confirmDeleteAttempt(attemptId), null)
  }

  return (
    <>
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <Sidebar />
      
      <div className="flex-1 ml-56">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
            <div>
              <h1 className="text-4xl font-bold text-white mb-1" style={{ fontFamily: 'Archivo Black' }}>
                Quiz Attempts
              </h1>
              <p className="text-gray-400 text-sm">View and manage all quiz attempts</p>
            </div>
            <div className="flex items-center space-x-2">
              {configs.length > 0 && (
                <select
                  value={selectedConfigId}
                  onChange={(e) => {
                    const id = e.target.value
                    setSelectedConfigId(id)
                    setPage(1)
                    fetchAttempts(1, search, fromDate, toDate, id)
                  }}
                  className="px-3 py-2 bg-gray-800 text-white text-sm rounded-lg border border-gray-700 focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">All Quizzes</option>
                  {configs.map(c => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
              )}
              <button
                onClick={handleRefresh}
                className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
              >
                <FiRefreshCw className="w-4 h-4" />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Quiz Config Summary */}
          {quizConfig && (
            <div className="bg-gray-800 rounded-lg p-5 border border-gray-700 mb-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Total Attempts</p>
                  <p className="text-2xl font-bold text-white">{pagination.total}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Config Start</p>
                  <p className="text-sm text-white">{formatDate(quizConfig.startDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Config End</p>
                  <p className="text-sm text-white">{formatDate(quizConfig.endDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Status</p>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    quizConfig.isLive 
                      ? 'bg-green-500/20 text-green-400' 
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {quizConfig.isLive ? 'Live' : 'Not Live'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Filters row */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
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

            {/* Date range */}
            <div className="flex items-center space-x-2">
              <FiCalendar className="w-4 h-4 text-gray-400" />
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                className="px-3 py-2 bg-gray-800 text-white text-sm rounded-lg border border-gray-700 focus:ring-2 focus:ring-purple-500" />
              <span className="text-gray-500 text-sm">to</span>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                className="px-3 py-2 bg-gray-800 text-white text-sm rounded-lg border border-gray-700 focus:ring-2 focus:ring-purple-500" />
            </div>
            <button onClick={handleApplyDateRange}
              className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors">
              Apply
            </button>
            {(fromDate || toDate) && (
              <button onClick={handleClearDates}
                className="px-3 py-2 bg-gray-700 text-gray-300 text-sm rounded-lg hover:bg-gray-600 transition-colors">
                Clear Dates
              </button>
            )}
          </div>

          {/* Table */}
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
              <p className="text-gray-400 mt-4">Loading attempts...</p>
            </div>
          ) : attendees.length === 0 ? (
            <div className="text-center py-12">
              <FiAward className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">
                {search ? 'No results for this search.' : 'No quiz attempts found.'}
              </p>
            </div>
          ) : (
            <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
              <div className="px-4 py-2 bg-gray-700/50 text-sm text-gray-400">
                Showing {(pagination.page - 1) * LIMIT + 1}–{Math.min(pagination.page * LIMIT, pagination.total)} of {pagination.total} attempt(s)
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
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Percentage</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Duration</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Submitted At</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {attendees.map((attendee) => (
                      <tr
                        key={attendee.attemptId}
                        className={`hover:bg-gray-700/50 transition-colors ${
                          attendee.rank <= 3 ? 'bg-purple-900/20' : ''
                        }`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <span className="text-lg font-bold text-white">
                              {attendee.rank <= 3 ? ['🥇', '🥈', '🥉'][attendee.rank - 1] : `#${attendee.rank}`}
                            </span>
                            {attendee.rank <= 3 && (
                              <FiAward className={`w-4 h-4 ${
                                attendee.rank === 1 ? 'text-yellow-400' :
                                attendee.rank === 2 ? 'text-gray-300' :
                                'text-orange-400'
                              }`} />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm font-medium text-white">{attendee.userName || ''}</div>
                          <div className="text-xs text-gray-400">{attendee.userEmail || ''}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">
                          {attendee.userClass || 'N/A'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">
                          {attendee.userPhone || '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-lg font-bold text-purple-400">{attendee.score}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">
                          {attendee.percentage != null ? `${attendee.percentage.toFixed(1)}%` : 'N/A'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">
                          <div className="flex items-center space-x-1">
                            <FiClock className="w-3 h-3" />
                            <span>{formatTime(attendee.totalDuration)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">
                          {formatDate(attendee.createdAt)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleViewDetails(attendee.attemptId)}
                              className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs"
                            >
                              <FiEye className="w-3 h-3" />
                              <span>View</span>
                            </button>
                            <button
                              onClick={() => handleDeleteAttempt(attendee.attemptId)}
                              disabled={deletingId === attendee.attemptId}
                              className="flex items-center space-x-1 px-3 py-1 bg-red-600/80 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs"
                            >
                              {deletingId === attendee.attemptId ? (
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                              ) : (
                                <FiTrash2 className="w-3 h-3" />
                              )}
                              <span>Delete</span>
                            </button>
                          </div>
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
    </div>

      <SuccessModal
        isOpen={modal.isOpen}
        type={modal.type}
        message={modal.message}
        onClose={closeModal}
        onConfirm={modal.onConfirm}
        onCancel={modal.onCancel}
      />
    </>
  )
}

export default QuizAttempts
