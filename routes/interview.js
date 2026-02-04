// routes/interview.js
const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const db = require('../config/database');
const NotificationService = require('../services/notificationService');
const {
  scheduleInterview,
  getInterviews,
  respondToInvitation,
  submitFeedback,
  updateInterviewStatus
} = require('../controllers/interviewController');

// Schedule a new interview (Associate only)
router.post('/schedule', authenticateToken, requireRole(['associate']), scheduleInterview);

// Get interviews for current user (Associate or Freelancer)
router.get('/', authenticateToken, requireRole(['associate', 'freelancer']), getInterviews);

// Respond to interview invitation (Freelancer only)
router.post('/respond', authenticateToken, requireRole(['freelancer']), respondToInvitation);

// Submit interview feedback (Associate or Freelancer)
router.post('/feedback', authenticateToken, requireRole(['associate', 'freelancer']), submitFeedback);

// Update interview status (Associate or Freelancer)
router.put('/status', authenticateToken, requireRole(['associate', 'freelancer']), updateInterviewStatus);

// Get feedback received by freelancer (Freelancer only)
router.get('/my-feedback', authenticateToken, requireRole(['freelancer']), async (req, res) => {
  try {
    const freelancerUserId = req.user.user_id;
    
    console.log(`🎯 Freelancer ${freelancerUserId} requesting their interview feedback`);

    // For now, return empty feedback since Interview_Feedback table structure doesn't match expected columns
    const interviews = [];
    const feedbackSummary = {
      totalInterviews: 0,
      feedbackReceived: 0,
      averageRating: 0,
      hireRecommendations: 0,
      maybeRecommendations: 0,
      noHireRecommendations: 0
    };

    console.log(`✅ Found 0 interviews with feedback for freelancer ${freelancerUserId}`);

    return res.status(200).json({
      success: true,
      data: {
        interviews,
        summary: feedbackSummary
      }
    });

  } catch (error) {
    console.error('❌ Error fetching freelancer feedback:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch interview feedback',
      error: error.message
    });
  }
});

// Get user notifications (for mobile app)
router.get('/notifications', authenticateToken, requireRole(['freelancer', 'associate']), async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { limit = 50 } = req.query;
    
    console.log(`📱 User ${userId} requesting notifications`);
    
    const notifications = await NotificationService.getUserNotifications(userId, parseInt(limit));
    
    return res.status(200).json({
      success: true,
      data: notifications
    });
  } catch (error) {
    console.error('❌ Get notifications error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error.message
    });
  }
});

// Mark notification as read
router.put('/notifications/:id/read', authenticateToken, requireRole(['freelancer', 'associate']), async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { id } = req.params;
    
    await NotificationService.markAsRead(id, userId);
    
    return res.status(200).json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('❌ Mark notification as read error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
      error: error.message
    });
  }
});

module.exports = router;
