import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/login'
import Dashboard from './pages/dashboard'
import SingleStory from './pages/singleStory'
import Stories from './pages/stories'
import Videos from './pages/videos'
import KidsSubmission from './pages/kidsSubmission'
import Support from './pages/support'
import BrightBox from './pages/brightBox'
import Puzzles from './pages/puzzles'
import Banners from './pages/banners'
import PaymentBanner from './pages/paymentBanner'
import Quizzes from './pages/quizzes'
import Questions from './pages/questions'
import Leaderboard from './pages/leaderboard'
import QuizManagement from './pages/quizManagement'
import QuizAttempts from './pages/quizAttempts'
import AttemptDetail from './pages/attemptDetail'
import QuizTest from './pages/quizTest'
import Notifications from './pages/notifications'
import Activity from './pages/activity'
import Scheduled from './pages/scheduled'
import StoryPuzzle from './pages/storyPuzzle'
import Coloring from './pages/coloring'
import Gallery from './pages/gallery'
import Analytics from './pages/analytics'
import HomeBanner from './pages/homeBanner'
import Notices from './pages/notices'
import Subscriptions from './pages/subscriptions'
import Settings from './pages/settings'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check if user is authenticated on app load
    const token = localStorage.getItem('adminToken')
    setIsAuthenticated(!!token)
    setIsLoading(false)
  }, [])

  // Listen for storage changes (when login sets token)
  useEffect(() => {
    const handleStorageChange = () => {
      const token = localStorage.getItem('adminToken')
      setIsAuthenticated(!!token)
    }

    window.addEventListener('storage', handleStorageChange)
    
    // Also listen for custom events (for same-tab updates)
    window.addEventListener('authStateChange', handleStorageChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('authStateChange', handleStorageChange)
    }
  }, [])

  // Force re-check authentication state when navigating
  useEffect(() => {
    const handleRouteChange = () => {
      const token = localStorage.getItem('adminToken')
      setIsAuthenticated(!!token)
    }

    // Listen for popstate events (back/forward navigation)
    window.addEventListener('popstate', handleRouteChange)
    
    return () => {
      window.removeEventListener('popstate', handleRouteChange)
    }
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
          <p className="text-gray-400 mt-4">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route 
          path="/dashboard" 
          element={
            isAuthenticated ? 
            <Dashboard /> : 
            <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/single-stories" 
          element={
            isAuthenticated ? 
            <SingleStory /> : 
            <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/stories" 
          element={
            isAuthenticated ? 
            <Stories /> : 
            <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/videos" 
          element={
            isAuthenticated ? 
            <Videos /> : 
            <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/kids-submissions" 
          element={
            isAuthenticated ? 
            <KidsSubmission /> : 
            <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/bright-box" 
          element={
            isAuthenticated ? 
            <BrightBox /> : 
            <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/puzzles" 
          element={
            isAuthenticated ? 
            <Puzzles /> : 
            <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/banners" 
          element={
            isAuthenticated ? 
            <Banners /> : 
            <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/payment-banner" 
          element={
            isAuthenticated ? 
            <PaymentBanner /> : 
            <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/quizzes" 
          element={
            isAuthenticated ? 
            <Quizzes /> : 
            <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/questions" 
          element={
            isAuthenticated ? 
            <Questions /> : 
            <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/leaderboard" 
          element={
            isAuthenticated ? 
            <Leaderboard /> : 
            <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/quiz-management" 
          element={
            isAuthenticated ? 
            <QuizManagement /> : 
            <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/quiz-attempts" 
          element={
            isAuthenticated ? 
            <QuizAttempts /> : 
            <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/quiz-attempts/:attemptId" 
          element={
            isAuthenticated ? 
            <AttemptDetail /> : 
            <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/notifications" 
          element={
            isAuthenticated ? 
            <Notifications /> : 
            <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/notices" 
          element={
            isAuthenticated ? 
            <Notices /> : 
            <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/analytics" 
          element={
            isAuthenticated ? 
            <Analytics /> : 
            <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/activity" 
          element={
            isAuthenticated ? 
            <Activity /> : 
            <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/story-puzzle" 
          element={
            isAuthenticated ? 
            <StoryPuzzle /> : 
            <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/coloring" 
          element={
            isAuthenticated ? 
            <Coloring /> : 
            <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/gallery" 
          element={
            isAuthenticated ? 
            <Gallery /> : 
            <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/home-banner" 
          element={
            isAuthenticated ? 
            <HomeBanner /> : 
            <Navigate to="/login" replace />
          } 
        />
        <Route path="/support" element={<Support />} />
        <Route
          path="/subscriptions"
          element={isAuthenticated ? <Subscriptions /> : <Navigate to="/login" replace />}
        />
        <Route path="/quiz-test" element={<QuizTest />} />
        <Route 
          path="/scheduled" 
          element={
            isAuthenticated ? 
            <Scheduled /> : 
            <Navigate to="/login" replace />
          } 
        />
        <Route
          path="/settings"
          element={
            isAuthenticated ?
            <Settings /> :
            <Navigate to="/login" replace />
          }
        />
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  )
}

export default App
