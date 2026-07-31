// One-time script to recompress existing images in Mongo using sharp
// Run manually: node scripts/migrateImages.js
// Optimized for parallel processing with batch support

require('dotenv').config();

const mongoose = require('mongoose');
const axios = require('axios');
const sharp = require('sharp');

const Story = require('../models/stories');
const SingleStory = require('../models/singleStory');
const VideosCategory = require('../models/videosCategory');
const BrightBox = require('../models/brightBox');
const Banner = require('../models/banner');

const { uploadBuffer, getFileKeyFromUrl, deleteFile } = require('../utils/cdn');

// Configure Sharp concurrency for better performance (default is CPU count)
// Adjust based on your system: more cores = can handle more parallel operations
sharp.concurrency(4); // Process 4 images concurrently

// Batch size for parallel processing
const BATCH_SIZE = 5; // Process 5 images at a time

async function downloadToBuffer(url) {
  const response = await axios.get(url, { 
    responseType: 'arraybuffer',
    timeout: 30000, // 30 second timeout
    maxContentLength: 50 * 1024 * 1024 // 50MB max
  });
  return Buffer.from(response.data);
}

async function compressAndReupload(url, { width, quality }) {
  if (!url) return null;

  // Skip if already optimized (ends with .webp)
  if (url.toLowerCase().endsWith('.webp')) {
    console.log('⏭️  Skipping already optimized image:', url);
    return null;
  }

  try {
    const originalBuffer = await downloadToBuffer(url);

    const optimizedBuffer = await sharp(originalBuffer)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();

    const originalName = url.split('/').pop() || 'image';
    const baseName = originalName.replace(/[/\\?%*:|"<>]/g, '').replace(/\.[^.]+$/, '');
    const filename = `${baseName || 'image'}.webp`;

    const uploaded = await uploadBuffer(optimizedBuffer, filename, 'image/webp');

    // Optionally delete the old file from CDN if it was in our Space
    const oldKey = getFileKeyFromUrl(url);
    if (oldKey) {
      try {
        await deleteFile(oldKey);
      } catch (e) {
        console.error('Failed to delete old file from CDN:', url, e.message);
      }
    }

    return uploaded.url;
  } catch (err) {
    console.error('Failed to compress image:', url, err.message);
    return null;
  }
}

// Process items in parallel batches
async function processBatch(items, processFn, batchSize = BATCH_SIZE) {
  const results = { success: 0, failed: 0, skipped: 0 };
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(items.length / batchSize);
    
    console.log(`\n📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} items)...`);
    
    const promises = batch.map(item => processFn(item));
    const batchResults = await Promise.allSettled(promises);
    
    batchResults.forEach((result, idx) => {
      if (result.status === 'fulfilled' && result.value) {
        results.success++;
      } else if (result.status === 'fulfilled' && result.value === null) {
        results.skipped++;
      } else {
        results.failed++;
        console.error(`❌ Failed in batch ${batchNumber}:`, result.reason?.message || 'Unknown error');
      }
    });
    
    console.log(`✅ Batch ${batchNumber} completed: ${results.success} success, ${results.skipped} skipped, ${results.failed} failed`);
    
    // Small delay between batches to avoid overwhelming the system
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  return results;
}

async function migrateStories() {
  const stories = await Story.find({ coverImage: { $exists: true, $ne: '' } });
  console.log(`\n📚 Stories: found ${stories.length} documents with coverImage`);

  if (stories.length === 0) {
    console.log('⏭️  No stories to migrate');
    return { success: 0, failed: 0, skipped: 0 };
  }

  const results = await processBatch(stories, async (story) => {
    if (!story.coverImage) return null;
    const newUrl = await compressAndReupload(story.coverImage, { width: 1200, quality: 75 });
    if (newUrl) {
      story.coverImage = newUrl;
      await story.save();
      return story._id.toString();
    }
    return null;
  });

  console.log(`\n✅ Stories migration completed: ${results.success} updated, ${results.skipped} skipped, ${results.failed} failed`);
  return results;
}

async function migrateSingleStories() {
  const items = await SingleStory.find({ coverImage: { $exists: true, $ne: '' } });
  console.log(`\n📖 SingleStory: found ${items.length} documents with coverImage`);

  if (items.length === 0) {
    console.log('⏭️  No single stories to migrate');
    return { success: 0, failed: 0, skipped: 0 };
  }

  const results = await processBatch(items, async (item) => {
    if (!item.coverImage) return null;
    const newUrl = await compressAndReupload(item.coverImage, { width: 1200, quality: 75 });
    if (newUrl) {
      item.coverImage = newUrl;
      await item.save();
      return item._id.toString();
    }
    return null;
  });

  console.log(`\n✅ SingleStory migration completed: ${results.success} updated, ${results.skipped} skipped, ${results.failed} failed`);
  return results;
}

async function migrateVideoCategories() {
  const cats = await VideosCategory.find({ image: { $exists: true, $ne: '' } });
  console.log(`\n🎬 VideosCategory: found ${cats.length} documents with image`);

  if (cats.length === 0) {
    console.log('⏭️  No video categories to migrate');
    return { success: 0, failed: 0, skipped: 0 };
  }

  const results = await processBatch(cats, async (cat) => {
    if (!cat.image) return null;
    const newUrl = await compressAndReupload(cat.image, { width: 800, quality: 75 });
    if (newUrl) {
      cat.image = newUrl;
      await cat.save();
      return cat._id.toString();
    }
    return null;
  });

  console.log(`\n✅ VideosCategory migration completed: ${results.success} updated, ${results.skipped} skipped, ${results.failed} failed`);
  return results;
}

async function migrateBrightBox() {
  const boxes = await BrightBox.find({ image: { $exists: true, $ne: '' } });
  console.log(`\n📦 BrightBox: found ${boxes.length} documents with image`);

  if (boxes.length === 0) {
    console.log('⏭️  No bright boxes to migrate');
    return { success: 0, failed: 0, skipped: 0 };
  }

  const results = await processBatch(boxes, async (box) => {
    if (!box.image) return null;
    const newUrl = await compressAndReupload(box.image, { width: 800, quality: 75 });
    if (newUrl) {
      box.image = newUrl;
      await box.save();
      return box._id.toString();
    }
    return null;
  });

  console.log(`\n✅ BrightBox migration completed: ${results.success} updated, ${results.skipped} skipped, ${results.failed} failed`);
  return results;
}

async function migrateBanners() {
  const banners = await Banner.find({ image: { $exists: true, $ne: '' } });
  console.log(`\n🖼️  Banner: found ${banners.length} documents with image`);

  if (banners.length === 0) {
    console.log('⏭️  No banners to migrate');
    return { success: 0, failed: 0, skipped: 0 };
  }

  const results = await processBatch(banners, async (banner) => {
    if (!banner.image) return null;
    const newUrl = await compressAndReupload(banner.image, { width: 1200, quality: 75 });
    if (newUrl) {
      banner.image = newUrl;
      await banner.save();
      return banner._id.toString();
    }
    return null;
  });

  console.log(`\n✅ Banner migration completed: ${results.success} updated, ${results.skipped} skipped, ${results.failed} failed`);
  return results;
}

async function main() {
  const mongoUri = process.env.MONGODB_URI || process.env.DB_URL || process.env.MONGO_URL;

  if (!mongoUri) {
    console.error('Missing MongoDB connection string (MONGODB_URI / DB_URL / MONGO_URL).');
    process.exit(1);
  }

  const startTime = Date.now();

  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  console.log('✅ Connected to MongoDB');
  console.log(`⚙️  Sharp concurrency: ${sharp.concurrency()}`);
  console.log(`⚙️  Batch size: ${BATCH_SIZE}`);
  console.log('🚀 Starting image migration...\n');

  try {
    const results = {
      stories: await migrateStories(),
      singleStories: await migrateSingleStories(),
      videoCategories: await migrateVideoCategories(),
      brightBox: await migrateBrightBox(),
      banners: await migrateBanners()
    };

    const totalSuccess = Object.values(results).reduce((sum, r) => sum + r.success, 0);
    const totalFailed = Object.values(results).reduce((sum, r) => sum + r.failed, 0);
    const totalSkipped = Object.values(results).reduce((sum, r) => sum + r.skipped, 0);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successfully migrated: ${totalSuccess} images`);
    console.log(`⏭️  Skipped (already optimized): ${totalSkipped} images`);
    console.log(`❌ Failed: ${totalFailed} images`);
    console.log(`⏱️  Total time: ${duration} seconds`);
    console.log('='.repeat(60));
    console.log('✅ Image migration completed.');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Unexpected error in migration script:', err);
  process.exit(1);
});

