const db = require('./config/database');
const { v4: uuidv4 } = require('uuid');

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

async function getUsers() {
  const freelancers = await db.query("SELECT user_id FROM \"User\" WHERE user_type = 'freelancer' AND is_active = true LIMIT 200");
  const associates = await db.query("SELECT user_id FROM \"User\" WHERE user_type = 'associate' AND is_active = true LIMIT 100");
  return { freelancers: freelancers.rows.map(r => r.user_id), associates: associates.rows.map(r => r.user_id) };
}

async function seedVisitors() {
  let client;
  try {
    client = await db.pool.connect();
    console.log('✅ Connected to DB');

    // Remove previous demo sessions
    await client.query(`DELETE FROM "Visitor_Tracking" WHERE session_id LIKE 'demo-%'`);

    const { freelancers, associates } = await getUsers();

    const today = new Date();
    const start = new Date(); start.setMonth(start.getMonth() - 3);

    await client.query('BEGIN');

    for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
      const day = new Date(d);
      const isWeekend = day.getDay() === 0 || day.getDay() === 6;

      // Baseline volumes
      const desktopVisits = isWeekend ? randInt(5, 20) : randInt(15, 45);
      const mobileVisitsFreelancers = isWeekend ? randInt(25, 70) : randInt(40, 110); // higher mobile usage by freelancers
      const mobileVisitsAssociates = isWeekend ? randInt(5, 15) : randInt(10, 35);

      const totalMobile = mobileVisitsFreelancers + mobileVisitsAssociates;

      const insertVisit = async (device, userId, page) => {
        const sessionId = `demo-${uuidv4()}`;
        const visit_time = new Date(day.getFullYear(), day.getMonth(), day.getDate(), randInt(7, 22), randInt(0, 59), randInt(0, 59));
        await client.query(`
          INSERT INTO "Visitor_Tracking" (session_id, ip_address, user_agent, device_type, visit_date, visit_time, page_visited, referrer, user_id, country, city, created_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        `, [
          sessionId,
          '127.0.0.1',
          device === 'mobile' ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)' : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          device,
          day,
          visit_time,
          page,
          pick(['direct','google','linkedin','github','twitter']),
          userId || null,
          pick(['South Africa','Zimbabwe','Botswana','Namibia','Zambia']),
          pick(['Johannesburg','Cape Town','Harare','Gaborone','Windhoek']),
          visit_time
        ]);
      };

      // Insert desktop visits (mostly associates and general visitors)
      for (let i=0;i<desktopVisits;i++) {
        const userId = Math.random() < 0.6 && associates.length ? pick(associates) : null;
        await insertVisit('desktop', userId, pick(['/admin/dashboard','/analytics','/freelancers','/']));
      }

      // Insert mobile freelancer-heavy visits
      for (let i=0;i<mobileVisitsFreelancers;i++) {
        const userId = freelancers.length ? pick(freelancers) : null;
        await insertVisit('mobile', userId, pick(['/ecs-employee-dashboard','/freelancer/profile','/jobs','/messages']));
      }

      // Insert mobile associate/general
      for (let i=0;i<mobileVisitsAssociates;i++) {
        const userId = Math.random() < 0.5 && associates.length ? pick(associates) : null;
        await insertVisit('mobile', userId, pick(['/admin/dashboard','/associate/requests','/hiring','/messages']));
      }
    }

    await client.query('COMMIT');
    console.log('🎉 Seeded realistic desktop vs mobile visitors for the last 3 months');
  } catch (err) {
    if (client) { try { await client.query('ROLLBACK'); } catch {} }
    console.error('❌ Visitor seeding error:', err);
    process.exit(1);
  } finally {
    if (client) client.release();
    process.exit(0);
  }
}

seedVisitors();


