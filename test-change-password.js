const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function testChangePassword() {
  try {
    console.log('Testing Change Password Endpoint...\n');
    
    // First, login as an associate to get a token
    console.log('1. Logging in as associate...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'test@associate.com', // Replace with actual associate email
      password: 'password123' // Replace with actual password
    });
    
    if (!loginResponse.data.success) {
      console.error('Login failed:', loginResponse.data.message);
      return;
    }
    
    const token = loginResponse.data.token;
    console.log('✓ Login successful, token obtained\n');
    
    // Test change password
    console.log('2. Testing change password...');
    const changePasswordResponse = await axios.post(`${BASE_URL}/associate/change-password`, {
      oldPassword: 'password123',
      newPassword: 'newpassword123'
    }, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (changePasswordResponse.data.success) {
      console.log('✓ Password changed successfully!');
      console.log('Message:', changePasswordResponse.data.message);
    } else {
      console.error('✗ Change password failed:', changePasswordResponse.data.message);
    }
    
  } catch (error) {
    console.error('Test failed:', error.response?.data || error.message);
  }
}

testChangePassword();
