import React, { useEffect, useState } from 'react'
import { FiAlertTriangle } from 'react-icons/fi'

/**
 * Clear one quiz's leaderboard. The two switches are independent:
 *   - deleting attempts permanently removes this quiz's own scores
 *   - clearing carry-overs only unlinks previous quizzes, deleting nothing
 *
 * Nothing is pre-checked and Clear stays disabled until a box is ticked,
 * because there is no backup and no undo behind this dialog.
 */
function ClearQuizPointsModal({
  isOpen,
  quiz,
  attemptCount = 0,
  countLoading = false,
  referencedBy = 0,
  onClose,
  onConfirm
}) {
  const [deleteAttempts, setDeleteAttempts] = useState(false)
  const [clearCarryOver, setClearCarryOver] = useState(false)

  // Reset every time the dialog opens so choices never carry between quizzes.
  useEffect(() => {
    if (isOpen) {
      setDeleteAttempts(false)
      setClearCarryOver(false)
    }
  }, [isOpen, quiz?._id])

  if (!isOpen || !quiz) return null

  const carryOverCount = (quiz.includedQuizIds || []).length
  const canConfirm = deleteAttempts || clearCarryOver

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10001] flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl p-6 shadow-2xl border border-gray-700 max-w-md w-full mx-4">
        <div className="flex items-center gap-2 mb-1">
          <FiAlertTriangle className="w-5 h-5 text-amber-400" />
          <h3 className="text-white text-lg font-semibold" style={{ fontFamily: 'Archivo Black' }}>
            Clear Leaderboard
          </h3>
        </div>
        <p className="text-gray-400 text-sm mb-5">{quiz.title}</p>

        <div className="space-y-3">
          <label
            className={`flex items-start gap-3 p-3 rounded-lg border ${
              attemptCount === 0 || countLoading
                ? 'border-gray-800 bg-gray-800/40 opacity-50 cursor-not-allowed'
                : 'border-gray-700 bg-gray-800 hover:border-gray-600 cursor-pointer'
            }`}
          >
            <input
              type="checkbox"
              className="mt-1"
              disabled={attemptCount === 0 || countLoading}
              checked={deleteAttempts}
              onChange={(e) => setDeleteAttempts(e.target.checked)}
            />
            <div>
              <p className="text-white text-sm">
                Delete this quiz&apos;s attempts
                {countLoading ? ' (counting...)' : ` (${attemptCount})`}
              </p>
              <p className="text-gray-400 text-xs">
                Permanently removes the scores people earned on this quiz. Cannot be undone.
              </p>
            </div>
          </label>

          <label
            className={`flex items-start gap-3 p-3 rounded-lg border ${
              carryOverCount === 0
                ? 'border-gray-800 bg-gray-800/40 opacity-50 cursor-not-allowed'
                : 'border-gray-700 bg-gray-800 hover:border-gray-600 cursor-pointer'
            }`}
          >
            <input
              type="checkbox"
              className="mt-1"
              disabled={carryOverCount === 0}
              checked={clearCarryOver}
              onChange={(e) => setClearCarryOver(e.target.checked)}
            />
            <div>
              <p className="text-white text-sm">Remove carried-over quizzes ({carryOverCount})</p>
              <p className="text-gray-400 text-xs">
                Stops borrowed points from showing. Deletes nothing — you can re-select them later.
              </p>
            </div>
          </label>
        </div>

        {deleteAttempts && referencedBy > 0 && (
          <p className="mt-4 text-red-400 text-xs">
            {referencedBy} other quiz{referencedBy === 1 ? '' : 'zes'} carr{referencedBy === 1 ? 'ies' : 'y'} over
            from this one. Deleting these attempts also removes these points from their boards.
          </p>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium"
          >
            Cancel
          </button>
          <button
            disabled={!canConfirm}
            onClick={() => onConfirm({ deleteAttempts, clearCarryOver })}
            className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  )
}

export default ClearQuizPointsModal
