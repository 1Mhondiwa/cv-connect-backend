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

    // Get all feedback received by this freelancer
    const feedbackQuery = `
      SELECT 
        i.interview_id,
        i.interview_type,
        i.scheduled_date,
        i.status as interview_status,
        
        -- Request info
        r.title as job_title,
        r.description as job_description,
        
        -- Associate info
        a.industry as company_industry,
        a.contact_person as interviewer_name,
        
        -- Feedback details
        ifb.feedback_id,
        ifb.technical_skills_rating,
        ifb.communication_rating,
        ifb.cultural_fit_rating,
        ifb.overall_rating,
        ifb.strengths,
        ifb.areas_for_improvement,
        ifb.recommendation,
        ifb.detailed_feedback,
        ifb.submitted_at as feedback_date
        
      FROM "Interview" i
      JOIN "Freelancer" f ON i.freelancer_id = f.freelancer_id
      JOIN "Associate" a ON i.associate_id = a.associate_id
      JOIN "Associate_Freelancer_Request" r ON i.request_id = r.request_id
      LEFT JOIN "Interview_Feedback" ifb ON i.interview_id = ifb.interview_id 
        AND ifb.evaluator_type = 'associate'  -- Only get feedback from associates
      
      WHERE f.user_id = $1 
        AND i.status = 'completed'  -- Only show feedback for completed interviews
      ORDER BY i.scheduled_date DESC
    `;

    const result = await db.query(feedbackQuery, [freelancerUserId]);
    
    // Group feedback by interview and calculate summary stats
    const interviews = result.rows;
    const feedbackSummary = {
      totalInterviews: interviews.length,
      feedbackReceived: interviews.filter(i => i.feedback_id).length,
      averageRating: 0,
      hireRecommendations: interviews.filter(i => i.recommendation === 'hire').length,
      maybeRecommendations: interviews.filter(i => i.recommendation === 'maybe').length,
      noHireRecommendations: interviews.filter(i => i.recommendation === 'no_hire').length
    };

    // Calculate average rating from interviews with feedback
    const ratingsData = interviews.filter(i => i.overall_rating);
    if (ratingsData.length > 0) {
      const avgRating = ratingsData.reduce((sum, i) => sum + parseFloat(i.overall_rating), 0) / ratingsData.length;
      feedbackSummary.averageRating = Math.round(avgRating * 100) / 100; // Round to 2 decimal places
    }

    console.log(`✅ Found ${interviews.length} interviews for freelancer ${freelancerUserId}, ${feedbackSummary.feedbackReceived} with feedback`);

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
