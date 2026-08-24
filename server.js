const http = require('http');
const socketIo = require('socket.io');
const { pool, testConnection } = require('./config/database');
const SignalingServer = require('./signalingServer');
const logger = require('./utils/logger');
const { app } = require('./app');

const scheduledNotificationProcessor = require('./services/scheduledNotificationProcessor');
const contractScheduler = require('./services/contractScheduler');

// Initialize http server + socket.io
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
        'INSERT INTO "Message" (conversation_id, sender_id, message_content, sent_at, is_read) VALUES ($1, $2, $3, NOW(), false) RETURNING *',
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

// Test database connection before starting server (but don't fail)
(async () => {
  const dbConnected = await testConnection();

  // Start server regardless of database connection
  server.listen(PORT, () => {
    logger.production(`Server running on port ${PORT}`);
    logger.production(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.production(`🚀 Signaling server ready for WebRTC connections`);
    logger.production(`Database status: ${dbConnected ? '✅ Connected' : '❌ Disconnected (will retry)'}`);
  });
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
