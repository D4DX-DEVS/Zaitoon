const mongoose = require("mongoose");

const dailyAnalyticsSummarySchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
      unique: true,
      index: true,
    },
    totalActiveUsers: { type: Number, default: 0 },
    newUsers: { type: Number, default: 0 },
    totalSessions: { type: Number, default: 0 },
    avgSessionDuration: { type: Number, default: 0 }, // seconds

    video: {
      totalViews: { type: Number, default: 0 },
      uniqueViewers: { type: Number, default: 0 },
      totalWatchTime: { type: Number, default: 0 }, // seconds
      avgWatchTime: { type: Number, default: 0 },
      completionRate: { type: Number, default: 0 }, // 0-100%
    },

    stories: {
      allStories: {
        opens: { type: Number, default: 0 },
        completes: { type: Number, default: 0 },
        uniqueReaders: { type: Number, default: 0 },
      },
      singleStories: {
        opens: { type: Number, default: 0 },
        completes: { type: Number, default: 0 },
        uniqueReaders: { type: Number, default: 0 },
      },
      brightbox: {
        opens: { type: Number, default: 0 },
        completes: { type: Number, default: 0 },
        uniqueReaders: { type: Number, default: 0 },
      },
      totalReadTime: { type: Number, default: 0 }, // seconds
    },

    quiz: {
      attempts: { type: Number, default: 0 },
      uniqueParticipants: { type: Number, default: 0 },
      avgScore: { type: Number, default: 0 },
      avgDuration: { type: Number, default: 0 },
      completionRate: { type: Number, default: 0 },
    },

    puzzle: {
      attempts: { type: Number, default: 0 },
      uniqueParticipants: { type: Number, default: 0 },
      avgTimeTaken: { type: Number, default: 0 },
      completionRate: { type: Number, default: 0 },
    },

    kidsCorner: {
      views: { type: Number, default: 0 },
      uniqueViewers: { type: Number, default: 0 },
      submissions: {
        stories: { type: Number, default: 0 },
        poems: { type: Number, default: 0 },
        drawings: { type: Number, default: 0 },
      },
    },

    bookmarks: {
      added: { type: Number, default: 0 },
      removed: { type: Number, default: 0 },
      uniqueUsers: { type: Number, default: 0 },
    },

    topContent: [
      {
        contentId: String,
        contentType: String,
        title: String,
        count: Number,
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("DailyAnalyticsSummary", dailyAnalyticsSummarySchema);
