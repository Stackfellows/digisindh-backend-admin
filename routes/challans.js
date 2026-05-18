const express = require('express');
const Challan = require('../models/Challan');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { authenticateToken } = require('../middleware/auth');
const mongoose = require('mongoose');

const router = express.Router();

// @route   GET /api/challans/stats
// @desc    Get challan statistics (counts and revenue)
// @access  Private (admin only)
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const totalChallans = await Challan.countDocuments();
    const paidChallans = await Challan.countDocuments({ paid: true });
    const unpaidChallans = await Challan.countDocuments({ paid: false });

    // Calculate revenue
    const paidChallanData = await Challan.find({ paid: true }).select('amount');
    const unpaidChallanData = await Challan.find({ paid: false }).select('amount');

    const totalRevenue = paidChallanData.reduce((sum, challan) => sum + challan.amount, 0);
    const pendingRevenue = unpaidChallanData.reduce((sum, challan) => sum + challan.amount, 0);

    // Recent challans (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentChallans = await Challan.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    res.json({
      success: true,
      data: {
        total: totalChallans,
        paid: paidChallans,
        unpaid: unpaidChallans,
        totalRevenue,
        pendingRevenue,
        recent: recentChallans
      }
    });
  } catch (error) {
    console.error('Error fetching challan stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch challan statistics'
    });
  }
});

