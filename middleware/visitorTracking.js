const db = require('../config/database');

// Device detection helper function
function detectDeviceType(userAgent) {
  if (!userAgent) return 'unknown';
  
  const ua = userAgent.toLowerCase();
  
  // Check for mobile devices
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone') || ua.includes('ipad')) {
    return 'mobile';
  }
  
  // Check for tablets
  if (ua.includes('tablet') || ua.includes('ipad')) {
    return 'tablet';
  }
  
  // Check for desktop
  if (ua.includes('windows') || ua.includes('macintosh') || ua.includes('linux') || ua.includes('x11')) {
    return 'desktop';
  }
  
  return 'unknown';
}

// Visitor tracking middleware
const trackVisitor = async (req, res, next) => {
  try {
    // Only track GET requests to avoid spam from POST/PUT/DELETE
    if (req.method !== 'GET') {
      return next();
    }
    
    // Skip tracking for API endpoints and static files
    const skipPaths = [
      '/api/',
      '/uploads/',
      '/favicon.ico',
      '/assets/',
      '/static/'
    ];
    
    if (skipPaths.some(path => req.path.startsWith(path))) {
      return next();
    }
    
    // Only track actual page visits (not API calls)
    if (req.path.includes('.')) {
      return next(); // Skip files with extensions
    }
    
    // Extract visitor information
    const sessionId = req.sessionID || `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'Web Browser';
    const deviceType = detectDeviceType(userAgent);
    const visitDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const pageVisited = req.originalUrl || req.url;
    const referrer = req.headers.referer || req.headers.referrer || null;
    const visitTime = new Date();
    
    // Get user ID if user is authenticated (from JWT token)
    let userId = null;
    try {
      // Try to extract user from JWT token if present
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        // Note: In a real implementation, you'd verify the JWT token here
        // For now, we'll track as anonymous
      }
    } catch (error) {
      // Ignore token extraction errors
    }
    
    // Insert visitor tracking record
    await db.query(`
      INSERT INTO "Visitor_Tracking" (
        session_id, ip_address, user_agent, device_type, 
        visit_date, visit_time, page_visited, referrer, user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [sessionId, ipAddress, userAgent, deviceType, visitDate, visitTime, pageVisited, referrer, userId]);
    
    // Log for debugging
    console.log('💻 Web visitor tracked:', {
      sessionId: sessionId.substring(0, 15) + '...',
      deviceType,
      pageVisited: pageVisited.substring(0, 50),
      userId: userId ? 'authenticated' : 'anonymous',
      ip: ipAddress.substring(0, 15) + '...'
    });
    
  } catch (error) {
    // Don't let visitor tracking errors break the main request
    console.error('❌ Visitor tracking error:', error.message);
  }
  
  next();
};

// Rate limiting for visitor tracking to prevent spam
const visitorTrackingRateLimit = (req, res, next) => {
  // Simple rate limiting: only track one visit per session per page per day
  const sessionId = req.sessionID || req.headers['x-session-id'] || 'anonymous';
  const pageVisited = req.originalUrl || req.url;
  const visitDate = new Date().toISOString().split('T')[0];
  
  // Create a unique key for this session+page+date combination
  const trackingKey = `${sessionId}_${pageVisited}_${visitDate}`;
  
  // Store in memory (in production, use Redis)
  if (!global.visitorTrackingCache) {
    global.visitorTrackingCache = new Set();
  }
  
  // Clean old entries (older than 1 day)
  if (global.visitorTrackingCache.size > 10000) {
    global.visitorTrackingCache.clear();
  }
  
  // Check if we've already tracked this session+page+date
  if (global.visitorTrackingCache.has(trackingKey)) {
    return next(); // Skip tracking
  }
  
  // Mark as tracked
  global.visitorTrackingCache.add(trackingKey);
  
  // Continue to tracking middleware
  return trackVisitor(req, res, next);
};

module.exports = {
  trackVisitor,
  visitorTrackingRateLimit,
  detectDeviceType
};
