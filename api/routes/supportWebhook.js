const express = require("express");
const { handleSupportWebhook } = require("../controllers/supportController");

const router = express.Router();

router.post("/", handleSupportWebhook);

module.exports = router;


