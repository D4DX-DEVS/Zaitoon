const mongoose = require("mongoose");

const galleryImageSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: "",
      trim: true,
    },
    titleMl: {
      type: String,
      default: "",
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      default: "general",
      enum: ["general", "events", "activities", "achievements", "nature", "art", "community"],
      index: true,
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
  },
  {
    timestamps: true,
  }
);

galleryImageSchema.index({ isActive: 1, sortOrder: 1, createdAt: -1 });

module.exports = mongoose.model("GalleryImage", galleryImageSchema);
