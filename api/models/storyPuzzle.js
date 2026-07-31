const mongoose = require("mongoose");

const storyEventSchema = new mongoose.Schema({
  order: { type: Number, required: true },
  text: { type: String, required: true },
  textMl: { type: String, default: "" },
}, { _id: false });

const storyPuzzleSchema = new mongoose.Schema({
  prophetName: { type: String, required: true },
  prophetNameMl: { type: String, default: "" },
  icon: { type: String, default: "🌟" },
  difficulty: {
    type: String,
    required: true,
    enum: ["easy", "medium", "hard"],
    default: "easy",
  },
  description: { type: String, default: "" },
  descriptionMl: { type: String, default: "" },
  moral: { type: String, default: "" },
  moralMl: { type: String, default: "" },
  color: { type: String, default: "from-purple-400 to-purple-600" },
  events: { type: [storyEventSchema], required: true, validate: { validator: (v) => v.length >= 2, message: "At least 2 events required" } },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

storyPuzzleSchema.index({ difficulty: 1, isActive: 1 });

module.exports = mongoose.model("StoryPuzzle", storyPuzzleSchema);
