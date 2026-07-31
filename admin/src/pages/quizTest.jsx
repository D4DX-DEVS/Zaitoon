import React, { useState, useEffect } from 'react'
import axios from 'axios'

function QuizTest() {
  // API_BASE_URL from env (likely includes /api already, like other pages)
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'
  
  const [step, setStep] = useState('login') // login, details, quiz, result
  const [email, setEmail] = useState('')
  const [userToken, setUserToken] = useState('')
  const [user, setUser] = useState(null)
  // Attendee details for leaderboard (collected before quiz)
  const [attendeeName, setAttendeeName] = useState('')
  const [attendeeEmail, setAttendeeEmail] = useState('')
  const [attendeeClass, setAttendeeClass] = useState('')
  const [attendeePhone, setAttendeePhone] = useState('')
  const [quiz, setQuiz] = useState(null)
  const [answers, setAnswers] = useState({})
  const [durations, setDurations] = useState({})
  const [language, setLanguage] = useState('en')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [attemptResult, setAttemptResult] = useState(null)
  const [startTime, setStartTime] = useState(null)

  // Check if user is already logged in
  useEffect(() => {
    const token = localStorage.getItem('userToken')
    const userData = localStorage.getItem('userData')
    if (token && userData) {
      const u = JSON.parse(userData)
      setUserToken(token)
      setUser(u)
      setAttendeeName(u.name || '')
      setAttendeeEmail(u.email || '')
      setAttendeeClass(u.class || '')
      setAttendeePhone(u.phone || '')
      setStep('details')
    }
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await axios.post(`${API_BASE_URL}/users/login`, { email })
      if (response.data.success) {
        const u = response.data.user
        setUserToken(response.data.token)
        setUser(u)
        setAttendeeName(u.name || '')
        setAttendeeEmail(u.email || email)
        setAttendeeClass(u.class || '')
        setAttendeePhone(u.phone || '')
        localStorage.setItem('userToken', response.data.token)
        localStorage.setItem('userData', JSON.stringify(response.data.user))
        setStep('details')
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const loadQuiz = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await axios.get(`${API_BASE_URL}/quizzes/today`)
      if (response.data.success) {
        setQuiz(response.data.data)
        setStartTime(Date.now())
        // Initialize answer state
        const initialAnswers = {}
        const initialDurations = {}
        response.data.data.questions.forEach((q, idx) => {
          initialAnswers[q._id] = null
          initialDurations[q._id] = 0
        })
        setAnswers(initialAnswers)
        setDurations(initialDurations)
      } else {
        setError('No quiz available for today')
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load quiz')
    } finally {
      setLoading(false)
    }
  }

  const handleAnswerChange = (questionId, answerIndex) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answerIndex
    }))
    
    // Track time spent on this question
    if (!durations[questionId]) {
      setDurations(prev => ({
        ...prev,
        [questionId]: 0
      }))
    }
  }

  const handleSubmit = async () => {
    if (!quiz) return

    // Check if all questions are answered
    const unanswered = quiz.questions.filter(q => answers[q._id] === null || answers[q._id] === undefined)
    if (unanswered.length > 0) {
      setError(`Please answer all ${unanswered.length} remaining question(s)`)
      return
    }

    setLoading(true)
    setError('')

    try {
      // Calculate durations (simple: time since start / number of questions)
      const totalTime = (Date.now() - startTime) / 1000 // seconds
      const avgTimePerQuestion = totalTime / quiz.questions.length

      const answersArray = quiz.questions.map(q => ({
        questionId: q._id,
        attemptedAnswer: answers[q._id],
        duration: durations[q._id] || avgTimePerQuestion
      }))

      const response = await axios.post(
        `${API_BASE_URL}/quizzes/${quiz._id}/attempt`,
        {
          language,
          answers: answersArray,
          name: attendeeName.trim(),
          email: attendeeEmail.trim(),
          class: attendeeClass.trim(),
          phone: attendeePhone.trim()
        },
        {
          headers: {
            ...(userToken ? { 'Authorization': `Bearer ${userToken}` } : {}),
            'Content-Type': 'application/json'
          }
        }
      )

      if (response.data.success) {
        setAttemptResult(response.data.data)
        setStep('result')
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to submit quiz'
      console.error('Quiz submission error:', err.response?.data || err)
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('userToken')
    localStorage.removeItem('userData')
    setUserToken('')
    setUser(null)
    setAttendeeName('')
    setAttendeeEmail('')
    setAttendeeClass('')
    setAttendeePhone('')
    setQuiz(null)
    setAnswers({})
    setAttemptResult(null)
    setStep('login')
  }

  const handleStartQuiz = async () => {
    if (!attendeeName.trim()) {
      setError('Please enter your name')
      return
    }
    if (!attendeeEmail.trim()) {
      setError('Please enter your email')
      return
    }
    if (!attendeeClass.trim()) {
      setError('Please enter your class')
      return
    }
    if (!attendeePhone.trim()) {
      setError('Please enter your phone number')
      return
    }
    setError('')
    setLoading(true)
    try {
      await loadQuiz()
      setStep('quiz')
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load quiz')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <h1 className="text-3xl font-bold text-white mb-6 text-center">Quiz Test Login</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-white/90 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-400"
                placeholder="Enter your email"
                required
              />
              <p className="text-white/70 text-sm mt-1">Enter any email to test (user will be auto-created)</p>
            </div>
            {error && <p className="text-red-300 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (step === 'details') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <h1 className="text-3xl font-bold text-white mb-2 text-center">Your details</h1>
          <p className="text-white/70 text-sm text-center mb-6">These will appear on the leaderboard</p>
          <div className="space-y-4">
            <div>
              <label className="block text-white/90 mb-2">Name</label>
              <input
                type="text"
                value={attendeeName}
                onChange={(e) => setAttendeeName(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-400"
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="block text-white/90 mb-2">Email</label>
              <input
                type="email"
                value={attendeeEmail}
                onChange={(e) => setAttendeeEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-400"
                placeholder="your@email.com"
              />
            </div>
            <div>
              <label className="block text-white/90 mb-2">Class</label>
              <input
                type="text"
                value={attendeeClass}
                onChange={(e) => setAttendeeClass(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-400"
                placeholder="e.g. 10A"
              />
            </div>
            <div>
              <label className="block text-white/90 mb-2">Phone number <span className="text-red-300">*</span></label>
              <input
                type="tel"
                value={attendeePhone}
                onChange={(e) => setAttendeePhone(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-400"
                placeholder="e.g. +91 9876543210"
                required
              />
            </div>
            {error && <p className="text-red-300 text-sm">{error}</p>}
            <button
              type="button"
              onClick={handleStartQuiz}
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
            >
              {loading ? 'Loading quiz...' : 'Start Quiz'}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full bg-white/20 hover:bg-white/30 text-white font-medium py-2 rounded-lg transition"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'quiz' && quiz) {
    const currentQuestions = language === 'en' 
      ? quiz.questions.map(q => ({ ...q, questionText: q.questionText, options: q.options }))
      : quiz.questions.map(q => ({ ...q, questionText: q.mlQuestionText, options: q.mlOptions }))

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-6 mb-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-white">{quiz.title}</h1>
                <p className="text-white/70 mt-1">{quiz.questions.length} Questions</p>
              </div>
              <div className="flex gap-4 items-center">
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                >
                  <option value="en">English</option>
                  <option value="ml">Malayalam</option>
                </select>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
                >
                  Logout
                </button>
              </div>
            </div>
            {user && (
              <p className="text-white/70 mt-2">Logged in as: {user.name} ({user.email})</p>
            )}
          </div>

          {/* Questions */}
          <div className="space-y-6">
            {currentQuestions.map((question, index) => (
              <div key={question._id} className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-xl p-6">
                <div className="flex items-start gap-4">
                  <div className="bg-purple-600 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold flex-shrink-0">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-white mb-4">{question.questionText}</h3>
                    <div className="space-y-2">
                      {question.options.map((option, optIndex) => (
                        <label
                          key={optIndex}
                          className={`block p-4 rounded-lg cursor-pointer transition ${
                            answers[question._id] === optIndex
                              ? 'bg-purple-600 text-white'
                              : 'bg-white/20 text-white hover:bg-white/30'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`question-${question._id}`}
                            value={optIndex}
                            checked={answers[question._id] === optIndex}
                            onChange={() => handleAnswerChange(question._id, optIndex)}
                            className="sr-only"
                          />
                          <span className="flex items-center gap-2">
                            <span className="font-semibold">{String.fromCharCode(65 + optIndex)}.</span>
                            {option}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Submit Button */}
          <div className="mt-8 bg-white/10 backdrop-blur-lg rounded-2xl shadow-xl p-6">
            {error && <p className="text-red-300 mb-4">{error}</p>}
            <button
              onClick={handleSubmit}
              disabled={loading || Object.values(answers).some(a => a === null || a === undefined)}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed text-lg"
            >
              {loading ? 'Submitting...' : 'Submit Quiz'}
            </button>
            <p className="text-white/70 text-sm mt-2 text-center">
              {Object.values(answers).filter(a => a !== null && a !== undefined).length} / {quiz.questions.length} answered
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'result' && attemptResult) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 w-full max-w-2xl">
          <h1 className="text-3xl font-bold text-white mb-6 text-center">Quiz Results</h1>
          
          <div className="space-y-6">
            <div className="bg-white/20 rounded-lg p-6 text-center">
              <div className="text-6xl font-bold text-green-400 mb-2">{attemptResult.score} / {attemptResult.questions.length}</div>
              <div className="text-2xl font-semibold text-white">{attemptResult.percentage}%</div>
              <div className="text-white/70 mt-2">Total Duration: {Math.round(attemptResult.totalDuration)}s</div>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white">Question Review</h2>
              {attemptResult.questions.map((q, idx) => {
                const answer = attemptResult.answers[idx]
                const isCorrect = answer.isCorrect
                const questionText = language === 'en' ? q.question_en : q.question_ml
                const options = language === 'en' 
                  ? JSON.parse(q.options_en) 
                  : JSON.parse(q.options_ml)

                return (
                  <div key={idx} className={`p-4 rounded-lg ${isCorrect ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                    <div className="flex items-start gap-3">
                      <span className={`text-2xl ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                        {isCorrect ? '✓' : '✗'}
                      </span>
                      <div className="flex-1">
                        <p className="text-white font-semibold mb-2">{questionText}</p>
                        <div className="space-y-1">
                          {options.map((opt, optIdx) => (
                            <div
                              key={optIdx}
                              className={`text-sm ${
                                optIdx === answer.attemptedAnswer
                                  ? isCorrect ? 'text-green-300 font-bold' : 'text-red-300 font-bold'
                                  : optIdx === q.correct_answer
                                  ? 'text-yellow-300'
                                  : 'text-white/70'
                              }`}
                            >
                              {String.fromCharCode(65 + optIdx)}. {opt}
                              {optIdx === answer.attemptedAnswer && ' (Your Answer)'}
                              {optIdx === q.correct_answer && !isCorrect && ' (Correct Answer)'}
                            </div>
                          ))}
                        </div>
                        <p className="text-white/50 text-xs mt-2">Time: {Math.round(answer.duration)}s</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => {
                  setStep('quiz')
                  setAttemptResult(null)
                  loadQuiz()
                }}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-lg transition"
              >
                Try Again
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 rounded-lg transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
      <div className="text-white text-center">
        {loading && <p>Loading...</p>}
        {!quiz && !loading && <p>No quiz available</p>}
      </div>
    </div>
  )
}

export default QuizTest
