const express = require("express");
const AppConfig = require("../models/appConfig");
const { authenticateToken } = require("../middleware/auth");
const router = express.Router();

// GET /api/app-config - public: kids app reads global config
router.get("/", async (req, res) => {
  try {
    const config = await AppConfig.getConfig();
    res.status(200).json({ success: true, data: config.toObject() });
  } catch (error) {
    console.error("Get app config error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// PUT /api/app-config - admin: update global config
router.put("/", authenticateToken, async (req, res) => {
  try {
    const update = {};
    if (req.body.pdfReadingMode !== undefined) {
      if (!["instagram", "vertical"].includes(req.body.pdfReadingMode)) {
        return res.status(400).json({
          success: false,
          message: "pdfReadingMode must be 'instagram' or 'vertical'"
        });
      }
      update.pdfReadingMode = req.body.pdfReadingMode;
    }

    if (req.body.membershipEnabled !== undefined) {
      if (typeof req.body.membershipEnabled !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "membershipEnabled must be a boolean"
        });
      }
      update.membershipEnabled = req.body.membershipEnabled;
    }

    const config = await AppConfig.updateOrCreate(update);
    res.status(200).json({ success: true, data: config.toObject() });
  } catch (error) {
    console.error("Update app config error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

module.exports = router;
