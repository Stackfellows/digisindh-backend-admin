const express = require("express");
const jwt = require("jsonwebtoken");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Generate JWT Token with role
const generateToken = (username, role) => {
  return jwt.sign(
    { username, role },
    process.env.JWT_SECRET || "your-secret-key",
    {
      expiresIn: "24h",
    }
  );
};

// @route   POST /api/auth/login
// @desc    Admin login
// @access  Public
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log("Login attempt:", { username });
    console.log("Environment check:", { 
      hasAdminUser: !!process.env.ADMIN_USERNAME, 
      hasAdminPass: !!process.env.ADMIN_PASSWORD 
    });

    // Validation
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required",
      });
    }

    // Check admin credentials from env
    const adminUsername = process.env.ADMIN_USERNAME || "admin";
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

    const superadminUsername = process.env.SUPER_ADMIN_USERNAME || "superadmin";
    const superadminPassword = process.env.SUPER_ADMIN_PASSWORD || "superadmin123";

    // Check if admin credentials match
    if (username === adminUsername && password === adminPassword) {
      console.log("Admin login success");
      const token = generateToken(username, "admin");
      return res.json({
        success: true,
        message: "Login successful",
        data: {
          user: { username, role: "admin" },
          token,
        },
      });
    }

    // Check if superadmin credentials match
    if (username === superadminUsername && password === superadminPassword) {
      console.log("Superadmin login success");
      const token = generateToken(username, "superadmin");
      return res.json({
        success: true,
        message: "Login successful",
        data: {
          user: { username, role: "superadmin" },
          token,
        },
      });
    }

    console.log("Invalid credentials during login");
    // If neither match, return invalid credentials
    return res.status(401).json({
      success: false,
      message: "Invalid credentials",
    });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during login",
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current admin user
// @access  Private
router.get("/me", authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        user: req.user,
      },
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout admin (client-side token removal)
// @access  Private
router.post("/logout", authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

module.exports = router;
