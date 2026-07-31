const mongoose = require("mongoose");

const storyPuzzleAttemptSchema = new mongoose.Schema({
  puzzleId: { type: mongoose.Schema.Types.ObjectId, ref: "StoryPuzzle", required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  firebaseUid: { type: String, required: true, index: true },
  userName: { type: String, default: "" },
  prophetName: { type: String, default: "" },
  difficulty: { type: String, enum: ["easy", "medium", "hard"], default: "easy" },
  attempts: { type: Number, default: 1 },
  starsEarned: { type: Number, min: 0, max: 3, default: 0 },
  timeSpentMs: { type: Number, default: 0 },
  completed: { type: Boolean, default: true },
}, { timestamps: true });

// Unique per user per puzzle — enables upsert-best-score logic
storyPuzzleAttemptSchema.index({ firebaseUid: 1, puzzleId: 1 }, { unique: true });

module.exports = mongoose.model("StoryPuzzleAttempt", storyPuzzleAttemptSchema);
