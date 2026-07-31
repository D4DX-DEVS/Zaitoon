const AnalyticsEvent = require("../models/analyticsEvent");
const DailyAnalyticsSummary = require("../models/dailyAnalyticsSummary");
const User = require("../models/user");

// ──────────── Helpers ────────────

function parseDateRange(req) {
  const { from, to } = req.query;
  const now = new Date();
  const startDate = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
  const endDate = to ? new Date(new Date(to).setHours(23, 59, 59, 999)) : new Date(now.setHours(23, 59, 59, 999));
  return { startDate, endDate };
}

function buildDateMatch(startDate, endDate) {
  return { createdAt: { $gte: startDate, $lte: endDate } };
}

// ──────────── 1. Overview Dashboard ────────────

/**
 * GET /api/admin/analytics/overview?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
async function getOverview(req, res) {
  try {
    const { startDate, endDate } = parseDateRange(req);
    const dateMatch = buildDateMatch(startDate, endDate);

    // Run all aggregations in parallel
    const [
      activeUsersResult,
      newUsersCount,
      sessionsResult,
      featureUsageResult,
      dailyTrendResult,
    ] = await Promise.all([
      // Total unique active users in date range
      AnalyticsEvent.distinct("firebaseUid", dateMatch),

      // New users registered in date range
      User.countDocuments({
        createdAt: { $gte: startDate, $lte: endDate },
      }),

      // Session stats
      AnalyticsEvent.aggregate([
        { $match: { ...dateMatch, eventType: "app_open" } },
        {
          $group: {
            _id: null,
            totalSessions: { $sum: 1 },
          },
        },
      ]),

      // Feature usage counts
      AnalyticsEvent.aggregate([
        { $match: dateMatch },
        {
          $group: {
            _id: "$eventCategory",
            count: { $sum: 1 },
            uniqueUsers: { $addToSet: "$firebaseUid" },
          },
        },
        {
          $project: {
            _id: 1,
            count: 1,
            uniqueUsers: { $size: "$uniqueUsers" },
          },
        },
      ]),

      // Daily active users trend
      AnalyticsEvent.aggregate([
        { $match: dateMatch },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            activeUsers: { $addToSet: "$firebaseUid" },
            sessions: {
              $sum: { $cond: [{ $eq: ["$eventType", "app_open"] }, 1, 0] },
            },
          },
        },
        {
          $project: {
            date: "$_id",
            _id: 0,
            activeUsers: { $size: "$activeUsers" },
            sessions: 1,
          },
        },
        { $sort: { date: 1 } },
      ]),
    ]);

    // Session duration average
    const sessionDurationResult = await AnalyticsEvent.aggregate([
      { $match: { ...dateMatch, eventType: "app_close", duration: { $gt: 0 } } },
      {
        $group: {
          _id: null,
          avgDuration: { $avg: "$duration" },
          totalDuration: { $sum: "$duration" },
        },
      },
    ]);

    // Build feature usage map
    const featureMap = {};
    featureUsageResult.forEach((f) => {
      featureMap[f._id] = { count: f.count, uniqueUsers: f.uniqueUsers };
    });

    const totalActiveUsers = activeUsersResult.length;
    const totalSessions = sessionsResult[0]?.totalSessions || 0;
    const avgSessionDuration = Math.round(sessionDurationResult[0]?.avgDuration || 0);
    const totalDuration = sessionDurationResult[0]?.totalDuration || 0;

    // Calculate avg time per user per day
    const dayCount = Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)));
    const avgTimePerUserPerDay = totalActiveUsers > 0
      ? Math.round(totalDuration / totalActiveUsers / dayCount)
      : 0;

    return res.status(200).json({
      success: true,
      data: {
        dateRange: {
          from: startDate.toISOString().slice(0, 10),
          to: endDate.toISOString().slice(0, 10),
        },
        summary: {
          totalActiveUsers,
          newUsers: newUsersCount,
          totalSessions,
          avgSessionDuration,
          avgTimePerUserPerDay,
        },
        featureUsage: {
          video: featureMap.video || { count: 0, uniqueUsers: 0 },
          story: featureMap.story || { count: 0, uniqueUsers: 0 },
          single_story: featureMap.single_story || { count: 0, uniqueUsers: 0 },
          brightbox: featureMap.brightbox || { count: 0, uniqueUsers: 0 },
          quiz: featureMap.quiz || { count: 0, uniqueUsers: 0 },
          puzzle: featureMap.puzzle || { count: 0, uniqueUsers: 0 },
          kids_corner: featureMap.kids_corner || { count: 0, uniqueUsers: 0 },
          bookmark: featureMap.bookmark || { count: 0, uniqueUsers: 0 },
        },
        dailyTrend: dailyTrendResult,
      },
    });
  } catch (error) {
    console.error("[AdminAnalytics] getOverview error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to get overview." });
  }
}

// ──────────── 2. Video Analytics ────────────

/**
 * GET /api/admin/analytics/videos?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
async function getVideoAnalytics(req, res) {
  try {
    const { startDate, endDate } = parseDateRange(req);
    const dateMatch = buildDateMatch(startDate, endDate);

    const [summary, topVideos, byCategory, byLanguage, dailyTrend] = await Promise.all([
      // Summary stats
      AnalyticsEvent.aggregate([
        { $match: { ...dateMatch, eventCategory: "video" } },
        {
          $facet: {
            plays: [
              { $match: { eventType: "video_play" } },
              {
                $group: {
                  _id: null,
                  totalViews: { $sum: 1 },
                  uniqueViewers: { $addToSet: "$firebaseUid" },
                },
              },
              {
                $project: {
                  totalViews: 1,
                  uniqueViewers: { $size: "$uniqueViewers" },
                },
              },
            ],
            watchTime: [
              { $match: { eventType: { $in: ["video_progress", "video_complete"] }, duration: { $gt: 0 } } },
              {
                $group: {
                  _id: null,
                  totalWatchTime: { $sum: "$duration" },
                  avgWatchTime: { $avg: "$duration" },
                },
              },
            ],
            completions: [
              { $match: { eventType: "video_complete" } },
              { $group: { _id: null, count: { $sum: 1 } } },
            ],
          },
        },
      ]),

      // Top 10 most watched
      AnalyticsEvent.aggregate([
        { $match: { ...dateMatch, eventType: "video_play" } },
        {
          $group: {
            _id: "$contentId",
            title: { $first: "$contentTitle" },
            views: { $sum: 1 },
            uniqueViewers: { $addToSet: "$firebaseUid" },
          },
        },
        { $project: { _id: 0, contentId: "$_id", title: 1, views: 1, uniqueViewers: { $size: "$uniqueViewers" } } },
        { $sort: { views: -1 } },
        { $limit: 10 },
      ]),

      // By category
      AnalyticsEvent.aggregate([
        { $match: { ...dateMatch, eventType: "video_play", "metadata.categoryName": { $exists: true } } },
        {
          $group: {
            _id: "$metadata.categoryName",
            views: { $sum: 1 },
          },
        },
        { $project: { _id: 0, category: "$_id", views: 1 } },
        { $sort: { views: -1 } },
      ]),

      // By language
      AnalyticsEvent.aggregate([
        { $match: { ...dateMatch, eventType: "video_play", "metadata.language": { $exists: true } } },
        {
          $group: {
            _id: "$metadata.language",
            views: { $sum: 1 },
          },
        },
        { $project: { _id: 0, language: "$_id", views: 1 } },
      ]),

      // Daily trend
      AnalyticsEvent.aggregate([
        { $match: { ...dateMatch, eventType: "video_play" } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            views: { $sum: 1 },
            uniqueViewers: { $addToSet: "$firebaseUid" },
          },
        },
        {
          $project: {
            date: "$_id",
            _id: 0,
            views: 1,
            uniqueViewers: { $size: "$uniqueViewers" },
          },
        },
        { $sort: { date: 1 } },
      ]),
    ]);

    const plays = summary[0]?.plays?.[0] || { totalViews: 0, uniqueViewers: 0 };
    const watchTime = summary[0]?.watchTime?.[0] || { totalWatchTime: 0, avgWatchTime: 0 };
    const completions = summary[0]?.completions?.[0]?.count || 0;
    const completionRate = plays.totalViews > 0
      ? Math.round((completions / plays.totalViews) * 100)
      : 0;

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          totalViews: plays.totalViews,
          uniqueViewers: plays.uniqueViewers,
          totalWatchTime: Math.round(watchTime.totalWatchTime),
          avgWatchTime: Math.round(watchTime.avgWatchTime),
          completionRate,
        },
        topVideos,
        byCategory,
        byLanguage,
        dailyTrend,
      },
    });
  } catch (error) {
    console.error("[AdminAnalytics] getVideoAnalytics error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to get video analytics." });
  }
}

// ──────────── 3. Stories Analytics ────────────

/**
 * GET /api/admin/analytics/stories?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
async function getStoryAnalytics(req, res) {
  try {
    const { startDate, endDate } = parseDateRange(req);
    const dateMatch = buildDateMatch(startDate, endDate);

    const storyTypes = [
      { key: "allStories", category: "story", openEvent: "story_open", completeEvent: "story_complete" },
      { key: "singleStories", category: "single_story", openEvent: "single_story_open", completeEvent: "single_story_complete" },
      { key: "brightbox", category: "brightbox", openEvent: "brightbox_open", completeEvent: "brightbox_complete" },
    ];

    const results = {};

    // Process each story type
    for (const st of storyTypes) {
      const [statsResult, topStoriesResult] = await Promise.all([
        AnalyticsEvent.aggregate([
          { $match: { ...dateMatch, eventCategory: st.category } },
          {
            $facet: {
              opens: [
                { $match: { eventType: st.openEvent } },
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
                { $match: { eventType: st.completeEvent } },
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
        ]),

        AnalyticsEvent.aggregate([
          { $match: { ...dateMatch, eventType: st.openEvent } },
          {
            $group: {
              _id: "$contentId",
              title: { $first: "$contentTitle" },
              reads: { $sum: 1 },
              uniqueReaders: { $addToSet: "$firebaseUid" },
            },
          },
          { $project: { _id: 0, contentId: "$_id", title: 1, reads: 1, uniqueReaders: { $size: "$uniqueReaders" } } },
          { $sort: { reads: -1 } },
          { $limit: 10 },
        ]),
      ]);

      const opens = statsResult[0]?.opens?.[0] || { count: 0, uniqueReaders: 0 };
      const completes = statsResult[0]?.completes?.[0] || { count: 0, totalReadTime: 0 };

      results[st.key] = {
        opens: opens.count,
        completes: completes.count,
        uniqueReaders: opens.uniqueReaders,
        totalReadTime: Math.round(completes.totalReadTime),
        completionRate: opens.count > 0 ? Math.round((completes.count / opens.count) * 100) : 0,
        topStories: topStoriesResult,
      };
    }

    // Daily trend (all story types combined)
    const dailyTrend = await AnalyticsEvent.aggregate([
      {
        $match: {
          ...dateMatch,
          eventCategory: { $in: ["story", "single_story", "brightbox"] },
          eventType: { $regex: /_open$/ },
        },
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            category: "$eventCategory",
          },
          reads: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: "$_id.date",
          breakdown: {
            $push: { category: "$_id.category", reads: "$reads" },
          },
          totalReads: { $sum: "$reads" },
        },
      },
      { $project: { date: "$_id", _id: 0, totalReads: 1, breakdown: 1 } },
      { $sort: { date: 1 } },
    ]);

    // Per-child average
    const totalUniqueReaders = await AnalyticsEvent.distinct("firebaseUid", {
      ...dateMatch,
      eventCategory: { $in: ["story", "single_story", "brightbox"] },
    });

    const totalStoryOpens =
      results.allStories.opens + results.singleStories.opens + results.brightbox.opens;
    const avgPerChild = totalUniqueReaders.length > 0
      ? Math.round((totalStoryOpens / totalUniqueReaders.length) * 10) / 10
      : 0;

    return res.status(200).json({
      success: true,
      data: {
        ...results,
        avgStoriesPerChild: avgPerChild,
        totalUniqueReaders: totalUniqueReaders.length,
        dailyTrend,
      },
    });
  } catch (error) {
    console.error("[AdminAnalytics] getStoryAnalytics error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to get story analytics." });
  }
}

// ──────────── 4. Quiz Analytics ────────────

/**
 * GET /api/admin/analytics/quiz?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
async function getQuizAnalytics(req, res) {
  try {
    const { startDate, endDate } = parseDateRange(req);
    const dateMatch = buildDateMatch(startDate, endDate);

    const [summary, dailyTrend, languageBreakdown, scoreDistribution] = await Promise.all([
      // Summary
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
                  avgPercentage: { $avg: "$metadata.percentage" },
                  avgDuration: { $avg: "$duration" },
                },
              },
            ],
            abandons: [
              { $match: { eventType: "quiz_abandon" } },
              { $group: { _id: null, count: { $sum: 1 } } },
            ],
          },
        },
      ]),

      // Daily trend
      AnalyticsEvent.aggregate([
        { $match: { ...dateMatch, eventCategory: "quiz", eventType: { $in: ["quiz_start", "quiz_complete"] } } },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
              type: "$eventType",
            },
            count: { $sum: 1 },
          },
        },
        {
          $group: {
            _id: "$_id.date",
            breakdown: { $push: { type: "$_id.type", count: "$count" } },
          },
        },
        { $project: { date: "$_id", _id: 0, breakdown: 1 } },
        { $sort: { date: 1 } },
      ]),

      // Language breakdown
      AnalyticsEvent.aggregate([
        { $match: { ...dateMatch, eventType: "quiz_start", "metadata.language": { $exists: true } } },
        {
          $group: {
            _id: "$metadata.language",
            count: { $sum: 1 },
          },
        },
        { $project: { _id: 0, language: "$_id", count: 1 } },
      ]),

      // Score distribution (buckets: 0-20, 20-40, 40-60, 60-80, 80-100)
      AnalyticsEvent.aggregate([
        { $match: { ...dateMatch, eventType: "quiz_complete", "metadata.percentage": { $exists: true } } },
        {
          $bucket: {
            groupBy: "$metadata.percentage",
            boundaries: [0, 20, 40, 60, 80, 101],
            default: "other",
            output: { count: { $sum: 1 } },
          },
        },
      ]),
    ]);

    const starts = summary[0]?.starts?.[0] || { count: 0, uniqueParticipants: 0 };
    const completes = summary[0]?.completes?.[0] || { count: 0, avgScore: 0, avgPercentage: 0, avgDuration: 0 };
    const abandons = summary[0]?.abandons?.[0]?.count || 0;
    const completionRate = starts.count > 0
      ? Math.round((completes.count / starts.count) * 100)
      : 0;

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          totalAttempts: starts.count,
          completedAttempts: completes.count,
          abandonedAttempts: abandons,
          uniqueParticipants: starts.uniqueParticipants,
          avgScore: Math.round((completes.avgScore || 0) * 10) / 10,
          avgPercentage: Math.round((completes.avgPercentage || 0) * 10) / 10,
          avgDuration: Math.round(completes.avgDuration || 0),
          completionRate,
        },
        languageBreakdown,
        scoreDistribution,
        dailyTrend,
      },
    });
  } catch (error) {
    console.error("[AdminAnalytics] getQuizAnalytics error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to get quiz analytics." });
  }
}

// ──────────── 5. Puzzle Analytics ────────────

/**
 * GET /api/admin/analytics/puzzle?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
async function getPuzzleAnalytics(req, res) {
  try {
    const { startDate, endDate } = parseDateRange(req);
    const dateMatch = buildDateMatch(startDate, endDate);

    const [summary, byDifficulty, dailyTrend] = await Promise.all([
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
                  avgScore: { $avg: "$metadata.score" },
                },
              },
            ],
            abandons: [
              { $match: { eventType: "puzzle_abandon" } },
              { $group: { _id: null, count: { $sum: 1 } } },
            ],
          },
        },
      ]),

      // By difficulty
      AnalyticsEvent.aggregate([
        { $match: { ...dateMatch, eventCategory: "puzzle", "metadata.difficulty": { $exists: true } } },
        {
          $group: {
            _id: "$metadata.difficulty",
            attempts: { $sum: 1 },
            completes: { $sum: { $cond: [{ $eq: ["$eventType", "puzzle_complete"] }, 1, 0] } },
          },
        },
        { $project: { _id: 0, difficulty: "$_id", attempts: 1, completes: 1 } },
      ]),

      // Daily trend
      AnalyticsEvent.aggregate([
        { $match: { ...dateMatch, eventCategory: "puzzle", eventType: "puzzle_start" } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            attempts: { $sum: 1 },
            uniquePlayers: { $addToSet: "$firebaseUid" },
          },
        },
        {
          $project: {
            date: "$_id",
            _id: 0,
            attempts: 1,
            uniquePlayers: { $size: "$uniquePlayers" },
          },
        },
        { $sort: { date: 1 } },
      ]),
    ]);

    const starts = summary[0]?.starts?.[0] || { count: 0, uniqueParticipants: 0 };
    const completes = summary[0]?.completes?.[0] || { count: 0, avgTimeTaken: 0, avgScore: 0 };
    const abandons = summary[0]?.abandons?.[0]?.count || 0;

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          totalAttempts: starts.count,
          completedAttempts: completes.count,
          abandonedAttempts: abandons,
          uniqueParticipants: starts.uniqueParticipants,
          avgTimeTaken: Math.round(completes.avgTimeTaken || 0),
          avgScore: Math.round((completes.avgScore || 0) * 10) / 10,
          completionRate: starts.count > 0 ? Math.round((completes.count / starts.count) * 100) : 0,
        },
        byDifficulty,
        dailyTrend,
      },
    });
  } catch (error) {
    console.error("[AdminAnalytics] getPuzzleAnalytics error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to get puzzle analytics." });
  }
}

// ──────────── 6. Kids Corner Analytics ────────────

/**
 * GET /api/admin/analytics/kids-corner?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
async function getKidsCornerAnalytics(req, res) {
  try {
    const { startDate, endDate } = parseDateRange(req);
    const dateMatch = buildDateMatch(startDate, endDate);

    const [viewStats, submissionsByType, dailyTrend, topContent] = await Promise.all([
      // Views
      AnalyticsEvent.aggregate([
        { $match: { ...dateMatch, eventType: "kids_corner_view" } },
        {
          $group: {
            _id: null,
            totalViews: { $sum: 1 },
            uniqueViewers: { $addToSet: "$firebaseUid" },
          },
        },
        { $project: { totalViews: 1, uniqueViewers: { $size: "$uniqueViewers" } } },
      ]),

      // Submissions by type
      AnalyticsEvent.aggregate([
        { $match: { ...dateMatch, eventType: "kids_corner_submit" } },
        {
          $group: {
            _id: "$metadata.contentType",
            count: { $sum: 1 },
          },
        },
        { $project: { _id: 0, contentType: "$_id", count: 1 } },
      ]),

      // Daily trend
      AnalyticsEvent.aggregate([
        { $match: { ...dateMatch, eventCategory: "kids_corner" } },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
              type: "$eventType",
            },
            count: { $sum: 1 },
          },
        },
        {
          $group: {
            _id: "$_id.date",
            breakdown: { $push: { type: "$_id.type", count: "$count" } },
          },
        },
        { $project: { date: "$_id", _id: 0, breakdown: 1 } },
        { $sort: { date: 1 } },
      ]),

      // Most viewed content
      AnalyticsEvent.aggregate([
        { $match: { ...dateMatch, eventType: "kids_corner_view" } },
        {
          $group: {
            _id: "$contentId",
            title: { $first: "$contentTitle" },
            contentType: { $first: "$metadata.contentType" },
            views: { $sum: 1 },
          },
        },
        { $project: { _id: 0, contentId: "$_id", title: 1, contentType: 1, views: 1 } },
        { $sort: { views: -1 } },
        { $limit: 10 },
      ]),
    ]);

    const views = viewStats[0] || { totalViews: 0, uniqueViewers: 0 };

    // Build submissions map
    const submissions = { stories: 0, poems: 0, drawings: 0, total: 0 };
    submissionsByType.forEach((s) => {
      if (s.contentType && submissions.hasOwnProperty(s.contentType + "s")) {
        submissions[s.contentType + "s"] = s.count;
      } else if (s.contentType) {
        submissions[s.contentType] = s.count;
      }
      submissions.total += s.count;
    });

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          totalViews: views.totalViews,
          uniqueViewers: views.uniqueViewers,
          submissions,
        },
        topContent,
        dailyTrend,
      },
    });
  } catch (error) {
    console.error("[AdminAnalytics] getKidsCornerAnalytics error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to get kids corner analytics." });
  }
}

// ──────────── 7. Bookmark Analytics ────────────

/**
 * GET /api/admin/analytics/bookmarks?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
async function getBookmarkAnalytics(req, res) {
  try {
    const { startDate, endDate } = parseDateRange(req);
    const dateMatch = buildDateMatch(startDate, endDate);

    const [summary, byContentType, topBookmarked, dailyTrend] = await Promise.all([
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

      // By content type
      AnalyticsEvent.aggregate([
        { $match: { ...dateMatch, eventType: "bookmark_add" } },
        {
          $group: {
            _id: "$contentType",
            count: { $sum: 1 },
          },
        },
        { $project: { _id: 0, contentType: "$_id", count: 1 } },
      ]),

      // Most bookmarked content
      AnalyticsEvent.aggregate([
        { $match: { ...dateMatch, eventType: "bookmark_add" } },
        {
          $group: {
            _id: "$contentId",
            title: { $first: "$contentTitle" },
            contentType: { $first: "$contentType" },
            count: { $sum: 1 },
          },
        },
        { $project: { _id: 0, contentId: "$_id", title: 1, contentType: 1, count: 1 } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),

      // Daily trend
      AnalyticsEvent.aggregate([
        { $match: { ...dateMatch, eventCategory: "bookmark" } },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
              type: "$eventType",
            },
            count: { $sum: 1 },
          },
        },
        {
          $group: {
            _id: "$_id.date",
            breakdown: { $push: { type: "$_id.type", count: "$count" } },
          },
        },
        { $project: { date: "$_id", _id: 0, breakdown: 1 } },
        { $sort: { date: 1 } },
      ]),
    ]);

    const added = summary[0]?.added?.[0] || { count: 0, uniqueUsers: 0 };
    const removed = summary[0]?.removed?.[0]?.count || 0;

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          totalAdded: added.count,
          totalRemoved: removed,
          netBookmarks: added.count - removed,
          uniqueUsers: added.uniqueUsers,
        },
        byContentType,
        topBookmarked,
        dailyTrend,
      },
    });
  } catch (error) {
    console.error("[AdminAnalytics] getBookmarkAnalytics error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to get bookmark analytics." });
  }
}

// ──────────── 8. User Analytics ────────────

/**
 * GET /api/admin/analytics/users?from=YYYY-MM-DD&to=YYYY-MM-DD&page=1&limit=20
 */
