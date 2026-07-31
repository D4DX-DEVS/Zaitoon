const QuizAttempt = require("../models/quizAttempt");
const StoryPuzzleAttempt = require("../models/storyPuzzleAttempt");
const PuzzleAttempt = require("../models/puzzleAttempt");

/**
 * GET /api/leaderboard
 * Global leaderboard combining quiz scores + story puzzle stars.
 *
 * Query params:
 *   period  – "weekly" | "monthly" | "alltime" (default: alltime)
 *   page    – page number (default: 1)
 *   limit   – results per page (default: 20, max: 100)
 */
async function getGlobalLeaderboard(req, res) {
  try {
    const { period = "alltime", page = 1, limit = 20, search = "" } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const searchTerm = search.trim().toLowerCase();

    // ── 1. Build time filter ────────────────────────────────────────────────
    let timeFilter = {};
    if (period === "weekly") {
      timeFilter.createdAt = {
        $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      };
    } else if (period === "monthly") {
      timeFilter.createdAt = {
        $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      };
    }

    // ── 2. Aggregate quiz scores by userId (join User for name + firebaseUid) ─
    const quizAgg = await QuizAttempt.aggregate([
      { $match: timeFilter },
      {
        $group: {
          _id: "$userId",
          quizPoints: { $sum: "$score" },
          quizAttempts: { $sum: 1 },
        },
      },
      { $match: { _id: { $ne: null } } },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $unwind: { path: "$user", preserveNullAndEmptyArrays: false },
      },
      {
        $project: {
          firebaseUid: "$user.firebaseUid",
          name: "$user.name",
          userClass: "$user.class",
          quizPoints: 1,
          quizAttempts: 1,
        },
      },
    ]);

    // ── 3. Aggregate story-puzzle stars by firebaseUid ──────────────────────
    const puzzleAgg = await StoryPuzzleAttempt.aggregate([
      { $match: timeFilter },
      {
        $group: {
          _id: "$firebaseUid",
          starsEarned: { $sum: "$starsEarned" },
          puzzlesCompleted: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "firebaseUid",
          as: "user",
        },
      },
      {
        $project: {
          firebaseUid: "$_id",
          name: {
            $ifNull: [{ $arrayElemAt: ["$user.name", 0] }, ""],
          },
          userClass: {
            $ifNull: [{ $arrayElemAt: ["$user.class", 0] }, ""],
          },
          starsEarned: 1,
          puzzlesCompleted: 1,
        },
      },
    ]);

    // ── 3b. Aggregate jigsaw puzzle stars by firebaseUid ───────────────────
    const jigsawAgg = await PuzzleAttempt.aggregate([
      { $match: timeFilter },
      {
        $group: {
          _id: "$firebaseUid",
          starsEarned: { $sum: "$starsEarned" },
          jigsawCompleted: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "firebaseUid",
          as: "user",
        },
      },
      {
        $project: {
          firebaseUid: "$_id",
          name: { $ifNull: [{ $arrayElemAt: ["$user.name", 0] }, ""] },
          userClass: { $ifNull: [{ $arrayElemAt: ["$user.class", 0] }, ""] },
          starsEarned: 1,
          jigsawCompleted: 1,
        },
      },
    ]);

    // ── 4. Merge by firebaseUid ─────────────────────────────────────────────
    const quizMap = new Map();
    for (const q of quizAgg) {
      if (!q.firebaseUid) continue;
      quizMap.set(q.firebaseUid, {
        name: q.name || "",
        userClass: q.userClass || "",
        quizPoints: q.quizPoints || 0,
        quizAttempts: q.quizAttempts || 0,
      });
    }

    const puzzleMap = new Map();
    for (const p of puzzleAgg) {
      if (!p.firebaseUid) continue;
      puzzleMap.set(p.firebaseUid, {
        name: p.name || "",
        userClass: p.userClass || "",
        starsEarned: p.starsEarned || 0,
        puzzlesCompleted: p.puzzlesCompleted || 0,
      });
    }

    const jigsawMap = new Map();
    for (const j of jigsawAgg) {
      if (!j.firebaseUid) continue;
      jigsawMap.set(j.firebaseUid, {
        name: j.name || "",
        userClass: j.userClass || "",
        starsEarned: j.starsEarned || 0,
        jigsawCompleted: j.jigsawCompleted || 0,
      });
    }

    const allUids = new Set([...quizMap.keys(), ...puzzleMap.keys(), ...jigsawMap.keys()]);

    const combined = [];
    for (const uid of allUids) {
      const q = quizMap.get(uid) || {};
      const p = puzzleMap.get(uid) || {};
      const j = jigsawMap.get(uid) || {};
      const quizPoints = q.quizPoints || 0;
      const puzzlePoints = ((p.starsEarned || 0) + (j.starsEarned || 0)) * 10;
      combined.push({
        firebaseUid: uid,
        name: q.name || p.name || j.name || "Unknown",
        userClass: q.userClass || p.userClass || j.userClass || "",
        quizPoints,
        puzzlePoints,
        quizAttempts: q.quizAttempts || 0,
        puzzlesCompleted: (p.puzzlesCompleted || 0) + (j.jigsawCompleted || 0),
        totalPoints: quizPoints + puzzlePoints,
      });
    }

    // ── 5. Search filter → sort → paginate → add rank ──────────────────────
    const filtered = searchTerm
      ? combined.filter(e =>
          e.name.toLowerCase().includes(searchTerm) ||
          e.firebaseUid.toLowerCase().includes(searchTerm) ||
          (e.userClass || '').toLowerCase().includes(searchTerm)
        )
      : combined;

    filtered.sort((a, b) => b.totalPoints - a.totalPoints);

    const total = filtered.length;
    const start = (pageNum - 1) * limitNum;
    const page_data = filtered.slice(start, start + limitNum);
    page_data.forEach((entry, i) => {
      entry.rank = start + i + 1;
    });

    return res.json({
      success: true,
      data: {
        leaderboard: page_data,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum) || 1,
        },
        period,
      },
    });
  } catch (error) {
    console.error("[Leaderboard] getGlobalLeaderboard error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching leaderboard",
    });
  }
}

module.exports = { getGlobalLeaderboard };
