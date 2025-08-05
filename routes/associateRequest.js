// routes/associateRequest.js
const express = require('express');
const router = express.Router();
const associateRequestController = require('../controllers/associateRequestController');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Public endpoint - Submit associate request (no authentication required)
router.post('/submit', associateRequestController.submitAssociateRequest);

// ESC Admin endpoints - All require authentication and admin role
router.get('/requests', authenticateToken, requireRole(['admin']), associateRequestController.getAllAssociateRequests);
router.get('/requests/:requestId', authenticateToken, requireRole(['admin']), associateRequestController.getAssociateRequestById);
router.put('/requests/:requestId/review', authenticateToken, requireRole(['admin']), associateRequestController.reviewAssociateRequest);

module.exports = router; 