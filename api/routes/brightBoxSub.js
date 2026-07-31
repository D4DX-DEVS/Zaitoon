const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const BrightBoxSub = require("../models/brightBoxSub");
const BrightBox = require("../models/brightBox");
const { authenticateAdmin } = require("../middleware/auth");
const { upload, deleteFile, getFileKeyFromUrl } = require("../utils/cdn");

// Multer middleware for file uploads
const uploadFields = upload.fields([
  { name: "image", maxCount: 1 }
]);

// GET all bright box subs (Public)
router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const category = req.query.category;

    // Build query
    let query = {};
    if (category) {
      if (!mongoose.Types.ObjectId.isValid(category)) {
        return res.status(400).json({ success: false, message: "Invalid category ID format" });
      }
      query.category = category;
    }

    const brightBoxSubs = await BrightBoxSub.find(query)
      .populate('category', 'title mlTitle urTitle hinTitle image')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await BrightBoxSub.countDocuments(query);

    res.json({
      success: true,
      message: "Bright box subs retrieved successfully",
      data: {
        brightBoxSubs,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalBrightBoxSubs: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error("Get bright box subs error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// GET single bright box sub (Public)
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid bright box sub ID format" });
    }

    const brightBoxSub = await BrightBoxSub.findById(id)
      .populate('category', 'title mlTitle urTitle hinTitle image');

    if (!brightBoxSub) {
      return res.status(404).json({ success: false, message: "Bright box sub not found" });
    }

    res.json({
      success: true,
      message: "Bright box sub retrieved successfully",
      data: brightBoxSub
    });
  } catch (error) {
    console.error("Get bright box sub error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// GET bright box subs by category (Public)
router.get("/category/:categoryId", async (req, res) => {
  try {
    const { categoryId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({ success: false, message: "Invalid category ID format" });
    }

    // Check if category exists
    const category = await BrightBox.findById(categoryId);
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    const brightBoxSubs = await BrightBoxSub.find({ category: categoryId })
      .populate('category', 'title mlTitle urTitle hinTitle image')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await BrightBoxSub.countDocuments({ category: categoryId });

    res.json({
      success: true,
      message: "Bright box subs retrieved successfully",
      data: {
        category: {
          _id: category._id,
          title: category.title,
          mlTitle: category.mlTitle,
          urTitle: category.urTitle,
          hinTitle: category.hinTitle,
          image: category.image
        },
        brightBoxSubs,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalBrightBoxSubs: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error("Get bright box subs by category error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// POST create bright box sub (Admin only)
router.post("/", authenticateAdmin, uploadFields, async (req, res) => {
  try {
    const { title, mlTitle, urTitle, hnTitle, category } = req.body;

    // Validate required fields
    if (!title) {
      return res.status(400).json({ 
        success: false, 
        message: "Validation error", 
        errors: ["Title is required"] 
      });
    }

    if (!category) {
      return res.status(400).json({ 
        success: false, 
        message: "Validation error", 
        errors: ["Category is required"] 
      });
    }

    if (!mongoose.Types.ObjectId.isValid(category)) {
      return res.status(400).json({ 
        success: false, 
        message: "Validation error", 
        errors: ["Invalid category ID format"] 
      });
    }

    // Check if category exists
    const categoryExists = await BrightBox.findById(category);
    if (!categoryExists) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    // Handle image upload
    const imageFile = req.files && req.files.image && req.files.image[0];
    const imageUrl = imageFile ? imageFile.location : undefined;

    const brightBoxSub = new BrightBoxSub({
      title,
      mlTitle,
      urTitle,
      hnTitle,
      category,
      image: imageUrl
    });

    const savedBrightBoxSub = await brightBoxSub.save();
    await savedBrightBoxSub.populate('category', 'title mlTitle urTitle hinTitle image');

    res.status(201).json({
      success: true,
      message: "Bright box sub created successfully",
      data: savedBrightBoxSub
    });
  } catch (error) {
    console.error("Create bright box sub error:", error);
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: "Validation error", errors });
    }
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// PUT update bright box sub (Admin only)
router.put("/:id", authenticateAdmin, uploadFields, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, mlTitle, urTitle, hnTitle, category } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid bright box sub ID format" });
    }

    const brightBoxSub = await BrightBoxSub.findById(id);
    if (!brightBoxSub) {
      return res.status(404).json({ success: false, message: "Bright box sub not found" });
    }

    // Validate category if provided
    if (category) {
      if (!mongoose.Types.ObjectId.isValid(category)) {
        return res.status(400).json({ success: false, message: "Invalid category ID format" });
      }
      
      const categoryExists = await BrightBox.findById(category);
      if (!categoryExists) {
        return res.status(404).json({ success: false, message: "Category not found" });
      }
    }

    // Handle image upload/replacement
    const imageFile = req.files && req.files.image && req.files.image[0];
    let imageUrl = brightBoxSub.image; // Keep existing image by default

    if (imageFile) {
      // Delete old image from CDN if it exists
      if (brightBoxSub.image) {
        try {
          const oldImageKey = getFileKeyFromUrl(brightBoxSub.image);
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
    if (hnTitle !== undefined) updateData.hnTitle = hnTitle;
    if (category !== undefined) updateData.category = category;
    if (imageUrl !== undefined) updateData.image = imageUrl;

    const updatedBrightBoxSub = await BrightBoxSub.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('category', 'title mlTitle urTitle hinTitle image');

    res.json({
      success: true,
      message: "Bright box sub updated successfully",
      data: updatedBrightBoxSub
    });
  } catch (error) {
    console.error("Update bright box sub error:", error);
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: "Validation error", errors });
    }
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// DELETE bright box sub (Admin only)
router.delete("/:id", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid bright box sub ID format" });
    }

    const brightBoxSub = await BrightBoxSub.findById(id);
    if (!brightBoxSub) {
      return res.status(404).json({ success: false, message: "Bright box sub not found" });
    }

    // Delete image from CDN if it exists
    if (brightBoxSub.image) {
      try {
        const imageKey = getFileKeyFromUrl(brightBoxSub.image);
        if (imageKey) {
          await deleteFile(imageKey);
        }
      } catch (deleteError) {
        console.error("Error deleting image from CDN:", deleteError);
      }
    }

    await BrightBoxSub.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Bright box sub deleted successfully",
      data: {
        id: brightBoxSub._id,
        title: brightBoxSub.title
      }
    });
  } catch (error) {
    console.error("Delete bright box sub error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

module.exports = router;
