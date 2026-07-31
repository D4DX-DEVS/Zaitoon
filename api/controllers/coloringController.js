const ColoringImage = require("../models/coloringImage");
const { deleteFile, getFileKeyFromUrl } = require("../utils/cdn");
const { sendContentNotification } = require("../services/notificationService");

/**
 * GET /api/coloring
 * List all coloring images. Optional filter: ?category=mosque&active=true
 */
async function getColoringImages(req, res) {
  try {
    const filter = {};
    // By default show only active, but admin can pass active=all
    if (req.query.active === "all") {
      // no filter
    } else {
      filter.isActive = true;
    }
    if (req.query.category) {
      filter.category = req.query.category;
    }

    const images = await ColoringImage.find(filter)
      .sort({ sortOrder: 1, createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      data: { images, total: images.length },
    });
  } catch (error) {
    console.error("[Coloring] getColoringImages error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to fetch coloring images." });
  }
}

/**
 * GET /api/coloring/:id
 * Get a single coloring image by ID.
 */
async function getColoringImageById(req, res) {
  try {
    const image = await ColoringImage.findById(req.params.id).lean();
    if (!image) {
      return res.status(404).json({ success: false, message: "Image not found." });
    }
    return res.json({ success: true, data: image });
  } catch (error) {
    console.error("[Coloring] getColoringImageById error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to fetch coloring image." });
  }
}

/**
 * POST /api/coloring (Admin)
 * Create a new coloring image. Accepts file upload or URL.
 */
async function createColoringImage(req, res) {
  try {
    const { title, titleMl, category, difficulty, sortOrder, tags } = req.body;

    // Get imageUrl from uploaded file or from body
    const imageFile = req.files && req.files.image && req.files.image[0];
    const imageUrl = imageFile ? imageFile.location : req.body.imageUrl;

    const thumbFile = req.files && req.files.thumbnail && req.files.thumbnail[0];
    const thumbnailUrl = thumbFile ? thumbFile.location : (req.body.thumbnailUrl || "");

    if (!title || !category || !imageUrl) {
      return res.status(400).json({
        success: false,
        message: "title, category, and image (file or imageUrl) are required.",
      });
    }

    // Parse tags if it comes as a string
    let parsedTags = tags || [];
    if (typeof parsedTags === "string") {
      try { parsedTags = JSON.parse(parsedTags); } catch (_) {
        parsedTags = parsedTags.split(",").map(t => t.trim()).filter(Boolean);
      }
    }

    const image = await ColoringImage.create({
      title,
      titleMl: titleMl || "",
      category,
      imageUrl,
      thumbnailUrl,
      difficulty: difficulty || "easy",
      sortOrder: parseInt(sortOrder) || 0,
      tags: parsedTags,
    });

    // Send push notification to all users
    await sendContentNotification({
      contentType: "coloring",
      contentId: image._id,
      title: image.title,
      message: `New coloring image added: ${image.title}`,
      imageUrl: image.thumbnailUrl || image.imageUrl,
    });

    return res.status(201).json({
      success: true,
      message: "Coloring image created.",
      data: image,
    });
  } catch (error) {
    console.error("[Coloring] createColoringImage error:", error.message);
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error.",
        errors: Object.values(error.errors).map((e) => e.message),
      });
    }
    return res.status(500).json({ success: false, message: "Failed to create coloring image." });
  }
}

/**
 * PUT /api/coloring/:id (Admin)
 * Update a coloring image. Accepts file upload or URL.
 */
async function updateColoringImage(req, res) {
  try {
    const existing = await ColoringImage.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Image not found." });
    }

    const updates = {};
    const { title, titleMl, category, difficulty, sortOrder, tags, isActive } = req.body;

    if (title !== undefined) updates.title = title;
    if (titleMl !== undefined) updates.titleMl = titleMl;
    if (category !== undefined) updates.category = category;
    if (difficulty !== undefined) updates.difficulty = difficulty;
    if (sortOrder !== undefined) updates.sortOrder = parseInt(sortOrder) || 0;
    if (isActive !== undefined) updates.isActive = isActive === "true" || isActive === true;

    if (tags !== undefined) {
      let parsedTags = tags;
      if (typeof parsedTags === "string") {
        try { parsedTags = JSON.parse(parsedTags); } catch (_) {
          parsedTags = parsedTags.split(",").map(t => t.trim()).filter(Boolean);
        }
      }
      updates.tags = parsedTags;
    }

    // Handle image file upload or URL
    const imageFile = req.files && req.files.image && req.files.image[0];
    if (imageFile) {
      // Delete old image from CDN if it exists
      if (existing.imageUrl) {
        try { await deleteFile(getFileKeyFromUrl(existing.imageUrl)); } catch (_) {}
      }
      updates.imageUrl = imageFile.location;
    } else if (req.body.imageUrl) {
      updates.imageUrl = req.body.imageUrl;
    }

    // Handle thumbnail file upload or URL
    const thumbFile = req.files && req.files.thumbnail && req.files.thumbnail[0];
    if (thumbFile) {
      if (existing.thumbnailUrl) {
        try { await deleteFile(getFileKeyFromUrl(existing.thumbnailUrl)); } catch (_) {}
      }
      updates.thumbnailUrl = thumbFile.location;
    } else if (req.body.thumbnailUrl !== undefined) {
      updates.thumbnailUrl = req.body.thumbnailUrl;
    }

    const image = await ColoringImage.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    return res.json({
      success: true,
      message: "Coloring image updated.",
      data: image,
    });
  } catch (error) {
    console.error("[Coloring] updateColoringImage error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to update coloring image." });
  }
}

/**
 * DELETE /api/coloring/:id (Admin)
 * Delete a coloring image and clean up CDN files.
 */
async function deleteColoringImage(req, res) {
  try {
    const image = await ColoringImage.findByIdAndDelete(req.params.id);
    if (!image) {
      return res.status(404).json({ success: false, message: "Image not found." });
    }

    // Clean up CDN files
    if (image.imageUrl) {
      try { await deleteFile(getFileKeyFromUrl(image.imageUrl)); } catch (_) {}
    }
    if (image.thumbnailUrl) {
      try { await deleteFile(getFileKeyFromUrl(image.thumbnailUrl)); } catch (_) {}
    }

    return res.json({ success: true, message: "Coloring image deleted." });
  } catch (error) {
    console.error("[Coloring] deleteColoringImage error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to delete coloring image." });
  }
}

module.exports = {
  getColoringImages,
  getColoringImageById,
  createColoringImage,
  updateColoringImage,
  deleteColoringImage,
};
