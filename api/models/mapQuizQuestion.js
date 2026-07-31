const mongoose = require("mongoose");

const mapQuizQuestionSchema = new mongoose.Schema({
  icon: { type: String, default: "❓" },
  questionText: { type: String, required: true },
  questionTextMl: { type: String, default: "" },
  options: {
    type: [String],
    required: true,
    validate: { validator: (v) => v.length === 4, message: "Exactly 4 options required" },
  },
  optionsMl: {
    type: [String],
    default: [],
  },
  correctAnswer: { type: Number, required: true, min: 0, max: 3 },
  explanation: { type: String, default: "" },
  explanationMl: { type: String, default: "" },
  prophetId: { type: mongoose.Schema.Types.ObjectId, ref: "ProphetMap", default: null },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model("MapQuizQuestion", mapQuizQuestionSchema);
