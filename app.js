const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs-extra');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const freelancerRoutes = require('./routes/freelancer');
const associateRoutes = require('./routes/associate');
const adminRoutes = require('./routes/admin');
const searchRoutes = require('./routes/search');
const messageRoutes = require('./routes/message');
const associateRequestRoutes = require('./routes/associateRequest');
const hiringRoutes = require('./routes/hiring');
const interviewRoutes = require('./routes/interview');
const visitorRoutes = require('./routes/visitor');
const notificationRoutes = require('./routes/notifications');

// Import middleware
const { visitorTrackingRateLimit } = require('./middleware/visitorTracking');

// Initialize express app
const app = express();

// Create necessary directories
fs.ensureDirSync('./uploads/cvs');
fs.ensureDirSync('./uploads/profile_images');

// Apply middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.MOBILE_URL,
  'http://localhost:3000', // Development fallback
  'http://localhost:3001'  // Alternative development port
].filter(Boolean); // Remove undefined values

if (allowedOrigins.length === 0) {
  throw new Error('No CORS origins configured. Please set CLIENT_URL and/or MOBILE_URL environment variables.');
}

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  optionsSuccessStatus: 200
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add visitor tracking middleware (before routes)
app.use(visitorTrackingRateLimit);

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/freelancer', freelancerRoutes);
app.use('/api/associate', associateRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/message', messageRoutes);
app.use('/api/associate-request', associateRequestRoutes);
app.use('/api/hiring', hiringRoutes);
app.use('/api/interview', interviewRoutes);
app.use('/api/visitor', visitorRoutes);
app.use('/api/notifications', notificationRoutes);

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/cv', express.static(path.join(__dirname, 'uploads/cvs')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'CV-Connect Backend',
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

module.exports = { app };
