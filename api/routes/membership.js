const express = require("express");
const router = express.Router();
const Membership = require("../models/membership");
const { upload, deleteFile, getFileKeyFromUrl } = require("../utils/cdn");
const { authenticateAdmin, authenticateFirebaseToken } = require("../middleware/auth");

// ponytail: timestamp+random card number, the unique index catches the rare clash.
// Swap for a counter collection only if sequential card numbers are ever required.
function generateMembershipNo() {
  return `ZT${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`;
}

// POST /api/memberships - flutter app submits membership details + selfie
router.post("/", authenticateFirebaseToken, upload.single("photo"), async (req, res) => {
  try {
    // Identity comes from the verified token - a client-supplied userId is ignored
    const userId = req.user?.id && String(req.user.id);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }

    const { name, phone } = req.body;
    const className = req.body.className || req.body.class;

    const errors = [];
    if (!name) errors.push("name is required");
    if (!phone) errors.push("phone is required");
    if (!className) errors.push("class is required");
    if (errors.length) {
      return res.status(400).json({ success: false, message: "Validation error", errors });
    }

    const existing = await Membership.findOne({ userId });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Membership already exists for this user",
        data: existing
      });
    }

    const doc = await Membership.create({
      userId,
      membershipNo: generateMembershipNo(),
      name,
      phone,
      className,
      photo: req.file ? req.file.location : undefined
    });

    res.status(201).json({ success: true, data: doc });
  } catch (error) {
    console.error("Create membership error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// GET /api/memberships/me - app fetches its own membership card data
router.get("/me", authenticateFirebaseToken, async (req, res) => {
  try {
    const userId = req.user?.id && String(req.user.id);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }

    const doc = await Membership.findOne({ userId });
    if (!doc) return res.status(404).json({ success: false, message: "Membership not found" });
    res.status(200).json({ success: true, data: doc });
  } catch (error) {
    console.error("Get user membership error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// GET /api/memberships - admin list (search by name / phone / class / membership no)
router.get("/", authenticateAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const search = (req.query.search || "").trim();

    const query = search
      ? {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { phone: { $regex: search, $options: "i" } },
            { membershipNo: { $regex: search, $options: "i" } },
            { className: { $regex: search, $options: "i" } }
          ]
        }
      : {};

    const [items, total] = await Promise.all([
      Membership.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Membership.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: items,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 }
    });
  } catch (error) {
    console.error("Get memberships error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// GET /api/memberships/:id - admin detail
router.get("/:id", authenticateAdmin, async (req, res) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }
    const doc = await Membership.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: "Membership not found" });
    res.status(200).json({ success: true, data: doc });
  } catch (error) {
    console.error("Get membership error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// PUT /api/memberships/:id - admin fixes details / replaces the selfie
router.put("/:id", authenticateAdmin, upload.single("photo"), async (req, res) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }
    const doc = await Membership.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: "Membership not found" });

    const { name, phone } = req.body;
    const className = req.body.className || req.body.class;
    if (name) doc.name = name;
    if (phone) doc.phone = phone;
    if (className) doc.className = className;

    if (req.file) {
      const oldKey = doc.photo && getFileKeyFromUrl(doc.photo);
      doc.photo = req.file.location;
      if (oldKey) await deleteFile(oldKey).catch(() => {});
    }

    await doc.save();
    res.status(200).json({ success: true, data: doc });
  } catch (error) {
    console.error("Update membership error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// DELETE /api/memberships/:id - admin removes a membership and its selfie
router.delete("/:id", authenticateAdmin, async (req, res) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }
    const doc = await Membership.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: "Membership not found" });

    const key = doc.photo && getFileKeyFromUrl(doc.photo);
    if (key) await deleteFile(key).catch(() => {});

    res.status(200).json({ success: true, message: "Membership deleted" });
  } catch (error) {
    console.error("Delete membership error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

module.exports = router;
