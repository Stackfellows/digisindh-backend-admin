const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

// Import models
const User = require("./models/User");
const Challan = require("./models/Challan");
const Scholarship = require("./models/Scholarship");
const AuditLog = require("./models/AuditLog");
const TeleChallan = require("./models/TeleChallan");

const app = express();

// Middleware
app.use(
  cors({
    origin: [
      "http://localhost:3100",
      "http://localhost:3101",
      "http://31.97.50.160:8080",
      "http://127.0.0.1:5501",
      "http://127.0.0.1:3100, https://31.97.50.160:3100",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

// MongoDB Connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Auth routes
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;

  console.log(username, password);
  const adminUsername = process.env.ADMIN_USERNAME || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

  const superadminUsername = process.env.SUPER_ADMIN_USERNAME || "superadmin"; // Fixed casing
  const superadminPassword =
    process.env.SUPER_ADMIN_PASSWORD || "superadmin123"; // Fixed casing

  if (username === adminUsername && password === adminPassword) {
    res.json({
      success: true,
      message: "Login successful",
      data: {
        user: { username, role: "admin" },
        token: "test-token-123",
      },
    });
  } else if (
    username === superadminUsername &&
    password === superadminPassword
  ) {
    res.json({
      success: true,
      message: "Login successful",
      data: {
        user: { username, role: "superadmin" },
        token: "test-token-456", // Different token for superadmin
      },
    });
  } else {
    res.status(401).json({
      success: false,
      message: "Invalid credentials",
    });
  }
});

app.get("/api/auth/me", (req, res) => {
  const token = req.query.token;

  if (token === "test-token-123") {
    res.json({
      success: true,
      data: { user: { username: "admin", role: "admin" } },
    });
  } else if (token === "test-token-456") {
    res.json({
      success: true,
      data: { user: { username: "superadmin", role: "superadmin" } },
    });
  } else {
    res.status(401).json({ success: false, message: "Invalid token" });
  }
});

// Analytics route
app.get("/api/analytics/dashboard", async (req, res) => {
  try {
    // Get basic counts
    const [
      totalUsers,
      verifiedUsers,
      totalChallans,
      paidChallans,
      unpaidChallans,
      totalScholarships,
      pendingScholarships,
      approvedScholarships,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isVerified: true }),
      Challan.countDocuments(),
      Challan.countDocuments({ paid: true }),
      Challan.countDocuments({ paid: false }),
      Scholarship.countDocuments(),
      Scholarship.countDocuments({ status: "pending" }),
      Scholarship.countDocuments({ status: "approved" }),
    ]);

    // Get total revenue
    const revenueResult = await Challan.aggregate([
      { $match: { paid: true } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalRevenue = revenueResult[0]?.total || 0;

    // Get pending revenue
    const pendingRevenueResult = await Challan.aggregate([
      { $match: { paid: false } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const pendingRevenue = pendingRevenueResult[0]?.total || 0;

    // Get recent users (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentUsers = await User.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
    });

    // Get recent challans (last 30 days)
    const recentChallans = await Challan.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
    });

    // Get recent scholarships (last 30 days)
    const recentScholarships = await Scholarship.countDocuments({
      appliedAt: { $gte: thirtyDaysAgo },
    });

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          verified: verifiedUsers,
          unverified: totalUsers - verifiedUsers,
          recent: recentUsers,
        },
        challans: {
          total: totalChallans,
          paid: paidChallans,
          unpaid: unpaidChallans,
          recent: recentChallans,
        },
        scholarships: {
          total: totalScholarships,
          pending: pendingScholarships,
          approved: approvedScholarships,
          rejected:
            totalScholarships - pendingScholarships - approvedScholarships,
          recent: recentScholarships,
        },
        revenue: {
          total: totalRevenue,
          pending: pendingRevenue,
          collected: totalRevenue,
        },
      },
    });
  } catch (error) {
    console.error("Get dashboard analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// User stats route
app.get("/api/users/stats", async (req, res) => {
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

// Users route
app.get("/api/users", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const gender = req.query.gender || "";
    const qualification = req.query.qualification || "";
    const city = req.query.city || "";
    const isVerified = req.query.isVerified;
    const challanPaid = req.query.challanPaid; // "true" or "false"
    const noChallan = req.query.noChallan; // "true" or "false"

    const skip = (page - 1) * limit;

    // 1. Build initial match stage for User fields
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

    // 2. Handle Challan-based Filtering via ID Lists (Optimization)
    // Instead of aggregating simply, we find the IDs of users matching the challan criteria
    // and add them to the User filter.

    if (challanPaid !== undefined || noChallan !== undefined) {
      let candidateUserIds = null; // Set of ObjectIds allowed

      // Helper to convert strings to ObjectIds safely
      const toObjectId = (id) => {
        try {
          return new mongoose.Types.ObjectId(id);
        } catch (e) {
          return null;
        }
      };

      // Case A: Filter by Payment Status
      if (challanPaid !== undefined) {
        const isPaidFilter = challanPaid === "true";

        if (isPaidFilter) {
          // Users with AT LEAST ONE paid challan
          const paidUserIds = await Challan.distinct("userId", { paid: true });
          const objectIds = paidUserIds.map(toObjectId).filter((id) => id);

          if (filter._id) {
            // Intersection with existing ID filter if any
            filter._id = {
              $in: objectIds.filter((id) =>
                filter._id.$in.some((eid) => eid.equals(id))
              ),
            }; // Complex intersection, simplistic approach below
            // Since filter._id is not set yet by us, we can just set it.
            // But if we combine filters, we need intersection.
            // Let's assume candidateUserIds strategy.
          }
          candidateUserIds = objectIds;
        } else {
          // Users who have challans, but NONE are paid.
          // 1. Get all users with challans
          const allChallanUserIds = await Challan.distinct("userId", {});
          // 2. Get users with paid challans
          const paidUserIds = await Challan.distinct("userId", { paid: true });

          // 3. Diff: Has Challan - Paid Challan
          const paidSet = new Set(paidUserIds);
          const unpaidOnlyStrings = allChallanUserIds.filter(
            (id) => !paidSet.has(id)
          );

          const objectIds = unpaidOnlyStrings
            .map(toObjectId)
            .filter((id) => id);
          candidateUserIds = objectIds;
        }
      }

      // Case B: Filter by "No Challan" / "Has Challan"
      if (noChallan !== undefined) {
        const noChallanBool = noChallan === "true";

        const allChallanUserIds = await Challan.distinct("userId", {});
        const allChallanObjectIds = allChallanUserIds
          .map(toObjectId)
          .filter((id) => id);

        if (noChallanBool) {
          // Users NOT in the list
          filter._id = { ...filter._id, $nin: allChallanObjectIds };

          // Note: If we already have candidateUserIds from Case A (e.g. Paid Users),
          // and now we want "No Challan", the result is EMPTY intersection.
          if (candidateUserIds !== null) {
            // Intersection of "Must be in X" and "Must not be in Y"
            // candidateUserIds = candidateUserIds.filter(id => !allChallanObjectIds.includes(id))
            // BUT "Paid Users" excludes "No Challan Users" by definition.
            // So if you ask for Paid=true AND NoChallan=true -> Empty.
            // Logic holds.
          }
        } else {
          // Users IN the list (Has Challan)
          // If we had a previous candidate set (e.g. Unpaid Only), we intersect.
          if (candidateUserIds !== null) {
            // Intersection
            // (UnpaidOnly is already a subset of HasChallan, so no change needed really)
            // But to be safe:
            const setHasChallan = new Set(allChallanUserIds);
            candidateUserIds = candidateUserIds.filter((id) =>
              setHasChallan.has(id.toString())
            );
          } else {
            candidateUserIds = allChallanObjectIds;
          }
        }
      }

      // Apply the candidate IDs to the filter
      if (candidateUserIds !== null) {
        if (filter._id && filter._id.$nin) {
          // We have a $nin constraint and a $in constraint (candidateUserIds)
          // Effectively: $in: candidateUserIds sans $nin
          const ninList = filter._id.$nin.map((id) => id.toString());
          filter._id = {
            $in: candidateUserIds.filter(
              (id) => !ninList.includes(id.toString())
            ),
          };
        } else {
          filter._id = { $in: candidateUserIds };
        }
      }
    }

    // 3. Execute Query
    const total = await User.countDocuments(filter);

    const users = await User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // 4. Enrich Data
    const enrichedUsers = await Promise.all(
      users.map(async (user) => {
        const [challanRecords, scholarshipRecord] = await Promise.all([
          Challan.find(
            { userId: String(user._id) },
            { challanId: 1, paid: 1, _id: 0 }
          ).lean(),

          Scholarship.findOne({
            $or: [
              { cnic: { $regex: `^${user.cnic.trim()}$`, $options: "i" } },
              { email: { $regex: `^${user.email.trim()}$`, $options: "i" } },
              {
                rollNumber: {
                  $regex: `^${user.rollNumber.trim()}$`,
                  $options: "i",
                },
              },
            ],
          }).lean(),
        ]);

        const formattedChallans = challanRecords.map((c) => ({
          id: c.challanId,
          paid: c.paid,
        }));

        return {
          ...user,
          challans: formattedChallans,
          scholarship: scholarshipRecord || null,
        };
      })
    );

    res.json({
      success: true,
      data: {
        users: enrichedUsers,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total: total,
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

// Challan stats route
app.get("/api/challans/stats", async (req, res) => {
  try {
    const totalChallans = await Challan.countDocuments();
    const paidChallans = await Challan.countDocuments({ paid: true });
    const unpaidChallans = await Challan.countDocuments({ paid: false });

    // Calculate revenue
    const paidChallanData = await Challan.find({ paid: true }).select("amount");
    const unpaidChallanData = await Challan.find({ paid: false }).select(
      "amount"
    );

    const totalRevenue = paidChallanData.reduce(
      (sum, challan) => sum + challan.amount,
      0
    );
    const pendingRevenue = unpaidChallanData.reduce(
      (sum, challan) => sum + challan.amount,
      0
    );

    // Recent challans (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentChallans = await Challan.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
    });

    res.json({
      success: true,
      data: {
        total: totalChallans,
        paid: paidChallans,
        unpaid: unpaidChallans,
        totalRevenue,
        pendingRevenue,
        recent: recentChallans,
      },
    });
  } catch (error) {
    console.error("Error fetching challan stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch challan statistics",
    });
  }
});

// Challans route
app.get("/api/challans", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const paid = req.query.paid;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const minAmount = req.query.minAmount;
    const maxAmount = req.query.maxAmount;

    const filter = {};
    if (paid !== undefined) filter.paid = paid === "true";
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }
    if (minAmount || maxAmount) {
      filter.amount = {};
      if (minAmount) filter.amount.$gte = parseInt(minAmount);
      if (maxAmount) filter.amount.$lte = parseInt(maxAmount);
    }

    const skip = (page - 1) * limit;

    const challans = await Challan.aggregate([
      {
        // STEP 1: Safely convert string userId to ObjectId for joining
        $addFields: {
          userIdObj: {
            $convert: {
              input: "$userId",
              to: "objectId",
              onError: null,
              onNull: null,
            },
          },
        },
      },
      {
        // STEP 2: Join with users collection
        $lookup: {
          from: "users",
          localField: "userIdObj",
          foreignField: "_id",
          as: "userDetails",
        },
      },
      { $unwind: { path: "$userDetails", preserveNullAndEmptyArrays: true } },
      {
        // STEP 3: SEARCH LOGIC (Restored Email Search)
        $match: {
          ...filter,
          $or: [
            { challanId: { $regex: search, $options: "i" } },
            { "userDetails.rollNumber": { $regex: search, $options: "i" } },
            {
              "userDetails.secondRollNumber": { $regex: search, $options: "i" },
            },
            { "userDetails.fullName": { $regex: search, $options: "i" } },
            { "userDetails.email": { $regex: search, $options: "i" } }, // 👈 RESTORED EMAIL SEARCH
          ],
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          challanId: 1,
          amount: 1,
          paid: 1,
          branchCode: 1,
          txnId: 1,
          txnDate: 1,
          path: 1,
          secondEnrollChallan: 1,
          createdAt: 1,
          updatedAt: 1,
          userId: {
            _id: "$userDetails._id",
            rollNumber: "$userDetails.rollNumber",
            secondRollNumber: "$userDetails.secondRollNumber",
            email: "$userDetails.email",
            fullName: "$userDetails.fullName",
            mobile: "$userDetails.mobile",
            courses: "$userDetails.courses",
            secondEnrolledCourses: "$userDetails.secondEnrolledCourses",
          },
        },
      },
    ]);

    // Count for pagination (must also include the email search logic)
    const totalCountResult = await Challan.aggregate([
      {
        $addFields: {
          userIdObj: {
            $convert: {
              input: "$userId",
              to: "objectId",
              onError: null,
              onNull: null,
            },
          },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "userIdObj",
          foreignField: "_id",
          as: "u",
        },
      },
      { $unwind: { path: "$u", preserveNullAndEmptyArrays: true } },
      {
        $match: {
          ...filter,
          $or: [
            { challanId: { $regex: search, $options: "i" } },
            { "u.rollNumber": { $regex: search, $options: "i" } },
            { "u.fullName": { $regex: search, $options: "i" } },
            { "u.email": { $regex: search, $options: "i" } }, // 👈 ADDED HERE TOO
          ],
        },
      },
      { $count: "total" },
    ]);

    const total = totalCountResult[0]?.total || 0;

    const validChallans = challans.map((challan) => {
      let userObj = challan.userId || {
        _id: "deleted",
        fullName: "Deleted User",
        rollNumber: "N/A",
      };
      if (challan.userId && challan.userId._id) {
        if (challan.secondEnrollChallan === true) {
          userObj.rollNumber = userObj.secondRollNumber || userObj.rollNumber;
          userObj.courses = userObj.secondEnrolledCourses?.length
            ? userObj.secondEnrolledCourses
            : userObj.courses;
        }
        delete userObj.secondRollNumber;
        delete userObj.secondEnrolledCourses;
      }
      return { ...challan, userId: userObj };
    });

    res.json({
      success: true,
      data: {
        challans: validChallans,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total,
          limit,
        },
      },
    });
  } catch (error) {
    console.error("Get challans error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Download challans CSV endpoint
app.get("/api/challans/download", async (req, res) => {
  try {
    const { search, paid, startDate, endDate, minAmount, maxAmount } =
      req.query;

    // Build the same filter as the main challans route
    const filter = {};

    if (search) {
      filter.$or = [{ challanId: { $regex: search, $options: "i" } }];

      // If search is a number, also search txnId
      if (!isNaN(search) && search.trim() !== "") {
        filter.$or.push({ txnId: parseInt(search) });
      }
    }

    if (paid !== undefined) {
      filter.paid = paid === "true";
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    if (minAmount || maxAmount) {
      filter.amount = {};
      if (minAmount) filter.amount.$gte = parseInt(minAmount);
      if (maxAmount) filter.amount.$lte = parseInt(maxAmount);
    }

    // Get ALL matching challans (no pagination for download)
    const challans = await Challan.find(filter).lean().sort({ createdAt: -1 });

    // Handle orphaned challans and invalid ObjectIds
    const validChallans = await Promise.all(
      challans.map(async (challan) => {
        try {
          // Check if userId is a valid ObjectId
          if (
            challan.userId &&
            mongoose.Types.ObjectId.isValid(challan.userId)
          ) {
            // Try to populate user data
            const user = await User.findById(challan.userId)
              .select("fullName email rollNumber mobile cnic courses")
              .lean();

            if (user) {
              return {
                ...challan,
                userId: user,
              };
            }
          }

          // If userId is invalid or user not found, return with placeholder data
          return {
            ...challan,
            userId: {
              _id: "invalid",
              fullName: "Invalid User ID",
              email: "N/A",
              rollNumber: "N/A",
              mobile: "N/A",
              courses: ["N/A", "N/A"],
              cnic: "N/A",
            },
          };
        } catch (error) {
          console.log(
            `Error processing challan ${challan.challanId}:`,
            error.message
          );
          // Return challan with error placeholder
          return {
            ...challan,
            userId: {
              _id: "error",
              fullName: "Error Loading User",
              email: "N/A",
              rollNumber: "N/A",
              mobile: "N/A",
              courses: ["N/A", "N/A"],
              cnic: "N/A",
            },
          };
        }
      })
    );

    // Convert to CSV format
    const csvHeaders = [
      "Challan ID",
      "Student Name",
      "Roll Number",
      "Email",
      "Mobile",
      "CNIC",
      "Course 1",
      "Course 2",
      "Amount",
      "Payment Status",
      "Transaction ID",
      "Transaction Date",
      "Branch Code",
      "Created Date",
      "Updated Date",
    ];

    const csvRows = validChallans.map((challan) => [
      challan.challanId || "",
      challan.userId?.fullName || "",
      challan.userId?.rollNumber || "",
      challan.userId?.email || "",
      challan.userId?.mobile || "",
      challan.userId?.cnic || "",
      challan.userId?.courses[0] || "",
      challan.userId?.courses[1] || "",
      challan.amount || 0,
      challan.paid ? "Paid" : "Unpaid",
      challan.txnId || "",
      challan.txnDate ? new Date(challan.txnDate).toLocaleDateString() : "",
      challan.branchCode || "",
      new Date(challan.createdAt).toLocaleDateString(),
      new Date(challan.updatedAt).toLocaleDateString(),
    ]);

    // Create CSV content
    const csvContent = [
      csvHeaders.join(","),
      ...csvRows.map((row) => row.map((field) => `"${field}"`).join(",")),
    ].join("\n");

    // Set response headers for file download
    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `challans_export_${timestamp}.csv`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (error) {
    console.error("Download challans error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to download challans data",
    });
  }
});

// Scholarships Stats endpoint
app.get("/api/scholarships/stats", async (req, res) => {
  try {
    const totalScholarships = await Scholarship.countDocuments();
    const pendingScholarships = await Scholarship.countDocuments({
      status: "pending",
    });
    const approvedScholarships = await Scholarship.countDocuments({
      status: "approved",
    });
    const rejectedScholarships = await Scholarship.countDocuments({
      status: "rejected",
    });

    // Recent scholarships (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentScholarships = await Scholarship.countDocuments({
      appliedAt: { $gte: thirtyDaysAgo },
    });

    res.json({
      success: true,
      data: {
        total: totalScholarships,
        pending: pendingScholarships,
        approved: approvedScholarships,
        rejected: rejectedScholarships,
        recent: recentScholarships,
      },
    });
  } catch (error) {
    console.error("Error fetching scholarship stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch scholarship statistics",
    });
  }
});

// Scholarships route
app.get("/api/scholarships", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      startDate,
      endDate,
    } = req.query;

    // Build filter object
    const filter = {};

    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { rollNumber: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { cnic: { $regex: search, $options: "i" } },
        { mobileNumber: { $regex: search, $options: "i" } },
        { challanNumber: { $regex: search, $options: "i" } },
      ];
    }

    if (status && status !== "") {
      filter.status = status;
    }

    if (startDate || endDate) {
      filter.appliedAt = {};
      if (startDate) filter.appliedAt.$gte = new Date(startDate);
      if (endDate) filter.appliedAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const [scholarships, total] = await Promise.all([
      Scholarship.find(filter)
        .sort({ appliedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Scholarship.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        scholarships,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
          limit: parseInt(limit),
        },
      },
    });
  } catch (error) {
    console.error("Get scholarships error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// Download scholarships CSV endpoint
app.get("/api/scholarships/download", async (req, res) => {
  try {
    const { search, status, startDate, endDate } = req.query;

    // Build the same filter as the main scholarships route
    const filter = {};

    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { rollNumber: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { cnic: { $regex: search, $options: "i" } },
        { mobileNumber: { $regex: search, $options: "i" } },
        { challanNumber: { $regex: search, $options: "i" } },
      ];
    }

    if (status && status !== "") {
      filter.status = status;
    }

    if (startDate || endDate) {
      filter.appliedAt = {};
      if (startDate) filter.appliedAt.$gte = new Date(startDate);
      if (endDate) filter.appliedAt.$lte = new Date(endDate);
    }

    // Get ALL matching scholarships (no pagination for download)
    const scholarships = await Scholarship.find(filter).sort({ appliedAt: -1 });

    // Convert to CSV format
    const csvHeaders = [
      "Full Name",
      "CNIC",
      "Roll Number",
      "Email",
      "Mobile Number",
      "Challan Number",
      "Status",
      "Applied Date",
      "Created Date",
      "Updated Date",
    ];

    const csvRows = scholarships.map((scholarship) => [
      scholarship.fullName || "",
      scholarship.cnic || "",
      scholarship.rollNumber || "",
      scholarship.email || "",
      scholarship.mobileNumber || "",
      scholarship.challanNumber || "",
      scholarship.status || "",
      scholarship.appliedAt
        ? new Date(scholarship.appliedAt).toLocaleDateString()
        : "",
      new Date(scholarship.createdAt).toLocaleDateString(),
      new Date(scholarship.updatedAt).toLocaleDateString(),
    ]);

    // Create CSV content
    const csvContent = [
      csvHeaders.join(","),
      ...csvRows.map((row) => row.map((field) => `"${field}"`).join(",")),
    ].join("\n");

    // Set response headers for file download
    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `scholarships_export_${timestamp}.csv`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (error) {
    console.error("Download scholarships error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to download scholarships data",
    });
  }
});

// Update scholarship endpoint
app.put("/api/scholarships/:id", async (req, res) => {
  try {
    const { reason, ...updateData } = req.body;
    const scholarshipId = req.params.id;

    // Get original scholarship data
    const originalScholarship = await Scholarship.findById(scholarshipId);
    if (!originalScholarship) {
      return res.status(404).json({
        success: false,
        message: "Scholarship not found",
      });
    }

    // Update scholarship
    const updatedScholarship = await Scholarship.findByIdAndUpdate(
      scholarshipId,
      updateData,
      { new: true }
    );

    // Create audit log
    const changes = {};
    Object.keys(updateData).forEach((key) => {
      if (originalScholarship[key] !== updateData[key]) {
        changes[key] = {
          old: originalScholarship[key],
          new: updateData[key],
        };
      }
    });

    if (Object.keys(changes).length > 0) {
      await AuditLog.create({
        entityType: "scholarship",
        entityId: scholarshipId,
        action: "update",
        changes,
        adminUser: "admin", // In real app, get from JWT token
        reason: reason || "No reason provided",
      });
    }

    res.json({
      success: true,
      data: updatedScholarship,
    });
  } catch (error) {
    console.error("Update scholarship error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// Get scholarship by ID endpoint
app.get("/api/scholarships/:id", async (req, res) => {
  try {
    const scholarship = await Scholarship.findById(req.params.id);
    if (!scholarship) {
      return res.status(404).json({
        success: false,
        message: "Scholarship not found",
      });
    }

    res.json({
      success: true,
      data: scholarship,
    });
  } catch (error) {
    console.error("Get scholarship error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// Download users CSV endpoint
app.get("/api/users/download", async (req, res) => {
  try {
    const {
      search,
      gender,
      city,
      qualification,
      verified,
      startDate,
      endDate,
      challanPaid,
      noChallan,
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
    let users = await User.find(filter).sort({ createdAt: -1 });

    // Enrich users with challan information for filtering
    let usersWithChallan = await Promise.all(
      users.map(async (user) => {
        const challanRecord = await Challan.findOne(
          { userId: String(user._id) },
          { challanId: 1, paid: 1, _id: 0 }
        ).lean();

        return {
          ...user.toObject(),
          challanId: challanRecord ? challanRecord.challanId : null,
          challanPaid: challanRecord ? challanRecord.paid : null,
        };
      })
    );

    // Apply challan-based filters
    if (challanPaid !== undefined) {
      const challanBool = challanPaid === "true";
      usersWithChallan = usersWithChallan.filter(
        (u) => u.challanPaid === challanBool
      );
    }

    if (noChallan !== undefined) {
      const noChallanBool = noChallan === "true";
      usersWithChallan = usersWithChallan.filter((u) =>
        noChallanBool ? u.challanId === null : u.challanId !== null
      );
    }

    users = usersWithChallan;

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

// Update user endpoint
app.put("/api/users/:id", async (req, res) => {
  try {
    const { reason, scholarship, ...updateData } = req.body;
    const userId = req.params.id;

    // Get original user data
    const originalUser = await User.findById(userId);
    if (!originalUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Start transaction for atomic updates
    const session = await mongoose.startSession();
    session.startTransaction();

    console.log("updateData", updateData);

    try {
      // Update user
      const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
        new: true,
        select: "-password",
        session,
      });

      // Handle scholarship update (only update existing scholarships, don't create new ones)
      let updatedScholarship = null;
      let scholarshipChanges = {};

      if (scholarship) {
        // Find existing scholarship by CNIC, email, or roll number
        const existingScholarship = await Scholarship.findOne({
          $or: [
            {
              cnic: { $regex: `^${originalUser.cnic.trim()}$`, $options: "i" },
            },
            {
              email: {
                $regex: `^${originalUser.email.trim()}$`,
                $options: "i",
              },
            },
            {
              rollNumber: {
                $regex: `^${originalUser.rollNumber.trim()}$`,
                $options: "i",
              },
            },
          ],
        }).session(session);

        if (existingScholarship) {
          // Only update existing scholarship
          const originalScholarshipData = existingScholarship.toObject();

          updatedScholarship = await Scholarship.findByIdAndUpdate(
            existingScholarship._id,
            {
              ...scholarship,
              // Ensure consistency with user data
              fullName: updatedUser.fullName,
              email: updatedUser.email,
              cnic: updatedUser.cnic,
              rollNumber: updatedUser.rollNumber,
              mobileNumber: updatedUser.mobile,
            },
            { new: true, session }
          );

          // Track scholarship changes (avoid dot notation for Mongoose Map compatibility)
          Object.keys(scholarship).forEach((key) => {
            const oldValue = originalScholarshipData[key];
            const newValue = scholarship[key];

            // Convert values to strings for comparison to handle ObjectId, Date, etc.
            const oldStr = oldValue ? oldValue.toString() : oldValue;
            const newStr = newValue ? newValue.toString() : newValue;

            if (oldStr !== newStr) {
              scholarshipChanges[`scholarship_${key}`] = {
                old: oldStr,
                new: newStr,
              };
            }
          });
        }
        // If scholarship doesn't exist, we don't create it
      }

      // Create audit log for user changes
      const userChanges = {};
      Object.keys(updateData).forEach((key) => {
        if (
          JSON.stringify(originalUser[key]) !== JSON.stringify(updateData[key])
        ) {
          userChanges[key] = {
            old: originalUser[key],
            new: updateData[key],
          };
        }
      });

      // Combine user and scholarship changes
      const allChanges = { ...userChanges, ...scholarshipChanges };

      if (Object.keys(allChanges).length > 0) {
        await AuditLog.create(
          [
            {
              entityType: "user",
              entityId: userId,
              action: "update",
              changes: allChanges,
              adminUser: "admin",
              reason: reason || "No reason provided",
            },
          ],
          { session }
        );
      }

      // Commit transaction
      await session.commitTransaction();

      res.json({
        success: true,
        message: "User and scholarship updated successfully",
        data: {
          user: updatedUser,
          scholarship: updatedScholarship,
        },
      });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// Delete user and all related data endpoint
app.delete("/api/users/:id", async (req, res) => {
  try {
    const { reason } = req.body;
    const userId = req.params.id;

    // Get original user data before deletion
    const originalUser = await User.findById(userId);
    if (!originalUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Start a transaction to ensure all deletions happen together
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Delete all challans associated with this user
      const deletedChallans = await Challan.deleteMany({
        userId: userId,
      }).session(session);

      // Delete all scholarships associated with this user (by CNIC or email match)
      const deletedScholarships = await Scholarship.deleteMany({
        $or: [{ cnic: originalUser.cnic }, { email: originalUser.email }],
      }).session(session);

      // Delete the user
      const deletedUser = await User.findByIdAndDelete(userId).session(session);

      // Create audit log for the deletion
      await AuditLog.create(
        [
          {
            entityType: "user",
            entityId: userId,
            action: "delete",
            changes: {
              user: {
                old: {
                  fullName: originalUser.fullName,
                  email: originalUser.email,
                  rollNumber: originalUser.rollNumber,
                  cnic: originalUser.cnic,
                },
                new: "DELETED",
              },
              deletedChallans: {
                old: `${deletedChallans.deletedCount} challans`,
                new: "DELETED",
              },
              deletedScholarships: {
                old: `${deletedScholarships.deletedCount} scholarships`,
                new: "DELETED",
              },
            },
            adminUser: "admin", // In real app, get from JWT token
            reason: reason || "No reason provided",
          },
        ],
        { session }
      );

      // Commit the transaction
      await session.commitTransaction();

      res.json({
        success: true,
        message: "User and all related data deleted successfully",
        data: {
          deletedUser: {
            id: userId,
            fullName: originalUser.fullName,
            email: originalUser.email,
            rollNumber: originalUser.rollNumber,
          },
          deletedChallans: deletedChallans.deletedCount,
          deletedScholarships: deletedScholarships.deletedCount,
        },
      });
    } catch (error) {
      // If anything fails, abort the transaction
      await session.abortTransaction();
      throw error;
    } finally {
      // End the session
      session.endSession();
    }
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during deletion",
    });
  }
});

// Update challan endpoint
app.put("/api/challans/:id", async (req, res) => {
  try {
    const { reason, ...updateData } = req.body;
    const challanId = req.params.id;

    // Get original challan data
    const originalChallan = await Challan.findById(challanId);
    if (!originalChallan) {
      return res.status(404).json({
        success: false,
        message: "Challan not found",
      });
    }

    // Update challan
    const updatedChallan = await Challan.findByIdAndUpdate(
      challanId,
      updateData,
      { new: true }
    ).populate("userId", "fullName email rollNumber mobile");

    // Create audit log
    const changes = {};
    Object.keys(updateData).forEach((key) => {
      if (
        JSON.stringify(originalChallan[key]) !== JSON.stringify(updateData[key])
      ) {
        changes[key] = {
          old: originalChallan[key],
          new: updateData[key],
        };
      }
    });

    if (Object.keys(changes).length > 0) {
      await AuditLog.create({
        entityType: "challan",
        entityId: challanId,
        action: "update",
        changes: changes,
        adminUser: "admin",
        reason: reason || "No reason provided",
      });
    }

    res.json({
      success: true,
      message: "Challan updated successfully",
      data: { challan: updatedChallan },
    });
  } catch (error) {
    console.error("Update challan error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// Get audit logs for specific entity
app.get("/api/audit-logs/:entityType/:entityId", async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Validate entity type
    if (!["user", "challan"].includes(entityType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid entity type",
      });
    }

    const auditLogs = await AuditLog.find({
      entityType,
      entityId,
    })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await AuditLog.countDocuments({
      entityType,
      entityId,
    });

    res.json({
      success: true,
      data: auditLogs,
      pagination: {
        current: pageNum,
        pages: Math.ceil(total / limitNum),
        total,
        limit: limitNum,
      },
    });
  } catch (error) {
    console.error("Get audit logs error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// Get all audit logs with pagination and filtering
app.get("/api/audit-logs", async (req, res) => {
  try {
    const { page = 1, limit = 50, entityType, adminUser } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build filter
    const filter = {};
    if (entityType) filter.entityType = entityType;
    if (adminUser) filter.adminUser = adminUser;

    const auditLogs = await AuditLog.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await AuditLog.countDocuments(filter);

    res.json({
      success: true,
      data: auditLogs,
      pagination: {
        current: pageNum,
        pages: Math.ceil(total / limitNum),
        total,
        limit: limitNum,
      },
    });
  } catch (error) {
    console.error("Get all audit logs error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// TeleChallan Routes

// Get all tele-challans with pagination and filtering
app.get("/api/tele-challans", async (req, res) => {
  try {
    const { page = 1, limit = 50, status, search, paid } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    // Existing Call Status Filter
    if (status) {
      filter.status = status;
    }

    // New Payment Status Filter
    if (paid !== undefined && paid !== "") {
      if (paid === "true" || paid === "paid") {
        filter["challanData.paid"] = true;
      } else if (paid === "false" || paid === "unpaid") {
        filter["challanData.paid"] = false;
      }
    }

    if (search) {
      filter.$or = [
        { "userData.fullName": { $regex: search, $options: "i" } },
        { "userData.rollNumber": { $regex: search, $options: "i" } },
        { "challanData.challanId": { $regex: search, $options: "i" } },
        { "userData.phone": { $regex: search, $options: "i" } },
      ];
    }

    const [teleChallans, total] = await Promise.all([
      TeleChallan.find(filter)
        .sort({ assignedDate: -1 })
        .skip(skip)
        .limit(limitNum),
      TeleChallan.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        teleChallans,
        pagination: {
          current: pageNum,
          pages: Math.ceil(total / limitNum),
          total,
          limit: limitNum,
        },
      },
    });
  } catch (error) {
    console.error("Get tele-challans error:", error);
    res.status(500).json({
      success: false,
      message: "Server error retrieving tele-challans",
    });
  }
});

// Add unpaid challans to Tele Call List based on filter safely
app.post("/api/tele-challans/add", async (req, res) => {
  try {
    const { days, startDate, endDate } = req.body;

    const filter = { paid: false };
    const dateFilter = {};

    if (startDate || endDate) {
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.$lte = end;
      }
      filter.createdAt = dateFilter;
    } else if (days) {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - parseInt(days));
      filter.createdAt = { $gte: pastDate };
    }

    // Safely query all unpaid challans
    const unpaidChallans = await Challan.find(filter).lean().sort({ createdAt: -1 });

    if (!unpaidChallans.length) {
      return res.json({
        success: true,
        message: "No unpaid challans found for the selected timeframe",
        data: { added: 0, skipped: 0 },
      });
    }

    let addedCount = 0;
    let skippedCount = 0;

    for (const challan of unpaidChallans) {
      if (!challan.userId || !mongoose.Types.ObjectId.isValid(challan.userId)) {
        skippedCount++;
        continue;
      }

      try {
        const userObj = await User.findById(challan.userId).lean();
        if (!userObj) {
          skippedCount++;
          continue;
        }

        // Avoid duplicates
        const exists = await TeleChallan.exists({
          originalChallanId: challan._id,
        });
        if (exists) {
          skippedCount++;
          continue;
        }

        const courses =
          challan.secondEnrollChallan && userObj.secondEnrolledCourses?.length
            ? userObj.secondEnrolledCourses
            : userObj.courses;

        await TeleChallan.create({
          originalChallanId: challan._id,
          originalUserId: userObj._id,
          challanData: {
            challanId: challan.challanId,
            amount: challan.amount,
            paid: challan.paid,
            secondEnrollChallan: challan.secondEnrollChallan || false,
            dueDate: challan.dueDate || null,
            createdAt: challan.createdAt,
          },
          userData: {
            fullName: userObj.fullName,
            rollNumber: userObj.rollNumber,
            phone: userObj.mobile,
            email: userObj.email,
            city: userObj.city,
            courses,
          },
          status: "pending",
        });

        addedCount++;
      } catch (err) {
        if (err.code === 11000) skippedCount++;
        else console.error(`Error adding challan ${challan.challanId}:`, err);
      }
    }

    res.json({
      success: true,
      message: `Process complete. Added ${addedCount} records. Skipped ${skippedCount} (duplicates/invalid).`,
      data: { added: addedCount, skipped: skippedCount },
    });
  } catch (error) {
    console.error("Add tele-challans error:", error);
    res.status(500).json({
      success: false,
      message: "Server error adding to tele-list",
    });
  }
});

// Add note to a tele-challan
app.put("/api/tele-challans/:id/notes", async (req, res) => {
  try {
    const { note, admin } = req.body;
    const { id } = req.params;

    if (!note) {
      return res.status(400).json({
        success: false,
        message: "Note text is required",
      });
    }

    const updatedTeleChallan = await TeleChallan.findByIdAndUpdate(
      id,
      {
        $push: {
          notes: {
            text: note,
            admin: admin || "Admin", // Default or from payload
            date: new Date(),
          },
        },
      },
      { new: true }
    );

    if (!updatedTeleChallan) {
      return res.status(404).json({
        success: false,
        message: "Tele-challan record not found",
      });
    }

    res.json({
      success: true,
      data: updatedTeleChallan,
      message: "Note added successfully",
    });
  } catch (error) {
    console.error("Add tele-challan note error:", error);
    res.status(500).json({
      success: false,
      message: "Server error adding note",
    });
  }
});

// Update call status of a tele-challan
app.put("/api/tele-challans/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;

    if (!status || !['pending', 'called', 'resolved', 'unreachable'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Valid status ('pending', 'called', 'resolved', 'unreachable') is required",
      });
    }

    const updatedTeleChallan = await TeleChallan.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!updatedTeleChallan) {
      return res.status(404).json({
        success: false,
        message: "Tele-challan record not found",
      });
    }

    res.json({
      success: true,
      data: updatedTeleChallan,
      message: "Status updated successfully",
    });
  } catch (error) {
    console.error("Update tele-challan status error:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating status",
    });
  }
});

// Delete a single tele-challan
app.delete("/api/tele-challans/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deletedChallan = await TeleChallan.findByIdAndDelete(id);

    if (!deletedChallan) {
      return res.status(404).json({
        success: false,
        message: "Tele-challan not found",
      });
    }

    res.json({
      success: true,
      message: "Tele-challan deleted successfully",
      data: deletedChallan,
    });
  } catch (error) {
    console.error("Delete tele-challan error:", error);
    res.status(500).json({
      success: false,
      message: "Server error deleting tele-challan",
    });
  }
});

// Delete ALL tele-challans
app.delete("/api/tele-challans/delete/all", async (req, res) => {
  try {
    const result = await TeleChallan.deleteMany({});

    res.json({
      success: true,
      message: `All tele-challans deleted. Count: ${result.deletedCount}`,
      data: { deletedCount: result.deletedCount },
    });
  } catch (error) {
    console.error("Delete all tele-challans error:", error);
    res.status(500).json({
      success: false,
      message: "Server error deleting all tele-challans",
    });
  }
});

// Debug endpoint to check scholarships
app.get("/api/debug/scholarships", async (req, res) => {
  try {
    const scholarships = await Scholarship.find({}).limit(10);
    res.json({
      success: true,
      data: {
        count: scholarships.length,
        scholarships: scholarships.map((s) => ({
          id: s._id,
          fullName: s.fullName,
          cnic: s.cnic,
          email: s.email,
          rollNumber: s.rollNumber,
          status: s.status,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/health", (req, res) => {
  res.json({ status: "Server is running" });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
