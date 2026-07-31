const express = require("express");
const router = express.Router();
const ScheduledContent = require("../models/scheduledContent");
const { authenticateAdmin } = require("../middleware/auth");

// GET /api/schedule - List all scheduled items (admin only)
router.get("/", authenticateAdmin, async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [items, total] = await Promise.all([
      ScheduledContent.find(filter)
        .sort({ publishAt: 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      ScheduledContent.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: {
        items,
        pagination: {
          total,
          page: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error("[Schedule] GET error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch scheduled items" });
  }
});

// POST /api/schedule - Create a new scheduled item (admin only)
router.post("/", authenticateAdmin, async (req, res) => {
  try {
    const { contentType, title, thumbnailUrl, contentData, publishAt } = req.body;

    if (!contentType || !title || !contentData || !publishAt) {
      return res.status(400).json({
        success: false,
        message: "contentType, title, contentData, and publishAt are required"
      });
    }

    const publishDate = new Date(publishAt);
    if (isNaN(publishDate.getTime()) || publishDate <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "publishAt must be a valid future date"
      });
    }

    const item = await ScheduledContent.create({
      contentType,
      title,
      thumbnailUrl,
      contentData,
      publishAt: publishDate,
      status: "pending"
    });

    res.status(201).json({ success: true, data: item });
  } catch (error) {
    console.error("[Schedule] POST error:", error);
    res.status(500).json({ success: false, message: "Failed to create scheduled item" });
  }
});

// PATCH /api/schedule/:id - Update publishAt or other fields (admin only)
router.patch("/:id", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { publishAt, title, contentData } = req.body;

    const item = await ScheduledContent.findById(id);
    if (!item) {
      return res.status(404).json({ success: false, message: "Scheduled item not found" });
    }
    if (item.status !== "pending") {
      return res.status(400).json({ success: false, message: "Only pending items can be updated" });
    }

    if (publishAt) {
      const d = new Date(publishAt);
      if (isNaN(d.getTime()) || d <= new Date()) {
        return res.status(400).json({ success: false, message: "publishAt must be a valid future date" });
      }
      item.publishAt = d;
    }
    if (title) item.title = title;
    if (contentData) item.contentData = contentData;

    await item.save();
    res.json({ success: true, data: item });
  } catch (error) {
    console.error("[Schedule] PATCH error:", error);
    res.status(500).json({ success: false, message: "Failed to update scheduled item" });
  }
});

// DELETE /api/schedule/:id - Cancel/delete a scheduled item (admin only)
router.delete("/:id", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const item = await ScheduledContent.findById(id);
    if (!item) {
      return res.status(404).json({ success: false, message: "Scheduled item not found" });
    }
    if (item.status === "published") {
      return res.status(400).json({ success: false, message: "Cannot delete an already published item" });
    }
    await item.deleteOne();
    res.json({ success: true, message: "Scheduled item cancelled" });
  } catch (error) {
    console.error("[Schedule] DELETE error:", error);
    res.status(500).json({ success: false, message: "Failed to delete scheduled item" });
  }
});

module.exports = router;
