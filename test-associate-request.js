// Test script for associate request endpoint
const axios = require('axios');

const testAssociateRequest = async () => {
  try {
    console.log('Testing associate request endpoint...');
    
    const testData = {
      email: 'test@company.com',
      company_name: 'Test Company',
      industry: 'Technology',
      contact_person: 'John Doe',
      phone: '+1234567890',
      address: '123 Test Street',
      website: 'https://testcompany.com',
      request_reason: 'Testing the endpoint'
    };

    const response = await axios.post('http://localhost:5000/api/associate-request/submit', testData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Success! Response:', response.data);
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    console.error('Status:', error.response?.status);
  }
};

// Test the endpoint
testAssociateRequest(); 