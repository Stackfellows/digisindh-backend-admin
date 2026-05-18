const mongoose = require('mongoose');

const teleChallanSchema = new mongoose.Schema({
  originalChallanId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Challan',
    required: true
  },
  originalUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Snapshot of challan data
  challanData: {
    challanId: { type: String, required: true },
    amount: { type: Number, required: true },
    paid: { type: Boolean, default: false },
    secondEnrollChallan: { type: Boolean, default: false },
    dueDate: Date,
    createdAt: Date
  },
  // Snapshot of user data
  userData: {
    fullName: { type: String, required: true },
    rollNumber: { type: String },
    phone: { type: String },
    email: { type: String },
    city: { type: String }
  },
  status: {
    type: String,
    enum: ['pending', 'called', 'resolved', 'unreachable'],
    default: 'pending'
  },
  adminNote: {
    type: String
  },
  assignedDate: {
    type: Date,
    default: Date.now
  },
  notes: [{
    text: String,
    date: { type: Date, default: Date.now },
    admin: String
  }]
}, {
  timestamps: true
});

// Compound index to prevent adding the same challan multiple times
teleChallanSchema.index({ originalChallanId: 1 }, { unique: true });

module.exports = mongoose.model('TeleChallan', teleChallanSchema);
