const express = require("express");
const mongoose = require("mongoose");
const Story = require("../models/stories");
const BrightBoxStory = require("../models/brightBoxStory");
const SingleStory = require("../models/singleStory");
const TrendingVideo = require("../models/trendingVideo");
const HighlightBanner = require("../models/highlightBanner");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// ─── Helper: merge HighlightBanner docs into items ───────────────────────────
async function mergeHighlightBanners(contentType, items, idKey = "_id") {
  if (!items.length) return items;
  const ids = items.map((i) => i[idKey]);
  const hbs = await HighlightBanner.find({ contentType, contentId: { $in: ids } })
    .populate("banner")
    .lean();
  const map = {};
  hbs.forEach((h) => { map[h.contentId.toString()] = h; });
  return items.map((item) => {
    const hb = map[item[idKey].toString()] || null;
    return {
      ...item,
      highlightBannerId: hb?._id || null,
      banner: hb?.banner || null,
      order: hb?.order ?? 0,
      storyId: hb?.storyId || item.storyId || null,
      seasonId: hb?.seasonId || item.seasonId || null
    };
  });
}

// ─── GET /api/admin/highlights?type= ─────────────────────────────────────────
// Returns highlighted items for one content type, with banner + order merged in
router.get("/highlights", authenticateToken, async (req, res) => {
  const { type } = req.query;
  const validTypes = ["story", "single_story", "video", "brightbox"];
  if (!type || !validTypes.includes(type)) {
    return res.status(400).json({
      success: false,
      message: `Query param 'type' must be one of: ${validTypes.join(", ")}`
    });
  }

  try {
    let items = [];

    if (type === "story") {
      const episodes = await Story.aggregate([
        { $unwind: "$seasons" },
        { $unwind: "$seasons.episodes" },
        { $match: { "seasons.episodes.highlight": "Enable" } },
        { $sort: { "seasons.episodes.updatedAt": -1 } },
        {
          $project: {
            _id: "$seasons.episodes._id",
            type: { $literal: "story" },
            title: "$seasons.episodes.title",
            mlTitle: "$seasons.episodes.mlTitle",
            urTitle: "$seasons.episodes.urTitle",
            hinTitle: "$seasons.episodes.hinTitle",
            image: "$seasons.episodes.coverImage",
            storyId: "$_id",
            storyTitle: "$title",
            seasonId: "$seasons._id",
            seasonNumber: "$seasons.seasonNumber",
            updatedAt: "$seasons.episodes.updatedAt",
            createdAt: "$seasons.episodes.createdAt"
          }
        }
      ]);
      items = await mergeHighlightBanners("story", episodes);
    }

    if (type === "single_story") {
      const docs = await SingleStory.find({ highlight: "Enable" })
        .sort({ updatedAt: -1 })
        .lean();
      const mapped = docs.map((s) => ({
        _id: s._id,
        type: "single_story",
        title: s.title,
        mlTitle: s.mlTitle,
        image: s.coverImage,
        updatedAt: s.updatedAt,
        createdAt: s.createdAt
      }));
      items = await mergeHighlightBanners("single_story", mapped);
    }

    if (type === "video") {
      const docs = await TrendingVideo.find({})
        .sort({ order: 1 })
        .populate("video")
        .lean();
      const mapped = docs.map((tv) => ({
        _id: tv._id,
        type: "video",
        title: tv.video?.title || "",
        image: tv.video?.thumbnail || null,
        videoId: tv.video?._id || null,
        trendingOrder: tv.order,
        updatedAt: tv.updatedAt,
        createdAt: tv.createdAt
      }));
      items = await mergeHighlightBanners("video", mapped);
    }

    if (type === "brightbox") {
      const docs = await BrightBoxStory.find({ highlight: "Enable" })
        .sort({ updatedAt: -1 })
        .populate("category", "title mlTitle urTitle hinTitle image")
        .lean();
      const mapped = docs.map((b) => ({
        _id: b._id,
        type: "brightbox",
        title: b.title,
        mlTitle: b.mlTitle,
        urTitle: b.urTitle,
        hinTitle: b.hinTitle,
        image: b.image,
        category: b.category,
        updatedAt: b.updatedAt,
        createdAt: b.createdAt
      }));
      items = await mergeHighlightBanners("brightbox", mapped);
    }

    res.json({
      success: true,
      data: { type, items, total: items.length }
    });
  } catch (error) {
    console.error("Admin highlights GET error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// ─── PUT /api/admin/highlights/:contentType/:contentId ────────────────────────
// Upsert HighlightBanner for one item: set banner and/or order
router.put("/highlights/:contentType/:contentId", authenticateToken, async (req, res) => {
  const { contentType, contentId } = req.params;
  const validTypes = ["story", "single_story", "video", "brightbox"];

  if (!validTypes.includes(contentType)) {
    return res.status(400).json({ success: false, message: "Invalid contentType" });
  }
  if (!mongoose.Types.ObjectId.isValid(contentId)) {
    return res.status(400).json({ success: false, message: "Invalid contentId" });
  }

  const { bannerId, order, storyId, seasonId } = req.body;

  const update = {};
  if (bannerId !== undefined) {
    if (bannerId === null || bannerId === "") {
      update.banner = null;
    } else if (mongoose.Types.ObjectId.isValid(bannerId)) {
      update.banner = bannerId;
    } else {
      return res.status(400).json({ success: false, message: "Invalid bannerId" });
    }
  }
  if (order !== undefined) update.order = Number(order);
  if (storyId && mongoose.Types.ObjectId.isValid(storyId)) update.storyId = storyId;
  if (seasonId && mongoose.Types.ObjectId.isValid(seasonId)) update.seasonId = seasonId;

  try {
    const doc = await HighlightBanner.findOneAndUpdate(
      { contentType, contentId },
      { $set: update },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).populate("banner");

    res.json({ success: true, data: doc });
  } catch (error) {
    console.error("Admin highlights PUT error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// ─── DELETE /api/admin/highlights/:contentType/:contentId/banner ──────────────
// Clear only the banner ref; preserve order and other fields
router.delete("/highlights/:contentType/:contentId/banner", authenticateToken, async (req, res) => {
  const { contentType, contentId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(contentId)) {
    return res.status(400).json({ success: false, message: "Invalid contentId" });
  }

  try {
    const doc = await HighlightBanner.findOneAndUpdate(
      { contentType, contentId },
      { $set: { banner: null } },
      { new: true }
    );

    if (!doc) {
      return res.status(404).json({ success: false, message: "HighlightBanner record not found" });
    }

    res.json({ success: true, data: doc });
  } catch (error) {
    console.error("Admin highlights DELETE banner error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

module.exports = router;
