// routes/interview.js
const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
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

module.exports = router;
