class SignalingServer {
  constructor(io) {
    this.io = io; // Use the existing Socket.IO instance
    
    this.rooms = new Map(); // Store room information
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    // Set up WebRTC event handlers on the existing io instance
    // These will be added to each connection automatically
    console.log('📡 WebRTC signaling server initialized');
  }

  // Method to add WebRTC handlers to a socket connection
  addWebRTCHandlers(socket) {
    // Handle joining a room
    socket.on('join-room', (data) => {
        const { roomId, userId } = data;
        console.log(`👤 User ${userId} joining room ${roomId}`);
        
        socket.join(roomId);
        socket.roomId = roomId;
        socket.userId = userId;

        // Store room information
        if (!this.rooms.has(roomId)) {
          this.rooms.set(roomId, {
            participants: new Set(),
            createdAt: new Date()
          });
        }
        
        this.rooms.get(roomId).participants.add(userId);

        // Notify others in the room
        socket.to(roomId).emit('user-joined', { userId, roomId });
        
        console.log(`📊 Room ${roomId} now has ${this.rooms.get(roomId).participants.size} participants`);
      });

      // Handle leaving a room
      socket.on('leave-room', (data) => {
        const { roomId } = data;
        console.log(`👤 User leaving room ${roomId}`);
        
        if (this.rooms.has(roomId)) {
          this.rooms.get(roomId).participants.delete(socket.userId);
          
          // Notify others in the room
          socket.to(roomId).emit('user-left', { userId: socket.userId, roomId });
          
          // Clean up empty rooms
          if (this.rooms.get(roomId).participants.size === 0) {
            this.rooms.delete(roomId);
            console.log(`🗑️ Room ${roomId} deleted (empty)`);
          }
        }
        
        socket.leave(roomId);
        socket.roomId = null;
        socket.userId = null;
      });

      // Handle WebRTC offer
      socket.on('offer', (data) => {
        const { roomId, offer } = data;
        console.log(`📞 Offer received in room ${roomId}`);
        
        // Forward offer to other participants in the room
        socket.to(roomId).emit('offer', {
          offer,
          from: socket.userId,
          roomId
        });
      });

      // Handle WebRTC answer
      socket.on('answer', (data) => {
        const { roomId, answer } = data;
        console.log(`📞 Answer received in room ${roomId}`);
        
        // Forward answer to other participants in the room
        socket.to(roomId).emit('answer', {
          answer,
          from: socket.userId,
          roomId
        });
      });

      // Handle ICE candidates
      socket.on('ice-candidate', (data) => {
        const { roomId, candidate } = data;
        console.log(`🧊 ICE candidate received in room ${roomId}`);
        
        // Forward ICE candidate to other participants in the room
        socket.to(roomId).emit('ice-candidate', {
          candidate,
          from: socket.userId,
          roomId
        });
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log('📡 Client disconnected:', socket.id);
        
        if (socket.roomId) {
          const roomId = socket.roomId;
          
          if (this.rooms.has(roomId)) {
            this.rooms.get(roomId).participants.delete(socket.userId);
            
            // Notify others in the room
            socket.to(roomId).emit('user-left', { 
              userId: socket.userId, 
              roomId 
            });
            
            // Clean up empty rooms
            if (this.rooms.get(roomId).participants.size === 0) {
              this.rooms.delete(roomId);
              console.log(`🗑️ Room ${roomId} deleted (empty)`);
            }
          }
        }
      });

      // Handle errors
      socket.on('error', (error) => {
        console.error('❌ Socket error:', error);
      });
  }

  // Get room statistics
  getRoomStats() {
    const stats = {};
    for (const [roomId, room] of this.rooms) {
      stats[roomId] = {
        participants: Array.from(room.participants),
        participantCount: room.participants.size,
        createdAt: room.createdAt
      };
    }
    return stats;
  }

  // Get total connected clients
  getConnectedClients() {
    return this.io.engine.clientsCount;
  }
}

module.exports = SignalingServer;
