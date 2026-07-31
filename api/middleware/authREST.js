/**
 * ALTERNATIVE: Firebase Token Verification using REST API
 * 
 * ⚠️ NOT RECOMMENDED - Use auth.js with Firebase Admin SDK instead
 * 
 * This is shown for comparison only. Use Firebase Admin SDK for production.
 */

const jwt = require("jsonwebtoken");
const User = require("../models/user");
const axios = require("axios");

// Helper function to extract token from request
const extractToken = (req) => {
  const authHeader = req.header("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return null;
};

/**
 * Verify Firebase token using REST API (slower, less secure)
 * Requires FIREBASE_API_KEY in .env
 */
async function verifyFirebaseTokenREST(token) {
  try {
    const apiKey = process.env.FIREBASE_API_KEY;
    if (!apiKey) {
      throw new Error("FIREBASE_API_KEY not configured");
    }

    console.log("[AUTH-REST] Calling Firebase REST API with API key:", apiKey.substring(0, 10) + "...");
    
    const response = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        idToken: token
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 second timeout
      }
    );

    if (response.data && response.data.users && response.data.users.length > 0) {
      const userInfo = response.data.users[0];
      console.log("[AUTH-REST] Firebase user found:", userInfo.localId);
      return {
        uid: userInfo.localId,
        email: userInfo.email,
        emailVerified: userInfo.emailVerified || false,
        name: userInfo.displayName || userInfo.email?.split('@')[0] || 'User',
      };
    }

    throw new Error("Invalid token response - no users found");
  } catch (error) {
    if (error.response) {
      console.error("[AUTH-REST] Firebase API error response:", error.response.status, error.response.data);
      if (error.response.status === 400) {
        const errorMessage = error.response.data?.error?.message || "Invalid or expired Firebase token";
        throw new Error(errorMessage);
      }
      if (error.response.status === 401) {
        throw new Error("Invalid Firebase API key");
      }
    }
    if (error.code === 'ECONNABORTED') {
      throw new Error("Firebase API request timeout");
    }
    throw error;
  }
}

/**
 * Hybrid Authentication using REST API for Firebase tokens
 * ⚠️ Slower than SDK approach - adds 50-200ms latency per request
 */
const authenticateHybridREST = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Please provide a Firebase ID token in Authorization header."
      });
    }

    console.log("[AUTH-REST] Token received (length):", token.length);
    console.log("[AUTH-REST] Token preview:", token.substring(0, 50) + "...");

    // Check if FIREBASE_API_KEY is configured
    const apiKey = process.env.FIREBASE_API_KEY;
    if (!apiKey) {
      console.error("[AUTH-REST] ❌ FIREBASE_API_KEY not configured in .env");
      return res.status(500).json({
        success: false,
        message: "Firebase API key not configured. Please check server configuration."
      });
    }

    // Try Firebase token verification via REST API
    try {
      console.log("[AUTH-REST] Verifying token with Firebase REST API...");
      const decodedToken = await verifyFirebaseTokenREST(token);
      console.log("[AUTH-REST] ✅ Firebase token verified - UID:", decodedToken.uid, "Email:", decodedToken.email);
      const firebaseUid = decodedToken.uid;
      const email = decodedToken.email;
      const name = decodedToken.name;

      // Find or create user in MongoDB
      let user = await User.findOne({ firebaseUid });
      
      if (!user && email) {
        user = await User.findOne({ email: email.toLowerCase() });
        if (user) {
          user.firebaseUid = firebaseUid;
          await user.save();
        }
      }
      
      if (!user) {
        // Ensure name is not empty
        const userName = name || email?.split('@')[0] || 'User';
        const userEmail = email?.toLowerCase() || `${firebaseUid}@firebase.local`;
        
        user = new User({
          firebaseUid,
          email: userEmail,
          name: userName,
          class: "Default",
        });
        
        try {
          await user.save();
        } catch (saveError) {
          console.error("[AUTH-REST] Error saving user:", saveError);
          // If duplicate key error, try to find user again
          if (saveError.code === 11000) {
            user = await User.findOne({ firebaseUid }) || await User.findOne({ email: userEmail });
          } else {
            throw saveError;
          }
        }
      }

      req.user = {
        id: user._id,
        firebaseUid: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name,
      };
      // Ensure userId is set as string or ObjectId (Mongoose handles both)
      req.userId = user._id.toString ? user._id.toString() : user._id;
      req.userDoc = user;
      console.log("[AUTH-REST] ✅ User authenticated - MongoDB ID:", req.userId, "Firebase UID:", firebaseUid);
      return next();
    } catch (firebaseError) {
      console.log("[AUTH-REST] ❌ Firebase REST verification failed:", firebaseError.message);
      console.log("[AUTH-REST] Error details:", firebaseError.response?.data || firebaseError.message);
      console.error("[AUTH-REST] Full error stack:", firebaseError.stack);
      
      // Check if it's a Firebase API key issue
      if (firebaseError.message.includes("FIREBASE_API_KEY not configured")) {
        return res.status(500).json({
          success: false,
          message: "Firebase API key not configured. Please check server configuration."
        });
      }
      
      // If Firebase verification fails, try JWT (for admin panel)
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        const userId = decoded.userId || decoded.id || decoded._id;
        
        if (!userId) {
          return res.status(401).json({
            success: false,
            message: "Invalid token. User information not found."
          });
        }

        const user = await User.findById(userId);
        if (!user) {
          return res.status(404).json({
            success: false,
            message: "User not found."
          });
        }

        req.user = decoded;
        req.userId = userId;
        req.userDoc = user;
        
        if (decoded.role === 'admin') {
          req.admin = decoded;
        }
        
        return next();
      } catch (jwtError) {
        console.error("[AUTH] Both Firebase REST and JWT verification failed");
        console.error("[AUTH] Firebase error:", firebaseError.message);
        console.error("[AUTH] JWT error:", jwtError.message);
        
        // Return more specific error message
        return res.status(401).json({
          success: false,
          message: "Invalid or expired token. Please ensure you're using a valid Firebase ID token from your Flutter app.",
          error: process.env.NODE_ENV === 'development' ? firebaseError.message : undefined
        });
      }
    }
  } catch (error) {
    console.error("[AUTH] REST authentication error:", error);
    console.error("[AUTH] Error stack:", error.stack);
    return res.status(500).json({
      success: false,
      message: "Authentication service error.",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  authenticateHybridREST
};
