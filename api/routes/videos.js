const express = require("express");
const Videos = require("../models/videos");
const VideosCategory = require("../models/videosCategory");
const { authenticateAdmin } = require("../middleware/auth");
const { upload, deleteFile, getFileKeyFromUrl } = require("../utils/cdn");
const { sendContentNotification } = require("../services/notificationService");

const router = express.Router();

// Configure multer to accept video and thumbnail uploads
const uploadFields = upload.fields([
  { name: "video", maxCount: 1 },
  { name: "thumbnail", maxCount: 1 }
]);

// GET /api/videos - Get all videos (public)
router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 10, category } = req.query;
    
    // Build filter object
    const filter = {};
    if (category) filter.category = category;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get videos with pagination and populate category
    // Sort primarily by custom order (if set), then by creation date (newest first)
    const videos = await Videos.find(filter)
      .populate('category', 'title image')
      .sort({ order: 1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await Videos.countDocuments(filter);

    res.status(200).json({
      success: true,
      message: "Videos retrieved successfully",
      data: {
        videos,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalVideos: total,
          hasNext: skip + videos.length < total,
          hasPrev: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    console.error("Get videos error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching videos"
    });
  }
});

// GET /api/videos/:id - Get single video by ID (public)
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid video ID format"
      });
    }

    const video = await Videos.findById(id).populate('category', 'title image');

    if (!video) {
      return res.status(404).json({
        success: false,
        message: "Video not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Video retrieved successfully",
      data: video
    });

  } catch (error) {
    console.error("Get video error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching video"
    });
  }
});

// POST /api/videos - Create new video (admin only)
router.post("/", authenticateAdmin, uploadFields, async (req, res) => {
  try {
    const { title, category, language } = req.body;

    // Validate required fields
    if (!title || !category) {
      return res.status(400).json({
        success: false,
        message: "Title and category are required"
      });
    }

    // Validate category exists
    const categoryExists = await VideosCategory.findById(category);
    if (!categoryExists) {
      return res.status(400).json({
        success: false,
        message: "Category not found"
      });
    }

    // Get video from uploaded files or text URL (CDN upload or URL)
    const videoFile = req.files && req.files.video && req.files.video[0];
    const video = videoFile ? videoFile.location : req.body.video;

    if (!video) {
      return res.status(400).json({
        success: false,
        message: "Video is required (either as file upload or URL)"
      });
    }

    // Push existing videos in this category down by 1 so the new video appears first
    await Videos.updateMany({ category }, { $inc: { order: 1 } });
    const nextOrder = 0;

    // Get thumbnail from uploaded file or URL
    const thumbnailFile = req.files && req.files.thumbnail && req.files.thumbnail[0];
    const thumbnail = thumbnailFile ? thumbnailFile.location : req.body.thumbnail || undefined;

    // Create new video
    const newVideo = new Videos({
      title,
      video,
      category,
      order: nextOrder,
      ...(language && { language }),
      ...(thumbnail && { thumbnail })
    });

    const savedVideo = await newVideo.save();
    
    // Populate category in response
    await savedVideo.populate('category', 'title image');

    // Send push notification to all users
    await sendContentNotification({
      contentType: "video",
      contentId: savedVideo._id,
      title: savedVideo.title,
      message: `New video added: ${savedVideo.title}`,
      imageUrl: savedVideo.thumbnail,
    });

    res.status(201).json({
      success: true,
      message: "Video created successfully",
      data: savedVideo
    });

  } catch (error) {
    console.error("Create video error:", error);
    
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
      message: "Internal server error while creating video"
    });
  }
});

// PUT /api/videos/reorder - Reorder videos globally via drag-and-drop (admin only)
// Body: { videoIds: ["id1", "id2", ...] }  — assigns order 1, 2, 3 ... based on array position.
router.put("/reorder", authenticateAdmin, async (req, res) => {
  try {
    const { videoIds } = req.body;

    if (!Array.isArray(videoIds) || videoIds.length === 0) {
      return res.status(400).json({ success: false, message: "videoIds array is required and cannot be empty" });
    }

    const invalidId = videoIds.find((id) => !id.match(/^[0-9a-fA-F]{24}$/));
    if (invalidId) {
      return res.status(400).json({ success: false, message: `Invalid video ID: ${invalidId}` });
    }

    const bulkOps = videoIds.map((id, index) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: { order: index + 1 } }
      }
    }));

    await Videos.bulkWrite(bulkOps);

    res.status(200).json({ success: true, message: "Videos reordered successfully" });
  } catch (error) {
    console.error("Reorder videos error:", error);
    res.status(500).json({ success: false, message: "Internal server error while reordering videos" });
  }
});


