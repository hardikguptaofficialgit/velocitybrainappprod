/**
 * Test Billing Script
 * Manually test billing sync endpoint
 */

const axios = require('axios');

const API_URL = 'http://localhost:3001';

async function testBillingSync() {
    // First, login to get a token
    const loginResponse = await axios.post(`${API_URL}/api/auth/login`, {
        email: 'test@example.com',
        password: 'password123'
    });

    const token = loginResponse.data.token;
    const userId = loginResponse.data.user.id;

    console.log('Logged in as:', loginResponse.data.user.email);
    console.log('User ID:', userId);
    console.log('Current tier:', loginResponse.data.user.tier);

    // Test billing sync to upgrade to pro
    const syncResponse = await axios.post(
        `${API_URL}/api/billing/sync`,
        { plan: 'pro' },
        {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        }
    );

    console.log('\nBilling sync result:', syncResponse.data);

    // Verify the update
    const billingResponse = await axios.get(`${API_URL}/api/billing`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    console.log('\nCurrent billing info:', billingResponse.data);

    // Get updated user info
    const userResponse = await axios.get(`${API_URL}/api/auth/me`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    console.log('\nUpdated user tier:', userResponse.data.user.tier);
}

async function testManualPlanUpdate() {
    // First, login to get a token
    const loginResponse = await axios.post(`${API_URL}/api/auth/login`, {
        email: 'test@example.com',
        password: 'password123'
    });

    const token = loginResponse.data.token;

    // Test manual plan update
    const updateResponse = await axios.post(
        `${API_URL}/api/billing/plan`,
        { plan: 'enterprise' },
        {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        }
    );

    console.log('Plan update result:', updateResponse.data);
}

// Run tests
console.log('=== Testing Billing System ===\n');

testBillingSync()
    .then(() => {
        console.log('\n=== Test completed successfully ===');
    })
    .catch((error) => {
        console.error('Test failed:', error.response?.data || error.message);
    });
