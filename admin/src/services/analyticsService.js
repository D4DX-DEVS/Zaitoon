import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function getAuthHeaders() {
  const token = localStorage.getItem("adminToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * GET /api/admin/analytics/overview
 */
export async function getAnalyticsOverview(from, to) {
  const params = {};
  if (from) params.from = from;
  if (to) params.to = to;
  const res = await axios.get(`${API_BASE_URL}/admin/analytics/overview`, {
    headers: { ...getAuthHeaders() },
    params,
  });
  return res.data;
}

/**
 * GET /api/admin/analytics/videos
 */
export async function getVideoAnalytics(from, to) {
  const params = {};
  if (from) params.from = from;
  if (to) params.to = to;
  const res = await axios.get(`${API_BASE_URL}/admin/analytics/videos`, {
    headers: { ...getAuthHeaders() },
    params,
  });
  return res.data;
}

/**
 * GET /api/admin/analytics/stories
 */
export async function getStoryAnalytics(from, to) {
  const params = {};
  if (from) params.from = from;
  if (to) params.to = to;
  const res = await axios.get(`${API_BASE_URL}/admin/analytics/stories`, {
    headers: { ...getAuthHeaders() },
    params,
  });
  return res.data;
}

/**
 * GET /api/admin/analytics/quiz
 */
export async function getQuizAnalytics(from, to) {
  const params = {};
  if (from) params.from = from;
  if (to) params.to = to;
  const res = await axios.get(`${API_BASE_URL}/admin/analytics/quiz`, {
    headers: { ...getAuthHeaders() },
    params,
  });
  return res.data;
}

/**
 * GET /api/admin/analytics/puzzle
 */
export async function getPuzzleAnalytics(from, to) {
  const params = {};
  if (from) params.from = from;
  if (to) params.to = to;
  const res = await axios.get(`${API_BASE_URL}/admin/analytics/puzzle`, {
    headers: { ...getAuthHeaders() },
    params,
  });
  return res.data;
}

/**
 * GET /api/admin/analytics/kids-corner
 */
export async function getKidsCornerAnalytics(from, to) {
  const params = {};
  if (from) params.from = from;
  if (to) params.to = to;
  const res = await axios.get(`${API_BASE_URL}/admin/analytics/kids-corner`, {
    headers: { ...getAuthHeaders() },
    params,
  });
  return res.data;
}

/**
 * GET /api/admin/analytics/bookmarks
 */
export async function getBookmarkAnalytics(from, to) {
  const params = {};
  if (from) params.from = from;
  if (to) params.to = to;
  const res = await axios.get(`${API_BASE_URL}/admin/analytics/bookmarks`, {
    headers: { ...getAuthHeaders() },
    params,
  });
  return res.data;
}

/**
 * GET /api/admin/analytics/users
 */
export async function getUserAnalytics(from, to, page = 1, limit = 20) {
  const params = { page, limit };
  if (from) params.from = from;
  if (to) params.to = to;
  const res = await axios.get(`${API_BASE_URL}/admin/analytics/users`, {
    headers: { ...getAuthHeaders() },
    params,
  });
  return res.data;
}

/**
 * GET /api/admin/analytics/users/:firebaseUid
 */
export async function getUserDetail(firebaseUid, from, to) {
  const params = {};
  if (from) params.from = from;
  if (to) params.to = to;
  const res = await axios.get(`${API_BASE_URL}/admin/analytics/users/${firebaseUid}`, {
    headers: { ...getAuthHeaders() },
    params,
  });
  return res.data;
}

/**
 * GET /api/admin/analytics/realtime
 */
export async function getRealtimeStats() {
  const res = await axios.get(`${API_BASE_URL}/admin/analytics/realtime`, {
    headers: { ...getAuthHeaders() },
  });
  return res.data;
}
