#!/usr/bin/env node
/**
 * Generates sitemap.xml for AIWholesail.com
 * Run: node scripts/generate-sitemap.js
 * Output: public/sitemap.xml
 */

const fs = require('fs');
const path = require('path');

const DOMAIN = 'https://aiwholesail.com';
const today = new Date().toISOString().split('T')[0];

// Static pages
const staticPages = [
  { url: '/', priority: '1.0', changefreq: 'weekly' },
  { url: '/pricing', priority: '0.9', changefreq: 'monthly' },
  { url: '/about', priority: '0.7', changefreq: 'monthly' },
  { url: '/how-it-works', priority: '0.8', changefreq: 'monthly' },
  { url: '/use-cases', priority: '0.8', changefreq: 'monthly' },
  { url: '/blog', priority: '0.9', changefreq: 'daily' },
  { url: '/tools', priority: '0.9', changefreq: 'monthly' },
  { url: '/markets', priority: '0.9', changefreq: 'weekly' },
  { url: '/faq', priority: '0.6', changefreq: 'monthly' },
  { url: '/contact', priority: '0.5', changefreq: 'monthly' },
];

// Tool pages
const tools = [
  'mortgage-calculator', 'wholesale-deal-calculator', 'arv-calculator',
  'cash-flow-calculator', 'rehab-estimator', 'brrrr-calculator',
  'offer-price-calculator', 'cap-rate-calculator',
];

// City market pages
const cities = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'cities.json'), 'utf8')
);

// Competitor pages
const competitors = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'competitors.json'), 'utf8')
);

// Blog articles
let blogArticles = [];
try {
  const blogIndex = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'blog', 'index.json'), 'utf8')
  );
  blogArticles = blogIndex.articles || [];
} catch {}

// Build sitemap
let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

// Static pages
for (const page of staticPages) {
  xml += `  <url>\n    <loc>${DOMAIN}${page.url}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${page.changefreq}</changefreq>\n    <priority>${page.priority}</priority>\n  </url>\n`;
}

// Tools
for (const tool of tools) {
  xml += `  <url>\n    <loc>${DOMAIN}/tools/${tool}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
}

// Market pages
for (const city of cities) {
  xml += `  <url>\n    <loc>${DOMAIN}/markets/${city.slug}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
}

// Competitor pages
for (const comp of competitors) {
  xml += `  <url>\n    <loc>${DOMAIN}/vs/${comp.slug}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
}

// Blog articles
for (const article of blogArticles) {
  const date = article.publishedAt ? article.publishedAt.split('T')[0] : today;
  xml += `  <url>\n    <loc>${DOMAIN}/blog/${article.slug}</loc>\n    <lastmod>${date}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>\n`;
}

xml += '</urlset>\n';

const outputPath = path.join(__dirname, '..', 'public', 'sitemap.xml');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, xml);

console.log(`Sitemap generated: ${outputPath}`);
console.log(`  Static pages: ${staticPages.length}`);
console.log(`  Tools: ${tools.length}`);
console.log(`  Markets: ${cities.length}`);
console.log(`  Competitors: ${competitors.length}`);
console.log(`  Blog articles: ${blogArticles.length}`);
console.log(`  Total URLs: ${staticPages.length + tools.length + cities.length + competitors.length + blogArticles.length}`);
