const mongoose = require("mongoose");

const singleStorySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true
    },
    mlTitle: {
      type: String
    },
    coverImage: {
      type: String,
      required: true
    },
    readTime: {
      type: String
    },
    enStoryFile: {
      type: String,
      required: true
    },
    mlStoryFile: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    tag: {
      type: String
    },
    mlBanner: {
      type: String
    },
    enBanner: {
      type: String
    },
    music: {
      type: String
    },
    // Priority in listing (1 = highest)
    priority: {
      type: Number,
      min: 1,
      default: 1,
      index: true
    },
    highlight: {
      type: String,
      enum: ["Enable", "Disable"],
      default: "Disable"
    },
    highlightExpiresAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("SingleStory", singleStorySchema);