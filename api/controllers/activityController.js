const User = require("../models/user");

/**
 * Normalize a date to YYYY-MM-DD at start of day in UTC for consistent comparison.
 * @param {Date} d
 * @returns {string} e.g. "2025-02-10"
 */
function toDateString(d) {
  if (!d) return null;
  const date = new Date(d);
  return date.toISOString().slice(0, 10);
}

/**
 * Get today's date string (UTC).
 */
function getTodayString() {
  return toDateString(new Date());
}

/**
 * Update daily reading streak for a user.
 * Logic:
 * - If lastActiveDate is today: do nothing (already counted).
 * - If lastActiveDate is yesterday: increment current streak.
 * - If lastActiveDate is older than yesterday (gap > 1 day): reset current to 1.
 * - Update longest streak if current exceeds it.
 */
async function updateStreak(req, res) {
  try {
    const userId = req.userId; // from authenticateUser middleware
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required.",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // Ensure growthActivity exists
    if (!user.growthActivity) {
      user.growthActivity = {
        readingStreak: { current: 0, longest: 0, lastActiveDate: null },
        booksRead: 0,
        achievements: [],
      };
    }
    if (!user.growthActivity.readingStreak) {
      user.growthActivity.readingStreak = {
        current: 0,
        longest: 0,
        lastActiveDate: null,
      };
    }

    const today = getTodayString();
    const lastStr = user.growthActivity.readingStreak.lastActiveDate
      ? toDateString(user.growthActivity.readingStreak.lastActiveDate)
      : null;

    let { current, longest } = user.growthActivity.readingStreak;

    // Already active today — no change
    if (lastStr === today) {
      return res.status(200).json({
        success: true,
        message: "Streak already updated for today.",
        data: {
          readingStreak: {
            current: user.growthActivity.readingStreak.current,
            longest: user.growthActivity.readingStreak.longest,
            lastActiveDate: user.growthActivity.readingStreak.lastActiveDate,
          },
        },
      });
    }

    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayStr = toDateString(yesterday);

    if (lastStr === yesterdayStr) {
      // Consecutive day: increment streak
      current = (current || 0) + 1;
    } else {
      // Gap > 1 day or first time: reset to 1
      current = 1;
    }

    if (current > (longest || 0)) {
      longest = current;
    }

    user.growthActivity.readingStreak.current = current;
    user.growthActivity.readingStreak.longest = longest;
    user.growthActivity.readingStreak.lastActiveDate = new Date();
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Streak updated.",
      data: {
        readingStreak: {
          current: user.growthActivity.readingStreak.current,
          longest: user.growthActivity.readingStreak.longest,
          lastActiveDate: user.growthActivity.readingStreak.lastActiveDate,
        },
      },
    });
  } catch (error) {
    console.error("[activityController.updateStreak]", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update streak.",
      error: error.message,
    });
  }
}

/**
 * Increment books read count for the authenticated user.
 */
async function completeBook(req, res) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required.",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (!user.growthActivity) {
      user.growthActivity = {
        readingStreak: { current: 0, longest: 0, lastActiveDate: null },
        booksRead: 0,
        achievements: [],
      };
    }
    user.growthActivity.booksRead = (user.growthActivity.booksRead || 0) + 1;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Book completed.",
      data: {
        booksRead: user.growthActivity.booksRead,
      },
    });
  } catch (error) {
    console.error("[activityController.completeBook]", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update books read.",
      error: error.message,
    });
  }
}

/**
 * Get activity stats for a user.
 * Allowed: same user (userId from token) or admin (any userId).
 */
async function getUserActivity(req, res) {
  try {
    const { userId } = req.params;
    const isAdmin = req.admin && req.admin.role === "admin";
    const tokenUserId = req.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required.",
      });
    }

    // Non-admin can only request their own stats
    if (!isAdmin && tokenUserId !== userId) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only view your own activity.",
      });
    }

    const user = await User.findById(userId).select(
      "name email class growthActivity createdAt"
    );
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const growthActivity = user.growthActivity || {
      readingStreak: { current: 0, longest: 0, lastActiveDate: null },
      booksRead: 0,
      achievements: [],
    };

    return res.status(200).json({
      success: true,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          class: user.class,
        },
        growthActivity: {
          readingStreak: growthActivity.readingStreak || {
            current: 0,
            longest: 0,
            lastActiveDate: null,
          },
          booksRead: growthActivity.booksRead ?? 0,
          achievements: growthActivity.achievements || [],
        },
      },
    });
  } catch (error) {
    console.error("[activityController.getUserActivity]", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get user activity.",
      error: error.message,
    });
  }
}

/**
 * Get all users with their activity stats (admin only).
 */
async function getAllUsersActivity(req, res) {
  try {
    const users = await User.find({})
      .select("name email class growthActivity createdAt")
      .lean()
      .sort({ "growthActivity.readingStreak.current": -1, "growthActivity.booksRead": -1 });

    const list = users.map((u) => {
      const growth = u.growthActivity || {};
      const streak = growth.readingStreak || {};
      return {
        _id: u._id,
        name: u.name,
        email: u.email,
        class: u.class,
        createdAt: u.createdAt,
        readingStreak: {
          current: streak.current ?? 0,
          longest: streak.longest ?? 0,
          lastActiveDate: streak.lastActiveDate ?? null,
        },
        booksRead: growth.booksRead ?? 0,
        achievements: growth.achievements || [],
      };
    });

    return res.status(200).json({
      success: true,
      data: { users: list },
    });
  } catch (error) {
    console.error("[activityController.getAllUsersActivity]", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get users activity.",
      error: error.message,
    });
  }
}

module.exports = {
  updateStreak,
  completeBook,
  getUserActivity,
  getAllUsersActivity,
};
