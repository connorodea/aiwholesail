const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 14 Pro size
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  const outDir = path.join(__dirname, 'site-captures');
  const fs = require('fs');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  // Capture the homepage
  console.log('Navigating to aiwholesail.com...');
  await page.goto('https://aiwholesail.com', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Hero section
  await page.screenshot({ path: path.join(outDir, 'hero.png'), fullPage: false });
  console.log('Captured hero');

  // Scroll and capture sections
  const scrollPositions = [
    { name: 'features', y: 800 },
    { name: 'how-it-works', y: 1600 },
    { name: 'pricing', y: 2400 },
    { name: 'testimonials', y: 3200 },
    { name: 'cta', y: 4000 },
  ];

  for (const pos of scrollPositions) {
    await page.evaluate((y) => window.scrollTo(0, y), pos.y);
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(outDir, `${pos.name}.png`), fullPage: false });
    console.log(`Captured ${pos.name}`);
  }

  // Full page
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, 'fullpage.png'), fullPage: true });
  console.log('Captured full page');

  // Desktop version
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, 'desktop-hero.png'), fullPage: false });
  console.log('Captured desktop hero');

  await page.evaluate((y) => window.scrollTo(0, y), 800);
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(outDir, 'desktop-features.png'), fullPage: false });
  console.log('Captured desktop features');

  await page.evaluate((y) => window.scrollTo(0, y), 1600);
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(outDir, 'desktop-mid.png'), fullPage: false });
  console.log('Captured desktop mid section');

  await browser.close();
  console.log('Done! Screenshots saved to', outDir);
})();
