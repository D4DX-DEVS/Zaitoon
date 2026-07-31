const express = require("express");
const multer = require("multer");
const Story = require("../models/stories");
const { authenticateAdmin } = require("../middleware/auth");
const { deleteFile, getFileKeyFromUrl } = require("../utils/cdn");
const { optimizeAndUploadImage } = require("../utils/imageOptimizer");
const { sendContentNotification } = require("../services/notificationService");
const router = express.Router();

// Use in-memory storage here so we can compress images with sharp
const memoryStorage = multer.memoryStorage();
const upload = multer({ storage: memoryStorage });

// Configure multer to accept coverImage file upload
const uploadFields = upload.fields([
  { name: "coverImage", maxCount: 1 }
]);

// GET /api/stories - Get all stories (public)
router.get("/", async (req, res) => {
  try {
    const { status, tag, page: pageQuery, limit: limitQuery } = req.query;

    // Build filter object
    const matchStage = {};
    if (status) matchStage.status = status;
    if (tag) matchStage.Tag = tag;

    const page = Math.max(1, parseInt(pageQuery, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(limitQuery, 10) || 18));
    const skip = (page - 1) * limit;

    // Use a large number so stories without valid priority sort last
    const PRIORITY_LAST = 999999;

    // Get stories with pagination, sorted by effective priority (1 = first row/col, 2 = next, etc.)
    const [stories, total] = await Promise.all([
      Story.aggregate([
        { $match: matchStage },
        {
          $addFields: {
            // Force numeric priority: 1 first, 2 next; invalid/missing go last
            effectivePriority: {
              $cond: {
                if: {
                  $and: [
                    { $ne: ["$priority", null] },
                    { $ne: ["$priority", ""] },
                    { $gte: [
                      { $convert: { input: "$priority", to: "int", onError: PRIORITY_LAST, onNull: PRIORITY_LAST } },
                      1
                    ] }
                  ]
                },
                then: { $convert: { input: "$priority", to: "int", onError: PRIORITY_LAST, onNull: PRIORITY_LAST } },
                else: PRIORITY_LAST
              }
            }
          }
        },
        // Priority 1 = first, 2 = second (same row), etc. Same priority: newer first.
        { $sort: { effectivePriority: 1, createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $addFields: {
            seasonCount: { $size: { $ifNull: ["$seasons", []] } },
            episodeCount: {
              $sum: {
                $map: {
                  input: { $ifNull: ["$seasons", []] },
                  as: "season",
                  in: { $size: { $ifNull: ["$$season.episodes", []] } }
                }
              }
            }
          }
        },
        {
          $project: {
            title: 1,
            mlTitle: 1,
            coverImage: 1,
            priority: 1,
            createdAt: 1,
            _id: 1,
            seasonCount: 1,
            episodeCount: 1,
            Tag: 1
          }
        }
      ]),
      Story.countDocuments(matchStage)
    ]);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    res.status(200).json({
      success: true,
      message: "Stories retrieved successfully",
      data: {
        stories,
        pagination: {
          totalStories: total,
          page,
          limit,
          totalPages
        }
      }
    });

  } catch (error) {
    console.error("Get stories error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching stories"
    });
  }
});

// GET /api/stories/:id - Get single story by ID (public)
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid story ID format"
      });
    }

    const story = await Story.findById(id);

    if (!story) {
      return res.status(404).json({
        success: false,
        message: "Story not found"
      });
    }

    const storyObj = story.toObject();

    res.status(200).json({
      success: true,
      message: "Story retrieved successfully",
      data: storyObj
    });

  } catch (error) {
    console.error("Get story error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching story"
    });
  }
});

// POST /api/stories - Create new story (admin only)
router.post("/", authenticateAdmin, uploadFields, async (req, res) => {
  try {
    const {
      title,
      description,
      Tag,
      mlTitle,
      mlDescription,
      status = "Active",
      priority,
      hinTitle,
      hinDescription,
      urTitle,
      urDescription
    } = req.body;

    // Get coverImage from uploaded files (optimize + CDN upload) or URL
    const coverImageFile = req.files && req.files.coverImage && req.files.coverImage[0];
    const coverImage = coverImageFile
      ? await optimizeAndUploadImage(coverImageFile, { width: 1200, quality: 75 })
      : req.body.coverImage;

    // Validate required fields
    const requiredFields = ['title', 'description', 'Tag', 'mlTitle', 'mlDescription'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    // Check if coverImage is provided (either as file or URL)
    if (!coverImage) {
      missingFields.push('coverImage');
    }

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Validate status enum
    if (status && !['Active', 'Inactive'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be either 'Active' or 'Inactive'"
      });
    }

    // Normalize priority: must be >= 1, default 1
    let normalizedPriority = 1;
    if (priority !== undefined) {
      const n = parseInt(priority, 10);
      if (!Number.isNaN(n) && n >= 1) {
        normalizedPriority = n;
      }
    }

    // Create new story
    const newStory = new Story({
      title,
      description,
      Tag,
      coverImage,
      mlTitle,
      mlDescription,
      status,
      priority: normalizedPriority,
      hinTitle,
      hinDescription,
      urTitle,
      urDescription
    });

    const savedStory = await newStory.save();

    // Send push notification to all users
    await sendContentNotification({
      contentType: "story",
      contentId: savedStory._id,
      title: savedStory.title,
      message: `New story added: ${savedStory.title}`,
      imageUrl: savedStory.coverImage,
    });

    res.status(201).json({
      success: true,
      message: "Story created successfully",
      data: savedStory
    });

  } catch (error) {
    console.error("Create story error:", error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error while creating story"
    });
  }
});

