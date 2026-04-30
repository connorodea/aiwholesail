const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const OUTPUT_DIR = path.join(__dirname, 'mp4');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

async function recordMobileDemo() {
  console.log('\n=== Recording: Mobile Site Demo ===');
  const tmpDir = path.join(OUTPUT_DIR, 'tmp-mobile-demo');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    recordVideo: { dir: tmpDir, size: { width: 1080, height: 1920 } },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
  });

  const page = await context.newPage();
  await page.goto('https://aiwholesail.com', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Smooth scroll through the entire page
  const totalHeight = await page.evaluate(() => document.body.scrollHeight);
  const steps = 60;
  const scrollPerStep = totalHeight / steps;

  for (let i = 0; i < steps; i++) {
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'smooth' }), scrollPerStep * i);
    await page.waitForTimeout(250);
  }

  // Scroll back to top
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await page.waitForTimeout(2000);

  // Click "Try Free" button if visible
  try {
    const tryFreeBtn = page.locator('text=Try Free').first();
    if (await tryFreeBtn.isVisible({ timeout: 2000 })) {
      await tryFreeBtn.hover();
      await page.waitForTimeout(800);
    }
  } catch (e) {}

  // Click "Start 7-Day Free Trial" if visible
  try {
    const trialBtn = page.locator('text=Start 7-Day Free Trial').first();
    if (await trialBtn.isVisible({ timeout: 2000 })) {
      await trialBtn.hover();
      await page.waitForTimeout(1000);
    }
  } catch (e) {}

  await page.waitForTimeout(1500);
  await page.close();
  await context.close();
  await browser.close();

  // Convert
  const files = fs.readdirSync(tmpDir).filter(f => f.endsWith('.webm'));
  if (files.length > 0) {
    const webmPath = path.join(tmpDir, files[0]);
    const mp4Path = path.join(OUTPUT_DIR, 'aiwholesail-mobile-demo.mp4');
    execSync(`ffmpeg -y -i "${webmPath}" -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -movflags +faststart "${mp4Path}"`, { stdio: 'pipe', timeout: 120000 });
    console.log(`  Done: ${mp4Path} (${(fs.statSync(mp4Path).size / 1024 / 1024).toFixed(1)}MB)`);
  }
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

async function recordDesktopDemo() {
  console.log('\n=== Recording: Desktop Site Demo ===');
  const tmpDir = path.join(OUTPUT_DIR, 'tmp-desktop-demo');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: tmpDir, size: { width: 1440, height: 900 } },
  });

  const page = await context.newPage();
  await page.goto('https://aiwholesail.com', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2500);

  // Smooth scroll through sections
  const scrollPositions = [0, 400, 800, 1200, 1600, 2000, 2400, 2800, 3200, 3600, 4000, 4400];
  for (const y of scrollPositions) {
    await page.evaluate((scrollY) => window.scrollTo({ top: scrollY, behavior: 'smooth' }), y);
    await page.waitForTimeout(600);
  }

  // Scroll back up to "How It Works"
  await page.evaluate(() => window.scrollTo({ top: 800, behavior: 'smooth' }));
  await page.waitForTimeout(1500);

  // Hover over feature cards
  try {
    const cards = page.locator('[class*="card"], [class*="Card"]');
    const count = await cards.count();
    for (let i = 0; i < Math.min(count, 4); i++) {
      const card = cards.nth(i);
      if (await card.isVisible({ timeout: 500 })) {
        await card.hover();
        await page.waitForTimeout(600);
      }
    }
  } catch (e) {}

  // Click nav links
  try {
    const navLinks = ['How It Works', 'Use Cases', 'Pricing'];
    for (const linkText of navLinks) {
      const link = page.locator(`nav >> text="${linkText}"`).first();
      if (await link.isVisible({ timeout: 1000 })) {
        await link.click();
        await page.waitForTimeout(1500);
      }
    }
  } catch (e) {}

  // End on CTA
  try {
    const ctaBtn = page.locator('text=Start Free Trial').first();
    if (await ctaBtn.isVisible({ timeout: 2000 })) {
      await ctaBtn.hover();
      await page.waitForTimeout(1200);
    }
  } catch (e) {}

  await page.waitForTimeout(1500);
  await page.close();
  await context.close();
  await browser.close();

  // Convert
  const files = fs.readdirSync(tmpDir).filter(f => f.endsWith('.webm'));
  if (files.length > 0) {
    const webmPath = path.join(tmpDir, files[0]);
    const mp4Path = path.join(OUTPUT_DIR, 'aiwholesail-desktop-demo.mp4');
    execSync(`ffmpeg -y -i "${webmPath}" -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -movflags +faststart "${mp4Path}"`, { stdio: 'pipe', timeout: 120000 });
    console.log(`  Done: ${mp4Path} (${(fs.statSync(mp4Path).size / 1024 / 1024).toFixed(1)}MB)`);
  }
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

async function recordSquareHighlight() {
  console.log('\n=== Recording: Square Highlight Reel ===');
  const tmpDir = path.join(OUTPUT_DIR, 'tmp-square-highlight');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1080, height: 1080 },
    recordVideo: { dir: tmpDir, size: { width: 1080, height: 1080 } },
  });

  const page = await context.newPage();
  await page.goto('https://aiwholesail.com', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Zoom into key sections for square format
  const sections = [
    { y: 0, wait: 2500 },     // Hero
    { y: 600, wait: 2000 },   // How it works intro
    { y: 900, wait: 2000 },   // Smart Search
    { y: 1200, wait: 2000 },  // Spread Analysis
    { y: 1500, wait: 2000 },  // AI Analysis
    { y: 1800, wait: 2000 },  // Alerts
    { y: 2100, wait: 2000 },  // Pipeline
    { y: 2600, wait: 2500 },  // Built for section
    { y: 3200, wait: 2000 },  // Pricing
  ];

  for (const section of sections) {
    await page.evaluate((scrollY) => window.scrollTo({ top: scrollY, behavior: 'smooth' }), section.y);
    await page.waitForTimeout(section.wait);
  }

  // Scroll back to hero for CTA
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await page.waitForTimeout(2500);

  await page.close();
  await context.close();
  await browser.close();

  const files = fs.readdirSync(tmpDir).filter(f => f.endsWith('.webm'));
  if (files.length > 0) {
    const webmPath = path.join(tmpDir, files[0]);
    const mp4Path = path.join(OUTPUT_DIR, 'aiwholesail-square-demo.mp4');
    execSync(`ffmpeg -y -i "${webmPath}" -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -movflags +faststart "${mp4Path}"`, { stdio: 'pipe', timeout: 120000 });
    console.log(`  Done: ${mp4Path} (${(fs.statSync(mp4Path).size / 1024 / 1024).toFixed(1)}MB)`);
  }
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

(async () => {
  await recordMobileDemo();
  await recordDesktopDemo();
  await recordSquareHighlight();
  console.log('\n=== All site demo recordings complete! ===');
})();
