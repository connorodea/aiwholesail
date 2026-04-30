const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const ADS_DIR = __dirname;
const OUTPUT_DIR = path.join(__dirname, 'mp4');

const ads = [
  { file: 'ad-square-1080x1080.html',   width: 1080, height: 1080, duration: 22000, name: 'aiwholesail-square-1080x1080' },
  { file: 'ad-story-1080x1920.html',     width: 1080, height: 1920, duration: 30000, name: 'aiwholesail-story-1080x1920' },
  { file: 'ad-landscape-1200x628.html',  width: 1200, height: 628,  duration: 17000, name: 'aiwholesail-landscape-1200x628' },
  { file: 'ad-retarget-1080x1080.html',  width: 1080, height: 1080, duration: 19000, name: 'aiwholesail-retarget-1080x1080' },
];

(async () => {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

  // Start local server
  const http = require('http');
  const server = http.createServer((req, res) => {
    const filePath = path.join(ADS_DIR, decodeURIComponent(req.url).slice(1));
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath);
      const mime = { '.html': 'text/html', '.jpg': 'image/jpeg', '.png': 'image/png', '.css': 'text/css', '.js': 'application/javascript' }[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });
  await new Promise(resolve => server.listen(9876, resolve));
  console.log('Server running on port 9876');

  for (const ad of ads) {
    console.log(`\\n=== Recording: ${ad.name} ===`);

    const tmpVideoDir = path.join(OUTPUT_DIR, `tmp-${ad.name}`);
    if (!fs.existsSync(tmpVideoDir)) fs.mkdirSync(tmpVideoDir, { recursive: true });

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: ad.width, height: ad.height },
      recordVideo: {
        dir: tmpVideoDir,
        size: { width: ad.width, height: ad.height },
      },
    });

    const page = await context.newPage();
    await page.goto(`http://localhost:9876/${ad.file}`, { waitUntil: 'load' });

    console.log(`  Waiting ${ad.duration / 1000}s for animation...`);
    await page.waitForTimeout(ad.duration);

    await page.close();
    await context.close();
    await browser.close();

    // Find the recorded webm file
    const files = fs.readdirSync(tmpVideoDir).filter(f => f.endsWith('.webm'));
    if (files.length === 0) {
      console.log('  ERROR: No video file recorded!');
      continue;
    }

    const webmPath = path.join(tmpVideoDir, files[0]);
    const mp4Path = path.join(OUTPUT_DIR, `${ad.name}.mp4`);

    // Convert webm -> mp4 with ffmpeg
    console.log('  Converting to MP4...');
    try {
      execSync(`ffmpeg -y -i "${webmPath}" -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -movflags +faststart "${mp4Path}"`, {
        stdio: 'pipe',
        timeout: 120000,
      });
      console.log(`  Done: ${mp4Path}`);

      // Get file size
      const stats = fs.statSync(mp4Path);
      console.log(`  Size: ${(stats.size / 1024 / 1024).toFixed(1)}MB`);
    } catch (e) {
      console.log(`  ffmpeg error: ${e.message}`);
    }

    // Cleanup tmp dir
    fs.rmSync(tmpVideoDir, { recursive: true, force: true });
  }

  server.close();
  console.log('\\n=== All done! MP4 files are in:', OUTPUT_DIR, '===');
})();
