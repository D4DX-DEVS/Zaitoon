import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function getAuthHeaders() {
  const token = localStorage.getItem("adminToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** GET /api/app-config */
export async function getAppConfig() {
  const res = await axios.get(`${API_BASE_URL}/app-config`);
  return res.data?.data ?? {};
}

/** PUT /api/app-config */
export async function updateAppConfig(payload) {
  const res = await axios.put(`${API_BASE_URL}/app-config`, payload, {
    headers: getAuthHeaders()
  });
  return res.data?.data ?? {};
}
