const jwt = require("jsonwebtoken");
const axios = require("axios");
const User = require("../models/user");
const admin = require("../config/firebaseAdmin");

// Verify Firebase token via REST API (used when Admin SDK is not configured)
async function verifyFirebaseTokenViaREST(token) {
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) throw new Error("FIREBASE_API_KEY not set");
  const response = await axios.post(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    { idToken: token },
    { headers: { "Content-Type": "application/json" }, timeout: 10000 }
  );
  const users = response.data?.users;
  if (!users || users.length === 0) throw new Error("No user found in Firebase REST response");
  const u = users[0];
  return { uid: u.localId, email: u.email, email_verified: u.emailVerified, name: u.displayName };
}

// Helper function to extract token from request
const extractToken = (req) => {
  const authHeader = req.header("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return null;
};

// Authentication middleware for admin routes (authenticateToken)
const authenticateToken = (req, res, next) => {
  console.log("[AUTH] Admin authentication check - Path:", req.path, "| Method:", req.method);
  try {
    const authHeader = req.header("Authorization");
    console.log("[AUTH] Authorization header present:", !!authHeader);
    console.log("[AUTH] Authorization header value:", authHeader ? (authHeader.substring(0, 20) + "...") : "null");
    
    const token = extractToken(req);
    console.log("[AUTH] Token extracted:", !!token);
    console.log("[AUTH] Token length:", token ? token.length : 0);

    if (!token) {
      console.error("[AUTH] ERROR: No token found in request");
      console.log("[AUTH] Available headers:", Object.keys(req.headers));
      return res.status(401).json({
        success: false,
        message: "Authentication required. Please provide a valid token."
      });
    }

    // Verify token
    let decoded;
    try {
      const secret = process.env.JWT_SECRET || 'your-secret-key';
      console.log("[AUTH] Verifying token with secret (length):", secret ? secret.length : 0);
      decoded = jwt.verify(token, secret);
      console.log("[AUTH] Token verified successfully");
      console.log("[AUTH] Decoded token - Role:", decoded.role, "| User ID:", decoded.userId || decoded.id || decoded._id);
    } catch (error) {
      console.error("[AUTH] Token verification failed:", error.name, "-", error.message);
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: "Your session has expired. Please login again."
        });
      } else if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: "Invalid authentication token."
        });
      } else {
        throw error;
      }
    }
    
    // Check if user is admin
    console.log("[AUTH] Checking admin role - Decoded role:", decoded.role);
    if (decoded.role !== 'admin') {
      console.error("[AUTH] ERROR: User is not admin - Role:", decoded.role);
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin privileges required."
      });
    }

    // Add admin info to request object
    req.admin = decoded;
    req.user = decoded; // Also add as user for consistency
    req.userId = decoded.userId || decoded.id || decoded._id;
    console.log("[AUTH] Authentication successful - Admin ID:", req.userId);
    next();

  } catch (error) {
    console.error("[AUTH] Admin authentication error:", error.message);
    console.error("[AUTH] Error stack:", error.stack);
    return res.status(500).json({
      success: false,
      message: "Authentication service error. Please try again later."
    });
  }
};

// Alias for backward compatibility
const authenticateAdmin = authenticateToken;

// Authentication middleware for regular users (quiz submission)
const authenticateUser = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Please login to submit quiz."
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: "Your session has expired. Please login again."
        });
      } else if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: "Invalid authentication token."
        });
      } else {
        throw error;
      }
    }

    // Extract user ID from token
    const userId = decoded.userId || decoded.id || decoded._id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid token. User information not found."
      });
    }

    // Verify user exists in database
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found. Please contact support."
      });
    }

    // Add user info to request object
    req.user = decoded;
    req.userId = userId;
    req.userDoc = user; // Add full user document for convenience
    next();

  } catch (error) {
    console.error("User authentication error:", error);
    return res.status(500).json({
      success: false,
      message: "Authentication service error. Please try again later."
    });
  }
};

/**
 * Firebase Authentication Middleware for Flutter App
 * Verifies Firebase ID tokens — uses Admin SDK if configured, otherwise REST API.
 */
