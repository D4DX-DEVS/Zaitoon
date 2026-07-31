import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

export const createSupportOrder = async (payload) => {
  console.log('[SupportPayment] Creating support order', payload)
  const response = await axios.post(`${API_BASE_URL}/support/create-order`, payload)
  console.log('[SupportPayment] Support order response', response.data)
  return response.data
}

export const verifySupportPayment = async (payload) => {
  console.log('[SupportPayment] Verifying support payment', payload)
  const response = await axios.post(`${API_BASE_URL}/support/verify`, payload)
  console.log('[SupportPayment] Verify response', response.data)
  return response.data
}

