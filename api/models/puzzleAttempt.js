const mongoose = require("mongoose");

const puzzleAttemptSchema = new mongoose.Schema({
  puzzleId: { type: String, required: true, index: true }, // Puzzle._id (string ref)
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  firebaseUid: { type: String, required: true, index: true },
  userName: { type: String, default: "" },
  difficulty: { type: String, enum: ["easy", "medium", "hard"], default: "easy" },
  starsEarned: { type: Number, min: 0, max: 5, default: 0 },
  timeSpentMs: { type: Number, default: 0 },
}, { timestamps: true });

// One record per user per puzzle — best score wins (upsert)
puzzleAttemptSchema.index({ firebaseUid: 1, puzzleId: 1 }, { unique: true });

module.exports = mongoose.model("PuzzleAttempt", puzzleAttemptSchema);
