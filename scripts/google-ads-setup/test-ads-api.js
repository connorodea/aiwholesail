#!/usr/bin/env node
/**
 * Test Google Ads API access using the Node.js client (gRPC).
 * This bypasses the broken REST API by using gRPC directly.
 */
const { GoogleAdsApi } = require('google-ads-api');
const { exec } = require('child_process');
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');

const SA_KEY_PATH = process.env.HOME + '/.config/gcloud/aiwholesail-ads-key.json';
const CUSTOMER_ID = '1754727937';

function getServiceAccountToken() {
  return new Promise((resolve, reject) => {
    const key = JSON.parse(fs.readFileSync(SA_KEY_PATH, 'utf8'));
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const claims = Buffer.from(JSON.stringify({
      iss: key.client_email,
      scope: 'https://www.googleapis.com/auth/adwords',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600
    })).toString('base64url');
    const signInput = header + '.' + claims;
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signInput);
    const signature = sign.sign(key.private_key, 'base64url');
    const jwt = signInput + '.' + signature;
    const postData = 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt;

    const req = https.request({
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        const token = JSON.parse(data);
        if (token.access_token) resolve(token.access_token);
        else reject(new Error('No access token: ' + JSON.stringify(token)));
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('=== Google Ads API Test (gRPC via Node.js) ===\n');

  // The google-ads-api package requires:
  // 1. OAuth client_id + client_secret + refresh_token (for user auth)
  // 2. OR developer_token + access_token (for service account)
  //
  // Problem: We don't have a developer_token yet.
  // The developer_token is ONLY available from ads.google.com > API Center.
  //
  // Let's try with the service account token and see what error we get.

  console.log('Getting service account access token...');
  const accessToken = await getServiceAccountToken();
  console.log(`Token obtained: ${accessToken.substring(0, 30)}...`);

  // Try using the google-ads-api client
  // Note: This client REQUIRES a developer_token.
  // Without one, it will fail at initialization.
  try {
    const client = new GoogleAdsApi({
      client_id: 'not-needed-for-sa',
      client_secret: 'not-needed-for-sa',
      developer_token: 'INSERT_DEVELOPER_TOKEN_HERE' // This is REQUIRED
    });

    const customer = client.Customer({
      customer_id: CUSTOMER_ID,
      login_customer_id: CUSTOMER_ID,
      refresh_token: 'not-needed'
    });

    // This will fail because we don't have a real developer_token
    const results = await customer.query(`SELECT customer.id, customer.descriptive_name FROM customer LIMIT 1`);
    console.log('Results:', results);
  } catch (err) {
    console.log('\nExpected error (no developer token):', err.message?.substring(0, 200));
  }

  // Print instructions
  console.log('\n' + '='.repeat(60));
  console.log('SETUP STATUS:');
  console.log('='.repeat(60));
  console.log('✓ GCP Project: sapient-cycling-494919-r5 (aiwholesail)');
  console.log('✓ Google Ads API: Enabled');
  console.log('✓ Service Account: aiwholesail-ads@sapient-cycling-494919-r5.iam.gserviceaccount.com');
  console.log('✓ Service Account Key: ~/.config/gcloud/aiwholesail-ads-key.json');
  console.log('✓ Access Token with adwords scope: Working');
  console.log('');
  console.log('✗ Developer Token: MISSING (required for ALL Google Ads API calls)');
  console.log('');
  console.log('TO GET YOUR DEVELOPER TOKEN:');
  console.log('1. Go to: https://ads.google.com');
  console.log('2. Sign in with: cpodea5@gmail.com');
  console.log('3. Click Tools icon (wrench) in top nav');
  console.log('4. Under "Setup", click "API Center"');
  console.log('5. Copy the Developer Token shown');
  console.log('6. Then run:');
  console.log('   echo \'export GOOGLE_ADS_DEVELOPER_TOKEN="YOUR_TOKEN_HERE"\' >> ~/.zshrc');
  console.log('   source ~/.zshrc');
  console.log('');
  console.log('The Developer Token is a mandatory credential that Google');
  console.log('requires for ALL API access. It cannot be generated via CLI.');
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
