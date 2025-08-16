const axios = require('axios');

async function testBackendConnection() {
  console.log('🧪 Testing backend server connection...\n');
  
  const baseURL = 'http://localhost:5000';
  
  try {
    // Test basic server response
    console.log('🔍 Testing server response...');
    const response = await axios.get(`${baseURL}/api/health`);
    console.log(`✅ Server Health: ${response.status} - ${response.data.status}`);
  } catch (error) {
    console.log(`❌ Server Health Check Failed: ${error.message}`);
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Backend server is not running on port 5000');
      console.log('💡 Start your backend server with: npm start');
    }
    return;
  }
  
  // Test if analytics endpoints are accessible (should return 401 for auth)
  console.log('\n🔍 Testing analytics endpoints...');
  const endpoints = [
    '/api/admin/analytics/registration-trends?days=90',
    '/api/admin/analytics/cv-upload-trends?days=90',
    '/api/admin/analytics/message-trends?days=90',
    '/api/admin/analytics/hired-freelancers-trends?days=90'
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`🔍 Testing: ${endpoint}`);
      const response = await axios.get(`${baseURL}${endpoint}`);
      console.log(`✅ Success: ${response.status}`);
    } catch (error) {
      if (error.response) {
        console.log(`❌ Error: ${error.response.status} - ${error.response.data.message || error.response.statusText}`);
      } else {
        console.log(`❌ Network Error: ${error.message}`);
      }
    }
  }
}

testBackendConnection();

