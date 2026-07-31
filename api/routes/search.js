const express = require("express");
const router = express.Router();
const Story = require("../models/stories");
const SingleStory = require("../models/singleStory");
const Videos = require("../models/videos");

/**
 * GET /api/search?q=<query>&limit=<n>
 *
 * Full-text search across Stories, Single Stories, and Videos.
 * Results are sorted by relevance score (text score) descending.
 *
 * Query params:
 *   q     - Required. Search query string (min 2 chars).
 *   limit - Optional. Max results per content type (default 5, max 20).
 */
router.get("/", async (req, res) => {
  try {
    const { q, limit: limitQuery } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Query parameter 'q' must be at least 2 characters.",
      });
    }

    const searchTerm = q.trim();
    const limit = Math.max(1, Math.min(20, parseInt(limitQuery, 10) || 5));

    // Build a regex for partial/case-insensitive matching as a fallback
    const regex = new RegExp(searchTerm, "i");

    const [stories, singleStories, videos] = await Promise.all([
      // Stories — search title and mlTitle
      Story.find(
        {
          status: "Active",
          $or: [
            { title: { $regex: regex } },
            { mlTitle: { $regex: regex } },
            { description: { $regex: regex } },
            { Tag: { $regex: regex } },
          ],
        },
        { title: 1, mlTitle: 1, coverImage: 1, Tag: 1, priority: 1, _id: 1 }
      )
        .sort({ priority: 1, createdAt: -1 })
        .limit(limit),

      // Single Stories — search title and mlTitle
      SingleStory.find(
        {
          $or: [
            { title: { $regex: regex } },
            { mlTitle: { $regex: regex } },
            { description: { $regex: regex } },
            { tag: { $regex: regex } },
          ],
        },
        { title: 1, mlTitle: 1, coverImage: 1, tag: 1, readTime: 1, _id: 1 }
      )
        .sort({ priority: 1, createdAt: -1 })
        .limit(limit),

      // Videos — search title
      Videos.find(
        { title: { $regex: regex } },
        { title: 1, thumbnail: 1, language: 1, _id: 1 }
      )
        .populate("category", "title")
        .sort({ order: 1 })
        .limit(limit),
    ]);

    const totalResults =
      stories.length + singleStories.length + videos.length;

    return res.json({
      success: true,
      query: searchTerm,
      totalResults,
      results: {
        stories: stories.map((s) => ({
          _id: s._id,
          type: "story",
          title: s.title,
          mlTitle: s.mlTitle,
          coverImage: s.coverImage,
          tag: s.Tag,
        })),
        singleStories: singleStories.map((s) => ({
          _id: s._id,
          type: "single_story",
          title: s.title,
          mlTitle: s.mlTitle,
          coverImage: s.coverImage,
          tag: s.tag,
          readTime: s.readTime,
        })),
        videos: videos.map((v) => ({
          _id: v._id,
          type: "video",
          title: v.title,
          thumbnail: v.thumbnail,
          language: v.language,
          category: v.category,
        })),
      },
    });
  } catch (err) {
    console.error("Search error:", err);
    return res.status(500).json({ success: false, message: "Search failed." });
  }
});

module.exports = router;
