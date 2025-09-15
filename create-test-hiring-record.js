const { pool } = require('./config/database');

async function createTestHiringRecord() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Creating test hiring record...');
    
    // First, ensure the contract_pdf_path column exists
    await client.query(`
      ALTER TABLE "Freelancer_Hire"
      ADD COLUMN IF NOT EXISTS contract_pdf_path VARCHAR(255)
    `);
    console.log('✅ contract_pdf_path column ensured');
    
    // Get a freelancer and associate for testing
    const freelancerResult = await client.query(`
      SELECT f.freelancer_id, f.first_name, f.last_name, u.email
      FROM "Freelancer" f
      JOIN "User" u ON f.user_id = u.user_id
      LIMIT 1
    `);
    
    const associateResult = await client.query(`
      SELECT a.associate_id, a.contact_person, u.email
      FROM "Associate" a
      JOIN "User" u ON a.user_id = u.user_id
      LIMIT 1
    `);
    
    if (freelancerResult.rows.length === 0) {
      console.log('❌ No freelancers found. Please create a freelancer first.');
      return;
    }
    
    if (associateResult.rows.length === 0) {
      console.log('❌ No associates found. Please create an associate first.');
      return;
    }
    
    const freelancerId = freelancerResult.rows[0].freelancer_id;
    const associateId = associateResult.rows[0].associate_id;
    
    console.log(`👤 Using freelancer: ${freelancerResult.rows[0].first_name} ${freelancerResult.rows[0].last_name}`);
    console.log(`🏢 Using associate: ${associateResult.rows[0].contact_person}`);
    
    // Create a test request first
    const requestResult = await client.query(`
      INSERT INTO "Associate_Freelancer_Request" 
      (associate_id, title, description, skills_required, budget_range, timeline, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING request_id
    `, [
      associateId,
      'Test Web Development Project',
      'A test project for contract functionality',
      'JavaScript, React, Node.js',
      'R15,000 - R75,000',
      '2 months',
      'active'
    ]);
    
    const requestId = requestResult.rows[0].request_id;
    console.log(`📋 Created test request: ${requestId}`);
    
    // Create a test hiring record with contract PDF
    const hiringResult = await client.query(`
      INSERT INTO "Freelancer_Hire"
      (request_id, associate_id, freelancer_id, project_title, project_description, 
       agreed_rate, rate_type, start_date, expected_end_date, status, contract_pdf_path)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING hire_id
    `, [
      requestId,
      associateId,
      freelancerId,
      'Test Web Development Project',
      'A comprehensive web development project using modern technologies',
      500.00,
      'hourly',
      '2024-01-15',
      '2024-03-15',
      'active',
      '/uploads/contracts/simple-test.pdf'
    ]);
    
    const hireId = hiringResult.rows[0].hire_id;
    console.log(`✅ Created test hiring record: ${hireId}`);
    
    // Test the hiring history query
    const historyResult = await client.query(`
      SELECT 
         h.hire_id,
         h.hire_date,
         h.project_title,
         h.project_description,
         h.agreed_terms,
         h.agreed_rate,
         h.rate_type,
         h.start_date,
         h.expected_end_date,
         h.actual_end_date,
         h.status,
         h.associate_notes,
         h.freelancer_notes,
         h.contract_pdf_path,
         a.contact_person as company_contact,
         a.industry,
         a.website,
         a.phone,
         a.address,
         u.email as company_email
       FROM "Freelancer_Hire" h
       JOIN "Associate" a ON h.associate_id = a.associate_id
       JOIN "User" u ON a.user_id = u.user_id
       WHERE h.freelancer_id = $1
       ORDER BY h.hire_date DESC
    `, [freelancerId]);
    
    console.log(`📄 Found ${historyResult.rows.length} hiring records for freelancer ${freelancerId}`);
    
    if (historyResult.rows.length > 0) {
      console.log('📋 Sample hiring record with contract:');
      console.log(JSON.stringify(historyResult.rows[0], null, 2));
    }
    
    console.log('🎉 Test data created successfully!');
    console.log('💡 You can now test the contract functionality in the freelancer dashboard');
    
  } catch (error) {
    console.error('❌ Error creating test data:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

createTestHiringRecord();
