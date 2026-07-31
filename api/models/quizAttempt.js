const mongoose = require("mongoose");

const quizAttemptSchema = new mongoose.Schema({
  quizId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Quiz",
    default: null
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  userSnapshot: {
    name: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    class: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" }
  },
  // Normalized email for "one attempt per day per email" and leaderboard by email
  emailNormalized: {
    type: String,
    trim: true,
    lowercase: true,
    default: ""
  },
  language: {
    type: String,
    required: true,
    enum: ["en", "ml"],
    trim: true
  },
  questions: [{
    // Snapshot of question at time of attempt
    _id: {
      type: String,
      required: true
    },
    type: {
      type: String,
      required: true
    },
    question_en: {
      type: String,
      required: true
    },
    question_ml: {
      type: String,
      required: true
    },
    options_en: {
      type: String, // JSON stringified array
      required: true
    },
    options_ml: {
      type: String, // JSON stringified array
      required: true
    },
    correct_answer: {
      type: Number,
      required: true
    },
    difficulty: {
      type: String,
      required: true
    }
  }],
  answers: [{
    attemptedAnswer: {
      type: Number,
      required: true,
      min: 0
    },
    isCorrect: {
      type: Boolean,
      required: true
    },
    duration: {
      type: Number, // in seconds
      required: true,
      min: 0
    }
  }],
  score: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  percentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
    default: 0
  },
  totalDuration: {
    type: Number, // in seconds
    required: true,
    min: 0,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
quizAttemptSchema.index({ quizId: 1 });
quizAttemptSchema.index({ userId: 1 });
quizAttemptSchema.index({ language: 1 });
quizAttemptSchema.index({ createdAt: 1 });
quizAttemptSchema.index({ emailNormalized: 1, createdAt: 1 });

module.exports = mongoose.model("QuizAttempt", quizAttemptSchema);
