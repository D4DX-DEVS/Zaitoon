const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const router = express.Router();
const { authenticateAdmin } = require("../middleware/auth");
const { analyzeMediaFiles } = require("../services/mediaAnalysis");
const { sendPushNotification } = require("../services/notificationService");
const { getUsers: getGrowthUsers } = require("../controllers/growthActivityController");
const { optimizeAndUploadImage } = require("../utils/imageOptimizer");
const { uploadBuffer } = require("../utils/cdn");

const uploadImage = multer({ storage: multer.memoryStorage() }).single("image");

// Admin login route
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required"
      });
    }

    // Get admin credentials from environment variables
    const adminUsername = process.env.ADMIN_USERNAME;
    const adminPassword = process.env.ADMIN_PASSWORD;

    // Check if admin credentials are configured
    if (!adminUsername || !adminPassword) {
      return res.status(500).json({
        success: false,
        message: "Admin credentials not configured"
      });
    }

    // Verify username
    if (username !== adminUsername) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    // Verify password (assuming password is hashed in env, if not, we'll hash it)
    const isPasswordValid = await bcrypt.compare(password, adminPassword);
    
    // If bcrypt comparison fails, try direct comparison (for plain text passwords)
    const passwordMatch = isPasswordValid || password === adminPassword;

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        username: adminUsername,
        role: 'admin'
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.status(200).json({
      success: true,
      message: "Login successful",
      token: token,
      admin: {
        username: adminUsername,
        role: 'admin'
      }
    });

  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
});

// GET /api/admin/users-activity — Get all users' growth & activity stats (admin only)
router.get("/users-activity", authenticateAdmin, getGrowthUsers);

// Send OneSignal push notification (broadcast to all users)
// Supports multipart/form-data: title, message, image (optional)
router.post(
  "/send-notification",
  authenticateAdmin,
  uploadImage,
  async (req, res) => {
    try {
      const { title, message, data } = req.body || {};

      if (!title || !message) {
        return res.status(400).json({
          success: false,
          message: "Title and message are required",
        });
      }

      let imageUrl = null;
      if (req.file) {
        imageUrl = await optimizeAndUploadImage(req.file, { width: 1200, quality: 80 });
        console.log('Image uploaded successfully:', imageUrl);
      }

      const result = await sendPushNotification({
        title,
        message,
        data: data || {},
        imageUrl,
      });

      return res.status(200).json({
        success: true,
        message: "Notification sent successfully",
        data: result,
        imageIncluded: !!imageUrl,
      });
    } catch (error) {
      console.error("Error sending notification:", error.message);
      return res.status(500).json({
        success: false,
        message: "Failed to send notification",
        error: error.message,
      });
    }
  }
);

// Media analysis route - Get detailed information about files in DigitalOcean Space
// router.get("/media-analysis", authenticateAdmin, async (req, res) => {
//   try {
//     console.log("📊 Media analysis request received");
    
//     const report = await analyzeMediaFiles();
    
//     res.status(200).json({
//       success: true,
//       message: "Media analysis completed successfully",
//       data: report
//     });
//   } catch (error) {
//     console.error("Media analysis error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to analyze media files",
//       error: error.message
//     });
//   }
// });

// Generic file upload endpoint (used by scheduled upload feature)
// POST /api/admin/upload-file
// Accepts: multipart/form-data with a single "file" field
// Returns: { success: true, url: '...' }
const uploadAnyFile = multer({ storage: multer.memoryStorage() }).single("file");

router.post(
  "/upload-file",
  authenticateAdmin,
  uploadAnyFile,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: "No file provided" });
      }

      const { buffer, originalname, mimetype } = req.file;
      let url;

      // Optimize images before uploading
      if (mimetype && mimetype.startsWith("image/")) {
        url = await optimizeAndUploadImage(req.file, { width: 1200, quality: 80 });
      } else {
        const result = await uploadBuffer(buffer, originalname, mimetype);
        url = result.url;
      }

      return res.status(200).json({ success: true, url });
    } catch (error) {
      console.error("[AdminUpload] Error:", error.message);
      return res.status(500).json({ success: false, message: "File upload failed" });
    }
  }
);

module.exports = router;
