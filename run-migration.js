const { setupPerformanceMonitoring } = require('./migrations/setup-performance-monitoring');

console.log('🚀 Starting Performance Monitoring Database Setup...');
console.log('This will create all necessary tables, extensions, and functions for real-time monitoring.');

setupPerformanceMonitoring()
  .then(() => {
    console.log('');
    console.log('🎉 Setup completed successfully!');
    console.log('Your System Performance reports will now show real data from your database.');
    console.log('');
    console.log('Next steps:');
    console.log('1. Restart your backend server: npm start');
    console.log('2. Test the System Performance reports in your Admin Dashboard');
    process.exit(0);
  })
  .catch((error) => {
    console.error('');
    console.error('❌ Setup failed:', error.message);
    console.error('');
    console.error('If you see permission errors for pg_stat_statements extension:');
    console.error('1. Connect to PostgreSQL as superuser');
    console.error('2. Run: CREATE EXTENSION IF NOT EXISTS pg_stat_statements;');
    console.error('3. Then run this migration again');
    process.exit(1);
  });


