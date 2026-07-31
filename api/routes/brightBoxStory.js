const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const BrightBoxStory = require("../models/brightBoxStory");
const BrightBox = require("../models/brightBox");
const { authenticateAdmin } = require("../middleware/auth");
const { upload, deleteFile, getFileKeyFromUrl, s3 } = require("../utils/cdn");

// Multer middleware for file uploads
const uploadFields = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "enFile", maxCount: 1 },
  { name: "mlFile", maxCount: 1 },
  { name: "urFile", maxCount: 1 },
  { name: "hinFile", maxCount: 1 },
  { name: "adBanner", maxCount: 1 },
  { name: "mlBanner", maxCount: 1 },
  { name: "urBanner", maxCount: 1 },
  { name: "hinBanner", maxCount: 1 }
]);

// GET all bright box stories (Public)
// Query: page, limit (default 10), category (optional). Use all=true to get all records (e.g. for admin).
router.get("/", async (req, res) => {
  try {
    const fetchAll = req.query.all === "true" || req.query.all === "1";
    const page = parseInt(req.query.page) || 1;
    const limit = fetchAll ? 0 : Math.min(parseInt(req.query.limit) || 10, 1000);
    const skip = fetchAll ? 0 : (page - 1) * limit;
    const category = req.query.category;

    // Build query
    let query = {};
    if (category) {
      if (!mongoose.Types.ObjectId.isValid(category)) {
        return res.status(400).json({ success: false, message: "Invalid category ID format" });
      }
      query.category = category;
    }

    const findQuery = BrightBoxStory.find(query)
      .populate('category', 'title mlTitle urTitle hinTitle image')
      .sort({ order: 1, createdAt: -1 });
    if (!fetchAll) {
      findQuery.skip(skip).limit(limit);
    }

    const [brightBoxStories, total] = await Promise.all([
      findQuery.lean(),
      BrightBoxStory.countDocuments(query)
    ]);

    res.json({
      success: true,
      message: "Bright box stories retrieved successfully",
      data: {
        brightBoxStories,
        pagination: {
          currentPage: fetchAll ? 1 : page,
          totalPages: limit === 0 ? 1 : Math.ceil(total / limit),
          totalBrightBoxStories: total,
          hasNext: !fetchAll && page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error("Get bright box stories error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// GET /api/bright-box-stories/:id/download-pdf - get PDF download URL (public)
// Query: lang=en | ml | ur | hin (default: en). Must be before /:id so it matches first.
router.get("/:id/download-pdf", async (req, res) => {
  try {
    const { id } = req.params;
    const lang = (req.query.lang || "en").toLowerCase();
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid bright box story ID format" });
    }

    const brightBoxStory = await BrightBoxStory.findById(id).select("title mlTitle urTitle hinTitle enFile mlFile urFile hinFile");
    if (!brightBoxStory) {
      return res.status(404).json({ success: false, message: "Bright box story not found" });
    }

    const langMap = { en: "enFile", ml: "mlFile", ur: "urFile", hin: "hinFile" };
    const field = langMap[lang] || langMap.en;
    const fileUrl = brightBoxStory[field];
    if (!fileUrl) {
      return res.status(404).json({
        success: false,
        message: `Story file not available for language: ${lang}`
      });
    }

    const title = brightBoxStory.title || brightBoxStory.mlTitle || "brightbox-story";
    const safeTitle = String(title).replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 80);
    const filename = `${safeTitle}.pdf`;

    // Try to generate a signed URL with a clean PDF filename for download.
    let downloadUrl = fileUrl;
    try {
      const key = getFileKeyFromUrl(fileUrl);
      const bucket = process.env.DO_SPACES_BUCKET;
      if (key && bucket && s3) {
        const signedUrl = s3.getSignedUrl("getObject", {
          Bucket: bucket,
          Key: key,
          Expires: 300,
          ResponseContentDisposition: `attachment; filename="${filename}"`
        });
        if (signedUrl) {
          downloadUrl = signedUrl;
        }
      }
    } catch (signErr) {
      console.error("Bright box story download-pdf signing error:", signErr);
    }

    res.status(200).json({
      success: true,
      message: "PDF download ready",
      data: { downloadUrl, filename }
    });
  } catch (error) {
    console.error("Bright box story download-pdf error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// GET single bright box story (Public)
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid bright box story ID format" });
    }

    const brightBoxStory = await BrightBoxStory.findById(id)
      .populate('category', 'title mlTitle urTitle hinTitle image');

    if (!brightBoxStory) {
      return res.status(404).json({ success: false, message: "Bright box story not found" });
    }

    res.json({
      success: true,
      message: "Bright box story retrieved successfully",
      data: brightBoxStory
    });
  } catch (error) {
    console.error("Get bright box story error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// GET bright box stories by category (Public)
router.get("/category/:categoryId", async (req, res) => {
  try {
    const { categoryId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({ success: false, message: "Invalid category ID format" });
    }

    const category = await BrightBox.findById(categoryId);
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    const brightBoxStories = await BrightBoxStory.find({ category: categoryId })
      .populate('category', 'title mlTitle urTitle hinTitle image')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await BrightBoxStory.countDocuments({ category: categoryId });

    res.json({
      success: true,
      message: "Bright box stories retrieved successfully",
      data: {
        category: {
          _id: category._id,
          title: category.title,
          mlTitle: category.mlTitle,
          urTitle: category.urTitle,
          hinTitle: category.hinTitle,
          image: category.image
        },
        brightBoxStories,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalBrightBoxStories: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error("Get bright box stories by category error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// POST create bright box story (Admin only)
router.post("/", authenticateAdmin, uploadFields, async (req, res) => {
  try {
    const { title, mlTitle, urTitle, hinTitle, category, highlight, highlightExpiresAt } = req.body;

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

    const categoryExists = await BrightBox.findById(category);
    if (!categoryExists) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    // Assign next order within this category
    const lastInCategory = await BrightBoxStory.findOne({ category }).sort({ order: -1 }).select('order').lean();
    const nextOrder = lastInCategory && typeof lastInCategory.order === 'number' ? lastInCategory.order + 1 : 1;

    // Handle file uploads
    const imageFile = req.files && req.files.image && req.files.image[0];
    const enFile = req.files && req.files.enFile && req.files.enFile[0];
    const mlFile = req.files && req.files.mlFile && req.files.mlFile[0];
    const urFile = req.files && req.files.urFile && req.files.urFile[0];
    const hinFile = req.files && req.files.hinFile && req.files.hinFile[0];
    const adBannerFile = req.files && req.files.adBanner && req.files.adBanner[0];
    const mlBannerFile = req.files && req.files.mlBanner && req.files.mlBanner[0];
    const urBannerFile = req.files && req.files.urBanner && req.files.urBanner[0];
    const hinBannerFile = req.files && req.files.hinBanner && req.files.hinBanner[0];

    // Validate required enFile
    if (!enFile) {
      return res.status(400).json({ 
        success: false, 
        message: "Validation error", 
        errors: ["English file is required"] 
      });
    }

    const brightBoxStory = new BrightBoxStory({
      title,
      mlTitle,
      urTitle,
      hinTitle,
      category,
      highlight: highlight || "Disable",
      highlightExpiresAt: (highlight === "Enable" && highlightExpiresAt) ? new Date(highlightExpiresAt) : null,
      order: nextOrder,
      image: imageFile ? imageFile.location : undefined,
      enFile: enFile.location,
      mlFile: mlFile ? mlFile.location : undefined,
      urFile: urFile ? urFile.location : undefined,
      hinFile: hinFile ? hinFile.location : undefined,
      adBanner: adBannerFile ? adBannerFile.location : undefined,
      mlBanner: mlBannerFile ? mlBannerFile.location : undefined,
      urBanner: urBannerFile ? urBannerFile.location : undefined,
      hinBanner: hinBannerFile ? hinBannerFile.location : undefined
    });

    const savedBrightBoxStory = await brightBoxStory.save();
    await savedBrightBoxStory.populate('category', 'title mlTitle urTitle hinTitle image');

    res.status(201).json({
      success: true,
      message: "Bright box story created successfully",
      data: savedBrightBoxStory
    });
  } catch (error) {
    console.error("Create bright box story error:", error);
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: "Validation error", errors });
    }
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// PUT /api/bright-box-stories/reorder - Reorder stories within a category (Admin only)
// IMPORTANT: Must be before PUT /:id to avoid "reorder" matching as an ID.
router.put("/reorder", authenticateAdmin, async (req, res) => {
  try {
    const { storyIds } = req.body; // array of IDs in desired order

    if (!Array.isArray(storyIds) || storyIds.length === 0) {
      return res.status(400).json({ success: false, message: "storyIds array is required and cannot be empty" });
    }

    const invalidId = storyIds.find((id) => !mongoose.Types.ObjectId.isValid(id));
    if (invalidId) {
      return res.status(400).json({ success: false, message: `Invalid story ID: ${invalidId}` });
    }

    const bulkOps = storyIds.map((id, index) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: { order: index + 1 } }
      }
    }));

    await BrightBoxStory.bulkWrite(bulkOps);

    res.json({ success: true, message: "Bright box stories reordered successfully" });
  } catch (error) {
    console.error("Reorder bright box stories error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});


// PUT update bright box story (Admin only)
router.put("/:id", authenticateAdmin, uploadFields, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, mlTitle, urTitle, hinTitle, category, highlight, highlightExpiresAt } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid bright box story ID format" });
    }

    const brightBoxStory = await BrightBoxStory.findById(id);
    if (!brightBoxStory) {
      return res.status(404).json({ success: false, message: "Bright box story not found" });
    }

    if (category !== undefined) {
      if (!mongoose.Types.ObjectId.isValid(category)) {
        return res.status(400).json({ success: false, message: "Invalid category ID format" });
      }
      const categoryExists = await BrightBox.findById(category);
      if (!categoryExists) {
        return res.status(404).json({ success: false, message: "Category not found" });
      }
    }

    // Handle file uploads/replacements
    const imageFile = req.files && req.files.image && req.files.image[0];
    const enFile = req.files && req.files.enFile && req.files.enFile[0];
    const mlFile = req.files && req.files.mlFile && req.files.mlFile[0];
    const urFile = req.files && req.files.urFile && req.files.urFile[0];
    const hinFile = req.files && req.files.hinFile && req.files.hinFile[0];
    const adBannerFile = req.files && req.files.adBanner && req.files.adBanner[0];
    const mlBannerFile = req.files && req.files.mlBanner && req.files.mlBanner[0];
    const urBannerFile = req.files && req.files.urBanner && req.files.urBanner[0];
    const hinBannerFile = req.files && req.files.hinBanner && req.files.hinBanner[0];

    // Helper function to delete old file from CDN
    const deleteOldFile = async (oldUrl) => {
      if (oldUrl) {
        try {
          const oldFileKey = getFileKeyFromUrl(oldUrl);
          if (oldFileKey) {
            await deleteFile(oldFileKey);
          }
        } catch (deleteError) {
          console.error("Error deleting old file:", deleteError);
        }
      }
    };

    // Update fields
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (mlTitle !== undefined) updateData.mlTitle = mlTitle;
    if (urTitle !== undefined) updateData.urTitle = urTitle;
    if (hinTitle !== undefined) updateData.hinTitle = hinTitle;
    if (category !== undefined) updateData.category = category;
    if (highlight !== undefined) {
      updateData.highlight = highlight;
      if (highlight === "Enable" && highlightExpiresAt) {
        updateData.highlightExpiresAt = new Date(highlightExpiresAt);
      } else if (highlight === "Disable") {
        updateData.highlightExpiresAt = null;
      }
    } else if (highlightExpiresAt !== undefined) {
      updateData.highlightExpiresAt = highlightExpiresAt ? new Date(highlightExpiresAt) : null;
    }

    // Handle image file
    if (imageFile) {
      await deleteOldFile(brightBoxStory.image);
      updateData.image = imageFile.location;
    }

    // Handle enFile
    if (enFile) {
      await deleteOldFile(brightBoxStory.enFile);
      updateData.enFile = enFile.location;
    }

    // Handle mlFile
    if (mlFile) {
      await deleteOldFile(brightBoxStory.mlFile);
      updateData.mlFile = mlFile.location;
    }

    // Handle urFile
    if (urFile) {
      await deleteOldFile(brightBoxStory.urFile);
      updateData.urFile = urFile.location;
    }

    // Handle hinFile
    if (hinFile) {
      await deleteOldFile(brightBoxStory.hinFile);
      updateData.hinFile = hinFile.location;
    }

    // Handle adBanner
    if (adBannerFile) {
      await deleteOldFile(brightBoxStory.adBanner);
      updateData.adBanner = adBannerFile.location;
    }

    // Handle mlBanner
    if (mlBannerFile) {
      await deleteOldFile(brightBoxStory.mlBanner);
      updateData.mlBanner = mlBannerFile.location;
    }

    // Handle urBanner
    if (urBannerFile) {
      await deleteOldFile(brightBoxStory.urBanner);
      updateData.urBanner = urBannerFile.location;
    }

    // Handle hinBanner
    if (hinBannerFile) {
      await deleteOldFile(brightBoxStory.hinBanner);
      updateData.hinBanner = hinBannerFile.location;
    }

    const updatedBrightBoxStory = await BrightBoxStory.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('category', 'title mlTitle urTitle hinTitle image');

    res.json({
      success: true,
      message: "Bright box story updated successfully",
      data: updatedBrightBoxStory
    });
  } catch (error) {
    console.error("Update bright box story error:", error);
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: "Validation error", errors });
    }
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// DELETE bright box story (Admin only)
router.delete("/:id", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid bright box story ID format" });
    }

    const brightBoxStory = await BrightBoxStory.findById(id);
    if (!brightBoxStory) {
      return res.status(404).json({ success: false, message: "Bright box story not found" });
    }

    // Delete all files from CDN
    const filesToDelete = [
      brightBoxStory.image,
      brightBoxStory.enFile,
      brightBoxStory.mlFile,
      brightBoxStory.urFile,
      brightBoxStory.hinFile,
      brightBoxStory.adBanner,
      brightBoxStory.mlBanner,
      brightBoxStory.urBanner,
      brightBoxStory.hinBanner
    ];

    for (const fileUrl of filesToDelete) {
      if (fileUrl) {
        try {
          const fileKey = getFileKeyFromUrl(fileUrl);
          if (fileKey) {
            await deleteFile(fileKey);
          }
        } catch (deleteError) {
          console.error("Error deleting file from CDN:", deleteError);
        }
      }
    }

    await BrightBoxStory.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Bright box story deleted successfully",
      data: {
        id: brightBoxStory._id,
        title: brightBoxStory.title
      }
    });
  } catch (error) {
    console.error("Delete bright box story error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

module.exports = router;
