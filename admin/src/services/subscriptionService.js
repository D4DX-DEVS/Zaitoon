import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

function getAuthHeaders() {
  const token = localStorage.getItem('adminToken')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const jsonHeaders = () => ({ 'Content-Type': 'application/json', ...getAuthHeaders() })

/* ------------------------------ Plans -------------------------------- */

export const getPlans = async () => {
  const response = await axios.get(`${API_BASE_URL}/subscriptions/admin/plans`, {
    headers: jsonHeaders()
  })
  return response.data
}

export const createPlan = async (payload) => {
  const response = await axios.post(`${API_BASE_URL}/subscriptions/admin/plans`, payload, {
    headers: jsonHeaders()
  })
  return response.data
}

export const updatePlan = async (id, payload) => {
  const response = await axios.put(`${API_BASE_URL}/subscriptions/admin/plans/${id}`, payload, {
    headers: jsonHeaders()
  })
  return response.data
}

export const deletePlan = async (id) => {
  const response = await axios.delete(`${API_BASE_URL}/subscriptions/admin/plans/${id}`, {
    headers: jsonHeaders()
  })
  return response.data
}

/* -------------------------- Subscriptions ---------------------------- */

export const getSubscriptions = async ({ page = 1, limit = 20, status = '', search = '' } = {}) => {
  const params = new URLSearchParams({ page, limit })
  if (status) params.append('status', status)
  if (search) params.append('search', search)

  const response = await axios.get(`${API_BASE_URL}/subscriptions/admin/list?${params.toString()}`, {
    headers: jsonHeaders()
  })
  return response.data
}
