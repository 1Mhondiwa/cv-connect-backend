const axios = require('axios');

async function testRegistrationEndpoint() {
  try {
    console.log('🔍 Testing Registration Trends Endpoint...\n');
    
    // Test the endpoint directly
    const response = await axios.get('http://localhost:5000/api/admin/analytics/registration-trends');
    
    console.log('📊 Response Status:', response.status);
    console.log('📊 Response Success:', response.data.success);
    console.log('📊 Data Length:', response.data.data ? response.data.data.length : 'No data');
    
    if (response.data.data && response.data.data.length > 0) {
      console.log('\n📈 First 3 items:');
      response.data.data.slice(0, 3).forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.date}: total_users=${item.total_users}, associates=${item.associates}, freelancers=${item.freelancers}, admins=${item.admins}, ecs_employees=${item.ecs_employees}`);
      });
      
      console.log('\n🔍 Sample item keys:', Object.keys(response.data.data[0]));
    }
    
  } catch (error) {
    console.error('❌ Error:', error.response ? error.response.data : error.message);
  }
}

testRegistrationEndpoint();

