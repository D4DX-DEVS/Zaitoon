const express = require("express");
const router = express.Router();
const path = require("path");
const { authenticateAdmin } = require("../middleware/auth");
const SingleStory = require("../models/singleStory");
const { upload, deleteFile, getFileKeyFromUrl, s3 } = require("../utils/cdn");
const { sendContentNotification } = require("../services/notificationService");

// Configure multer to accept required fields
// coverImage: single image
// enStoryFile, mlStoryFile: single files (could be PDFs or other types)
// music: single audio file (MP3 format)
const uploadFields = upload.fields([
  { name: "coverImage", maxCount: 1 },
  { name: "enStoryFile", maxCount: 1 },
  { name: "mlStoryFile", maxCount: 1 },
  { name: "mlBanner", maxCount: 1 },
  { name: "enBanner", maxCount: 1 },
  { name: "music", maxCount: 1 }
]);

// GET /api/single-stories - list all (public)
router.get("/", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 25));
    const skip = (page - 1) * limit;

    const matchStage = {};

    const [items, total] = await Promise.all([
      SingleStory.aggregate([
        { $match: matchStage },
        // Normalize priority so that:
        // - null or <= 0 are treated as a very large number (go to the end)
        // - 1,2,3,... stay as-is and come first
        {
          $addFields: {
            effectivePriority: {
              $cond: [
                {
                  $or: [
                    { $eq: ["$priority", null] },
                    { $lte: ["$priority", 0] }
                  ]
                },
                Number.MAX_SAFE_INTEGER,
                "$priority"
              ]
            }
          }
        },
        // Sort so that:
        // - lower priority numbers (1, 2, 3, ...) come first
        // - stories without / invalid priority go to the end
        // - within the same priority, newer stories come first
        { $sort: { effectivePriority: 1, createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $project: {
            coverImage: 1,
            title: 1,
            mlTitle: 1,
            tag: 1,
            music: 1,
            priority: 1,
            highlight: 1,
            createdAt: 1
          }
        }
      ]),
      SingleStory.countDocuments(matchStage)
    ]);

    res.status(200).json({
      success: true,
      data: items,
      total,
      meta: {
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    });
  } catch (error) {
    console.error("Get single stories error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// GET /api/single-stories/:id/download-pdf - get PDF download URL (public)
// Query: lang=en | ml (default: en)
router.get("/:id/download-pdf", async (req, res) => {
  try {
    const { id } = req.params;
    const lang = (req.query.lang || "en").toLowerCase();
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const item = await SingleStory.findById(id).select("title mlTitle enStoryFile mlStoryFile");
    if (!item) return res.status(404).json({ success: false, message: "SingleStory not found" });

    const fileUrl = lang === "ml" ? item.mlStoryFile : item.enStoryFile;
    if (!fileUrl) {
      return res.status(404).json({
        success: false,
        message: lang === "ml" ? "Malayalam story file not available" : "English story file not available"
      });
    }

    const title = (lang === "ml" ? item.mlTitle : item.title) || item.title || "story";
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
      console.error("Single story download-pdf signing error:", signErr);
    }

    res.status(200).json({
      success: true,
      message: "PDF download ready",
      data: { downloadUrl, filename }
    });
  } catch (error) {
    console.error("Single story download-pdf error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// GET /api/single-stories/:id - get by id (public)
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const item = await SingleStory.findById(id);
    if (!item) return res.status(404).json({ success: false, message: "SingleStory not found" });
    res.status(200).json({ success: true, data: item });
  } catch (error) {
    console.error("Get single story error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// POST /api/single-stories - create (admin only)
router.post("/", authenticateAdmin, uploadFields, async (req, res) => {
  try {
    const { title, mlTitle, readTime, description, tag, priority, enStoryFile, mlStoryFile, coverImage } = req.body;

    // Files come from req.files
    const cover = req.files && req.files.coverImage && req.files.coverImage[0];
    const enFile = req.files && req.files.enStoryFile && req.files.enStoryFile[0];
    const mlFile = req.files && req.files.mlStoryFile && req.files.mlStoryFile[0];
    const mlBannerFile = req.files && req.files.mlBanner && req.files.mlBanner[0];
    const enBannerFile = req.files && req.files.enBanner && req.files.enBanner[0];
    const musicFile = req.files && req.files.music && req.files.music[0];

    if (!cover || !enFile || !mlFile) {
      return res.status(400).json({ success: false, message: "coverImage, enStoryFile and mlStoryFile are required" });
    }

    // Validate music file format if provided
    if (musicFile) {
      const allowedMimeTypes = ['audio/mpeg', 'audio/mp3', 'audio/mpeg3', 'audio/x-mpeg-3'];
      const allowedExtensions = ['.mp3'];
      const fileExtension = path.extname(musicFile.originalname).toLowerCase();
      
      if (!allowedMimeTypes.includes(musicFile.mimetype) && !allowedExtensions.includes(fileExtension)) {
        return res.status(400).json({ 
          success: false, 
          message: "Music file must be in MP3 format" 
        });
      }
    }

    // Normalize priority: must be >= 1, default 1
    let normalizedPriority = 1;
    if (priority !== undefined) {
      const n = parseInt(priority, 10);
      if (!Number.isNaN(n) && n >= 1) {
        normalizedPriority = n;
      }
    }

    const doc = new SingleStory({
      title,
      mlTitle,
      coverImage: cover.location,
      readTime,
      enStoryFile: enFile.location,
      mlStoryFile: mlFile.location,
      description,
      tag,
      priority: normalizedPriority,
      highlight: ["Enable", "Disable"].includes(req.body.highlight) ? req.body.highlight : "Disable",
      highlightExpiresAt: req.body.highlight === "Enable" && req.body.highlightExpiresAt ? new Date(req.body.highlightExpiresAt) : null,
      mlBanner: mlBannerFile ? mlBannerFile.location : undefined,
      enBanner: enBannerFile ? enBannerFile.location : undefined,
      music: musicFile ? musicFile.location : undefined
    });

    const saved = await doc.save();

    // Send push notification to all users
    await sendContentNotification({
      contentType: "single_story",
      contentId: saved._id,
      title: saved.title,
      message: `New story added: ${saved.title}`,
      imageUrl: saved.coverImage,
    });

    res.status(201).json({ success: true, data: saved });
  } catch (error) {
    console.error("Create single story error:", error);
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: "Validation error", errors });
    }
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// PUT /api/single-stories/:id - update (admin only)
router.put("/:id", authenticateAdmin, uploadFields, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const existing = await SingleStory.findById(id);
    if (!existing) return res.status(404).json({ success: false, message: "SingleStory not found" });

    // Normalize priority (must be >= 1, default existing or 1)
    let updatedPriority = existing.priority || 1;
    if (req.body.priority !== undefined) {
      const n = parseInt(req.body.priority, 10);
      if (!Number.isNaN(n) && n >= 1) {
        updatedPriority = n;
      }
    }

    const updateData = {
      title: req.body.title ?? existing.title,
      mlTitle: req.body.mlTitle ?? existing.mlTitle,
      readTime: req.body.readTime ?? existing.readTime,
      description: req.body.description ?? existing.description,
      tag: req.body.tag ?? existing.tag,
      priority: updatedPriority,
      highlight: ["Enable", "Disable"].includes(req.body.highlight) ? req.body.highlight : (existing.highlight ?? "Disable"),
      highlightExpiresAt: (() => {
        const h = ["Enable", "Disable"].includes(req.body.highlight) ? req.body.highlight : existing.highlight;
        if (h === "Enable" && req.body.highlightExpiresAt) return new Date(req.body.highlightExpiresAt);
        if (h === "Disable") return null;
        return existing.highlightExpiresAt ?? null;
      })()
    };

    // Handle file replacements
    const cover = req.files && req.files.coverImage && req.files.coverImage[0];
    if (cover) {
      if (existing.coverImage) {
        const oldKey = getFileKeyFromUrl(existing.coverImage);
        if (oldKey) await deleteFile(oldKey);
      }
      updateData.coverImage = cover.location;
    }

    const enFile = req.files && req.files.enStoryFile && req.files.enStoryFile[0];
    if (enFile) {
      if (existing.enStoryFile) {
        const oldKey = getFileKeyFromUrl(existing.enStoryFile);
        if (oldKey) await deleteFile(oldKey);
      }
      updateData.enStoryFile = enFile.location;
    }

    const mlFile = req.files && req.files.mlStoryFile && req.files.mlStoryFile[0];
    if (mlFile) {
      if (existing.mlStoryFile) {
        const oldKey = getFileKeyFromUrl(existing.mlStoryFile);
        if (oldKey) await deleteFile(oldKey);
      }
      updateData.mlStoryFile = mlFile.location;
    }

    const mlBannerFile = req.files && req.files.mlBanner && req.files.mlBanner[0];
    if (mlBannerFile) {
      if (existing.mlBanner) {
        const oldKey = getFileKeyFromUrl(existing.mlBanner);
        if (oldKey) await deleteFile(oldKey);
      }
      updateData.mlBanner = mlBannerFile.location;
    }

    const enBannerFile = req.files && req.files.enBanner && req.files.enBanner[0];
    if (enBannerFile) {
      if (existing.enBanner) {
        const oldKey = getFileKeyFromUrl(existing.enBanner);
        if (oldKey) await deleteFile(oldKey);
      }
      updateData.enBanner = enBannerFile.location;
    }

    const musicFile = req.files && req.files.music && req.files.music[0];
    if (musicFile) {
      // Validate music file format
      const allowedMimeTypes = ['audio/mpeg', 'audio/mp3', 'audio/mpeg3', 'audio/x-mpeg-3'];
      const allowedExtensions = ['.mp3'];
      const fileExtension = path.extname(musicFile.originalname).toLowerCase();
      
      if (!allowedMimeTypes.includes(musicFile.mimetype) && !allowedExtensions.includes(fileExtension)) {
        return res.status(400).json({ 
          success: false, 
          message: "Music file must be in MP3 format" 
        });
      }

      if (existing.music) {
        const oldKey = getFileKeyFromUrl(existing.music);
        if (oldKey) await deleteFile(oldKey);
      }
      updateData.music = musicFile.location;
    }

    const updated = await SingleStory.findByIdAndUpdate(id, { $set: updateData }, { new: true, runValidators: true });
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error("Update single story error:", error);
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: "Validation error", errors });
    }
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// DELETE /api/single-stories/:id - delete (admin only)
router.delete("/:id", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const existing = await SingleStory.findById(id);
    if (!existing) return res.status(404).json({ success: false, message: "SingleStory not found" });

    // Delete CDN files if present
    const maybeDelete = async (url) => {
      const key = getFileKeyFromUrl(url);
      if (key) await deleteFile(key);
    };
    if (existing.coverImage) await maybeDelete(existing.coverImage);
    if (existing.enStoryFile) await maybeDelete(existing.enStoryFile);
    if (existing.mlStoryFile) await maybeDelete(existing.mlStoryFile);
    if (existing.mlBanner) await maybeDelete(existing.mlBanner);
    if (existing.enBanner) await maybeDelete(existing.enBanner);
    if (existing.music) await maybeDelete(existing.music);

    await SingleStory.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: "SingleStory deleted successfully" });
  } catch (error) {
    console.error("Delete single story error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

module.exports = router;