// @route   GET /api/challans
// @desc    Get all challans with pagination and filters
// @access  Private (admin only)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const paid = req.query.paid;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const minAmount = req.query.minAmount;
    const maxAmount = req.query.maxAmount;

    // Build filter object
    const filter = {};

    if (search) {
      filter.$or = [
        { challanId: { $regex: search, $options: 'i' } }
      ];

      // If search is a number, also search txnId
      if (!isNaN(search) && search.trim() !== '') {
        filter.$or.push({ txnId: parseInt(search) });
      }
    }

    if (paid !== undefined) {
      filter.paid = paid === 'true';
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

    const skip = (page - 1) * limit;

    const [challans, total] = await Promise.all([
      Challan.find(filter)
        .lean()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Challan.countDocuments(filter)
    ]);

    // Safely populate user data with error handling
    const challansWithUsers = await Promise.all(challans.map(async (challan) => {
      try {
        if (challan.userId && mongoose.Types.ObjectId.isValid(challan.userId)) {
          const user = await User.findById(challan.userId)
            .select('fullName email rollNumber mobile')
            .lean();

          if (user) {
            return {
              ...challan,
              userId: user
            };
          }
        }

        // Return challan with placeholder user data
        return {
          ...challan,
          userId: {
            _id: challan.userId || 'invalid',
            fullName: 'User Not Found',
            email: 'N/A',
            rollNumber: 'N/A',
            mobile: 'N/A'
          }
        };
      } catch (error) {
        console.log(`Error populating user for challan ${challan.challanId}:`, error.message);
        return {
          ...challan,
          userId: {
            _id: challan.userId || 'error',
            fullName: 'Error Loading User',
            email: 'N/A',
            rollNumber: 'N/A',
            mobile: 'N/A'
          }
        };
      }
    }));

    res.json({
      success: true,
      data: {
        challans: challansWithUsers,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total,
          limit
        }
      }
    });

  } catch (error) {
    console.error('Get challans error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/challans/download
// @desc    Download challans as CSV
// @access  Private
router.get('/download', authenticateToken, async (req, res) => {
  try {
    const { search, paid, startDate, endDate, minAmount, maxAmount } = req.query;

    // Build the same filter as the main challans route
    const filter = {};

    if (search) {
      filter.$or = [
        { challanId: { $regex: search, $options: 'i' } }
      ];

      // If search is a number, also search txnId
      if (!isNaN(search) && search.trim() !== '') {
        filter.$or.push({ txnId: parseInt(search) });
      }
    }

    if (paid !== undefined) {
      filter.paid = paid === 'true';
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
    const challans = await Challan.find(filter)
      .lean()
      .sort({ createdAt: -1 });

    // Handle orphaned challans and invalid ObjectIds
    const validChallans = await Promise.all(challans.map(async (challan) => {
      try {
        // Check if userId is a valid ObjectId
        if (challan.userId && mongoose.Types.ObjectId.isValid(challan.userId)) {
          // Try to populate user data
          const user = await User.findById(challan.userId)
            .select('fullName email rollNumber mobile cnic courses')
            .lean();

          if (user) {
            return {
              ...challan,
              userId: user
            };
          }
        }

        // If userId is invalid or user not found, return with placeholder data
        return {
          ...challan,
          userId: {
            _id: 'invalid',
            fullName: 'Invalid User ID',
            email: 'N/A',
            rollNumber: 'N/A',
            mobile: 'N/A',
            courses: ['N/A', 'N/A'],
            cnic: 'N/A'
          }
        };
      } catch (error) {
        console.log(`Error processing challan ${challan.challanId}:`, error.message);
        // Return challan with error placeholder
        return {
          ...challan,
          userId: {
            _id: 'error',
            fullName: 'Error Loading User',
            email: 'N/A',
            rollNumber: 'N/A',
            mobile: 'N/A',
            courses: ['N/A', 'N/A'],
            cnic: 'N/A'
          }
        };
      }
    }));

    // Convert to CSV format
    const csvHeaders = [
      'Challan ID',
      'Student Name',
      'Roll Number',
      'Email',
      'Mobile',
      'CNIC',
      'Course 1',
      'Course 2',
      'Amount',
      'Payment Status',
      'Transaction ID',
      'Transaction Date',
      'Branch Code',
      'Created Date',
      'Updated Date'
    ];

    const csvRows = validChallans.map(challan => [
      challan.challanId || '',
      challan.userId?.fullName || '',
      challan.userId?.rollNumber || '',
      challan.userId?.email || '',
      challan.userId?.mobile || '',
      challan.userId?.cnic || '',
      (challan.userId?.courses[0] || ""),
      (challan.userId?.courses[1] || ""),
      challan.amount || 0,
      challan.paid ? 'Paid' : 'Unpaid',
      challan.txnId || '',
      challan.txnDate ? new Date(challan.txnDate).toLocaleDateString() : '',
      challan.branchCode || '',
      new Date(challan.createdAt).toLocaleDateString(),
      new Date(challan.updatedAt).toLocaleDateString()
    ]);

    // Create CSV content
    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(field => `"${field}"`).join(','))
    ].join('\n');

    // Set response headers for file download
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `challans_export_${timestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);

  } catch (error) {
    console.error('Download challans error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download challans data'
    });
  }
});

// @route   GET /api/challans/:id
// @desc    Get challan by ID
// @access  Private (admin only)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid challan ID format'
      });
    }

    const challan = await Challan.findById(req.params.id)
      .lean();

    if (!challan) {
      return res.status(404).json({
        success: false,
        message: 'Challan not found'
      });
    }

    // Safely populate user data
    let challanWithUser = challan;
    if (challan.userId && mongoose.Types.ObjectId.isValid(challan.userId)) {
      try {
        const user = await User.findById(challan.userId)
          .select('fullName email rollNumber mobile cnic fatherName')
          .lean();

        if (user) {
          challanWithUser = {
            ...challan,
            userId: user
          };
        } else {
          challanWithUser = {
            ...challan,
            userId: {
              _id: challan.userId,
              fullName: 'User Not Found',
              email: 'N/A',
              rollNumber: 'N/A',
              mobile: 'N/A',
              cnic: 'N/A',
              fatherName: 'N/A'
            }
          };
        }
      } catch (error) {
        console.log(`Error populating user for challan ${challan._id}:`, error.message);
        challanWithUser = {
          ...challan,
          userId: {
            _id: challan.userId,
            fullName: 'Error Loading User',
            email: 'N/A',
            rollNumber: 'N/A',
            mobile: 'N/A',
            cnic: 'N/A',
            fatherName: 'N/A'
          }
        };
      }
    } else if (challan.userId) {
      // Invalid ObjectId
      challanWithUser = {
        ...challan,
        userId: {
          _id: challan.userId,
          fullName: 'Invalid User ID',
          email: 'N/A',
          rollNumber: 'N/A',
          mobile: 'N/A',
          cnic: 'N/A',
          fatherName: 'N/A'
        }
      };
    }

    res.json({
      success: true,
      data: { challan: challanWithUser }
    });

  } catch (error) {
    console.error('Get challan error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/challans/user/:userId
// @desc    Get challans for a specific user
// @access  Private (admin only)
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    const challans = await Challan.find({ userId: req.params.userId })
      .lean()
      .sort({ createdAt: -1 });

    // Safely populate user data
    const challansWithUsers = await Promise.all(challans.map(async (challan) => {
      try {
        if (challan.userId && mongoose.Types.ObjectId.isValid(challan.userId)) {
          const user = await User.findById(challan.userId)
            .select('fullName email rollNumber')
            .lean();

          if (user) {
            return {
              ...challan,
              userId: user
            };
          }
        }

        // Return challan with placeholder user data
        return {
          ...challan,
          userId: {
            _id: challan.userId || 'invalid',
            fullName: 'User Not Found',
            email: 'N/A',
            rollNumber: 'N/A'
          }
        };
      } catch (error) {
        console.log(`Error populating user for challan ${challan._id}:`, error.message);
        return {
          ...challan,
          userId: {
            _id: challan.userId || 'error',
            fullName: 'Error Loading User',
            email: 'N/A',
            rollNumber: 'N/A'
          }
        };
      }
    }));

    res.json({
      success: true,
      data: { challans: challansWithUsers }
    });

  } catch (error) {
    console.error('Get user challans error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/challans/:id
// @desc    Update challan by ID
// @access  Private (admin only)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { reason, ...updateData } = req.body;
    const challanId = req.params.id;

    // Get original challan data
    const originalChallan = await Challan.findById(challanId);
    if (!originalChallan) {
      return res.status(404).json({
        success: false,
        message: 'Challan not found'
      });
    }

    // Update challan
    const updatedChallan = await Challan.findByIdAndUpdate(
      challanId,
      updateData,
      { new: true }
    ).populate('userId', 'fullName email rollNumber mobile');

    // Create audit log
    const changes = {};
    Object.keys(updateData).forEach(key => {
      if (JSON.stringify(originalChallan[key]) !== JSON.stringify(updateData[key])) {
        changes[key] = {
          old: originalChallan[key],
          new: updateData[key]
        };
      }
    });

    if (Object.keys(changes).length > 0) {
      await AuditLog.create({
        entityType: 'challan',
        entityId: challanId,
        action: 'update',
        changes: changes,
        adminUser: req.user.username,
        reason: reason || 'No reason provided'
      });
    }

    res.json({
      success: true,
      message: 'Challan updated successfully',
      data: { challan: updatedChallan }
    });

  } catch (error) {
    console.error('Update challan error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
