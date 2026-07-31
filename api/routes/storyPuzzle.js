const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/storyPuzzleController");
const { authenticateToken, authenticateFirebaseToken } = require("../middleware/auth");

// ─── Public: Content ─────────────────────────────────────────────────────────
router.get("/", ctrl.getAllPuzzles);
router.get("/leaderboard", ctrl.getLeaderboard);
router.get("/:id", ctrl.getPuzzleById);

// ─── Admin: Content CRUD ─────────────────────────────────────────────────────
router.post("/", authenticateToken, ctrl.createPuzzle);
router.put("/:id", authenticateToken, ctrl.updatePuzzle);
router.delete("/:id", authenticateToken, ctrl.deletePuzzle);

// ─── Authenticated: Attempts ─────────────────────────────────────────────────
router.post("/attempts", authenticateFirebaseToken, ctrl.submitAttempt);
router.get("/attempts/me", authenticateFirebaseToken, ctrl.getMyAttempts);
router.get("/attempts/me/:puzzleId", authenticateFirebaseToken, ctrl.getMyBestAttempt);

module.exports = router;
