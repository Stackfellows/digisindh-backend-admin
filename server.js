const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000', 
    'http://127.0.0.1:3000', 
    'http://localhost:3100', 
    'http://127.0.0.1:3100',
    'http://localhost:5002',
    'http://127.0.0.1:5002',
    'http://localhost:5003',
    'http://127.0.0.1:5003',
    'http://localhost:5001',
    'http://127.0.0.1:5001',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'https://admin.stackfellows.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const challanRoutes = require('./routes/challans');
const scholarshipRoutes = require('./routes/scholarships');
const analyticsRoutes = require('./routes/analytics');
const auditLogRoutes = require('./routes/auditLogs');
const digisindhPsidRoutes = require('./routes/digisindhPsids');
const courseRoutes = require('./routes/courses');
const teleChallanRoutes = require('./routes/teleChallans');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/challans', challanRoutes);
app.use('/api/scholarships', scholarshipRoutes);
app.use('/api/scholarship', scholarshipRoutes); // Alias for singular
app.use('/api/analytics', analyticsRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/digisindhpsidtrackings', digisindhPsidRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/tele-challans', teleChallanRoutes);

// Serve uploads
app.use('/uploads', express.static('uploads'));

// Basic health check route
app.get('/', (req, res) => {
  res.json({ message: 'Admin Panel API is running!' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!'
  });
});

// Handle 404 routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
