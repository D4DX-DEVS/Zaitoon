const GalleryAlbum = require("../models/galleryAlbum");
const { deleteFile, getFileKeyFromUrl } = require("../utils/cdn");

// Collect image URLs from uploaded files and/or imageUrls in the body.
function collectImageUrls(req) {
  const urls = [];

  const files = req.files || [];
  if (Array.isArray(files)) {
    files.forEach((f) => f && f.location && urls.push(f.location));
  } else if (files.images) {
    files.images.forEach((f) => f && f.location && urls.push(f.location));
  }

  let bodyUrls = req.body && req.body.imageUrls;
  if (typeof bodyUrls === "string") {
    try {
      bodyUrls = JSON.parse(bodyUrls);
    } catch (_) {
      bodyUrls = bodyUrls.trim() ? [bodyUrls.trim()] : [];
    }
  }
  if (Array.isArray(bodyUrls)) {
    bodyUrls.forEach((u) => u && urls.push(u));
  }

  // Backwards compatibility: single imageUrl field
  if (req.body && req.body.imageUrl) urls.push(req.body.imageUrl);

  return urls;
}

/**
 * GET /api/gallery
 * List gallery albums (folders) with their images.
 * Optional filters: ?active=all (admin) &page=1&limit=100
 */
async function getAlbums(req, res) {
  try {
    const filter = {};
    if (req.query.active !== "all") {
      filter.isActive = true;
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 100));
    const skip = (page - 1) * limit;

    const [albums, total] = await Promise.all([
      GalleryAlbum.find(filter)
        .sort({ sortOrder: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      GalleryAlbum.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: {
        albums,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[Gallery] getAlbums error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to fetch gallery albums." });
  }
}

/**
 * GET /api/gallery/:id
 * Get a single album by ID.
 */
async function getAlbumById(req, res) {
  try {
    const album = await GalleryAlbum.findById(req.params.id).lean();
    if (!album) {
      return res.status(404).json({ success: false, message: "Album not found." });
    }
    return res.json({ success: true, data: album });
  } catch (error) {
    console.error("[Gallery] getAlbumById error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to fetch album." });
  }
}

/**
 * POST /api/gallery (Admin)
 * Create a new album (folder) with one or more images.
 */
async function createAlbum(req, res) {
  try {
    const { title, titleMl, description, sortOrder } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: "Title is required." });
    }

    const urls = collectImageUrls(req);
    if (urls.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one image (file or imageUrl) is required.",
      });
    }

    const images = urls.map((u, i) => ({ imageUrl: u, sortOrder: i }));

    const album = await GalleryAlbum.create({
      title: title.trim(),
      titleMl: titleMl || "",
      description: description || "",
      sortOrder: parseInt(sortOrder) || 0,
      images,
    });

    return res.status(201).json({
      success: true,
      message: "Album created.",
      data: album,
    });
  } catch (error) {
    console.error("[Gallery] createAlbum error:", error.message);
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error.",
        errors: Object.values(error.errors).map((e) => e.message),
      });
    }
    return res.status(500).json({ success: false, message: "Failed to create album." });
  }
}

/**
 * POST /api/gallery/:id/images (Admin)
 * Add one or more images to an existing album.
 */
async function addAlbumImages(req, res) {
  try {
    const album = await GalleryAlbum.findById(req.params.id);
    if (!album) {
      return res.status(404).json({ success: false, message: "Album not found." });
    }

    const urls = collectImageUrls(req);
    if (urls.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one image (file or imageUrl) is required.",
      });
    }

    let nextOrder = album.images.length;
    urls.forEach((u) => {
      album.images.push({ imageUrl: u, sortOrder: nextOrder++ });
    });

    await album.save();

    return res.json({
      success: true,
      message: "Images added to album.",
      data: album,
    });
  } catch (error) {
    console.error("[Gallery] addAlbumImages error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to add images." });
  }
}

/**
 * PUT /api/gallery/:id (Admin)
 * Update album metadata (title, description, visibility, order).
 */
async function updateAlbum(req, res) {
  try {
    const existing = await GalleryAlbum.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Album not found." });
    }

    const updates = {};
    const { title, titleMl, description, sortOrder, isActive } = req.body;

    if (title !== undefined) updates.title = title;
    if (titleMl !== undefined) updates.titleMl = titleMl;
    if (description !== undefined) updates.description = description;
    if (sortOrder !== undefined) updates.sortOrder = parseInt(sortOrder) || 0;
    if (isActive !== undefined) updates.isActive = isActive === "true" || isActive === true;

    const album = await GalleryAlbum.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    return res.json({
      success: true,
      message: "Album updated.",
      data: album,
    });
  } catch (error) {
    console.error("[Gallery] updateAlbum error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to update album." });
  }
}

/**
 * DELETE /api/gallery/:id/images/:imageId (Admin)
 * Remove a single image from an album and clean up the CDN file.
 */
async function deleteAlbumImage(req, res) {
  try {
    const album = await GalleryAlbum.findById(req.params.id);
    if (!album) {
      return res.status(404).json({ success: false, message: "Album not found." });
    }

    const image = album.images.id(req.params.imageId);
    if (!image) {
      return res.status(404).json({ success: false, message: "Image not found." });
    }

    if (image.imageUrl) {
      try {
        await deleteFile(getFileKeyFromUrl(image.imageUrl));
      } catch (_) {}
    }

    album.images.pull(req.params.imageId);
    await album.save();

    return res.json({ success: true, message: "Image removed.", data: album });
  } catch (error) {
    console.error("[Gallery] deleteAlbumImage error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to remove image." });
  }
}

/**
 * DELETE /api/gallery/:id (Admin)
 * Delete an album and clean up all its CDN files.
 */
async function deleteAlbum(req, res) {
  try {
    const album = await GalleryAlbum.findByIdAndDelete(req.params.id);
    if (!album) {
      return res.status(404).json({ success: false, message: "Album not found." });
    }

    for (const image of album.images) {
      if (image.imageUrl) {
        try {
          await deleteFile(getFileKeyFromUrl(image.imageUrl));
        } catch (_) {}
      }
    }

    return res.json({ success: true, message: "Album deleted." });
  } catch (error) {
    console.error("[Gallery] deleteAlbum error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to delete album." });
  }
}

module.exports = {
  getAlbums,
  getAlbumById,
  createAlbum,
  addAlbumImages,
  updateAlbum,
  deleteAlbumImage,
  deleteAlbum,
};
