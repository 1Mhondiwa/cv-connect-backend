// Validate that the freelancer routes can be loaded without syntax errors
try {
  const freelancerRoutes = require('./routes/freelancer');
  console.log('✅ Freelancer routes loaded successfully');
  
  // Check if the specific route exists
  const routes = [];
  freelancerRoutes.stack.forEach((middleware) => {
    if (middleware.route) {
      routes.push({
        method: Object.keys(middleware.route.methods)[0],
        path: middleware.route.path
      });
    }
  });
  
  console.log('Available routes:');
  routes.forEach(route => {
    console.log(`  ${route.method.toUpperCase()} ${route.path}`);
  });
  
  const hiringHistoryRoute = routes.find(route => route.path === '/hiring/history');
  if (hiringHistoryRoute) {
    console.log('✅ Found /hiring/history route');
  } else {
    console.log('❌ /hiring/history route not found');
  }
  
} catch (error) {
  console.error('❌ Error loading freelancer routes:', error.message);
  console.error('Full error:', error);
}
