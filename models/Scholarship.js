const mongoose = require('mongoose');

const scholarshipSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  cnic: { type: String, required: true },
  rollNumber: { type: String, required: true },
  email: { type: String, required: true },
  mobileNumber: { type: String, required: true },
  challanNumber: { type: String, required: true },
  imagePath: { type: String },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  appliedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Index for better query performance
scholarshipSchema.index({ status: 1 });
scholarshipSchema.index({ rollNumber: 1 });
scholarshipSchema.index({ cnic: 1 });
scholarshipSchema.index({ email: 1 });
scholarshipSchema.index({ appliedAt: -1 });

module.exports = mongoose.model('Scholarship', scholarshipSchema); 