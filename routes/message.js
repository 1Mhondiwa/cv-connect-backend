// routes/message.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const db = require('../config/database');

// Create a new conversation
router.post('/conversations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const userType = req.user.user_type;
    const { recipient_id, freelancer_id } = req.body;
    
    console.log('🔍 Creating conversation:', { userId, userType, recipient_id, freelancer_id });
    
    // Handle both parameter names for backward compatibility
    const targetId = recipient_id || freelancer_id;
    
    if (!targetId) {
      console.log('❌ Missing target ID');
      return res.status(400).json({
        success: false,
        message: 'Recipient ID or Freelancer ID is required'
      });
    }
    
    let freelancerId, associateId;
    
    // Determine which user is the freelancer and which is the associate
    if (userType === 'freelancer') {
      console.log('👤 Current user is freelancer, target is associate');
      // Current user is the freelancer
      const freelancerResult = await db.query(
        'SELECT freelancer_id FROM "Freelancer" WHERE user_id = $1',
        [userId]
      );
      
      if (freelancerResult.rowCount === 0) {
        console.log('❌ Freelancer profile not found for user:', userId);
        return res.status(404).json({
          success: false,
          message: 'Freelancer profile not found'
        });
      }
      
      freelancerId = freelancerResult.rows[0].freelancer_id;
      
      // Recipient must be an associate
      const recipientUserResult = await db.query(
        'SELECT user_id FROM "Associate" WHERE associate_id = $1',
        [targetId]
      );
      
      if (recipientUserResult.rowCount === 0) {
        console.log('❌ Associate not found for ID:', targetId);
        return res.status(404).json({
          success: false,
          message: 'Associate not found'
        });
      }
      
      associateId = targetId;
    } else if (userType === 'associate') {
      console.log('👤 Current user is associate, target is freelancer');
      // Current user is the associate
      const associateResult = await db.query(
        'SELECT associate_id FROM "Associate" WHERE user_id = $1',
        [userId]
      );
      
      if (associateResult.rowCount === 0) {
        console.log('❌ Associate profile not found for user:', userId);
        return res.status(404).json({
          success: false,
          message: 'Associate profile not found'
        });
      }
      
      associateId = associateResult.rows[0].associate_id;
      
      // Recipient must be a freelancer
      const recipientUserResult = await db.query(
        'SELECT user_id FROM "Freelancer" WHERE freelancer_id = $1',
        [targetId]
      );
      
      if (recipientUserResult.rowCount === 0) {
        console.log('❌ Freelancer not found for ID:', targetId);
        return res.status(404).json({
          success: false,
          message: 'Freelancer not found'
        });
      }
      
      freelancerId = targetId;
    } else {
      console.log('❌ Invalid user type:', userType);
      return res.status(403).json({
        success: false,
        message: 'Only freelancers and associates can create conversations'
      });
    }
    
    console.log('✅ IDs determined:', { freelancerId, associateId });
    
    // Check if conversation already exists
    const existingConversationResult = await db.query(
      'SELECT conversation_id FROM "Conversation" WHERE freelancer_id = $1 AND associate_id = $2',
      [freelancerId, associateId]
    );
    
    if (existingConversationResult.rowCount > 0) {
      const conversationId = existingConversationResult.rows[0].conversation_id;
      console.log('✅ Conversation already exists:', conversationId);
      return res.status(200).json({
        success: true,
        message: 'Conversation already exists',
        conversation: { conversation_id: conversationId }
      });
    }
    
    // Create new conversation
    console.log('🆕 Creating new conversation...');
    const conversationResult = await db.query(
      'INSERT INTO "Conversation" (freelancer_id, associate_id, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) RETURNING conversation_id',
      [freelancerId, associateId]
    );
    
    const conversationId = conversationResult.rows[0].conversation_id;
    console.log('✅ New conversation created:', conversationId);
    return res.status(201).json({
      success: true,
      message: 'Conversation created successfully',
      conversation: { conversation_id: conversationId }
    });
  } catch (error) {
    console.error('❌ Create conversation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get all conversations for the current user
router.get('/conversations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const userType = req.user.user_type;
    
    let conversations;
    
    if (userType === 'freelancer') {
      // Get freelancer ID
      const freelancerResult = await db.query(
        'SELECT freelancer_id FROM "Freelancer" WHERE user_id = $1',
        [userId]
      );
      
      if (freelancerResult.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'Freelancer profile not found'
        });
      }
      
      const freelancerId = freelancerResult.rows[0].freelancer_id;
      
      // Get conversations where user is the freelancer
      conversations = await db.query(
        `SELECT c.*, 
          a.contact_person as associate_name,
          u.email as associate_email,
          (
            SELECT COUNT(*) 
            FROM "Message" m 
            WHERE m.conversation_id = c.conversation_id 
            AND m.sender_id != $1
            AND m.read_at IS NULL
          ) as unread_count,
          (
            SELECT m.content
            FROM "Message" m
            WHERE m.conversation_id = c.conversation_id
            ORDER BY m.sent_at DESC
            LIMIT 1
          ) as last_message,
          (
            SELECT m.sent_at
            FROM "Message" m
            WHERE m.conversation_id = c.conversation_id
            ORDER BY m.sent_at DESC
            LIMIT 1
          ) as last_message_time
        FROM "Conversation" c
        JOIN "Associate" a ON c.associate_id = a.associate_id
        JOIN "User" u ON a.user_id = u.user_id
        WHERE c.freelancer_id = $2
        ORDER BY c.updated_at DESC`,
        [userId, freelancerId]
      );
    } else if (userType === 'associate') {
      // Get associate ID
      const associateResult = await db.query(
        'SELECT associate_id FROM "Associate" WHERE user_id = $1',
        [userId]
      );
      
      if (associateResult.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'Associate profile not found'
        });
      }
      
      const associateId = associateResult.rows[0].associate_id;
      
      // Get conversations where user is the associate
      conversations = await db.query(
        `SELECT c.*, 
          (f.first_name || ' ' || f.last_name) as freelancer_name,
          u.email as freelancer_email,
          (
            SELECT COUNT(*) 
            FROM "Message" m 
            WHERE m.conversation_id = c.conversation_id 
            AND m.sender_id != $1
            AND m.read_at IS NULL
          ) as unread_count,
          (
            SELECT m.content
            FROM "Message" m
            WHERE m.conversation_id = c.conversation_id
            ORDER BY m.sent_at DESC
            LIMIT 1
          ) as last_message,
          (
            SELECT m.sent_at
            FROM "Message" m
            WHERE m.conversation_id = c.conversation_id
            ORDER BY m.sent_at DESC
            LIMIT 1
          ) as last_message_time
        FROM "Conversation" c
        JOIN "Freelancer" f ON c.freelancer_id = f.freelancer_id
        JOIN "User" u ON f.user_id = u.user_id
        WHERE c.associate_id = $2
        ORDER BY c.updated_at DESC`,
        [userId, associateId]
      );
    } else {
      return res.status(403).json({
        success: false,
        message: 'Only freelancers and associates can view conversations'
      });
    }
    
    return res.status(200).json({
      success: true,
      conversations: conversations.rows
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get messages for a conversation
router.get('/conversations/:id/messages', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { id: conversationId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    const offset = (page - 1) * limit;
    
    // Verify that the user is part of this conversation
    const conversationResult = await db.query(
      `SELECT c.*, a.user_id as associate_user_id, f.user_id as freelancer_user_id
       FROM "Conversation" c
       JOIN "Associate" a ON c.associate_id = a.associate_id
       JOIN "Freelancer" f ON c.freelancer_id = f.freelancer_id
       WHERE c.conversation_id = $1`,
      [conversationId]
    );
    
    if (conversationResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }
    
    const conversation = conversationResult.rows[0];
    
    // Check if user is part of this conversation
    if (conversation.associate_user_id !== userId && conversation.freelancer_user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view this conversation'
      });
    }
    
    // Get messages
    const messagesResult = await db.query(
      `SELECT m.*, 
        u.email as sender_email,
        CASE 
          WHEN u.user_type = 'freelancer' THEN (
            SELECT (first_name || ' ' || last_name) 
            FROM "Freelancer" 
            WHERE user_id = u.user_id
          )
          WHEN u.user_type = 'associate' THEN (
            SELECT contact_person 
            FROM "Associate" 
            WHERE user_id = u.user_id
          )
          ELSE u.email
        END as sender_name
       FROM "Message" m
       JOIN "User" u ON m.sender_id = u.user_id
       WHERE m.conversation_id = $1
       ORDER BY m.sent_at ASC
       LIMIT $2 OFFSET $3`,
      [conversationId, limit, offset]
    );
    
    // Mark messages as read if the user is the recipient
    await db.query(
      `UPDATE "Message"
       SET read_at = NOW()
       WHERE conversation_id = $1
       AND sender_id != $2
       AND read_at IS NULL`,
      [conversationId, userId]
    );
    
    // Update conversation's updated_at timestamp
    await db.query(
      `UPDATE "Conversation"
       SET updated_at = NOW()
       WHERE conversation_id = $1`,
      [conversationId]
    );
    
    // Count total messages for pagination
    const countResult = await db.query(
      'SELECT COUNT(*) FROM "Message" WHERE conversation_id = $1',
      [conversationId]
    );
    
    const totalCount = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalCount / limit);
    
    return res.status(200).json({
      success: true,
      messages: messagesResult.rows,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        total_pages: totalPages
      }
    });
  } catch (error) {
    console.error('Get messages error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Send a message
router.post('/conversations/:id/messages', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { id: conversationId } = req.params;
    const { content } = req.body;
    
    if (!content || content.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Message content cannot be empty'
      });
    }
    
    // Verify that the user is part of this conversation
    const conversationResult = await db.query(
      `SELECT c.*, a.user_id as associate_user_id, f.user_id as freelancer_user_id
       FROM "Conversation" c
       JOIN "Associate" a ON c.associate_id = a.associate_id
       JOIN "Freelancer" f ON c.freelancer_id = f.freelancer_id
       WHERE c.conversation_id = $1`,
      [conversationId]
    );
    
    if (conversationResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }
    
    const conversation = conversationResult.rows[0];
    
    // Check if user is part of this conversation
    if (conversation.associate_user_id !== userId && conversation.freelancer_user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to send messages in this conversation'
      });
    }
    
    // Send message
    const messageResult = await db.query(
      `INSERT INTO "Message" (conversation_id, sender_id, content, sent_at, is_delivered)
       VALUES ($1, $2, $3, NOW(), true)
       RETURNING *`,
      [conversationId, userId, content]
    );
    
    // Update conversation's updated_at timestamp
    await db.query(
      `UPDATE "Conversation"
       SET updated_at = NOW()
       WHERE conversation_id = $1`,
      [conversationId]
    );
    
    return res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: messageResult.rows[0]
    });
  } catch (error) {
    console.error('Send message error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Delete a message
router.delete('/messages/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { id: messageId } = req.params;
    
    // Check if message exists and belongs to this user
    const messageResult = await db.query(
      'SELECT * FROM "Message" WHERE message_id = $1',
      [messageId]
    );
    
    if (messageResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }
    
    const message = messageResult.rows[0];
    
    // Only the sender can delete their message
    if (message.sender_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own messages'
      });
    }
    
    // Delete the message
    await db.query(
      'DELETE FROM "Message" WHERE message_id = $1',
      [messageId]
    );
    
    return res.status(200).json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Delete message error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Mark all messages in a conversation as read
router.put('/conversations/:id/read', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { id: conversationId } = req.params;
    
    // Verify that the user is part of this conversation
    const conversationResult = await db.query(
      `SELECT c.*, a.user_id as associate_user_id, f.user_id as freelancer_user_id
       FROM "Conversation" c
       JOIN "Associate" a ON c.associate_id = a.associate_id
       JOIN "Freelancer" f ON c.freelancer_id = f.freelancer_id
       WHERE c.conversation_id = $1`,
      [conversationId]
    );
    
    if (conversationResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }
    
    const conversation = conversationResult.rows[0];
    
    // Check if user is part of this conversation
    if (conversation.associate_user_id !== userId && conversation.freelancer_user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to access this conversation'
      });
    }
    
    // Mark all messages sent by the other user as read
    const result = await db.query(
      `UPDATE "Message"
       SET read_at = NOW()
       WHERE conversation_id = $1
       AND sender_id != $2
       AND read_at IS NULL
       RETURNING message_id`,
      [conversationId, userId]
    );
    
    return res.status(200).json({
      success: true,
      message: 'Messages marked as read',
      count: result.rowCount
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get unread message count for the current user
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const userType = req.user.user_type;
    
    let conversationCondition;
    
    if (userType === 'freelancer') {
      // Get freelancer ID
      const freelancerResult = await db.query(
        'SELECT freelancer_id FROM "Freelancer" WHERE user_id = $1',
        [userId]
      );
      
      if (freelancerResult.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'Freelancer profile not found'
        });
      }
      
      const freelancerId = freelancerResult.rows[0].freelancer_id;
      
      conversationCondition = `c.freelancer_id = ${freelancerId}`;
    } else if (userType === 'associate') {
      // Get associate ID
      const associateResult = await db.query(
        'SELECT associate_id FROM "Associate" WHERE user_id = $1',
        [userId]
      );
      
      if (associateResult.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'Associate profile not found'
        });
      }
      
      const associateId = associateResult.rows[0].associate_id;
      
      conversationCondition = `c.associate_id = ${associateId}`;
    } else {
      return res.status(403).json({
        success: false,
        message: 'Only freelancers and associates can view messages'
      });
    }
    
    // Get total unread count
    const unreadResult = await db.query(
      `SELECT COUNT(*) 
       FROM "Message" m
       JOIN "Conversation" c ON m.conversation_id = c.conversation_id
       WHERE ${conversationCondition}
       AND m.sender_id != $1
       AND m.read_at IS NULL`,
      [userId]
    );
    
    // Get count by conversation
    const conversationUnreadResult = await db.query(
      `SELECT m.conversation_id, COUNT(*) as unread_count
       FROM "Message" m
       JOIN "Conversation" c ON m.conversation_id = c.conversation_id
       WHERE ${conversationCondition}
       AND m.sender_id != $1
       AND m.read_at IS NULL
       GROUP BY m.conversation_id`,
      [userId]
    );
    
    return res.status(200).json({
      success: true,
      total_unread: parseInt(unreadResult.rows[0].count),
      conversations: conversationUnreadResult.rows
    });
  } catch (error) {
    console.error('Unread count error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

module.exports = router;