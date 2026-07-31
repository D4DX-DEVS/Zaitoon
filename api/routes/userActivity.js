const express = require("express");
const router = express.Router();
const { authenticateHybridREST } = require("../middleware/authREST");
const {
  updateStreak,
  completeBook,
  getUserActivity,
} = require("../controllers/activityController");

// —— App user routes (authenticated user token - Firebase from Flutter or JWT from admin) ——

// POST /api/activity/update-streak — Update daily reading streak (call on app open)
// Supports Firebase tokens from Flutter app
router.post("/update-streak", authenticateHybridREST, updateStreak);

// POST /api/activity/complete-book — Increment books read
router.post("/complete-book", authenticateHybridREST, completeBook);

// GET /api/activity/me — Get current user's activity stats
router.get("/me", authenticateHybridREST, (req, res, next) => {
  req.params.userId = req.userId;
  return getUserActivity(req, res, next);
});

// —— Admin or specific user lookup ——

// GET /api/activity/:userId — Get user stats (admin can access any user; app user only own)
// Supports Firebase tokens from Flutter app
router.get("/:userId", authenticateHybridREST, (req, res, next) => {
  const paramUserId = req.params.userId;
  const tokenUserId = req.userId?.toString();
  const isAdmin = req.admin && req.admin.role === "admin";

  // Prevent route conflicts
  if (paramUserId === "me" || paramUserId === "update-streak" || paramUserId === "complete-book") {
    return res.status(404).json({ success: false, message: "Not found." });
  }

  // Admin can access any user
  if (isAdmin) {
    return getUserActivity(req, res, next);
  }

  // Regular user can only access their own data
  if (tokenUserId && tokenUserId === paramUserId) {
    return getUserActivity(req, res, next);
  }

  return res.status(403).json({
    success: false,
    message: "Access denied. You can only view your own activity.",
  });
});

module.exports = router;
