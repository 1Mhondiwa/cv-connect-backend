// middleware/validation.js
const { check, validationResult } = require('express-validator');
const { validatePassword } = require('../utils/passwordValidator');

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

// Custom password validation
const validateStrongPassword = (value) => {
  const validation = validatePassword(value);
  if (!validation.isValid) {
    throw new Error(validation.errors[0]); // Return first error
  }
  return true;
};

// User registration validation
const validateUserRegistration = [
  check('email').isEmail().withMessage('Please provide a valid email'),
  check('password').custom(validateStrongPassword),
  validateRequest
];

// Associate creation validation
const validateAssociateCreation = [
  check('email').isEmail().withMessage('Please provide a valid email'),
  check('password').custom(validateStrongPassword),
  check('industry').notEmpty().withMessage('Industry is required'),
  check('contact_person').notEmpty().withMessage('Contact person is required'),
  check('phone').notEmpty().withMessage('Phone number is required'),
  validateRequest
];

// Freelancer profile validation (allow partial updates)
const validateFreelancerProfile = [
  check('first_name').optional().trim(),
  check('last_name').optional().trim(),
  check('phone').optional().trim(),
  check('address').optional().trim(),
  check('years_experience').optional(),
  check('summary').optional().trim(),
  check('headline').optional().trim(),
  check('current_status').optional().trim(),
  check('linkedin_url').optional().isURL().withMessage('Invalid LinkedIn URL'),
  check('github_url').optional().isURL().withMessage('Invalid GitHub URL'),
  validateRequest
];

// Login validation
const validateLogin = [
  check('email').isEmail().withMessage('Please provide a valid email'),
  check('password').notEmpty().withMessage('Password is required'),
  validateRequest
];

// Password change validation
const validatePasswordChange = [
  check('oldPassword').notEmpty().withMessage('Old password is required'),
  check('newPassword').custom(validateStrongPassword),
  validateRequest
];

module.exports = {
  validateUserRegistration,
  validateAssociateCreation,
  validateFreelancerProfile,
  validateLogin,
  validatePasswordChange
};