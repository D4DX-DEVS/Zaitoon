import React from 'react'
import { FiClock, FiCalendar, FiX } from 'react-icons/fi'

/**
 * SchedulePicker
 *
 * A reusable toggle + datetime picker for scheduling content uploads.
 *
 * Props:
 *   enabled        {boolean}  – whether scheduling is active
 *   onToggle       {function} – called with the new boolean when toggled
 *   scheduledAt    {string}   – ISO datetime string value ('' when not set)
 *   onDateChange   {function} – called with new datetime string
 *   label          {string}   – optional custom label (default "Schedule Upload")
 */
export default function SchedulePicker({
  enabled,
  onToggle,
  scheduledAt,
  onDateChange,
  label = 'Schedule Upload'
}) {
  // Build a local datetime string rounded to the nearest minute for the min attribute
  const nowMin = () => {
    const d = new Date(Date.now() + 60_000)
    d.setSeconds(0, 0)
    // Format: YYYY-MM-DDTHH:mm
    return d.toISOString().slice(0, 16)
  }

  return (
    <div className="mt-4 rounded-xl border border-dashed border-purple-500/40 bg-purple-950/20 p-4">
      {/* Toggle row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FiClock className="text-purple-400 w-4 h-4" />
          <span className="text-sm font-medium text-white">{label}</span>
        </div>

        {/* Toggle switch */}
        <button
          type="button"
          onClick={() => onToggle(!enabled)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${
            enabled ? 'bg-purple-600' : 'bg-gray-600'
          }`}
          aria-pressed={enabled}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Datetime picker — shown only when enabled */}
      {enabled && (
        <div className="mt-3 flex items-center gap-2">
          <FiCalendar className="text-purple-400 w-4 h-4 shrink-0" />
          <input
            type="datetime-local"
            value={scheduledAt}
            min={nowMin()}
            onChange={(e) => onDateChange(e.target.value)}
            required
            className="flex-1 rounded-lg border border-purple-500/40 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
          {scheduledAt && (
            <button
              type="button"
              onClick={() => onDateChange('')}
              className="text-gray-400 hover:text-white transition-colors"
              title="Clear"
            >
              <FiX className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {enabled && !scheduledAt && (
        <p className="mt-2 text-xs text-yellow-400/80">
          Please select a date and time to schedule this upload.
        </p>
      )}

      {enabled && scheduledAt && (
        <p className="mt-2 text-xs text-green-400/80">
          Will be published on{' '}
          {new Date(scheduledAt).toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short'
          })}
        </p>
      )}
    </div>
  )
}
