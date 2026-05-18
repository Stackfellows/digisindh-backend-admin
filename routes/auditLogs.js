const express = require('express');
const AuditLog = require('../models/AuditLog');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/audit-logs/:entityType/:entityId
// @desc    Get audit logs for a specific entity
// @access  Private (admin only)
router.get('/:entityType/:entityId', authenticateToken, async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Validate entity type
    if (!['user', 'challan', 'scholarship'].includes(entityType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid entity type'
      });
    }

    const auditLogs = await AuditLog.find({
      entityType,
      entityId
    })
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(limitNum);

    const total = await AuditLog.countDocuments({
      entityType,
      entityId
    });

    res.json({
      success: true,
      data: auditLogs,
      pagination: {
        current: pageNum,
        pages: Math.ceil(total / limitNum),
        total,
        limit: limitNum
      }
    });

  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/audit-logs
// @desc    Get all audit logs with pagination
// @access  Private (admin only)
router.get('/', authenticateToken, async (req, res) => {
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
        limit: limitNum
      }
    });

  } catch (error) {
    console.error('Get all audit logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router; 