import React, { useState, useRef } from 'react'
import Sidebar from '../components/Sidebar'
import axios from 'axios'

function Notifications() {
  const [notificationTitle, setNotificationTitle] = useState('')
  const [notificationMessage, setNotificationMessage] = useState('')
  const [notificationImage, setNotificationImage] = useState(null)
  const imageInputRef = useRef(null)
  const [isSendingNotification, setIsSendingNotification] = useState(false)
  const [notificationStatus, setNotificationStatus] = useState(null)

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
  const ADMIN_API_BASE_URL = `${API_BASE_URL}/admin`

  const sendNotification = async (e) => {
    e.preventDefault()
    if (!notificationTitle.trim() || !notificationMessage.trim()) {
      setNotificationStatus({ type: 'error', message: 'Title and message are required.' })
      return
    }

    try {
      setIsSendingNotification(true)
      setNotificationStatus(null)

      const token = localStorage.getItem('adminToken')
      const config = { headers: { Authorization: token ? `Bearer ${token}` : '' } }

      const formData = new FormData()
      formData.append('title', notificationTitle.trim())
      formData.append('message', notificationMessage.trim())
      if (notificationImage) {
        formData.append('image', notificationImage)
      }
      const res = await axios.post(`${ADMIN_API_BASE_URL}/send-notification`, formData, config)

      if (res.data?.success) {
        setNotificationStatus({ type: 'success', message: 'Notification sent successfully.' })
        setNotificationTitle('')
        setNotificationMessage('')
        setNotificationImage(null)
        imageInputRef.current && (imageInputRef.current.value = '')
      } else {
        setNotificationStatus({
          type: 'error',
          message: res.data?.message || 'Failed to send notification.'
        })
      }
    } catch (error) {
      console.error('Error sending notification', error)
      setNotificationStatus({
        type: 'error',
        message:
          error?.response?.data?.message ||
          error?.message ||
          'Failed to send notification.'
      })
    } finally {
      setIsSendingNotification(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <Sidebar />
      <div className="flex-1 ml-64 h-screen overflow-y-auto scrollbar-hide">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <h1
            className="text-3xl font-bold text-white mb-4"
            style={{ fontFamily: 'Archivo Black' }}
          >
            Notifications
          </h1>
          <p className="text-gray-300 mb-6 text-sm">
            Send a push notification to all subscribed app users using OneSignal.
          </p>

          <div className="bg-gray-900/80 border border-purple-500/30 rounded-2xl p-6">
            {notificationStatus && (
              <div
                className={`mb-4 rounded-lg px-4 py-2 text-sm ${
                  notificationStatus.type === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-400/40 text-emerald-200'
                    : 'bg-red-500/10 border border-red-400/40 text-red-200'
                }`}
              >
                {notificationStatus.message}
              </div>
            )}

            <form onSubmit={sendNotification} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Title</label>
                <input
                  type="text"
                  value={notificationTitle}
                  onChange={(e) => setNotificationTitle(e.target.value)}
                  placeholder="Notification title"
                  className="w-full bg-black/40 border border-purple-500/40 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-1">Message</label>
                <textarea
                  rows={3}
                  value={notificationMessage}
                  onChange={(e) => setNotificationMessage(e.target.value)}
                  placeholder="Notification message"
                  className="w-full bg-black/40 border border-purple-500/40 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-1">Image (optional)</label>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setNotificationImage(e.target.files?.[0] || null)}
                  className="w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-purple-600 file:text-white file:text-sm hover:file:bg-purple-700"
                />
                {notificationImage && (
                  <p className="mt-1 text-xs text-emerald-400">{notificationImage.name} selected</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSendingNotification}
                className="px-6 py-2 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed text-white"
              >
                {isSendingNotification ? 'Sending...' : 'Send Notification'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Notifications

