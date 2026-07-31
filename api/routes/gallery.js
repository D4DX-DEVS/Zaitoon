const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/galleryController");
const { authenticateToken } = require("../middleware/auth");
const { upload } = require("../utils/cdn");

// Accept many images at once (no practical limit)
const uploadImages = upload.array("images", 200);

// ─── Public: Gallery Albums ───────────────────────────────────────────────────
router.get("/", ctrl.getAlbums);
router.get("/:id", ctrl.getAlbumById);

// ─── Admin: Gallery Albums CRUD ───────────────────────────────────────────────
router.post("/", authenticateToken, uploadImages, ctrl.createAlbum);
router.post("/:id/images", authenticateToken, uploadImages, ctrl.addAlbumImages);
router.put("/:id", authenticateToken, ctrl.updateAlbum);
router.delete("/:id/images/:imageId", authenticateToken, ctrl.deleteAlbumImage);
router.delete("/:id", authenticateToken, ctrl.deleteAlbum);

module.exports = router;
