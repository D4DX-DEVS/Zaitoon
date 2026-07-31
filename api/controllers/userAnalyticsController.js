const AnalyticsEvent = require("../models/analyticsEvent");

/**
 * User-facing analytics endpoints.
 * All queries scoped to req.firebaseUid so users only see their own data.
 */

// GET /api/analytics/me/overview
// Returns aggregated lifetime stats for the authenticated user
const getOverview = async (req, res) => {
  try {
    const uid = req.firebaseUid;
    if (!uid) {
      return res.status(400).json({ success: false, message: "User not identified" });
    }

    const [
      totalStoriesRead,
      totalVideosWatched,
      totalQuizzes,
      totalPuzzles,
      totalPaintings,
      sessionEvents,
      quizScores,
    ] = await Promise.all([
      // Stories (all types)
      AnalyticsEvent.countDocuments({
        firebaseUid: uid,
        eventType: { $in: ["story_complete", "single_story_complete", "brightbox_complete"] },
      }),
      // Videos
      AnalyticsEvent.countDocuments({
        firebaseUid: uid,
        eventType: "video_complete",
      }),
      // Quizzes completed
      AnalyticsEvent.countDocuments({
        firebaseUid: uid,
        eventType: "quiz_complete",
      }),
      // Puzzles completed
      AnalyticsEvent.countDocuments({
        firebaseUid: uid,
        eventType: "puzzle_complete",
      }),
      // Paintings completed
      AnalyticsEvent.countDocuments({
        firebaseUid: uid,
        eventType: "painting_save",
      }),
      // Sessions for total time
      AnalyticsEvent.find({
        firebaseUid: uid,
        eventType: { $in: ["app_open", "app_close"] },
      }).select("eventType createdAt duration").sort({ createdAt: 1 }).lean(),
      // Quiz scores for average
      AnalyticsEvent.find({
        firebaseUid: uid,
        eventType: "quiz_complete",
      }).select("metadata.score metadata.totalQuestions").lean(),
    ]);

    // Calculate total usage time from app_close events with duration, or session pairs
    let totalUsageSeconds = 0;
    for (const evt of sessionEvents) {
      if (evt.eventType === "app_close" && evt.duration) {
        totalUsageSeconds += evt.duration;
      }
    }

    // Calculate average quiz score
    let avgQuizScore = 0;
    if (quizScores.length > 0) {
      const scores = quizScores
        .filter((q) => q.metadata?.score != null && q.metadata?.totalQuestions)
        .map((q) => (q.metadata.score / q.metadata.totalQuestions) * 100);
      if (scores.length > 0) {
        avgQuizScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      }
    }

    // Current streak (consecutive days with at least one event)
    const streak = await calculateStreak(uid);

    res.json({
      success: true,
      data: {
        totalStoriesRead,
        totalVideosWatched,
        totalQuizzes,
        totalPuzzles,
        totalPaintings,
        totalUsageMinutes: Math.round(totalUsageSeconds / 60),
        avgQuizScore,
        currentStreak: streak,
      },
    });
  } catch (error) {
    console.error("[UserAnalytics] Overview error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/analytics/me/daily?days=7
// Returns per-day breakdown of activity for the last N days
const getDailyBreakdown = async (req, res) => {
  try {
    const uid = req.firebaseUid;
    if (!uid) {
      return res.status(400).json({ success: false, message: "User not identified" });
    }
    const days = Math.min(parseInt(req.query.days) || 7, 90);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const pipeline = [
      {
        $match: {
          firebaseUid: uid,
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          storiesRead: {
            $sum: {
              $cond: [
                { $in: ["$eventType", ["story_complete", "single_story_complete", "brightbox_complete"]] },
                1,
                0,
              ],
            },
          },
          videosWatched: {
            $sum: { $cond: [{ $eq: ["$eventType", "video_complete"] }, 1, 0] },
          },
          quizzesTaken: {
            $sum: { $cond: [{ $eq: ["$eventType", "quiz_complete"] }, 1, 0] },
          },
          puzzlesCompleted: {
            $sum: { $cond: [{ $eq: ["$eventType", "puzzle_complete"] }, 1, 0] },
          },
          paintingsSaved: {
            $sum: { $cond: [{ $eq: ["$eventType", "painting_save"] }, 1, 0] },
          },
          usageSeconds: {
            $sum: {
              $cond: [
                { $eq: ["$eventType", "app_close"] },
                { $ifNull: ["$duration", 0] },
                0,
              ],
            },
          },
          totalEvents: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ];

    const dailyData = await AnalyticsEvent.aggregate(pipeline);

    // Fill in missing days with zeros
    const result = [];
    const cursor = new Date(startDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    while (cursor <= today) {
      const dateStr = cursor.toISOString().split("T")[0];
      const found = dailyData.find((d) => d._id === dateStr);
      result.push({
        date: dateStr,
        storiesRead: found?.storiesRead || 0,
        videosWatched: found?.videosWatched || 0,
        quizzesTaken: found?.quizzesTaken || 0,
        puzzlesCompleted: found?.puzzlesCompleted || 0,
        paintingsSaved: found?.paintingsSaved || 0,
        usageMinutes: Math.round((found?.usageSeconds || 0) / 60),
        totalEvents: found?.totalEvents || 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("[UserAnalytics] Daily breakdown error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/analytics/me/timeline?page=1&limit=20
// Returns recent activity feed
const getTimeline = async (req, res) => {
  try {
    const uid = req.firebaseUid;
    if (!uid) {
      return res.status(400).json({ success: false, message: "User not identified" });
    }
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const skip = (page - 1) * limit;

    // Exclude noisy navigation events
    const excludeTypes = ["screen_view", "app_open", "search_query"];

    const [events, total] = await Promise.all([
      AnalyticsEvent.find({
        firebaseUid: uid,
        eventType: { $nin: excludeTypes },
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("eventType eventCategory contentTitle duration metadata createdAt")
        .lean(),
      AnalyticsEvent.countDocuments({
        firebaseUid: uid,
        eventType: { $nin: excludeTypes },
      }),
    ]);

    const formattedEvents = events.map((e) => ({
      id: e._id,
      type: e.eventType,
      category: e.eventCategory,
      title: e.contentTitle || _getEventTitle(e.eventType),
      duration: e.duration,
      metadata: e.metadata || {},
      timestamp: e.createdAt,
    }));

    res.json({
      success: true,
      data: {
        events: formattedEvents,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("[UserAnalytics] Timeline error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/analytics/me/weekly
// Returns weekly aggregated chart data (last 4 weeks)
const getWeeklyChart = async (req, res) => {
  try {
    const uid = req.firebaseUid;
    if (!uid) {
      return res.status(400).json({ success: false, message: "User not identified" });
    }
    const weeks = Math.min(parseInt(req.query.weeks) || 4, 12);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - weeks * 7);
    startDate.setHours(0, 0, 0, 0);

    const pipeline = [
      {
        $match: {
          firebaseUid: uid,
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            year: { $isoWeekYear: "$createdAt" },
            week: { $isoWeek: "$createdAt" },
          },
          stories: {
            $sum: {
              $cond: [
                { $in: ["$eventType", ["story_complete", "single_story_complete", "brightbox_complete"]] },
                1,
                0,
              ],
            },
          },
          videos: {
            $sum: { $cond: [{ $eq: ["$eventType", "video_complete"] }, 1, 0] },
          },
          quizzes: {
            $sum: { $cond: [{ $eq: ["$eventType", "quiz_complete"] }, 1, 0] },
          },
          puzzles: {
            $sum: { $cond: [{ $eq: ["$eventType", "puzzle_complete"] }, 1, 0] },
          },
          paintings: {
            $sum: { $cond: [{ $eq: ["$eventType", "painting_save"] }, 1, 0] },
          },
          usageSeconds: {
            $sum: {
              $cond: [
                { $eq: ["$eventType", "app_close"] },
                { $ifNull: ["$duration", 0] },
                0,
              ],
            },
          },
        },
      },
      { $sort: { "_id.year": 1, "_id.week": 1 } },
    ];

    const weeklyData = await AnalyticsEvent.aggregate(pipeline);

    const result = weeklyData.map((w) => ({
      year: w._id.year,
      week: w._id.week,
      label: `W${w._id.week}`,
      stories: w.stories,
      videos: w.videos,
      quizzes: w.quizzes,
      puzzles: w.puzzles,
      paintings: w.paintings,
      usageMinutes: Math.round(w.usageSeconds / 60),
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("[UserAnalytics] Weekly chart error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── Helper functions ──────────────────────────────────────

function _getEventTitle(eventType) {
  const titles = {
    video_play: "Watched a video",
    video_complete: "Completed a video",
    story_open: "Started reading a story",
    story_complete: "Finished a story",
    single_story_open: "Opened a story",
    single_story_complete: "Completed a story",
    brightbox_open: "Opened BrightBox story",
    brightbox_complete: "Finished BrightBox story",
    quiz_start: "Started a quiz",
    quiz_complete: "Completed a quiz",
    puzzle_start: "Started a puzzle",
    puzzle_complete: "Completed a puzzle",
    painting_start: "Started painting",
    painting_complete: "Finished painting",
    painting_save: "Saved a painting",
    bookmark_add: "Bookmarked content",
    bookmark_remove: "Removed bookmark",
    kids_corner_submit: "Submitted to Kids Corner",
    app_close: "Ended session",
  };
  return titles[eventType] || eventType.replace(/_/g, " ");
}

async function calculateStreak(firebaseUid) {
  try {
    // Get distinct days with activity (last 365 days)
    const yearAgo = new Date();
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);

    const days = await AnalyticsEvent.aggregate([
      {
        $match: {
          firebaseUid,
          createdAt: { $gte: yearAgo },
          eventType: { $nin: ["screen_view", "search_query"] },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        },
      },
      { $sort: { _id: -1 } },
    ]);

    if (days.length === 0) return 0;

    const activeDates = days.map((d) => d._id);
    const today = new Date().toISOString().split("T")[0];

    // Check if today or yesterday is active (streak must be current)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    if (!activeDates.includes(today) && !activeDates.includes(yesterdayStr)) {
      return 0;
    }

    let streak = 0;
    const cursor = new Date();
    // If today has no activity, start from yesterday
    if (!activeDates.includes(today)) {
      cursor.setDate(cursor.getDate() - 1);
    }

    while (true) {
      const dateStr = cursor.toISOString().split("T")[0];
      if (activeDates.includes(dateStr)) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  } catch (error) {
    console.error("[UserAnalytics] Streak calculation error:", error);
    return 0;
  }
}

module.exports = {
  getOverview,
  getDailyBreakdown,
  getTimeline,
  getWeeklyChart,
};
