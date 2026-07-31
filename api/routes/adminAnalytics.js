const express = require("express");
const router = express.Router();
const {
  getOverview,
  getVideoAnalytics,
  getStoryAnalytics,
  getQuizAnalytics,
  getPuzzleAnalytics,
  getKidsCornerAnalytics,
  getBookmarkAnalytics,
  getUserAnalytics,
  getUserDetail,
  getRealtimeStats,
} = require("../controllers/adminAnalyticsController");
const { authenticateAdmin } = require("../middleware/auth");

/**
 * Admin Analytics Dashboard Routes
 * Base path: /api/admin/analytics
 *
 * All routes require Admin JWT authentication.
 * All GET endpoints accept query params: ?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Default date range: last 30 days
 */

// GET /api/admin/analytics/overview — Dashboard overview (summary + trends)
router.get("/overview", authenticateAdmin, getOverview);

// GET /api/admin/analytics/videos — Video analytics
router.get("/videos", authenticateAdmin, getVideoAnalytics);

// GET /api/admin/analytics/stories — Stories analytics (all stories, single, brightbox)
router.get("/stories", authenticateAdmin, getStoryAnalytics);

// GET /api/admin/analytics/quiz — Quiz analytics
router.get("/quiz", authenticateAdmin, getQuizAnalytics);

// GET /api/admin/analytics/puzzle — Puzzle analytics
router.get("/puzzle", authenticateAdmin, getPuzzleAnalytics);

// GET /api/admin/analytics/kids-corner — Kids Corner analytics
router.get("/kids-corner", authenticateAdmin, getKidsCornerAnalytics);

// GET /api/admin/analytics/bookmarks — Bookmark analytics
router.get("/bookmarks", authenticateAdmin, getBookmarkAnalytics);

// GET /api/admin/analytics/users — User list with analytics (paginated)
router.get("/users", authenticateAdmin, getUserAnalytics);

// GET /api/admin/analytics/users/:firebaseUid — Individual user detail
router.get("/users/:firebaseUid", authenticateAdmin, getUserDetail);

// GET /api/admin/analytics/realtime — Real-time active users
router.get("/realtime", authenticateAdmin, getRealtimeStats);

module.exports = router;
