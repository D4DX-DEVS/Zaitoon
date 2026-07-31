const mongoose = require("mongoose");

const subscriptionPlanSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true,
      default: ""
    },
    // Price in rupees (converted to paise when creating the Razorpay order)
    amount: {
      type: Number,
      required: true,
      min: 1
    },
    currency: {
      type: String,
      default: "INR",
      uppercase: true
    },
    // Access duration in days (e.g. 30 for monthly, 365 for yearly)
    durationDays: {
      type: Number,
      required: true,
      min: 1
    },
    isActive: {
      type: Boolean,
      default: true
    },
    sortOrder: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("SubscriptionPlan", subscriptionPlanSchema);
