/**
 * Achievement definitions: id, name, description, icon, requirement (for reference).
 * Actual check logic lives in utils/achievementChecker.js.
 */
const ACHIEVEMENTS = [
  // —— Reading milestones (booksRead) ——
  {
    id: "first_book",
    name: "First Book",
    description: "Complete your first book",
    icon: "📖",
    requirement: "booksRead >= 1",
  },
  {
    id: "bookworm",
    name: "Bookworm",
    description: "Complete 5 books",
    icon: "🐛",
    requirement: "booksRead >= 5",
  },
  {
    id: "reading_master_10",
    name: "Reading Master (10)",
    description: "Complete 10 books",
    icon: "📚",
    requirement: "booksRead >= 10",
  },
  {
    id: "reading_master_25",
    name: "Reading Master (25)",
    description: "Complete 25 books",
    icon: "📚",
    requirement: "booksRead >= 25",
  },
  {
    id: "reading_master_50",
    name: "Reading Master (50)",
    description: "Complete 50 books",
    icon: "📚",
    requirement: "booksRead >= 50",
  },
  {
    id: "reading_master_100",
    name: "Reading Master (100)",
    description: "Complete 100 books",
    icon: "📚",
    requirement: "booksRead >= 100",
  },
  // —— Streak based (current streak) ——
  {
    id: "getting_started",
    name: "Getting Started",
    description: "Maintain a 3-day reading streak",
    icon: "🔥",
    requirement: "currentStreak >= 3",
  },
  {
    id: "week_warrior",
    name: "Week Warrior",
    description: "Maintain a 7-day reading streak",
    icon: "⚡",
    requirement: "currentStreak >= 7",
  },
  {
    id: "monthly_master",
    name: "Monthly Master",
    description: "Maintain a 30-day reading streak",
    icon: "🌟",
    requirement: "currentStreak >= 30",
  },
  {
    id: "year_legend",
    name: "Year Legend",
    description: "Maintain a 365-day reading streak",
    icon: "👑",
    requirement: "currentStreak >= 365",
  },
  // —— Special ——
  {
    id: "speed_reader",
    name: "Speed Reader",
    description: "Complete 3 or more books in the last 7 days",
    icon: "⚡",
    requirement: "booksCompletedInLast7Days >= 3",
  },
  {
    id: "comeback_kid",
    name: "Comeback Kid",
    description: "Lost your streak and built it back to 3+ days",
    icon: "💪",
    requirement: "hadStreakBeforeReset && currentStreak >= 3",
  },
];

const BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

function getById(id) {
  return BY_ID[id] || null;
}

function getAll() {
  return ACHIEVEMENTS;
}

module.exports = {
  ACHIEVEMENTS,
  BY_ID,
  getById,
  getAll,
};
