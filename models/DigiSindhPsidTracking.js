const mongoose = require("mongoose");

// Use default mongoose connection


const digisindhPsidTrackingSchema = new mongoose.Schema(
  {
    challanNumber: {
      type: String,
      required: true,
      unique: true,
    },
    studentId: {
      type: String,
      required: false,
    },
    studentName: {
      type: String,
    },
    studentRollNumber: {
      type: String,
    },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid", "pending"],
      default: "unpaid",
    },
    course: {
      type: String,
    },
  },
  {
    timestamps: true,
    collection: 'digisindhpsidtrackings'
  }
);

const DigiSindhPsidTracking = mongoose.model("DigiSindhPsidTracking", digisindhPsidTrackingSchema);

module.exports = DigiSindhPsidTracking;
