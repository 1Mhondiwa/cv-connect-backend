const axios = require('axios');

async function testRealVisitorTracking() {
  try {
    console.log('🧪 Testing real visitor tracking system...\n');
    
    const baseURL = 'http://localhost:5000/api/visitor';
    
    // Test 1: Track mobile visit
    console.log('📱 Test 1: Tracking mobile visit...');
    try {
      const mobileResponse = await axios.post(`${baseURL}/track`, {
        device_type: 'mobile',
        page_visited: '/dashboard',
        user_agent: 'TestApp/1.0.0 (iOS 14.0)',
        user_id: 'test_user_123'
      });
      
      console.log('✅ Mobile visit tracked:', mobileResponse.data);
    } catch (error) {
      console.log('❌ Mobile tracking failed:', error.response?.data || error.message);
    }
    
    // Test 2: Track another mobile visit
    console.log('\n📱 Test 2: Tracking another mobile visit...');
    try {
      const mobileResponse2 = await axios.post(`${baseURL}/track`, {
        device_type: 'mobile',
        page_visited: '/profile',
        user_agent: 'TestApp/1.0.0 (Android 10)'
      });
      
      console.log('✅ Mobile visit 2 tracked:', mobileResponse2.data);
    } catch (error) {
      console.log('❌ Mobile tracking 2 failed:', error.response?.data || error.message);
    }
    
    // Test 3: Track desktop visit (simulate web)
    console.log('\n💻 Test 3: Tracking desktop visit...');
    try {
      const desktopResponse = await axios.post(`${baseURL}/track`, {
        device_type: 'desktop',
        page_visited: '/dashboard',
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        referrer: 'https://google.com'
      });
      
      console.log('✅ Desktop visit tracked:', desktopResponse.data);
    } catch (error) {
      console.log('❌ Desktop tracking failed:', error.response?.data || error.message);
    }
    
    // Test 4: Track multiple visits to simulate real usage
    console.log('\n🔄 Test 4: Tracking multiple visits...');
    const visits = [
      { device: 'mobile', page: '/dashboard', user: 'user_001' },
      { device: 'desktop', page: '/dashboard', user: 'user_002' },
      { device: 'mobile', page: '/profile', user: 'user_001' },
      { device: 'desktop', page: '/settings', user: 'user_002' },
      { device: 'mobile', page: '/notifications', user: 'user_003' }
    ];
    
    for (const visit of visits) {
      try {
        await axios.post(`${baseURL}/track`, {
          device_type: visit.device,
          page_visited: visit.page,
          user_agent: visit.device === 'mobile' ? 
            'TestApp/1.0.0 (iOS 14.0)' : 
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          user_id: visit.user
        });
        console.log(`✅ ${visit.device} visit to ${visit.page} tracked`);
      } catch (error) {
        console.log(`❌ Failed to track ${visit.device} visit:`, error.response?.data || error.message);
      }
    }
    
    // Test 5: Get visitor statistics
    console.log('\n📊 Test 5: Getting visitor statistics...');
    try {
      const statsResponse = await axios.get(`${baseURL}/stats?days=7`);
      console.log('✅ Visitor statistics:', JSON.stringify(statsResponse.data, null, 2));
    } catch (error) {
      console.log('❌ Failed to get stats:', error.response?.data || error.message);
    }
    
    console.log('\n🎉 Real visitor tracking test completed!');
    console.log('📝 Check the admin dashboard to see the real visitor data');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testRealVisitorTracking();
