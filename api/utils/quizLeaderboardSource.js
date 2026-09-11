const Quiz = require("../models/quiz");
const QuizConfig = require("../models/quizConfig");

// A quiz's leaderboard = its own attempts plus the own attempts of each quiz
// the admin explicitly selected in includedQuizIds.
//
// Resolution is SINGLE-LEVEL on purpose: we never look at an included quiz's
// own includedQuizIds. That makes cycles (A includes B, B includes A) harmless
// by construction, so there is deliberately no cycle detection here.
function getEffectiveQuizIds(quiz) {
  const ids = [String(quiz._id)];
  for (const id of quiz.includedQuizIds || []) {
    const s = String(id);
    if (!ids.includes(s)) ids.push(s);
  }
  return ids;
}

// The quiz whose board the app should show when it asks for a leaderboard
// without naming one. Newest Active quiz that has already started, preferring
// the currently live config.
//
// Read-only by design. GET /api/quizzes/today auto-creates a quiz when none
// exists for today; a leaderboard read must never have that side effect.
// Returns null when no config is live or no quiz has started yet, in which
// case callers render an empty board.
async function getCurrentQuiz() {
  const now = new Date();

  const config = await QuizConfig.findOne({
    isEnable: true,
    startDate: { $lte: now },
    endDate: { $gte: now }
  })
    .sort({ startDate: -1 })
    .lean();

  const filter = { quizDate: { $lte: now }, status: "Active" };
  if (config) filter.quizConfigId = config._id;

  return Quiz.findOne(filter)
    .sort({ quizDate: -1 })
    .select("_id includedQuizIds")
    .lean();
}

module.exports = { getEffectiveQuizIds, getCurrentQuiz };
