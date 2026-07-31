const crypto = require("crypto");
const SupportPayment = require("../models/supportPayment");
const { getRazorpayInstance } = require("../utils/razorpay");

const createSupportOrder = async ({
  name,
  email,
  phone,
  amount,
  message
}) => {
  if (!name || !email) {
    throw new Error("Name and email are required for support payment");
  }

  if (!amount || Number.isNaN(Number(amount))) {
    throw new Error("A valid support amount is required");
  }

  const amountInPaise = Math.round(Number(amount) * 100);
  if (amountInPaise < 100) {
    throw new Error("Minimum support amount is ₹1");
  }

  const razorpay = getRazorpayInstance();

  console.info("[SupportPayment] Creating Razorpay order", {
    name,
    email,
    phone,
    amountInPaise
  });

  const order = await razorpay.orders.create({
    amount: amountInPaise,
    currency: "INR",
    receipt: `support_${Date.now()}`,
    notes: {
      supporter_name: name,
      supporter_email: email,
      supporter_phone: phone || "",
      supporter_message: message || ""
    }
  });

  console.info("[SupportPayment] Razorpay order created", {
    orderId: order.id,
    amount: order.amount
  });

  const supportPayment = await SupportPayment.create({
    name,
    email,
    phone,
    amount: order.amount,
    currency: order.currency,
    message,
    status: "created",
    orderId: order.id,
    metadata: order.notes
  });

  return {
    order,
    supportPayment
  };
};

const verifySupportPayment = async ({
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature
}) => {
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    throw new Error("Invalid Razorpay verification payload");
  }

  const supportPayment = await SupportPayment.findOne({ orderId: razorpayOrderId });

  if (!supportPayment) {
    throw new Error("Support payment order not found");
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    throw new Error("Razorpay secret is not configured");
  }

  const hmac = crypto.createHmac("sha256", keySecret);
  hmac.update(`${razorpayOrderId}|${razorpayPaymentId}`);
  const generatedSignature = hmac.digest("hex");

  const isSignatureValid = generatedSignature === razorpaySignature;

  if (!isSignatureValid) {
    supportPayment.status = "failed";
    supportPayment.paymentId = razorpayPaymentId;
    supportPayment.signature = razorpaySignature;
    await supportPayment.save();

    throw new Error("Razorpay signature verification failed");
  }

  supportPayment.status = "paid";
  supportPayment.paymentId = razorpayPaymentId;
  supportPayment.signature = razorpaySignature;
  await supportPayment.save();

  console.info("[SupportPayment] Razorpay payment verified", {
    orderId: razorpayOrderId,
    paymentId: razorpayPaymentId
  });

  return supportPayment;
};

