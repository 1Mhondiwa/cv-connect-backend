// middleware/validation.js
const { check, validationResult } = require('express-validator');

// Helper to check validation results
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  next();
};

// User registration validation
const validateUserRegistration = [
  check('email').isEmail().withMessage('Please provide a valid email'),
  check('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  validateRequest
];

// Associate creation validation
const validateAssociateCreation = [
  check('email').isEmail().withMessage('Please provide a valid email'),
  check('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  check('industry').notEmpty().withMessage('Industry is required'),
  check('contact_person').notEmpty().withMessage('Contact person is required'),
  check('phone').notEmpty().withMessage('Phone number is required'),
  validateRequest
];

// Freelancer profile validation
const validateFreelancerProfile = [
  check('first_name').notEmpty().withMessage('First name is required'),
  check('last_name').notEmpty().withMessage('Last name is required'),
  check('phone').notEmpty().withMessage('Phone number is required'),
  validateRequest
];

// Login validation
const validateLogin = [
  check('email').isEmail().withMessage('Please provide a valid email'),
  check('password').notEmpty().withMessage('Password is required'),
  validateRequest
];

module.exports = {
  validateUserRegistration,
  validateAssociateCreation,
  validateFreelancerProfile,
  validateLogin
};