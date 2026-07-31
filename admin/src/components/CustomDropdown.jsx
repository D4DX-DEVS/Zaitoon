import React, { useState, useRef, useEffect } from 'react'
import { FiChevronDown, FiCheck } from 'react-icons/fi'

function CustomDropdown({ 
  options = [], 
  value = '', 
  onChange = () => {}, 
  placeholder = 'Select an option...',
  className = '',
  disabled = false
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const dropdownRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
        setSearchTerm('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Filter options based on search term
  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Get selected option
  const selectedOption = options.find(option => option.value === value)

  const handleSelect = (option) => {
    onChange(option.value)
    setIsOpen(false)
    setSearchTerm('')
  }

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen)
      if (!isOpen) {
        setSearchTerm('')
      }
    }
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Dropdown Button */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={`w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-2xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200 flex items-center justify-between ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-purple-800/20'
        }`}
      >
        <span className={selectedOption ? 'text-white' : 'text-gray-400'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <FiChevronDown 
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`} 
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900/95 backdrop-blur-lg border border-gray-600/50 rounded-2xl shadow-2xl z-50 max-h-60 overflow-hidden">
          {/* Search Input */}
          {options.length > 5 && (
            <div className="p-3 border-b border-gray-700/50">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search options..."
                className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200"
                autoFocus
              />
            </div>
          )}

          {/* Options List */}
          <div className="max-h-48 overflow-y-auto scrollbar-hide scroll-smooth">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option)}
                  className={`w-full px-4 py-3 text-left text-sm transition duration-200 flex items-center justify-between ${
                    value === option.value
                      ? 'bg-purple-600/20 text-purple-300 border-l-4 border-purple-500'
                      : 'text-gray-300 hover:bg-purple-800/30 hover:text-purple-200'
                  }`}
                >
                  <span>{option.label}</span>
                  {value === option.value && (
                    <FiCheck className="w-4 h-4 text-purple-400" />
                  )}
                </button>
              ))
            ) : (
              <div className="px-4 py-3 text-gray-400 text-sm text-center">
                No options found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default CustomDropdown
