
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs-extra');
// const rateLimit = require('express-rate-limit'); // Removed - no longer using rate limiting
const { pool, testConnection } = require('./config/database');
const SignalingServer = require('./signalingServer');
const logger = require('./utils/logger');
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

// Import middleware
const { visitorTrackingRateLimit } = require('./middleware/visitorTracking');
const scheduledNotificationProcessor = require('./services/scheduledNotificationProcessor');
const contractScheduler = require('./services/contractScheduler');

// Initialize express app
const app = express();
const server = http.createServer(app);

// Make app context available globally for activity broadcasting
global.app = app;

// Initialize socket.io
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || process.env.MOBILE_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

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
  logger.error('No CORS origins configured. Please set CLIENT_URL and/or MOBILE_URL environment variables.');
  process.exit(1);
}

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  optionsSuccessStatus: 200
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/*app.get("/", (req, res) => {
  res.send("🎉 Welcome to CV-Connect backend! The server is running.");
});*/

// Rate limiting removed to prevent login blocking
// Users can now login without being blocked by rate limits

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

// Make io globally available for notifications
global.io = io;

// Initialize signaling server for WebRTC (integrated with main io server)
const signalingServer = new SignalingServer(io);

// Socket.io event handlers
io.on('connection', (socket) => {
  logger.debug('User connected:', socket.id);

  // Add WebRTC signaling handlers
  signalingServer.addWebRTCHandlers(socket);

  // Join user room for notifications
  socket.on('join_user_room', (userId) => {
    socket.join(`user_${userId}`);
    logger.debug(`Socket ${socket.id} joined user room ${userId}`);
  });

  // Leave user room
  socket.on('leave_user_room', (userId) => {
    socket.leave(`user_${userId}`);
    logger.debug(`Socket ${socket.id} left user room ${userId}`);
  });

  // Join a conversation room
  socket.on('join_conversation', (conversationId) => {
    socket.join(`conversation-${conversationId}`);
    logger.debug(`Socket ${socket.id} joined conversation ${conversationId}`);
  });

  // Leave a conversation room
  socket.on('leave_conversation', (conversationId) => {
    socket.leave(`conversation-${conversationId}`);
    logger.debug(`Socket ${socket.id} left conversation ${conversationId}`);
  });

  // Send a message
  socket.on('send_message', async (messageData) => {
    try {
      const { conversation_id, sender_id, content } = messageData;
      
      // Insert message into database
      const result = await pool.query(
        'INSERT INTO "Message" (conversation_id, sender_id, content, sent_at, is_delivered) VALUES ($1, $2, $3, NOW(), true) RETURNING *',
        [conversation_id, sender_id, content]
      );
      
      const newMessage = result.rows[0];
      
      // Emit to all users in the conversation
      io.to(`conversation-${conversation_id}`).emit('receive_message', newMessage);
      
    } catch (error) {
      logger.error('Error sending message:', error);
      socket.emit('message_error', { message: 'Failed to send message' });
    }
  });

  // Handle typing indicators
  socket.on('typing', (data) => {
    const { conversation_id, user_id, typing } = data;
    socket.to(`conversation-${conversation_id}`).emit('user_typing', { user_id, typing });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    logger.debug('User disconnected:', socket.id);
  });
});

// Start the server
const PORT = process.env.PORT || 5000;

// Test database connection before starting server
(async () => {
  const dbConnected = await testConnection();
  
  if (dbConnected) {
    server.listen(PORT, () => {
      logger.production(`Server running on port ${PORT}`);
      logger.production(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.production(`📡 Signaling server ready for WebRTC connections`);
    });
  } else {
    logger.error('Unable to connect to the database. Server not started.');
    process.exit(1);
  }
})();

// Start scheduled notification processor
scheduledNotificationProcessor.start();

// Start contract expiration scheduler
contractScheduler.start();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.production('Gracefully shutting down...');
  
  // Stop scheduled notification processor
  scheduledNotificationProcessor.stop();
  
  // Stop contract expiration scheduler
  contractScheduler.stop();
  
  // Close the database pool
  await pool.end();
  logger.production('Database pool closed.');
  // Close the server
  server.close(() => {
    logger.production('Server closed.');
    process.exit(0);
  });
});


