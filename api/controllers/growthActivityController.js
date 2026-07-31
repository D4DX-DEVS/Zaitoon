const User = require("../models/user");
const { checkAndAwardAchievements, trimCompletedBooks } = require("../utils/achievementChecker");
const { isValidBookType } = require("../constants/bookTypes");

function toDateString(d) {
  if (!d) return null;
  return new Date(d).toISOString().slice(0, 10);
}

function getTodayString() {
  return toDateString(new Date());
}

function ensureGrowthActivity(user) {
  if (!user.growthActivity) {
    user.growthActivity = {
      readingStreak: { current: 0, longest: 0, lastActiveDate: null },
      booksRead: 0,
      achievements: [],
      completedBooks: [],
      hadStreakBeforeReset: false,
    };
  }
  if (!user.growthActivity.readingStreak) {
    user.growthActivity.readingStreak = { current: 0, longest: 0, lastActiveDate: null };
  }
  if (!user.growthActivity.achievements) user.growthActivity.achievements = [];
  if (!user.growthActivity.completedBooks) user.growthActivity.completedBooks = [];
}

/**
 * Internal: update streak for a user by id. Used by API and by user login.
 * @param {string} userId
 * @returns {Promise<object|null>} formatUserGrowthResponse or null if user not found
 */
async function updateStreakForUserId(userId) {
  const user = await User.findById(userId);
  if (!user) return null;
  ensureGrowthActivity(user);

  const today = getTodayString();
  const lastStr = user.growthActivity.readingStreak.lastActiveDate
    ? toDateString(user.growthActivity.readingStreak.lastActiveDate)
    : null;
  let { current, longest } = user.growthActivity.readingStreak;

  if (lastStr === today) {
    await checkAndAwardAchievements(user);
    await user.save();
    return formatUserGrowthResponse(user, []);
  }

  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayStr = toDateString(yesterday);

  if (lastStr === yesterdayStr) {
    current = (current || 0) + 1;
  } else {
    if ((current || 0) > 0) {
      user.growthActivity.hadStreakBeforeReset = true;
    }
    current = 1;
  }
  if (current > (longest || 0)) longest = current;

  user.growthActivity.readingStreak.current = current;
  user.growthActivity.readingStreak.longest = longest;
  user.growthActivity.readingStreak.lastActiveDate = new Date();

  const newlyUnlocked = await checkAndAwardAchievements(user);
  await user.save();
  return formatUserGrowthResponse(user, newlyUnlocked);
}

/**
 * POST /api/activity/update-streak
 * Body: { firebaseUid } (required)
 * Updates daily streak, then runs achievement checker. Returns updated stats.
 */
async function updateStreak(req, res) {
  try {
    const { firebaseUid } = req.body || {};
    
    if (!firebaseUid) {
      return res.status(400).json({ success: false, message: "firebaseUid is required." });
    }

    // Find user by Firebase UID
    const user = await User.findOne({ firebaseUid });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const data = await updateStreakForUserId(user._id);
    if (!data) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    const message = data.readingStreak.lastActiveDate
      ? "Streak updated."
      : "Streak already updated for today.";
    return res.status(200).json({ success: true, message, data });
  } catch (error) {
    console.error("[growthActivityController.updateStreak]", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update streak.",
      error: error.message,
    });
  }
}

/**
 * POST /api/activity/complete-book
 * Body: { firebaseUid, bookId, bookType }
 * bookType required: "story" | "single_story" | "brightbox" (what counts as a book).
 * Increments booksRead, appends to completedBooks, runs achievement checker.
 */
async function completeBook(req, res) {
  try {
    const { firebaseUid, bookId, bookType } = req.body || {};
    
    if (!firebaseUid) {
      return res.status(400).json({ success: false, message: "firebaseUid is required." });
    }
    
    if (!isValidBookType(bookType)) {
      return res.status(400).json({
        success: false,
        message: "bookType is required and must be one of: story, single_story, brightbox",
      });
    }

    // Find user by Firebase UID
    const user = await User.findOne({ firebaseUid });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    ensureGrowthActivity(user);

    user.growthActivity.booksRead = (user.growthActivity.booksRead || 0) + 1;
    user.growthActivity.completedBooks = user.growthActivity.completedBooks || [];
    user.growthActivity.completedBooks.push({
      bookId: bookId || null,
      bookType,
      completedAt: new Date(),
    });
    trimCompletedBooks(user.growthActivity);

    const newlyUnlocked = await checkAndAwardAchievements(user);
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Book completed.",
      data: formatUserGrowthResponse(user, newlyUnlocked),
    });
  } catch (error) {
    console.error("[growthActivityController.completeBook]", error);
    return res.status(500).json({
      success: false,
      message: "Failed to complete book.",
      error: error.message,
    });
  }
}

/**
 * GET /api/activity/stats
 * Returns: totalCurrentStreaks, totalBooksRead, totalAchievements (for dashboard cards).
 */
