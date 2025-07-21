// controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

// Generate JWT token
const generateToken = (userId) => {
  const jwtSecret = process.env.JWT_SECRET || 'cv-connect-secret-key-2024';
  return jwt.sign({ userId }, jwtSecret, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1h'
  });
};

// Register a new freelancer
const registerFreelancer = async (req, res) => {
  const client = await db.pool.connect();
  
  try {
    const { email, password, first_name, last_name, phone } = req.body;
    
    // Check if email already exists
    const existingUser = await client.query(
      'SELECT * FROM "User" WHERE email = $1',
      [email]
    );
    
    if (existingUser.rowCount > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email already exists'
      });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Begin transaction
    await client.query('BEGIN');
    
    // Create user record
    const userResult = await client.query(
      'INSERT INTO "User" (email, hashed_password, user_type, is_active, is_verified) VALUES ($1, $2, $3, $4, $5) RETURNING user_id',
      [email, hashedPassword, 'freelancer', true, true]
    );
    
    const userId = userResult.rows[0].user_id;
    
    // Create freelancer record
    const freelancerResult = await client.query(
      'INSERT INTO "Freelancer" (user_id, first_name, last_name, phone) VALUES ($1, $2, $3, $4) RETURNING freelancer_id',
      [userId, first_name, last_name, phone]
    );
    
    const freelancerId = freelancerResult.rows[0].freelancer_id;
    
    // Commit transaction
    await client.query('COMMIT');
    
    // Generate JWT token
    const token = generateToken(userId);
    
    return res.status(201).json({
      success: true,
      message: 'Freelancer registered successfully',
      data: {
        user_id: userId,
        freelancer_id: freelancerId,
        email,
        first_name,
        last_name,
        phone,
        token
      }
    });
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    
    console.error('Freelancer registration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  } finally {
    // Release client back to pool
    client.release();
  }
};

// Admin adds a new associate
const addAssociate = async (req, res) => {
  const client = await db.pool.connect();
  
  try {
    const { email, password, industry, contact_person, phone, address, website } = req.body;
    
    // Check if email already exists
    const existingUser = await client.query(
      'SELECT * FROM "User" WHERE email = $1',
      [email]
    );
    
    if (existingUser.rowCount > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email already exists'
      });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Begin transaction
    await client.query('BEGIN');
    
    // Create user record
    const userResult = await client.query(
      'INSERT INTO "User" (email, hashed_password, user_type, is_active, is_verified) VALUES ($1, $2, $3, $4, $5) RETURNING user_id',
      [email, hashedPassword, 'associate', true, true]
    );
    
    const userId = userResult.rows[0].user_id;
    
    // Create associate record
    const associateResult = await client.query(
      'INSERT INTO "Associate" (user_id, industry, contact_person, phone, address, website, verified) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING associate_id',
      [userId, industry, contact_person, phone, address || null, website || null, true]
    );
    
    const associateId = associateResult.rows[0].associate_id;
    
    // Commit transaction
    await client.query('COMMIT');
    
    return res.status(201).json({
      
      success: true,
      message: 'Associate added successfully',
      data: {
        user_id: userId,
        associate_id: associateId,
        email,
        industry,
        contact_person,
        phone
      }
    });
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    
    console.error('Associate creation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  } finally {
    // Release client back to pool
    client.release();
  }
};

