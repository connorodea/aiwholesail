#!/usr/bin/env node
/**
 * OAuth flow for Google Ads API using a local HTTP server.
 * Creates an OAuth client in the GCP project, then runs the consent flow.
 */
const http = require('http');
const https = require('https');
const { URL } = require('url');
const fs = require('fs');
const { exec } = require('child_process');
const crypto = require('crypto');

const PORT = 9876;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
const SCOPES = 'https://www.googleapis.com/auth/adwords';
const TOKEN_PATH = process.env.HOME + '/.config/gcloud/google-ads-oauth.json';

// We need an OAuth client ID. Let's create one using the GCP API.
const GCLOUD = '/opt/homebrew/share/google-cloud-sdk/bin/gcloud';
const PROJECT_ID = 'sapient-cycling-494919-r5';

function runCmd(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout.trim());
    });
  });
}

function httpsRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function createOAuthClientViaAPI() {
  const accessToken = await runCmd(`${GCLOUD} auth print-access-token`);

  // Try to create an OAuth 2.0 client ID via the Google Cloud API
  // The API is: POST https://oauth2.clients.googleapis.com/v1/projects/{project_number}/oauthClients
  // But this might not be available. Let's check for existing clients first.

  // Alternative: Use the Cloud Console API to create credentials
  console.log('Checking for existing OAuth clients...');

  // Actually, let's just use our OWN OAuth server. We can generate a client ID/secret
  // using the cloud console API endpoint that the gcloud CLI itself uses.
  // Or even simpler: just use the "out of band" flow with manual code entry.

  return null;
}

async function main() {
  console.log('=== Google Ads OAuth Setup ===\n');

  // Check if we already have saved tokens
  if (fs.existsSync(TOKEN_PATH)) {
    const saved = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    if (saved.refresh_token) {
      console.log('Found existing OAuth tokens. Testing...');
      // Try to refresh
      try {
        const result = await refreshToken(saved);
        console.log('Existing tokens work! Access token refreshed.');
        console.log('Client ID:', saved.client_id?.substring(0, 20) + '...');
        return;
      } catch (e) {
        console.log('Existing tokens expired. Re-authenticating...');
      }
    }
  }

  // We need a proper OAuth client ID. Since we can't create one via CLI easily,
  // let's use the Google Ads API's recommended approach: the "installed app" flow
  // with a client ID created in the GCP Console.
  //
  // But we CAN create OAuth credentials using the GCP REST API:
  console.log('Creating OAuth 2.0 Desktop client...');

  const accessToken = await runCmd(`${GCLOUD} auth print-access-token`);

  // Create OAuth brand (consent screen) if needed
  const projectNumber = '94870419954';

  // Try the oauthconfig API
  const brandResult = await httpsRequest({
    hostname: 'oauthconfig.googleapis.com',
    path: `/v1/projects/${projectNumber}/brands`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  console.log('Brand check result:', typeof brandResult === 'string' ? brandResult.substring(0, 100) : JSON.stringify(brandResult).substring(0, 200));

  // If brand doesn't exist, create one
  if (brandResult.error || !brandResult.brands?.length) {
    console.log('\nNo OAuth consent screen found.');
    console.log('Creating one is not possible via CLI alone.');
    console.log('\nUsing alternative approach: device authorization flow...\n');
    await deviceAuthFlow();
    return;
  }
}

async function deviceAuthFlow() {
  // Google's device authorization flow doesn't require a registered client for testing.
  // But for Google Ads, we need a proper client.

  // The simplest path: Use Google's own OAuth playground or the google-ads library's
  // built-in client ID.

  // Google Ads API's recommended client ID for desktop apps:
  // From the official google-ads-python library:
  const CLIENT_ID = '1055530024993-f8d6eg7oatamgmb3loh3dka8fvqj4g95.apps.googleusercontent.com';
  const CLIENT_SECRET = 'not-publicly-available';

  // Since we can't use that without the real secret, let's create a proper
  // OAuth client using the Cloud Console.

  console.log('To complete Google Ads API setup, you need to create an OAuth client:');
  console.log('');
  console.log('1. Go to: https://console.cloud.google.com/apis/credentials?project=sapient-cycling-494919-r5');
  console.log('2. Click "+ CREATE CREDENTIALS" → "OAuth client ID"');
  console.log('3. If prompted, configure the consent screen first (External, app name: AIWholesail)');
  console.log('4. Application type: "Desktop app"');
  console.log('5. Name: "AIWholesail CLI"');
  console.log('6. Click "Create"');
  console.log('7. Copy the Client ID and Client Secret');
  console.log('');
  console.log('Then run this script again with:');
  console.log('  node oauth-flow.js <client_id> <client_secret>');
  console.log('');

  // Check if client_id and secret were passed as args
  if (process.argv[2] && process.argv[3]) {
    await runOAuthFlow(process.argv[2], process.argv[3]);
  }
}

async function runOAuthFlow(clientId, clientSecret) {
  console.log('Starting OAuth flow...');
  console.log(`Client ID: ${clientId.substring(0, 20)}...`);

  // Generate PKCE
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(clientId)}&` +
    `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
    `response_type=code&` +
    `scope=${encodeURIComponent(SCOPES)}&` +
    `access_type=offline&` +
    `prompt=consent&` +
    `code_challenge=${challenge}&` +
    `code_challenge_method=S256`;

  console.log(`\nOpening browser for authorization...`);

  // Start local HTTP server to catch the callback
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<h1>Error: ${error}</h1><p>Close this window.</p>`);
        server.close();
        console.error('Auth error:', error);
        return;
      }

      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<h1>Authorization successful!</h1><p>You can close this window.</p>`);

        // Exchange code for tokens
        console.log('Exchanging authorization code for tokens...');
        const tokenData = `code=${encodeURIComponent(code)}&` +
          `client_id=${encodeURIComponent(clientId)}&` +
          `client_secret=${encodeURIComponent(clientSecret)}&` +
          `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
          `grant_type=authorization_code&` +
          `code_verifier=${verifier}`;

        const tokenResult = await httpsRequest({
          hostname: 'oauth2.googleapis.com',
          path: '/token',
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(tokenData)
          }
        }, tokenData);

        if (tokenResult.access_token) {
          const saved = {
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: tokenResult.refresh_token,
            access_token: tokenResult.access_token,
            token_type: tokenResult.token_type,
            scope: tokenResult.scope,
            created_at: new Date().toISOString()
          };
          fs.writeFileSync(TOKEN_PATH, JSON.stringify(saved, null, 2));
          console.log('\n✓ Tokens saved to:', TOKEN_PATH);
          console.log('✓ Refresh token:', tokenResult.refresh_token?.substring(0, 20) + '...');
          console.log('\nGoogle Ads API is now ready to use!');
        } else {
          console.error('Token exchange failed:', tokenResult);
        }

        server.close();
      }
    }
  });

  server.listen(PORT, () => {
    console.log(`Listening on port ${PORT} for callback...`);
    // Open browser
    exec(`open "${authUrl}"`);
  });
}

async function refreshToken(saved) {
  const tokenData = `client_id=${encodeURIComponent(saved.client_id)}&` +
    `client_secret=${encodeURIComponent(saved.client_secret)}&` +
    `refresh_token=${encodeURIComponent(saved.refresh_token)}&` +
    `grant_type=refresh_token`;

  const result = await httpsRequest({
    hostname: 'oauth2.googleapis.com',
    path: '/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(tokenData)
    }
  }, tokenData);

  if (!result.access_token) throw new Error('Refresh failed');
  return result;
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
