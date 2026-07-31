const express = require("express");
const router = express.Router();
const {
  updateStreak,
  completeBook,
  getStats,
  getUsers,
  formatUserGrowthResponse,
  deleteGrowthActivity,
} = require("../controllers/growthActivityController");
const { authenticateAdmin, authenticateFirebaseToken } = require("../middleware/auth");
const User = require("../models/user");

// —— Dashboard ——
// GET /api/activity/stats — totalCurrentStreaks, totalBooksRead, totalAchievements (no auth)
router.get("/stats", getStats);

// GET /api/activity/users — users with growth stats (paginated)
// Query: firebaseUid (optional) — single user; else page, limit, details=full (no auth)
router.get("/users", async (req, res, next) => {
  const firebaseUid = req.query.firebaseUid;

  if (firebaseUid) {
    try {
      const user = await User.findOne({ firebaseUid }).select("name email class growthActivity firebaseUid createdAt");
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found." });
      }

      const g = user.growthActivity || {};
      const streak = g.readingStreak || {};
      const achievements = g.achievements || [];

      return res.status(200).json({
        success: true,
        data: {
          userId: user.firebaseUid || user._id,
          email: user.email,
          displayName: user.name,
          readingStreak: streak.current ?? 0,
          booksRead: g.booksRead ?? 0,
          achievements: Array.isArray(achievements) ? achievements.length : 0,
          lastActive: streak.lastActiveDate ?? null,
        },
      });
    } catch (error) {
      console.error("[growthActivity] Error getting user activity:", error);
      return res.status(500).json({ success: false, message: "Failed to get activity.", error: error.message });
    }
  }

  return getUsers(req, res, next);
});

// GET /api/activity/me — Get current user's activity (Flutter app)
// Query param: ?firebaseUid=<firebaseUid> (required)
// Auto-creates user if not found
router.get("/me", async (req, res) => {
  try {
    const firebaseUid = req.query.firebaseUid;
    
    if (!firebaseUid) {
      console.error("[growthActivity /me] No firebaseUid found in request");
      return res.status(400).json({ success: false, message: "firebaseUid is required as query parameter." });
    }

    // Find user or create if doesn't exist
    let user = await User.findOne({ firebaseUid }).select("name email class growthActivity firebaseUid createdAt");
    
    if (!user) {
      console.log("[growthActivity /me] 📝 User not found, creating new user:", firebaseUid);

      // Use display name provided by the client (from Firebase Auth on device)
      // Fall back to "New User" only if nothing is provided
      const clientName = req.query.displayName;
      let userName = (clientName && clientName.trim()) ? clientName.trim() : "New User";

      // Create new user with default values
      user = await User.create({
        firebaseUid: firebaseUid,
        name: userName,
        email: `${firebaseUid}@firebase.local`,  // Placeholder email (required field)
        class: "Default",
        growthActivity: {
          readingStreak: {
            current: 0,
            longest: 0,
            lastActiveDate: null
          },
          booksRead: 0,
          achievements: [],
          completedBooks: [],
          hadStreakBeforeReset: false
        }
      });
      
      console.log("[growthActivity /me] ✅ New user created:", firebaseUid, "name:", userName);
    } else {
      // If the existing user still has the placeholder name, update it now
      const clientName = req.query.displayName;
      if (clientName && clientName.trim() && user.name === "New User") {
        user.name = clientName.trim();
        await user.save();
        console.log("[growthActivity /me] Updated placeholder name to:", user.name);
      }
    }

    const g = user.growthActivity || {};
    const streak = g.readingStreak || {};
    const achievements = g.achievements || [];

    return res.status(200).json({
      success: true,
      data: {
        userId: user.firebaseUid || user._id,
        email: user.email,
        displayName: user.name,
        readingStreak: streak.current ?? 0,
        booksRead: g.booksRead ?? 0,
        achievements: Array.isArray(achievements) ? achievements.length : 0,
        lastActive: streak.lastActiveDate ?? null,
      },
    });
  } catch (error) {
    console.error("[growthActivity] Error getting user activity:", error);
    return res.status(500).json({ success: false, message: "Failed to get activity.", error: error.message });
  }
});

