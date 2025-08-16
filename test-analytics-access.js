const axios = require('axios');

async function testAnalyticsAccess() {
  console.log('🧪 Testing analytics endpoints accessibility...\n');
  
  const baseURL = 'http://localhost:5000/api';
  
  // Test endpoints without authentication (should return 401)
  const endpoints = [
    '/admin/analytics/registration-trends?days=90',
    '/admin/analytics/cv-upload-trends?days=90',
    '/admin/analytics/message-trends?days=90',
    '/admin/analytics/hired-freelancers-trends?days=90',
    '/admin/analytics/user-type-distribution',
    '/admin/analytics/top-skills',
    '/admin/analytics/cv-file-types',
    '/admin/analytics/user-communication-activity'
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`🔍 Testing: ${endpoint}`);
      const response = await axios.get(`${baseURL}${endpoint}`);
      console.log(`✅ Success: ${response.status} - ${response.data.success}`);
    } catch (error) {
      if (error.response) {
        console.log(`❌ Error: ${error.response.status} - ${error.response.data.message || error.response.statusText}`);
      } else {
        console.log(`❌ Network Error: ${error.message}`);
      }
    }
    console.log('');
  }
  
  // Test if server is running
  try {
    console.log('🔍 Testing server health...');
    const healthResponse = await axios.get(`${baseURL}/health`);
    console.log(`✅ Server Health: ${healthResponse.status} - ${healthResponse.data.status}`);
  } catch (error) {
    console.log(`❌ Server Health Check Failed: ${error.message}`);
  }
}

testAnalyticsAccess();