// PUT /api/videos/:id - Update video by ID (admin only)
router.put("/:id", authenticateAdmin, uploadFields, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // Validate MongoDB ObjectId
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid video ID format"
      });
    }

    // Validate category if provided
    if (updateData.category) {
      const categoryExists = await VideosCategory.findById(updateData.category);
      if (!categoryExists) {
        return res.status(400).json({
          success: false,
          message: "Category not found"
        });
      }
    }

    // Handle thumbnail file upload or URL update
    const thumbnailFile = req.files && req.files.thumbnail && req.files.thumbnail[0];
    if (thumbnailFile) {
      const existing = await Videos.findById(id);
      if (existing && existing.thumbnail) {
        const oldKey = getFileKeyFromUrl(existing.thumbnail);
        if (oldKey) await deleteFile(oldKey);
      }
      updateData.thumbnail = thumbnailFile.location;
    } else if (req.body.thumbnail !== undefined) {
      const existing = await Videos.findById(id);
      if (existing && existing.thumbnail) {
        const oldKey = getFileKeyFromUrl(existing.thumbnail);
        if (oldKey) await deleteFile(oldKey);
      }
      updateData.thumbnail = req.body.thumbnail;
    }

    // Handle video file upload or URL update
    const videoFile = req.files && req.files.video && req.files.video[0];
    if (videoFile) {
      // Delete old video if exists and it's a CDN file
      const existing = await Videos.findById(id);
      if (existing && existing.video) {
        const oldKey = getFileKeyFromUrl(existing.video);
        if (oldKey) await deleteFile(oldKey);
      }
      updateData.video = videoFile.location;
    } else if (req.body.video !== undefined) {
      // Handle URL update - delete old CDN file if it exists
      const existing = await Videos.findById(id);
      if (existing && existing.video) {
        const oldKey = getFileKeyFromUrl(existing.video);
        if (oldKey) await deleteFile(oldKey);
      }
      updateData.video = req.body.video;
    }

    // Find and update video
    const updatedVideo = await Videos.findByIdAndUpdate(
      id,
      updateData,
      { 
        new: true, // Return updated document
        runValidators: true // Run schema validators
      }
    ).populate('category', 'title image');

    if (!updatedVideo) {
      return res.status(404).json({
        success: false,
        message: "Video not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Video updated successfully",
      data: updatedVideo
    });

  } catch (error) {
    console.error("Update video error:", error);
    
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
      message: "Internal server error while updating video"
    });
  }
});

// DELETE /api/videos/:id - Delete video by ID (admin only)
router.delete("/:id", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid video ID format"
      });
    }

    const existing = await Videos.findById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Video not found"
      });
    }

    // Delete video from CDN if it's a CDN file
    if (existing.video) {
      const key = getFileKeyFromUrl(existing.video);
      if (key) await deleteFile(key);
    }
    if (existing.thumbnail) {
      const key = getFileKeyFromUrl(existing.thumbnail);
      if (key) await deleteFile(key);
    }

    await Videos.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Video deleted successfully",
      data: {
        id: existing._id,
        title: existing.title
      }
    });

  } catch (error) {
    console.error("Delete video error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while deleting video"
    });
  }
});

// GET /api/videos/category/:categoryId - Get videos by category (public)
router.get("/category/:categoryId", async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Validate MongoDB ObjectId
    if (!categoryId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID format"
      });
    }

    // Validate category exists
    const category = await VideosCategory.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get videos by category with pagination
    const videos = await Videos.find({ category: categoryId })
      .populate('category', 'title image')
      .sort({ order: 1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await Videos.countDocuments({ category: categoryId });

    res.status(200).json({
      success: true,
      message: "Videos retrieved successfully",
      data: {
        category: {
          _id: category._id,
          title: category.title,
          image: category.image
        },
        videos,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalVideos: total,
          hasNext: skip + videos.length < total,
          hasPrev: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    console.error("Get videos by category error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching videos by category"
    });
  }
});
// PUT /api/videos/category/:categoryId/reorder - Reorder videos inside a category (admin only)
router.put("/category/:categoryId/reorder", authenticateAdmin, async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { videos } = req.body; // array of video IDs in desired order

    // Validate MongoDB ObjectId
    if (!categoryId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID format"
      });
    }

    if (!Array.isArray(videos) || videos.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Videos array is required and cannot be empty"
      });
    }

    // Validate category exists
    const category = await VideosCategory.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    // Fetch all videos by IDs and ensure they belong to this category
    const foundVideos = await Videos.find({ _id: { $in: videos } });

    const invalid = foundVideos.find(
      (v) => v.category.toString() !== categoryId.toString()
    );
    if (invalid) {
      return res.status(400).json({
        success: false,
        message: "All videos must belong to the specified category"
      });
    }

    // Apply new sequential order
    const bulkOps = videos.map((id, index) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: { order: index + 1 } }
      }
    }));

    await Videos.bulkWrite(bulkOps);

    res.status(200).json({
      success: true,
      message: "Videos reordered successfully"
    });

  } catch (error) {
    console.error("Reorder videos error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while reordering videos"
    });
  }
});

module.exports = router;
