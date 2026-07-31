const AnalyticsEvent = require("../models/analyticsEvent");
const User = require("../models/user");

/**
 * POST /api/analytics/events
 * Log a single analytics event.
 * Body: { eventType, eventCategory, contentId?, contentType?, contentTitle?, metadata?, duration?, sessionId?, deviceInfo? }
 */
async function logEvent(req, res) {
  try {
    const firebaseUid = req.firebaseUid || req.body.firebaseUid;
    if (!firebaseUid) {
      return res.status(400).json({ success: false, message: "firebaseUid is required." });
    }

    const {
      eventType,
      eventCategory,
      contentId,
      contentType,
      contentTitle,
      metadata,
      duration,
      sessionId,
      deviceInfo,
    } = req.body;

    if (!eventType || !eventCategory) {
      return res.status(400).json({
        success: false,
        message: "eventType and eventCategory are required.",
      });
    }

    // Find user by firebase UID (don't block on failure)
    let userId = null;
    try {
      const user = await User.findOne({ firebaseUid }).select("_id").lean();
      if (user) userId = user._id;
    } catch (err) {
      console.warn("[Analytics] Could not resolve userId for firebaseUid:", firebaseUid);
    }

    const event = await AnalyticsEvent.create({
      userId,
      firebaseUid,
      eventType,
      eventCategory,
      contentId: contentId || null,
      contentType: contentType || null,
      contentTitle: contentTitle || null,
      metadata: metadata || {},
      duration: duration || null,
      sessionId: sessionId || null,
      deviceInfo: deviceInfo || {},
    });

    return res.status(201).json({
      success: true,
      message: "Event logged.",
      data: { eventId: event._id },
    });
  } catch (error) {
    console.error("[Analytics] logEvent error:", error.message);
    // Validate enum errors gracefully
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Invalid event data.",
        errors: Object.values(error.errors).map((e) => e.message),
      });
    }
    return res.status(500).json({ success: false, message: "Failed to log event." });
  }
}

/**
 * POST /api/analytics/events/batch
 * Log multiple analytics events at once (for offline sync & batching).
 * Body: { events: [ { eventType, eventCategory, ... }, ... ] }
 */
async function logBatchEvents(req, res) {
  try {
    const firebaseUid = req.firebaseUid || req.body.firebaseUid;
    if (!firebaseUid) {
      return res.status(400).json({ success: false, message: "firebaseUid is required." });
    }

    const { events } = req.body;
    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({
        success: false,
        message: "events array is required and must not be empty.",
      });
    }

    // Cap batch size to prevent abuse
    if (events.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Maximum 100 events per batch.",
      });
    }

    // Find user
    let userId = null;
    try {
      const user = await User.findOne({ firebaseUid }).select("_id").lean();
      if (user) userId = user._id;
    } catch (err) {
      console.warn("[Analytics] Could not resolve userId for firebaseUid:", firebaseUid);
    }

    // Prepare documents
    const docs = events
      .filter((e) => e.eventType && e.eventCategory)
      .map((e) => ({
        userId,
        firebaseUid,
        eventType: e.eventType,
        eventCategory: e.eventCategory,
        contentId: e.contentId || null,
        contentType: e.contentType || null,
        contentTitle: e.contentTitle || null,
        metadata: e.metadata || {},
        duration: e.duration || null,
        sessionId: e.sessionId || null,
        deviceInfo: e.deviceInfo || {},
        createdAt: e.timestamp ? new Date(e.timestamp) : new Date(),
      }));

    if (docs.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid events found in batch.",
      });
    }

    // Use insertMany with ordered: false so valid docs still insert if some fail
    const result = await AnalyticsEvent.insertMany(docs, { ordered: false }).catch((err) => {
      // Some documents may fail validation but others succeed
      if (err.insertedDocs) return err.insertedDocs;
      throw err;
    });

    const insertedCount = Array.isArray(result) ? result.length : 0;

    return res.status(201).json({
      success: true,
      message: `${insertedCount} event(s) logged.`,
      data: {
        submitted: events.length,
        inserted: insertedCount,
        skipped: events.length - insertedCount,
      },
    });
  } catch (error) {
    console.error("[Analytics] logBatchEvents error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to log batch events." });
  }
}

/**
 * POST /api/analytics/session/start
 * Start a new app session. Returns a generated sessionId.
 * Body: { deviceInfo? }
 */
async function startSession(req, res) {
  try {
    const firebaseUid = req.firebaseUid || req.body.firebaseUid;
    if (!firebaseUid) {
      return res.status(400).json({ success: false, message: "firebaseUid is required." });
    }

    const sessionId = `sess_${firebaseUid.substring(0, 8)}_${Date.now()}`;
    const { deviceInfo } = req.body;

    // Find user
    let userId = null;
    try {
      const user = await User.findOne({ firebaseUid }).select("_id").lean();
      if (user) userId = user._id;
    } catch (err) {
      // non-blocking
    }

    await AnalyticsEvent.create({
      userId,
      firebaseUid,
      eventType: "app_open",
      eventCategory: "session",
      sessionId,
      metadata: { source: req.body.source || "direct" },
      deviceInfo: deviceInfo || {},
    });

    return res.status(201).json({
      success: true,
      message: "Session started.",
      data: { sessionId },
    });
  } catch (error) {
    console.error("[Analytics] startSession error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to start session." });
  }
}

/**
 * POST /api/analytics/session/end
 * End an app session.
 * Body: { sessionId, duration? }
 */
async function endSession(req, res) {
  try {
    const firebaseUid = req.firebaseUid || req.body.firebaseUid;
    if (!firebaseUid) {
      return res.status(400).json({ success: false, message: "firebaseUid is required." });
    }

    const { sessionId, duration } = req.body;
    if (!sessionId) {
      return res.status(400).json({ success: false, message: "sessionId is required." });
    }

    let userId = null;
    try {
      const user = await User.findOne({ firebaseUid }).select("_id").lean();
      if (user) userId = user._id;
    } catch (err) {
      // non-blocking
    }

    await AnalyticsEvent.create({
      userId,
      firebaseUid,
      eventType: "app_close",
      eventCategory: "session",
      sessionId,
      duration: duration || null,
      metadata: { sessionDuration: duration || 0 },
      deviceInfo: req.body.deviceInfo || {},
    });

    return res.status(201).json({
      success: true,
      message: "Session ended.",
    });
  } catch (error) {
    console.error("[Analytics] endSession error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to end session." });
  }
}

module.exports = {
  logEvent,
  logBatchEvents,
  startSession,
  endSession,
};
