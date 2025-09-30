const db = require('./config/database');

(async () => {
  try {
    const cols = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'Visitor_Tracking'
      ORDER BY ordinal_position
    `);
    console.log('Visitor_Tracking columns:\n', cols.rows);
  } catch (e) {
    console.error('Error reading Visitor_Tracking schema:', e);
  } finally {
    process.exit(0);
  }
})();