async function getStats(req, res) {
  try {
    const users = await User.find({}).select("growthActivity").lean();
    let totalCurrentStreaks = 0;
    let totalBooksRead = 0;
    let totalAchievements = 0;
    let activeStreakUsers = 0;
    for (const u of users) {
      const g = u.growthActivity || {};
      const streak = g.readingStreak || {};
      const current = streak.current ?? 0;
      totalCurrentStreaks += current;
      if (current > 0) activeStreakUsers += 1;
      totalBooksRead += g.booksRead ?? 0;
      const ach = g.achievements || [];
      totalAchievements += Array.isArray(ach) ? ach.length : 0;
    }
    return res.status(200).json({
      success: true,
      data: {
        totalCurrentStreaks,
        totalBooksRead,
        totalAchievements,
        activeStreakUsers,
      },
    });
  } catch (error) {
    console.error("[growthActivityController.getStats]", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get stats.",
      error: error.message,
    });
  }
}

/**
 * GET /api/activity/users
 * Returns users with growth stats. Supports pagination and full details.
 * Query: page (default 1), limit (default 50, max 500; 0 = all), details=full (include completedBooks, hadStreakBeforeReset).
 */
async function getUsers(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limitParam = req.query.limit;
    const limitNum = limitParam === "0" || limitParam === "all" ? 0 : Math.min(500, Math.max(1, parseInt(limitParam, 10) || 50));
    const fullDetails = req.query.details === "full" || req.query.details === "true";

    const sort = { "growthActivity.readingStreak.current": -1, "growthActivity.booksRead": -1 };
    const total = await User.countDocuments({});

    const query = User.find({})
      .select("name email class growthActivity firebaseUid createdAt")
      .lean()
      .sort(sort);

    if (limitNum > 0) {
      query.skip((page - 1) * limitNum).limit(limitNum);
    }

    const users = await query;

    const list = users.map((u) => {
      const g = u.growthActivity || {};
      const streak = g.readingStreak || {};
      const achievements = g.achievements || [];
      const item = {
        _id: u._id,
        firebaseUid: u.firebaseUid || null,
        name: u.name,
        email: u.email,
        class: u.class,
        createdAt: u.createdAt,
        readingStreak: {
          current: streak.current ?? 0,
          longest: streak.longest ?? 0,
          lastActiveDate: streak.lastActiveDate ?? null,
        },
        booksRead: g.booksRead ?? 0,
        achievements: normalizeAchievementsForResponse(achievements),
        lastActive: streak.lastActiveDate ?? null,
      };
      if (fullDetails) {
        item.completedBooks = Array.isArray(g.completedBooks) ? g.completedBooks : [];
        item.hadStreakBeforeReset = g.hadStreakBeforeReset ?? false;
      }
      return item;
    });

    const totalPages = limitNum > 0 ? Math.ceil(total / limitNum) : 1;

    return res.status(200).json({
      success: true,
      data: {
        users: list,
        pagination: {
          page,
          limit: limitNum === 0 ? total : limitNum,
          total,
          totalPages,
        },
      },
    });
  } catch (error) {
    console.error("[growthActivityController.getUsers]", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get users.",
      error: error.message,
    });
  }
}

function normalizeAchievementsForResponse(achievements) {
  if (!Array.isArray(achievements)) return [];
  return achievements.map((e) =>
    typeof e === "string" ? { achievementId: e, unlockedAt: null } : e
  );
}

function formatUserGrowthResponse(user, newlyUnlocked = []) {
  const g = user.growthActivity || {};
  const streak = g.readingStreak || {};
  return {
    readingStreak: {
      current: streak.current ?? 0,
      longest: streak.longest ?? 0,
      lastActiveDate: streak.lastActiveDate ?? null,
    },
    booksRead: g.booksRead ?? 0,
    achievements: normalizeAchievementsForResponse(g.achievements || []),
    newlyUnlocked,
  };
}

/**
 * DELETE /api/activity/:firebaseUid
 * Deletes user entirely from the database (admin only).
 * Supports both firebaseUid and MongoDB _id.
 * @param {string} firebaseUid - Firebase UID or MongoDB _id of the user
 */
async function deleteGrowthActivity(req, res) {
  try {
    const { firebaseUid } = req.params;
    
    if (!firebaseUid) {
      return res.status(400).json({ success: false, message: "User identifier is required." });
    }

    // Try to find user by Firebase UID first, then by MongoDB _id
    let user = await User.findOne({ firebaseUid });
    if (!user && firebaseUid.match(/^[0-9a-fA-F]{24}$/)) {
      // If not found and looks like MongoDB ObjectId, try by _id
      user = await User.findById(firebaseUid);
    }
    
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    // Store user info before deletion for response
    const deletedUserInfo = {
      userId: user.firebaseUid || user._id,
      email: user.email,
      displayName: user.name,
    };

    // Delete the entire user document from the database
    const deleteResult = await User.deleteOne({ _id: user._id });

    // Verify the deletion was successful
    if (deleteResult.deletedCount === 0) {
      console.error(`[growthActivityController] ❌ Failed to delete user: ${firebaseUid}`);
      return res.status(404).json({ success: false, message: "Failed to delete user." });
    }

    console.log(`[growthActivityController] ✅ User deleted successfully: ${firebaseUid} (deletedCount: ${deleteResult.deletedCount})`);

    return res.status(200).json({
      success: true,
      message: "User deleted successfully from growth activity.",
      data: deletedUserInfo
    });
  } catch (error) {
    console.error("[growthActivityController.deleteGrowthActivity]", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete user.",
      error: error.message,
    });
  }
}

module.exports = {
  updateStreak,
  updateStreakForUserId,
  completeBook,
  getStats,
  getUsers,
  formatUserGrowthResponse,
  deleteGrowthActivity,
};
