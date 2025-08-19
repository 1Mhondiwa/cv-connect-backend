const db = require('../config/database');

async function logActivity({ user_id, role, activity_type, status = 'Completed', details = null }) {
  try {
    // Insert activity into database
    const result = await db.query(
      `INSERT INTO "Activity" (user_id, role, activity_type, status, details)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING activity_id, activity_date`,
      [user_id, role, activity_type, status, details]
    );

    // Get the inserted activity data
    const activity = result.rows[0];
    
    // Broadcast activity update to connected clients if app context is available
    if (global.app && global.app.locals && global.app.locals.activityConnections) {
      const userConnection = global.app.locals.activityConnections.get(user_id);
      if (userConnection) {
        try {
          const activityData = {
            type: 'new_activity',
            activity: {
              activity_id: activity.activity_id,
              activity_date: activity.activity_date,
              activity_type: activity_type,
              status: status,
              details: details
            }
          };
          userConnection.write(`data: ${JSON.stringify(activityData)}\n\n`);
        } catch (error) {
          console.error('Error broadcasting activity update:', error);
        }
      }
    }

    return activity;
  } catch (error) {
    console.error('Error logging activity:', error);
    throw error;
  }
}

module.exports = { logActivity }; 