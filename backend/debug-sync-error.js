const axios = require('axios');

const BASE_URL = 'http://localhost:8080/api';

async function debugSyncError() {
  try {
    console.log('🔍 Debugging sync error...\n');

    // Step 1: Get all repositories
    console.log('1. Fetching repositories...');
    const repositoriesResponse = await axios.get(`${BASE_URL}/repositories`);
    const repositories = repositoriesResponse.data.data;
    
    console.log(`   Found ${repositories.length} repositories\n`);

    // Step 2: Find BennerLicense repository
    const bennerLicenseRepo = repositories.find(repo => repo.name === 'BennerLicense');
    
    if (!bennerLicenseRepo) {
      console.log('❌ BennerLicense repository not found');
      return;
    }

    console.log(`2. Found BennerLicense repository:`);
    console.log(`   ID: ${bennerLicenseRepo.id}`);
    console.log(`   Name: ${bennerLicenseRepo.name}`);
    console.log(`   Organization: ${bennerLicenseRepo.organization}`);
    console.log(`   Project: ${bennerLicenseRepo.project}`);
    console.log(`   LastSyncAt: ${bennerLicenseRepo.lastSyncAt}`);
    console.log();

    // Step 3: Check current sync status
    console.log('3. Checking current sync status...');
    try {
      const statusResponse = await axios.get(`${BASE_URL}/sync/${bennerLicenseRepo.id}/status`);
      console.log(`   Status: ${JSON.stringify(statusResponse.data.data, null, 2)}`);
    } catch (error) {
      console.log(`   ❌ Failed to get status: ${error.response?.data?.message || error.message}`);
    }
    console.log();

    // Step 4: Check recent sync jobs
    console.log('4. Checking recent sync jobs...');
    try {
      const jobsResponse = await axios.get(`${BASE_URL}/sync?page=1&pageSize=5&status=failed`);
      const failedJobs = jobsResponse.data.data.filter(job => job.repositoryId === bennerLicenseRepo.id);
      
      if (failedJobs.length > 0) {
        console.log(`   Found ${failedJobs.length} failed jobs:`);
        failedJobs.forEach(job => {
          console.log(`   - Job ID: ${job.id}`);
          console.log(`   - Status: ${job.status}`);
          console.log(`   - Sync Type: ${job.syncType}`);
          console.log(`   - Error: ${job.error}`);
          console.log(`   - Created: ${job.createdAt}`);
          console.log();
        });
      } else {
        console.log('   No failed jobs found for this repository');
      }
    } catch (error) {
      console.log(`   ❌ Failed to get jobs: ${error.response?.data?.message || error.message}`);
    }
    console.log();

    // Step 5: Test with minimal data
    console.log('5. Testing sync with detailed error capture...');
    try {
      const syncResponse = await axios.post(`${BASE_URL}/sync/${bennerLicenseRepo.id}`, {
        syncType: 'incremental'
      }, {
        timeout: 30000 // 30 seconds timeout
      });
      
      console.log(`   ✅ Sync started successfully`);
      console.log(`   Job ID: ${syncResponse.data.data.id}`);
      
      // Wait and check job status
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const jobResponse = await axios.get(`${BASE_URL}/sync/jobs/${syncResponse.data.data.id}`);
      const job = jobResponse.data.data;
      
      console.log(`   Job status: ${job.status}`);
      if (job.error) {
        console.log(`   ❌ Job error: ${job.error}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Sync failed:`);
      console.log(`   Status: ${error.response?.status}`);
      console.log(`   Message: ${error.response?.data?.message || error.message}`);
      console.log(`   Error: ${error.response?.data?.error || 'Unknown error'}`);
      
      if (error.response?.data?.details) {
        console.log(`   Details: ${JSON.stringify(error.response.data.details, null, 2)}`);
      }
      
      if (error.response?.data?.stack) {
        console.log(`   Stack: ${error.response.data.stack}`);
      }
    }

    console.log('\n🎉 Debug completed!');

  } catch (error) {
    console.error('❌ Debug failed:', error.response?.data || error.message);
  }
}

// Run the debug
debugSyncError();
