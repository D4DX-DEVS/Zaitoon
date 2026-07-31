const mongoose = require("mongoose");

const quizQuestionSchema = new mongoose.Schema({
  quizConfigId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "QuizConfig",
    index: true
  },
  type: {
    type: String,
    required: true,
    trim: true
  },
  question_en: {
    type: String,
    required: true,
    trim: true
  },
  question_ml: {
    type: String,
    required: true,
    trim: true
  },
  options_en: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        try {
          const parsed = JSON.parse(v);
          return Array.isArray(parsed) && parsed.length > 0;
        } catch (e) {
          return false;
        }
      },
      message: "options_en must be a valid JSON array string"
    }
  },
  options_ml: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        try {
          const parsed = JSON.parse(v);
          return Array.isArray(parsed) && parsed.length > 0;
        } catch (e) {
          return false;
        }
      },
      message: "options_ml must be a valid JSON array string"
    }
  },
  correct_answer: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: function(v) {
        return Number.isInteger(v) && v >= 0;
      },
      message: "correct_answer must be a non-negative integer"
    }
  },
  difficulty: {
    type: String,
    enum: ["Easy", "Medium", "Hard"],
    default: "Medium",
    trim: true
  }
}, {
  timestamps: true
});

// Pre-save middleware to normalize and trim inputs
quizQuestionSchema.pre('save', function(next) {
  // Trim string fields
  if (this.type) this.type = this.type.trim();
  if (this.question_en) this.question_en = this.question_en.trim();
  if (this.question_ml) this.question_ml = this.question_ml.trim();
  if (this.difficulty) this.difficulty = this.difficulty.trim();
  
  // Normalize options arrays - ensure they're properly formatted JSON strings
  if (this.options_en) {
    try {
      const parsed = JSON.parse(this.options_en);
      if (Array.isArray(parsed)) {
        // Trim each option and filter out empty strings
        const normalized = parsed
          .map(opt => String(opt).trim())
          .filter(opt => opt.length > 0);
        this.options_en = JSON.stringify(normalized);
      }
    } catch (e) {
      // If parsing fails, keep original (validation will catch it)
    }
  }
  
  if (this.options_ml) {
    try {
      const parsed = JSON.parse(this.options_ml);
      if (Array.isArray(parsed)) {
        // Trim each option and filter out empty strings
        const normalized = parsed
          .map(opt => String(opt).trim())
          .filter(opt => opt.length > 0);
        this.options_ml = JSON.stringify(normalized);
      }
    } catch (e) {
      // If parsing fails, keep original (validation will catch it)
    }
  }
  
  next();
});

// Pre-update middleware for findOneAndUpdate operations
quizQuestionSchema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function(next) {
  const update = this.getUpdate();
  
  // Trim string fields in update
  if (update.$set) {
    if (update.$set.type) update.$set.type = String(update.$set.type).trim();
    if (update.$set.question_en) update.$set.question_en = String(update.$set.question_en).trim();
    if (update.$set.question_ml) update.$set.question_ml = String(update.$set.question_ml).trim();
    if (update.$set.difficulty) update.$set.difficulty = String(update.$set.difficulty).trim();
    
    // Normalize options arrays
    if (update.$set.options_en) {
      try {
        const parsed = JSON.parse(update.$set.options_en);
        if (Array.isArray(parsed)) {
          const normalized = parsed
            .map(opt => String(opt).trim())
            .filter(opt => opt.length > 0);
          update.$set.options_en = JSON.stringify(normalized);
        }
      } catch (e) {
        // Keep original if parsing fails
      }
    }
    
    if (update.$set.options_ml) {
      try {
        const parsed = JSON.parse(update.$set.options_ml);
        if (Array.isArray(parsed)) {
          const normalized = parsed
            .map(opt => String(opt).trim())
            .filter(opt => opt.length > 0);
          update.$set.options_ml = JSON.stringify(normalized);
        }
      } catch (e) {
        // Keep original if parsing fails
      }
    }
  }
  
  // Handle direct field updates (not using $set)
  if (update.type) update.type = String(update.type).trim();
  if (update.question_en) update.question_en = String(update.question_en).trim();
  if (update.question_ml) update.question_ml = String(update.question_ml).trim();
  if (update.difficulty) update.difficulty = String(update.difficulty).trim();
  
  next();
});

// Virtual to get parsed options_en as array
quizQuestionSchema.virtual('options_en_array').get(function() {
  try {
    return JSON.parse(this.options_en);
  } catch (e) {
    return [];
  }
});

// Virtual to get parsed options_ml as array
quizQuestionSchema.virtual('options_ml_array').get(function() {
  try {
    return JSON.parse(this.options_ml);
  } catch (e) {
    return [];
  }
});

// Ensure virtual fields are included in JSON output
quizQuestionSchema.set('toJSON', { virtuals: true });
quizQuestionSchema.set('toObject', { virtuals: true });

// Index for better query performance
quizQuestionSchema.index({ type: 1 });
quizQuestionSchema.index({ difficulty: 1 });

module.exports = mongoose.model("QuizQuestion", quizQuestionSchema);
