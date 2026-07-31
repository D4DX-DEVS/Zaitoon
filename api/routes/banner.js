const express = require("express");
const Banner = require("../models/banner");
const { authenticateAdmin } = require("../middleware/auth");
const { upload, deleteFile, getFileKeyFromUrl } = require("../utils/cdn");
const router = express.Router();

// Configure multer to accept image and PDF file upload
const uploadFields = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "pdf", maxCount: 1 }
]);

// GET /api/banners - Get all banners (public)
router.get("/", async (req, res) => {
  try {
    const { page: pageQuery, limit: limitQuery } = req.query;
    
    const page = Math.max(1, parseInt(pageQuery, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(limitQuery, 10) || 18));
    const skip = (page - 1) * limit;

    // Get banners with pagination
    const banners = await Banner.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count
    const total = await Banner.countDocuments();
    const totalPages = Math.max(1, Math.ceil(total / limit));

    res.status(200).json({
      success: true,
      message: "Banners retrieved successfully",
      data: {
        banners,
        pagination: {
          totalBanners: total,
          page,
          limit,
          totalPages
        }
      }
    });

  } catch (error) {
    console.error("Get banners error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching banners"
    });
  }
});

// GET /api/banners/:id - Get single banner by ID (public)
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid banner ID format"
      });
    }

    const banner = await Banner.findById(id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Banner retrieved successfully",
      data: banner
    });

  } catch (error) {
    console.error("Get banner error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching banner"
    });
  }
});

// POST /api/banners - Create new banner (admin only)
router.post("/", authenticateAdmin, uploadFields, async (req, res) => {
  try {
    const { title } = req.body;

    // Get image from uploaded files (CDN upload) or URL
    const imageFile = req.files && req.files.image && req.files.image[0];
    const image = imageFile ? imageFile.location : req.body.image;

    // Get PDF from uploaded files (CDN upload) or URL (optional)
    const pdfFile = req.files && req.files.pdf && req.files.pdf[0];
    const pdf = pdfFile ? pdfFile.location : req.body.pdf;

    // Validate required fields: require at least one of image or pdf
    if (!image && !pdf) {
      return res.status(400).json({
        success: false,
        message: "Either image or PDF is required (file upload or URL)"
      });
    }

    // Create new banner
    const newBanner = new Banner({
      title,
      image,
      pdf
    });

    const savedBanner = await newBanner.save();

    res.status(201).json({
      success: true,
      message: "Banner created successfully",
      data: savedBanner
    });

  } catch (error) {
    console.error("Create banner error:", error);
    
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
      message: "Internal server error while creating banner"
    });
  }
});

// PUT /api/banners/:id - Update banner by ID (admin only)
router.put("/:id", authenticateAdmin, uploadFields, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // Validate MongoDB ObjectId
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid banner ID format"
      });
    }

    // Handle image and PDF file upload
    const imageFile = req.files && req.files.image && req.files.image[0];
    const pdfFile = req.files && req.files.pdf && req.files.pdf[0];

    if (imageFile || pdfFile || req.body.image !== undefined || req.body.pdf !== undefined) {
      // Load existing banner once for file cleanup
      const existing = await Banner.findById(id);

      // Image updates
      if (imageFile) {
        if (existing && existing.image) {
          const oldImageKey = getFileKeyFromUrl(existing.image);
          if (oldImageKey) await deleteFile(oldImageKey);
        }
        updateData.image = imageFile.location;
      } else if (req.body.image !== undefined) {
        if (existing && existing.image) {
          const oldImageKey = getFileKeyFromUrl(existing.image);
          if (oldImageKey) await deleteFile(oldImageKey);
        }
        updateData.image = req.body.image;
      }

      // PDF updates (optional)
      if (pdfFile) {
        if (existing && existing.pdf) {
          const oldPdfKey = getFileKeyFromUrl(existing.pdf);
          if (oldPdfKey) await deleteFile(oldPdfKey);
        }
        updateData.pdf = pdfFile.location;
      } else if (req.body.pdf !== undefined) {
        if (existing && existing.pdf) {
          const oldPdfKey = getFileKeyFromUrl(existing.pdf);
          if (oldPdfKey) await deleteFile(oldPdfKey);
        }
        updateData.pdf = req.body.pdf;
      }
    }

    // Find and update banner
    const updatedBanner = await Banner.findByIdAndUpdate(
      id,
      updateData,
      { 
        new: true, // Return updated document
        runValidators: true // Run schema validators
      }
    );

    if (!updatedBanner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Banner updated successfully",
      data: updatedBanner
    });

  } catch (error) {
    console.error("Update banner error:", error);
    
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
      message: "Internal server error while updating banner"
    });
  }
});

// DELETE /api/banners/:id - Delete banner by ID (admin only)
router.delete("/:id", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid banner ID format"
      });
    }

    const existing = await Banner.findById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Banner not found"
      });
    }

    // Delete CDN files if present
    if (existing.image) {
      const imageKey = getFileKeyFromUrl(existing.image);
      if (imageKey) await deleteFile(imageKey);
    }
    if (existing.pdf) {
      const pdfKey = getFileKeyFromUrl(existing.pdf);
      if (pdfKey) await deleteFile(pdfKey);
    }

    await Banner.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Banner deleted successfully",
      data: {
        id: existing._id,
        title: existing.title || "Untitled Banner"
      }
    });

  } catch (error) {
    console.error("Delete banner error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while deleting banner"
    });
  }
});

module.exports = router;
