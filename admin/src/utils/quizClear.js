import axios from 'axios'

const authHeader = () => ({
  Authorization: `Bearer ${localStorage.getItem('adminToken')}`
})

/**
 * Numbers the clear dialog needs before it can show a blast radius:
 *   attemptCount  - how many attempts belong to this quiz
 *   referencedBy  - how many other quizzes carry over FROM this one
 *
 * referencedBy is counted within the quiz's own programme, which is where the
 * admin UI restricts carry-over selection to anyway.
 */
export async function fetchClearContext(API_BASE, quiz) {
  const [countRes, siblingsRes] = await Promise.all([
    axios.get(`${API_BASE}/quiz-attempts/admin/all`, {
      params: { quizId: quiz._id, limit: 1 },
      headers: authHeader()
    }),
    axios.get(`${API_BASE}/quizzes`, {
      params: { ...(quiz.quizConfigId ? { configId: quiz.quizConfigId } : {}), limit: 100 },
      headers: authHeader()
    })
  ])

  const attemptCount = countRes.data?.data?.pagination?.total || 0
  const siblings = siblingsRes.data?.data?.quizzes || []
  const referencedBy = siblings.filter(q =>
    q._id !== quiz._id &&
    (q.includedQuizIds || []).some(id => String(id._id || id) === String(quiz._id))
  ).length

  return { attemptCount, referencedBy }
}

export async function clearQuizPoints(API_BASE, quizId, { deleteAttempts, clearCarryOver }) {
  const res = await axios.post(
    `${API_BASE}/quiz-attempts/admin/clear-by-quiz/${quizId}`,
    { deleteAttempts, clearCarryOver },
    { headers: authHeader() }
  )
  return res.data?.data || {}
}
