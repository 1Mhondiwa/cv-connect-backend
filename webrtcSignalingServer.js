const { Server } = require('socket.io');
const http = require('http');

class WebRTCSignalingServer {
  constructor(server) {
    this.io = new Server(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    
    this.rooms = new Map(); // Store room data
    this.setupEventHandlers();
    
    console.log('🚀 WebRTC Signaling Server initialized');
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`📱 Client connected: ${socket.id}`);

      // Join room
      socket.on('join-room', (data) => {
        const { roomId, userType, userId } = data;
        console.log(`👤 ${userType} ${userId} joining room: ${roomId}`);
        
        socket.join(roomId);
        socket.roomId = roomId;
        socket.userType = userType;
        socket.userId = userId;

        // Store user info in room
        if (!this.rooms.has(roomId)) {
          this.rooms.set(roomId, {
            participants: new Map(),
            createdAt: new Date()
          });
        }

        const room = this.rooms.get(roomId);
        room.participants.set(socket.id, {
          userType,
          userId,
          socketId: socket.id
        });

        // Notify others in the room
        socket.to(roomId).emit('user-joined', {
          socketId: socket.id,
          userType,
          userId
        });

        // Send existing participants to the new user
        const existingParticipants = Array.from(room.participants.values())
          .filter(p => p.socketId !== socket.id);
        
        if (existingParticipants.length > 0) {
          socket.emit('existing-participants', existingParticipants);
        }

        console.log(`✅ ${userType} ${userId} joined room ${roomId}`);
      });

      // Handle WebRTC offer
      socket.on('offer', (data) => {
        console.log(`📤 Offer from ${socket.userType} ${socket.userId}`);
        socket.to(socket.roomId).emit('offer', {
          offer: data.offer,
          from: socket.id,
          userType: socket.userType,
          userId: socket.userId
        });
      });

      // Handle WebRTC answer
      socket.on('answer', (data) => {
        console.log(`📤 Answer from ${socket.userType} ${socket.userId}`);
        socket.to(socket.roomId).emit('answer', {
          answer: data.answer,
          from: socket.id,
          userType: socket.userType,
          userId: socket.userId
        });
      });

      // Handle ICE candidates
      socket.on('ice-candidate', (data) => {
        console.log(`🧊 ICE candidate from ${socket.userType} ${socket.userId}`);
        socket.to(socket.roomId).emit('ice-candidate', {
          candidate: data.candidate,
          from: socket.id,
          userType: socket.userType,
          userId: socket.userId
        });
      });

      // Handle screen sharing
      socket.on('screen-share-start', (data) => {
        console.log(`📺 Screen sharing started by ${socket.userType} ${socket.userId}`);
        socket.to(socket.roomId).emit('screen-share-start', {
          from: socket.id,
          userType: socket.userType,
          userId: socket.userId
        });
      });

      socket.on('screen-share-stop', (data) => {
        console.log(`📺 Screen sharing stopped by ${socket.userType} ${socket.userId}`);
        socket.to(socket.roomId).emit('screen-share-stop', {
          from: socket.id,
          userType: socket.userType,
          userId: socket.userId
        });
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        console.log(`👋 Client disconnected: ${socket.id}`);
        
        if (socket.roomId) {
          const room = this.rooms.get(socket.roomId);
          if (room) {
            room.participants.delete(socket.id);
            
            // Notify others in the room
            socket.to(socket.roomId).emit('user-left', {
              socketId: socket.id,
              userType: socket.userType,
              userId: socket.userId
            });

            // Clean up empty rooms
            if (room.participants.size === 0) {
              this.rooms.delete(socket.roomId);
              console.log(`🗑️ Cleaned up empty room: ${socket.roomId}`);
            }
          }
        }
      });
    });
  }

  getRoomInfo(roomId) {
    return this.rooms.get(roomId);
  }

  getActiveRooms() {
    return Array.from(this.rooms.keys());
  }
}

module.exports = WebRTCSignalingServer;