async function getUserAnalytics(req, res) {
  try {
    const { startDate, endDate } = parseDateRange(req);
    const dateMatch = buildDateMatch(startDate, endDate);
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const [usersResult, totalCount] = await Promise.all([
      AnalyticsEvent.aggregate([
        { $match: dateMatch },
        {
          $group: {
            _id: "$firebaseUid",
            totalEvents: { $sum: 1 },
            sessions: {
              $sum: { $cond: [{ $eq: ["$eventType", "app_open"] }, 1, 0] },
            },
            totalDuration: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ["$eventType", "app_close"] }, { $gt: ["$duration", 0] }] },
                  "$duration",
                  0,
                ],
              },
            },
            videosWatched: {
              $sum: { $cond: [{ $eq: ["$eventType", "video_play"] }, 1, 0] },
            },
            storiesRead: {
              $sum: {
                $cond: [
                  { $in: ["$eventType", ["story_open", "single_story_open", "brightbox_open"]] },
                  1,
                  0,
                ],
              },
            },
            quizAttempts: {
              $sum: { $cond: [{ $eq: ["$eventType", "quiz_start"] }, 1, 0] },
            },
            puzzleAttempts: {
              $sum: { $cond: [{ $eq: ["$eventType", "puzzle_start"] }, 1, 0] },
            },
            lastActive: { $max: "$createdAt" },
          },
        },
        { $sort: { totalEvents: -1 } },
        { $skip: skip },
        { $limit: limit },
      ]),

      AnalyticsEvent.aggregate([
        { $match: dateMatch },
        { $group: { _id: "$firebaseUid" } },
        { $count: "total" },
      ]),
    ]);

    // Enrich with user profile data
    const firebaseUids = usersResult.map((u) => u._id);
    const users = await User.find({ firebaseUid: { $in: firebaseUids } })
      .select("name email class firebaseUid createdAt")
      .lean();
    const userMap = {};
    users.forEach((u) => {
      userMap[u.firebaseUid] = u;
    });

    const enrichedUsers = usersResult.map((u) => ({
      firebaseUid: u._id,
      name: userMap[u._id]?.name || "Unknown",
      email: userMap[u._id]?.email || "Unknown",
      class: userMap[u._id]?.class || "Unknown",
      registeredAt: userMap[u._id]?.createdAt || null,
      stats: {
        totalEvents: u.totalEvents,
        sessions: u.sessions,
        totalTimeSpent: u.totalDuration,
        avgSessionDuration: u.sessions > 0 ? Math.round(u.totalDuration / u.sessions) : 0,
        videosWatched: u.videosWatched,
        storiesRead: u.storiesRead,
        quizAttempts: u.quizAttempts,
        puzzleAttempts: u.puzzleAttempts,
      },
      lastActive: u.lastActive,
    }));

    const total = totalCount[0]?.total || 0;

    return res.status(200).json({
      success: true,
      data: {
        users: enrichedUsers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("[AdminAnalytics] getUserAnalytics error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to get user analytics." });
  }
}

