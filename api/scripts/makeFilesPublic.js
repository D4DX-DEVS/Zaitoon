/**
 * One-time migration: sets ACL to public-read on all objects in the ZAITOON folder
 * Run once: node scripts/makeFilesPublic.js
 */
require("dotenv").config();
const AWS = require("aws-sdk");

const {
  DO_SPACES_KEY,
  DO_SPACES_SECRET,
  DO_SPACES_ENDPOINT,
  DO_SPACES_BUCKET,
  DO_SPACES_FOLDER,
} = process.env;

const endpoint = new AWS.Endpoint(DO_SPACES_ENDPOINT.replace(/\/$/, ""));
const s3 = new AWS.S3({
  endpoint,
  accessKeyId: DO_SPACES_KEY,
  secretAccessKey: DO_SPACES_SECRET,
  signatureVersion: "v4",
});

const FOLDER = (DO_SPACES_FOLDER || "ZAITOON").replace(/^\/+|\/+$/g, "");

async function run() {
  let continuationToken = undefined;
  let total = 0;
  let updated = 0;
  let failed = 0;

  console.log(`Scanning bucket: ${DO_SPACES_BUCKET} / folder: ${FOLDER}`);

  do {
    const params = {
      Bucket: DO_SPACES_BUCKET,
      Prefix: FOLDER + "/",
      MaxKeys: 1000,
      ContinuationToken: continuationToken,
    };

    const response = await s3.listObjectsV2(params).promise();
    const objects = response.Contents || [];
    total += objects.length;

    for (const obj of objects) {
      try {
        await s3
          .putObjectAcl({
            Bucket: DO_SPACES_BUCKET,
            Key: obj.Key,
            ACL: "public-read",
          })
          .promise();
        console.log(`  ✓ ${obj.Key}`);
        updated++;
      } catch (err) {
        console.error(`  ✗ FAILED: ${obj.Key} — ${err.message}`);
        failed++;
      }
    }

    continuationToken = response.IsTruncated
      ? response.NextContinuationToken
      : undefined;
  } while (continuationToken);

  console.log(`\nDone. Total: ${total} | Updated: ${updated} | Failed: ${failed}`);
}

run().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