const authenticateFirebaseToken = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }

    let decodedToken = null;

    // 1. Try Admin SDK (only if initialized)
    if (admin.apps.length > 0) {
      try {
        decodedToken = await admin.auth().verifyIdToken(token);
        console.log("[AUTH] Firebase Admin SDK verified - UID:", decodedToken.uid);
      } catch (adminErr) {
        console.log("[AUTH] Admin SDK failed:", adminErr.message, "— trying REST API");
      }
    }

    // 2. Fall back to Firebase REST API
    if (!decodedToken) {
      try {
        decodedToken = await verifyFirebaseTokenViaREST(token);
        console.log("[AUTH] Firebase REST verified - UID:", decodedToken.uid);
      } catch (restErr) {
        console.log("[AUTH] Firebase REST failed:", restErr.message, "— trying JWT");
        // 3. Last resort: JWT (admin panel tokens)
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");
          const user = await User.findById(decoded.userId || decoded.id || decoded._id);
          if (user) {
            req.user = decoded;
            req.userId = user._id;
            req.userDoc = user;
            return next();
          }
        } catch (_) {}
        return res.status(401).json({ success: false, message: "Invalid or expired token." });
      }
    }

    // Sync with MongoDB
    const firebaseUid = decodedToken.uid;
    const email = decodedToken.email;
    const name = decodedToken.name || email?.split("@")[0] || "User";

    let user = await User.findOne({ firebaseUid });
    if (!user && email) {
      user = await User.findOne({ email: email.toLowerCase() });
      if (user) { user.firebaseUid = firebaseUid; await user.save(); }
    }
    if (!user) {
      user = new User({
        firebaseUid,
        email: email?.toLowerCase() || `${firebaseUid}@firebase.local`,
        name,
        class: "Default",
      });
      try { await user.save(); } catch (e) {
        if (e.code === 11000) user = await User.findOne({ firebaseUid }) || await User.findOne({ email: email?.toLowerCase() });
        else throw e;
      }
    } else if (user.name === "New User" && name && name !== "New User") {
      // Update placeholder name with real Firebase display name
      user.name = name;
      await user.save();
      console.log("[AUTH] Updated placeholder name to:", name);
    }

    req.user = { id: user._id, firebaseUid, email, name, emailVerified: decodedToken.email_verified };
    req.firebaseUid = firebaseUid;
    req.userId = user._id;
    req.userDoc = user;
    next();
  } catch (error) {
    console.error("[AUTH] Firebase authentication error:", error.message);
    return res.status(500).json({ success: false, message: "Authentication service error." });
  }
};

/**
 * Hybrid Authentication Middleware
 * Supports both Firebase tokens (from Flutter app) and JWT tokens (from admin panel)
 */
const authenticateHybrid = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required."
      });
    }

    // Try Firebase token first (for Flutter app)
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      const firebaseUid = decodedToken.uid;
      const email = decodedToken.email;
      const name = decodedToken.name || email?.split('@')[0] || 'User';

      let user = await User.findOne({ firebaseUid });
      
      if (!user && email) {
        user = await User.findOne({ email: email.toLowerCase() });
        if (user) {
          user.firebaseUid = firebaseUid;
          await user.save();
        }
      }
      
      if (!user) {
        user = new User({
          firebaseUid,
          email: email?.toLowerCase() || `${firebaseUid}@firebase.local`,
          name,
          class: "Default",
        });
        await user.save();
      }

      req.user = {
        id: user._id,
        firebaseUid: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name,
      };
      req.userId = user._id;
      req.userDoc = user;
      return next();
    } catch (firebaseError) {
      // Not a Firebase token, try JWT (for admin panel)
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
        
        // Check if admin
        if (decoded.role === 'admin') {
          req.admin = decoded;
        }
        
        return next();
      } catch (jwtError) {
        console.error("[AUTH] Both Firebase and JWT verification failed");
        return res.status(401).json({
          success: false,
          message: "Invalid or expired token."
        });
      }
    }
  } catch (error) {
    console.error("[AUTH] Hybrid authentication error:", error);
    return res.status(500).json({
      success: false,
      message: "Authentication service error."
    });
  }
};

module.exports = { 
  authenticateToken,      // For admin routes (JWT only)
  authenticateAdmin,      // Alias for backward compatibility
  authenticateUser,      // For quiz submission (JWT only)
  authenticateFirebaseToken, // For Flutter app (Firebase only)
  authenticateHybrid      // Supports both Firebase and JWT tokens
};
