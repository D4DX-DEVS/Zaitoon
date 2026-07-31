const AnalyticsEvent = require("../models/analyticsEvent");
const DailyAnalyticsSummary = require("../models/dailyAnalyticsSummary");

/**
 * Daily Analytics Aggregation Job
 * 
 * Runs every day at 2:00 AM to compute the previous day's summary
 * from raw analytics events and upsert into DailyAnalyticsSummary.
 */

async function aggregateDailySummary(targetDate) {
  const dateStr = targetDate.toISOString().slice(0, 10);
  const startOfDay = new Date(dateStr + "T00:00:00.000Z");
  const endOfDay = new Date(dateStr + "T23:59:59.999Z");
  const dateMatch = { createdAt: { $gte: startOfDay, $lte: endOfDay } };

  console.log(`[DailyAggregator] Aggregating analytics for ${dateStr}...`);

  try {
    const [
      activeUsersResult,
      newUsersCount,
      sessionStats,
      videoStats,
      storyStats,
      singleStoryStats,
      brightboxStats,
      quizStats,
      puzzleStats,
      kidsCornerViewStats,
      kidsCornerSubmitStats,
      bookmarkStats,
      topContentResult,
    ] = await Promise.all([
      // Active users
      AnalyticsEvent.distinct("firebaseUid", dateMatch),

      // New users
      (async () => {
        const User = require("../models/user");
        return User.countDocuments({ createdAt: { $gte: startOfDay, $lte: endOfDay } });
      })(),

      // Session stats
      AnalyticsEvent.aggregate([
        { $match: { ...dateMatch, eventCategory: "session" } },
        {
          $facet: {
            sessions: [
              { $match: { eventType: "app_open" } },
              { $group: { _id: null, count: { $sum: 1 } } },
            ],
            duration: [
              { $match: { eventType: "app_close", duration: { $gt: 0 } } },
              { $group: { _id: null, avg: { $avg: "$duration" } } },
            ],
          },
        },
      ]),

      // Video stats
      AnalyticsEvent.aggregate([
        { $match: { ...dateMatch, eventCategory: "video" } },
        {
          $facet: {
            plays: [
              { $match: { eventType: "video_play" } },
              {
                $group: {
                  _id: null,
                  count: { $sum: 1 },
                  uniqueViewers: { $addToSet: "$firebaseUid" },
                },
              },
              { $project: { count: 1, uniqueViewers: { $size: "$uniqueViewers" } } },
            ],
            watchTime: [
              { $match: { eventType: { $in: ["video_progress", "video_complete"] }, duration: { $gt: 0 } } },
              { $group: { _id: null, total: { $sum: "$duration" }, avg: { $avg: "$duration" } } },
            ],
            completions: [
              { $match: { eventType: "video_complete" } },
              { $group: { _id: null, count: { $sum: 1 } } },
            ],
          },
        },
      ]),

      // Story stats (all stories / series)
      aggregateStoryType(dateMatch, "story", "story_open", "story_complete"),

      // Single story stats
      aggregateStoryType(dateMatch, "single_story", "single_story_open", "single_story_complete"),

      // BrightBox stats
      aggregateStoryType(dateMatch, "brightbox", "brightbox_open", "brightbox_complete"),

      // Quiz stats
      AnalyticsEvent.aggregate([
        { $match: { ...dateMatch, eventCategory: "quiz" } },
        {
          $facet: {
            starts: [
              { $match: { eventType: "quiz_start" } },
              {
                $group: {
                  _id: null,
                  count: { $sum: 1 },
                  uniqueParticipants: { $addToSet: "$firebaseUid" },
                },
              },
              { $project: { count: 1, uniqueParticipants: { $size: "$uniqueParticipants" } } },
            ],
            completes: [
              { $match: { eventType: "quiz_complete" } },
              {
                $group: {
                  _id: null,
                  count: { $sum: 1 },
                  avgScore: { $avg: "$metadata.score" },
                  avgDuration: { $avg: "$duration" },
                },
              },
            ],
          },
        },
      ]),

      // Puzzle stats
      AnalyticsEvent.aggregate([
        { $match: { ...dateMatch, eventCategory: "puzzle" } },
        {
          $facet: {
            starts: [
              { $match: { eventType: "puzzle_start" } },
              {
                $group: {
                  _id: null,
                  count: { $sum: 1 },
                  uniqueParticipants: { $addToSet: "$firebaseUid" },
                },
              },
              { $project: { count: 1, uniqueParticipants: { $size: "$uniqueParticipants" } } },
            ],
            completes: [
              { $match: { eventType: "puzzle_complete" } },
              {
                $group: {
                  _id: null,
                  count: { $sum: 1 },
                  avgTimeTaken: { $avg: "$duration" },
                },
              },
            ],
          },
        },
      ]),

      // Kids Corner views
      AnalyticsEvent.aggregate([
        { $match: { ...dateMatch, eventType: "kids_corner_view" } },
        {
          $group: {
            _id: null,
            views: { $sum: 1 },
            uniqueViewers: { $addToSet: "$firebaseUid" },
          },
        },
        { $project: { views: 1, uniqueViewers: { $size: "$uniqueViewers" } } },
      ]),

      // Kids Corner submissions by type
      AnalyticsEvent.aggregate([
        { $match: { ...dateMatch, eventType: "kids_corner_submit" } },
        { $group: { _id: "$metadata.contentType", count: { $sum: 1 } } },
      ]),

      // Bookmarks
      AnalyticsEvent.aggregate([
        { $match: { ...dateMatch, eventCategory: "bookmark" } },
        {
          $facet: {
            added: [
              { $match: { eventType: "bookmark_add" } },
              {
                $group: {
                  _id: null,
                  count: { $sum: 1 },
                  uniqueUsers: { $addToSet: "$firebaseUid" },
                },
              },
              { $project: { count: 1, uniqueUsers: { $size: "$uniqueUsers" } } },
            ],
            removed: [
              { $match: { eventType: "bookmark_remove" } },
              { $group: { _id: null, count: { $sum: 1 } } },
            ],
          },
        },
      ]),

      // Top content (top 10 most accessed)
      AnalyticsEvent.aggregate([
        { $match: { ...dateMatch, contentId: { $ne: null } } },
        {
          $group: {
            _id: { contentId: "$contentId", contentType: "$contentType" },
            title: { $first: "$contentTitle" },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
        {
          $project: {
            _id: 0,
            contentId: "$_id.contentId",
            contentType: "$_id.contentType",
            title: 1,
            count: 1,
          },
        },
      ]),
    ]);

    // Build video summary
    const videoPlays = videoStats[0]?.plays?.[0] || { count: 0, uniqueViewers: 0 };
    const videoWatchTime = videoStats[0]?.watchTime?.[0] || { total: 0, avg: 0 };
    const videoCompletions = videoStats[0]?.completions?.[0]?.count || 0;

    // Build quiz summary
    const quizStarts = quizStats[0]?.starts?.[0] || { count: 0, uniqueParticipants: 0 };
    const quizCompletes = quizStats[0]?.completes?.[0] || { count: 0, avgScore: 0, avgDuration: 0 };

    // Build puzzle summary
    const puzzleStarts = puzzleStats[0]?.starts?.[0] || { count: 0, uniqueParticipants: 0 };
    const puzzleCompletes = puzzleStats[0]?.completes?.[0] || { count: 0, avgTimeTaken: 0 };

    // Build kids corner submissions map
    const kcSubmissions = { stories: 0, poems: 0, drawings: 0 };
    kidsCornerSubmitStats.forEach((s) => {
      const key = s._id;
      if (key === "story") kcSubmissions.stories = s.count;
      else if (key === "poem") kcSubmissions.poems = s.count;
      else if (key === "drawing") kcSubmissions.drawings = s.count;
    });

    // Build bookmark summary
    const bmAdded = bookmarkStats[0]?.added?.[0] || { count: 0, uniqueUsers: 0 };
    const bmRemoved = bookmarkStats[0]?.removed?.[0]?.count || 0;

    // Calculate total read time from all story types
    const totalReadTime =
      (storyStats.totalReadTime || 0) +
      (singleStoryStats.totalReadTime || 0) +
      (brightboxStats.totalReadTime || 0);

    const summaryDoc = {
      date: startOfDay,
      totalActiveUsers: activeUsersResult.length,
      newUsers: newUsersCount,
      totalSessions: sessionStats[0]?.sessions?.[0]?.count || 0,
      avgSessionDuration: Math.round(sessionStats[0]?.duration?.[0]?.avg || 0),

      video: {
        totalViews: videoPlays.count,
        uniqueViewers: videoPlays.uniqueViewers,
        totalWatchTime: Math.round(videoWatchTime.total),
        avgWatchTime: Math.round(videoWatchTime.avg),
        completionRate: videoPlays.count > 0 ? Math.round((videoCompletions / videoPlays.count) * 100) : 0,
      },

      stories: {
        allStories: {
          opens: storyStats.opens,
          completes: storyStats.completes,
          uniqueReaders: storyStats.uniqueReaders,
        },
        singleStories: {
          opens: singleStoryStats.opens,
          completes: singleStoryStats.completes,
          uniqueReaders: singleStoryStats.uniqueReaders,
        },
        brightbox: {
          opens: brightboxStats.opens,
          completes: brightboxStats.completes,
          uniqueReaders: brightboxStats.uniqueReaders,
        },
        totalReadTime: Math.round(totalReadTime),
      },

      quiz: {
        attempts: quizStarts.count,
        uniqueParticipants: quizStarts.uniqueParticipants,
        avgScore: Math.round((quizCompletes.avgScore || 0) * 10) / 10,
        avgDuration: Math.round(quizCompletes.avgDuration || 0),
        completionRate: quizStarts.count > 0 ? Math.round((quizCompletes.count / quizStarts.count) * 100) : 0,
      },

      puzzle: {
        attempts: puzzleStarts.count,
        uniqueParticipants: puzzleStarts.uniqueParticipants,
        avgTimeTaken: Math.round(puzzleCompletes.avgTimeTaken || 0),
        completionRate: puzzleStarts.count > 0 ? Math.round((puzzleCompletes.count / puzzleStarts.count) * 100) : 0,
      },

      kidsCorner: {
        views: kidsCornerViewStats[0]?.views || 0,
        uniqueViewers: kidsCornerViewStats[0]?.uniqueViewers || 0,
        submissions: kcSubmissions,
      },

      bookmarks: {
        added: bmAdded.count,
        removed: bmRemoved,
        uniqueUsers: bmAdded.uniqueUsers,
      },

      topContent: topContentResult,
    };

    // Upsert — update if exists, create if not
    await DailyAnalyticsSummary.findOneAndUpdate(
      { date: startOfDay },
      { $set: summaryDoc },
      { upsert: true, new: true }
    );

    console.log(`[DailyAggregator] ✅ Summary for ${dateStr} saved — ${activeUsersResult.length} active users, ${summaryDoc.totalSessions} sessions`);
    return summaryDoc;
  } catch (error) {
    console.error(`[DailyAggregator] ❌ Error aggregating for ${dateStr}:`, error.message);
    throw error;
  }
}

// Helper to aggregate opens/completes/readers for a story type
async function aggregateStoryType(dateMatch, category, openEvent, completeEvent) {
  const result = await AnalyticsEvent.aggregate([
    { $match: { ...dateMatch, eventCategory: category } },
    {
      $facet: {
        opens: [
          { $match: { eventType: openEvent } },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              uniqueReaders: { $addToSet: "$firebaseUid" },
            },
          },
          { $project: { count: 1, uniqueReaders: { $size: "$uniqueReaders" } } },
        ],
        completes: [
          { $match: { eventType: completeEvent } },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              totalReadTime: { $sum: { $ifNull: ["$duration", 0] } },
            },
          },
        ],
      },
    },
  ]);

  const opens = result[0]?.opens?.[0] || { count: 0, uniqueReaders: 0 };
  const completes = result[0]?.completes?.[0] || { count: 0, totalReadTime: 0 };

  return {
    opens: opens.count,
    completes: completes.count,
    uniqueReaders: opens.uniqueReaders,
    totalReadTime: completes.totalReadTime,
  };
}

