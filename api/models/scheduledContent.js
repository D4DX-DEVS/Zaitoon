const mongoose = require("mongoose");

const scheduledContentSchema = new mongoose.Schema(
  {
    contentType: {
      type: String,
      required: true,
      enum: [
        "story",
        "single-story",
        "video",
        "banner",
        "payment-banner",
        "bright-box",
        "bright-box-story",
        "puzzle",
        "kids-submission",
        "quiz",
        "question",
        "notification"
      ]
    },
    // Human-readable title for admin display
    title: {
      type: String,
      required: true
    },
    // Optional thumbnail for preview in admin
    thumbnailUrl: {
      type: String
    },
    // Full payload to be used when publishing (file URLs already resolved)
    contentData: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    publishAt: {
      type: Date,
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ["pending", "published", "failed"],
      default: "pending",
      index: true
    },
    errorMessage: {
      type: String
    },
    // The _id of the document created after successful publish
    publishedId: {
      type: mongoose.Schema.Types.ObjectId
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("ScheduledContent", scheduledContentSchema);
