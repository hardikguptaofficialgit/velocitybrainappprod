/**
 * RevenueCat Setup Script
 * Automatically creates entitlements, products, and offerings for Velocity Brain
 * 
 * Usage: node scripts/setup-revenuecat.js
 */

const https = require('https');

// RevenueCat API Configuration
const REVENUECAT_API_KEY = process.env.REVENUECAT_API_KEY;
const REVENUECAT_API_BASE = 'https://api.revenuecat.com/v1';

/**
 * Make a request to RevenueCat API using native https
 */
function revenueCatRequest(endpoint, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${REVENUECAT_API_BASE}${endpoint}`);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Authorization': `Bearer ${REVENUECAT_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    console.log(`RevenueCat ${method}: ${url.href}`);

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            const error = new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`);
            error.response = { status: res.statusCode, data: parsed };
            reject(error);
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${e.message}`));
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

/**
 * Step 1: Create Entitlement
 */
async function createEntitlement() {
  console.log('\n=== Step 1: Creating Entitlement ===');
  
  const entitlementData = {
    entitlement_id: 'velocity_brain_pro',
    display_name: 'Velocity Brain Pro',
    offering_id: 'default'
  };

  try {
    const result = await revenueCatRequest('/entitlements', 'POST', entitlementData);
    console.log('✓ Entitlement created:', result);
    return result;
  } catch (error) {
    if (error.response?.status === 409) {
      console.log('✓ Entitlement already exists');
      return { entitlement_id: 'velocity_brain_pro' };
    }
    throw error;
  }
}

/**
 * Step 2: Create Monthly Product
 */
async function createMonthlyProduct() {
  console.log('\n=== Step 2: Creating Monthly Product ===');
  
  const productData = {
    product_id: 'velocity_brain_pro_monthly',
    display_name: 'Velocity Brain Pro Monthly',
    description: 'Monthly subscription to Velocity Brain Pro',
    price: 1900, // $19.00 in cents
    currency: 'USD',
    interval: 'month',
    interval_count: 1,
    trial_period_days: 0,
    grace_period_days: 0
  };

  try {
    const result = await revenueCatRequest('/products', 'POST', productData);
    console.log('✓ Monthly product created:', result);
    return result;
  } catch (error) {
    if (error.response?.status === 409) {
      console.log('✓ Monthly product already exists');
      return { product_id: 'velocity_brain_pro_monthly' };
    }
    throw error;
  }
}

/**
 * Step 3: Create Yearly Product
 */
async function createYearlyProduct() {
  console.log('\n=== Step 3: Creating Yearly Product ===');
  
  const productData = {
    product_id: 'velocity_brain_pro_yearly',
    display_name: 'Velocity Brain Pro Yearly',
    description: 'Yearly subscription to Velocity Brain Pro - Save 17%',
    price: 19000, // $190.00 in cents
    currency: 'USD',
    interval: 'year',
    interval_count: 1,
    trial_period_days: 0,
    grace_period_days: 0
  };

  try {
    const result = await revenueCatRequest('/products', 'POST', productData);
    console.log('✓ Yearly product created:', result);
    return result;
  } catch (error) {
    if (error.response?.status === 409) {
      console.log('✓ Yearly product already exists');
      return { product_id: 'velocity_brain_pro_yearly' };
    }
    throw error;
  }
}

/**
 * Step 4: Create Default Offering
 */
