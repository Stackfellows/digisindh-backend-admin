const express = require('express');
const DigiSindhPsidTracking = require('../models/DigiSindhPsidTracking');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/digisindhpsidtrackings
// @desc    Get all DigiSindh Program PSIDs with filtering
// @access  Private (admin only)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, search, course } = req.query;
    const filter = {};

    if (status) filter.paymentStatus = status;
    if (course) filter.course = course;
    if (search) {
      filter.$or = [
        { studentName: { $regex: search, $options: 'i' } },
        { studentRollNumber: { $regex: search, $options: 'i' } },
        { challanNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const trackings = await DigiSindhPsidTracking.find(filter).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: trackings
    });
  } catch (error) {
    console.error('Error fetching DigiSindh PSIDs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch DigiSindh Program PSID data'
    });
  }
});

// @route   PUT /api/digisindhpsidtrackings/:id
// @desc    Update status of a DigiSindh PSID
// @access  Private (admin only)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    const updated = await DigiSindhPsidTracking.findByIdAndUpdate(
      req.params.id,
      { paymentStatus: status },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Record not found'
      });
    }

    res.json({
      success: true,
      data: updated
    });
  } catch (error) {
    console.error('Error updating DigiSindh PSID:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update status'
    });
  }
});

module.exports = router;
