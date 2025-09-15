const express = require('express');
const freelancerRoutes = require('./routes/freelancer');

const app = express();

// Test if the route is properly registered
app.use('/api/freelancer', freelancerRoutes);

// List all registered routes
console.log('Registered routes:');
freelancerRoutes.stack.forEach((middleware, index) => {
  if (middleware.route) {
    console.log(`${index}: ${middleware.route.methods} ${middleware.route.path}`);
  }
});

console.log('\nLooking for hiring/history route...');
const hiringHistoryRoute = freelancerRoutes.stack.find(middleware => 
  middleware.route && middleware.route.path === '/hiring/history'
);

if (hiringHistoryRoute) {
  console.log('✅ Found hiring/history route:', hiringHistoryRoute.route.methods);
} else {
  console.log('❌ hiring/history route not found');
  console.log('Available routes:');
  freelancerRoutes.stack.forEach((middleware, index) => {
    if (middleware.route) {
      console.log(`  ${middleware.route.methods} ${middleware.route.path}`);
    }
  });
}
