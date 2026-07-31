const crypto = require("crypto");
const {
  createSupportOrder,
  verifySupportPayment,
  listSupportPayments,
  processSupportWebhookEvent
} = require("../services/supportPaymentService");

const createSupportPaymentOrder = async (req, res) => {
  try {
    const { name, email, phone, amount, message } = req.body;

    console.info("[SupportPayment] create-order request", {
      name,
      email,
      phone,
      amount
    });

    const { order, supportPayment } = await createSupportOrder({
      name,
      email,
      phone,
      amount,
      message
    });

    return res.status(201).json({
      success: true,
      message: "Support order created successfully",
      data: {
        keyId: process.env.RAZORPAY_KEY_ID,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        supportPaymentId: supportPayment._id
      }
    });
  } catch (error) {
    console.error("[SupportPayment] create-order error", {
      message: error.message,
      stack: error.stack
    });

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to create support order"
    });
  }
};

const verifySupportPaymentHandler = async (req, res) => {
  try {
    const {
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: razorpaySignature
    } = req.body;

    console.info("[SupportPayment] verify request", {
      razorpayOrderId,
      razorpayPaymentId
    });

    const supportPayment = await verifySupportPayment({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    });

    return res.status(200).json({
      success: true,
      message: "Support payment verified successfully",
      data: {
        supportPaymentId: supportPayment._id
      }
    });
  } catch (error) {
    console.error("[SupportPayment] verify error", {
      message: error.message,
      stack: error.stack
    });

    return res.status(400).json({
      success: false,
      message: error.message || "Support payment verification failed"
    });
  }
};

const getSupportPaymentsAdmin = async (req, res) => {
  try {
    const {
      status,
      search,
      page,
      limit,
      sortBy,
      sortOrder
    } = req.query;

    console.info("[SupportPayment] admin list request", {
      status,
      search,
      page,
      limit,
      sortBy,
      sortOrder
    });

    const result = await listSupportPayments({
      status,
      search,
      page,
      limit,
      sortBy,
      sortOrder
    });

    return res.status(200).json({
      success: true,
      message: "Support payments fetched successfully",
      data: result.data,
      meta: result.meta,
      summary: result.summary
    });
  } catch (error) {
    console.error("[SupportPayment] admin list error", {
      message: error.message,
      stack: error.stack
    });

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch support payments"
    });
  }
};

const handleSupportWebhook = async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("[SupportPayment] Webhook secret not configured");
      return res.status(500).json({
        success: false,
        message: "Webhook secret not configured"
      });
    }

    const signature = req.get("x-razorpay-signature");
    const rawBody = req.body;

    if (!signature || !rawBody || !rawBody.length) {
      return res.status(400).json({
        success: false,
        message: "Invalid webhook payload"
      });
    }

    const computedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    if (computedSignature !== signature) {
      console.warn("[SupportPayment] Webhook signature mismatch");
      return res.status(400).json({
        success: false,
        message: "Invalid webhook signature"
      });
    }

    const payload = JSON.parse(rawBody.toString());
    const event = payload?.event;
    const paymentEntity = payload?.payload?.payment?.entity;

    await processSupportWebhookEvent({
      event,
      paymentEntity,
      webhookSignature: signature,
      rawPayload: payload
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("[SupportPayment] Webhook processing error", {
      message: error.message,
      stack: error.stack
    });

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to process webhook"
    });
  }
};

module.exports = {
  createSupportPaymentOrder,
  verifySupportPaymentHandler,
  getSupportPaymentsAdmin,
  handleSupportWebhook
};

