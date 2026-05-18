const express = require('express');
const User = require('../models/User');
const Challan = require('../models/Challan');
const Scholarship = require('../models/Scholarship');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/analytics/dashboard
// @desc    Get dashboard statistics
// @access  Private (admin only)
router.get('/dashboard', authenticateToken, async (req, res) => {
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
      approvedScholarships
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isVerified: true }),
      Challan.countDocuments(),
      Challan.countDocuments({ paid: true }),
      Challan.countDocuments({ paid: false }),
      Scholarship.countDocuments(),
      Scholarship.countDocuments({ status: 'pending' }),
      Scholarship.countDocuments({ status: 'approved' })
    ]);

    // Get total revenue
    const revenueResult = await Challan.aggregate([
      { $match: { paid: true } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalRevenue = revenueResult[0]?.total || 0;

    // Get pending revenue
    const pendingRevenueResult = await Challan.aggregate([
      { $match: { paid: false } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const pendingRevenue = pendingRevenueResult[0]?.total || 0;

    // Get recent users (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentUsers = await User.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    // Get recent challans (last 30 days)
    const recentChallans = await Challan.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    // Get recent scholarships (last 30 days)
    const recentScholarships = await Scholarship.countDocuments({
      appliedAt: { $gte: thirtyDaysAgo }
    });

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          verified: verifiedUsers,
          unverified: totalUsers - verifiedUsers,
          recent: recentUsers
        },
        challans: {
          total: totalChallans,
          paid: paidChallans,
          unpaid: unpaidChallans,
          recent: recentChallans
        },
        scholarships: {
          total: totalScholarships,
          pending: pendingScholarships,
          approved: approvedScholarships,
          rejected: totalScholarships - pendingScholarships - approvedScholarships,
          recent: recentScholarships
        },
        revenue: {
          total: totalRevenue,
          pending: pendingRevenue,
          collected: totalRevenue
        }
      }
    });

  } catch (error) {
    console.error('Get dashboard analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/analytics/charts/users
// @desc    Get user registration chart data
// @access  Private (admin only)
router.get('/charts/users', authenticateToken, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const userStats = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]);

    res.json({
      success: true,
      data: { userStats }
    });

  } catch (error) {
    console.error('Get user chart data error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/analytics/charts/revenue
// @desc    Get revenue chart data
// @access  Private (admin only)
router.get('/charts/revenue', authenticateToken, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const revenueStats = await Challan.aggregate([
      {
        $match: {
          paid: true,
          txnDate: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$txnDate' },
            month: { $month: '$txnDate' },
            day: { $dayOfMonth: '$txnDate' }
          },
          revenue: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]);

    res.json({
      success: true,
      data: { revenueStats }
    });

  } catch (error) {
    console.error('Get revenue chart data error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/analytics/gender-distribution
// @desc    Get gender distribution
// @access  Private (admin only)
router.get('/gender-distribution', authenticateToken, async (req, res) => {
  try {
    const genderStats = await User.aggregate([
      {
        $group: {
          _id: '$gender',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: { genderStats }
    });

  } catch (error) {
    console.error('Get gender distribution error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/analytics/city-distribution
// @desc    Get city-wise user distribution
// @access  Private (admin only)
router.get('/city-distribution', authenticateToken, async (req, res) => {
  try {
    const cityStats = await User.aggregate([
      {
        $group: {
          _id: '$city',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 10
      }
    ]);

    res.json({
      success: true,
      data: { cityStats }
    });

  } catch (error) {
    console.error('Get city distribution error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router; 