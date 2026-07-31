/**
 * Highlight Expiry Job
 *
 * Runs every 5 minutes. Finds all highlighted content where
 * highlightExpiresAt has passed and sets highlight = "Disable".
 *
 * Covers:
 *  - Story episodes (embedded in stories collection)
 *  - BrightBox stories
 *  - Kids submissions
 */

const Story = require("../models/stories");
const BrightBoxStory = require("../models/brightBoxStory");
const KidsSubmission = require("../models/kidsSubmission");
const SingleStory = require("../models/singleStory");

const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

async function expireHighlights() {
  const now = new Date();

  try {
    // --- BrightBox stories ---
    const bbResult = await BrightBoxStory.updateMany(
      { highlight: "Enable", highlightExpiresAt: { $lte: now } },
      { $set: { highlight: "Disable", highlightExpiresAt: null } }
    );
    if (bbResult.modifiedCount > 0) {
      console.log(`[HighlightExpiry] Disabled ${bbResult.modifiedCount} BrightBox story highlight(s)`);
    }

    // --- Kids submissions ---
    const ksResult = await KidsSubmission.updateMany(
      { highlight: "Enable", highlightExpiresAt: { $lte: now } },
      { $set: { highlight: "Disable", highlightExpiresAt: null } }
    );
    if (ksResult.modifiedCount > 0) {
      console.log(`[HighlightExpiry] Disabled ${ksResult.modifiedCount} kids submission highlight(s)`);
    }

    // --- Story episodes (embedded) ---
    // Use arrayFilters to update only episodes that match
    const storyResult = await Story.updateMany(
      {
        "seasons.episodes": {
          $elemMatch: {
            highlight: "Enable",
            highlightExpiresAt: { $ne: null, $lte: now }
          }
        }
      },
      {
        $set: {
          "seasons.$[].episodes.$[ep].highlight": "Disable",
          "seasons.$[].episodes.$[ep].highlightExpiresAt": null
        }
      },
      {
        arrayFilters: [
          {
            "ep.highlight": "Enable",
            "ep.highlightExpiresAt": { $ne: null, $lte: now }
          }
        ]
      }
    );
    if (storyResult.modifiedCount > 0) {
      console.log(`[HighlightExpiry] Disabled episode highlights in ${storyResult.modifiedCount} story/stories`);
    }

    // --- Single stories ---
    const ssResult = await SingleStory.updateMany(
      { highlight: "Enable", highlightExpiresAt: { $ne: null, $lte: now } },
      { $set: { highlight: "Disable", highlightExpiresAt: null } }
    );
    if (ssResult.modifiedCount > 0) {
      console.log(`[HighlightExpiry] Disabled ${ssResult.modifiedCount} single story highlight(s)`);
    }
  } catch (err) {
    console.error("[HighlightExpiry] Job error:", err.message);
  }
}

function startHighlightExpiryJob() {
  // First run after 1 minute
  setTimeout(expireHighlights, 60 * 1000);
  setInterval(expireHighlights, INTERVAL_MS);
  console.log("[HighlightExpiry] Started — checking every 5 minutes");
}

module.exports = { startHighlightExpiryJob };
