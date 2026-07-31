/**
 * Scheduled Content Publisher Job
 *
 * Runs every minute. Finds all pending ScheduledContent items whose
 * publishAt time has arrived and creates the real content documents.
 */

const ScheduledContent = require("../models/scheduledContent");
const Story = require("../models/stories");
const SingleStory = require("../models/singleStory");
const Videos = require("../models/videos");
const Banner = require("../models/banner");
const PaymentBanner = require("../models/paymentBanner");
const BrightBox = require("../models/brightBox");
const BrightBoxStory = require("../models/brightBoxStory");
const Puzzle = require("../models/puzzles");
const KidsSubmission = require("../models/kidsSubmission");
const Quiz = require("../models/quiz");
const Question = require("../models/question");

const INTERVAL_MS = 60 * 1000; // 1 minute

/**
 * Creates the actual content document based on contentType and contentData.
 * Returns the created document.
 */
async function publishItem(item) {
  const data = item.contentData;

  switch (item.contentType) {
    case "story":
      return await Story.create(data);

    case "single-story":
      return await SingleStory.create(data);

    case "video":
      return await Videos.create(data);

    case "banner":
      return await Banner.create(data);

    case "payment-banner":
      return await PaymentBanner.create(data);

    case "bright-box":
      return await BrightBox.create(data);

    case "bright-box-story":
      return await BrightBoxStory.create(data);

    case "puzzle": {
      // translations may be a JSON string from the form
      const puzzleData = { ...data };
      if (typeof puzzleData.translations === "string") {
        try {
          puzzleData.translations = JSON.parse(puzzleData.translations);
        } catch (_) {
          // leave as-is
        }
      }
      return await Puzzle.create(puzzleData);
    }

    case "kids-submission":
      return await KidsSubmission.create(data);

    case "quiz": {
      // questions may be a JSON string (array of ids)
      const quizData = { ...data };
      if (typeof quizData.questions === "string") {
        try {
          quizData.questions = JSON.parse(quizData.questions);
        } catch (_) {
          // leave as-is
        }
      }
      return await Quiz.create(quizData);
    }

    case "question": {
      const qData = { ...data };
      if (typeof qData.options === "string") {
        try { qData.options = JSON.parse(qData.options); } catch (_) {}
      }
      if (typeof qData.mlOptions === "string") {
        try { qData.mlOptions = JSON.parse(qData.mlOptions); } catch (_) {}
      }
      return await Question.create(qData);
    }

    default:
      throw new Error(`Unknown contentType: ${item.contentType}`);
  }
}

async function processScheduledContent() {
  try {
    const now = new Date();
    const dueItems = await ScheduledContent.find({
      status: "pending",
      publishAt: { $lte: now }
    }).limit(50);

    if (dueItems.length === 0) return;

    console.log(`[SchedulePublisher] Processing ${dueItems.length} due item(s)`);

    for (const item of dueItems) {
      try {
        const created = await publishItem(item);
        item.status = "published";
        item.publishedId = created._id;
        item.errorMessage = undefined;
        await item.save();
        console.log(`[SchedulePublisher] Published "${item.title}" (${item.contentType}) → ${created._id}`);
      } catch (err) {
        item.status = "failed";
        item.errorMessage = err.message || "Unknown error";
        await item.save();
        console.error(`[SchedulePublisher] Failed to publish "${item.title}":`, err.message);
      }
    }
  } catch (err) {
    console.error("[SchedulePublisher] Job error:", err.message);
  }
}

function startScheduledContentPublisher() {
  // First run after 30 seconds to let DB connect
  setTimeout(processScheduledContent, 30 * 1000);
  setInterval(processScheduledContent, INTERVAL_MS);
  console.log("[SchedulePublisher] Started — checking every 1 minute");
}

module.exports = { startScheduledContentPublisher };
