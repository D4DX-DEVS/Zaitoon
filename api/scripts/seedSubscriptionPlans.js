// Seed initial subscription plans (Monthly + Yearly).
// Run once: node scripts/seedSubscriptionPlans.js
// Prices are placeholders in rupees - edit them in the admin panel afterwards.

const mongoose = require("mongoose");
require("dotenv").config();

const SubscriptionPlan = require("../models/subscriptionPlan");

const PLANS = [
  {
    name: "Monthly",
    description: "Full access to all content for 1 month",
    amount: 99,
    durationDays: 30,
    sortOrder: 1
  },
  {
    name: "Yearly",
    description: "Full access to all content for 1 year",
    amount: 999,
    durationDays: 365,
    sortOrder: 2
  }
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    for (const plan of PLANS) {
      const existing = await SubscriptionPlan.findOne({ name: plan.name });
      if (existing) {
        console.log(`Plan "${plan.name}" already exists - skipping`);
        continue;
      }
      await SubscriptionPlan.create(plan);
      console.log(`Created plan "${plan.name}" (₹${plan.amount} / ${plan.durationDays} days)`);
    }

    console.log("Done.");
  } catch (error) {
    console.error("Seed failed:", error.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seed();
