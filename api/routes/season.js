const express = require("express");
const mongoose = require("mongoose");
const Story = require("../models/stories");
const { authenticateAdmin } = require("../middleware/auth");
const { upload, deleteFile, getFileKeyFromUrl } = require("../utils/cdn");

const router = express.Router();

// Configure multer to accept seasonBanner file upload
const uploadFields = upload.fields([
  { name: "seasonBanner", maxCount: 1 }
]);

function isValidObjectId(id) {
  return typeof id === "string" && mongoose.Types.ObjectId.isValid(id);
}

// GET /api/seasons - Get all seasons with story information (public)
router.get("/seasons", async (req, res) => {
  try {
    const { page = 1, limit = 10, storyId } = req.query;
    
    // Build filter object
    const filter = {};
    if (storyId) filter._id = storyId;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get stories with seasons
    const stories = await Story.find(filter)
      .select("title description Tag coverImage status seasons")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Flatten seasons with story information
    const seasonsWithStory = [];
    stories.forEach(story => {
      if (story.seasons && story.seasons.length > 0) {
        story.seasons.forEach(season => {
          seasonsWithStory.push({
            ...season.toObject(),
            story: {
              _id: story._id,
              title: story.title,
              description: story.description,
              Tag: story.Tag,
              coverImage: story.coverImage,
              status: story.status
            }
          });
        });
      }
    });

    // Get total count for pagination
    const totalStories = await Story.countDocuments(filter);
    const totalSeasons = seasonsWithStory.length;

    res.status(200).json({
      success: true,
      message: "Seasons retrieved successfully",
      data: {
        seasons: seasonsWithStory,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalStories / parseInt(limit)),
          totalStories: totalStories,
          totalSeasons: totalSeasons,
          hasNext: skip + stories.length < totalStories,
          hasPrev: parseInt(page) > 1
        }
      }
    });

  } catch (err) {
    console.error("Get all seasons error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// GET /api/stories/:storyId/seasons - Get all seasons for a story (public)
router.get("/stories/:storyId/seasons", async (req, res) => {
  try {
    const { storyId } = req.params;
    if (!isValidObjectId(storyId)) {
      return res.status(400).json({ success: false, message: "Invalid story ID" });
    }

    const story = await Story.findById(storyId).select("seasons title");
    if (!story) {
      return res.status(404).json({ success: false, message: "Story not found" });
    }

    // Add storyId to each season
    const seasonsWithStoryId = (story.seasons || []).map(season => ({
      ...season.toObject(),
      storyId: storyId
    }));

    return res.status(200).json({ 
      success: true, 
      data: seasonsWithStoryId,
      storyId: storyId,
      storyTitle: story.title
    });
  } catch (err) {
    console.error("Get seasons error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// GET /api/stories/:storyId/seasons/:seasonId - Get single season (public)
router.get("/stories/:storyId/seasons/:seasonId", async (req, res) => {
  try {
    const { storyId, seasonId } = req.params;
    if (!isValidObjectId(storyId) || !isValidObjectId(seasonId)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const story = await Story.findById(storyId).select("seasons title");
    if (!story) {
      return res.status(404).json({ success: false, message: "Story not found" });
    }

    const season = story.seasons.id(seasonId);
    if (!season) {
      return res.status(404).json({ success: false, message: "Season not found" });
    }

    // Add storyId to the season
    const seasonWithStoryId = {
      ...season.toObject(),
      storyId: storyId
    };

    return res.status(200).json({ 
      success: true, 
      data: seasonWithStoryId,
      storyId: storyId,
      storyTitle: story.title
    });
  } catch (err) {
    console.error("Get season error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// POST /api/stories/:storyId/seasons - Create a season (admin)
router.post("/stories/:storyId/seasons", authenticateAdmin, uploadFields, async (req, res) => {
  try {
    const { storyId } = req.params;
    const { seasonNumber } = req.body;

    if (!isValidObjectId(storyId)) {
      return res.status(400).json({ success: false, message: "Invalid story ID" });
    }

    // Get seasonBanner from uploaded files (CDN upload)
    const seasonBannerFile = req.files && req.files.seasonBanner && req.files.seasonBanner[0];
    const seasonBanner = seasonBannerFile ? seasonBannerFile.location : req.body.seasonBanner;

    if (seasonNumber == null || !seasonBanner) {
      return res.status(400).json({ success: false, message: "seasonNumber and seasonBanner are required" });
    }

    const story = await Story.findById(storyId);
    if (!story) {
      return res.status(404).json({ success: false, message: "Story not found" });
    }

    const hasDuplicate = (story.seasons || []).some((s) => s.seasonNumber === Number(seasonNumber));
    if (hasDuplicate) {
      return res.status(409).json({ success: false, message: "Season number already exists for this story" });
    }

    story.seasons = story.seasons || [];
    story.seasons.push({ seasonNumber: Number(seasonNumber), seasonBanner });
    await story.save();

    const created = story.seasons[story.seasons.length - 1];
    return res.status(201).json({ success: true, message: "Season created", data: created });
  } catch (err) {
    console.error("Create season error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// PUT /api/stories/:storyId/seasons/:seasonId - Update a season (admin)
router.put("/stories/:storyId/seasons/:seasonId", authenticateAdmin, uploadFields, async (req, res) => {
  try {
    const { storyId, seasonId } = req.params;
    const { seasonNumber } = req.body;
    if (!isValidObjectId(storyId) || !isValidObjectId(seasonId)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const story = await Story.findById(storyId);
    if (!story) {
      return res.status(404).json({ success: false, message: "Story not found" });
    }

    const season = story.seasons.id(seasonId);
    if (!season) {
      return res.status(404).json({ success: false, message: "Season not found" });
    }

    if (seasonNumber != null && seasonNumber !== season.seasonNumber) {
      const duplicate = (story.seasons || []).some((s) => s._id.toString() !== seasonId && s.seasonNumber === Number(seasonNumber));
      if (duplicate) {
        return res.status(409).json({ success: false, message: "Season number already exists for this story" });
      }
      season.seasonNumber = Number(seasonNumber);
    }

    // Handle seasonBanner file upload
    const seasonBannerFile = req.files && req.files.seasonBanner && req.files.seasonBanner[0];
    if (seasonBannerFile) {
      // Delete old seasonBanner if exists
      if (season.seasonBanner) {
        const oldKey = getFileKeyFromUrl(season.seasonBanner);
        if (oldKey) await deleteFile(oldKey);
      }
      season.seasonBanner = seasonBannerFile.location;
    } else if (req.body.seasonBanner != null) {
      season.seasonBanner = req.body.seasonBanner;
    }

    await story.save();
    return res.status(200).json({ success: true, message: "Season updated", data: season });
  } catch (err) {
    console.error("Update season error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// DELETE /api/stories/:storyId/seasons/:seasonId - Delete a season (admin)
router.delete("/stories/:storyId/seasons/:seasonId", authenticateAdmin, async (req, res) => {
  try {
    const { storyId, seasonId } = req.params;
    if (!isValidObjectId(storyId) || !isValidObjectId(seasonId)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const story = await Story.findById(storyId);
    if (!story) {
      return res.status(404).json({ success: false, message: "Story not found" });
    }

    const season = story.seasons.id(seasonId);
    if (!season) {
      return res.status(404).json({ success: false, message: "Season not found" });
    }

    // Delete seasonBanner from CDN if exists
    if (season.seasonBanner) {
      const key = getFileKeyFromUrl(season.seasonBanner);
      if (key) await deleteFile(key);
    }

    // Delete all episode files in this season
    if (season.episodes && season.episodes.length > 0) {
      for (const episode of season.episodes) {
        const episodeFiles = [
          episode.coverImage,
          episode.storyFile,
          episode.mlStoryFile,
          episode.urStoryFile,
          episode.hinStoryFile,
          episode.adBanner,
          episode.mlBanner,
          episode.urBanner,
          episode.hinBanner
        ];
        
        for (const fileUrl of episodeFiles) {
          if (fileUrl) {
            const fileKey = getFileKeyFromUrl(fileUrl);
            if (fileKey) await deleteFile(fileKey);
          }
        }
      }
    }

    season.deleteOne();
    await story.save();

    return res.status(200).json({ success: true, message: "Season deleted" });
  } catch (err) {
    console.error("Delete season error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

module.exports = router;