// —— App write endpoints (Firebase auth required) ——
// POST /api/activity/update-streak — Updates streak for the authenticated user.
router.post("/update-streak", authenticateFirebaseToken, async (req, res, next) => {
  // Inject firebaseUid from verified token into body so controller can use it
  req.body.firebaseUid = req.user.firebaseUid;
  return updateStreak(req, res, next);
});

// POST /api/activity/complete-book — Marks a book complete for the authenticated user.
router.post("/complete-book", authenticateFirebaseToken, async (req, res, next) => {
  req.body.firebaseUid = req.user.firebaseUid;
  return completeBook(req, res, next);
});

// —— Admin endpoints ——
// DELETE /api/activity/:firebaseUid — Delete user's growth activity (admin only)
router.delete("/:firebaseUid", authenticateAdmin, deleteGrowthActivity);

module.exports = router;

// GET /api/activity/test/user/:firebaseUid — Get user by Firebase UID (no auth)
router.get("/test/user/:firebaseUid", async (req, res) => {
  try {
    const { firebaseUid } = req.params;
    const user = await User.findOne({ firebaseUid }).select("name email class growthActivity firebaseUid _id createdAt");
    
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const g = user.growthActivity || {};
    const streak = g.readingStreak || {};
    const achievements = g.achievements || [];

    return res.status(200).json({
      success: true,
      data: {
        _id: user._id,
        firebaseUid: user.firebaseUid,
        userId: user.firebaseUid || user._id,
        email: user.email,
        displayName: user.name,
        class: user.class,
        readingStreak: {
          current: streak.current ?? 0,
          longest: streak.longest ?? 0,
          lastActiveDate: streak.lastActiveDate ?? null,
        },
        booksRead: g.booksRead ?? 0,
        achievements: Array.isArray(achievements) ? achievements : [],
        achievementsCount: Array.isArray(achievements) ? achievements.length : 0,
        lastActive: streak.lastActiveDate ?? null,
      },
    });
  } catch (error) {
    console.error("[growthActivity] Test endpoint error:", error);
    return res.status(500).json({ success: false, message: "Failed to get user.", error: error.message });
  }
});

// POST /api/activity/test/update-streak — Update streak by Firebase UID (no auth)
router.post("/test/update-streak", async (req, res) => {
  try {
    const { firebaseUid } = req.body;
    if (!firebaseUid) {
      return res.status(400).json({ success: false, message: "firebaseUid is required." });
    }

    const user = await User.findOne({ firebaseUid });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const { updateStreakForUserId } = require("../controllers/growthActivityController");
    const data = await updateStreakForUserId(user._id);
    
    if (!data) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    return res.status(200).json({
      success: true,
      message: "Streak updated.",
      data,
    });
  } catch (error) {
    console.error("[growthActivity] Test update-streak error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update streak.",
      error: error.message,
    });
  }
});

// POST /api/activity/test/complete-book — Complete book by Firebase UID (no auth)
router.post("/test/complete-book", async (req, res) => {
  try {
    const { firebaseUid, bookId, bookType } = req.body;
    
    if (!firebaseUid) {
      return res.status(400).json({ success: false, message: "firebaseUid is required." });
    }
    
    const { isValidBookType } = require("../constants/bookTypes");
    if (!isValidBookType(bookType)) {
      return res.status(400).json({
        success: false,
        message: "bookType is required and must be one of: story, single_story, brightbox",
      });
    }

    const user = await User.findOne({ firebaseUid });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const { checkAndAwardAchievements, trimCompletedBooks } = require("../utils/achievementChecker");
    const { formatUserGrowthResponse } = require("../controllers/growthActivityController");
    
    // Ensure growthActivity exists
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
    console.error("[growthActivity] Test complete-book error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to complete book.",
      error: error.message,
    });
  }
});

module.exports = router;
