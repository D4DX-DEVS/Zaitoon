const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema({
  questionText: {
    type: String,
    required: true,
    trim: true
  },
  mlQuestionText: {
    type: String,
    required: true,
    trim: true
  },
  options: {
    type: [String],
    validate: {
      validator: function(v) {
        return v.length >= 2 && v.length <= 4;
      },
      message: "Question must have between 2 and 4 options"
    }
  },
  mlOptions: {
    type: [String],
    validate: {
      validator: function(v) {
        return v.length >= 2 && v.length <= 4;
      },
      message: "Malayalam options must have between 2 and 4 options"
    }
  },
  correctAnswer: {
    type: Number,
    required: true,
    min: 0,
    max: 3, // Index of correct option (0 to options.length-1)
    validate: {
      validator: function(v) {
        return Number.isInteger(v) && v >= 0 && v <= 3;
      },
      message: "Correct answer must be a valid option index"
    }
  },
  points: {
    type: Number,
    default: 1,
    min: 1
  },
  category: {
    type: String,
    trim: true
  },
  difficulty: {
    type: String,
    enum: ["Easy", "Medium", "Hard"],
    default: "Medium"
  },
  quizConfigId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "QuizConfig",
    index: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("Question", questionSchema);
