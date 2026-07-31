const crypto = require("crypto");
const SubscriptionPlan = require("../models/subscriptionPlan");
const Subscription = require("../models/subscription");
const User = require("../models/user");
const { getRazorpayInstance } = require("../utils/razorpay");

/* ----------------------------- Plans (app) ----------------------------- */

const listActivePlans = async () => {
  return SubscriptionPlan.find({ isActive: true })
    .sort({ sortOrder: 1, amount: 1 })
    .lean();
};

/* --------------------------- Plans (admin) ---------------------------- */

const listAllPlans = async () => {
  return SubscriptionPlan.find({})
    .sort({ sortOrder: 1, amount: 1 })
    .lean();
};

const createPlan = async ({ name, description, amount, durationDays, isActive, sortOrder }) => {
  if (!name || !amount || !durationDays) {
    throw new Error("name, amount and durationDays are required");
  }

  return SubscriptionPlan.create({
    name,
    description,
    amount: Number(amount),
    durationDays: Number(durationDays),
    isActive: isActive !== undefined ? Boolean(isActive) : true,
    sortOrder: Number(sortOrder) || 0
  });
};

const updatePlan = async (planId, updates) => {
  const allowed = ["name", "description", "amount", "durationDays", "isActive", "sortOrder"];
  const payload = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      payload[key] = updates[key];
    }
  }

  const plan = await SubscriptionPlan.findByIdAndUpdate(planId, payload, {
    new: true,
    runValidators: true
  });

  if (!plan) {
    throw new Error("Subscription plan not found");
  }

  return plan;
};

const deletePlan = async (planId) => {
  const plan = await SubscriptionPlan.findByIdAndDelete(planId);
  if (!plan) {
    throw new Error("Subscription plan not found");
  }
  return plan;
};

/* --------------------------- Purchase flow ---------------------------- */

const createSubscriptionOrder = async ({ userId, planId }) => {
  if (!userId) {
    throw new Error("Authenticated user is required");
  }

  const plan = await SubscriptionPlan.findById(planId);
  if (!plan || !plan.isActive) {
    throw new Error("Selected subscription plan is not available");
  }

  const amountInPaise = Math.round(Number(plan.amount) * 100);
  if (amountInPaise < 100) {
    throw new Error("Plan amount is invalid");
  }

  const razorpay = getRazorpayInstance();

  console.info("[Subscription] Creating Razorpay order", {
    userId,
    planId: plan._id.toString(),
    amountInPaise
  });

  const order = await razorpay.orders.create({
    amount: amountInPaise,
    currency: plan.currency || "INR",
    receipt: `sub_${Date.now()}`,
    notes: {
      userId: userId.toString(),
      planId: plan._id.toString(),
      planName: plan.name
    }
  });

  const subscription = await Subscription.create({
    user: userId,
    plan: plan._id,
    planName: plan.name,
    durationDays: plan.durationDays,
    amount: order.amount,
    currency: order.currency,
    status: "created",
    orderId: order.id,
    metadata: order.notes
  });

  return { order, plan, subscription };
};

const applyActiveSubscription = async (subscription) => {
  const start = new Date();
  const end = new Date(start.getTime() + (subscription.durationDays || 0) * 24 * 60 * 60 * 1000);

  subscription.startDate = start;
  subscription.endDate = end;

  await User.findByIdAndUpdate(subscription.user, {
    subscription: {
      status: "active",
      planName: subscription.planName,
      endDate: end,
      activatedAt: start
    }
  });

  return subscription;
};

const verifySubscriptionPayment = async ({
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature
}) => {
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    throw new Error("Invalid Razorpay verification payload");
  }

  const subscription = await Subscription.findOne({ orderId: razorpayOrderId });
  if (!subscription) {
    throw new Error("Subscription order not found");
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    throw new Error("Razorpay secret is not configured");
  }

  const generatedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  if (generatedSignature !== razorpaySignature) {
    subscription.status = "failed";
    subscription.paymentId = razorpayPaymentId;
    subscription.signature = razorpaySignature;
    await subscription.save();
    throw new Error("Razorpay signature verification failed");
  }

  subscription.status = "paid";
  subscription.paymentId = razorpayPaymentId;
  subscription.signature = razorpaySignature;
  await applyActiveSubscription(subscription);
  await subscription.save();

  console.info("[Subscription] Payment verified", {
    orderId: razorpayOrderId,
    paymentId: razorpayPaymentId
  });

  return subscription;
};

