const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const BrightBox = require("../models/brightBox");
const BrightBoxStory = require("../models/brightBoxStory");
const { authenticateAdmin } = require("../middleware/auth");
const { upload, deleteFile, getFileKeyFromUrl } = require("../utils/cdn");
const { sendContentNotification } = require("../services/notificationService");

// Multer middleware for file uploads
const uploadFields = upload.fields([
  { name: "image", maxCount: 1 }
]);

// GET all bright boxes (Public)
// Query: page, limit (default 10). Use all=true to get all records (e.g. for admin).
router.get("/", async (req, res) => {
  try {
    const fetchAll = req.query.all === "true" || req.query.all === "1";
    const page = parseInt(req.query.page) || 1;
    const limit = fetchAll ? 0 : Math.min(parseInt(req.query.limit) || 10, 1000);
    const skip = fetchAll ? 0 : (page - 1) * limit;

    const query = BrightBox.find().sort({ order: 1, createdAt: -1 });
    if (!fetchAll) {
      query.skip(skip).limit(limit);
    }

    const [brightBoxes, total] = await Promise.all([
      query.lean(),
      BrightBox.countDocuments()
    ]);

    // Attach story counts
    const ids = brightBoxes.map(b => b._id);
    const counts = await BrightBoxStory.aggregate([
      { $match: { category: { $in: ids } } },
      { $group: { _id: "$category", count: { $sum: 1 } } }
    ]);
    const countMap = {};
    counts.forEach(c => { countMap[c._id.toString()] = c.count; });
    const brightBoxesWithCount = brightBoxes.map(b => ({
      ...b,
      storyCount: countMap[b._id.toString()] || 0
    }));

    res.json({
      success: true,
      message: "Bright boxes retrieved successfully",
      data: {
        brightBoxes: brightBoxesWithCount,
        pagination: {
          currentPage: fetchAll ? 1 : page,
          totalPages: limit === 0 ? 1 : Math.ceil(total / limit),
          totalBrightBoxes: total,
          hasNext: !fetchAll && page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error("Get bright boxes error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// GET single bright box (Public)
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid bright box ID format" });
    }

    const brightBox = await BrightBox.findById(id);

    if (!brightBox) {
      return res.status(404).json({ success: false, message: "Bright box not found" });
    }

    res.json({
      success: true,
      message: "Bright box retrieved successfully",
      data: brightBox
    });
  } catch (error) {
    console.error("Get bright box error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// POST create bright box (Admin only)
router.post("/", authenticateAdmin, uploadFields, async (req, res) => {
  try {
    const { title, mlTitle, urTitle, hinTitle } = req.body;

    // Validate required fields
    if (!title) {
      return res.status(400).json({ 
        success: false, 
        message: "Validation error", 
        errors: ["Title is required"] 
      });
    }

    // Handle image upload
    const imageFile = req.files && req.files.image && req.files.image[0];
    const imageUrl = imageFile ? imageFile.location : undefined;

    // Assign next order value so new items appear at the end
    const lastBox = await BrightBox.findOne().sort({ order: -1 }).select('order').lean();
    const nextOrder = lastBox && typeof lastBox.order === 'number' ? lastBox.order + 1 : 1;

    const brightBox = new BrightBox({
      title,
      mlTitle,
      urTitle,
      hinTitle,
      image: imageUrl,
      order: nextOrder
    });

    const savedBrightBox = await brightBox.save();

    // Send push notification to all users
    await sendContentNotification({
      contentType: "brightbox",
      contentId: savedBrightBox._id,
      title: savedBrightBox.title,
      message: `New Bright Box added: ${savedBrightBox.title}`,
      imageUrl: savedBrightBox.image,
    });

    res.status(201).json({
      success: true,
      message: "Bright box created successfully",
      data: savedBrightBox
    });
  } catch (error) {
    console.error("Create bright box error:", error);
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: "Validation error", errors });
    }
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// PUT /bright-boxes/reorder - Reorder bright boxes via drag-and-drop (Admin only)
// IMPORTANT: This must be defined BEFORE PUT /:id to prevent "reorder" being treated as an ID.
router.put("/reorder", authenticateAdmin, async (req, res) => {
  try {
    const { brightBoxIds } = req.body; // array of IDs in the desired display order

    if (!Array.isArray(brightBoxIds) || brightBoxIds.length === 0) {
      return res.status(400).json({ success: false, message: "brightBoxIds array is required and cannot be empty" });
    }

    // Validate all IDs
    const invalidId = brightBoxIds.find((id) => !mongoose.Types.ObjectId.isValid(id));
    if (invalidId) {
      return res.status(400).json({ success: false, message: `Invalid bright box ID: ${invalidId}` });
    }

    // Bulk write: assign sequential order values (1-based)
    const bulkOps = brightBoxIds.map((id, index) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: { order: index + 1 } }
      }
    }));

    await BrightBox.bulkWrite(bulkOps);

    res.json({ success: true, message: "Bright boxes reordered successfully" });
  } catch (error) {
    console.error("Reorder bright boxes error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// PUT update bright box (Admin only)
router.put("/:id", authenticateAdmin, uploadFields, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, mlTitle, urTitle, hinTitle } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid bright box ID format" });
    }

    const brightBox = await BrightBox.findById(id);
    if (!brightBox) {
      return res.status(404).json({ success: false, message: "Bright box not found" });
    }

    // Handle image upload/replacement
    const imageFile = req.files && req.files.image && req.files.image[0];
    let imageUrl = brightBox.image; // Keep existing image by default

    if (imageFile) {
      // Delete old image from CDN if it exists
      if (brightBox.image) {
        try {
          const oldImageKey = getFileKeyFromUrl(brightBox.image);
          if (oldImageKey) {
            await deleteFile(oldImageKey);
          }
        } catch (deleteError) {
          console.error("Error deleting old image:", deleteError);
        }
      }
      // Set new image URL
      imageUrl = imageFile.location;
    }

    // Update fields
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (mlTitle !== undefined) updateData.mlTitle = mlTitle;
    if (urTitle !== undefined) updateData.urTitle = urTitle;
    if (hinTitle !== undefined) updateData.hinTitle = hinTitle;
    if (imageUrl !== undefined) updateData.image = imageUrl;

    const updatedBrightBox = await BrightBox.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: "Bright box updated successfully",
      data: updatedBrightBox
    });
  } catch (error) {
    console.error("Update bright box error:", error);
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: "Validation error", errors });
    }
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// DELETE bright box (Admin only)
router.delete("/:id", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid bright box ID format" });
    }

    const brightBox = await BrightBox.findById(id);
    if (!brightBox) {
      return res.status(404).json({ success: false, message: "Bright box not found" });
    }

    // Delete image from CDN if it exists
    if (brightBox.image) {
      try {
        const imageKey = getFileKeyFromUrl(brightBox.image);
        if (imageKey) {
          await deleteFile(imageKey);
        }
      } catch (deleteError) {
        console.error("Error deleting image from CDN:", deleteError);
      }
    }

    await BrightBox.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Bright box deleted successfully",
      data: {
        id: brightBox._id,
        title: brightBox.title
      }
    });
  } catch (error) {
    console.error("Delete bright box error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

module.exports = router;
