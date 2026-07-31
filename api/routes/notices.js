const express = require('express');
const router = express.Router();
const Notice = require('../models/notice');
const { authenticateAdmin } = require('../middleware/auth');
const { upload, getFileKeyFromUrl, deleteFile, buildCdnUrl } = require('../utils/cdn');
const { sendContentNotification } = require('../services/notificationService');

// Public: get active app notices (for mobile app)
router.get('/notices/app', async (req, res) => {
  try {
    const notices = await Notice.find({ type: 'app', active: true })
      .sort({ createdAt: -1 })
      .select('title message image senderName createdAt');
    res.json({ success: true, data: notices });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Admin: get all notices (both types)
router.get('/admin/notices', authenticateAdmin, async (req, res) => {
  try {
    const notices = await Notice.find().sort({ createdAt: -1 });
    res.json({ success: true, data: notices });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Admin: create notice
router.post('/admin/notices', authenticateAdmin, upload.single('image'), async (req, res) => {
  try {
    const { type, title, message, imageLink, senderName } = req.body;
    if (!type || !title || !message) {
      return res.status(400).json({ success: false, message: 'type, title, and message are required' });
    }
    if (!['admin', 'app'].includes(type)) {
      return res.status(400).json({ success: false, message: 'type must be admin or app' });
    }

    let image = null;
    if (req.file) {
      image = buildCdnUrl(req.file.key);
    } else if (imageLink && imageLink.trim()) {
      image = imageLink.trim();
    }

    const noticeData = { type, title: title.trim(), message: message.trim(), image };
    if (senderName !== undefined) noticeData.senderName = senderName.trim() || null;

    const notice = await Notice.create(noticeData);

    // Send push notification to all users
    await sendContentNotification({
      contentType: "notice",
      contentId: notice._id,
      title: notice.title,
      message: notice.message,
      imageUrl: notice.image,
    });

    res.status(201).json({ success: true, data: notice });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Admin: update notice
router.put('/admin/notices/:id', authenticateAdmin, upload.single('image'), async (req, res) => {
  try {
    const { title, message, active, type, imageLink, removeImage, senderName } = req.body;
    const existing = await Notice.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Notice not found' });

    const update = {};
    if (title !== undefined) update.title = title.trim();
    if (message !== undefined) update.message = message.trim();
    if (senderName !== undefined) update.senderName = senderName.trim() || null;
    if (active !== undefined) update.active = active === 'true' || active === true;
    if (type !== undefined) {
      if (!['admin', 'app'].includes(type)) {
        return res.status(400).json({ success: false, message: 'type must be admin or app' });
      }
      update.type = type;
    }

    // Handle image: file upload > imageLink > removeImage
    if (req.file) {
      // Delete old CDN image if exists
      if (existing.image) {
        const oldKey = getFileKeyFromUrl(existing.image);
        if (oldKey) await deleteFile(oldKey).catch(() => {});
      }
      update.image = buildCdnUrl(req.file.key);
    } else if (imageLink !== undefined && imageLink.trim()) {
      if (existing.image) {
        const oldKey = getFileKeyFromUrl(existing.image);
        if (oldKey) await deleteFile(oldKey).catch(() => {});
      }
      update.image = imageLink.trim();
    } else if (removeImage === 'true' || removeImage === true) {
      if (existing.image) {
        const oldKey = getFileKeyFromUrl(existing.image);
        if (oldKey) await deleteFile(oldKey).catch(() => {});
      }
      update.image = null;
    }

    const notice = await Notice.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    res.json({ success: true, data: notice });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Admin: delete notice
router.delete('/admin/notices/:id', authenticateAdmin, async (req, res) => {
  try {
    const notice = await Notice.findByIdAndDelete(req.params.id);
    if (!notice) return res.status(404).json({ success: false, message: 'Notice not found' });
    // Clean up CDN image if exists
    if (notice.image) {
      const key = getFileKeyFromUrl(notice.image);
      if (key) await deleteFile(key).catch(() => {});
    }
    res.json({ success: true, message: 'Notice deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
