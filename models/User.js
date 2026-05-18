const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    rollNumber: {
      type: String,
      unique: true,
      required: true,
    },
    secondRollNumber: {
      type: String,
      unique: true,
      required: false,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    fullName: {
      type: String,
      required: true,
    },
    fatherName: {
      type: String,
      required: true,
    },
    cnic: {
      type: String,
      required: true,
      unique: true,
    },
    mobile: {
      type: String,
      required: true,
    },
    dateOfBirth: {
      type: Date,
      required: true,
    },
    gender: {
      type: String,
      required: true,
    },
    qualification: {
      type: String,
      required: true,
    },
    cnicBack: {
      type: String, // URL to the uploaded file
      default: null,
    },
    courses: {
      type: [String],
      default: [],
    },
    secondEnrolledCourses: {
      type: [String],
      default: [],
    },
    physicalCourses: {
      type: [String],
      default: [],
    },
    permanentAddress: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    cnicFront: {
      type: String, // URL to the uploaded file
      default: null,
    },
    isVerified: {
      type: Boolean,
      default: false,
      required: true,
    },
    verifyToken: {
      type: String,
      default: "",
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    testScore: {
      type: Number,
      default: null,
    },
    testPassed: {
      type: Boolean,
      default: false,
    },
    referralCode: {
      type: String,
      allowNull: true,
    },
    photo: {
      type: String,
      default: null,
    },
    admissionType: {
      type: [String],
      enum: ["online", "physical"],
      default: ["online"],
    },
  },

  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);
