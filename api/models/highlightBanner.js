const mongoose = require("mongoose");

const highlightBannerSchema = new mongoose.Schema(
  {
    contentType: {
      type: String,
      enum: ["story", "single_story", "video", "brightbox"],
      required: true
    },
    // The primary content ID:
    // story       → episode._id
    // single_story → singleStory._id
    // video       → trendingVideo._id (the TrendingVideo join doc)
    // brightbox   → brightBoxStory._id
    contentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    // For story type only — needed so the app can navigate to the right story/season
    storyId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },
    seasonId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },
    // Optional banner to show for this highlight
    banner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Banner",
      default: null
    },
    // Display order (lower = shown first)
    order: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

// Ensure one HighlightBanner record per content item
highlightBannerSchema.index({ contentType: 1, contentId: 1 }, { unique: true });

module.exports = mongoose.model("HighlightBanner", highlightBannerSchema);
