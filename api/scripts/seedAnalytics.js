/**
 * Seed script to populate sample analytics data
 * Run: node scripts/seedAnalytics.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const AnalyticsEvent = require("../models/analyticsEvent");
const DailyAnalyticsSummary = require("../models/dailyAnalyticsSummary");

const MONGODB_URI = process.env.MONGODB_URI;

// Sample user data
const sampleUsers = [
  { firebaseUid: "kid_amal_001", name: "Amal" },
  { firebaseUid: "kid_fathima_002", name: "Fathima" },
  { firebaseUid: "kid_arjun_003", name: "Arjun" },
  { firebaseUid: "kid_meera_004", name: "Meera" },
  { firebaseUid: "kid_rahul_005", name: "Rahul" },
  { firebaseUid: "kid_sneha_006", name: "Sneha" },
  { firebaseUid: "kid_vishnu_007", name: "Vishnu" },
  { firebaseUid: "kid_ananya_008", name: "Ananya" },
];

// Sample content
const sampleVideos = [
  { id: "vid_001", title: "Learn Malayalam Alphabets", type: "video" },
  { id: "vid_002", title: "Animal Kingdom Adventure", type: "video" },
  { id: "vid_003", title: "Colors and Shapes", type: "video" },
  { id: "vid_004", title: "Counting Fun 1-100", type: "video" },
  { id: "vid_005", title: "Nursery Rhymes Collection", type: "video" },
];

const sampleStories = [
  { id: "story_001", title: "The Clever Fox", type: "story" },
  { id: "story_002", title: "Adventures of Kunjikka", type: "story" },
  { id: "story_003", title: "The Magic Mango Tree", type: "story" },
  { id: "story_004", title: "Moonlight Tales", type: "story" },
];

const sampleSingleStories = [
  { id: "ss_001", title: "The Brave Little Elephant", type: "single_story" },
  { id: "ss_002", title: "Grandma's Special Recipe", type: "single_story" },
  { id: "ss_003", title: "The Lost Butterfly", type: "single_story" },
];

const sampleBrightbox = [
  { id: "bb_001", title: "BrightBox: Ocean Life", type: "brightbox" },
  { id: "bb_002", title: "BrightBox: Space Explorer", type: "brightbox" },
  { id: "bb_003", title: "BrightBox: Dinosaur World", type: "brightbox" },
];

const sampleQuizzes = [
  { id: "quiz_001", title: "Malayalam Quiz Level 1", type: "quiz" },
  { id: "quiz_002", title: "Science Fun Quiz", type: "quiz" },
  { id: "quiz_003", title: "Math Challenge", type: "quiz" },
];

const samplePuzzles = [
  { id: "puzzle_001", title: "Animal Jigsaw", type: "puzzle" },
  { id: "puzzle_002", title: "Word Scramble", type: "puzzle" },
  { id: "puzzle_003", title: "Pattern Match", type: "puzzle" },
];

const screens = [
  "HomeScreen",
  "VideoListScreen",
  "StoryListScreen",
  "QuizScreen",
  "PuzzleScreen",
  "KidsCornerScreen",
  "ProfileScreen",
  "BookmarkScreen",
  "SettingsScreen",
  "SearchScreen",
];

const searchQueries = [
  "elephant story",
  "malayalam alphabets",
  "animal videos",
  "math quiz",
  "drawing",
  "colors",
  "rhymes",
  "space",
  "dinosaur",
  "butterfly",
  "counting",
  "moon",
];

const platforms = ["ios", "android"];
const osVersions = { ios: ["16.0", "17.0", "17.2", "18.0"], android: ["12", "13", "14", "15"] };
const appVersions = ["1.0.20", "1.0.21", "1.0.22"];
const deviceModels = {
  ios: ["iPhone 13", "iPhone 14", "iPhone 15", "iPad Air"],
  android: ["Samsung Galaxy S23", "Pixel 8", "OnePlus 12", "Xiaomi 14"],
};

// Helpers
function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randomDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(randomInt(6, 22), randomInt(0, 59), randomInt(0, 59));
  return d;
}
function makeSessionId(uid, day) {
  return `${uid}_session_${day}_${randomInt(1, 999)}`;
}
function makeDeviceInfo() {
  const platform = randomItem(platforms);
  return {
    platform,
    osVersion: randomItem(osVersions[platform]),
    appVersion: randomItem(appVersions),
    deviceModel: randomItem(deviceModels[platform]),
  };
}

async function seedEvents() {
  const events = [];

  // Generate 30 days of data
  for (let day = 0; day < 30; day++) {
    // Pick 3-8 active users per day
    const activeCount = randomInt(3, 8);
    const shuffled = [...sampleUsers].sort(() => 0.5 - Math.random());
    const activeUsers = shuffled.slice(0, activeCount);

    for (const user of activeUsers) {
      const sessionId = makeSessionId(user.firebaseUid, day);
      const deviceInfo = makeDeviceInfo();
      const baseDate = randomDate(day);

      // --- App open ---
      events.push({
        firebaseUid: user.firebaseUid,
        eventType: "app_open",
        eventCategory: "session",
        sessionId,
        deviceInfo,
        metadata: {},
        createdAt: new Date(baseDate),
      });

      // --- Screen views (2-6 per session) ---
      const screenCount = randomInt(2, 6);
      for (let s = 0; s < screenCount; s++) {
        const t = new Date(baseDate.getTime() + (s + 1) * randomInt(30, 300) * 1000);
        events.push({
          firebaseUid: user.firebaseUid,
          eventType: "screen_view",
          eventCategory: "navigation",
          contentTitle: randomItem(screens),
          sessionId,
          deviceInfo,
          metadata: { screenName: randomItem(screens) },
          createdAt: t,
        });
      }

      // --- Video events (60% chance) ---
      if (Math.random() < 0.6) {
        const video = randomItem(sampleVideos);
        const watchDuration = randomInt(30, 600);
        const t1 = new Date(baseDate.getTime() + randomInt(60, 600) * 1000);
        events.push({
          firebaseUid: user.firebaseUid,
          eventType: "video_play",
          eventCategory: "video",
          contentId: video.id,
          contentType: "video",
          contentTitle: video.title,
          sessionId,
          deviceInfo,
          metadata: {},
          createdAt: t1,
        });

        // 70% complete
        if (Math.random() < 0.7) {
          events.push({
            firebaseUid: user.firebaseUid,
            eventType: "video_complete",
            eventCategory: "video",
            contentId: video.id,
            contentType: "video",
            contentTitle: video.title,
            duration: watchDuration,
            sessionId,
            deviceInfo,
            metadata: { watchedSeconds: watchDuration },
            createdAt: new Date(t1.getTime() + watchDuration * 1000),
          });
        } else {
          // progress event
          const progressPct = randomInt(10, 85);
          events.push({
            firebaseUid: user.firebaseUid,
            eventType: "video_progress",
            eventCategory: "video",
            contentId: video.id,
            contentType: "video",
            contentTitle: video.title,
            duration: Math.floor(watchDuration * progressPct / 100),
            sessionId,
            deviceInfo,
            metadata: { progressPercent: progressPct, watchedSeconds: Math.floor(watchDuration * progressPct / 100) },
            createdAt: new Date(t1.getTime() + Math.floor(watchDuration * progressPct / 100) * 1000),
          });
        }
      }

      // --- Story events (50% chance) ---
      if (Math.random() < 0.5) {
        const story = randomItem(sampleStories);
        const readDuration = randomInt(60, 900);
        const t1 = new Date(baseDate.getTime() + randomInt(300, 900) * 1000);
        events.push({
          firebaseUid: user.firebaseUid,
          eventType: "story_open",
          eventCategory: "story",
          contentId: story.id,
          contentType: "story",
          contentTitle: story.title,
          sessionId,
          deviceInfo,
          metadata: {},
          createdAt: t1,
        });
        if (Math.random() < 0.65) {
          events.push({
            firebaseUid: user.firebaseUid,
            eventType: "story_complete",
            eventCategory: "story",
            contentId: story.id,
            contentType: "story",
            contentTitle: story.title,
            duration: readDuration,
            sessionId,
            deviceInfo,
            metadata: { readSeconds: readDuration },
            createdAt: new Date(t1.getTime() + readDuration * 1000),
          });
        }
      }

      // --- Single story events (40% chance) ---
      if (Math.random() < 0.4) {
        const ss = randomItem(sampleSingleStories);
        const readDuration = randomInt(30, 300);
        const t1 = new Date(baseDate.getTime() + randomInt(600, 1200) * 1000);
        events.push({
          firebaseUid: user.firebaseUid,
          eventType: "single_story_open",
          eventCategory: "single_story",
          contentId: ss.id,
          contentType: "single_story",
          contentTitle: ss.title,
          sessionId,
          deviceInfo,
          metadata: {},
          createdAt: t1,
        });
        if (Math.random() < 0.8) {
          events.push({
            firebaseUid: user.firebaseUid,
            eventType: "single_story_complete",
            eventCategory: "single_story",
            contentId: ss.id,
            contentType: "single_story",
            contentTitle: ss.title,
            duration: readDuration,
            sessionId,
            deviceInfo,
            metadata: { readSeconds: readDuration },
            createdAt: new Date(t1.getTime() + readDuration * 1000),
          });
        }
      }

      // --- BrightBox events (35% chance) ---
      if (Math.random() < 0.35) {
        const bb = randomItem(sampleBrightbox);
        const readDuration = randomInt(60, 600);
        const t1 = new Date(baseDate.getTime() + randomInt(700, 1500) * 1000);
        events.push({
          firebaseUid: user.firebaseUid,
          eventType: "brightbox_open",
          eventCategory: "brightbox",
          contentId: bb.id,
          contentType: "brightbox",
          contentTitle: bb.title,
          sessionId,
          deviceInfo,
          metadata: {},
          createdAt: t1,
        });
        if (Math.random() < 0.6) {
          events.push({
            firebaseUid: user.firebaseUid,
            eventType: "brightbox_complete",
            eventCategory: "brightbox",
            contentId: bb.id,
            contentType: "brightbox",
            contentTitle: bb.title,
            duration: readDuration,
            sessionId,
            deviceInfo,
            metadata: { readSeconds: readDuration },
            createdAt: new Date(t1.getTime() + readDuration * 1000),
          });
        }
      }

      // --- Quiz events (45% chance) ---
      if (Math.random() < 0.45) {
        const quiz = randomItem(sampleQuizzes);
        const quizDuration = randomInt(30, 300);
        const score = randomInt(20, 100);
        const t1 = new Date(baseDate.getTime() + randomInt(800, 1800) * 1000);
        events.push({
          firebaseUid: user.firebaseUid,
          eventType: "quiz_start",
          eventCategory: "quiz",
          contentId: quiz.id,
          contentType: "quiz",
          contentTitle: quiz.title,
          sessionId,
          deviceInfo,
          metadata: {},
          createdAt: t1,
        });
        if (Math.random() < 0.75) {
          events.push({
            firebaseUid: user.firebaseUid,
            eventType: "quiz_complete",
            eventCategory: "quiz",
            contentId: quiz.id,
            contentType: "quiz",
            contentTitle: quiz.title,
            duration: quizDuration,
            sessionId,
            deviceInfo,
            metadata: { score, totalQuestions: 10, correctAnswers: Math.floor(score / 10) },
            createdAt: new Date(t1.getTime() + quizDuration * 1000),
          });
        } else {
          events.push({
            firebaseUid: user.firebaseUid,
            eventType: "quiz_abandon",
            eventCategory: "quiz",
            contentId: quiz.id,
            contentType: "quiz",
            contentTitle: quiz.title,
            duration: randomInt(10, quizDuration),
            sessionId,
            deviceInfo,
            metadata: { reason: "navigated_away" },
            createdAt: new Date(t1.getTime() + randomInt(10, quizDuration) * 1000),
          });
        }
      }

      // --- Puzzle events (40% chance) ---
      if (Math.random() < 0.4) {
        const puzzle = randomItem(samplePuzzles);
        const puzzleDuration = randomInt(20, 180);
        const t1 = new Date(baseDate.getTime() + randomInt(900, 2000) * 1000);
        events.push({
          firebaseUid: user.firebaseUid,
          eventType: "puzzle_start",
          eventCategory: "puzzle",
          contentId: puzzle.id,
          contentType: "puzzle",
          contentTitle: puzzle.title,
          sessionId,
          deviceInfo,
          metadata: {},
          createdAt: t1,
        });
        if (Math.random() < 0.7) {
          events.push({
            firebaseUid: user.firebaseUid,
            eventType: "puzzle_complete",
            eventCategory: "puzzle",
            contentId: puzzle.id,
            contentType: "puzzle",
            contentTitle: puzzle.title,
            duration: puzzleDuration,
            sessionId,
            deviceInfo,
            metadata: { timeTaken: puzzleDuration },
            createdAt: new Date(t1.getTime() + puzzleDuration * 1000),
          });
        } else {
          events.push({
            firebaseUid: user.firebaseUid,
            eventType: "puzzle_abandon",
            eventCategory: "puzzle",
            contentId: puzzle.id,
            contentType: "puzzle",
            contentTitle: puzzle.title,
            duration: randomInt(5, puzzleDuration),
            sessionId,
            deviceInfo,
            metadata: {},
            createdAt: new Date(t1.getTime() + randomInt(5, puzzleDuration) * 1000),
          });
        }
      }

      // --- Kids corner (20% chance) ---
      if (Math.random() < 0.2) {
        const t1 = new Date(baseDate.getTime() + randomInt(1000, 2500) * 1000);
        events.push({
          firebaseUid: user.firebaseUid,
          eventType: "kids_corner_view",
          eventCategory: "kids_corner",
          sessionId,
          deviceInfo,
          metadata: {},
          createdAt: t1,
        });
        if (Math.random() < 0.5) {
          const subType = randomItem(["story", "poem", "drawing"]);
          events.push({
            firebaseUid: user.firebaseUid,
            eventType: "kids_corner_submit",
            eventCategory: "kids_corner",
            sessionId,
            deviceInfo,
            metadata: { submissionType: subType, title: `My ${subType} by ${user.name}` },
            createdAt: new Date(t1.getTime() + randomInt(60, 600) * 1000),
          });
        }
      }

      // --- Bookmark events (30% chance) ---
      if (Math.random() < 0.3) {
        const allContent = [...sampleVideos, ...sampleStories, ...sampleSingleStories, ...sampleBrightbox];
        const item = randomItem(allContent);
        const t1 = new Date(baseDate.getTime() + randomInt(100, 2000) * 1000);
        events.push({
          firebaseUid: user.firebaseUid,
          eventType: "bookmark_add",
          eventCategory: "bookmark",
          contentId: item.id,
          contentType: item.type,
          contentTitle: item.title,
          sessionId,
          deviceInfo,
          metadata: {},
          createdAt: t1,
        });
        // 30% remove it later
        if (Math.random() < 0.3) {
          events.push({
            firebaseUid: user.firebaseUid,
            eventType: "bookmark_remove",
            eventCategory: "bookmark",
            contentId: item.id,
            contentType: item.type,
            contentTitle: item.title,
            sessionId,
            deviceInfo,
            metadata: {},
            createdAt: new Date(t1.getTime() + randomInt(300, 3600) * 1000),
          });
        }
      }

      // --- Search events (25% chance) ---
      if (Math.random() < 0.25) {
        const t1 = new Date(baseDate.getTime() + randomInt(200, 1500) * 1000);
        const query = randomItem(searchQueries);
        events.push({
          firebaseUid: user.firebaseUid,
          eventType: "search_query",
          eventCategory: "search",
          sessionId,
          deviceInfo,
          metadata: { query, resultsCount: randomInt(0, 20) },
          createdAt: t1,
        });
      }

      // --- App close ---
      const sessionDuration = randomInt(300, 3600);
      events.push({
        firebaseUid: user.firebaseUid,
        eventType: "app_close",
        eventCategory: "session",
        duration: sessionDuration,
        sessionId,
        deviceInfo,
        metadata: { sessionDurationSeconds: sessionDuration },
        createdAt: new Date(baseDate.getTime() + sessionDuration * 1000),
      });
    }
  }

  console.log(`Inserting ${events.length} analytics events...`);
  await AnalyticsEvent.insertMany(events);
  console.log("✅ Analytics events inserted!");
  return events;
}

async function seedDailySummaries() {
  const summaries = [];

  for (let day = 0; day < 30; day++) {
    const date = new Date();
    date.setDate(date.getDate() - day);
    date.setHours(0, 0, 0, 0);

    const activeUsers = randomInt(3, 8);
    const sessions = randomInt(activeUsers, activeUsers * 3);

    summaries.push({
      date,
      totalActiveUsers: activeUsers,
      newUsers: day > 25 ? randomInt(1, 3) : randomInt(0, 1),
      totalSessions: sessions,
      avgSessionDuration: randomInt(300, 2400),

      video: {
        totalViews: randomInt(5, 30),
        uniqueViewers: randomInt(2, activeUsers),
        totalWatchTime: randomInt(600, 5400),
        avgWatchTime: randomInt(60, 360),
        completionRate: randomInt(45, 90),
      },

      stories: {
        allStories: {
          opens: randomInt(3, 15),
          completes: randomInt(1, 10),
          uniqueReaders: randomInt(1, activeUsers),
        },
        singleStories: {
          opens: randomInt(2, 12),
          completes: randomInt(1, 9),
          uniqueReaders: randomInt(1, Math.max(1, activeUsers - 1)),
        },
        brightbox: {
          opens: randomInt(1, 8),
          completes: randomInt(0, 5),
          uniqueReaders: randomInt(1, Math.max(1, activeUsers - 2)),
        },
        totalReadTime: randomInt(300, 4000),
      },

      quiz: {
        attempts: randomInt(3, 20),
        uniqueParticipants: randomInt(2, activeUsers),
        avgScore: randomInt(50, 95),
        avgDuration: randomInt(30, 180),
        completionRate: randomInt(55, 92),
      },

      puzzle: {
        attempts: randomInt(2, 15),
        uniqueParticipants: randomInt(1, Math.max(1, activeUsers - 1)),
        avgTimeTaken: randomInt(20, 120),
        completionRate: randomInt(50, 88),
      },

      kidsCorner: {
        views: randomInt(2, 12),
        uniqueViewers: randomInt(1, Math.max(1, activeUsers - 2)),
        submissions: {
          stories: randomInt(0, 3),
          poems: randomInt(0, 2),
          drawings: randomInt(0, 4),
        },
      },

      bookmarks: {
        added: randomInt(1, 8),
        removed: randomInt(0, 3),
        uniqueUsers: randomInt(1, Math.max(1, activeUsers - 2)),
      },

      topContent: [
        { contentId: "vid_001", contentType: "video", title: "Learn Malayalam Alphabets", count: randomInt(5, 20) },
        { contentId: "story_002", contentType: "story", title: "Adventures of Kunjikka", count: randomInt(3, 15) },
        { contentId: "quiz_001", contentType: "quiz", title: "Malayalam Quiz Level 1", count: randomInt(3, 12) },
        { contentId: "vid_005", contentType: "video", title: "Nursery Rhymes Collection", count: randomInt(2, 10) },
        { contentId: "bb_003", contentType: "brightbox", title: "BrightBox: Dinosaur World", count: randomInt(1, 8) },
      ],
    });
  }

  console.log(`Inserting ${summaries.length} daily summaries...`);
  await DailyAnalyticsSummary.insertMany(summaries);
  console.log("✅ Daily analytics summaries inserted!");
}

async function main() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("Connected!\n");

    // Clear existing sample data
    console.log("Clearing existing analytics data...");
    await AnalyticsEvent.deleteMany({});
    await DailyAnalyticsSummary.deleteMany({});
    console.log("Cleared!\n");

    // Seed events
    await seedEvents();
    console.log("");

    // Seed daily summaries
    await seedDailySummaries();

    // Print summary
    const eventCount = await AnalyticsEvent.countDocuments();
    const summaryCount = await DailyAnalyticsSummary.countDocuments();
    console.log("\n========= SEED COMPLETE =========");
    console.log(`  Analytics Events:    ${eventCount}`);
    console.log(`  Daily Summaries:     ${summaryCount}`);
    console.log(`  Date Range:          Last 30 days`);
    console.log(`  Sample Users:        ${sampleUsers.length}`);
    console.log("=================================\n");
  } catch (err) {
    console.error("Seed error:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

main();
