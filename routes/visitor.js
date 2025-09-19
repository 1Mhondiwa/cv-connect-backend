// routes/visitor.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Track visitor from mobile app
router.post('/track', async (req, res) => {
  try {
    const { 
      device_type = 'mobile', // Default to mobile for mobile app
      page_visited = '/',
      session_id,
      user_agent,
      referrer = null,
      user_id = null // Optional - if user is logged in (must be integer)
    } = req.body;

    // Validate required fields
    if (!page_visited) {
      return res.status(400).json({
        success: false,
        message: 'page_visited is required'
      });
    }

    // Validate user_id format if provided
    if (user_id && (isNaN(user_id) || !Number.isInteger(Number(user_id)))) {
      return res.status(400).json({
        success: false,
        message: 'user_id must be a valid integer'
      });
    }

    // Convert user_id to integer if provided, but set to null if user doesn't exist
    let finalUserId = null;
    if (user_id) {
      const userIdInt = parseInt(user_id);
      // Check if user exists in database
      try {
        const userCheck = await db.query('SELECT user_id FROM "User" WHERE user_id = $1', [userIdInt]);
        if (userCheck.rows.length > 0) {
          finalUserId = userIdInt;
        } else {
          console.log(`⚠️ User ID ${userIdInt} not found in database, tracking as anonymous`);
          finalUserId = null;
        }
      } catch (error) {
        console.log(`⚠️ Error checking user ID ${userIdInt}, tracking as anonymous:`, error.message);
        finalUserId = null;
      }
    }

    // Generate session ID if not provided
    const finalSessionId = session_id || `mobile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Get client IP
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    
    // Get user agent if not provided
    const finalUserAgent = user_agent || req.headers['user-agent'] || 'Mobile App';
    
    // Current date and time
    const visitDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const visitTime = new Date();

    console.log('📱 Mobile visitor tracked:', {
      sessionId: finalSessionId.substring(0, 15) + '...',
      deviceType: device_type,
      pageVisited: page_visited,
      userId: finalUserId ? `user_${finalUserId}` : 'anonymous',
      ip: ipAddress.substring(0, 15) + '...'
    });

    // Insert visitor tracking record
    await db.query(`
      INSERT INTO "Visitor_Tracking" (
        session_id, ip_address, user_agent, device_type, 
        visit_date, visit_time, page_visited, referrer, user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [finalSessionId, ipAddress, finalUserAgent, device_type, visitDate, visitTime, page_visited, referrer, finalUserId]);

    res.status(200).json({
      success: true,
      message: 'Visitor tracked successfully',
      data: {
        session_id: finalSessionId,
        timestamp: visitTime
      }
    });

  } catch (error) {
    console.error('❌ Mobile visitor tracking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track visitor',
      error: error.message
    });
  }
});

// Track visitor from web (for authenticated users)
router.post('/track-web', authenticateToken, async (req, res) => {
  try {
    const { 
      page_visited = '/',
      session_id,
      referrer = null
    } = req.body;

    // Get user info from token
    const user_id = req.user.user_id;
    
    // Generate session ID if not provided
    const finalSessionId = session_id || `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Get client info
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'Web Browser';
    
    // Detect device type from user agent
    const deviceType = userAgent.toLowerCase().includes('mobile') ? 'mobile' : 'desktop';
    
    // Current date and time
    const visitDate = new Date().toISOString().split('T')[0];
    const visitTime = new Date();

    console.log('💻 Web visitor tracked:', {
      sessionId: finalSessionId.substring(0, 15) + '...',
      deviceType: deviceType,
      pageVisited: page_visited,
      userId: user_id,
      ip: ipAddress.substring(0, 15) + '...'
    });

    // Insert visitor tracking record
    await db.query(`
      INSERT INTO "Visitor_Tracking" (
        session_id, ip_address, user_agent, device_type, 
        visit_date, visit_time, page_visited, referrer, user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [finalSessionId, ipAddress, userAgent, deviceType, visitDate, visitTime, page_visited, referrer, user_id]);

    res.status(200).json({
      success: true,
      message: 'Web visitor tracked successfully',
      data: {
        session_id: finalSessionId,
        device_type: deviceType,
        timestamp: visitTime
      }
    });

  } catch (error) {
    console.error('❌ Web visitor tracking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track web visitor',
      error: error.message
    });
  }
});

// Get visitor statistics (for admin dashboard)
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const { days = 7 } = req.query;
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - parseInt(days));
    
    // Get visitor statistics
    const statsResult = await db.query(`
      SELECT 
        COUNT(*) as total_visits,
        COUNT(CASE WHEN device_type = 'desktop' THEN 1 END) as desktop_visits,
        COUNT(CASE WHEN device_type = 'mobile' THEN 1 END) as mobile_visits,
        COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END) as authenticated_visits,
        COUNT(CASE WHEN user_id IS NULL THEN 1 END) as anonymous_visits
      FROM "Visitor_Tracking"
      WHERE visit_date >= $1 AND visit_date <= $2
    `, [startDate, endDate]);
    
    // Get daily breakdown
    const dailyResult = await db.query(`
      SELECT 
        visit_date as date,
        COUNT(CASE WHEN device_type = 'desktop' THEN 1 END) as desktop_visits,
        COUNT(CASE WHEN device_type = 'mobile' THEN 1 END) as mobile_visits,
        COUNT(*) as total_visits
      FROM "Visitor_Tracking"
      WHERE visit_date >= $1 AND visit_date <= $2
      GROUP BY visit_date
      ORDER BY visit_date ASC
    `, [startDate, endDate]);
    
    res.status(200).json({
      success: true,
      data: {
        summary: {
          total_visits: parseInt(statsResult.rows[0].total_visits),
          desktop_visits: parseInt(statsResult.rows[0].desktop_visits),
          mobile_visits: parseInt(statsResult.rows[0].mobile_visits),
          authenticated_visits: parseInt(statsResult.rows[0].authenticated_visits),
          anonymous_visits: parseInt(statsResult.rows[0].anonymous_visits)
        },
        daily: dailyResult.rows
      }
    });
    
  } catch (error) {
    console.error('❌ Visitor stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get visitor statistics',
      error: error.message
    });
  }
});

module.exports = router;
