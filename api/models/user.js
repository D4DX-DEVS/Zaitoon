const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    // Firebase UID for Flutter app authentication
    firebaseUid: {
        type: String,
        unique: true,
        sparse: true, // Allows null values for non-Firebase users
        index: true
    },
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    class: {
        type: String,
        required: true
    },
    // Growth & Activity tracking: reading streak, books read, achievements
    growthActivity: {
        readingStreak: {
            current: { type: Number, default: 0 },
            longest: { type: Number, default: 0 },
            lastActiveDate: { type: Date }
        },
        booksRead: { type: Number, default: 0 },
        achievements: [{
            achievementId: { type: String, required: true },
            unlockedAt: { type: Date, default: () => new Date() }
        }],
        // For speed_reader: books completed in last 7 days >= 3 (keep last 100)
        // A "book" = story | single_story | brightbox (content id in bookId)
        completedBooks: [{
            bookId: { type: String },
            bookType: { type: String, enum: ["story", "single_story", "brightbox"] },
            completedAt: { type: Date, default: () => new Date() }
        }],
        // For comeback_kid: had streak before, lost it, then rebuilt to 3+
        hadStreakBeforeReset: { type: Boolean, default: false }
    },
    // Quick-access snapshot of the user's current subscription. The Subscription
    // collection is the source of truth; this mirrors the latest paid record for
    // fast entitlement checks.
    subscription: {
        status: { type: String, enum: ["none", "active", "expired"], default: "none" },
        planName: { type: String },
        endDate: { type: Date },
        activatedAt: { type: Date }
    }
},
{ timestamps: true });

module.exports = mongoose.model("User", userSchema);