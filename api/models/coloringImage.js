const mongoose = require("mongoose");

const coloringImageSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    titleMl: {
      type: String,
      default: "",
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: [
        "mosque",
        "nature",
        "calligraphy",
        "animals",
        "ramadan",
        "patterns",
        "characters",
        "general",
      ],
      index: true,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    thumbnailUrl: {
      type: String,
      default: "",
    },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "easy",
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
  },
  {
    timestamps: true,
  }
);

coloringImageSchema.index({ isActive: 1, category: 1, sortOrder: 1 });

module.exports = mongoose.model("ColoringImage", coloringImageSchema);
