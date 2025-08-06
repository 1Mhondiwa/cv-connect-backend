const axios = require('axios');

const testChangePassword = async () => {
  try {
    // First, login to get a token
    const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'test@associate.com', // Replace with a real associate email
      password: 'password123'
    });

    if (!loginResponse.data.success) {
      console.error('Login failed:', loginResponse.data.message);
      return;
    }

    const token = loginResponse.data.data.token;
    console.log('Login successful, token obtained');

    // Test change password
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

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
};

testChangePassword(); 