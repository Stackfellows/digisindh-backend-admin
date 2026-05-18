const express = require("express");
const User = require("../models/User");
const AuditLog = require("../models/AuditLog");
const { authenticateToken } = require("../middleware/auth");
const Challan = require("../models/Challan");
const mongoose = require("mongoose");

const router = express.Router();

// @route   GET /api/users/stats
// @desc    Get user statistics (counts)
// @access  Private (admin only)
router.get("/stats", authenticateToken, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const verifiedUsers = await User.countDocuments({ isVerified: true });
    const unverifiedUsers = await User.countDocuments({ isVerified: false });

    // Gender distribution
    const maleUsers = await User.countDocuments({ gender: "male" });
    const femaleUsers = await User.countDocuments({ gender: "female" });

    // Recent registrations (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentUsers = await User.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
    });

    res.json({
      success: true,
      data: {
        total: totalUsers,
        verified: verifiedUsers,
        unverified: unverifiedUsers,
        male: maleUsers,
        female: femaleUsers,
        recent: recentUsers,
      },
    });
  } catch (error) {
    console.error("Error fetching user stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user statistics",
    });
  }
});

// @route   GET /api/users
// @desc    Get all users with pagination and filters
// @access  Private (admin only)
router.get("/", authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const gender = req.query.gender || "";
    const qualification = req.query.qualification || "";
    const city = req.query.city || "";
    const isVerified = req.query.isVerified;

    // Build filter object
    const filter = {};
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { rollNumber: { $regex: search, $options: "i" } },
        { cnic: { $regex: search, $options: "i" } },
        { mobile: { $regex: search, $options: "i" } },
      ];
    }
    if (gender) {
      filter.gender = gender;
    }
    if (qualification) {
      filter.qualification = { $regex: qualification, $options: "i" };
    }
    if (city) {
      filter.city = { $regex: city, $options: "i" };
    }
    if (isVerified !== undefined) {
      filter.isVerified = isVerified === "true";
    }

    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find(filter)
        .select("-password")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    const usersWithChallanId = await Promise.all(
      users.map(async (user) => {
        const challanRecord = await Challan.findOne(
          { userId: String(user._id) }, // convert to ObjectId
          { challanId: 1, _id: 0 }
        ).lean();

        return {
          ...user,
          challanId: challanRecord ? challanRecord.challanId : null,
        };
      })
    );

    res.json({
      success: true,
      data: {
        users: usersWithChallanId,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total,
          limit,
        },
      },
    });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private (admin only)
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   PUT /api/users/:id
// @desc    Update user by ID
// @access  Private (admin only)
router.put("/:id", authenticateToken, async (req, res) => {
  try {
    const { reason, ...updateData } = req.body;
    const userId = req.params.id;

    // Get original user data
    const originalUser = await User.findById(userId);
    if (!originalUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
      select: "-password",
    });

    // Create audit log
    const changes = {};
    Object.keys(updateData).forEach((key) => {
      if (originalUser[key] !== updateData[key]) {
        changes[key] = {
          old: originalUser[key],
          new: updateData[key],
        };
      }
    });

    if (Object.keys(changes).length > 0) {
      await AuditLog.create({
        entityType: "user",
        entityId: userId,
        action: "update",
        changes: changes,
        adminUser: req.user.username,
        reason: reason || "No reason provided",
      });
    }

    res.json({
      success: true,
      message: "User updated successfully",
      data: { user: updatedUser },
    });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   GET /api/users/download
// @desc    Download users as CSV
// @access  Private
router.get("/download", authenticateToken, async (req, res) => {
  try {
    const {
      search,
      gender,
      city,
      qualification,
      verified,
      startDate,
      endDate,
    } = req.query;

    // Build the same filter as the main users route
    const filter = {};

    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { rollNumber: { $regex: search, $options: "i" } },
        { mobile: { $regex: search, $options: "i" } },
        { cnic: { $regex: search, $options: "i" } },
      ];
    }

    if (gender && gender !== "") {
      filter.gender = gender;
    }

    if (city && city !== "") {
      filter.city = { $regex: city, $options: "i" };
    }

    if (qualification && qualification !== "") {
      filter.qualification = { $regex: qualification, $options: "i" };
    }

    if (verified !== undefined && verified !== "") {
      filter.isVerified = verified === "true";
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    // Get ALL matching users (no pagination for download)
    const users = await User.find(filter).sort({ createdAt: -1 });

    // Convert to CSV format
    const csvHeaders = [
      "Roll Number",
      "Full Name",
      "Father Name",
      "Email",
      "Mobile",
      "CNIC",
      "Date of Birth",
      "Gender",
      "Qualification",
      "City",
      "Permanent Address",
      "Courses",
      "Referral Code",
      "Verification Status",
      "Created Date",
      "Updated Date",
    ];

    const csvRows = users.map((user) => [
      user.rollNumber || "",
      user.fullName || "",
      user.fatherName || "",
      user.email || "",
      user.mobile || "",
      user.cnic || "",
      user.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString() : "",
      user.gender || "",
      user.qualification || "",
      user.city || "",
      user.permanentAddress || "",
      Array.isArray(user.courses)
        ? user.courses.join("; ")
        : user.courses || "",
      user.referralCode || "",
      user.isVerified ? "Verified" : "Unverified",
      new Date(user.createdAt).toLocaleDateString(),
      new Date(user.updatedAt).toLocaleDateString(),
    ]);

    // Create CSV content
    const csvContent = [
      csvHeaders.join(","),
      ...csvRows.map((row) => row.map((field) => `"${field}"`).join(",")),
    ].join("\n");

    // Set response headers for file download
    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `users_export_${timestamp}.csv`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (error) {
    console.error("Download users error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to download users data",
    });
  }
});

module.exports = router;
