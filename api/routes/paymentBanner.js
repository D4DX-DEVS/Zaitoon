const express = require('express');
const PaymentBanner = require('../models/paymentBanner');
const { authenticateAdmin } = require('../middleware/auth');
const { upload, deleteFile, getFileKeyFromUrl } = require('../utils/cdn');
const router = express.Router();
const uploadFields = upload.fields([{ name: 'image', maxCount: 1 }]);

// GET /api/payment-banner — public: active banner only (for app frontend)
router.get('/', async (req, res) => {
  try {
    const doc = await PaymentBanner.findOne().lean();
    const active = !!(doc && doc.active && doc.image);
    if (!active) {
      return res.json({ success: true, active: false, data: null });
    }
    res.json({ success: true, active: true, data: { image: doc.image } });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/payment-banner/admin — admin: current settings
router.get('/admin', authenticateAdmin, async (req, res) => {
  try {
    let doc = await PaymentBanner.findOne().lean();
    if (!doc) {
      doc = await PaymentBanner.create({});
      doc = doc.toObject();
    }
    res.json({ success: true, data: doc });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/payment-banner — admin: update image and/or active
router.put('/', authenticateAdmin, uploadFields, async (req, res) => {
  try {
    let doc = await PaymentBanner.findOne();
    if (!doc) doc = await PaymentBanner.create({});

    if (req.files?.image?.[0]) {
      if (doc.image) {
        const key = getFileKeyFromUrl(doc.image);
        if (key) await deleteFile(key);
      }
      doc.image = req.files.image[0].location;
    } else if (req.body.image !== undefined) doc.image = req.body.image;
    if (req.body.active !== undefined) doc.active = req.body.active === true || req.body.active === 'true';

    await doc.save();
    res.json({ success: true, data: doc });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
