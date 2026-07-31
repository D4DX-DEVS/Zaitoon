const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubscriptionPlan"
    },
    // Snapshot of plan details at purchase time (plan doc may change later)
    planName: {
      type: String,
      trim: true
    },
    durationDays: {
      type: Number
    },
    // amount stored in paise (as returned by Razorpay order)
    amount: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: "INR",
      uppercase: true
    },
    status: {
      type: String,
      enum: ["created", "paid", "failed"],
      default: "created"
    },
    orderId: {
      type: String,
      required: true,
      unique: true
    },
    paymentId: {
      type: String
    },
    signature: {
      type: String
    },
    // Access window - set on successful payment
    startDate: {
      type: Date
    },
    endDate: {
      type: Date,
      index: true
    },
    metadata: {
      type: Object,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Subscription", subscriptionSchema);