// PUT /api/stories/reorder - Reorder stories via drag-and-drop (admin only)
// Body: { storyIds: ["id1", "id2", ...] }  — IDs listed in the desired priority order.
// Assigns priority 1, 2, 3 ... based on array position.
// IMPORTANT: Must be defined BEFORE PUT /:id to avoid "reorder" matching as an ID.
router.put("/reorder", authenticateAdmin, async (req, res) => {
  try {
    const { storyIds } = req.body;

    if (!Array.isArray(storyIds) || storyIds.length === 0) {
      return res.status(400).json({ success: false, message: "storyIds array is required and cannot be empty" });
    }

    const invalidId = storyIds.find((id) => !id.match(/^[0-9a-fA-F]{24}$/));
    if (invalidId) {
      return res.status(400).json({ success: false, message: `Invalid story ID: ${invalidId}` });
    }

    const bulkOps = storyIds.map((id, index) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: { priority: index + 1 } }
      }
    }));

    await Story.bulkWrite(bulkOps);

    res.status(200).json({ success: true, message: "Stories reordered successfully" });
  } catch (error) {
    console.error("Reorder stories error:", error);
    res.status(500).json({ success: false, message: "Internal server error while reordering stories" });
  }
});

// PUT /api/stories/:id - Update story by ID (admin only)
router.put("/:id", authenticateAdmin, uploadFields, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // Validate MongoDB ObjectId
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid story ID format"
      });
    }

    // Fetch existing story to support safe updates (e.g., priority, cover image cleanup)
    const existing = await Story.findById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Story not found"
      });
    }

    // Normalize priority (must be >= 1, default existing or 1)
    const existingPriorityNumber = (() => {
      const n = parseInt(existing.priority, 10);
      return !Number.isNaN(n) && n >= 1 ? n : 1;
    })();

    let updatedPriority = existingPriorityNumber;
    if (req.body.priority !== undefined) {
      const n = parseInt(req.body.priority, 10);
      if (!Number.isNaN(n) && n >= 1) {
        updatedPriority = n;
      }
    }
    updateData.priority = updatedPriority;

    // Handle coverImage file upload
    const coverImageFile = req.files && req.files.coverImage && req.files.coverImage[0];
    if (coverImageFile) {
      // Delete old coverImage if exists
      if (existing && existing.coverImage) {
        const oldKey = getFileKeyFromUrl(existing.coverImage);
        if (oldKey) await deleteFile(oldKey);
      }
      updateData.coverImage = await optimizeAndUploadImage(coverImageFile, { width: 1200, quality: 75 });
    }

    // Validate status enum if provided
    if (updateData.status && !['Active', 'Inactive'].includes(updateData.status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be either 'Active' or 'Inactive'"
      });
    }

    // Find and update story
    const updatedStory = await Story.findByIdAndUpdate(
      id,
      updateData,
      { 
        new: true, // Return updated document
        runValidators: true // Run schema validators
      }
    );

    if (!updatedStory) {
      return res.status(404).json({
        success: false,
        message: "Story not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Story updated successfully",
      data: updatedStory
    });

  } catch (error) {
    console.error("Update story error:", error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error while updating story"
    });
  }
});

// DELETE /api/stories/:id - Delete story by ID (admin only)
router.delete("/:id", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid story ID format"
      });
    }

    const existing = await Story.findById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Story not found"
      });
    }

    // Delete CDN files if present
    if (existing.coverImage) {
      const key = getFileKeyFromUrl(existing.coverImage);
      if (key) await deleteFile(key);
    }

    // Delete all seasons and episodes files
    if (existing.seasons && existing.seasons.length > 0) {
      for (const season of existing.seasons) {
        // Delete season banner
        if (season.seasonBanner) {
          const seasonKey = getFileKeyFromUrl(season.seasonBanner);
          if (seasonKey) await deleteFile(seasonKey);
        }
        
        // Delete episode files
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
      }
    }

    await Story.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Story deleted successfully",
      data: {
        id: existing._id,
        title: existing.title
      }
    });

  } catch (error) {
    console.error("Delete story error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while deleting story"
    });
  }
});

// PATCH /api/stories/:id/status - Update story status only (admin only)
router.patch("/:id/status", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate MongoDB ObjectId
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid story ID format"
      });
    }

    // Validate status
    if (!status || !['Active', 'Inactive'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status is required and must be either 'Active' or 'Inactive'"
      });
    }

    const updatedStory = await Story.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    );

    if (!updatedStory) {
      return res.status(404).json({
        success: false,
        message: "Story not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Story status updated successfully",
      data: {
        id: updatedStory._id,
        title: updatedStory.title,
        status: updatedStory.status
      }
    });

  } catch (error) {
    console.error("Update story status error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while updating story status"
    });
  }
});

module.exports = router;
