const crypto = require("crypto");
const {
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
} = require("../services/subscriptionService");

/* ------------------------------- App ---------------------------------- */

const getPlans = async (req, res) => {
  try {
    const plans = await listActivePlans();
    return res.status(200).json({
      success: true,
      message: "Subscription plans fetched successfully",
      data: plans
    });
  } catch (error) {
    console.error("[Subscription] getPlans error", { message: error.message });
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch subscription plans"
    });
  }
};

const createOrder = async (req, res) => {
  try {
    const { planId } = req.body;
    const userId = req.userId;

    const { order, plan, subscription } = await createSubscriptionOrder({ userId, planId });

    return res.status(201).json({
      success: true,
      message: "Subscription order created successfully",
      data: {
        keyId: process.env.RAZORPAY_KEY_ID,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        planName: plan.name,
        subscriptionId: subscription._id
      }
    });
  } catch (error) {
    console.error("[Subscription] createOrder error", { message: error.message });
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to create subscription order"
    });
  }
};

const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: razorpaySignature
    } = req.body;

    const subscription = await verifySubscriptionPayment({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    });

    return res.status(200).json({
      success: true,
      message: "Subscription payment verified successfully",
      data: {
        subscriptionId: subscription._id,
        planName: subscription.planName,
        endDate: subscription.endDate
      }
    });
  } catch (error) {
    console.error("[Subscription] verifyPayment error", { message: error.message });
    return res.status(400).json({
      success: false,
      message: error.message || "Subscription payment verification failed"
    });
  }
};

const getMySubscription = async (req, res) => {
  try {
    const result = await getUserSubscription(req.userId);
    return res.status(200).json({
      success: true,
      message: "Subscription status fetched successfully",
      data: result
    });
  } catch (error) {
    console.error("[Subscription] getMySubscription error", { message: error.message });
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch subscription status"
    });
  }
};

/* ------------------------------ Admin --------------------------------- */

const adminGetPlans = async (req, res) => {
  try {
    const plans = await listAllPlans();
    return res.status(200).json({
      success: true,
      message: "Subscription plans fetched successfully",
      data: plans
    });
  } catch (error) {
    console.error("[Subscription] adminGetPlans error", { message: error.message });
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch subscription plans"
    });
  }
};

const adminCreatePlan = async (req, res) => {
  try {
    const plan = await createPlan(req.body);
    return res.status(201).json({
      success: true,
      message: "Subscription plan created successfully",
      data: plan
    });
  } catch (error) {
    console.error("[Subscription] adminCreatePlan error", { message: error.message });
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to create subscription plan"
    });
  }
};

const adminUpdatePlan = async (req, res) => {
  try {
    const plan = await updatePlan(req.params.id, req.body);
    return res.status(200).json({
      success: true,
      message: "Subscription plan updated successfully",
      data: plan
    });
  } catch (error) {
    console.error("[Subscription] adminUpdatePlan error", { message: error.message });
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to update subscription plan"
    });
  }
};

const adminDeletePlan = async (req, res) => {
  try {
    await deletePlan(req.params.id);
    return res.status(200).json({
      success: true,
      message: "Subscription plan deleted successfully"
    });
  } catch (error) {
    console.error("[Subscription] adminDeletePlan error", { message: error.message });
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to delete subscription plan"
    });
  }
};

const adminListSubscriptions = async (req, res) => {
  try {
    const { status, search, page, limit, sortBy, sortOrder } = req.query;
    const result = await listSubscriptions({ status, search, page, limit, sortBy, sortOrder });

    return res.status(200).json({
      success: true,
      message: "Subscriptions fetched successfully",
      data: result.data,
      meta: result.meta,
      summary: result.summary
    });
  } catch (error) {
    console.error("[Subscription] adminListSubscriptions error", { message: error.message });
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch subscriptions"
    });
  }
};

/* ------------------------------ Webhook ------------------------------- */

const handleWebhook = async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return res.status(500).json({ success: false, message: "Webhook secret not configured" });
    }

    const signature = req.get("x-razorpay-signature");
    const rawBody = req.body;

    if (!signature || !rawBody || !rawBody.length) {
      return res.status(400).json({ success: false, message: "Invalid webhook payload" });
    }

    const computedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    if (computedSignature !== signature) {
      console.warn("[Subscription] Webhook signature mismatch");
      return res.status(400).json({ success: false, message: "Invalid webhook signature" });
    }

    const payload = JSON.parse(rawBody.toString());
    await processSubscriptionWebhookEvent({
      event: payload?.event,
      paymentEntity: payload?.payload?.payment?.entity,
      webhookSignature: signature
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("[Subscription] Webhook processing error", { message: error.message });
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to process webhook"
    });
  }
};

module.exports = {
  getPlans,
  createOrder,
  verifyPayment,
  getMySubscription,
  adminGetPlans,
  adminCreatePlan,
  adminUpdatePlan,
  adminDeletePlan,
  adminListSubscriptions,
  handleWebhook
};
