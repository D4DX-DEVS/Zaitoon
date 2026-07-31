import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import logo from '../assets/logo.png'
import dxLogoWhite from '../assets/dxLogoWhite.png'

function Login() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL


  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
    // Clear error when user starts typing
    if (error) setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await axios.post(`${API_BASE_URL}/admin/login`, {
        username: formData.username,
        password: formData.password
      })

      if (response.data.success) {
        // Store token in localStorage
        localStorage.setItem('adminToken', response.data.token)
        localStorage.setItem('adminUser', JSON.stringify(response.data.admin))
        
        // Dispatch custom event to notify App component of auth state change
        window.dispatchEvent(new Event('authStateChange'))
        
        // Navigate to dashboard
        navigate('/dashboard')
      } else {
        setError('Login failed. Please check your credentials.')
      }
    } catch (err) {
      if (err.response?.data?.message) {
        setError(err.response.data.message)
      } else if (err.response?.status === 404) {
        setError('API endpoint not found. Please check if the backend server is running.')
      } else if (err.code === 'ERR_NETWORK') {
        setError('Network error. Please check if the backend server is running on port 5000.')
      } else {
        setError('Login failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div 
      className="min-h-screen flex relative"
      style={{
        background: 'radial-gradient(ellipse at 75% 50%, #AC28DC 0%, #7E1EB7 20%, #501392 45%, #000000 100%)'
      }}
    >
      {/* Left Half - Logo */}
      <div className="w-1/2 flex items-center justify-center">
        <img 
          src={logo} 
          alt="Zai Toon Logo" 
          className="h-64 w-auto"
        />
      </div>

      {/* Right Half - Login Form */}
      <div className="w-1/2 flex items-center justify-start px-8">
        <div className="w-full max-w-sm">
          {/* Welcome Back Text */}
          <div className="text-left mb-8">
            <h1 
              style={{
                fontFamily: 'Archivo Black',
                fontWeight: 400,
                fontStyle: 'normal',
                fontSize: '32px',
                lineHeight: '38px',
                letterSpacing: '-0.41px',
                textAlign: 'left',
                color: 'white'
              }}
            >
              Welcome Back!
            </h1>
          </div>
          
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Error Message */}
            {error && (
              <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-3 rounded-full text-sm">
                {error}
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="bg-green-500/20 border border-green-500/50 text-green-300 px-4 py-3 rounded-full text-sm">
                {success}
              </div>
            )}

            <div className="space-y-6">
              {/* Username Field */}
              <div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={formData.username}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-full text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition duration-200"
                  placeholder="Enter your username"
                />
              </div>

              {/* Password Field */}
              <div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-full text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition duration-200"
                  placeholder="Enter your password"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-center pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-32 flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-full text-black bg-white hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                    Signing in...
                  </div>
                ) : (
                  'Sign in'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Bottom Center - Powered By D4DX */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center space-x-3">
        <span 
          className="text-white text-sm font-medium opacity-80"
          style={{
            fontFamily: 'Archivo Black',
            fontWeight: 400,
            letterSpacing: '0.5px'
          }}
        >
          POWERED BY
        </span>
        <img 
          src={dxLogoWhite} 
          alt="D4DX Logo" 
          className="h-8 w-auto opacity-90 hover:opacity-100 transition-opacity duration-200"
        />
      </div>
    </div>
  )
}

export default Login
