const express = require("express");

const {
  createSupportPaymentOrder,
  verifySupportPaymentHandler,
  getSupportPaymentsAdmin
} = require("../controllers/supportController");
const { authenticateAdmin } = require("../middleware/auth");

const router = express.Router();

router.post("/support/create-order", createSupportPaymentOrder);
router.post("/support/verify", verifySupportPaymentHandler);
router.get("/support", authenticateAdmin, getSupportPaymentsAdmin);

module.exports = router;

