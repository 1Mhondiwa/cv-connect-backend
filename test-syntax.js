// Test if the freelancer routes file has syntax errors
try {
  const freelancerRoutes = require('./routes/freelancer');
  console.log('✅ Freelancer routes loaded successfully');
  console.log('Routes count:', freelancerRoutes.stack.length);
} catch (error) {
  console.error('❌ Syntax error in freelancer routes:', error.message);
  console.error('Stack trace:', error.stack);
}
