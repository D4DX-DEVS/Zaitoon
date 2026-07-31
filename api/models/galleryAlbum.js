const mongoose = require("mongoose");

// A single image inside an album (folder)
const albumImageSchema = new mongoose.Schema(
  {
    imageUrl: {
      type: String,
      required: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// An album is a folder of images grouped under a title
const galleryAlbumSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: "",
      trim: true,
    },
    titleMl: {
      type: String,
      default: "",
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    images: {
      type: [albumImageSchema],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

galleryAlbumSchema.index({ isActive: 1, sortOrder: 1, createdAt: -1 });

module.exports = mongoose.model("GalleryAlbum", galleryAlbumSchema);
