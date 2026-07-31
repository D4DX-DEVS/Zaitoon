const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const app = express();

require("dotenv").config();

// Initialize Firebase Admin SDK (for Flutter app authentication)
require("./config/firebaseAdmin");

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(), // Store files in memory
  // No file size limits - unlimited file uploads
});

const adminRoutes = require("./routes/admin");
const adminHighlightsRoutes = require("./routes/adminHighlights");
const storiesRoutes = require("./routes/stories");
const singleStoryRoutes = require("./routes/singleStory");
const kidsSubmissionRoutes = require("./routes/kidsSubmission");
const seasonRoutes = require("./routes/season");
const episodeRoutes = require("./routes/episode");
const videosCategoryRoutes = require("./routes/videosCategory");
const videosRoutes = require("./routes/videos");
const trendingVideosRoutes = require("./routes/trendingVideos");
const brightBoxRoutes = require("./routes/brightBox");
const brightBoxStoryRoutes = require("./routes/brightBoxStory");
const supportRoutes = require("./routes/support");
const supportWebhookRoutes = require("./routes/supportWebhook");
const subscriptionRoutes = require("./routes/subscription");
const subscriptionWebhookRoutes = require("./routes/subscriptionWebhook");
const puzzlesRoutes = require("./routes/puzzles");
const bannerRoutes = require("./routes/banner");
const paymentBannerRoutes = require("./routes/paymentBanner");
const quizRoutes = require("./routes/quiz");
const questionRoutes = require("./routes/question");
const quizAttemptRoutes = require("./routes/quizAttempt");
const quizConfigRoutes = require("./routes/quizConfig");
const quizQuestionRoutes = require("./routes/quizQuestion");
const userRoutes = require("./routes/user");
const growthActivityRoutes = require("./routes/growthActivity");
const highlightsRoutes = require("./routes/highlights");
const authRoutes = require("./routes/auth");
const searchRoutes = require("./routes/search");
const analyticsRoutes = require("./routes/analytics");
const adminAnalyticsRoutes = require("./routes/adminAnalytics");
const storyPuzzleRoutes = require("./routes/storyPuzzle");
const coloringRoutes = require("./routes/coloring");
const galleryRoutes = require("./routes/gallery");
const leaderboardRoutes = require("./routes/leaderboard");
const userAnalyticsRoutes = require("./routes/userAnalytics");
const noticesRoutes = require("./routes/notices");
const { startSupportPaymentReconciler } = require("./jobs/supportPaymentReconciler");
const { startScheduledContentPublisher } = require("./jobs/scheduledContentPublisher");
const { startHighlightExpiryJob } = require("./jobs/highlightExpiryJob");
const scheduleRoutes = require("./routes/schedule");
const appConfigRoutes = require("./routes/appConfig");
const { startDailyAnalyticsAggregator } = require("./jobs/dailyAnalyticsAggregator");
const { startAnalyticsCleanup } = require("./jobs/analyticsCleanup");

app.use(cors());
app.use("/api/support/webhook", express.raw({ type: "application/json" }), supportWebhookRoutes);
app.use("/api/subscriptions/webhook", express.raw({ type: "application/json" }), subscriptionWebhookRoutes);
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded data

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    
    // Drop old index that causes conflicts
    try {
      const db = mongoose.connection.db;
      const collection = db.collection("quizattempts");
      
      // Check if old index exists and drop it
      const indexes = await collection.indexes();
      const oldIndex = indexes.find(idx => idx.name === "quiz_1_user_1");
      
      if (oldIndex) {
        await collection.dropIndex("quiz_1_user_1");
        console.log("✅ Dropped old index: quiz_1_user_1");
      }
    } catch (indexError) {
      // Ignore if index doesn't exist or other non-critical errors
      if (indexError.code !== 27 && indexError.codeName !== "IndexNotFound") {
        console.warn("Warning: Could not drop old index:", indexError.message);
      }
    }
  })
  .catch((err) => console.error('MongoDB connection error:', err));

// Routes
app.use("/api/admin", adminRoutes);
app.use("/api/admin", adminHighlightsRoutes);
app.use("/api/stories", storiesRoutes);
app.use("/api/single-stories", singleStoryRoutes);
app.use("/api/kids-submissions", kidsSubmissionRoutes);
app.use("/api/videos-categories", videosCategoryRoutes);
app.use("/api/videos/trending", trendingVideosRoutes);
app.use("/api/videos", videosRoutes);
app.use("/api/bright-boxes", brightBoxRoutes);
app.use("/api/bright-box-stories", brightBoxStoryRoutes);
app.use("/api", highlightsRoutes);
app.use("/api/puzzles", puzzlesRoutes);
app.use("/api/banners", bannerRoutes);
app.use("/api/payment-banner", paymentBannerRoutes);
app.use("/api/quizzes/config", quizConfigRoutes);
app.use("/api/quizzes", quizRoutes);
console.log("Quiz routes mounted at /api/quizzes - /stats endpoint should be available at /api/quizzes/stats");
app.use("/api/quiz-questions", quizQuestionRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/quiz-attempts", quizAttemptRoutes);
app.use("/api/users", userRoutes);
app.use("/api/activity", growthActivityRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/admin/analytics", adminAnalyticsRoutes);
app.use("/api/story-puzzles", storyPuzzleRoutes);
app.use("/api/coloring", coloringRoutes);
app.use("/api/gallery", galleryRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/analytics/me", userAnalyticsRoutes);
app.use("/api", noticesRoutes);
app.use("/api", seasonRoutes);
app.use("/api", episodeRoutes);
app.use("/api", supportRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/schedule", scheduleRoutes);
app.use("/api/app-config", appConfigRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
  });
  
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });

startSupportPaymentReconciler();
startScheduledContentPublisher();
startHighlightExpiryJob();
startDailyAnalyticsAggregator();
startAnalyticsCleanup();
