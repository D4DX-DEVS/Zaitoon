const mongoose = require("mongoose");

const quizConfigSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    default: "Daily Quiz"
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  numberOfQuestions: {
    type: Number,
    required: true,
    min: 1,
    validate: {
      validator: function(v) {
        return Number.isInteger(v) && v >= 1;
      },
      message: "Number of questions must be an integer greater than or equal to 1"
    }
  },
  questionsRandomization: {
    type: Boolean,
    default: false
  },
  isEnable: {
    type: Boolean,
    default: true
  },
  // Daily rollover timezone (e.g. "Asia/Kolkata"). "Today" and 12:00 AM rollover use this.
  timezone: {
    type: String,
    default: "Asia/Kolkata",
    trim: true
  }
}, {
  timestamps: true
});

// Custom validation: startDate must be before endDate
quizConfigSchema.pre('validate', function(next) {
  if (this.startDate && this.endDate && this.startDate >= this.endDate) {
    next(new Error('Start date must be before end date'));
  } else {
    next();
  }
});

// Virtual field: isLive - checks if current time is between startDate and endDate
quizConfigSchema.virtual('isLive').get(function() {
  if (!this.isEnable) {
    return false;
  }
  const now = new Date();
  return now >= this.startDate && now <= this.endDate;
});

// Ensure virtual fields are included in JSON output
quizConfigSchema.set('toJSON', { virtuals: true });
quizConfigSchema.set('toObject', { virtuals: true });

// Static method to get or create the single config instance
quizConfigSchema.statics.getConfig = async function() {
  let config = await this.findOne();
  if (!config) {
    // Create default config if none exists
    config = await this.create({
      startDate: new Date(),
      endDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
      numberOfQuestions: 10,
      questionsRandomization: false,
      isEnable: true
    });
  }
  return config;
};

// Static method to update or create the single config instance
quizConfigSchema.statics.updateOrCreate = async function(updateData) {
  const config = await this.findOneAndUpdate(
    {}, // Empty filter - always matches the single document
    updateData,
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true
    }
  );
  return config;
};

module.exports = mongoose.model("QuizConfig", quizConfigSchema);
