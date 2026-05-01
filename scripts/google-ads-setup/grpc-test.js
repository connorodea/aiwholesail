#!/usr/bin/env node
/**
 * Direct gRPC call to Google Ads API.
 * Bypasses REST and uses the native gRPC protocol.
 */
const grpc = require('@grpc/grpc-js');
const crypto = require('crypto');
const https = require('https');
const fs = require('fs');

const SA_KEY_PATH = process.env.HOME + '/.config/gcloud/aiwholesail-ads-key.json';
const DEVELOPER_TOKEN = 'AIzaSyAYvABf1mHMOvCok8y6_FVHwXmdECm64_E';
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
      iat: now, exp: now + 3600
    })).toString('base64url');
    const signInput = header + '.' + claims;
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signInput);
    const signature = sign.sign(key.private_key, 'base64url');
    const jwt = signInput + '.' + signature;
    const postData = 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt;
    const req = https.request({
      hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        const t = JSON.parse(data);
        t.access_token ? resolve(t.access_token) : reject(new Error(JSON.stringify(t)));
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('Getting access token...');
  const accessToken = await getServiceAccountToken();
  console.log('Token obtained.');

  // Create gRPC channel credentials
  const sslCreds = grpc.credentials.createSsl();
  const callCreds = grpc.credentials.createFromMetadataGenerator((params, callback) => {
    const metadata = new grpc.Metadata();
    metadata.add('authorization', `Bearer ${accessToken}`);
    metadata.add('developer-token', DEVELOPER_TOKEN);
    metadata.add('login-customer-id', CUSTOMER_ID);
    callback(null, metadata);
  });
  const combinedCreds = grpc.credentials.combineChannelCredentials(sslCreds, callCreds);

  // Connect to Google Ads gRPC endpoint
  console.log('Connecting to googleads.googleapis.com:443 via gRPC...');

  // Use a generic gRPC client to call listAccessibleCustomers
  // The service is: google.ads.googleads.v17.services.CustomerService
  // The method is: ListAccessibleCustomers
  const client = new grpc.Client(
    'googleads.googleapis.com:443',
    combinedCreds,
    { 'grpc.max_receive_message_length': 64 * 1024 * 1024 }
  );

  // Make an unary call using the raw gRPC path
  const servicePath = '/google.ads.googleads.v17.services.CustomerService/ListAccessibleCustomers';

  // ListAccessibleCustomers takes an empty request
  // In protobuf, an empty message is just an empty buffer
  const emptyRequest = Buffer.alloc(0);

  client.makeUnaryRequest(
    servicePath,
    (arg) => arg, // serialize: pass through
    (buf) => buf, // deserialize: pass through raw bytes
    emptyRequest,
    (err, response) => {
      if (err) {
        console.log('\ngRPC Error:');
        console.log('  Code:', err.code, `(${grpc.status[err.code]})`);
        console.log('  Details:', err.details);
        if (err.metadata) {
          const meta = err.metadata.getMap();
          for (const [k, v] of Object.entries(meta)) {
            console.log(`  Meta ${k}:`, typeof v === 'string' ? v.substring(0, 200) : v);
          }
        }
      } else {
        console.log('\nSUCCESS! Response bytes:', response?.length);
        // Try to decode as UTF-8 (protobuf text)
        if (response) console.log('Raw:', response.toString('hex').substring(0, 200));
      }
      client.close();
    }
  );
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
