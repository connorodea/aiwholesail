#!/usr/bin/env node
/**
 * Generates sitemap.xml (and sitemap-index.xml if needed) for AIWholesail.com
 *
 * Loads all data sources and produces URLs for every page type:
 *   - Static pages
 *   - Market pages (cities)
 *   - State pages
 *   - Strategy index + City x Strategy
 *   - Distress types + Distress x City
 *   - Guide pages
 *   - Glossary pages
 *   - Competitor pages
 *   - Tool pages
 *   - Blog posts
 *
 * Run:  node scripts/generate-sitemap.js
 * Output: public/sitemap.xml  (+ public/sitemap-index.xml if > 50,000 URLs)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const DOMAIN = 'https://aiwholesail.com';
const MAX_URLS_PER_SITEMAP = 50000; // Google recommendation
const today = new Date().toISOString().split('T')[0];
const OUTPUT_DIR = path.join(__dirname, '..', 'public');

// ---------------------------------------------------------------------------
// Load data
// ---------------------------------------------------------------------------
const dataDir = path.join(__dirname, '..', 'src', 'data');

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

const cities = loadJson(path.join(dataDir, 'cities.json'));
const competitors = loadJson(path.join(dataDir, 'competitors.json'));
const guides = loadJson(path.join(dataDir, 'guides.json'));
const glossary = loadJson(path.join(dataDir, 'glossary.json'));

let blogArticles = [];
try {
  const blogIndex = loadJson(path.join(dataDir, 'blog', 'index.json'));
  blogArticles = blogIndex.articles || [];
} catch {
  console.warn('Warning: Could not load blog/index.json — skipping blog URLs');
}

// ---------------------------------------------------------------------------
// Derive unique states (slug = stateFull lowercased, spaces -> hyphens)
// ---------------------------------------------------------------------------
function slugifyState(stateFull) {
  return stateFull.toLowerCase().replace(/\s+/g, '-');
}

const stateMap = new Map();
for (const city of cities) {
  if (!stateMap.has(city.state)) {
    stateMap.set(city.state, {
      slug: slugifyState(city.stateFull),
      stateFull: city.stateFull,
    });
  }
}
const uniqueStates = Array.from(stateMap.values());

// ---------------------------------------------------------------------------
// Page definitions
// ---------------------------------------------------------------------------

// 1. Static pages
const staticPages = [
  { path: '/',             priority: '1.0', changefreq: 'weekly' },
  { path: '/pricing',      priority: '0.9', changefreq: 'monthly' },
  { path: '/about',        priority: '0.5', changefreq: 'monthly' },
  { path: '/faq',          priority: '0.5', changefreq: 'monthly' },
  { path: '/how-it-works', priority: '0.5', changefreq: 'monthly' },
  { path: '/use-cases',    priority: '0.5', changefreq: 'monthly' },
  { path: '/blog',         priority: '0.9', changefreq: 'daily' },
  { path: '/contact',      priority: '0.5', changefreq: 'monthly' },
  { path: '/auth',         priority: '0.5', changefreq: 'monthly' },
  { path: '/terms',        priority: '0.5', changefreq: 'yearly' },
  { path: '/privacy',      priority: '0.5', changefreq: 'yearly' },
  { path: '/refund',       priority: '0.5', changefreq: 'yearly' },
  { path: '/tools',        priority: '0.9', changefreq: 'monthly' },
  { path: '/markets',      priority: '0.9', changefreq: 'weekly' },
  { path: '/guides',       priority: '0.9', changefreq: 'weekly' },
  { path: '/glossary',     priority: '0.9', changefreq: 'weekly' },
  { path: '/deals',        priority: '0.9', changefreq: 'weekly' },
  { path: '/laws',         priority: '0.5', changefreq: 'monthly' },
  { path: '/developers',   priority: '0.5', changefreq: 'monthly' },
];

// 2. Tool pages (13)
const tools = [
  'mortgage-calculator',
  'wholesale-deal-calculator',
  'arv-calculator',
  'cash-flow-calculator',
  'rehab-estimator',
  'brrrr-calculator',
  'offer-price-calculator',
  'cap-rate-calculator',
  'wholesale-fee-calculator',
  'holding-cost-calculator',
  '70-percent-rule-calculator',
  'rental-roi-calculator',
  'dscr-calculator',
];

// 3. Strategy slugs (12)
const strategies = [
  'wholesale',
  'flip',
  'rental',
  'brrrr',
  'subject-to',
  'seller-financing',
  'foreclosure',
  'pre-foreclosure',
  'tax-lien',
  'probate',
  'absentee-owner',
  'distressed',
];

// 4. Distress types (9)
const distressTypes = [
  'pre-foreclosure',
  'tax-delinquent',
  'probate',
  'code-violations',
  'absentee-owners',
  'vacant-properties',
  'high-equity',
  'fsbo',
  'expired-listings',
];

// ---------------------------------------------------------------------------
// Build the full URL list
// ---------------------------------------------------------------------------
const urls = [];

function addUrl(urlPath, priority, changefreq, lastmod) {
  urls.push({
    loc: `${DOMAIN}${urlPath}`,
    lastmod: lastmod || today,
    changefreq: changefreq || 'weekly',
    priority: priority || '0.5',
  });
}

// --- Static pages ---
for (const page of staticPages) {
  addUrl(page.path, page.priority, page.changefreq);
}

// --- Market pages: /markets/:slug (264) ---
for (const city of cities) {
  addUrl(`/markets/${city.slug}`, '0.8', 'weekly');
}

// --- State pages: /states/:stateSlug (51) ---
for (const state of uniqueStates) {
  addUrl(`/states/${state.slug}`, '0.7', 'weekly');
}

// --- Strategy index: /invest/:strategy (12) ---
for (const strategy of strategies) {
  addUrl(`/invest/${strategy}`, '0.7', 'weekly');
}

// --- City x Strategy: /invest/:strategy/:citySlug (264 x 12 = 3,168) ---
for (const strategy of strategies) {
  for (const city of cities) {
    addUrl(`/invest/${strategy}/${city.slug}`, '0.6', 'monthly');
  }
}

// --- Distress type index: /deals/:type (9) ---
for (const dtype of distressTypes) {
  addUrl(`/deals/${dtype}`, '0.7', 'weekly');
}

// --- Distress x City: /deals/:type/:citySlug (264 x 9 = 2,376) ---
for (const dtype of distressTypes) {
  for (const city of cities) {
    addUrl(`/deals/${dtype}/${city.slug}`, '0.6', 'monthly');
  }
}

// --- Guide pages: /guides/:slug (18) ---
for (const guide of guides) {
  addUrl(`/guides/${guide.slug}`, '0.8', 'weekly');
}

// --- Glossary pages: /glossary/:slug (57) ---
for (const term of glossary) {
  addUrl(`/glossary/${term.slug}`, '0.7', 'monthly');
}

// --- Competitor pages: /vs/:slug (21) ---
for (const comp of competitors) {
  addUrl(`/vs/${comp.slug}`, '0.7', 'monthly');
}

// --- Tool pages: /tools/:slug (13) ---
for (const tool of tools) {
  addUrl(`/tools/${tool}`, '0.8', 'monthly');
}

// --- Blog posts: /blog/:slug ---
for (const article of blogArticles) {
  const lastmod = article.publishedAt ? article.publishedAt.split('T')[0] : today;
  addUrl(`/blog/${article.slug}`, '0.7', 'monthly', lastmod);
}

// ---------------------------------------------------------------------------
// XML helpers
// ---------------------------------------------------------------------------
function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function urlToXml(entry) {
  return [
    '  <url>',
    `    <loc>${escapeXml(entry.loc)}</loc>`,
    `    <lastmod>${entry.lastmod}</lastmod>`,
    `    <changefreq>${entry.changefreq}</changefreq>`,
    `    <priority>${entry.priority}</priority>`,
    '  </url>',
  ].join('\n');
}

function buildSitemapXml(urlEntries) {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ];
  for (const entry of urlEntries) {
    lines.push(urlToXml(entry));
  }
  lines.push('</urlset>');
  return lines.join('\n') + '\n';
}

function buildSitemapIndexXml(sitemapFiles) {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ];
  for (const file of sitemapFiles) {
    lines.push('  <sitemap>');
    lines.push(`    <loc>${DOMAIN}/${file}</loc>`);
    lines.push(`    <lastmod>${today}</lastmod>`);
    lines.push('  </sitemap>');
  }
  lines.push('</sitemapindex>');
  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// Write output
// ---------------------------------------------------------------------------
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// Split URLs into chunks (even if only 1 chunk, use consistent naming)
const chunks = [];
for (let i = 0; i < urls.length; i += MAX_URLS_PER_SITEMAP) {
  chunks.push(urls.slice(i, i + MAX_URLS_PER_SITEMAP));
}

const sitemapFiles = [];
for (let i = 0; i < chunks.length; i++) {
  const filename = `sitemap-${i + 1}.xml`;
  const xml = buildSitemapXml(chunks[i]);
  fs.writeFileSync(path.join(OUTPUT_DIR, filename), xml);
  sitemapFiles.push(filename);
  console.log(`  Written: ${filename} (${chunks[i].length} URLs)`);
}

// Write sitemap-index.xml referencing all sitemap chunks
const indexXml = buildSitemapIndexXml(sitemapFiles);
fs.writeFileSync(path.join(OUTPUT_DIR, 'sitemap-index.xml'), indexXml);
console.log(`Sitemap index written: public/sitemap-index.xml`);

// Write sitemap.xml as the full urlset (for direct sitemap.xml access)
// When only 1 chunk, sitemap.xml = the full URL list
// When multiple chunks, sitemap.xml = the sitemap index
if (chunks.length === 1) {
  const xml = buildSitemapXml(urls);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'sitemap.xml'), xml);
  console.log(`sitemap.xml written as full urlset (${urls.length} URLs)`);
} else {
  fs.writeFileSync(path.join(OUTPUT_DIR, 'sitemap.xml'), indexXml);
  console.log(`sitemap.xml written as sitemap index (${chunks.length} chunks)`);
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n--- Sitemap Generation Summary ---');
console.log(`  Static pages:         ${staticPages.length}`);
console.log(`  Market pages:         ${cities.length}`);
console.log(`  State pages:          ${uniqueStates.length}`);
console.log(`  Strategy index:       ${strategies.length}`);
console.log(`  City x Strategy:      ${cities.length} x ${strategies.length} = ${cities.length * strategies.length}`);
console.log(`  Distress type index:  ${distressTypes.length}`);
console.log(`  Distress x City:      ${cities.length} x ${distressTypes.length} = ${cities.length * distressTypes.length}`);
console.log(`  Guide pages:          ${guides.length}`);
console.log(`  Glossary pages:       ${glossary.length}`);
console.log(`  Competitor pages:     ${competitors.length}`);
console.log(`  Tool pages:           ${tools.length}`);
console.log(`  Blog posts:           ${blogArticles.length}`);
console.log(`  --------------------------------`);
console.log(`  TOTAL URLs:           ${urls.length}`);
