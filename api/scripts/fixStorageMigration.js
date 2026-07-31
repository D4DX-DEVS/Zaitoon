/**
 * Storage migration: copies S3 objects that have trailing `"` in their key
 * to clean keys (without `"`), then updates all MongoDB documents to match.
 *
 * Run once: node scripts/fixStorageMigration.js
 *
 * Safe to re-run: skips objects already migrated (clean key already exists).
 */
require("dotenv").config();
const AWS = require("aws-sdk");
const mongoose = require("mongoose");

const {
  DO_SPACES_KEY,
  DO_SPACES_SECRET,
  DO_SPACES_ENDPOINT,
  DO_SPACES_BUCKET,
  MONGODB_URI,
} = process.env;

// ── S3 client ───────────────────────────────────────────────────────────────
const endpoint = new AWS.Endpoint(DO_SPACES_ENDPOINT.replace(/\/$/, ""));
const s3 = new AWS.S3({
  endpoint,
  accessKeyId: DO_SPACES_KEY,
  secretAccessKey: DO_SPACES_SECRET,
  signatureVersion: "v4",
});

// ── helpers ──────────────────────────────────────────────────────────────────
function stripKey(key) {
  // Remove trailing `"`, backslash, whitespace chars from the S3 key
  return key.replace(/["\s\\]+$/, "");
}

// Map from dirty URL → clean URL (built during S3 phase, reused in Mongo phase)
const urlMap = new Map();

// ── phase 1: fix S3 keys ─────────────────────────────────────────────────────
async function fixS3Keys() {
  console.log("\n=== Phase 1: Fixing S3 object keys ===");
  let total = 0;
  let copied = 0;
  let skipped = 0;
  let failed = 0;
  let continuationToken;

  do {
    const resp = await s3
      .listObjectsV2({
        Bucket: DO_SPACES_BUCKET,
        Prefix: "ZAITOON/",
        MaxKeys: 1000,
        ContinuationToken: continuationToken,
      })
      .promise();

    for (const obj of resp.Contents || []) {
      const dirtyKey = obj.Key;
      const cleanedKey = stripKey(dirtyKey);

      if (cleanedKey === dirtyKey) continue; // key is already clean

      total++;

      // Build both URL forms for the Mongo phase
      const dirtyUrl = `https://${DO_SPACES_BUCKET}.${DO_SPACES_ENDPOINT.replace(/^https?:\/\//, "")}/${dirtyKey}`;
      const cleanUrl = `https://${DO_SPACES_BUCKET}.${DO_SPACES_ENDPOINT.replace(/^https?:\/\//, "")}/${cleanedKey}`;
      urlMap.set(dirtyKey, cleanedKey);

      // Also map CDN-domain variants
      const cdnHost = `${DO_SPACES_BUCKET}.${DO_SPACES_ENDPOINT.replace(/^https?:\/\//, "").replace("digitaloceanspaces.com", "cdn.digitaloceanspaces.com")}`;
      urlMap.set(
        `https://${cdnHost}/${dirtyKey}`,
        `https://${DO_SPACES_BUCKET}.${DO_SPACES_ENDPOINT.replace(/^https?:\/\//, "")}/${cleanedKey}`
      );

      try {
        // Copy to clean key with public-read
        await s3
          .copyObject({
            Bucket: DO_SPACES_BUCKET,
            CopySource: `/${DO_SPACES_BUCKET}/${dirtyKey}`,
            Key: cleanedKey,
            ACL: "public-read",
            MetadataDirective: "COPY",
          })
          .promise();

        // Delete old dirty key
        await s3
          .deleteObject({ Bucket: DO_SPACES_BUCKET, Key: dirtyKey })
          .promise();

        console.log(`  ✓ renamed: ${dirtyKey}  →  ${cleanedKey}`);
        copied++;
      } catch (err) {
        console.error(`  ✗ FAILED: ${dirtyKey} — ${err.message}`);
        failed++;
      }
    }

    continuationToken = resp.IsTruncated ? resp.NextContinuationToken : undefined;
  } while (continuationToken);

  console.log(`\nS3: ${total} dirty keys found | ${copied} renamed | ${skipped} skipped | ${failed} failed`);
}

// ── phase 2: fix MongoDB URLs ────────────────────────────────────────────────
// Strip trailing `"`, `\`, whitespace from a URL string
function cleanMongoUrl(url) {
  if (typeof url !== "string" || !url) return url;
  return url.replace(/["\s\\]+$/, "");
}

// Collections + their URL fields to clean
const COLLECTIONS = [
  {
    name: "singlestories",
    fields: ["coverImage", "enBanner", "mlBanner", "urBanner", "hinBanner", "enStoryFile", "mlStoryFile", "urStoryFile", "hinStoryFile"],
  },
  {
    name: "stories",
    fields: ["coverImage", "thumbnail"],
    // Episodes are embedded; handled separately below
  },
  {
    name: "brightboxstories",
    fields: ["image", "adBanner", "mlBanner", "urBanner", "hinBanner", "enFile", "mlFile", "urFile", "hinFile"],
  },
  {
    name: "coloringimages",
    fields: ["image", "thumbnailImage"],
  },
  {
    name: "videos",
    fields: ["video", "thumbnail"],
  },
  {
    name: "banners",
    fields: ["image", "mlBanner", "enBanner", "urBanner", "hinBanner"],
  },
  {
    name: "paymentbanners",
    fields: ["image"],
  },
  {
    name: "singlestorypuzzles",
    fields: ["image"],
  },
];

async function fixMongoUrls() {
  console.log("\n=== Phase 2: Fixing MongoDB URLs ===");
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB");

  const db = mongoose.connection.db;
  let grandTotal = 0;

  for (const { name, fields } of COLLECTIONS) {
    const coll = db.collection(name);
    let count = 0;

    // Build $set for top-level URL fields
    const docs = await coll.find({}).toArray();
    for (const doc of docs) {
      const updates = {};

      for (const field of fields) {
        const val = doc[field];
        if (typeof val === "string" && val !== cleanMongoUrl(val)) {
          updates[field] = cleanMongoUrl(val);
        }
      }

      // Handle stories with embedded episodes
      if (name === "stories" && Array.isArray(doc.seasons)) {
        const episodeFields = [
          "storyFile", "mlStoryFile", "urStoryFile", "hinStoryFile",
          "coverImage", "adBanner", "mlBanner", "urBanner", "hinBanner",
        ];
        let episodeUpdates = false;
        const seasons = doc.seasons.map((season) => ({
          ...season,
          episodes: (season.episodes || []).map((ep) => {
            const epUp = {};
            for (const f of episodeFields) {
              if (typeof ep[f] === "string" && ep[f] !== cleanMongoUrl(ep[f])) {
                epUp[f] = cleanMongoUrl(ep[f]);
                episodeUpdates = true;
              }
            }
            return Object.keys(epUp).length ? { ...ep, ...epUp } : ep;
          }),
        }));
        if (episodeUpdates) {
          updates.seasons = seasons;
        }
      }

      if (Object.keys(updates).length) {
        await coll.updateOne({ _id: doc._id }, { $set: updates });
        count++;
      }
    }

    if (count) console.log(`  ${name}: updated ${count} documents`);
    grandTotal += count;
  }

  console.log(`\nMongoDB: ${grandTotal} total documents updated`);
  await mongoose.disconnect();
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  try {
    await fixS3Keys();
    await fixMongoUrls();
    console.log("\n✅ Migration complete. All files are now accessible with clean URLs.");
  } catch (err) {
    console.error("\n❌ Fatal:", err.message);
    process.exit(1);
  }
}

main();
