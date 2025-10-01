const db = require('../config/database');

function toTitleCaseSafe(text) {
  if (!text || typeof text !== 'string') return text;
  const cleaned = text
    .replace(/[_\-]{2,}/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return cleaned
    .toLowerCase()
    .replace(/(^|[\s"'([{\-])([a-z])/g, (m, p1, p2) => p1 + p2.toUpperCase());
}

function sanitizeDescription(text) {
  if (!text || typeof text !== 'string') return text;
  const stripped = text
    .replace(/x{5,}/gi, '')
    .replace(/lorem ipsum.*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (stripped.length >= 40) return stripped;
  // Provide a generic but professional default if too short or placeholder
  return 'We require an experienced professional to assist with an upcoming project. Strong communication and reliability are essential.';
}

function normalizeSkills(skills) {
  if (!skills) return [];
  if (Array.isArray(skills)) return skills.map(s => toTitleCaseSafe(String(s))).filter(Boolean);
  if (typeof skills === 'string') {
    try { const arr = JSON.parse(skills); if (Array.isArray(arr)) return arr.map(s => toTitleCaseSafe(String(s))).filter(Boolean); } catch {}
    return skills.split(/[,;\n]/).map(s => toTitleCaseSafe(s)).filter(Boolean);
  }
  return [];
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

const SAMPLE_TITLES = [
  'Plumber Needed For Residential Repairs',
  'Site Electrician For Upgrade Project',
  'Transport And Logistics Coordinator',
  'Painting Contractor For Office Renovation',
  'Tile Installer For Apartment Block',
  'Carpenter For Custom Cabinetry',
  'Civil Works Foreman',
  'General Contractor For Small Builds'
];

const SAMPLE_DESCRIPTIONS = [
  'Looking for a reliable professional to assist on a short-term project. Must have recent references and own tools.',
  'We need an experienced contractor to support our team. Strong safety practices required.',
  'Assist with scheduled maintenance and respond to ad-hoc tasks as needed. Weekend availability a plus.',
  'Coordinate with our internal team to deliver the scope on time and within budget. Clear communication is essential.'
];

const SAMPLE_SKILLS = [
  ['Plumbing', 'PVC', 'Leak Detection'],
  ['Electrical', '3-Phase', 'Compliance'],
  ['Logistics', 'Scheduling', 'Vendor Coordination'],
  ['Painting', 'Surface Prep', 'Finishing'],
  ['Tiling', 'Waterproofing', 'Grouting'],
  ['Carpentry', 'Cabinetry', 'Finishing'],
  ['Civil', 'Concrete', 'Formwork']
];

const REAL_WORLD_COMPANIES = [
  // Construction & Engineering
  'Mkhize Construction',
  'Steel & Stone Builders',
  'Premier Contractors',
  'Metro Construction Group',
  'Elite Building Solutions',
  'ProBuild Contractors',
  'Solid Foundations Ltd',
  'Apex Construction',
  'Reliable Builders',
  'Master Crafts Construction',
  
  // Technology & IT
  'TechFlow Solutions',
  'Digital Innovations Ltd',
  'CloudTech Systems',
  'DataCore Technologies',
  'SmartLogic Solutions',
  
  // Manufacturing & Industrial
  'Industrial Dynamics',
  'Precision Manufacturing Co',
  'Metro Industrial Group',
  'Advanced Materials Ltd',
  'Production Systems Inc',
  
  // Healthcare & Medical
  'MedCare Solutions',
  'HealthTech Innovations',
  'Medical Systems Ltd',
  'CareFirst Technologies',
  'BioMed Solutions',
  
  // Financial & Business Services
  'Capital Partners Ltd',
  'Business Solutions Group',
  'Financial Dynamics',
  'Corporate Services Inc',
  'Investment Holdings',
  
  // Retail & Commerce
  'Retail Dynamics',
  'Commerce Solutions',
  'Market Leaders Ltd',
  'Trade Partners Inc',
  'Commercial Ventures',
  
  // Logistics & Transportation
  'LogiFlow Systems',
  'Transport Solutions Ltd',
  'Fleet Management Co',
  'Supply Chain Dynamics',
  'Delivery Express'
];

const REAL_WORLD_INDUSTRIES = [
  'Construction',
  'Building & Construction',
  'Civil Engineering',
  'General Contracting',
  'Technology',
  'Information Technology',
  'Software Development',
  'Manufacturing',
  'Industrial Manufacturing',
  'Healthcare',
  'Medical Services',
  'Financial Services',
  'Business Services',
  'Retail',
  'Commerce',
  'Logistics',
  'Transportation',
  'Supply Chain'
];

const LOCATIONS = ['Any', 'Johannesburg', 'Pretoria', 'Cape Town', 'Durban', 'Polokwane'];
const BUDGETS = ['Under R15,000', 'R15,000 - R75,000', 'R75,000 - R150,000'];
const URGENCY = ['low', 'normal', 'high', 'urgent'];

async function cleanExistingRequests() {
  const { rows } = await db.query('SELECT request_id, title, description, required_skills FROM "Associate_Freelancer_Request"');
  let updated = 0;
  for (const r of rows) {
    const newTitle = toTitleCaseSafe(r.title);
    const newDesc = sanitizeDescription(r.description);
    const newSkills = normalizeSkills(r.required_skills);
    const needsUpdate = newTitle !== r.title || newDesc !== r.description || JSON.stringify(newSkills) !== JSON.stringify(r.required_skills);
    if (needsUpdate) {
      await db.query(
        'UPDATE "Associate_Freelancer_Request" SET title = $1, description = $2, required_skills = $3 WHERE request_id = $4',
        [newTitle, newDesc, newSkills, r.request_id]
      );
      updated++;
    }
  }
  return updated;
}

async function cleanUnprofessionalCompanyNames() {
  // Clean up any unprofessional company names like "tech", "Technology", "DanMusic", etc.
  const unprofessionalNames = ['tech', 'Technology', 'DanMusic', 'josh', 'test', 'demo', 'sample'];
  let updated = 0;
  
  for (const badName of unprofessionalNames) {
    const result = await db.query(
      'UPDATE "Associate" SET company_name = $1 WHERE LOWER(company_name) = LOWER($2)',
      [pick(REAL_WORLD_COMPANIES), badName]
    );
    updated += result.rowCount;
  }
  
  return updated;
}

function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d; }

async function updateAssociatesToRealCompanies() {
  // Update existing associates to have real-world company names and industries
  const associates = await db.query('SELECT associate_id FROM "Associate" ORDER BY associate_id DESC LIMIT 20');
  let updated = 0;
  
  for (const assoc of associates.rows) {
    const companyName = pick(REAL_WORLD_COMPANIES);
    const industry = pick(REAL_WORLD_INDUSTRIES);
    
    await db.query(
      'UPDATE "Associate" SET company_name = $1, industry = $2 WHERE associate_id = $3',
      [companyName, industry, assoc.associate_id]
    );
    updated++;
  }
  
  return updated;
}

async function seedRequestsForLast3Months() {
  // Get some associates to attach requests to
  const assoc = await db.query('SELECT associate_id FROM "Associate" ORDER BY associate_id DESC LIMIT 50');
  const associates = assoc.rows.map(r => r.associate_id);
  if (associates.length === 0) return 0;

  const totalToInsert = 45; // about 15 per month
  let inserted = 0;
  for (let i = 0; i < totalToInsert; i++) {
    const skills = pick(SAMPLE_SKILLS); // ensure this is an array of strings
    const title = pick(SAMPLE_TITLES);
    const description = pick(SAMPLE_DESCRIPTIONS);
    const min_experience = randInt(1, 5);
    const preferred_location = pick(LOCATIONS);
    const budget_range = pick(BUDGETS);
    const urgency_level = pick(URGENCY);
    const status = pick(['pending', 'provided']);

    // Spread across last ~90 days
    const createdAt = daysAgo(randInt(1, 90));

    await db.query(
      `INSERT INTO "Associate_Freelancer_Request"
       (associate_id, title, description, required_skills, min_experience, preferred_location, budget_range, urgency_level, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)`,
      [pick(associates), title, description, skills, min_experience, preferred_location, budget_range, urgency_level, status, createdAt]
    );
    inserted++;
  }
  return inserted;
}

(async () => {
  try {
    console.log('🔧 Cleaning existing Associate_Freelancer_Request data...');
    const updated = await cleanExistingRequests();
    console.log(`✅ Cleaned ${updated} requests`);

    console.log('🧹 Cleaning unprofessional company names...');
    const cleanedCompanies = await cleanUnprofessionalCompanyNames();
    console.log(`✅ Cleaned ${cleanedCompanies} unprofessional company names`);

    console.log('🏢 Updating associates to real-world companies...');
    const associatesUpdated = await updateAssociatesToRealCompanies();
    console.log(`✅ Updated ${associatesUpdated} associates to real-world companies`);

    console.log('🌱 Seeding realistic requests for the last 3 months...');
    const inserted = await seedRequestsForLast3Months();
    console.log(`✅ Inserted ${inserted} new requests`);

    console.log('🎉 Done');
  } catch (err) {
    console.error('❌ Error running cleanup/seed:', err);
  } finally {
    process.exit();
  }
})();
