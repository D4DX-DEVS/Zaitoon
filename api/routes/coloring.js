const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/coloringController");
const { authenticateToken } = require("../middleware/auth");
const { upload } = require("../utils/cdn");

// Configure multer to accept image and thumbnail file uploads
const uploadFields = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "thumbnail", maxCount: 1 },
]);

// ─── Public: Coloring Images ──────────────────────────────────────────────────
router.get("/", ctrl.getColoringImages);
router.get("/:id", ctrl.getColoringImageById);

// ─── Admin: Coloring Images CRUD ──────────────────────────────────────────────
router.post("/", authenticateToken, uploadFields, ctrl.createColoringImage);
router.put("/:id", authenticateToken, uploadFields, ctrl.updateColoringImage);
router.delete("/:id", authenticateToken, ctrl.deleteColoringImage);

module.exports = router;
