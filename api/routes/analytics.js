const express = require("express");
const router = express.Router();
const {
  logEvent,
  logBatchEvents,
  startSession,
  endSession,
} = require("../controllers/analyticsController");
const { authenticateFirebaseToken } = require("../middleware/auth");

/**
 * Analytics Event Tracking Routes
 * Base path: /api/analytics
 *
 * All routes require Firebase authentication (Flutter app users).
 * The firebaseUid is extracted from the verified token.
 */

// Middleware to extract firebaseUid from auth token into req body for controller use
const injectFirebaseUid = (req, res, next) => {
  if (req.user && req.user.firebaseUid) {
    req.firebaseUid = req.user.firebaseUid;
    // Also inject into body so controller can access it
    if (!req.body.firebaseUid) {
      req.body.firebaseUid = req.user.firebaseUid;
    }
  }
  next();
};

// POST /api/analytics/events — Log a single event
router.post("/events", authenticateFirebaseToken, injectFirebaseUid, logEvent);

// POST /api/analytics/events/batch — Log multiple events
router.post("/events/batch", authenticateFirebaseToken, injectFirebaseUid, logBatchEvents);

// POST /api/analytics/session/start — Start a session
router.post("/session/start", authenticateFirebaseToken, injectFirebaseUid, startSession);

// POST /api/analytics/session/end — End a session
router.post("/session/end", authenticateFirebaseToken, injectFirebaseUid, endSession);

module.exports = router;
