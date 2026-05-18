const mongoose = require("mongoose");
const { Schema } = mongoose;

const challanSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    challanId: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    paid: {
      type: Boolean,
      default: false,
    },
    branchCode: {
      type: Number,
    },
    txnId: {
      type: Number,
    },
    txnDate: {
      type: Date,
    },
    path: {
      type: String,
    },
    secondEnrollChallan: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

challanSchema.post('save', async function(doc) {
  try {
    const mongoose = require('mongoose');
    let TeleChallan;
    try {
      TeleChallan = mongoose.model('TeleChallan');
    } catch (e) {
      TeleChallan = require('./TeleChallan');
    }

    if (!doc.paid) {
      // Unpaid: auto-add to telemarketing list
      const exists = await TeleChallan.exists({ originalChallanId: doc._id });
      if (!exists) {
        let User;
        try {
          User = mongoose.model('User');
        } catch (e) {
          User = require('./User');
        }
        const userObj = await User.findById(doc.userId);
        if (userObj) {
          const courses = (doc.secondEnrollChallan && userObj.secondEnrolledCourses?.length)
            ? userObj.secondEnrolledCourses
            : userObj.courses;

          await TeleChallan.create({
            originalChallanId: doc._id,
            originalUserId: userObj._id,
            challanData: {
              challanId: doc.challanId,
              amount: doc.amount,
              paid: doc.paid,
              secondEnrollChallan: doc.secondEnrollChallan || false,
              dueDate: doc.dueDate || null,
              createdAt: doc.createdAt,
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
          console.log(`Automatically added unpaid challan ${doc.challanId} to Telemarketing List.`);
        }
      }
    } else {
      // Paid: auto-remove from telemarketing list
      const result = await TeleChallan.deleteOne({ originalChallanId: doc._id });
      if (result.deletedCount > 0) {
        console.log(`Automatically removed paid challan ${doc.challanId} from Telemarketing List.`);
      }
    }
  } catch (error) {
    console.error("Error in Challan post-save middleware:", error);
  }
});

module.exports = mongoose.model("Challan", challanSchema);
