import React, { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import SuccessModal from '../components/SuccessModal'
import axios from 'axios'
import { 
  FiPlus, 
  FiX,
  FiEdit3,
  FiTrash2,
  FiCalendar,
  FiCheck,
  FiXCircle
} from 'react-icons/fi'

function Quizzes() {
  const API_BASE = import.meta.env.VITE_API_BASE_URL
  const [quizzes, setQuizzes] = useState([])
  const [questions, setQuestions] = useState([])
  const [configs, setConfigs] = useState([])
  const [filterConfigId, setFilterConfigId] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingQuiz, setEditingQuiz] = useState(null)
  const [modal, setModal] = useState({ isOpen: false, type: 'success', message: '', onConfirm: null, onCancel: null })
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, limit: 20 })

  const [formData, setFormData] = useState({
    title: '',
    mlTitle: '',
    description: '',
    mlDescription: '',
    quizDate: '',
    questions: [],
    status: 'Active',
    quizConfigId: ''
  })

  useEffect(() => {
    fetchQuizzes(1)
    fetchQuestions()
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
      console.error('Failed to fetch configs:', e)
    }
  }

  const fetchQuizzes = async (page = 1) => {
    setLoading(true)
    try {
      const token = localStorage.getItem('adminToken')
      const params = { page, limit: 20 }
      if (filterConfigId) params.configId = filterConfigId
      const response = await axios.get(`${API_BASE}/quizzes`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      })
      if (response.data.success) {
        setQuizzes(response.data.data.quizzes || [])
        if (response.data.data.pagination) {
          setPagination(response.data.data.pagination)
          setCurrentPage(response.data.data.pagination.page || page)
        }
      }
    } catch (error) {
      showModal('error', 'Failed to fetch quizzes')
    } finally {
      setLoading(false)
    }
  }

  const fetchQuestions = async (configId = '') => {
    try {
      const token = localStorage.getItem('adminToken')
      const params = { limit: 1000, sort: 'asc' }
      if (configId) params.quizConfigId = configId
      const response = await axios.get(`${API_BASE}/questions`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      })
      if (response.data.success) {
        const raw = response.data.data.questions || []
        // Deduplicate by questionText to prevent same question appearing twice
        const seen = new Set()
        const unique = raw.filter(q => {
          const key = q.questionText?.trim().toLowerCase()
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        setQuestions(unique)
      }
    } catch (error) {
      console.error('Failed to fetch questions:', error)
    }
  }

  const showModal = (type, message, onConfirm = null, onCancel = null) => {
    setModal({ isOpen: true, type, message, onConfirm, onCancel })
  }

  const closeModal = () => {
    setModal({ isOpen: false, type: 'success', message: '', onConfirm: null, onCancel: null })
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    if (name === 'quizConfigId') {
      setFormData(prev => ({ ...prev, quizConfigId: value, questions: [] }))
      fetchQuestions(value)
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
  }

  const handleQuestionToggle = (questionId) => {
    setFormData(prev => {
      const isSelected = prev.questions.includes(questionId)
      return {
        ...prev,
        questions: isSelected
          ? prev.questions.filter(id => id !== questionId)
          : [...prev.questions, questionId]
      }
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.title || !formData.mlTitle || !formData.quizDate || formData.questions.length === 0) {
      showModal('error', 'Please fill all required fields and select at least one question')
      return
    }

    setLoading(true)
    try {
      const token = localStorage.getItem('adminToken')
      const url = editingQuiz 
        ? `${API_BASE}/quizzes/${editingQuiz._id}`
        : `${API_BASE}/quizzes`
      
      const method = editingQuiz ? 'put' : 'post'
      
      const response = await axios[method](url, formData, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.data.success) {
        showModal('success', editingQuiz ? 'Quiz updated successfully' : 'Quiz created successfully')
        setShowForm(false)
        resetForm()
        fetchQuizzes(currentPage)
      }
    } catch (error) {
      showModal('error', error.response?.data?.message || 'Failed to save quiz')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (quiz) => {
    setEditingQuiz(quiz)
    const cfgId = quiz.quizConfigId || ''
    setFormData({
      title: quiz.title || '',
      mlTitle: quiz.mlTitle || '',
      description: quiz.description || '',
      mlDescription: quiz.mlDescription || '',
      quizDate: quiz.quizDate ? new Date(quiz.quizDate).toISOString().split('T')[0] : '',
      questions: quiz.questions?.map(q => q._id || q) || [],
      status: quiz.status || 'Active',
      quizConfigId: cfgId
    })
    fetchQuestions(cfgId)
    setShowForm(true)
  }

  const confirmDelete = async (quizId) => {
    setLoading(true)
    try {
      const token = localStorage.getItem('adminToken')
      const response = await axios.delete(`${API_BASE}/quizzes/${quizId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.data.success) {
        showModal('success', 'Quiz deleted successfully')
        const newPage = quizzes.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage
        fetchQuizzes(newPage)
      }
    } catch (error) {
      showModal('error', error.response?.data?.message || 'Failed to delete quiz')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = (quizId) => {
    showModal('confirmation', 'Are you sure you want to delete this quiz?', () => confirmDelete(quizId), null)
  }

  const resetForm = () => {
    setFormData({
      title: '',
      mlTitle: '',
      description: '',
      mlDescription: '',
      quizDate: '',
      questions: [],
      status: 'Active',
      quizConfigId: filterConfigId || ''
    })
    setEditingQuiz(null)
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <Sidebar />
      
      <div className="flex-1 ml-64">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="flex flex-wrap justify-between items-center mb-6 gap-3">
            <h1 className="text-4xl font-bold text-white" style={{ fontFamily: 'Archivo Black' }}>
              Daily Quizzes
            </h1>
            <div className="flex items-center gap-3">
              {configs.length > 0 && (
                <select
                  value={filterConfigId}
                  onChange={(e) => {
                    setFilterConfigId(e.target.value)
                    setCurrentPage(1)
                    // re-fetch with new filter
                    setLoading(true)
                    const token = localStorage.getItem('adminToken')
                    const params = { page: 1, limit: 20 }
                    if (e.target.value) params.configId = e.target.value
                    axios.get(`${API_BASE}/quizzes`, {
                      headers: { Authorization: `Bearer ${token}` },
                      params
                    }).then(r => {
                      if (r.data.success) {
                        setQuizzes(r.data.data.quizzes || [])
                        if (r.data.data.pagination) setPagination(r.data.data.pagination)
                      }
                    }).catch(() => {}).finally(() => setLoading(false))
                  }}
                  className="px-3 py-2 bg-gray-800 text-white text-sm rounded-lg border border-gray-700 focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">All Quiz Programmes</option>
                  {configs.map(c => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
              )}
              <button
                onClick={() => {
                  resetForm()
                  fetchQuestions(filterConfigId || '')
                  setShowForm(true)
                }}
                className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <FiPlus className="w-5 h-5" />
                <span>Create Quiz</span>
              </button>
            </div>
          </div>

          {/* Quiz Form Modal */}
          {showForm && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-gray-800 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-white">
                      {editingQuiz ? 'Edit Quiz' : 'Create New Quiz'}
                    </h2>
                    <button
                      onClick={() => {
                        setShowForm(false)
                        resetForm()
                      }}
                      className="text-gray-400 hover:text-white"
                    >
                      <FiX className="w-6 h-6" />
                    </button>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Title (English) *
                        </label>
                        <input
                          type="text"
                          name="title"
                          value={formData.title}
                          onChange={handleInputChange}
                          className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Title (Malayalam) *
                        </label>
                        <input
                          type="text"
                          name="mlTitle"
                          value={formData.mlTitle}
                          onChange={handleInputChange}
                          className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Description (English)
                        </label>
                        <textarea
                          name="description"
                          value={formData.description}
                          onChange={handleInputChange}
                          rows="3"
                          className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Description (Malayalam)
                        </label>
                        <textarea
                          name="mlDescription"
                          value={formData.mlDescription}
                          onChange={handleInputChange}
                          rows="3"
                          className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Quiz Programme
                        </label>
                        <select
                          name="quizConfigId"
                          value={formData.quizConfigId}
                          onChange={handleInputChange}
                          className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                        >
                          <option value="">-- Select Programme --</option>
                          {configs.map(c => (
                            <option key={c._id} value={c._id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Quiz Date *
                        </label>
                        <input
                          type="date"
                          name="quizDate"
                          value={formData.quizDate}
                          onChange={handleInputChange}
                          className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Status *
                        </label>
                        <select
                          name="status"
                          value={formData.status}
                          onChange={handleInputChange}
                          className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                        >
                          <option value="Active">Active</option>
                          <option value="Inactive">Inactive</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Select Questions * ({formData.questions.length} selected)
                      </label>
                      <div className="bg-gray-700 rounded-lg p-4 max-h-64 overflow-y-auto">
                        {questions.length === 0 ? (
                          <p className="text-gray-400 text-sm">No questions available. Create questions first.</p>
                        ) : (
                          <div className="space-y-2">
                            {questions.map((q, index) => (
                              <label
                                key={q._id}
                                className="flex items-start space-x-3 p-2 hover:bg-gray-600 rounded cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={formData.questions.includes(q._id)}
                                  onChange={() => handleQuestionToggle(q._id)}
                                  className="mt-1"
                                />
                                <div className="flex-1">
                                  <p className="text-white text-sm">{q.questionText}</p>
                                  <p className="text-gray-400 text-xs">{q.mlQuestionText}</p>
                                </div>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setShowForm(false)
                          resetForm()
                        }}
                        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                      >
                        {loading ? 'Saving...' : editingQuiz ? 'Update' : 'Create'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Quizzes List */}
          {loading && !showForm ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
              <p className="text-gray-400 mt-4">Loading quizzes...</p>
            </div>
          ) : quizzes.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400">No quizzes found. Create your first quiz!</p>
            </div>
          ) : (
            <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {quizzes.map((quiz) => (
                <div key={quiz._id} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-white mb-1">{quiz.title}</h3>
                      <p className="text-gray-400 text-sm mb-2">{quiz.mlTitle}</p>
                      <div className="flex items-center space-x-2 text-sm text-gray-400">
                        <FiCalendar className="w-4 h-4" />
                        <span>{formatDate(quiz.quizDate)}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {quiz.status === 'Active' ? (
                        <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs">
                          Inactive
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mb-4">
                    <p className="text-gray-400 text-sm mb-1">
                      Questions: {quiz.questions?.length || 0}
                    </p>
                  </div>

                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => handleEdit(quiz)}
                      className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      <FiEdit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(quiz._id)}
                      className="p-2 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-8">
                <p className="text-gray-400 text-sm">
                  Showing {(currentPage - 1) * pagination.limit + 1}–{Math.min(currentPage * pagination.limit, pagination.total)} of {pagination.total} quizzes
                </p>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => fetchQuizzes(currentPage - 1)}
                    disabled={currentPage <= 1}
                    className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(p => (
                    <button
                      key={p}
                      onClick={() => fetchQuizzes(p)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium ${
                        p === currentPage
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    onClick={() => fetchQuizzes(currentPage + 1)}
                    disabled={currentPage >= pagination.totalPages}
                    className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
            </>
          )}
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
    </div>
  )
}

export default Quizzes
