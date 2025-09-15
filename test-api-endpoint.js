const axios = require('axios');

async function testContractAPI() {
  try {
    console.log('🔍 Testing contract API endpoint...');
    
    // First, let's test if the server is running
    const healthCheck = await axios.get('http://localhost:5000/api/health');
    console.log('✅ Server is running');
    
    // Test the freelancer hiring history endpoint
    // Note: This will fail without proper authentication, but we can see the response
    try {
      const response = await axios.get('http://localhost:5000/api/freelancer/hiring/history');
      console.log('✅ API endpoint accessible:', response.data);
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ API endpoint exists (authentication required)');
        console.log('📄 Response:', error.response.data);
      } else {
        console.log('❌ API endpoint error:', error.response?.data || error.message);
      }
    }
    
  } catch (error) {
    console.log('❌ Server not running or API not accessible:', error.message);
    console.log('💡 Make sure to start the backend server with: npm start');
  }
}

testContractAPI();
