const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { 
  validateUserRegistration, 
  validateAssociateCreation, 
  validateLogin 
} = require('../middleware/validation');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Freelancer registration
router.post('/register', validateUserRegistration, authController.registerFreelancer);

// User login (all roles)
router.post('/login', validateLogin, authController.login);

// Admin adds a new associate
router.post(
  '/add-associate', 
  authenticateToken, 
  requireRole(['admin']), 
  validateAssociateCreation, 
  authController.addAssociate
);

// Add admin creation route
router.post('/create-admin', authController.createAdmin);

// Add password reset routes
router.post('/request-reset', authController.requestPasswordReset);
router.post('/reset-password', authController.resetPassword);

// Add email verification route
router.get('/verify-email/:token', authController.verifyEmail);

// Add token verification route
router.get('/verify', authenticateToken, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Token is valid',
    user: req.user
  });
});

// Change password route (requires authentication)
router.put('/change-password', authenticateToken, authController.changePassword);

module.exports = router;