const db = require('./config/database');

(async () => {
  try {
    const cols = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'Job_Posting'
      ORDER BY ordinal_position
    `);
    console.log('Job_Posting columns:\n', cols.rows);
  } catch (e) {
    console.error('Error reading Job_Posting schema:', e);
  } finally {
    process.exit(0);
  }
})();


