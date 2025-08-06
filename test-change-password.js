const axios = require('axios');

const testChangePassword = async () => {
  try {
    console.log('Testing change password functionality...');
    
    // First, login to get a token
    console.log('Attempting to login...');
    const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'test@associate.com', // Replace with a real associate email from your database
      password: 'password123'
    });

    if (!loginResponse.data.success) {
      console.error('Login failed:', loginResponse.data.message);
      return;
    }

    const token = loginResponse.data.data.token;
    console.log('Login successful, token obtained');
    console.log('User ID:', loginResponse.data.data.user.user_id);

    // Test change password
    console.log('Attempting to change password...');
    const changePasswordResponse = await axios.put('http://localhost:5000/api/auth/change-password', {
      oldPassword: 'password123',
      newPassword: 'newpassword123',
      confirmPassword: 'newpassword123'
    }, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('Change password response:', changePasswordResponse.data);

    // Test login with new password
    console.log('Testing login with new password...');
    const newLoginResponse = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'test@associate.com',
      password: 'newpassword123'
    });

    if (newLoginResponse.data.success) {
      console.log('✅ SUCCESS: Password change worked! Can login with new password.');
    } else {
      console.log('❌ FAILED: Cannot login with new password.');
    }

  } catch (error) {
    console.error('Error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
  }
};

testChangePassword(); 