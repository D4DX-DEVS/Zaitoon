const StoryPuzzle = require("../models/storyPuzzle");
const StoryPuzzleAttempt = require("../models/storyPuzzleAttempt");

// ─── Public ──────────────────────────────────────────────────────────────────

exports.getAllPuzzles = async (req, res) => {
  try {
    const { difficulty, active } = req.query;
    const filter = {};
    if (difficulty) filter.difficulty = difficulty;
    if (active === 'all') { /* no isActive filter - return everything */ }
    else if (active !== undefined) filter.isActive = active === 'true';
    else filter.isActive = true; // default: only active

    const puzzles = await StoryPuzzle.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data: puzzles });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getPuzzleById = async (req, res) => {
  try {
    const puzzle = await StoryPuzzle.findById(req.params.id);
    if (!puzzle) return res.status(404).json({ success: false, message: "Puzzle not found" });
    res.json({ success: true, data: puzzle });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getLeaderboard = async (req, res) => {
  try {
    const { puzzleId, limit = 20 } = req.query;
    const match = { completed: true };
    if (puzzleId) match.puzzleId = puzzleId;

    const leaderboard = await StoryPuzzleAttempt.find(match)
      .sort({ starsEarned: -1, timeSpentMs: 1 })
      .limit(Number(limit))
      .select("userName prophetName difficulty starsEarned timeSpentMs attempts createdAt");

    res.json({ success: true, data: leaderboard });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Admin CRUD ──────────────────────────────────────────────────────────────

exports.createPuzzle = async (req, res) => {
  try {
    const puzzle = await StoryPuzzle.create(req.body);
    res.status(201).json({ success: true, data: puzzle });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.updatePuzzle = async (req, res) => {
  try {
    const puzzle = await StoryPuzzle.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!puzzle) return res.status(404).json({ success: false, message: "Puzzle not found" });
    res.json({ success: true, data: puzzle });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.deletePuzzle = async (req, res) => {
  try {
    const puzzle = await StoryPuzzle.findByIdAndDelete(req.params.id);
    if (!puzzle) return res.status(404).json({ success: false, message: "Puzzle not found" });
    res.json({ success: true, message: "Puzzle deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Authenticated: Attempts ─────────────────────────────────────────────────

exports.submitAttempt = async (req, res) => {
  try {
    const { puzzleId, attempts, starsEarned, timeSpentMs, completed } = req.body;
    if (!puzzleId) return res.status(400).json({ success: false, message: "puzzleId is required" });

    const puzzle = await StoryPuzzle.findById(puzzleId);
    if (!puzzle) return res.status(404).json({ success: false, message: "Puzzle not found" });

    // Upsert: keep best score per user per puzzle
    const existing = await StoryPuzzleAttempt.findOne({
      firebaseUid: req.user.firebaseUid,
      puzzleId,
    });

    if (existing) {
      // Update only if new score is better
      const shouldUpdate =
        starsEarned > existing.starsEarned ||
        (starsEarned === existing.starsEarned && timeSpentMs < existing.timeSpentMs);

      if (shouldUpdate) {
        existing.attempts = (existing.attempts || 0) + 1;
        existing.starsEarned = starsEarned;
        existing.timeSpentMs = timeSpentMs;
        existing.completed = completed !== undefined ? completed : true;
        await existing.save();
        return res.json({ success: true, data: existing, updated: true });
      }

      existing.attempts = (existing.attempts || 0) + 1;
      await existing.save();
      return res.json({ success: true, data: existing, updated: false, message: "Previous score was better" });
    }

    const attempt = await StoryPuzzleAttempt.create({
      puzzleId,
      firebaseUid: req.user.firebaseUid,
      userName: req.user.name || "",
      prophetName: puzzle.prophetName,
      difficulty: puzzle.difficulty,
      attempts: attempts || 1,
      starsEarned: starsEarned || 0,
      timeSpentMs: timeSpentMs || 0,
      completed: completed !== undefined ? completed : true,
    });

    res.status(201).json({ success: true, data: attempt });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMyAttempts = async (req, res) => {
  try {
    const attempts = await StoryPuzzleAttempt.find({ firebaseUid: req.user.firebaseUid })
      .populate("puzzleId", "prophetName prophetNameMl icon difficulty")
      .sort({ updatedAt: -1 });

    res.json({ success: true, data: attempts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMyBestAttempt = async (req, res) => {
  try {
    const attempt = await StoryPuzzleAttempt.findOne({
      firebaseUid: req.user.firebaseUid,
      puzzleId: req.params.puzzleId,
    }).populate("puzzleId", "prophetName prophetNameMl icon difficulty");

    if (!attempt) return res.status(404).json({ success: false, message: "No attempt found" });
    res.json({ success: true, data: attempt });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
