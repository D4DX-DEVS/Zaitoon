const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const { updateStreakForUserId } = require("../controllers/growthActivityController");
const router = express.Router();

// POST /api/users/login - User login (for testing quiz)
router.post("/login", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    // Find or create user (for testing purposes)
    let user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      // Create a test user if doesn't exist
      user = new User({
        name: email.split("@")[0] || "Test User",
        email: email.toLowerCase(),
        class: "Test Class"
      });
      await user.save();
    }

    // Update reading streak on login (fire-and-forget; do not block response)
    updateStreakForUserId(user._id.toString()).catch((err) =>
      console.error("[User login] Streak update failed:", err)
    );

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        role: "user"
      },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "7d" }
    );

    res.status(200).json({
      success: true,
      message: "Login successful",
      token: token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        class: user.class
      }
    });
  } catch (error) {
    console.error("User login error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
});

// GET /api/users/me - Get current user info (authenticated)
router.get("/me", async (req, res) => {
  try {
    const authHeader = req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");
    
    const user = await User.findById(decoded.userId).select("-__v");
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(401).json({
      success: false,
      message: "Invalid or expired token"
    });
  }
});

module.exports = router;
