const mongoose = require("mongoose");

const membershipSchema = new mongoose.Schema(
  {
    // Flutter app user who took the membership
    userId: {
      type: String,
      required: true,
      index: true
    },
    // Printed on the membership card
    membershipNo: {
      type: String,
      required: true,
      unique: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    phone: {
      type: String,
      required: true,
      trim: true
    },
    className: {
      type: String,
      required: true,
      trim: true
    },
    // Selfie uploaded from the app, stored on DO Spaces
    photo: {
      type: String
    }
  },
  { timestamps: true }
);

membershipSchema.index({ name: 1 });
membershipSchema.index({ phone: 1 });

module.exports = mongoose.model("Membership", membershipSchema);
