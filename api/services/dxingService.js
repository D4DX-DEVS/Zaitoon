const axios = require("axios");

const DIAG = process.env.DXING_DIAG === "1";

function getDxingApiUrl() {
  const url = (process.env.DXING_API_URL || "").trim();
  if (!url) throw new Error("DXING_API_URL is not set in .env");
  return url;
}

const dxingAxios = axios.create({ timeout: 10000 });

if (DIAG) {
  dxingAxios.interceptors.request.use((config) => {
    const safePaylod = { ...config.data, secret: "[REDACTED]" };
    console.log("[Dxing] REQUEST →", config.url, JSON.stringify(safePaylod));
    return config;
  });

  dxingAxios.interceptors.response.use(
    (res) => {
      console.log("[Dxing] RESPONSE ←", res.status, JSON.stringify(res.data));
      return res;
    },
    (err) => {
      console.error("[Dxing] ERROR ←", err.response?.status, JSON.stringify(err.response?.data));
      return Promise.reject(err);
    }
  );
}

function normalizeIndianPhone(input) {
  if (!input) throw new Error("Phone number is required");
  const digits = String(input).replace(/\D/g, "");
  // Strip leading 91 if the number is 12 digits and starts with 91
  const local = digits.startsWith("91") && digits.length === 12 ? digits.slice(2) : digits;
  if (local.length !== 10) {
    throw new Error(`Invalid phone number: expected 10 digits, got ${local.length} (input: ${input})`);
  }
  return "91" + local;
}

function validateCredentials() {
  const account = (process.env.DXING_ACCOUNT || "").trim();
  const secret = (process.env.DXING_SECRET || "").trim();
  if (!account || account.length < 4) throw new Error("DXING_ACCOUNT is missing or too short");
  if (!secret || secret.length < 4) throw new Error("DXING_SECRET is missing or too short");
  return { account, secret };
}

async function sendWhatsAppMessage(phone, message) {
  const { account, secret } = validateCredentials();
  const to = normalizeIndianPhone(phone);

  const payload = { secret, account, recipient: to, type: "text", message };

  let lastError;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await dxingAxios.post(getDxingApiUrl(), payload, {
        headers: { "Content-Type": "application/json" }
      });

      if (response.data?.status !== 200 && response.data?.status !== "200") {
        throw new Error(`Dxing returned non-200 status: ${JSON.stringify(response.data)}`);
      }

      return response.data;
    } catch (err) {
      lastError = err;
      const statusCode = err.response?.status;
      // Only retry on 5xx server errors
      if (attempt < 2 && statusCode >= 500) {
        console.warn(`[Dxing] 5xx error on attempt ${attempt}, retrying...`);
        continue;
      }
      break;
    }
  }

  throw lastError;
}

async function sendApprovalMessage(phone, kidName) {
  const message =
    `Hi! 👋\n\n` +
    `🎉 Great news! *${kidName}*'s submission has been *Approved* by the Zaitoon team! ✅\n\n` +
    `We loved the work and it will be featured on the Zaitoon platform. Thank you for being part of our creative community! 🌟\n\n` +
    `— *Zaitoon Team* 💜`;
  return sendWhatsAppMessage(phone, message);
}

async function sendRemarksMessage(phone, kidName, remarks) {
  const message =
    `Hi! 👋\n\n` +
    `Thank you for submitting *${kidName}*'s work to *Zaitoon*! 🌟\n\n` +
    `Our team has reviewed the submission and has some suggestions to help improve it:\n\n` +
    `📝 *Suggestions:*\n${remarks.trim()}\n\n` +
    `Feel free to make the changes and resubmit anytime. We look forward to seeing the updated work! 😊\n\n` +
    `— *Zaitoon Team* 💜`;
  return sendWhatsAppMessage(phone, message);
}

module.exports = { sendApprovalMessage, sendRemarksMessage };
