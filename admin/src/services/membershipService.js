import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

function getAuthHeaders() {
  const token = localStorage.getItem('adminToken')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export const getMemberships = async ({ page = 1, limit = 20, search = '' } = {}) => {
  const params = new URLSearchParams({ page, limit })
  if (search) params.append('search', search)

  const response = await axios.get(`${API_BASE_URL}/memberships?${params.toString()}`, {
    headers: getAuthHeaders()
  })
  return response.data
}

export const deleteMembership = async (id) => {
  const response = await axios.delete(`${API_BASE_URL}/memberships/${id}`, {
    headers: getAuthHeaders()
  })
  return response.data
}
