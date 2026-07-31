const express = require("express");
const Story = require("../models/stories");
const BrightBoxStory = require("../models/brightBoxStory");
const SingleStory = require("../models/singleStory");
const TrendingVideo = require("../models/trendingVideo");
const HighlightBanner = require("../models/highlightBanner");

const router = express.Router();

// Strip trailing quote/backslash characters, fix missing https://, and fix reversed CDN domain
const cleanUrl = (url) => {
  if (typeof url !== "string") return url;
  // Strip trailing garbage characters
  let clean = url.replace(/["\s\\]+$/, "");
  // Fix missing https:// prefix
  if (clean && !clean.startsWith("http") && !clean.startsWith("/")) {
    clean = "https://" + clean;
  }
  // Fix reversed DigitalOcean CDN domain:
  // blr1.digitaloceanspaces.com/d4dx-storage/ZAITOON/...
  // → d4dx-storage.blr1.digitaloceanspaces.com/ZAITOON/...
  clean = clean.replace(
    /^(https?:\/\/)blr1\.digitaloceanspaces\.com\/d4dx-storage\//,
    "$1d4dx-storage.blr1.digitaloceanspaces.com/"
  );
  // Normalize CDN domain to direct Spaces domain (CDN returns 403 for private files):
  // d4dx-storage.blr1.cdn.digitaloceanspaces.com/...
  // → d4dx-storage.blr1.digitaloceanspaces.com/...
  clean = clean.replace(
    /blr1\.cdn\.digitaloceanspaces\.com/,
    "blr1.digitaloceanspaces.com"
  );
  return clean;
};

// GET /api/highlights - Get all highlighted items (public, no auth)
// Returns combined highlighted items from Stories episodes + BrightBox stories + Single Stories + Trending Videos
// Each item includes banner and navigation fields (contentType, contentId, storyId, seasonId)
// Sorted by updatedAt DESC, returns latest 5
router.get("/highlights", async (req, res) => {
  try {
    // Query 1: Highlighted episodes from Stories
    const highlightedEpisodes = await Story.aggregate([
      { $unwind: "$seasons" },
      { $unwind: "$seasons.episodes" },
      { $match: { "seasons.episodes.highlight": "Enable" } },
      { $sort: { "seasons.episodes.updatedAt": -1 } },
      {
        $project: {
          _id: "$seasons.episodes._id",
          type: { $literal: "story" },
          contentType: { $literal: "story" },
          contentId: "$seasons.episodes._id",
          title: "$seasons.episodes.title",
          mlTitle: "$seasons.episodes.mlTitle",
          urTitle: "$seasons.episodes.urTitle",
          hinTitle: "$seasons.episodes.hinTitle",
          image: "$seasons.episodes.coverImage",
          adBanner: "$seasons.episodes.adBanner",
          mlBanner: "$seasons.episodes.mlBanner",
          urBanner: "$seasons.episodes.urBanner",
          hinBanner: "$seasons.episodes.hinBanner",
          // Content files for direct navigation
          storyFile: "$seasons.episodes.storyFile",
          mlStoryFile: "$seasons.episodes.mlStoryFile",
          urStoryFile: "$seasons.episodes.urStoryFile",
          hinStoryFile: "$seasons.episodes.hinStoryFile",
          storyId: "$_id",
          storyTitle: "$title",
          seasonId: "$seasons._id",
          seasonNumber: "$seasons.seasonNumber",
          date: "$seasons.episodes.updatedAt",
          createdAt: "$seasons.episodes.createdAt",
          updatedAt: "$seasons.episodes.updatedAt"
        }
      }
    ]);

    // Query 2: Highlighted BrightBox stories
    const highlightedBrightBoxStories = await BrightBoxStory.find({ highlight: "Enable" })
      .sort({ updatedAt: -1 })
      .populate("category", "title mlTitle urTitle hinTitle image")
      .lean();

    const brightBoxItems = highlightedBrightBoxStories.map((story) => ({
      _id: story._id,
      type: "brightbox",
      contentType: "brightbox",
      contentId: story._id,
      title: story.title,
      mlTitle: story.mlTitle,
      urTitle: story.urTitle,
      hinTitle: story.hinTitle,
      image: cleanUrl(story.image),
      adBanner: cleanUrl(story.adBanner),
      mlBanner: cleanUrl(story.mlBanner),
      urBanner: cleanUrl(story.urBanner),
      hinBanner: cleanUrl(story.hinBanner),
      // Content files for direct navigation
      enFile: cleanUrl(story.enFile),
      mlFile: cleanUrl(story.mlFile),
      urFile: cleanUrl(story.urFile),
      hinFile: cleanUrl(story.hinFile),
      category: story.category,
      date: story.updatedAt,
      createdAt: story.createdAt,
      updatedAt: story.updatedAt
    }));

    // Query 3: Highlighted Single Stories
    const highlightedSingleStories = await SingleStory.find({ highlight: "Enable" })
      .sort({ updatedAt: -1 })
      .lean();

    const singleStoryItems = highlightedSingleStories.map((s) => ({
      _id: s._id,
      type: "single_story",
      contentType: "single_story",
      contentId: s._id,
      title: s.title,
      mlTitle: s.mlTitle,
      image: cleanUrl(s.coverImage),
      mlBanner: cleanUrl(s.mlBanner),
      enBanner: cleanUrl(s.enBanner),
      // Content files for direct navigation
      enStoryFile: cleanUrl(s.enStoryFile),
      mlStoryFile: cleanUrl(s.mlStoryFile),
      date: s.updatedAt,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt
    }));

    // Query 4: Trending Videos (trending = highlighted for videos)
    const trendingVideos = await TrendingVideo.find({})
      .sort({ order: 1 })
      .populate("video")
      .lean();

    const videoItems = trendingVideos.map((tv) => ({
      _id: tv._id,
      type: "video",
      contentType: "video",
      contentId: tv._id,
      videoId: tv.video?._id || null,
      title: tv.video?.title || "",
      image: cleanUrl(tv.video?.thumbnail || null),
      // Actual video URL for direct playback
      videoUrl: cleanUrl(tv.video?.video || null),
      trendingOrder: tv.order,
      date: tv.updatedAt,
      createdAt: tv.createdAt,
      updatedAt: tv.updatedAt
    }));

    // Merge all results and sort by updatedAt DESC, return latest 5
    const combined = [...highlightedEpisodes, ...brightBoxItems, ...singleStoryItems, ...videoItems];

    // Collect all contentIds for a batch HighlightBanner lookup
    const allIds = combined.map((i) => i._id);
    const highlightBanners = await HighlightBanner.find({ contentId: { $in: allIds } })
      .populate("banner")
      .lean();

    const hbMap = {};
    highlightBanners.forEach((hb) => {
      hbMap[`${hb.contentType}::${hb.contentId.toString()}`] = hb;
    });

    // Merge banner and navigation IDs into each item, clean all URLs
    const enriched = combined.map((item) => {
      const key = `${item.contentType}::${item._id.toString()}`;
      const hb = hbMap[key] || null;
      return {
        ...item,
        // Clean any dirty URLs that may have come through the aggregate
        image: cleanUrl(item.image),
        adBanner: cleanUrl(item.adBanner),
        mlBanner: cleanUrl(item.mlBanner),
        urBanner: cleanUrl(item.urBanner),
        hinBanner: cleanUrl(item.hinBanner),
        storyFile: cleanUrl(item.storyFile),
        mlStoryFile: cleanUrl(item.mlStoryFile),
        urStoryFile: cleanUrl(item.urStoryFile),
        hinStoryFile: cleanUrl(item.hinStoryFile),
        banner: hb?.banner || null,
        storyId: hb?.storyId || item.storyId || null,
        seasonId: hb?.seasonId || item.seasonId || null
      };
    });

    // Sort by most recently updated, return top 5
    enriched.sort((a, b) => new Date(b.date) - new Date(a.date));
    const latest5 = enriched.slice(0, 5);

    res.json({
      success: true,
      message: "Highlighted items retrieved successfully",
      data: {
        highlights: latest5,
        total: latest5.length
      }
    });
  } catch (error) {
    console.error("Get highlights error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

module.exports = router;
