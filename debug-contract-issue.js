const { pool } = require('./config/database');

async function debugContractIssue() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Debugging contract issue...');
    
    // 1. Check if contract_pdf_path column exists
    console.log('\n1. Checking database schema...');
    const columnCheck = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'Freelancer_Hire' 
      AND column_name = 'contract_pdf_path'
    `);
    
    if (columnCheck.rows.length === 0) {
      console.log('❌ contract_pdf_path column does not exist');
      console.log('🔧 Adding contract_pdf_path column...');
      
      await client.query(`
        ALTER TABLE "Freelancer_Hire"
        ADD COLUMN IF NOT EXISTS contract_pdf_path VARCHAR(255)
      `);
      
      console.log('✅ contract_pdf_path column added');
    } else {
      console.log('✅ contract_pdf_path column exists:', columnCheck.rows[0]);
    }
    
    // 2. Check if there are any hiring records
    console.log('\n2. Checking hiring records...');
    const hiringCount = await client.query('SELECT COUNT(*) as count FROM "Freelancer_Hire"');
    console.log(`📊 Total hiring records: ${hiringCount.rows[0].count}`);
    
    // 3. Check if there are any freelancers
    console.log('\n3. Checking freelancers...');
    const freelancerCount = await client.query('SELECT COUNT(*) as count FROM "Freelancer"');
    console.log(`👥 Total freelancers: ${freelancerCount.rows[0].count}`);
    
    // 4. Get a sample freelancer and test the query
    console.log('\n4. Testing hiring history query...');
    const freelancerResult = await client.query(`
      SELECT f.freelancer_id, f.first_name, f.last_name, u.email, u.user_id
      FROM "Freelancer" f
      JOIN "User" u ON f.user_id = u.user_id
      LIMIT 1
    `);
    
    if (freelancerResult.rows.length > 0) {
      const freelancer = freelancerResult.rows[0];
      console.log(`👤 Testing with freelancer: ${freelancer.first_name} ${freelancer.last_name} (ID: ${freelancer.freelancer_id})`);
      
      // Test the exact query from the API
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
      `, [freelancer.freelancer_id]);
      
      console.log(`📄 Found ${hiringHistoryResult.rows.length} hiring records`);
      
      if (hiringHistoryResult.rows.length > 0) {
        console.log('📋 Sample record:');
        console.log(JSON.stringify(hiringHistoryResult.rows[0], null, 2));
      } else {
        console.log('ℹ️ No hiring records found for this freelancer');
        
        // Create a test record if none exist
        console.log('\n5. Creating test hiring record...');
        
        // Get an associate
        const associateResult = await client.query(`
          SELECT a.associate_id, a.contact_person, u.email, u.user_id
          FROM "Associate" a
          JOIN "User" u ON a.user_id = u.user_id
          LIMIT 1
        `);
        
        if (associateResult.rows.length > 0) {
          const associate = associateResult.rows[0];
          console.log(`🏢 Using associate: ${associate.contact_person}`);
          
          // Create a test request
          const requestResult = await client.query(`
            INSERT INTO "Associate_Freelancer_Request" 
            (associate_id, title, description, skills_required, budget_range, timeline, status, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            RETURNING request_id
          `, [
            associate.associate_id,
            'Test Contract Project',
            'A test project to verify contract functionality',
            'JavaScript, React',
            'R15,000 - R75,000',
            '1 month',
            'active'
          ]);
          
          const requestId = requestResult.rows[0].request_id;
          console.log(`📋 Created test request: ${requestId}`);
          
          // Create test hiring record
          const hiringResult = await client.query(`
            INSERT INTO "Freelancer_Hire"
            (request_id, associate_id, freelancer_id, project_title, project_description, 
             agreed_rate, rate_type, start_date, expected_end_date, status, contract_pdf_path)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING hire_id
          `, [
            requestId,
            associate.associate_id,
            freelancer.freelancer_id,
            'Test Contract Project',
            'A comprehensive test project for contract verification',
            500.00,
            'hourly',
            '2024-01-15',
            '2024-02-15',
            'active',
            '/uploads/contracts/simple-test.pdf'
          ]);
          
          const hireId = hiringResult.rows[0].hire_id;
          console.log(`✅ Created test hiring record: ${hireId}`);
          
          // Test the query again
          const testResult = await client.query(`
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
          `, [freelancer.freelancer_id]);
          
          console.log(`📄 Now found ${testResult.rows.length} hiring records`);
          if (testResult.rows.length > 0) {
            console.log('📋 Test record with contract:');
            console.log(JSON.stringify(testResult.rows[0], null, 2));
          }
        } else {
          console.log('❌ No associates found. Please create an associate first.');
        }
      }
    } else {
      console.log('❌ No freelancers found. Please create a freelancer first.');
    }
    
    console.log('\n🎉 Debug complete!');
    console.log('💡 If you see test data above, the contract functionality should work.');
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

debugContractIssue();
