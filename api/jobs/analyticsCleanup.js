const mongoose = require("mongoose");
const AnalyticsEvent = require("../models/analyticsEvent");

/**
 * Analytics Cleanup Job
 * 
 * Runs to delete raw analytics events older than 7 days.
 * The DailyAnalyticsSummary already preserves aggregated data,
 * so raw events beyond 7 days are safe to remove.
 * 
 * Also sets a TTL index so MongoDB auto-deletes old events.
 */

const RETENTION_DAYS = 7;

async function cleanupOldAnalytics() {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

  try {
    const result = await AnalyticsEvent.deleteMany({
      createdAt: { $lt: cutoffDate },
    });

    console.log(
      `[AnalyticsCleanup] Deleted ${result.deletedCount} analytics events older than ${RETENTION_DAYS} days`
    );
  } catch (error) {
    console.error("[AnalyticsCleanup] Error cleaning up analytics:", error.message);
  }
}

async function ensureTTLIndex() {
  try {
    const collection = AnalyticsEvent.collection;
    // Drop old TTL index if it exists with different expiry
    const indexes = await collection.indexes();
    const existingTTL = indexes.find(
      (idx) => idx.key && idx.key.createdAt === 1 && idx.expireAfterSeconds
    );
    if (existingTTL && existingTTL.expireAfterSeconds !== RETENTION_DAYS * 24 * 60 * 60) {
      await collection.dropIndex(existingTTL.name);
      console.log("[AnalyticsCleanup] Dropped old TTL index");
    }
    // Create TTL index for auto-deletion
    await collection.createIndex(
      { createdAt: 1 },
      { expireAfterSeconds: RETENTION_DAYS * 24 * 60 * 60, background: true }
    );
    console.log(`[AnalyticsCleanup] TTL index set: auto-delete after ${RETENTION_DAYS} days`);
  } catch (error) {
    // Index might already exist with same config - that's fine
    if (error.code !== 85 && error.codeName !== "IndexOptionsConflict") {
      console.error("[AnalyticsCleanup] TTL index error:", error.message);
    }
  }
}

function startAnalyticsCleanup() {
  // Wait for MongoDB connection before running cleanup
  mongoose.connection.on("connected", () => {
    // Run cleanup after connection is ready
    cleanupOldAnalytics();
    ensureTTLIndex();
  });

  // If already connected (e.g., late registration), run now
  if (mongoose.connection.readyState === 1) {
    cleanupOldAnalytics();
    ensureTTLIndex();
  }

  // Also run manual cleanup every 6 hours as a safety net
  setInterval(cleanupOldAnalytics, 6 * 60 * 60 * 1000);

  console.log(`[AnalyticsCleanup] Scheduled cleanup of analytics events older than ${RETENTION_DAYS} days`);
}

module.exports = { startAnalyticsCleanup, cleanupOldAnalytics };
