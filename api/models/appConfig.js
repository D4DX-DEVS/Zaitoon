const mongoose = require("mongoose");

// Global, app-wide configuration singleton.
const appConfigSchema = new mongoose.Schema(
  {
    // How the kids app renders story PDFs:
    //  - "instagram": horizontal page swipe + swipe down for next story
    //  - "vertical":  legacy full vertical scroll (pinch view)
    pdfReadingMode: {
      type: String,
      enum: ["instagram", "vertical"],
      default: "instagram"
    },
    // Global membership switch: when false the app hides membership
    // and the API refuses new signups
    membershipEnabled: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Get the single config document, creating a default one if missing.
appConfigSchema.statics.getConfig = async function () {
  let config = await this.findOne();
  if (!config) {
    config = await this.create({});
  }
  return config;
};

// Update (or create) the single config document.
appConfigSchema.statics.updateOrCreate = async function (updateData) {
  return this.findOneAndUpdate(
    {},
    updateData,
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true
    }
  );
};

module.exports = mongoose.model("AppConfig", appConfigSchema);
