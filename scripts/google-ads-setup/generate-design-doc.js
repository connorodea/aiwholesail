#!/usr/bin/env node
/**
 * Generates a simple design document for the Google Ads API token application.
 * Outputs an HTML file that can be printed to PDF.
 */
const fs = require('fs');
const { exec } = require('child_process');

const html = `<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; color: #333; line-height: 1.6; }
  h1 { color: #1a1a1a; border-bottom: 2px solid #0066cc; padding-bottom: 10px; }
  h2 { color: #0066cc; margin-top: 30px; }
  h3 { color: #444; }
  table { border-collapse: collapse; width: 100%; margin: 15px 0; }
  th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
  th { background: #f5f5f5; font-weight: bold; }
  .header { text-align: center; margin-bottom: 40px; }
  .header p { color: #666; }
  ul { margin: 10px 0; }
  li { margin: 5px 0; }
  .section { margin-bottom: 30px; }
</style>
</head>
<body>

<div class="header">
  <h1>Google Ads API Tool Design Document</h1>
  <p><strong>Company:</strong> UPSCALED Inc. (dba AIWholesail)</p>
  <p><strong>Website:</strong> https://aiwholesail.com</p>
  <p><strong>Date:</strong> April 30, 2026</p>
  <p><strong>Version:</strong> 1.0</p>
</div>

<div class="section">
  <h2>1. Executive Summary</h2>
  <p>AIWholesail is a SaaS platform for real estate professionals. We use Google Ads to acquire subscribers for our platform. This API tool is an internal-only campaign management and reporting system that allows our marketing team to monitor, optimize, and report on our Google Ads campaigns programmatically.</p>
  <p><strong>Key point:</strong> This tool is used exclusively to manage our own advertising. We do not manage ads for third-party clients.</p>
</div>

<div class="section">
  <h2>2. Tool Overview</h2>
  <table>
    <tr><th>Attribute</th><th>Details</th></tr>
    <tr><td>Tool Name</td><td>AIWholesail Ads Manager</td></tr>
    <tr><td>Tool Type</td><td>Internal CLI + Dashboard</td></tr>
    <tr><td>Users</td><td>Internal employees only (marketing team)</td></tr>
    <tr><td>Google Ads Accounts Managed</td><td>1 (our own account: 175-472-7937)</td></tr>
    <tr><td>API Version</td><td>v23 (latest stable)</td></tr>
    <tr><td>Authentication</td><td>OAuth 2.0 (Desktop application flow)</td></tr>
  </table>
</div>

<div class="section">
  <h2>3. API Usage & Functionality</h2>

  <h3>3.1 Campaign Management (Read + Write)</h3>
  <ul>
    <li>View campaign status, budgets, and bidding strategies</li>
    <li>Pause/enable campaigns based on performance thresholds</li>
    <li>Adjust daily budgets programmatically</li>
    <li>Create new Search and Performance Max campaigns</li>
  </ul>

  <h3>3.2 Reporting (Read-Only)</h3>
  <ul>
    <li>Pull daily performance metrics (impressions, clicks, conversions, cost)</li>
    <li>Generate weekly summary reports for the marketing team</li>
    <li>Monitor conversion tracking accuracy</li>
    <li>Export data to CSV for analysis</li>
  </ul>

  <h3>3.3 Conversion Tracking</h3>
  <ul>
    <li>Track subscription signups as conversions</li>
    <li>Track free trial starts as micro-conversions</li>
    <li>Import offline conversion data (subscription upgrades)</li>
  </ul>
</div>

<div class="section">
  <h2>4. API Methods Used</h2>
  <table>
    <tr><th>Service</th><th>Methods</th><th>Purpose</th></tr>
    <tr><td>GoogleAdsService</td><td>Search, SearchStream</td><td>Querying campaign data and metrics</td></tr>
    <tr><td>CampaignService</td><td>MutateCampaigns</td><td>Updating campaign status and budgets</td></tr>
    <tr><td>CampaignBudgetService</td><td>MutateCampaignBudgets</td><td>Adjusting daily budgets</td></tr>
    <tr><td>ConversionUploadService</td><td>UploadClickConversions</td><td>Importing offline conversions</td></tr>
    <tr><td>CustomerService</td><td>ListAccessibleCustomers</td><td>Account validation</td></tr>
  </table>
</div>

<div class="section">
  <h2>5. Rate Limiting & Best Practices</h2>
  <ul>
    <li>API calls are batched and rate-limited to stay within quotas</li>
    <li>Reporting queries use SearchStream for efficiency</li>
    <li>Caching is implemented for frequently accessed data (campaign lists, ad group structures)</li>
    <li>Exponential backoff is used for retrying failed requests</li>
    <li>All API responses are logged for debugging purposes</li>
  </ul>
</div>

<div class="section">
  <h2>6. Data Handling & Security</h2>
  <ul>
    <li>OAuth credentials are stored securely in environment variables, never in code</li>
    <li>No customer PII is accessed or stored — only aggregate campaign metrics</li>
    <li>API access is restricted to authorized team members via role-based access</li>
    <li>All API communication uses TLS encryption</li>
    <li>Developer token and OAuth secrets are never logged or exposed</li>
  </ul>
</div>

<div class="section">
  <h2>7. Architecture Diagram</h2>
  <pre style="background: #f5f5f5; padding: 20px; border-radius: 5px; font-family: monospace; font-size: 13px;">
┌─────────────────────┐
│   Marketing Team    │
│   (Internal Users)  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  AIWholesail CLI    │
│  & Dashboard        │
│  (Node.js)          │
└──────────┬──────────┘
           │ OAuth 2.0 + Developer Token
           ▼
┌─────────────────────┐
│  Google Ads API     │
│  (gRPC, v23)        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Google Ads Account │
│  ID: 175-472-7937   │
│  (AIWholesail)      │
└─────────────────────┘
  </pre>
</div>

<div class="section">
  <h2>8. Contact Information</h2>
  <table>
    <tr><th>Role</th><th>Contact</th></tr>
    <tr><td>Company</td><td>UPSCALED Inc.</td></tr>
    <tr><td>Website</td><td>https://aiwholesail.com</td></tr>
    <tr><td>API Contact</td><td>connor@upscaledinc.com</td></tr>
    <tr><td>Developer</td><td>Connor O'Dea</td></tr>
  </table>
</div>

</body>
</html>`;

const outputPath = '/Users/connorodea/Desktop/APRIL2026/AIwholesail.com/scripts/google-ads-setup/AIWholesail_Google_Ads_API_Design_Document.html';
fs.writeFileSync(outputPath, html);
console.log('HTML written to:', outputPath);

// Convert to PDF using the built-in macOS tool
const pdfPath = '/Users/connorodea/Desktop/AIWholesail_Google_Ads_API_Design_Document.pdf';
exec(`/usr/sbin/cupsfilter "${outputPath}" > "${pdfPath}" 2>/dev/null || echo "Use print dialog instead"`, (err) => {
  // Try opening in browser for Print to PDF
  exec(`open "${outputPath}"`);
  console.log('\\nOpened in browser. Press Cmd+P to print/save as PDF.');
  console.log('Save to: ' + pdfPath);
});
