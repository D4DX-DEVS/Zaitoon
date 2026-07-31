const mongoose = require("mongoose");

const mapQuizAttemptSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  firebaseUid: { type: String, required: true, index: true },
  userName: { type: String, default: "" },
  totalQuestions: { type: Number, required: true },
  correctAnswers: { type: Number, required: true },
  score: { type: Number, required: true },
  percentage: { type: Number, required: true },
  starsEarned: { type: Number, min: 0, max: 3, default: 0 },
  answers: [{
    questionId: { type: String },
    selectedAnswer: { type: Number },
    isCorrect: { type: Boolean },
  }],
}, { timestamps: true });

module.exports = mongoose.model("MapQuizAttempt", mapQuizAttemptSchema);
