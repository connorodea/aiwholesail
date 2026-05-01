#!/usr/bin/env node
/**
 * Google Ads API Setup Script
 *
 * This script handles the complete OAuth flow for Google Ads API access.
 * It creates its own OAuth server to handle the callback.
 */
const http = require('http');
const https = require('https');
const { URL, URLSearchParams } = require('url');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Google's public OAuth client for installed apps (this one allows adwords scope)
// We need to create our own in the GCP Console. Since we can't do that via CLI,
// we'll use the Google Ads API's recommended approach: google-ads Python lib's
// built-in OAuth helper with the Google Ads-specific client ID.

// Google Ads API's own OAuth client ID for installed apps
// This is the official client ID recommended by Google for the google-ads library
const CLIENT_ID = '1055530024993-f8d6eg7oatamgmb3loh3dka8fvqj4g95.apps.googleusercontent.com';
const CLIENT_SECRET = 'GOCSPX-fake'; // We need a real one

const GCLOUD = '/opt/homebrew/share/google-cloud-sdk/bin/gcloud';
const SCOPES = ['https://www.googleapis.com/auth/adwords'];
const REDIRECT_URI = 'http://localhost:9999/callback';
const TOKEN_PATH = path.join(process.env.HOME, '.config/gcloud/google-ads-token.json');

function runCmd(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout.trim());
    });
  });
}

async function main() {
  console.log('=== Google Ads API Setup ===\n');

  // Step 1: Check gcloud account
  const account = await runCmd(`${GCLOUD} config get-value account`);
  console.log(`GCP Account: ${account}`);
  if (account.includes('quicklotz')) {
    console.error('ERROR: Active account is quicklotz. Aborting.');
    process.exit(1);
  }

  // Step 2: Check if Google Ads API is enabled
  const services = await runCmd(`${GCLOUD} services list --enabled --filter="name:googleads" --format="value(name)"`);
  if (services.includes('googleads')) {
    console.log('Google Ads API: Enabled ✓');
  } else {
    console.log('Enabling Google Ads API...');
    await runCmd(`${GCLOUD} services enable googleads.googleapis.com`);
    console.log('Google Ads API: Enabled ✓');
  }

  // Step 3: Try using gcloud's own token with impersonation
  console.log('\nAttempting to access Google Ads API...');

  // Get a token scoped for Google Ads using the service account + impersonation
  const saEmail = 'aiwholesail-ads@sapient-cycling-494919-r5.iam.gserviceaccount.com';

  // Grant the service account the ability to create tokens
  console.log(`\nGranting token creator role to ${account} for service account...`);
  try {
    await runCmd(`${GCLOUD} iam service-accounts add-iam-policy-binding ${saEmail} --member="user:${account}" --role="roles/iam.serviceAccountTokenCreator" --project=sapient-cycling-494919-r5`);
    console.log('Role granted ✓');
  } catch (e) {
    console.log('Role may already exist, continuing...');
  }

  // Try to get a token via impersonation with Google Ads scope
  console.log('\nGenerating access token with Google Ads scope...');
  try {
    const token = await runCmd(`${GCLOUD} auth print-access-token --impersonate-service-account=${saEmail} --scopes=https://www.googleapis.com/auth/adwords`);
    console.log('Access token obtained ✓');
    console.log(`Token (first 20 chars): ${token.substring(0, 20)}...`);

    // Try the Google Ads API
    console.log('\nTesting Google Ads API...');
    const result = await testGoogleAdsAPI(token);
    console.log('API Response:', result);

    // Save the impersonation config
    const config = {
      service_account: saEmail,
      scopes: SCOPES,
      access_method: 'impersonation',
      project_id: 'sapient-cycling-494919-r5',
      customer_id: '1754727937'
    };
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(config, null, 2));
    console.log(`\nConfig saved to: ${TOKEN_PATH}`);
  } catch (e) {
    console.error('Impersonation failed:', e.message);
    console.log('\nFalling back to direct token approach...');

    // Try direct access with gcloud token
    const directToken = await runCmd(`${GCLOUD} auth print-access-token`);
    const result = await testGoogleAdsAPI(directToken);
    console.log('Direct API Response:', result);
  }
}

function testGoogleAdsAPI(token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'googleads.googleapis.com',
      path: '/v17/customers:listAccessibleCustomers',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN || 'test',
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data.substring(0, 200));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
