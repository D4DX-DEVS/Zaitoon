import React, { useState } from 'react'
import { FiClock, FiX } from 'react-icons/fi'

/**
 * HighlightDurationPicker
 *
 * Shown when the admin sets highlight = "Enable".
 * Lets them choose how long the content stays highlighted.
 *
 * Props:
 *   value        {string}   – ISO string of the expiry date/time, '' = no expiry
 *   onChange     {function} – called with new ISO string (or '' to clear)
 */

const PRESETS = [
  { label: '1 Hour',  hours: 1 },
  { label: '6 Hours', hours: 6 },
  { label: '16 Hours', hours: 16 },
  { label: '1 Day',   hours: 24 },
  { label: '2 Days',  hours: 48 },
  { label: '3 Days',  hours: 72 },
  { label: 'Custom',  hours: null },
]

function addHours(h) {
  const d = new Date(Date.now() + h * 3600 * 1000)
  return d.toISOString()
}

function toLocalDatetimeValue(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  if (isNaN(d.getTime())) return ''
  // YYYY-MM-DDTHH:mm
  return d.toISOString().slice(0, 16)
}

function nowMin() {
  const d = new Date(Date.now() + 60_000)
  d.setSeconds(0, 0)
  return d.toISOString().slice(0, 16)
}

export default function HighlightDurationPicker({ value, onChange }) {
  // Determine which preset is currently selected (or 'custom' / 'none')
  const [mode, setMode] = useState(() => {
    if (!value) return 'none'
    return 'custom'
  })

  const handlePreset = (preset) => {
    if (preset.hours === null) {
      setMode('custom')
      // Keep existing value or clear
    } else {
      setMode(`h${preset.hours}`)
      onChange(addHours(preset.hours))
    }
  }

  const handleCustomChange = (e) => {
    onChange(e.target.value ? new Date(e.target.value).toISOString() : '')
  }

  const handleClear = () => {
    setMode('none')
    onChange('')
  }

  const activePreset = PRESETS.find(p => p.hours !== null && mode === `h${p.hours}`)

  return (
    <div className="mt-3 rounded-xl border border-yellow-500/30 bg-yellow-950/20 p-4">
      <div className="flex items-center gap-2 mb-3">
        <FiClock className="text-yellow-400 w-4 h-4 shrink-0" />
        <span className="text-sm font-medium text-white">Highlight Duration</span>
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="ml-auto text-gray-400 hover:text-white transition-colors"
            title="Remove expiry (highlight indefinitely)"
          >
            <FiX className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Preset buttons */}
      <div className="flex flex-wrap gap-2 mb-3">
        {PRESETS.map((preset) => {
          const isActive =
            preset.hours === null
              ? mode === 'custom'
              : mode === `h${preset.hours}`
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => handlePreset(preset)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                isActive
                  ? 'bg-yellow-500 text-black'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
              }`}
            >
              {preset.label}
            </button>
          )
        })}
      </div>

      {/* Custom datetime input */}
      {mode === 'custom' && (
        <input
          type="datetime-local"
          value={toLocalDatetimeValue(value)}
          min={nowMin()}
          onChange={handleCustomChange}
          style={{ colorScheme: 'dark' }}
          className="w-full rounded-lg border border-yellow-500/40 bg-gray-900 px-3 py-2 text-sm text-white focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
        />
      )}

      {/* Summary */}
      {value && (
        <p className="mt-2 text-xs text-yellow-400/80">
          Highlight expires:{' '}
          {new Date(value).toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </p>
      )}
      {!value && (
        <p className="text-xs text-gray-500 mt-1">
          No duration set — highlight stays active indefinitely.
        </p>
      )}
    </div>
  )
}