const listSupportPayments = async ({
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
      { name: regex },
      { email: regex },
      { phone: regex },
      { orderId: regex },
      { paymentId: regex }
    ];
  }

  const sortDirection = sortOrder === "asc" ? 1 : -1;
  const sortField = ["name", "email", "amount", "status", "createdAt"].includes(sortBy)
    ? sortBy
    : "createdAt";

  const [payments, totalCount, statusCounts] = await Promise.all([
    SupportPayment.find(filters)
      .sort({ [sortField]: sortDirection })
      .skip(skip)
      .limit(pageLimit)
      .lean(),
    SupportPayment.countDocuments(filters),
    SupportPayment.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ])
  ]);

  const statusSummary = statusCounts.reduce((acc, item) => {
    acc[item._id] = item.count;
    return acc;
  }, { created: 0, paid: 0, failed: 0 });

  return {
    data: payments,
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

const appendMetadata = (supportPayment, key, value) => {
  const metadata = supportPayment.metadata || {};
  metadata[key] = value;
  supportPayment.metadata = metadata;
};

const processSupportWebhookEvent = async ({
  event,
  paymentEntity,
  webhookSignature,
  rawPayload
}) => {
  if (!paymentEntity || !paymentEntity.order_id) {
    return null;
  }

  const orderId = paymentEntity.order_id;
  const paymentId = paymentEntity.id;
  const status = paymentEntity.status;

  const supportPayment = await SupportPayment.findOne({ orderId });

  if (!supportPayment) {
    console.warn("[SupportPayment] Webhook received for unknown order", {
      orderId,
      event
    });
    return null;
  }

  appendMetadata(supportPayment, "lastWebhookEvent", {
    event,
    paymentId,
    status,
    receivedAt: new Date().toISOString(),
    webhookSignature
  });

  appendMetadata(supportPayment, "lastWebhookPayload", rawPayload);

  if (event === "payment.captured" || status === "captured") {
    if (supportPayment.status !== "paid") {
      supportPayment.status = "paid";
      supportPayment.paymentId = paymentId;
      supportPayment.signature = webhookSignature;
      await supportPayment.save();

      console.info("[SupportPayment] Webhook marked payment as paid", {
        orderId,
        paymentId
      });
    }

  } else if (event === "payment.failed" || status === "failed") {
    if (supportPayment.status !== "paid") {
      supportPayment.status = "failed";
      supportPayment.paymentId = paymentId;
      await supportPayment.save();

      console.info("[SupportPayment] Webhook marked payment as failed", {
        orderId,
        paymentId
      });
    }
  } else {
    await supportPayment.save();
  }

  return supportPayment;
};

const reconcilePendingSupportPayments = async ({
  maxAgeMinutes = Number(process.env.SUPPORT_PAYMENT_PENDING_THRESHOLD_MINUTES) || 10,
  batchSize = Number(process.env.SUPPORT_PAYMENT_RECON_BATCH_SIZE) || 25
} = {}) => {
  const thresholdDate = new Date(Date.now() - maxAgeMinutes * 60 * 1000);

  const pendingPayments = await SupportPayment.find({
    status: "created",
    createdAt: { $lte: thresholdDate }
  })
    .sort({ createdAt: 1 })
    .limit(batchSize);

  if (!pendingPayments.length) {
    return { processed: 0, updated: 0 };
  }

  const razorpay = getRazorpayInstance();
  let updated = 0;

  for (const supportPayment of pendingPayments) {
    try {
      const paymentsResponse = await razorpay.orders.fetchPayments(supportPayment.orderId);
      const paymentItems = paymentsResponse?.items || [];

      if (!paymentItems.length) {
        continue;
      }

      const capturedPayment = paymentItems.find((item) => item.status === "captured");
      const failedPayment = paymentItems.find((item) => item.status === "failed");

      if (capturedPayment) {
        supportPayment.status = "paid";
        supportPayment.paymentId = capturedPayment.id;
        appendMetadata(supportPayment, "reconciledBy", "scheduler");
        appendMetadata(supportPayment, "lastReconciledAt", new Date().toISOString());
        await supportPayment.save();
        updated += 1;

        console.info("[SupportPayment] Reconciled pending payment as paid", {
          orderId: supportPayment.orderId,
          paymentId: capturedPayment.id
        });

        continue;
      }

      if (failedPayment) {
        supportPayment.status = "failed";
        supportPayment.paymentId = failedPayment.id;
        appendMetadata(supportPayment, "reconciledBy", "scheduler");
        appendMetadata(supportPayment, "lastReconciledAt", new Date().toISOString());
        await supportPayment.save();
        updated += 1;

        console.info("[SupportPayment] Reconciled pending payment as failed", {
          orderId: supportPayment.orderId,
          paymentId: failedPayment.id
        });
      }
    } catch (error) {
      console.error("[SupportPayment] Failed to reconcile pending payment", {
        orderId: supportPayment.orderId,
        error: error.message
      });
    }
  }

  return {
    processed: pendingPayments.length,
    updated
  };
};

module.exports = {
  createSupportOrder,
  verifySupportPayment,
  listSupportPayments,
  processSupportWebhookEvent,
  reconcilePendingSupportPayments
};

