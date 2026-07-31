const mongoose = require("mongoose");

const trendingVideoSchema = new mongoose.Schema(
  {
    video: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Videos",
      required: true
    },
    order: {
      type: Number,
      default: 0,
      index: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("TrendingVideo", trendingVideoSchema);
