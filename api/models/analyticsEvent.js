const mongoose = require("mongoose");

const analyticsEventSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    firebaseUid: {
      type: String,
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      enum: [
        // Video events
        "video_play",
        "video_progress",
        "video_complete",
        // Story events (all stories / series)
        "story_open",
        "story_progress",
        "story_complete",
        // Single story events
        "single_story_open",
        "single_story_complete",
        // BrightBox events
        "brightbox_open",
        "brightbox_complete",
        // Quiz events
        "quiz_start",
        "quiz_complete",
        "quiz_abandon",
        // Puzzle events
        "puzzle_start",
        "puzzle_complete",
        "puzzle_abandon",
        // Kids Corner events
        "kids_corner_view",
        "kids_corner_submit",
        // Bookmark events
        "bookmark_add",
        "bookmark_remove",
        // Session events
        "app_open",
        "app_close",
        // Navigation events
        "screen_view",
        // Search events
        "search_query",
        // Painting events
        "painting_start",
        "painting_complete",
        "painting_save",
      ],
      index: true,
    },
    eventCategory: {
      type: String,
      required: true,
      enum: [
        "video",
        "story",
        "single_story",
        "brightbox",
        "quiz",
        "puzzle",
        "kids_corner",
        "bookmark",
        "session",
        "navigation",
        "search",
        "painting",
      ],
      index: true,
    },
    contentId: {
      type: String,
      default: null,
    },
    contentType: {
      type: String,
      default: null,
    },
    contentTitle: {
      type: String,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    duration: {
      type: Number,
      default: null,
    },
    sessionId: {
      type: String,
      index: true,
    },
    deviceInfo: {
      platform: { type: String },
      osVersion: { type: String },
      appVersion: { type: String },
      deviceModel: { type: String },
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient dashboard queries
analyticsEventSchema.index({ firebaseUid: 1, eventType: 1, createdAt: -1 });
analyticsEventSchema.index({ eventCategory: 1, createdAt: -1 });
analyticsEventSchema.index({ sessionId: 1, createdAt: 1 });
analyticsEventSchema.index({ createdAt: -1 });

// TTL index is managed by jobs/analyticsCleanup.js (7 day retention)

module.exports = mongoose.model("AnalyticsEvent", analyticsEventSchema);
