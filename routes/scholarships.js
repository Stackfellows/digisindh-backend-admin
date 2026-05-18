const express = require('express');
const Scholarship = require('../models/Scholarship');
const AuditLog = require('../models/AuditLog');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/scholarships/stats
// @desc    Get scholarship statistics
// @access  Private
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const totalScholarships = await Scholarship.countDocuments();
    const pendingScholarships = await Scholarship.countDocuments({ status: 'pending' });
    const approvedScholarships = await Scholarship.countDocuments({ status: 'approved' });
    const rejectedScholarships = await Scholarship.countDocuments({ status: 'rejected' });

    // Recent scholarships (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentScholarships = await Scholarship.countDocuments({
      appliedAt: { $gte: thirtyDaysAgo }
    });

    res.json({
      success: true,
      data: {
        total: totalScholarships,
        pending: pendingScholarships,
        approved: approvedScholarships,
        rejected: rejectedScholarships,
        recent: recentScholarships
      }
    });

  } catch (error) {
    console.error('Error fetching scholarship stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch scholarship statistics'
    });
  }
});

// @route   GET /api/scholarships
// @desc    Get all scholarships with pagination and filters
// @access  Private
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search, 
      status,
      startDate,
      endDate
    } = req.query;

    // Build filter object
    const filter = {};

    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { rollNumber: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { cnic: { $regex: search, $options: 'i' } },
        { mobileNumber: { $regex: search, $options: 'i' } },
        { challanNumber: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status && status !== '') {
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
      Scholarship.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: {
        scholarships,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Get scholarships error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/scholarships/download
// @desc    Download scholarships as CSV
// @access  Private
router.get('/download', authenticateToken, async (req, res) => {
  try {
    const { search, status, startDate, endDate } = req.query;

    // Build the same filter as the main scholarships route
    const filter = {};

    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { rollNumber: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { cnic: { $regex: search, $options: 'i' } },
        { mobileNumber: { $regex: search, $options: 'i' } },
        { challanNumber: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status && status !== '') {
      filter.status = status;
    }
    
    if (startDate || endDate) {
      filter.appliedAt = {};
      if (startDate) filter.appliedAt.$gte = new Date(startDate);
      if (endDate) filter.appliedAt.$lte = new Date(endDate);
    }

    // Get ALL matching scholarships (no pagination for download)
    const scholarships = await Scholarship.find(filter)
      .sort({ appliedAt: -1 });

    // Convert to CSV format
    const csvHeaders = [
      'Full Name',
      'CNIC', 
      'Roll Number',
      'Email',
      'Mobile Number',
      'Challan Number',
      'Status',
      'Applied Date',
      'Created Date',
      'Updated Date'
    ];

    const csvRows = scholarships.map(scholarship => [
      scholarship.fullName || '',
      scholarship.cnic || '',
      scholarship.rollNumber || '',
      scholarship.email || '',
      scholarship.mobileNumber || '',
      scholarship.challanNumber || '',
      scholarship.status || '',
      scholarship.appliedAt ? new Date(scholarship.appliedAt).toLocaleDateString() : '',
      new Date(scholarship.createdAt).toLocaleDateString(),
      new Date(scholarship.updatedAt).toLocaleDateString()
    ]);

    // Create CSV content
    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(field => `"${field}"`).join(','))
    ].join('\n');

    // Set response headers for file download
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `scholarships_export_${timestamp}.csv`;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);

  } catch (error) {
    console.error('Download scholarships error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download scholarships data'
    });
  }
});

// @route   PUT /api/scholarships/:id
// @desc    Update scholarship
// @access  Private
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { reason, ...updateData } = req.body;
    const scholarshipId = req.params.id;

    // Get original scholarship data
    const originalScholarship = await Scholarship.findById(scholarshipId);
    if (!originalScholarship) {
      return res.status(404).json({
        success: false,
        message: 'Scholarship not found'
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
    Object.keys(updateData).forEach(key => {
      if (originalScholarship[key] !== updateData[key]) {
        changes[key] = {
          old: originalScholarship[key],
          new: updateData[key]
        };
      }
    });

    if (Object.keys(changes).length > 0) {
      await AuditLog.create({
        entityType: 'scholarship',
        entityId: scholarshipId,
        action: 'update',
        changes,
        adminUser: req.user.username || 'admin', // Use authenticated user
        reason: reason || 'No reason provided'
      });
    }

    res.json({
      success: true,
      data: updatedScholarship
    });

  } catch (error) {
    console.error('Update scholarship error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/scholarships/:id
// @desc    Get scholarship by ID
// @access  Private
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const scholarship = await Scholarship.findById(req.params.id);
    if (!scholarship) {
      return res.status(404).json({
        success: false,
        message: 'Scholarship not found'
      });
    }

    res.json({
      success: true,
      data: scholarship
    });

  } catch (error) {
    console.error('Get scholarship error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});
// @route   POST /api/scholarships/apply
// @desc    Submit new scholarship application
// @access  Public
router.post('/apply', async (req, res) => {
  try {
    const newScholarship = new Scholarship(req.body);
    await newScholarship.save();
    res.status(201).json({
      success: true,
      data: newScholarship
    });
  } catch (error) {
    console.error('Apply scholarship error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit application'
    });
  }
});

// @route   PUT /api/scholarships/:id/status
// @desc    Update scholarship status
// @access  Private
router.put('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status, reason } = req.body;
    const scholarshipId = req.params.id;

    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const originalScholarship = await Scholarship.findById(scholarshipId);
    if (!originalScholarship) {
      return res.status(404).json({
        success: false,
        message: 'Scholarship not found'
      });
    }

    const updatedScholarship = await Scholarship.findByIdAndUpdate(
      scholarshipId,
      { status },
      { new: true }
    );

    // Create audit log for status change
    await AuditLog.create({
      entityType: 'scholarship',
      entityId: scholarshipId,
      action: 'status_change',
      changes: {
        status: {
          old: originalScholarship.status,
          new: status
        }
      },
      adminUser: req.user.username,
      reason: reason || 'Status updated via status endpoint'
    });

    res.json({
      success: true,
      data: updatedScholarship
    });

  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/scholarships/:id
// @desc    Delete scholarship application
// @access  Private
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const scholarshipId = req.params.id;
    const { reason } = req.body;

    const scholarship = await Scholarship.findById(scholarshipId);
    if (!scholarship) {
      return res.status(404).json({
        success: false,
        message: 'Scholarship not found'
      });
    }

    await Scholarship.findByIdAndDelete(scholarshipId);

    // Create audit log for deletion
    await AuditLog.create({
      entityType: 'scholarship',
      entityId: scholarshipId,
      action: 'delete',
      changes: { deleted: { old: scholarship, new: null } },
      adminUser: req.user.username,
      reason: reason || 'Application deleted by admin'
    });

    res.json({
      success: true,
      message: 'Scholarship application deleted successfully'
    });

  } catch (error) {
    console.error('Delete scholarship error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router; 