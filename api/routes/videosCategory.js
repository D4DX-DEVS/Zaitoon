const express = require("express");
const multer = require("multer");
const VideosCategory = require("../models/videosCategory");
const { authenticateAdmin } = require("../middleware/auth");
const { deleteFile, getFileKeyFromUrl } = require("../utils/cdn");
const { optimizeAndUploadImage } = require("../utils/imageOptimizer");

const router = express.Router();

// Use in-memory storage so we can compress category images with sharp
const memoryStorage = multer.memoryStorage();
const upload = multer({ storage: memoryStorage });

// Configure multer to accept image file upload
const uploadFields = upload.fields([
  { name: "image", maxCount: 1 }
]);

// GET /api/videos-categories - Get all video categories (public)
router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    // Build filter object
    const filter = {};
    if (status) filter.status = status;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get video categories with pagination
    const categories = await VideosCategory.find(filter)
      .sort({ priority: 1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await VideosCategory.countDocuments(filter);

    res.status(200).json({
      success: true,
      message: "Video categories retrieved successfully",
      data: {
        categories,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalCategories: total,
          hasNext: skip + categories.length < total,
          hasPrev: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    console.error("Get video categories error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching video categories"
    });
  }
});

// GET /api/videos-categories/:id - Get single video category by ID (public)
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid video category ID format"
      });
    }

    const category = await VideosCategory.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Video category not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Video category retrieved successfully",
      data: category
    });

  } catch (error) {
    console.error("Get video category error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching video category"
    });
  }
});

// POST /api/videos-categories - Create new video category (admin only)
router.post("/", authenticateAdmin, uploadFields, async (req, res) => {
  try {
    const { title } = req.body;

    // Validate required fields
    if (!title) {
      return res.status(400).json({
        success: false,
        message: "Title is required"
      });
    }

    // Get image from uploaded files (optimize + CDN upload) or URL
    const imageFile = req.files && req.files.image && req.files.image[0];
    const image = imageFile
      ? await optimizeAndUploadImage(imageFile, { width: 800, quality: 75 })
      : req.body.image;

    // Create new video category
    const newCategory = new VideosCategory({
      title,
      image
    });

    const savedCategory = await newCategory.save();

    res.status(201).json({
      success: true,
      message: "Video category created successfully",
      data: savedCategory
    });

  } catch (error) {
    console.error("Create video category error:", error);
    
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
      message: "Internal server error while creating video category"
    });
  }
});

// PUT /api/videos-categories/reorder - Reorder categories by priority (admin only)
router.put("/reorder", authenticateAdmin, async (req, res) => {
  try {
    const { order } = req.body;

    if (!Array.isArray(order) || order.length === 0) {
      return res.status(400).json({
        success: false,
        message: "order must be a non-empty array of { id, priority }"
      });
    }

    const bulkOps = order.map(({ id, priority }) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: { priority } }
      }
    }));

    await VideosCategory.bulkWrite(bulkOps);

    res.status(200).json({
      success: true,
      message: "Categories reordered successfully"
    });

  } catch (error) {
    console.error("Reorder video categories error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while reordering categories"
    });
  }
});

// PUT /api/videos-categories/:id - Update video category by ID (admin only)
router.put("/:id", authenticateAdmin, uploadFields, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // Validate MongoDB ObjectId
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid video category ID format"
      });
    }

    // Handle image file upload
    const imageFile = req.files && req.files.image && req.files.image[0];
    if (imageFile) {
      // Delete old image if exists
      const existing = await VideosCategory.findById(id);
      if (existing && existing.image) {
        const oldKey = getFileKeyFromUrl(existing.image);
        if (oldKey) await deleteFile(oldKey);
      }
      updateData.image = await optimizeAndUploadImage(imageFile, { width: 800, quality: 75 });
    }

    // Find and update video category
    const updatedCategory = await VideosCategory.findByIdAndUpdate(
      id,
      updateData,
      { 
        new: true, // Return updated document
        runValidators: true // Run schema validators
      }
    );

    if (!updatedCategory) {
      return res.status(404).json({
        success: false,
        message: "Video category not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Video category updated successfully",
      data: updatedCategory
    });

  } catch (error) {
    console.error("Update video category error:", error);
    
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
      message: "Internal server error while updating video category"
    });
  }
});

// DELETE /api/videos-categories/:id - Delete video category by ID (admin only)
router.delete("/:id", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid video category ID format"
      });
    }

    const existing = await VideosCategory.findById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Video category not found"
      });
    }

    // Delete image from CDN if exists
    if (existing.image) {
      const key = getFileKeyFromUrl(existing.image);
      if (key) await deleteFile(key);
    }

    await VideosCategory.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Video category deleted successfully",
      data: {
        id: existing._id,
        title: existing.title
      }
    });

  } catch (error) {
    console.error("Delete video category error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while deleting video category"
    });
  }
});

module.exports = router;
