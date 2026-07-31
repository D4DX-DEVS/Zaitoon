const express = require("express");
const router = express.Router();
const KidsSubmission = require("../models/kidsSubmission");
const { upload, deleteFile, getFileKeyFromUrl } = require("../utils/cdn");
const { authenticateAdmin } = require("../middleware/auth");
const { sendApprovalMessage, sendRemarksMessage } = require("../services/dxingService");

const ALLOWED_CONTENT_TYPES = ["story", "poem", "drawing", "letter", "other"];

function normalizeContentType(value) {
  if (typeof value !== "string") return value;
  const normalized = value.trim().toLowerCase();
  if (normalized === "others") return "other";
  return normalized;
}

// Accept files for coverImage, drawing, kidPhoto (all optional on create, can be added later)
const uploadFields = upload.fields([
  { name: "coverImage", maxCount: 1 },
  { name: "drawing", maxCount: 1 },
  { name: "kidPhoto", maxCount: 1 }
]);

// GET /api/kids-submissions - list all with optional userId/status/highlight filter and pagination
router.get("/", async (req, res) => {
  try {
    const { userId, status, highlight } = req.query;

    let query = {};
    if (userId) {
      query.userId = userId;
      // For users, only show "Approved" submissions
      query.status = "Approved";
    } else {
      if (status) query.status = status;
      if (highlight) query.highlight = highlight;
    }

    // Pagination (ignored when userId is provided — return all for that user)
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      KidsSubmission.find(query)
        .sort({ createdAt: -1 })
        .skip(userId ? 0 : skip)
        .limit(userId ? 0 : limit),
      KidsSubmission.countDocuments(query)
    ]);

    const totalPages = userId ? 1 : Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      data: items,
      pagination: {
        total,
        page: userId ? 1 : page,
        limit: userId ? total : limit,
        totalPages
      }
    });
  } catch (error) {
    console.error("Get kids submissions error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// GET /api/kids-submissions/:id - get by id (public)
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const item = await KidsSubmission.findById(id);
    if (!item) return res.status(404).json({ success: false, message: "KidsSubmission not found" });
    res.status(200).json({ success: true, data: item });
  } catch (error) {
    console.error("Get kids submission error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// POST /api/kids-submissions - create (uses userId from body, no token needed)
router.post("/", uploadFields, async (req, res) => {
  try {
    const { userId, contentType, title, storyOrPoem, letter, drawingDescription, kidName, kidAge, schoolName, parentName, phoneNo, moreTitle, moreDescription, status, highlight, highlightExpiresAt } = req.body;
    const normalizedContentType = normalizeContentType(contentType);

    // Validate userId is provided
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required"
      });
    }

    if (normalizedContentType && !ALLOWED_CONTENT_TYPES.includes(normalizedContentType)) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: [`contentType must be one of: ${ALLOWED_CONTENT_TYPES.join(", ")}`]
      });
    }

    const cover = req.files && req.files.coverImage && req.files.coverImage[0];
    const drawing = req.files && req.files.drawing && req.files.drawing[0];
    const kidPhoto = req.files && req.files.kidPhoto && req.files.kidPhoto[0];

    const doc = new KidsSubmission({
      userId,
      contentType: normalizedContentType,
      title,
      coverImage: cover ? cover.location : undefined,
      storyOrPoem,
      letter,
      drawing: drawing ? drawing.location : undefined,
      drawingDescription,
      kidPhoto: kidPhoto ? kidPhoto.location : undefined,
      kidName,
      kidAge,
      schoolName,
      parentName,
      phoneNo,
      moreTitle,
      moreDescription,
      status,
      highlight,
      highlightExpiresAt: (highlight === "Enable" && highlightExpiresAt) ? new Date(highlightExpiresAt) : null
    });

    const saved = await doc.save();
    res.status(201).json({ success: true, data: saved });
  } catch (error) {
    console.error("Create kids submission error:", error);
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: "Validation error", errors });
    }
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// PUT /api/kids-submissions/:id - update (admin only for approval/rejection)
router.put("/:id", authenticateAdmin, uploadFields, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const existing = await KidsSubmission.findById(id);
    if (!existing) return res.status(404).json({ success: false, message: "KidsSubmission not found" });

    const normalizedContentType = normalizeContentType(req.body.contentType);
    if (normalizedContentType && !ALLOWED_CONTENT_TYPES.includes(normalizedContentType)) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: [`contentType must be one of: ${ALLOWED_CONTENT_TYPES.join(", ")}`]
      });
    }

    const previousStatus = existing.status;

    const updateData = {
      contentType: normalizedContentType ?? existing.contentType,
      title: req.body.title ?? existing.title,
      storyOrPoem: req.body.storyOrPoem ?? existing.storyOrPoem,
      letter: req.body.letter ?? existing.letter,
      drawingDescription: req.body.drawingDescription ?? existing.drawingDescription,
      kidName: req.body.kidName ?? existing.kidName,
      kidAge: req.body.kidAge ?? existing.kidAge,
      schoolName: req.body.schoolName ?? existing.schoolName,
      parentName: req.body.parentName ?? existing.parentName,
      phoneNo: req.body.phoneNo ?? existing.phoneNo,
      moreTitle: req.body.moreTitle ?? existing.moreTitle,
      moreDescription: req.body.moreDescription ?? existing.moreDescription,
      status: req.body.status ?? existing.status,
      highlight: req.body.highlight ?? existing.highlight,
      highlightExpiresAt: (() => {
        const hl = req.body.highlight ?? existing.highlight;
        const exp = req.body.highlightExpiresAt;
        if (hl === "Enable" && exp) return new Date(exp);
        if (hl === "Disable") return null;
        return existing.highlightExpiresAt ?? null;
      })(),
      adminRemarks: req.body.adminRemarks ?? existing.adminRemarks
    };

    const cover = req.files && req.files.coverImage && req.files.coverImage[0];
    if (cover) {
      if (existing.coverImage) {
        const oldKey = getFileKeyFromUrl(existing.coverImage);
        if (oldKey) await deleteFile(oldKey);
      }
      updateData.coverImage = cover.location;
    }

    const drawing = req.files && req.files.drawing && req.files.drawing[0];
    if (drawing) {
      if (existing.drawing) {
        const oldKey = getFileKeyFromUrl(existing.drawing);
        if (oldKey) await deleteFile(oldKey);
      }
      updateData.drawing = drawing.location;
    }

    const kidPhoto = req.files && req.files.kidPhoto && req.files.kidPhoto[0];
    if (kidPhoto) {
      if (existing.kidPhoto) {
        const oldKey = getFileKeyFromUrl(existing.kidPhoto);
        if (oldKey) await deleteFile(oldKey);
      }
      updateData.kidPhoto = kidPhoto.location;
    }

    const updated = await KidsSubmission.findByIdAndUpdate(id, { $set: updateData }, { new: true, runValidators: true });

    // Send WhatsApp notification — errors must not fail the HTTP response
    try {
      const newStatus = req.body.status;
      const statusChanged = newStatus && newStatus !== previousStatus;
      const hasNewRemarks = req.body.adminRemarks && req.body.adminRemarks.trim().length > 0;

      if (statusChanged && newStatus === "Approved") {
        await sendApprovalMessage(updated.phoneNo, updated.kidName);
      } else if (!statusChanged && hasNewRemarks) {
        await sendRemarksMessage(updated.phoneNo, updated.kidName, req.body.adminRemarks);
      }
    } catch (waErr) {
      console.error("[WhatsApp] Failed to send notification:", waErr.message);
    }

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error("Update kids submission error:", error);
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: "Validation error", errors });
    }
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// DELETE /api/kids-submissions/:id - delete (requires Firebase auth + ownership or admin)
router.delete("/:id", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const existing = await KidsSubmission.findById(id);
    if (!existing) return res.status(404).json({ success: false, message: "KidsSubmission not found" });

    // Allow delete only if: admin, or submission belongs to this user
    const isAdmin = req.user?.role === "admin";
    const isOwner = req.user?.firebaseUid && existing.userId === req.user.firebaseUid;
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ success: false, message: "Not authorised to delete this submission." });
    }

    const maybeDelete = async (url) => {
      const key = getFileKeyFromUrl(url);
      if (key) await deleteFile(key);
    };
    if (existing.coverImage) await maybeDelete(existing.coverImage);
    if (existing.drawing) await maybeDelete(existing.drawing);
    if (existing.kidPhoto) await maybeDelete(existing.kidPhoto);

    await KidsSubmission.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: "KidsSubmission deleted successfully" });
  } catch (error) {
    console.error("Delete kids submission error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

module.exports = router;


