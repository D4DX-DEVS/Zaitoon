const axios = require("axios");

/**
 * Send a simple broadcast push notification via OneSignal
 * This uses the app-level REST API key and app id from env.
 *
 * @param {Object} params
 * @param {string} params.title
 * @param {string} params.message
 * @param {Object} [params.data]
 * @param {string} [params.imageUrl] - Optional image URL for rich notification
 */
async function sendPushNotification({ title, message, data = {}, imageUrl }) {
  const appId = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!appId || !apiKey) {
    throw new Error("OneSignal credentials are not configured");
  }

  const url = "https://api.onesignal.com/notifications";

  const payload = {
    app_id: appId,
    included_segments: ["All"], // send to all subscribed users in this app
    headings: { en: title || "Notification" },
    contents: { en: message || "" },
    data,
  };

  if (imageUrl) {
    // Validate that imageUrl is a proper URL
    if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
      console.warn('⚠️  Image URL does not start with http(s):', imageUrl);
    }
    
    console.log('🖼️  Including image in notification:', imageUrl);
    
    // Android - requires both big_picture and large_icon
    payload.big_picture = imageUrl;
    payload.large_icon = imageUrl;
    
    // iOS - CRITICAL settings for images to work
    payload.mutable_content = true; // Required for iOS to process attachments
    payload.ios_attachments = { id1: imageUrl };
    payload.ios_badgeType = "Increase";
    payload.ios_badgeCount = 1;
    
    // Web platforms
    payload.chrome_web_image = imageUrl;
    payload.firefox_icon = imageUrl;
    payload.chrome_big_picture = imageUrl;
  }

  try {
    console.log('📤 OneSignal payload:', JSON.stringify(payload, null, 2));
    const res = await axios.post(url, payload, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${apiKey}`,
      },
    });

    return res.data;
  } catch (error) {
    const msg =
      error?.response?.data?.errors ||
      error?.response?.data ||
      error?.message ||
      "Failed to send notification";
    throw new Error(
      typeof msg === "string" ? msg : JSON.stringify(msg)
    );
  }
}

/**
 * Send a push notification when new content is added.
 * Non-blocking — errors are logged but do not throw.
 *
 * @param {Object} params
 * @param {string} params.contentType - "story"|"video"|"coloring"|"brightbox"|"notice"
 * @param {string} params.contentId - MongoDB ObjectId of the created content
 * @param {string} params.title - Content title (used as notification heading)
 * @param {string} [params.message] - Notification body text
 * @param {string} [params.imageUrl] - Cover/thumbnail image URL
 * @param {Object} [params.extraData] - Additional navigation data (e.g. storyId, seasonId)
 */
async function sendContentNotification({ contentType, contentId, title, message, imageUrl, extraData = {} }) {
  try {
    console.log(`📢 Sending content notification for ${contentType}: ${contentId}, title: "${title}"`);

    const notificationTitle = title || "New content added!";
    const notificationMessage = message || `Check out the new ${contentType}: ${title}`;

    const data = {
      contentType,
      contentId: String(contentId),
      ...extraData,
    };

    const result = await sendPushNotification({
      title: notificationTitle,
      message: notificationMessage,
      data,
      imageUrl: imageUrl || undefined,
    });

    console.log(`✅ Push notification sent for ${contentType}: ${contentId}`, result);
  } catch (error) {
    // Non-blocking: log error but don't throw
    console.error(`⚠️  Failed to send push notification for ${contentType} ${contentId}:`, error.message);
  }
}

module.exports = {
  sendPushNotification,
  sendContentNotification,
};

