import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import axios from 'axios'
import { 
  FiArrowLeft,
  FiCheck,
  FiX,
  FiClock,
  FiUser,
  FiMail,
  FiAward
} from 'react-icons/fi'

function AttemptDetail() {
  const navigate = useNavigate()
  const { attemptId } = useParams()
  const API_BASE = import.meta.env.VITE_API_BASE_URL
  const [attempt, setAttempt] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (attemptId) {
      fetchAttemptDetail()
    }
  }, [attemptId])

  const fetchAttemptDetail = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('adminToken')
      // Fetch full attempt details from API
      const response = await axios.get(
        `${API_BASE}/quiz-attempts/${attemptId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      
      if (response.data.success) {
        setAttempt(response.data.data)
      }
    } catch (error) {
      console.error('Failed to fetch attempt detail:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (seconds) => {
    if (!seconds) return '0s'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}m ${secs}s`
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const parseOptions = (optionsString) => {
    try {
      return JSON.parse(optionsString)
    } catch (e) {
      return []
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <Sidebar />
        <div className="flex-1 ml-56">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
              <p className="text-gray-400 mt-4">Loading attempt details...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!attempt) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <Sidebar />
        <div className="flex-1 ml-56">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center py-12">
              <p className="text-gray-400">Attempt not found.</p>
              <button
                onClick={() => navigate('/quiz-attempts')}
                className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Back to Leaderboard
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const questions = attempt.questions || []
  const answers = attempt.answers || []
  const user = attempt.userId || attempt.userSnapshot || attempt.user || {}

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <Sidebar />
      
      <div className="flex-1 ml-56">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="flex items-center space-x-4 mb-6">
            <button
              onClick={() => navigate('/quiz-attempts')}
              className="p-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              <FiArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-4xl font-bold text-white" style={{ fontFamily: 'Archivo Black' }}>
                Attempt Details
              </h1>
              <p className="text-gray-400">Review quiz attempt and answers</p>
            </div>
          </div>

          {/* User Info & Score Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* User Info */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
                <FiUser className="w-5 h-5" />
                <span>User Information</span>
              </h2>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-400">Name</p>
                  <p className="text-white font-medium">{user.name || ''}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Email</p>
                  <p className="text-white font-medium flex items-center space-x-1">
                    <FiMail className="w-4 h-4" />
                    <span>{user.email || 'N/A'}</span>
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Class</p>
                  <p className="text-white font-medium">{user.class || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Phone</p>
                  <p className="text-white font-medium">{user.phone || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Language</p>
                  <p className="text-white font-medium uppercase">{attempt.language || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Score Summary */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
                <FiAward className="w-5 h-5" />
                <span>Score Summary</span>
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Score</span>
                  <span className="text-2xl font-bold text-purple-400">{attempt.score || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Percentage</span>
                  <span className="text-xl font-bold text-white">
                    {attempt.percentage ? attempt.percentage.toFixed(2) : '0.00'}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Total Questions</span>
                  <span className="text-white font-medium">{questions.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 flex items-center space-x-1">
                    <FiClock className="w-4 h-4" />
                    <span>Total Duration</span>
                  </span>
                  <span className="text-white font-medium">{formatTime(attempt.totalDuration)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Submitted At</span>
                  <span className="text-white text-sm">{formatDate(attempt.createdAt)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Question-by-Question Review */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-2xl font-bold text-white mb-6">Question Review</h2>
            <div className="space-y-6">
              {questions.map((question, index) => {
                const answer = answers[index]
                const isCorrect = answer?.isCorrect || false
                const attemptedAnswer = answer?.attemptedAnswer ?? null
                const optionsEn = parseOptions(question.options_en || '[]')
                const optionsMl = parseOptions(question.options_ml || '[]')
                const correctAnswer = question.correct_answer ?? null
                const language = attempt.language || 'en'
                const questionText = language === 'ml' ? question.question_ml : question.question_en
                const options = language === 'ml' ? optionsMl : optionsEn

                return (
                  <div
                    key={index}
                    className={`p-6 rounded-lg border-2 ${
                      isCorrect 
                        ? 'bg-green-500/10 border-green-500/50' 
                        : 'bg-red-500/10 border-red-500/50'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <span className="px-3 py-1 bg-gray-700 text-white rounded-full text-sm font-medium">
                          Question {index + 1}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          isCorrect 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {isCorrect ? 'Correct' : 'Incorrect'}
                        </span>
                        <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm">
                          {question.difficulty || 'Medium'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-gray-400">
                        <FiClock className="w-4 h-4" />
                        <span>{formatTime(answer?.duration || 0)}</span>
                      </div>
                    </div>

                    <p className="text-white text-lg font-medium mb-4">{questionText}</p>

                    <div className="space-y-2">
                      {options.map((option, optIndex) => {
                        const isSelected = attemptedAnswer === optIndex
                        const isCorrectOption = correctAnswer === optIndex
                        
                        return (
                          <div
                            key={optIndex}
                            className={`p-3 rounded-lg border-2 ${
                              isCorrectOption
                                ? 'bg-green-500/20 border-green-500'
                                : isSelected && !isCorrect
                                ? 'bg-red-500/20 border-red-500'
                                : isSelected
                                ? 'bg-blue-500/20 border-blue-500'
                                : 'bg-gray-700/50 border-gray-600'
                            }`}
                          >
                            <div className="flex items-center space-x-3">
                              {isCorrectOption && (
                                <FiCheck className="w-5 h-5 text-green-400" />
                              )}
                              {isSelected && !isCorrectOption && (
                                <FiX className="w-5 h-5 text-red-400" />
                              )}
                              <span className="text-white">{option}</span>
                              {isCorrectOption && (
                                <span className="ml-auto px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">
                                  Correct Answer
                                </span>
                              )}
                              {isSelected && (
                                <span className="ml-auto px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
                                  Your Answer
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AttemptDetail
