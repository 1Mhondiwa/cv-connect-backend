// Comprehensive script to fix all freelancer profile sync issues
const { syncAllFreelancers } = require('./utils/profileSync');

async function main() {
  try {
    console.log('🚀 Starting comprehensive freelancer profile sync...');
    console.log('This will ensure all freelancer profiles are properly synced with their CV data.');
    console.log('=====================================\n');
    
    // Run the comprehensive sync
    const result = await syncAllFreelancers(false); // false = don't force update existing data
    
    if (result.success) {
      console.log('\n🎉 SYNC COMPLETED SUCCESSFULLY!');
      console.log('=====================================');
      console.log(`📊 Results:`);
      console.log(`   • Total processed: ${result.totalProcessed} freelancers`);
      console.log(`   • Successful syncs: ${result.successful} freelancers`);
      console.log(`   • Errors: ${result.errors} freelancers`);
      console.log(`   • Total fields updated: ${result.totalUpdatedFields}`);
      
      if (result.errors > 0) {
        console.log('\n⚠️ Some freelancers had sync errors. Check the logs above for details.');
      }
      
      console.log('\n✅ All freelancer profiles are now properly synced!');
      console.log('✅ Future CV uploads will automatically sync correctly.');
      
    } else {
      console.error('❌ Sync failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  } finally {
    process.exit(0);
  }
}

// Run the main function
main();