// User login (admin, associate, freelancer)
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('Login attempt for email:', email);
    
    // Check if user exists
    const userResult = await db.query(
      'SELECT * FROM "User" WHERE email = $1',
      [email]
    );
    
    if (userResult.rowCount === 0) {
      console.log('User not found for email:', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    const user = userResult.rows[0];
    console.log('User found:', { user_id: user.user_id, user_type: user.user_type });
    
    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.hashed_password);
    
    if (!isPasswordValid) {
      console.log('Invalid password for user:', user.user_id);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    // Check if user is active
    if (!user.is_active) {
      console.log('Inactive user attempt to login:', user.user_id);
      return res.status(403).json({
        success: false,
        message: 'Account is inactive. Please contact admin.'
      });
    }
    
    // Update last login
    await db.query(
      'UPDATE "User" SET last_login = NOW() WHERE user_id = $1',
      [user.user_id]
    );
    
    // Generate token
    const token = generateToken(user.user_id);
    console.log('Token generated for user:', user.user_id);
    
    // Return different data based on user type
    let userData = {
      user_id: user.user_id,
      email: user.email,
      user_type: user.user_type,
      is_active: user.is_active,
      is_verified: user.is_verified
    };
    
    if (user.user_type === 'freelancer') {
      const freelancerResult = await db.query(
        'SELECT freelancer_id, first_name, last_name, phone, profile_picture_url FROM "Freelancer" WHERE user_id = $1',
        [user.user_id]
      );
      
      if (freelancerResult.rowCount > 0) {
        userData = {
          ...userData,
          ...freelancerResult.rows[0]
        };
      }
    } else if (user.user_type === 'associate') {
      const associateResult = await db.query(
        'SELECT associate_id, industry, contact_person, phone FROM "Associate" WHERE user_id = $1',
        [user.user_id]
      );
      
      if (associateResult.rowCount > 0) {
        userData = {
          ...userData,
          ...associateResult.rows[0]
        };
      }
    }
    
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: userData
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Reset password request
const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    
    // Check if user exists
    const userResult = await db.query(
      'SELECT user_id FROM "User" WHERE email = $1',
      [email]
    );
    
    if (userResult.rowCount === 0) {
      // For security reasons, don't reveal that the email doesn't exist
      return res.status(200).json({
        success: true,
        message: 'If your email exists in our system, you will receive a password reset link'
      });
    }
    
    const userId = userResult.rows[0].user_id;
    
    // Generate reset token
    const resetToken = uuidv4();
    const tokenExpires = new Date();
    tokenExpires.setHours(tokenExpires.getHours() + 1); // Token valid for 1 hour
    
    // Save token to database
    await db.query(
      'UPDATE "User" SET verification_token = $1, token_expires_at = $2 WHERE user_id = $3',
      [resetToken, tokenExpires, userId]
    );
    
    // In a real implementation, you would send an email with the reset link
    // For this MVP, we'll just return the token in the response
    
    return res.status(200).json({
      success: true,
      message: 'If your email exists in our system, you will receive a password reset link',
      // In production, remove this debug information
      debug: {
        reset_token: resetToken,
        expires: tokenExpires
      }
    });
  } catch (error) {
    console.error('Password reset request error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Reset password with token
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    
    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: 'Token and new password are required'
      });
    }
    
    // Find user with this token
    const userResult = await db.query(
      'SELECT user_id FROM "User" WHERE verification_token = $1 AND token_expires_at > NOW()',
      [token]
    );
    
    if (userResult.rowCount === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
    
    const userId = userResult.rows[0].user_id;
    
    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Update password and clear token
    await db.query(
      'UPDATE "User" SET hashed_password = $1, verification_token = NULL, token_expires_at = NULL WHERE user_id = $2',
      [hashedPassword, userId]
    );
    
    return res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Password reset error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Create admin user (only used once for initial setup)
const createAdmin = async (req, res) => {
  const client = await db.pool.connect();
  
  try {
    const { email, password, secretKey } = req.body;
    
    // Check if secret key matches
    if (secretKey !== process.env.ADMIN_SECRET_KEY) {
      return res.status(403).json({
        success: false,
        message: 'Invalid secret key'
      });
    }
    
    // Check if email already exists
    const existingUser = await client.query(
      'SELECT * FROM "User" WHERE email = $1',
      [email]
    );
    
    if (existingUser.rowCount > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email already exists'
      });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create admin user
    const userResult = await client.query(
      'INSERT INTO "User" (email, hashed_password, user_type, is_active, is_verified) VALUES ($1, $2, $3, $4, $5) RETURNING user_id',
      [email, hashedPassword, 'admin', true, true]
    );
    
    const userId = userResult.rows[0].user_id;
    
    // Generate JWT token
    const token = generateToken(userId);
    
    return res.status(201).json({
      success: true,
      message: 'Admin user created successfully',
      data: {
        user_id: userId,
        email,
        token
      }
    });
  } catch (error) {
    console.error('Admin creation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  } finally {
    // Release client back to pool
    client.release();
  }
};

// Verify email token
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
    
    // Find user with this token
    const userResult = await db.query(
      'SELECT user_id FROM "User" WHERE verification_token = $1 AND token_expires_at > NOW()',
      [token]
    );
    
    if (userResult.rowCount === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token'
      });
    }
    
    const userId = userResult.rows[0].user_id;
    
    // Mark user as verified and clear token
    await db.query(
      'UPDATE "User" SET is_verified = true, verification_token = NULL, token_expires_at = NULL WHERE user_id = $1',
      [userId]
    );

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    console.error('Email verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = {
  registerFreelancer,
  addAssociate,
  login,
  requestPasswordReset,
  resetPassword,
  createAdmin,
  verifyEmail
};