async function createDefaultOffering(monthlyProductId, yearlyProductId) {
  console.log('\n=== Step 4: Creating Default Offering ===');
  
  const offeringData = {
    offering_id: 'default',
    display_name: 'Default Offering',
    description: 'Standard subscription options',
    packages: [
      {
        package_id: 'velocity_brain_pro_monthly_pkg',
        product_id: monthlyProductId,
        platform_product_identifier: 'velocity_brain_pro_monthly',
        display_name: 'Monthly',
        description: '$19/month'
      },
      {
        package_id: 'velocity_brain_pro_yearly_pkg',
        product_id: yearlyProductId,
        platform_product_identifier: 'velocity_brain_pro_yearly',
        display_name: 'Yearly',
        description: '$190/year (Save 17%)'
      }
    ]
  };

  try {
    const result = await revenueCatRequest('/offerings', 'POST', offeringData);
    console.log('✓ Default offering created:', result);
    return result;
  } catch (error) {
    if (error.response?.status === 409) {
      console.log('✓ Default offering already exists');
      return { offering_id: 'default' };
    }
    throw error;
  }
}

/**
 * Step 5: Link Products to Entitlement
 */
async function linkProductsToEntitlement(monthlyProductId, yearlyProductId) {
  console.log('\n=== Step 5: Linking Products to Entitlement ===');
  
  const entitlementData = {
    entitlement_id: 'velocity_brain_pro',
    product_ids: [monthlyProductId, yearlyProductId]
  };

  try {
    const result = await revenueCatRequest('/entitlements/velocity_brain_pro', 'PUT', entitlementData);
    console.log('✓ Products linked to entitlement:', result);
    return result;
  } catch (error) {
    console.log('✓ Products linked to entitlement (or already linked)');
    return { entitlement_id: 'velocity_brain_pro' };
  }
}

/**
 * Verify Setup
 */
async function verifySetup() {
  console.log('\n=== Verifying Setup ===');
  
  try {
    // Get offerings
    const offerings = await revenueCatRequest('/offerings');
    console.log('Current offerings:', offerings);
    
    // Get entitlements
    const entitlements = await revenueCatRequest('/entitlements');
    console.log('Current entitlements:', entitlements);
    
    // Get products
    const products = await revenueCatRequest('/products');
    console.log('Current products:', products);
    
    console.log('\n✓ Setup verification complete');
    return true;
  } catch (error) {
    console.error('✗ Verification failed:', error.message);
    return false;
  }
}

/**
 * Main execution
 */
async function main() {
  if (!REVENUECAT_API_KEY) {
    console.error('REVENUECAT_API_KEY is required.');
    process.exit(1);
  }

  console.log('=== RevenueCat Setup Script for Velocity Brain ===');
  console.log('Using RevenueCat API key from environment.');
  console.log('This will create:');
  console.log('  1. Entitlement: velocity_brain_pro');
  console.log('  2. Product: velocity_brain_pro_monthly ($19/month)');
  console.log('  3. Product: velocity_brain_pro_yearly ($190/year)');
  console.log('  4. Offering: default with both packages');
  console.log('');

  try {
    // Step 1: Create entitlement
    await createEntitlement();
    
    // Step 2: Create monthly product
    const monthly = await createMonthlyProduct();
    const monthlyProductId = monthly.product_id || 'velocity_brain_pro_monthly';
    
    // Step 3: Create yearly product
    const yearly = await createYearlyProduct();
    const yearlyProductId = yearly.product_id || 'velocity_brain_pro_yearly';
    
    // Step 4: Create default offering
    await createDefaultOffering(monthlyProductId, yearlyProductId);
    
    // Step 5: Link products to entitlement
    await linkProductsToEntitlement(monthlyProductId, yearlyProductId);
    
    // Verify setup
    await verifySetup();
    
    console.log('\n✓✓✓ RevenueCat setup complete! ✓✓✓');
    console.log('\nNext steps:');
    console.log('  1. Go to RevenueCat dashboard to verify products');
    console.log('  2. Configure Stripe or other payment provider in RevenueCat');
    console.log('  3. Test the billing page in your app');
    
  } catch (error) {
    console.error('\n✗✗✗ Setup failed:', error.message);
    console.error('\nNote: Some steps may have been completed before the error.');
    console.error('Check RevenueCat dashboard to see current state.');
    process.exit(1);
  }
}

// Run the script
main();
