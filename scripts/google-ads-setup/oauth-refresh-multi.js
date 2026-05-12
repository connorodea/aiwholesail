#!/usr/bin/env node
/**
 * One-consent OAuth refresh for AIWholesail SEO pipeline.
 *
 * Requests BOTH scopes in one consent flow:
 *   - https://www.googleapis.com/auth/adwords          (Google Ads / Keyword Planner)
 *   - https://www.googleapis.com/auth/webmasters.readonly  (Google Search Console)
 *
 * Reads client_id + client_secret from ~/.config/gcloud/google-ads.yaml,
 * opens a browser for consent, captures the callback, exchanges for tokens,
 * and writes ~/.config/gcloud/aiw-oauth-tokens.json — used by both
 * keyword-research-gaps.js (Ads) and gsc-opportunity-report.js (GSC).
 *
 * Usage:
 *   node scripts/google-ads-setup/oauth-refresh-multi.js
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');
const { URL } = require('url');

const PORT = 9876;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
const SCOPES = [
  'https://www.googleapis.com/auth/adwords',
  'https://www.googleapis.com/auth/webmasters.readonly',
].join(' ');
const TOKEN_PATH = path.join(process.env.HOME, '.config/gcloud/aiw-oauth-tokens.json');
const ADS_YAML_PATH = path.join(process.env.HOME, '.config/gcloud/google-ads.yaml');

function readClientCreds() {
  const yaml = fs.readFileSync(ADS_YAML_PATH, 'utf8');
  const id = (yaml.match(/client_id:\s*(\S+)/) || [])[1];
  const secret = (yaml.match(/client_secret:\s*(\S+)/) || [])[1];
  if (!id || !secret) {
    throw new Error('Could not find client_id/client_secret in ' + ADS_YAML_PATH);
  }
  return { clientId: id, clientSecret: secret };
}

function httpsPost(host, path, formData) {
  return new Promise((resolve, reject) => {
    const data = formData;
    const req = https.request({
      hostname: host,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch { resolve({ raw: body, status: res.statusCode }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  const { clientId, clientSecret } = readClientCreds();
  console.log('=== AIWholesail OAuth Refresh — Ads + GSC ===');
  console.log('Client ID: ' + clientId.slice(0, 20) + '...');
  console.log('Scopes:    adwords + webmasters.readonly');

  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');

  const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' +
    'client_id=' + encodeURIComponent(clientId) +
    '&redirect_uri=' + encodeURIComponent(REDIRECT_URI) +
    '&response_type=code' +
    '&scope=' + encodeURIComponent(SCOPES) +
    '&access_type=offline' +
    '&prompt=consent' +
    '&code_challenge=' + challenge +
    '&code_challenge_method=S256';

  const server = http.createServer(async (req, res) => {
    if (!req.url.startsWith('/callback')) {
      res.writeHead(404); res.end(); return;
    }
    const u = new URL(req.url, 'http://localhost:' + PORT);
    const code = u.searchParams.get('code');
    const error = u.searchParams.get('error');

    if (error) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h1>OAuth error: ' + error + '</h1><p>You can close this window.</p>');
      console.error('Auth error:', error);
      server.close();
      process.exit(1);
    }

    if (code) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h1>Authorized.</h1><p>You can close this window and return to the terminal.</p>');

      const form =
        'code=' + encodeURIComponent(code) +
        '&client_id=' + encodeURIComponent(clientId) +
        '&client_secret=' + encodeURIComponent(clientSecret) +
        '&redirect_uri=' + encodeURIComponent(REDIRECT_URI) +
        '&grant_type=authorization_code' +
        '&code_verifier=' + verifier;

      const tok = await httpsPost('oauth2.googleapis.com', '/token', form);

      if (!tok.refresh_token) {
        console.error('Token exchange failed:', tok);
        server.close();
        process.exit(1);
      }

      const saved = {
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tok.refresh_token,
        access_token: tok.access_token,
        scope: tok.scope,
        token_type: tok.token_type,
        created_at: new Date().toISOString(),
      };

      fs.writeFileSync(TOKEN_PATH, JSON.stringify(saved, null, 2), { mode: 0o600 });
      fs.chmodSync(TOKEN_PATH, 0o600);

      // Mirror refresh token into ADC so existing scripts that read it keep working.
      const adcPath = path.join(process.env.HOME, '.config/gcloud/application_default_credentials.json');
      try {
        const adc = fs.existsSync(adcPath) ? JSON.parse(fs.readFileSync(adcPath, 'utf8')) : {};
        adc.client_id = clientId;
        adc.client_secret = clientSecret;
        adc.refresh_token = tok.refresh_token;
        adc.type = 'authorized_user';
        fs.writeFileSync(adcPath, JSON.stringify(adc, null, 2), { mode: 0o600 });
        console.log('✓ Synced refresh token into ADC (' + adcPath + ')');
      } catch (e) {
        console.log('Note: could not update ADC file — ' + e.message);
      }

      console.log('\n✓ Saved tokens to: ' + TOKEN_PATH);
      console.log('✓ Scopes granted: ' + tok.scope);
      console.log('\nNext:');
      console.log('  1) node scripts/google-ads-setup/keyword-research-gaps.js');
      console.log('  2) node scripts/google-ads-setup/gsc-opportunity-report.js');
      server.close();
    }
  });

  server.listen(PORT, () => {
    console.log('\nWaiting on http://localhost:' + PORT + '/callback');
    console.log('Opening browser for consent…\n');
    exec('open "' + authUrl + '"');
  });
}

main().catch((err) => { console.error('FAILED:', err.message); process.exit(1); });
