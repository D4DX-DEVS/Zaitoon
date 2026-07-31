import React, { useEffect, useState } from 'react'

function StatusModal({ isOpen, onClose, type = 'success', message = "Operation completed successfully!", onConfirm = null, onCancel = null, confirmText = 'Delete', confirmClass = 'bg-red-600 hover:bg-red-700' }) {
  const [showAnimation, setShowAnimation] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setShowAnimation(true)
      
      // Only auto-close for success and error, not for loading or confirmation
      if (type !== 'loading' && type !== 'confirmation') {
        const timer = setTimeout(() => {
          setShowAnimation(false)
          setTimeout(onClose, 300) // Close after animation completes
        }, 2000) // Show for 2 seconds

        return () => clearTimeout(timer)
      }
    }
  }, [isOpen, onClose, type])

  if (!isOpen) return null

  const getIcon = () => {
    switch (type) {
      case 'loading':
        return (
          <div className="w-20 h-20 rounded-full border-4 border-purple-500 bg-purple-500/20 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
          </div>
        )
      case 'error':
        return (
          <div className={`w-20 h-20 rounded-full border-4 transition-all duration-500 ${
            showAnimation 
              ? 'border-red-500 bg-red-500/20 scale-100' 
              : 'border-gray-600 bg-transparent scale-75'
          }`}>
            <svg 
              className={`w-full h-full p-4 transition-all duration-700 ${
                showAnimation ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
              }`}
              viewBox="0 0 24 24" 
              fill="none"
            >
              <path
                d="M18 6L6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-white"
              />
            </svg>
          </div>
        )
      case 'confirmation':
        return (
          <div className={`w-20 h-20 rounded-full border-4 transition-all duration-500 ${
            showAnimation 
              ? 'border-yellow-500 bg-yellow-500/20 scale-100' 
              : 'border-gray-600 bg-transparent scale-75'
          }`}>
            <svg 
              className={`w-full h-full p-4 transition-all duration-700 ${
                showAnimation ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
              }`}
              viewBox="0 0 24 24" 
              fill="none"
            >
              <path
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-white"
              />
            </svg>
          </div>
        )
      case 'success':
      default:
        return (
          <div className={`w-20 h-20 rounded-full border-4 transition-all duration-500 ${
            showAnimation 
              ? 'border-purple-500 bg-purple-500/20 scale-100' 
              : 'border-gray-600 bg-transparent scale-75'
          }`}>
            <svg 
              className={`w-full h-full p-4 transition-all duration-700 ${
                showAnimation ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
              }`}
              viewBox="0 0 24 24" 
              fill="none"
            >
              <path
                d="M9 12L11 14L15 10"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-white"
              />
            </svg>
          </div>
        )
    }
  }

  const getTitle = () => {
    switch (type) {
      case 'loading':
        return 'Processing...'
      case 'error':
        return 'Error!'
      case 'confirmation':
        return 'Confirm Action'
      case 'success':
      default:
        return 'Success!'
    }
  }

  const getProgressColor = () => {
    switch (type) {
      case 'loading':
        return 'from-purple-500 to-purple-600'
      case 'error':
        return 'from-red-500 to-red-600'
      case 'confirmation':
        return 'from-yellow-500 to-yellow-600'
      case 'success':
      default:
        return 'from-purple-500 to-purple-600'
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10001] flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl p-8 shadow-2xl border border-gray-700 max-w-sm w-full mx-4">
        <div className="flex flex-col items-center">
          {/* Icon Container */}
          <div className="relative mb-6">
            {getIcon()}
            
            {/* Pulse Effect for success, error, and confirmation */}
            {(type === 'success' || type === 'error' || type === 'confirmation') && showAnimation && (
              <div className={`absolute inset-0 w-20 h-20 rounded-full border-4 ${
                type === 'success' ? 'border-purple-400' : 
                type === 'error' ? 'border-red-400' : 
                'border-yellow-400'
              } animate-ping opacity-20`}></div>
            )}
          </div>

          {/* Title */}
          <h3 
            className={`text-white text-xl font-semibold mb-2 text-center transition-all duration-500 ${
              showAnimation ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
            style={{ fontFamily: 'Archivo Black' }}
          >
            {getTitle()}
          </h3>
          
          {/* Message */}
          <p 
            className={`text-gray-300 text-sm text-center transition-all duration-700 delay-200 ${
              showAnimation ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            {message}
          </p>

          {/* Confirmation Buttons */}
          {type === 'confirmation' && (
            <div className={`flex space-x-4 mt-6 transition-all duration-700 delay-300 ${
              showAnimation ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              <button
                onClick={() => {
                  if (onCancel) onCancel()
                  onClose()
                }}
                className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition duration-200 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (onConfirm) onConfirm()
                  onClose()
                }}
                className={`px-6 py-2 text-white rounded-lg transition duration-200 font-medium ${confirmClass}`}
              >
                {confirmText}
              </button>
            </div>
          )}

          {/* Progress Bar - only show for success and error states */}
          {(type === 'success' || type === 'error') && (
            <div className="w-full bg-gray-700 rounded-full h-1 mt-6 overflow-hidden">
              <div 
                className={`h-full bg-gradient-to-r ${getProgressColor()} rounded-full transition-all duration-2000 ease-linear ${
                  showAnimation ? 'w-full' : 'w-0'
                }`}
              ></div>
            </div>
          )}

          {/* Loading Progress Bar */}
          {type === 'loading' && (
            <div className="w-full bg-gray-700 rounded-full h-1 mt-6 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full animate-pulse"
                style={{ width: '100%' }}
              ></div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default StatusModal
