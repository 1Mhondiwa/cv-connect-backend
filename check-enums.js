const db = require('./config/database');

(async () => {
  try {
    const res = await db.query(`
      SELECT t.typname AS enum_type, e.enumlabel AS label
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typname IN ('job_type','work_mode')
      ORDER BY t.typname, e.enumlabel
    `);
    const byType = res.rows.reduce((acc, r) => {
      acc[r.enum_type] = acc[r.enum_type] || [];
      acc[r.enum_type].push(r.label);
      return acc;
    }, {});
    console.log(byType);
  } catch (e) {
    console.error('Error reading enums:', e);
  } finally {
    process.exit(0);
  }
})();


