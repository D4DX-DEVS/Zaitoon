const mongoose = require("mongoose");

const supportPaymentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    phone: {
      type: String,
      trim: true
    },
    amount: {
      type: Number,
      required: true,
      min: 100 // amount in paise, minimum ₹1
    },
    currency: {
      type: String,
      default: "INR",
      uppercase: true
    },
    message: {
      type: String,
      trim: true
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
    metadata: {
      type: Object,
      default: {}
    },
    receiptSentAt: {
      type: Date
    },
    receiptAttempts: {
      type: Number,
      default: 0
    },
    receiptEmail: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("SupportPayment", supportPaymentSchema);

