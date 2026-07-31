import React, { useState, useRef, useEffect } from 'react'
import { createSupportOrder, verifySupportPayment } from '../services/supportPaymentService'
import { loadScript } from '../utils/loadScript'
import logo from '../assets/logo.png'
import StatusModal from '../components/SuccessModal'

const presetAmounts = [250, 500, 1000, 2000]

function Support() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    amount: presetAmounts[1],
    message: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [status, setStatus] = useState({ type: '', message: '' })
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [statusModalType, setStatusModalType] = useState('success')
  const [statusModalMessage, setStatusModalMessage] = useState('')
  const refreshTimeoutRef = useRef(null)
  const [isSuccess, setIsSuccess] = useState(false)

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
    }
  }, [])

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }))
  }

  const handleAmountSelect = (amount) => {
    setFormData((prev) => ({
      ...prev,
      amount
    }))
  }

  const resetStatus = () => {
    setStatus({ type: '', message: '' })
  }

  const handleSupport = async (event) => {
    event.preventDefault()
    resetStatus()

    if (!formData.name || !formData.email) {
      setStatus({
        type: 'error',
        message: 'Name and email are required.'
      })
      return
    }

    setIsSubmitting(true)

    try {
      await loadScript('https://checkout.razorpay.com/v1/checkout.js')

      const response = await createSupportOrder({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        amount: formData.amount,
        message: formData.message
      })

      if (!response?.success) {
        throw new Error(response?.message || 'Failed to create order')
      }

      const { data } = response

      const options = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: 'ZaiToon',
        description: 'Support Contribution',
        order_id: data.orderId,
        handler: async (paymentResponse) => {
          try {
            const verification = await verifySupportPayment(paymentResponse)

            if (verification?.success) {
              setStatus({ type: '', message: '' })
              setStatusModalType('success')
              setStatusModalMessage('Thank you! Your support payment was successful.')
              setShowStatusModal(true)
              setIsSuccess(true)
            } else {
              throw new Error(verification?.message || 'Verification failed')
            }
          } catch (error) {
            console.error('[SupportPayment] Verification failed', error)
            setStatus({
              type: 'error',
              message: error?.response?.data?.message || error?.message || 'Payment verification failed.'
            })
          }
        },
        modal: {
          ondismiss: () => {
            setStatus({
              type: 'info',
              message: 'Payment popup was closed before completion.'
            })
          }
        },
        prefill: {
          name: formData.name,
          email: formData.email,
          contact: formData.phone
        },
        notes: {
          supporter_message: formData.message
        },
        theme: {
          color: '#7C3AED'
        }
      }

      const razorpay = new window.Razorpay(options)
      razorpay.open()
    } catch (error) {
      console.error('[SupportPayment] Error initiating payment', error)
      setStatus({
        type: 'error',
        message: error?.response?.data?.message || error?.message || 'Unable to initiate payment.'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-3xl bg-gray-900/70 backdrop-blur-lg border border-purple-500/20 shadow-2xl rounded-3xl p-8 md:p-12">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-6">
            <img
              src={logo}
              alt="ZaiToon Logo"
              className="w-16 h-16 object-contain"
            />
            <div>
              <h1 className="text-4xl font-extrabold" style={{ fontFamily: 'Archivo Black' }}>
                Support ZaiToon
              </h1>
              <p className="text-gray-300 text-base mt-1">
                Your contribution helps us continue creating stories for children. Choose an amount or enter your preferred support value to proceed.
              </p>
            </div>
          </div>
        </div>

        {status.message && status.type !== 'success' && (
          <div
            className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
              status.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-400/40 text-emerald-200'
                : status.type === 'error'
                  ? 'bg-red-500/10 border-red-400/40 text-red-200'
                  : 'bg-blue-500/10 border-blue-400/40 text-blue-200'
            }`}
          >
            {status.message}
          </div>
        )}

        {!isSuccess && (
          <form onSubmit={handleSupport} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm text-gray-300 mb-2">Full Name</label>
                <input
                  type="text"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full bg-black/20 border border-purple-500/30 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
                  placeholder="Enter your name"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2">Email Address</label>
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full bg-black/20 border border-purple-500/30 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2">Phone (Optional)</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full bg-black/20 border border-purple-500/30 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
                  placeholder="Phone number"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2">Message (Optional)</label>
                <input
                  type="text"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  className="w-full bg-black/20 border border-purple-500/30 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
                  placeholder="Add a note"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-3">Support Amount (₹)</label>
              <div className="flex flex-wrap gap-3 mb-4">
                {presetAmounts.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => handleAmountSelect(amount)}
                    className={`px-5 py-2 rounded-full border transition ${
                      Number(formData.amount) === amount
                        ? 'bg-purple-600 text-white border-purple-500'
                        : 'bg-black/20 border-purple-500/30 text-gray-200 hover:border-purple-400'
                    }`}
                  >
                    ₹{amount}
                  </button>
                ))}
              </div>
              <input
                type="number"
                name="amount"
                min="1"
                value={formData.amount}
                onChange={(event) => handleChange({
                  target: {
                    name: 'amount',
                    value: Number(event.target.value)
                  }
                })}
                className="w-full bg-black/20 border border-purple-500/30 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
                placeholder="Custom amount"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed transition text-white font-semibold py-3 rounded-xl shadow-lg shadow-purple-900/40"
            >
              {isSubmitting ? 'Processing...' : 'Proceed to Pay'}
            </button>
          </form>
        )}
      </div>
      <StatusModal
        isOpen={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        type={statusModalType}
        message={statusModalMessage}
      />
    </div>
  )
}

export default Support

