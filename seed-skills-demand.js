const db = require('./config/database');

const CORE_SKILLS = [
  'JavaScript','React','Node','Python','Django','Java','Spring','SQL','PostgreSQL','MongoDB',
  'AWS','Docker','Git','TypeScript','HTML','CSS','Tailwind','Bootstrap','Vue','Angular',
  'PHP','Laravel','Go','Ruby','Rails','Kotlin','Swift','Flutter','C#','C++'
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }

async function getSupplyTopSkills(limit = 20) {
  // Approximate supply from Freelancer_Skill join counts
  const res = await db.query(`
    SELECT s.skill_name as skill, COUNT(fs.freelancer_id) as supply
    FROM "Freelancer_Skill" fs
    JOIN "Skill" s ON fs.skill_id = s.skill_id
    GROUP BY s.skill_name
    ORDER BY supply DESC
    LIMIT $1
  `, [limit]);
  return res.rows.map(r => ({ skill: r.skill, supply: parseInt(r.supply) }));
}

async function seedJobPostingsDemand() {
  const client = await db.pool.connect();
  try {
    console.log('✅ Connected to DB');
    const topSupply = await getSupplyTopSkills(25);
    console.log('🔍 Top supply skills:', topSupply);

    await client.query('BEGIN');

    // Optional cleanup of demo rows only
    await client.query(`DELETE FROM "Job_Posting" WHERE title LIKE '[demo_seed]%'`);

    // Create job postings that reflect demand matching supply (biased to top skills)
    const postings = [];
    const postingCount = Math.max(40, Math.min(120, topSupply.reduce((sum, s) => sum + Math.ceil(s.supply/5), 0)));

    for (let i=0;i<postingCount;i++) {
      // Select 3-5 skills with higher chance from topSupply
      const skills = new Set();
      const num = randInt(3,5);
      while (skills.size < num) {
        const chooseTop = Math.random() < 0.75;
        const skillName = chooseTop ? pick(topSupply).skill : pick(CORE_SKILLS);
        skills.add(skillName);
      }
      const skillsList = Array.from(skills);
      const title = `[demo_seed] ${pick(['Senior','Mid','Junior'])} ${pick(['Developer','Engineer','Specialist'])}`;
      const desc = `Looking for ${skillsList.join(', ')} experience to deliver features on time.`;
      const required_skills = skillsList.join(',');

      postings.push({ title, description: desc, required_skills, is_active: true });
    }

    // Fetch some associates to attach postings to
    const assoc = await client.query('SELECT associate_id FROM "Associate" ORDER BY associate_id ASC LIMIT 50');
    const associates = assoc.rows.map(r => r.associate_id);

    for (const p of postings) {
      const associate_id = associates.length ? pick(associates) : 1;
      const required_yrs_experience = randInt(1, 8);
      // Use actual enum labels
      const job_type = pick(['Contract','Freelance','FullTime','Internship','PartTime','Temporary']);
      const work_mode = pick(['Hybrid','Onsite','Remote']);
      const posted_date = new Date();
      posted_date.setDate(posted_date.getDate() - randInt(0, 60));
      const deadline = new Date(posted_date); deadline.setDate(deadline.getDate() + randInt(14, 45));

      await client.query(`
        INSERT INTO "Job_Posting" (
          associate_id, title, description, required_skills,
          required_yrs_experience, job_type, work_mode, posted_date, deadline, is_active
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      `, [
        associate_id, p.title, p.description, p.required_skills,
        required_yrs_experience, job_type, work_mode, posted_date, deadline, true
      ]);
    }

    await client.query('COMMIT');
    console.log(`🎉 Seeded ${postings.length} job postings reflecting skills demand`);

    // Quick verification for analytics endpoint coverage
    const verify = await db.query(`
      SELECT COUNT(*) AS active_jobs FROM "Job_Posting" WHERE is_active = true AND title LIKE '[demo_seed]%'`);
    console.log('✅ Verification:', verify.rows[0]);
  } catch (err) {
    try { await db.pool.query('ROLLBACK'); } catch {}
    console.error('❌ Seeding error:', err);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

seedJobPostingsDemand();


