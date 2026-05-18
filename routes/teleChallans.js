const express = require('express');
const TeleChallan = require('../models/TeleChallan');
const Challan = require('../models/Challan');
const { authenticateToken } = require('../middleware/auth');
const mongoose = require('mongoose');

const router = express.Router();

// @route   GET /api/tele-challans
// @desc    Get all tele-challans with pagination and filtering
// @access  Private (admin only)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 50, status, search, paid } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (status) {
      filter.status = status;
    }

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

// @route   POST /api/tele-challans/add
// @desc    Add unpaid challans to telemarketing follow-up list safely
// @access  Private (admin only)
router.post('/add', authenticateToken, async (req, res) => {
  try {
    const { days, startDate, endDate } = req.body;
    const User = require('../models/User');

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

// @route   PUT /api/tele-challans/:id/notes
// @desc    Add follow-up call note
// @access  Private (admin only)
router.put('/:id/notes', authenticateToken, async (req, res) => {
  try {
    const { note } = req.body;
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
            admin: req.user.username || "Admin",
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

// @route   PUT /api/tele-challans/:id/status
// @desc    Update call status of a tele-challan follow-up
// @access  Private (admin only)
router.put('/:id/status', authenticateToken, async (req, res) => {
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
    console.error("Update status error:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating status",
    });
  }
});

// @route   DELETE /api/tele-challans/:id
// @desc    Delete single telemarketing challan follow-up
// @access  Private (admin only)
router.delete('/:id', authenticateToken, async (req, res) => {
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

// @route   DELETE /api/tele-challans/delete/all
// @desc    Clear all telemarketing challan records
// @access  Private (admin only)
router.delete('/delete/all', authenticateToken, async (req, res) => {
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

module.exports = router;
