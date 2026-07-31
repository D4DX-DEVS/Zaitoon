const mongoose = require("mongoose");

const quizSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  mlTitle: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  mlDescription: {
    type: String,
    trim: true
  },
  quizDate: {
    type: Date,
    required: true,
    index: true
  },
  quizConfigId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "QuizConfig",
    index: true
  },
  questions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Question",
    required: true
  }],
  status: {
    type: String,
    enum: ["Active", "Inactive"],
    default: "Active"
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Compound unique index: one quiz per day per config
quizSchema.index({ quizDate: 1, quizConfigId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("Quiz", quizSchema);