/* --------------------------- User status ------------------------------ */

const getUserSubscription = async (userId) => {
  const active = await Subscription.findOne({
    user: userId,
    status: "paid",
    endDate: { $gt: new Date() }
  })
    .sort({ endDate: -1 })
    .lean();

  if (active) {
    return { isActive: true, subscription: active };
  }

  // Keep the snapshot in sync when the window has lapsed.
  const user = await User.findById(userId).select("subscription").lean();
  if (user?.subscription?.status === "active") {
    await User.findByIdAndUpdate(userId, { "subscription.status": "expired" });
  }

  const latest = await Subscription.findOne({ user: userId })
    .sort({ createdAt: -1 })
    .lean();

  return { isActive: false, subscription: latest || null };
};

/* --------------------------- Admin listing ---------------------------- */

const listSubscriptions = async ({
  status,
  search,
  page = 1,
  limit = 20,
  sortBy = "createdAt",
  sortOrder = "desc"
}) => {
  const pageNumber = Math.max(1, Number(page) || 1);
  const pageLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const skip = (pageNumber - 1) * pageLimit;

  const filters = {};
  if (status && typeof status === "string") {
    filters.status = status;
  }
  if (search && typeof search === "string") {
    const regex = new RegExp(search.trim(), "i");
    filters.$or = [
      { planName: regex },
      { orderId: regex },
      { paymentId: regex }
    ];
  }

  const sortDirection = sortOrder === "asc" ? 1 : -1;
  const sortField = ["planName", "amount", "status", "createdAt", "endDate"].includes(sortBy)
    ? sortBy
    : "createdAt";

  const [subscriptions, totalCount, statusCounts] = await Promise.all([
    Subscription.find(filters)
      .sort({ [sortField]: sortDirection })
      .skip(skip)
      .limit(pageLimit)
      .populate("user", "name email firebaseUid")
      .lean(),
    Subscription.countDocuments(filters),
    Subscription.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }])
  ]);

  const now = new Date();
  const data = subscriptions.map((sub) => ({
    ...sub,
    isActive: sub.status === "paid" && sub.endDate && new Date(sub.endDate) > now
  }));

  const statusSummary = statusCounts.reduce(
    (acc, item) => {
      acc[item._id] = item.count;
      return acc;
    },
    { created: 0, paid: 0, failed: 0 }
  );

  return {
    data,
    meta: {
      total: totalCount,
      page: pageNumber,
      limit: pageLimit,
      totalPages: Math.ceil(totalCount / pageLimit) || 1,
      sortBy: sortField,
      sortOrder: sortDirection === 1 ? "asc" : "desc"
    },
    summary: statusSummary
  };
};

/* ----------------------------- Webhook -------------------------------- */

const processSubscriptionWebhookEvent = async ({ event, paymentEntity, webhookSignature }) => {
  if (!paymentEntity || !paymentEntity.order_id) {
    return null;
  }

  const orderId = paymentEntity.order_id;
  const subscription = await Subscription.findOne({ orderId });
  if (!subscription) {
    console.warn("[Subscription] Webhook for unknown order", { orderId, event });
    return null;
  }

  const status = paymentEntity.status;

  if ((event === "payment.captured" || status === "captured") && subscription.status !== "paid") {
    subscription.status = "paid";
    subscription.paymentId = paymentEntity.id;
    subscription.signature = webhookSignature;
    await applyActiveSubscription(subscription);
    await subscription.save();
    console.info("[Subscription] Webhook marked paid", { orderId });
  } else if ((event === "payment.failed" || status === "failed") && subscription.status !== "paid") {
    subscription.status = "failed";
    subscription.paymentId = paymentEntity.id;
    await subscription.save();
    console.info("[Subscription] Webhook marked failed", { orderId });
  }

  return subscription;
};

module.exports = {
  listActivePlans,
  listAllPlans,
  createPlan,
  updatePlan,
  deletePlan,
  createSubscriptionOrder,
  verifySubscriptionPayment,
  getUserSubscription,
  listSubscriptions,
  processSubscriptionWebhookEvent
};
