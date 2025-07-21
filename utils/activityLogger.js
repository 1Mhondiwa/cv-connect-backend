const db = require('../config/database');

async function logActivity({ user_id, role, activity_type, status = 'Completed', details = null }) {
  await db.query(
    `INSERT INTO "Activity" (user_id, role, activity_type, status, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [user_id, role, activity_type, status, details]
  );
}

module.exports = { logActivity }; 