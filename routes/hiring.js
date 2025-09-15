// routes/hiring.js
const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const hiringController = require('../controllers/hiringController');

// Associate hires a freelancer
router.post('/hire', authenticateToken, requireRole(['associate']), hiringController.upload.single('contract_pdf'), hiringController.hireFreelancer);

// ECS Employee/Admin gets recent hires
router.get('/recent-hires', authenticateToken, requireRole(['admin', 'ecs_employee']), hiringController.getRecentHires);

// ECS Employee/Admin gets hiring statistics
router.get('/stats', authenticateToken, requireRole(['admin', 'ecs_employee']), hiringController.getHiringStats);

module.exports = router;

