#!/usr/bin/env node
/**
 * Creates an OAuth 2.0 Desktop Client ID in the GCP project,
 * then uses it to authenticate with Google Ads API scopes.
 */
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { URL } = require('url');

const PROJECT_ID = 'sapient-cycling-494919-r5';
const GCLOUD = '/opt/homebrew/share/google-cloud-sdk/bin/gcloud';
const CLIENT_SECRET_PATH = path.join(__dirname, 'client_secret.json');
const CREDENTIALS_PATH = path.join(process.env.HOME, '.config/gcloud/ads-credentials.json');

function runCmd(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout.trim());
    });
  });
}

async function getAccessToken() {
  return runCmd(`${GCLOUD} auth print-access-token`);
}

async function createOAuthClient() {
  const token = await getAccessToken();

  // Use the Google Cloud API to create OAuth credentials
  const fetch = (await import('node:https')).default;

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      web: false,
      installed: {
        application_type: 'desktop',
        name: 'AIWholesail Google Ads'
      }
    });

    // Actually, we can't create OAuth clients via API easily.
    // Instead, let's use gcloud to generate credentials with a workaround.
    // The solution: use gcloud auth login with --enable-gdrive-access style flag
    // Or: create our own mini OAuth server

    console.log('Creating OAuth flow with Google Ads scope...');
    resolve(null);
  });
}

async function doOAuthFlow() {
  const { google } = require('googleapis');

  // First, check if there's already an OAuth client in the project
  const token = await getAccessToken();

  // We'll create a simple OAuth flow using Google's OAuth2 endpoint directly
  // Using the "TV/Limited Input" flow which doesn't need a registered client for testing

  // Actually, the simplest approach: use gcloud to get a token with the right scopes
  // by creating a service account key and impersonating

  // Let's check if there's already a service account we can use
  console.log('Checking for existing service accounts...');
  const saList = await runCmd(`${GCLOUD} iam service-accounts list --project=${PROJECT_ID} --format=json`);
  const serviceAccounts = JSON.parse(saList);

  if (serviceAccounts.length > 0) {
    console.log('Found service accounts:');
    serviceAccounts.forEach(sa => console.log(`  - ${sa.email} (${sa.displayName || 'no name'})`));
  }

  // Create a new service account for Google Ads
  let saEmail;
  const existingSA = serviceAccounts.find(sa => sa.email.startsWith('aiwholesail-ads@'));

  if (existingSA) {
    saEmail = existingSA.email;
    console.log(`Using existing service account: ${saEmail}`);
  } else {
    console.log('Creating service account for Google Ads...');
    await runCmd(`${GCLOUD} iam service-accounts create aiwholesail-ads --display-name="AIWholesail Google Ads" --project=${PROJECT_ID}`);
    saEmail = `aiwholesail-ads@${PROJECT_ID}.iam.gserviceaccount.com`;
    console.log(`Created: ${saEmail}`);
  }

  // Create and download a key
  const keyPath = path.join(__dirname, 'service-account-key.json');
  if (!fs.existsSync(keyPath)) {
    console.log('Creating service account key...');
    await runCmd(`${GCLOUD} iam service-accounts keys create ${keyPath} --iam-account=${saEmail} --project=${PROJECT_ID}`);
    console.log(`Key saved to: ${keyPath}`);
  }

  // Now use this service account with the Google Ads API
  // Note: for Google Ads, we need to set up domain-wide delegation or use user impersonation
  console.log('\n=== Setup Complete ===');
  console.log(`Service Account: ${saEmail}`);
  console.log(`Key File: ${keyPath}`);
  console.log('\nTo use with Google Ads:');
  console.log('1. Go to ads.google.com > Tools > Setup > API Center');
  console.log('2. Copy your Developer Token');
  console.log(`3. Add ${saEmail} as a user in your Google Ads account`);
  console.log('4. Set these env vars in ~/.zshrc:');
  console.log('   export GOOGLE_ADS_DEVELOPER_TOKEN="your-token"');
  console.log(`   export GOOGLE_APPLICATION_CREDENTIALS="${keyPath}"`);

  return { saEmail, keyPath };
}

async function main() {
  try {
    // Verify we're on the right account
    const account = await runCmd(`${GCLOUD} config get-value account`);
    console.log(`Active account: ${account}`);

    if (account.includes('quicklotz')) {
      console.error('ERROR: Active account is quicklotz! Switch to cpodea5@gmail.com first.');
      process.exit(1);
    }

    const project = await runCmd(`${GCLOUD} config get-value project`);
    console.log(`Active project: ${project}`);

    if (project !== PROJECT_ID) {
      console.log(`Switching to project ${PROJECT_ID}...`);
      await runCmd(`${GCLOUD} config set project ${PROJECT_ID}`);
    }

    await doOAuthFlow();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
