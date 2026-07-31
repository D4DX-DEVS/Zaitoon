// Script to drop old MongoDB index that's causing conflicts
// Run this once: node scripts/dropOldIndex.js

const mongoose = require("mongoose");
require("dotenv").config();

async function dropOldIndex() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    const db = mongoose.connection.db;
    const collection = db.collection("quizattempts");

    // List all indexes
    const indexes = await collection.indexes();
    console.log("Current indexes:", indexes);

    // Drop the old index if it exists
    try {
      await collection.dropIndex("quiz_1_user_1");
      console.log("✅ Successfully dropped old index: quiz_1_user_1");
    } catch (err) {
      if (err.code === 27 || err.codeName === "IndexNotFound") {
        console.log("ℹ️  Old index 'quiz_1_user_1' doesn't exist (already dropped or never created)");
      } else {
        console.error("Error dropping index:", err);
      }
    }

    // List indexes again to confirm
    const indexesAfter = await collection.indexes();
    console.log("Indexes after cleanup:", indexesAfter);

    await mongoose.connection.close();
    console.log("✅ Done!");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

dropOldIndex();
