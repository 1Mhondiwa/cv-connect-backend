
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs-extra');
const rateLimit = require('express-rate-limit');
const { pool, testConnection } = require('./config/database');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const freelancerRoutes = require('./routes/freelancer');
const associateRoutes = require('./routes/associate');
const adminRoutes = require('./routes/admin');
const searchRoutes = require('./routes/search');
const messageRoutes = require('./routes/message');

// Initialize express app
const app = express();
const server = http.createServer(app);

// Initialize socket.io
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "*",
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
app.use(cors({
  origin: [process.env.CLIENT_URL, process.env.MOBILE_URL],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

// Apply rate limiting to all routes
app.use('/api', limiter);

// Stricter rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login/register attempts per 15 minutes
  message: 'Too many authentication attempts, please try again later.'
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/freelancer', freelancerRoutes);
app.use('/api/associate', associateRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/message', messageRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Socket.io event handlers
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join a conversation room
  socket.on('join_conversation', (conversationId) => {
    socket.join(`conversation-${conversationId}`);
    console.log(`Socket ${socket.id} joined conversation ${conversationId}`);
  });

  // Leave a conversation room
  socket.on('leave_conversation', (conversationId) => {
    socket.leave(`conversation-${conversationId}`);
    console.log(`Socket ${socket.id} left conversation ${conversationId}`);
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
      console.error('Error sending message:', error);
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
    console.log('User disconnected:', socket.id);
  });
});

// Start the server
const PORT = process.env.PORT || 5000;

// Test database connection before starting server
(async () => {
  const dbConnected = await testConnection();
  
  if (dbConnected) {
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } else {
    console.error('Unable to connect to the database. Server not started.');
    process.exit(1);
  }
})();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Gracefully shutting down...');
  // Close the database pool
  await pool.end();
  console.log('Database pool closed.');
  // Close the server
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});