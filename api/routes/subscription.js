const express = require("express");

const {
  getPlans,
  createOrder,
  verifyPayment,
  getMySubscription,
  adminGetPlans,
  adminCreatePlan,
  adminUpdatePlan,
  adminDeletePlan,
  adminListSubscriptions
} = require("../controllers/subscriptionController");
const { authenticateFirebaseToken, authenticateAdmin } = require("../middleware/auth");

const router = express.Router();

// App (Flutter) endpoints
router.get("/plans", getPlans);
router.post("/create-order", authenticateFirebaseToken, createOrder);
router.post("/verify", authenticateFirebaseToken, verifyPayment);
router.get("/me", authenticateFirebaseToken, getMySubscription);

// Admin endpoints
router.get("/admin/plans", authenticateAdmin, adminGetPlans);
router.post("/admin/plans", authenticateAdmin, adminCreatePlan);
router.put("/admin/plans/:id", authenticateAdmin, adminUpdatePlan);
router.delete("/admin/plans/:id", authenticateAdmin, adminDeletePlan);
router.get("/admin/list", authenticateAdmin, adminListSubscriptions);

module.exports = router;
