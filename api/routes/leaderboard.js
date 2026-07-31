const express = require("express");
const router = express.Router();
const { getGlobalLeaderboard } = require("../controllers/leaderboardController");

// GET /api/leaderboard  – public global leaderboard
router.get("/", getGlobalLeaderboard);

module.exports = router;
