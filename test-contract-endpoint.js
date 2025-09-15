const { pool } = require('./config/database');

async function testContractEndpoint() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Testing contract endpoint...');
    
    // First, check if the contract_pdf_path column exists
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Freelancer_Hire' 
      AND column_name = 'contract_pdf_path'
    `);
    
    if (columnCheck.rows.length === 0) {
      console.log('❌ contract_pdf_path column does not exist. Adding it...');
      
      // Add the column
      await client.query(`
        ALTER TABLE "Freelancer_Hire"
        ADD COLUMN IF NOT EXISTS contract_pdf_path VARCHAR(255)
      `);
      
      console.log('✅ contract_pdf_path column added successfully!');
    } else {
      console.log('✅ contract_pdf_path column already exists');
    }
    
    // Check if there are any hiring records
    const hiringRecords = await client.query(`
      SELECT COUNT(*) as count FROM "Freelancer_Hire"
    `);
    
    console.log(`📊 Total hiring records: ${hiringRecords.rows[0].count}`);
    
    // Get a sample freelancer ID to test with
    const freelancerResult = await client.query(`
      SELECT f.freelancer_id, f.first_name, f.last_name, u.email
      FROM "Freelancer" f
      JOIN "User" u ON f.user_id = u.user_id
      LIMIT 1
    `);
    
    if (freelancerResult.rows.length > 0) {
      const freelancerId = freelancerResult.rows[0].freelancer_id;
      console.log(`👤 Testing with freelancer: ${freelancerResult.rows[0].first_name} ${freelancerResult.rows[0].last_name} (ID: ${freelancerId})`);
      
      // Test the hiring history query
      const hiringHistoryResult = await client.query(`
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
      
      console.log(`📄 Found ${hiringHistoryResult.rows.length} hiring records for freelancer ${freelancerId}`);
      
      if (hiringHistoryResult.rows.length > 0) {
        console.log('📋 Sample hiring record:');
        console.log(JSON.stringify(hiringHistoryResult.rows[0], null, 2));
      } else {
        console.log('ℹ️ No hiring records found for this freelancer');
      }
    } else {
      console.log('❌ No freelancers found in database');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

testContractEndpoint();