/**
 * Start the daily aggregation scheduler.
 * Runs every day at 2:00 AM server time.
 */
function startDailyAnalyticsAggregator() {
  const AGGREGATION_HOUR = 2; // 2 AM

  const scheduleNext = () => {
    const now = new Date();
    const next = new Date(now);
    next.setHours(AGGREGATION_HOUR, 0, 0, 0);

    // If already past 2 AM today, schedule for tomorrow
    if (now >= next) {
      next.setDate(next.getDate() + 1);
    }

    const msUntilNext = next.getTime() - now.getTime();
    console.log(
      `[DailyAggregator] Next aggregation scheduled at ${next.toISOString()} (in ${Math.round(msUntilNext / 60000)} minutes)`
    );

    setTimeout(async () => {
      try {
        // Aggregate yesterday's data
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        await aggregateDailySummary(yesterday);
      } catch (error) {
        console.error("[DailyAggregator] Scheduled aggregation failed:", error.message);
      }

      // Schedule next run
      scheduleNext();
    }, msUntilNext);
  };

  // Do an initial aggregation for yesterday on startup (after 60 seconds)
  setTimeout(async () => {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      await aggregateDailySummary(yesterday);
    } catch (error) {
      console.error("[DailyAggregator] Initial aggregation failed:", error.message);
    }
  }, 60 * 1000);

  scheduleNext();
  console.log("[DailyAggregator] Daily analytics aggregation job started");
}

module.exports = {
  aggregateDailySummary,
  startDailyAnalyticsAggregator,
};
