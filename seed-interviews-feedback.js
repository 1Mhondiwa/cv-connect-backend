const db = require('./config/database');

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }

async function getContext() {
  const associates = await db.query('SELECT associate_id, user_id, industry FROM "Associate" ORDER BY associate_id ASC LIMIT 100');
  const freelancers = await db.query('SELECT freelancer_id, user_id FROM "Freelancer" WHERE is_approved = true ORDER BY freelancer_id DESC LIMIT 200');
  const requests = await db.query('SELECT request_id, associate_id, title FROM "Associate_Freelancer_Request" ORDER BY request_id DESC LIMIT 300');
  const hires = await db.query("SELECT hire_id, request_id, associate_id, freelancer_id, hire_date FROM \"Freelancer_Hire\" WHERE hire_date >= NOW() - INTERVAL '90 days'");
  return { associates: associates.rows, freelancers: freelancers.rows, requests: requests.rows, hires: hires.rows };
}

async function seedInterviews() {
  let client;
  try {
    client = await db.pool.connect();
    console.log('✅ Connected to DB');

    const { associates, freelancers, requests, hires } = await getContext();
    if (!associates.length || !freelancers.length || !requests.length) {
      console.log('⚠️ Not enough base data to seed interviews.');
      return;
    }

    await client.query('BEGIN');

    // Optionally clean previous demo rows
    await client.query(`DELETE FROM "Interview_Feedback" WHERE detailed_feedback LIKE '[demo_seed]%'`);
    await client.query(`DELETE FROM "Interview" WHERE interview_notes LIKE '[demo_seed]%'`);

    const today = new Date();
    const start = addDays(today, -89);

    // Aim total interviews around number of hires with a ratio (e.g., 1.5x interviews per hire)
    const targetInterviews = Math.max(hires.length * 1.5, 60);
    let created = 0;

    while (created < targetInterviews) {
      const hire = hires.length ? pick(hires) : null;
      const req = hire ? requests.find(r => r.request_id === hire.request_id) || pick(requests) : pick(requests);
      const assoc = associates.find(a => a.associate_id === req.associate_id) || pick(associates);
      const free = hire ? { freelancer_id: hire.freelancer_id } : pick(freelancers);

      const when = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      when.setDate(when.getDate() + randInt(0, 89));
      when.setHours(randInt(9, 16), randInt(0, 59), 0, 0);

      const interviewType = pick(['video','phone','in_person']);
      const status = Math.random() < 0.8 ? 'completed' : 'scheduled';
      const duration = pick([30,45,60,90]);
      const meetingLink = interviewType === 'video' ? `room-${randInt(10000,99999)}` : null;
      const location = interviewType === 'in_person' ? 'Associate HQ' : null;

      const res = await client.query(`
        INSERT INTO "Interview" (
          request_id, associate_id, freelancer_id, interview_type, scheduled_date,
          duration_minutes, meeting_link, location, interview_notes, status
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        RETURNING interview_id
      `, [req.request_id, assoc.associate_id, free.freelancer_id, interviewType, when, duration, meetingLink, location, '[demo_seed] seeded interview', status]);
      const interviewId = res.rows[0].interview_id;

      // Feedback for completed interviews (both sides possible)
      if (status === 'completed') {
        const submissions = pick([1,2]);
        for (let k=0;k<submissions;k++) {
          const evaluatorType = k === 0 ? 'associate' : 'freelancer';
          const evaluatorId = evaluatorType === 'associate' ? assoc.user_id : (freelancers.find(f => f.freelancer_id === free.freelancer_id)?.user_id || null);
          if (!evaluatorId) continue;
          const ratings = {
            tech: randInt(3,5),
            comm: randInt(3,5),
            fit: randInt(3,5)
          };
          const overall = Math.round((ratings.tech + ratings.comm + ratings.fit) / 3);
          const recommendation = pick(['hire','maybe','no_hire']);
          await client.query(`
            INSERT INTO "Interview_Feedback" (
              interview_id, evaluator_id, evaluator_type, technical_skills_rating,
              communication_rating, cultural_fit_rating, overall_rating, recommendation,
              strengths, areas_for_improvement, detailed_feedback, submitted_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
          `, [
            interviewId, evaluatorId, evaluatorType, ratings.tech, ratings.comm, ratings.fit, overall, recommendation,
            'Strong portfolio and relevant experience', 'Could improve documentation and testing', '[demo_seed] feedback', addDays(when, randInt(0,5))
          ]);
        }
      }

      created++;
    }

    await client.query('COMMIT');
    console.log(`🎉 Seeded ${created} interviews with feedback where applicable`);

    const stats = await db.query(`
      SELECT COUNT(*) total_interviews,
             COUNT(*) FILTER (WHERE status = 'completed') completed
      FROM "Interview" WHERE created_at >= NOW() - INTERVAL '90 days'`);
    console.log('✅ Verification:', stats.rows[0]);
  } catch (err) {
    if (client) { try { await client.query('ROLLBACK'); } catch {} }
    console.error('❌ Seeding error:', err);
    process.exit(1);
  } finally {
    if (client) client.release();
    process.exit(0);
  }
}

seedInterviews();


