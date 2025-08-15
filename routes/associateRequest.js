// routes/associateRequest.js
const express = require('express');
const router = express.Router();
const associateRequestController = require('../controllers/associateRequestController');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Public endpoint - Submit associate request (no authentication required)
router.post('/submit', associateRequestController.submitAssociateRequest);

// ESC Admin and ECS Employee endpoints - All require authentication and appropriate role
router.get('/requests', authenticateToken, requireRole(['admin', 'ecs_employee']), associateRequestController.getAllAssociateRequests);
router.get('/requests/:requestId', authenticateToken, requireRole(['admin', 'ecs_employee']), associateRequestController.getAssociateRequestById);
router.put('/requests/:requestId/review', authenticateToken, requireRole(['admin', 'ecs_employee']), associateRequestController.reviewAssociateRequest);

module.exports = router; 