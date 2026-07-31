/**
 * migrate_gallery_to_albums.js
 *
 * Migrates old flat GalleryImage documents → GalleryAlbum (folder) documents.
 *
 * Strategy:
 *   - Images that share the same title are grouped into one album.
 *   - Images with no title (or blank title) go into a single "General" album.
 *
 * Usage:
 *   node scripts/migrate_gallery_to_albums.js
 *
 * Safe to run multiple times — it checks for existing albums with the same
 * title and SKIPS creating duplicates (idempotent).
 */

"use strict";

require("dotenv").config();
const mongoose = require("mongoose");

// ── Models ────────────────────────────────────────────────────────────────────

// Old flat image schema (read-only — we only read from this)
const galleryImageSchema = new mongoose.Schema(
  {
    title:       { type: String, default: "" },
    titleMl:     { type: String, default: "" },
    description: { type: String, default: "" },
    imageUrl:    { type: String, required: true },
    category:    { type: String, default: "general" },
    isActive:    { type: Boolean, default: true },
    sortOrder:   { type: Number, default: 0 },
  },
  { timestamps: true }
);
const GalleryImage = mongoose.model("GalleryImage", galleryImageSchema);

// New album schema (we create into this)
const albumImageSchema = new mongoose.Schema(
  {
    imageUrl:  { type: String, required: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);
const galleryAlbumSchema = new mongoose.Schema(
  {
    title:       { type: String, default: "" },
    titleMl:     { type: String, default: "" },
    description: { type: String, default: "" },
    images:      { type: [albumImageSchema], default: [] },
    isActive:    { type: Boolean, default: true },
    sortOrder:   { type: Number, default: 0 },
  },
  { timestamps: true }
);
const GalleryAlbum = mongoose.model("GalleryAlbum", galleryAlbumSchema);

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeTitle(raw) {
  return (raw || "").trim();
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function migrate() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("❌  MONGODB_URI is not set in .env");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("✅  Connected to MongoDB\n");

  // 1. Fetch all old images
  const oldImages = await GalleryImage.find({}).sort({ sortOrder: 1, createdAt: 1 }).lean();
  console.log(`📸  Found ${oldImages.length} old GalleryImage document(s)`);

  if (oldImages.length === 0) {
    console.log("ℹ️   Nothing to migrate.");
    await mongoose.disconnect();
    return;
  }

  // 2. Group by normalised title
  const groups = new Map(); // title → { titleMl, description, isActive, sortOrder, images[] }

  for (const img of oldImages) {
    const title = normalizeTitle(img.title) || "General";
    const key   = title.toLowerCase(); // case-insensitive grouping key

    if (!groups.has(key)) {
      groups.set(key, {
        title,
        titleMl:     img.titleMl     || "",
        description: img.description || "",
        isActive:    img.isActive !== false,
        sortOrder:   img.sortOrder   || 0,
        images:      [],
      });
    }

    const grp = groups.get(key);
    grp.images.push({
      imageUrl:  img.imageUrl,
      sortOrder: grp.images.length,
    });

    // Keep the "best" titleMl / description from the group (first non-empty wins)
    if (!grp.titleMl     && img.titleMl)     grp.titleMl     = img.titleMl;
    if (!grp.description && img.description) grp.description = img.description;
  }

  console.log(`📁  Will create/update ${groups.size} album(s)\n`);

  let created = 0;
  let skipped = 0;
  let updated = 0;

  // 3. Upsert albums
  for (const [, data] of groups) {
    const existing = await GalleryAlbum.findOne({
      title: { $regex: `^${data.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
    });

    if (existing) {
      // Album already exists — add only the images that aren't already there
      const existingUrls = new Set(existing.images.map((i) => i.imageUrl));
      const newImages = data.images.filter((i) => !existingUrls.has(i.imageUrl));

      if (newImages.length > 0) {
        let nextOrder = existing.images.length;
        newImages.forEach((img) => {
          img.sortOrder = nextOrder++;
          existing.images.push(img);
        });
        await existing.save();
        console.log(`  ↻  Updated  "${data.title}" — added ${newImages.length} image(s)`);
        updated++;
      } else {
        console.log(`  ⏭️   Skipped  "${data.title}" — all images already present`);
        skipped++;
      }
    } else {
      await GalleryAlbum.create(data);
      console.log(`  ✚  Created  "${data.title}" with ${data.images.length} image(s)`);
      created++;
    }
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Migration complete!
  Created : ${created}
  Updated : ${updated}
  Skipped : ${skipped}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Old GalleryImage documents are untouched — verify the albums in the
admin panel, then you can safely drop the "galleryimages" collection.
`);

  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error("❌  Migration failed:", err);
  mongoose.disconnect();
  process.exit(1);
});
