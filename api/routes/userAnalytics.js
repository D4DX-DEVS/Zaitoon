const express = require("express");
const router = express.Router();
const { authenticateFirebaseToken } = require("../middleware/auth");
const {
  getOverview,
  getDailyBreakdown,
  getTimeline,
  getWeeklyChart,
} = require("../controllers/userAnalyticsController");

// Inject firebaseUid from verified token into req for controllers
const injectFirebaseUid = (req, res, next) => {
  if (req.user && req.user.firebaseUid) {
    req.firebaseUid = req.user.firebaseUid;
  }
  next();
};

// All routes require Firebase authentication + uid injection
router.use(authenticateFirebaseToken, injectFirebaseUid);

// GET /api/analytics/me/overview - Lifetime stats summary
router.get("/overview", getOverview);

// GET /api/analytics/me/daily?days=7 - Per-day breakdown
router.get("/daily", getDailyBreakdown);

// GET /api/analytics/me/timeline?page=1&limit=20 - Activity feed
router.get("/timeline", getTimeline);

// GET /api/analytics/me/weekly?weeks=4 - Weekly chart data
router.get("/weekly", getWeeklyChart);

module.exports = router;
