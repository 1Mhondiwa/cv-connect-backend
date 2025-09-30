const db = require('./config/database');

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

async function fetchIds() {
  const associates = await db.query('SELECT associate_id FROM "Associate" ORDER BY associate_id ASC LIMIT 100');
  const requests = await db.query('SELECT request_id, associate_id FROM "Associate_Freelancer_Request" ORDER BY request_id DESC LIMIT 200');
  const freelancers = await db.query('SELECT freelancer_id FROM "Freelancer" WHERE is_approved = true ORDER BY freelancer_id DESC LIMIT 300');
  return {
    associates: associates.rows.map(r => r.associate_id),
    requests: requests.rows.map(r => ({ request_id: r.request_id, associate_id: r.associate_id })),
    freelancers: freelancers.rows.map(r => r.freelancer_id)
  };
}

async function seedHires() {
  let client;
  try {
    client = await db.pool.connect();
    console.log('✅ Connected to DB');

    // Remove previously seeded demo rows to keep idempotent
    console.log('🧹 Cleaning previously seeded demo hires (if any)...');
    await client.query(`DELETE FROM "Freelancer_Hire" WHERE admin_notes LIKE 'seeded_for_demo_%'`);

    const { associates, requests, freelancers } = await fetchIds();
    if (associates.length === 0 || requests.length === 0 || freelancers.length === 0) {
      console.log('⚠️ Not enough data to seed hires. Need associates, requests, and freelancers.');
      return;
    }

    // Build a pool of combinations to choose from
    const combos = [];
    for (let i = 0; i < Math.min(100, requests.length); i++) {
      const req = requests[i];
      const associateId = req.associate_id || associates[getRandomInt(0, associates.length - 1)];
      const freelancerId = freelancers[getRandomInt(0, freelancers.length - 1)];
      combos.push({ request_id: req.request_id, associate_id: associateId, freelancer_id: freelancerId });
    }

    const today = new Date();
    const start = addDays(today, -89); // last 90 days inclusive

    // Decide number of hires per day with some variation
    const inserts = [];
    for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const count = isWeekend ? getRandomInt(0, 1) : getRandomInt(0, 3); // lighter on weekends
      for (let n = 0; n < count; n++) {
        const combo = combos[getRandomInt(0, combos.length - 1)];
        const rateType = Math.random() < 0.7 ? 'hourly' : 'fixed';
        const agreedRate = rateType === 'hourly' ? getRandomInt(200, 1200) : getRandomInt(10000, 120000);
        const statusRand = Math.random();
        const status = statusRand < 0.65 ? 'active' : (statusRand < 0.95 ? 'completed' : 'on_hold');
        const startDate = addDays(d, getRandomInt(0, 3));
        const expectedEndDate = addDays(startDate, getRandomInt(7, 60));
        const actualEndDate = status === 'completed' ? addDays(startDate, getRandomInt(7, 60)) : null;

        inserts.push({
          ...combo,
          hire_date: new Date(d),
          project_title: 'Contracted Project - ' + dateStr,
          project_description: 'Auto-seeded demo hire to showcase platform activity and trends.',
          agreed_rate: agreedRate,
          rate_type: rateType,
          start_date: startDate,
          expected_end_date: expectedEndDate,
          actual_end_date: actualEndDate,
          status,
          admin_notes: `seeded_for_demo_${dateStr}`
        });
      }
    }

    console.log(`📝 Prepared ${inserts.length} hire rows to insert`);

    await client.query('BEGIN');

    const insertSQL = `
      INSERT INTO "Freelancer_Hire"
      (request_id, associate_id, freelancer_id, hire_date, project_title, project_description,
       agreed_terms, agreed_rate, rate_type, start_date, expected_end_date, actual_end_date, status,
       associate_notes, freelancer_notes, admin_notes)
      VALUES ($1, $2, $3, $4, $5, $6,
              NULL, $7, $8, $9, $10, $11, $12,
              NULL, NULL, $13)
    `;

    for (const row of inserts) {
      await client.query(insertSQL, [
        row.request_id,
        row.associate_id,
        row.freelancer_id,
        row.hire_date,
        row.project_title,
        row.project_description,
        row.agreed_rate,
        row.rate_type,
        row.start_date,
        row.expected_end_date,
        row.actual_end_date,
        row.status,
        row.admin_notes
      ]);
    }

    await client.query('COMMIT');
    console.log('🎉 Seeded hired freelancers data for the last 90 days');

    // Simple verification: count last 90 days
    const verify = await db.query(`
      SELECT COUNT(*) AS count
      FROM "Freelancer_Hire"
      WHERE hire_date >= NOW() - INTERVAL '90 days'
    `);
    console.log(`✅ Verification: ${verify.rows[0].count} hires in last 90 days`);

  } catch (err) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch {}
    }
    console.error('❌ Seeding error:', err);
    process.exit(1);
  } finally {
    if (client) client.release();
    // do not end pool; allow caller script to exit
  }
}

seedHires().then(() => process.exit(0));


