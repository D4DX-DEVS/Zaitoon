const express = require("express");
const TrendingVideo = require("../models/trendingVideo");
const Videos = require("../models/videos");
const { authenticateAdmin } = require("../middleware/auth");

const router = express.Router();

// GET /api/videos/trending - Get all trending videos (public)
// Returns entries with video populated (includes thumbnail, title, video url, category)
router.get("/", async (req, res) => {
  try {
    const trending = await TrendingVideo.find()
      .populate({ path: "video", populate: { path: "category", select: "title image" } })
      .sort({ order: 1, createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      message: "Trending videos retrieved successfully",
      data: { trending }
    });
  } catch (error) {
    console.error("Get trending videos error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching trending videos"
    });
  }
});

// GET /api/videos/trending/check/:videoId - Check if a video is in trending (public)
router.get("/check/:videoId", async (req, res) => {
  try {
    const { videoId } = req.params;
    if (!videoId || !videoId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid video ID format"
      });
    }
    const entry = await TrendingVideo.findOne({ video: videoId }).lean();
    res.status(200).json({
      success: true,
      data: { inTrending: !!entry, trendingEntryId: entry ? entry._id : null }
    });
  } catch (error) {
    console.error("Check trending error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
});

// POST /api/videos/trending - Add video to trending (admin only)
// Body: { video: videoId } - same endpoint used from Trending section modal and from video card/category "Add to Trending"
router.post("/", authenticateAdmin, async (req, res) => {
  try {
    const { video: videoId } = req.body;

    if (!videoId) {
      return res.status(400).json({
        success: false,
        message: "Video ID is required"
      });
    }

    if (!videoId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid video ID format"
      });
    }

    const videoExists = await Videos.findById(videoId);
    if (!videoExists) {
      return res.status(404).json({
        success: false,
        message: "Video not found"
      });
    }

    const already = await TrendingVideo.findOne({ video: videoId });
    if (already) {
      return res.status(400).json({
        success: false,
        message: "Video is already in trending"
      });
    }

    const last = await TrendingVideo.findOne().sort({ order: -1 });
    const nextOrder = last && typeof last.order === "number" ? last.order + 1 : 1;

    const newEntry = new TrendingVideo({ video: videoId, order: nextOrder });
    const saved = await newEntry.save();
    await saved.populate({ path: "video", populate: { path: "category", select: "title image" } });

    res.status(201).json({
      success: true,
      message: "Video added to trending successfully",
      data: saved
    });
  } catch (error) {
    console.error("Add to trending error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while adding to trending"
    });
  }
});

// PUT /api/videos/trending/reorder - Reorder trending list (admin only)
router.put("/reorder", authenticateAdmin, async (req, res) => {
  try {
    const { trendingIds } = req.body;

    if (!Array.isArray(trendingIds) || trendingIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "trendingIds array is required and cannot be empty"
      });
    }

    const bulkOps = trendingIds.map((id, index) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: { order: index + 1 } }
      }
    }));

    await TrendingVideo.bulkWrite(bulkOps);

    res.status(200).json({
      success: true,
      message: "Trending order updated successfully"
    });
  } catch (error) {
    console.error("Reorder trending error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while reordering trending"
    });
  }
});

// DELETE /api/videos/trending/:id - Remove video from trending (admin only)
router.delete("/:id", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid trending entry ID format"
      });
    }

    const entry = await TrendingVideo.findByIdAndDelete(id);
    if (!entry) {
      return res.status(404).json({
        success: false,
        message: "Trending entry not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Video removed from trending successfully",
      data: { id: entry._id }
    });
  } catch (error) {
    console.error("Remove from trending error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while removing from trending"
    });
  }
});

module.exports = router;
