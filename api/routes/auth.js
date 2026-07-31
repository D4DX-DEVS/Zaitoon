const express = require("express");
const jwt = require("jsonwebtoken");
const admin = require("../config/firebaseAdmin");
const axios = require("axios");
const User = require("../models/user");

const router = express.Router();

/**
 * Verify a Firebase ID token using REST API (fallback when Admin SDK is not configured).
 * Uses the same approach as authREST.js.
 */
async function verifyFirebaseTokenREST(token) {
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) throw new Error("FIREBASE_API_KEY not configured");
  const response = await axios.post(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    { idToken: token },
    { headers: { "Content-Type": "application/json" }, timeout: 10000 }
  );
  const users = response.data?.users;
  if (!users || users.length === 0) throw new Error("Invalid token - no user found");
  const u = users[0];
  return {
    uid: u.localId,
    email: u.email || null,
    name: u.displayName || u.email?.split("@")[0] || "User",
  };
}

/**
 * POST /api/auth/firebase
 * Exchange a Firebase ID token for an API JWT.
 * The Flutter app calls this after Firebase sign-in to get a long-lived API token.
 *
 * Body: { firebaseIdToken: string }
 * Response: { success: true, data: { token, user: { id, name, email, class } } }
 */
router.post("/firebase", async (req, res) => {
  try {
    const { firebaseIdToken } = req.body;

    if (!firebaseIdToken) {
      return res.status(400).json({
        success: false,
        message: "firebaseIdToken is required in request body."
      });
    }

    // Verify the Firebase ID token — try Admin SDK first, fall back to REST API
    let decodedToken;
    try {
      if (admin.apps.length > 0) {
        decodedToken = await admin.auth().verifyIdToken(firebaseIdToken);
        console.log("[auth/firebase] Admin SDK verified UID:", decodedToken.uid);
      } else {
        decodedToken = await verifyFirebaseTokenREST(firebaseIdToken);
        console.log("[auth/firebase] REST API verified UID:", decodedToken.uid);
      }
    } catch (firebaseError) {
      console.error("[auth/firebase] Token verification failed:", firebaseError.message);
      const isExpired = firebaseError.code === "auth/id-token-expired" ||
        String(firebaseError.message).includes("EXPIRED");
      return res.status(401).json({
        success: false,
        message: isExpired
          ? "Firebase token has expired. Please sign in again."
          : "Invalid Firebase token."
      });
    }

    const firebaseUid = decodedToken.uid;
    const email = decodedToken.email || `${firebaseUid}@firebase.local`;
    const name = decodedToken.name || email.split("@")[0] || "User";

    // Find or create user in MongoDB
    let user = await User.findOne({ firebaseUid });

    if (!user) {
      // Try to find by email first
      if (decodedToken.email) {
        user = await User.findOne({ email: decodedToken.email.toLowerCase() });
        if (user) {
          user.firebaseUid = firebaseUid;
          await user.save();
        }
      }

      // Create new user if still not found
      if (!user) {
        user = new User({
          firebaseUid,
          name,
          email: email.toLowerCase(),
          class: "Default",
          growthActivity: {
            readingStreak: { current: 0, longest: 0, lastActiveDate: null },
            booksRead: 0,
            achievements: [],
            completedBooks: [],
            hadStreakBeforeReset: false
          }
        });
        await user.save();
      }
    }

    // Update name if it was set to the auto-created placeholder
    if (user.name === "New User" && name && name !== "New User") {
      user.name = name;
      await user.save();
      console.log("[AUTH /firebase] Updated placeholder name to:", name);
    }

    // Issue API JWT (7 day expiry)
    const apiToken = jwt.sign(
      {
        userId: user._id.toString(),
        firebaseUid: user.firebaseUid,
        email: user.email,
        role: "user"
      },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      success: true,
      message: "Token exchange successful.",
      data: {
        token: apiToken,
        user: {
          id: user._id.toString(),
          firebaseUid: user.firebaseUid,
          name: user.name,
          email: user.email,
          class: user.class
        }
      }
    });
  } catch (error) {
    console.error("[auth/firebase] Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Authentication service error. Please try again."
    });
  }
});

module.exports = router;
