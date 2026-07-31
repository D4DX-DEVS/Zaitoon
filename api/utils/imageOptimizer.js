const sharp = require('sharp');
const { uploadBuffer } = require('./cdn');

/**
 * Optimize an uploaded image file and upload it to CDN as WebP.
 * Returns the public URL that can be stored in the database.
 *
 * This is intentionally generic and minimal so routes can call it
 * without changing their existing response shapes.
 *
 * @param {Object} file - Multer file object (with buffer + originalname)
 * @param {Object} options - Optional { width, quality }
 * @returns {Promise<string>} Public URL of the optimized image
 */
async function optimizeAndUploadImage(file, options = {}) {
  if (!file || !file.buffer) {
    throw new Error('optimizeAndUploadImage: file buffer is required');
  }

  const {
    width = 1200,
    quality = 75
  } = options;

  // Convert to WebP with resize cap
  const optimizedBuffer = await sharp(file.buffer)
    .resize({ width, withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();

  const baseName = (file.originalname || 'image')
    .replace(/[/\\?%*:|"<>]/g, '')       // strip dangerous characters
    .replace(/\.[^.]+$/, '');           // remove extension

  const filename = `${baseName || 'image'}.webp`;

  const uploaded = await uploadBuffer(optimizedBuffer, filename, 'image/webp');
  return uploaded.url;
}

module.exports = {
  optimizeAndUploadImage
};

