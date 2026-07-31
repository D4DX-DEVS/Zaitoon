const express = require("express");
const { handleWebhook } = require("../controllers/subscriptionController");

const router = express.Router();

// Mounted with express.raw() in server.js so the signature can be verified
// against the exact raw request body.
router.post("/", handleWebhook);

module.exports = router;