/**
 * GET /api/admin/analytics/users/:firebaseUid?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
async function getUserDetail(req, res) {
  try {
    const { firebaseUid } = req.params;
    const { startDate, endDate } = parseDateRange(req);
    const dateMatch = { ...buildDateMatch(startDate, endDate), firebaseUid };

    const [user, eventBreakdown, recentEvents, dailyActivity] = await Promise.all([
      User.findOne({ firebaseUid })
        .select("name email class firebaseUid growthActivity createdAt")
        .lean(),

      // Event breakdown by category
      AnalyticsEvent.aggregate([
        { $match: dateMatch },
        {
          $group: {
            _id: "$eventCategory",
            count: { $sum: 1 },
            totalDuration: { $sum: { $ifNull: ["$duration", 0] } },
          },
        },
        { $project: { _id: 0, category: "$_id", count: 1, totalDuration: 1 } },
      ]),

      // Recent 50 events
      AnalyticsEvent.find(dateMatch)
        .sort({ createdAt: -1 })
        .limit(50)
        .select("eventType eventCategory contentTitle duration createdAt metadata")
        .lean(),

      // Daily activity
      AnalyticsEvent.aggregate([
        { $match: dateMatch },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            events: { $sum: 1 },
            sessionTime: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ["$eventType", "app_close"] }, { $gt: ["$duration", 0] }] },
                  "$duration",
                  0,
                ],
              },
            },
          },
        },
        { $project: { date: "$_id", _id: 0, events: 1, sessionTime: 1 } },
        { $sort: { date: 1 } },
      ]),
    ]);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    return res.status(200).json({
      success: true,
      data: {
        profile: {
          name: user.name,
          email: user.email,
          class: user.class,
          firebaseUid: user.firebaseUid,
          registeredAt: user.createdAt,
          growthActivity: user.growthActivity,
        },
        eventBreakdown,
        recentEvents,
        dailyActivity,
      },
    });
  } catch (error) {
    console.error("[AdminAnalytics] getUserDetail error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to get user detail." });
  }
}

// ──────────── 9. Real-time Stats ────────────

/**
 * GET /api/admin/analytics/realtime
 */
async function getRealtimeStats(req, res) {
  try {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const [activeUsers15m, activeUsers1h, recentSessions] = await Promise.all([
      AnalyticsEvent.distinct("firebaseUid", {
        createdAt: { $gte: fifteenMinutesAgo },
      }),

      AnalyticsEvent.distinct("firebaseUid", {
        createdAt: { $gte: oneHourAgo },
      }),

      AnalyticsEvent.aggregate([
        {
          $match: {
            createdAt: { $gte: oneHourAgo },
            eventType: "app_open",
          },
        },
        { $group: { _id: null, count: { $sum: 1 } } },
      ]),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        activeUsersLast15Min: activeUsers15m.length,
        activeUsersLastHour: activeUsers1h.length,
        sessionsLastHour: recentSessions[0]?.count || 0,
      },
    });
  } catch (error) {
    console.error("[AdminAnalytics] getRealtimeStats error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to get realtime stats." });
  }
}

module.exports = {
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
};
