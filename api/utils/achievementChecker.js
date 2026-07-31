const { getAll } = require("../constants/achievements");

const MAX_COMPLETED_BOOKS_STORED = 100;
const SPEED_READER_DAYS = 7;
const SPEED_READER_MIN_BOOKS = 3;
const COMEBACK_KID_MIN_STREAK = 3;

/**
 * Normalize achievements array: support legacy [String] and new [{ achievementId, unlockedAt }].
 * Returns Set of achievementIds the user has.
 */
function getUnlockedIds(growthActivity) {
  const list = growthActivity?.achievements || [];
  const ids = new Set();
  for (const entry of list) {
    if (typeof entry === "string") {
      ids.add(entry);
    } else if (entry && entry.achievementId) {
      ids.add(entry.achievementId);
    }
  }
  return ids;
}

/**
 * Count books completed in the last N days from completedBooks array.
 */
function countBooksInLastNDays(completedBooks, days) {
  if (!Array.isArray(completedBooks) || completedBooks.length === 0) return 0;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffTime = cutoff.getTime();
  return completedBooks.filter((b) => new Date(b.completedAt).getTime() >= cutoffTime).length;
}

/**
 * Check all achievement conditions and award any newly earned.
 * Mutates user.growthActivity (achievements, hadStreakBeforeReset).
 * @param {object} user - Mongoose user document (with growthActivity)
 * @returns {Promise<Array<{ achievementId, name, description, icon }>>} newly unlocked
 */
async function checkAndAwardAchievements(user) {
  const newlyUnlocked = [];
  const growth = user.growthActivity || {};
  const streak = growth.readingStreak || {};
  const current = streak.current ?? 0;
  const booksRead = growth.booksRead ?? 0;
  const completedBooks = growth.completedBooks || [];
  const hadStreakBeforeReset = growth.hadStreakBeforeReset === true;

  // Ensure achievements is array of { achievementId, unlockedAt }
  if (!growth.achievements || !Array.isArray(growth.achievements)) {
    growth.achievements = [];
  }
  const existing = growth.achievements;
  const normalized = existing.map((e) =>
    typeof e === "string" ? { achievementId: e, unlockedAt: new Date() } : e
  );
  if (normalized.length !== existing.length || existing.some((e) => typeof e === "string")) {
    growth.achievements = normalized;
  }

  const unlockedIds = getUnlockedIds(growth);
  const allAchievements = getAll();
  const now = new Date();

  for (const def of allAchievements) {
    if (unlockedIds.has(def.id)) continue;

    let earned = false;
    switch (def.id) {
      case "first_book":
        earned = booksRead >= 1;
        break;
      case "bookworm":
        earned = booksRead >= 5;
        break;
      case "reading_master_10":
        earned = booksRead >= 10;
        break;
      case "reading_master_25":
        earned = booksRead >= 25;
        break;
      case "reading_master_50":
        earned = booksRead >= 50;
        break;
      case "reading_master_100":
        earned = booksRead >= 100;
        break;
      case "getting_started":
        earned = current >= 3;
        break;
      case "week_warrior":
        earned = current >= 7;
        break;
      case "monthly_master":
        earned = current >= 30;
        break;
      case "year_legend":
        earned = current >= 365;
        break;
      case "speed_reader":
        earned = countBooksInLastNDays(completedBooks, SPEED_READER_DAYS) >= SPEED_READER_MIN_BOOKS;
        break;
      case "comeback_kid":
        earned = hadStreakBeforeReset && current >= COMEBACK_KID_MIN_STREAK;
        break;
      default:
        break;
    }

    if (earned) {
      growth.achievements.push({ achievementId: def.id, unlockedAt: now });
      unlockedIds.add(def.id);
      newlyUnlocked.push({
        achievementId: def.id,
        name: def.name,
        description: def.description,
        icon: def.icon,
      });
      if (def.id === "comeback_kid" && user.growthActivity) {
        user.growthActivity.hadStreakBeforeReset = false;
      }
    }
  }

  return newlyUnlocked;
}

/**
 * Trim completedBooks to last MAX_COMPLETED_BOOKS_STORED to avoid unbounded growth.
 */
function trimCompletedBooks(growthActivity) {
  const list = growthActivity?.completedBooks;
  if (!Array.isArray(list) || list.length <= MAX_COMPLETED_BOOKS_STORED) return;
  list.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
  growthActivity.completedBooks = list.slice(0, MAX_COMPLETED_BOOKS_STORED);
}

module.exports = {
  checkAndAwardAchievements,
  getUnlockedIds,
  countBooksInLastNDays,
  trimCompletedBooks,
  MAX_COMPLETED_BOOKS_STORED,
};
