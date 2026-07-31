import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import SuccessModal from '../components/SuccessModal'
import axios from 'axios'
import { 
  FiPlus, 
  FiX,
  FiEdit3,
  FiTrash2,
  FiCheck,
  FiXCircle
} from 'react-icons/fi'

function Questions() {
  const API_BASE = import.meta.env.VITE_API_BASE_URL
  const [searchParams] = useSearchParams()
  const configIdFromUrl = searchParams.get('configId') || ''
  const configNameFromUrl = searchParams.get('configName') || ''

  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState(null)
  const [modal, setModal] = useState({ isOpen: false, type: 'success', message: '', onConfirm: null, onCancel: null })
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [configs, setConfigs] = useState([])
  const [filterConfigId, setFilterConfigId] = useState(configIdFromUrl)

  const [formData, setFormData] = useState({
    questionText: '',
    mlQuestionText: '',
    options: ['', '', '', ''],
    mlOptions: ['', '', '', ''],
    correctAnswer: 0,
    points: 1,
    category: '',
    difficulty: 'Medium',
    quizConfigId: configIdFromUrl,
    optionCount: 4
  })

  useEffect(() => {
    fetchQuestions(1)
    fetchConfigs()
  }, [])

  const fetchConfigs = async () => {
    try {
      const token = localStorage.getItem('adminToken')
      const response = await axios.get(`${API_BASE}/quizzes/config/all`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (response.data.success) {
        setConfigs(response.data.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch configs:', error)
    }
  }

  const fetchQuestions = async (pageToLoad = 1, cfgId = filterConfigId) => {
    setLoading(true)
    try {
      const token = localStorage.getItem('adminToken')
      const params = { page: pageToLoad, limit: pagination.limit || 20 }
      if (cfgId) params.quizConfigId = cfgId
      const response = await axios.get(
        `${API_BASE}/questions`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params
        }
      )
      if (response.data.success) {
        const { questions: fetchedQuestions, pagination: serverPagination } = response.data.data || {}
        setQuestions(fetchedQuestions || [])
        if (serverPagination) {
          setPagination(serverPagination)
          setCurrentPage(serverPagination.page || pageToLoad)
        } else {
          setCurrentPage(pageToLoad)
        }
      }
    } catch (error) {
      showModal('error', 'Failed to fetch questions')
    } finally {
      setLoading(false)
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
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleOptionChange = (index, value, isMalayalam = false) => {
    setFormData(prev => {
      const key = isMalayalam ? 'mlOptions' : 'options'
      const newOptions = [...prev[key]]
      newOptions[index] = value
      return { ...prev, [key]: newOptions }
    })
  }

  const handleOptionCountChange = (newCount) => {
    const count = parseInt(newCount)
    setFormData(prev => {
      const resizeArray = (arr) => {
        if (arr.length < count) {
          return [...arr, ...Array(count - arr.length).fill('')]
        }
        return arr.slice(0, count)
      }
      const newCorrectAnswer = prev.correctAnswer >= count ? 0 : prev.correctAnswer
      return {
        ...prev,
        optionCount: count,
        options: resizeArray(prev.options),
        mlOptions: resizeArray(prev.mlOptions),
        correctAnswer: newCorrectAnswer
      }
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validate all fields
    if (!formData.questionText || !formData.mlQuestionText) {
      showModal('error', 'Please fill question text in both languages')
      return
    }

    if (formData.options.some(opt => !opt.trim()) || formData.mlOptions.some(opt => !opt.trim())) {
      showModal('error', 'Please fill all options in both languages')
      return
    }

    setLoading(true)
    try {
      const token = localStorage.getItem('adminToken')
      const url = editingQuestion 
        ? `${API_BASE}/questions/${editingQuestion._id}`
        : `${API_BASE}/questions`
      
      const method = editingQuestion ? 'put' : 'post'
      
      // Strip UI-only field before sending to API
      const { optionCount, ...payload } = formData

      const response = await axios[method](url, payload, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.data.success) {
        showModal('success', editingQuestion ? 'Question updated successfully' : 'Question created successfully')
        setShowForm(false)
        resetForm()
        fetchQuestions(currentPage)
      }
    } catch (error) {
      showModal('error', error.response?.data?.message || 'Failed to save question')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (question) => {
    setEditingQuestion(question)
    const existingOptions = question.options || ['', '', '', '']
    setFormData({
      questionText: question.questionText || '',
      mlQuestionText: question.mlQuestionText || '',
      options: existingOptions,
      mlOptions: question.mlOptions || ['', '', '', ''],
      correctAnswer: question.correctAnswer || 0,
      points: question.points || 1,
      category: question.category || '',
      difficulty: question.difficulty || 'Medium',
      quizConfigId: question.quizConfigId || filterConfigId || '',
      optionCount: existingOptions.length
    })
    setShowForm(true)
  }

  const confirmDelete = async (questionId) => {
    setLoading(true)
    try {
      const token = localStorage.getItem('adminToken')
      const response = await axios.delete(`${API_BASE}/questions/${questionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.data.success) {
        showModal('success', 'Question deleted successfully')
        const isLastItemOnPage = questions.length === 1 && currentPage > 1
        const nextPage = isLastItemOnPage ? currentPage - 1 : currentPage
        fetchQuestions(nextPage)
      }
    } catch (error) {
      showModal('error', error.response?.data?.message || 'Failed to delete question')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = (questionId) => {
    showModal('confirmation', 'Are you sure you want to delete this question?', () => confirmDelete(questionId), null)
  }

  const resetForm = () => {
    setFormData({
      questionText: '',
      mlQuestionText: '',
      options: ['', '', '', ''],
      mlOptions: ['', '', '', ''],
      correctAnswer: 0,
      points: 1,
      category: '',
      difficulty: 'Medium',
      quizConfigId: filterConfigId || '',
      optionCount: 4
    })
    setEditingQuestion(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <Sidebar />
      
      <div className="flex-1 ml-64">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-4xl font-bold text-white" style={{ fontFamily: 'Archivo Black' }}>
                Question Bank
              </h1>
              {(configNameFromUrl || filterConfigId) && (
                <p className="text-purple-400 mt-1 text-sm">
                  Quiz: <span className="font-semibold">
                    {configNameFromUrl || configs.find(c => c._id === filterConfigId)?.name || 'Selected Quiz'}
                  </span>
                </p>
              )}
            </div>
            <div className="flex items-center space-x-3">
              {configs.length > 0 && !configIdFromUrl && (
                <select
                  value={filterConfigId}
                  onChange={(e) => {
                    const newId = e.target.value
                    setFilterConfigId(newId)
                    fetchQuestions(1, newId)
                  }}
                  className="px-3 py-2 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
                >
                  <option value="">All Quizzes</option>
                  {configs.map(c => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
              )}
              <button
                onClick={() => {
                  resetForm()
                  setShowForm(true)
                }}
                className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <FiPlus className="w-5 h-5" />
                <span>Add Question</span>
              </button>
            </div>
          </div>

          {/* Question Form Modal */}
          {showForm && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-gray-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-white">
                      {editingQuestion ? 'Edit Question' : 'Create New Question'}
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
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Question (English) *
                      </label>
                      <textarea
                        name="questionText"
                        value={formData.questionText}
                        onChange={handleInputChange}
                        rows="3"
                        className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Question (Malayalam) *
                      </label>
                      <textarea
                        name="mlQuestionText"
                        value={formData.mlQuestionText}
                        onChange={handleInputChange}
                        rows="3"
                        className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                        required
                      />
                    </div>

                    {/* Number of Options Selector */}
                    <div className="flex items-center space-x-4 p-3 bg-gray-700/50 rounded-lg border border-gray-600">
                      <label className="text-sm font-medium text-gray-300 whitespace-nowrap">
                        Number of Options *
                      </label>
                      <div className="flex space-x-2">
                        {[2, 3, 4].map(n => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => handleOptionCountChange(n)}
                            className={`w-9 h-9 rounded-lg text-sm font-semibold transition-colors ${
                              formData.optionCount === n
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                      <span className="text-xs text-gray-400">Default is 4</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* English Options */}
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Options (English) *
                        </label>
                        <div className="space-y-2">
                          {formData.options.map((option, index) => (
                            <div key={index} className="flex items-center space-x-2">
                              <input
                                type="radio"
                                name="correctAnswer"
                                checked={formData.correctAnswer === index}
                                onChange={() => setFormData(prev => ({ ...prev, correctAnswer: index }))}
                                className="w-4 h-4"
                              />
                              <input
                                type="text"
                                value={option}
                                onChange={(e) => handleOptionChange(index, e.target.value, false)}
                                placeholder={`Option ${index + 1}`}
                                className="flex-1 px-3 py-2 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                                required
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Malayalam Options */}
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Options (Malayalam) *
                        </label>
                        <div className="space-y-2">
                          {formData.mlOptions.map((option, index) => (
                            <div key={index} className="flex items-center space-x-2">
                              <div className="w-4 h-4 flex items-center justify-center">
                                {formData.correctAnswer === index && (
                                  <FiCheck className="w-4 h-4 text-green-400" />
                                )}
                              </div>
                              <input
                                type="text"
                                value={option}
                                onChange={(e) => handleOptionChange(index, e.target.value, true)}
                                placeholder={`Option ${index + 1} (ML)`}
                                className="flex-1 px-3 py-2 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                                required
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {configs.length > 0 && (
                        <div className="md:col-span-3">
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Quiz Programme
                          </label>
                          <select
                            name="quizConfigId"
                            value={formData.quizConfigId}
                            onChange={handleInputChange}
                            className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                          >
                            <option value="">Not assigned</option>
                            {configs.map(c => (
                              <option key={c._id} value={c._id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Points *
                        </label>
                        <input
                          type="number"
                          name="points"
                          value={formData.points}
                          onChange={handleInputChange}
                          min="1"
                          className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Category
                        </label>
                        <input
                          type="text"
                          name="category"
                          value={formData.category}
                          onChange={handleInputChange}
                          className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Difficulty *
                        </label>
                        <select
                          name="difficulty"
                          value={formData.difficulty}
                          onChange={handleInputChange}
                          className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                        >
                          <option value="Easy">Easy</option>
                          <option value="Medium">Medium</option>
                          <option value="Hard">Hard</option>
                        </select>
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
                        {loading ? 'Saving...' : editingQuestion ? 'Update' : 'Create'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Questions List */}
          {loading && !showForm ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
              <p className="text-gray-400 mt-4">Loading questions...</p>
            </div>
          ) : questions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400">No questions found. Create your first question!</p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {questions.map((question) => (
                  <div key={question._id} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-white mb-2">{question.questionText}</h3>
                        <p className="text-gray-400 text-sm mb-4">{question.mlQuestionText}</p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div>
                            <p className="text-xs text-gray-500 mb-2">English Options:</p>
                            <ul className="space-y-1">
                              {question.options.map((opt, idx) => (
                                <li key={idx} className="text-sm text-gray-300">
                                  {idx + 1}. {opt} {idx === question.correctAnswer && (
                                    <span className="text-green-400 ml-2">✓ Correct</span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-2">Malayalam Options:</p>
                            <ul className="space-y-1">
                              {question.mlOptions.map((opt, idx) => (
                                <li key={idx} className="text-sm text-gray-300">
                                  {idx + 1}. {opt}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        <div className="flex items-center space-x-4 text-sm">
                          <span className="text-gray-400">
                            Points: <span className="text-white">{question.points}</span>
                          </span>
                          <span className="text-gray-400">
                            Difficulty: <span className="text-white">{question.difficulty}</span>
                          </span>
                          {question.category && (
                            <span className="text-gray-400">
                              Category: <span className="text-white">{question.category}</span>
                            </span>
                          )}
                          {question.quizConfigId && (
                            <span className="px-2 py-0.5 bg-purple-900 text-purple-300 rounded-full text-xs">
                              {configs.find(c => c._id === (question.quizConfigId?._id || question.quizConfigId))?.name || 'Quiz'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => handleEdit(question)}
                        className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        <FiEdit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(question._id)}
                        className="p-2 bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <div className="text-sm text-gray-400">
                    Page <span className="text-white">{currentPage}</span> of{" "}
                    <span className="text-white">{pagination.totalPages}</span>{" "}
                    <span className="hidden sm:inline">
                      ({pagination.total} questions)
                    </span>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      disabled={currentPage === 1 || loading}
                      onClick={() => fetchQuestions(currentPage - 1)}
                      className={`px-3 py-1 rounded-lg text-sm ${
                        currentPage === 1 || loading
                          ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                          : "bg-gray-700 text-white hover:bg-gray-600"
                      }`}
                    >
                      Previous
                    </button>
                    <button
                      disabled={currentPage === pagination.totalPages || loading}
                      onClick={() => fetchQuestions(currentPage + 1)}
                      className={`px-3 py-1 rounded-lg text-sm ${
                        currentPage === pagination.totalPages || loading
                          ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                          : "bg-gray-700 text-white hover:bg-gray-600"
                      }`}
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

export default Questions
