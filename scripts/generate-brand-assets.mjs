#!/usr/bin/env node
/**
 * Regenerate brand bitmaps from the canonical AIWHOLES[sail]IL wordmark.
 *
 * Source of truth: marketing/creatives/branding/aiwholesail-logo-main.html
 * Sail glyph SVG path + brand colors are reproduced inline below to keep
 * this script standalone (no parsing of the source HTML).
 *
 * Generates:
 *   public/favicon-16.png         16×16   — browser tab (sail glyph only)
 *   public/favicon-32.png         32×32   — browser tab @2x
 *   public/apple-touch-icon.png   180×180 — iOS home screen / PWA splash
 *   public/og-image.png           1200×630 — Twitter/LinkedIn/iMessage unfurls
 *   public/logo-aiw.png           1024×1024 — JSON-LD logo for Google KG / AI overviews
 *   public/logo-aiw-email.png     600×600 — transactional emails (Resend)
 *
 * Rendering: spawns the Playwright-cached Chromium headless shell at exact
 * window-size, screenshots the rendered HTML to PNG. No npm install needed —
 * uses the binary already on disk for the Playwright MCP.
 *
 * Run:
 *   node scripts/generate-brand-assets.mjs
 *
 * Re-run any time the wordmark changes (sail path, font, colors).
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const PUBLIC_DIR = join(REPO_ROOT, 'public');

// ---- Brand constants (mirror marketing/creatives/branding/aiwholesail-logo-main.html) ----
const SAIL_PATH =
  'M28,4 C33,6 42,30 47,62 Q48,68 42,68 L8,68 Q2,68 3,62 C8,30 23,2 28,4 Z';
const BRAND = {
  ink:    '#0a0a0a',
  paper:  '#fafaf9',
  signal: '#00c4c8',
  white:  '#ffffff',
};

// ---- Chromium binary ---------------------------------------------------
const CHROME = resolve(
  homedir(),
  'Library/Caches/ms-playwright/chromium_headless_shell-1217/chrome-headless-shell-mac-arm64/chrome-headless-shell',
);
if (!existsSync(CHROME)) {
  console.error(`Chromium headless shell not found at ${CHROME}`);
  console.error('Run `bunx playwright install chromium` or install playwright.');
  process.exit(1);
}

// ---- HTML templates ----------------------------------------------------

// Sail glyph (SVG markup, repeatable). Uses currentColor so caller controls fill.
const sailSvg = (fillHex, sizePx) => `
  <svg viewBox="0 0 50 70" width="${sizePx}" aria-hidden="true">
    <path fill="${fillHex}" d="${SAIL_PATH}"/>
  </svg>`;

// Wordmark (AIWHOLES + sail + IL) at a given font-size.
const wordmark = ({ textColor, sailColor, fontSizePx }) => `
  <span style="
    font-family: 'Onest', sans-serif;
    font-weight: 700;
    letter-spacing: -0.045em;
    color: ${textColor};
    font-size: ${fontSizePx}px;
    line-height: 1;
    display: inline-flex;
    align-items: baseline;
    text-transform: uppercase;
    white-space: nowrap;
  ">AIWHOLES<svg viewBox="0 0 50 70" aria-hidden="true" style="
    height: 0.78em; width: auto;
    margin: 0 -0.03em;
    transform: translateY(0.06em);
    flex-shrink: 0;
  "><path fill="${sailColor}" d="${SAIL_PATH}"/></svg>IL</span>`;

const baseHead = `
<!doctype html>
<html><head><meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Onest:wght@700&display=swap" rel="stylesheet">
<style>
  *,*::before,*::after { box-sizing: border-box; }
  html,body { margin:0; padding:0; }
  body { background:${BRAND.ink}; font-family:'Onest',sans-serif; -webkit-font-smoothing:antialiased; }
  /* Wait for Onest to load before screenshotting — chrome-headless-shell
     gives the page a brief idle window, but webfonts can race. The inline
     script below adds .fonts-ready once document.fonts.ready resolves. */
</style>
<script>
  (async () => {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    document.body.classList.add('fonts-ready');
  })();
</script>
</head>`;

// ---- Per-asset HTML ----------------------------------------------------

function htmlFaviconGlyph(sizePx) {
  // Just the sail glyph on a brand-ink square. At 16×16 / 32×32 the wordmark
  // wouldn't be legible, so we go with the standalone sail glyph (which IS
  // the brand mark per the AIWHOLES[sail]IL substitution).
  return `${baseHead}<body><div style="
    width:${sizePx}px;height:${sizePx}px;
    background:${BRAND.ink};
    display:flex;align-items:center;justify-content:center;
  ">${sailSvg(BRAND.signal, Math.round(sizePx * 0.72))}</div></body></html>`;
}

function htmlAppleTouchIcon() {
  // 180×180, sail glyph centered on brand ink (iOS rounds the corners).
  return `${baseHead}<body><div style="
    width:180px;height:180px;
    background:${BRAND.ink};
    display:flex;align-items:center;justify-content:center;
  ">${sailSvg(BRAND.signal, 110)}</div></body></html>`;
}

function htmlLogoSquare(sizePx) {
  // Full wordmark on brand-ink, centered. Used for JSON-LD logo (Google KG)
  // and email logo. Wordmark at ~62% of width.
  const fontSize = Math.round(sizePx * 0.115);
  return `${baseHead}<body><div style="
    width:${sizePx}px;height:${sizePx}px;
    background:${BRAND.ink};
    display:flex;align-items:center;justify-content:center;
  ">${wordmark({ textColor: BRAND.white, sailColor: BRAND.signal, fontSizePx: fontSize })}</div></body></html>`;
}

function htmlOgImage() {
  // 1200×630 — wordmark + tagline + accent line.
  // Aligned with the brand spec hero treatment.
  return `${baseHead}<body><div style="
    width:1200px;height:630px;
    background:${BRAND.ink};
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    gap:32px;
  ">
    ${wordmark({ textColor: BRAND.white, sailColor: BRAND.signal, fontSizePx: 110 })}
    <div style="
      font-family:'Onest',sans-serif;
      color:${BRAND.white};
      font-weight:700;
      font-size:34px;
      letter-spacing:-0.025em;
      text-align:center;
      max-width:880px;
      line-height:1.2;
    ">Find Profitable Real Estate Deals<br/><span style="color:rgba(255,255,255,0.55);font-weight:400;">Before Everyone Else</span></div>
    <div style="
      width:120px;height:3px;
      background:${BRAND.signal};
      border-radius:2px;
      margin-top:8px;
    "></div>
  </div></body></html>`;
}

// ---- Render helper -----------------------------------------------------

function render({ html, width, height, outPath }) {
  // Write HTML to a temp file, screenshot it, move PNG to outPath.
  const tmp = join(tmpdir(), `aw-brand-${Math.random().toString(36).slice(2)}.html`);
  writeFileSync(tmp, html);
  const screenshotTmp = join(tmpdir(), `aw-brand-${Math.random().toString(36).slice(2)}.png`);
  try {
    execFileSync(
      CHROME,
      [
        '--headless=new',
        '--hide-scrollbars',
        '--disable-gpu',
        '--no-sandbox',
        `--window-size=${width},${height}`,
        `--screenshot=${screenshotTmp}`,
        `--virtual-time-budget=2000`, // give webfonts time
        `file://${tmp}`,
      ],
      { stdio: ['ignore', 'inherit', 'inherit'] },
    );
    if (!existsSync(screenshotTmp)) throw new Error(`screenshot not produced for ${outPath}`);
    // Move screenshot into public/
    mkdirSync(dirname(outPath), { recursive: true });
    execFileSync('mv', [screenshotTmp, outPath]);
    console.log(`✓ wrote ${outPath}`);
  } catch (err) {
    console.error(`✗ failed to render ${outPath}:`, err.message);
    process.exit(1);
  }
}

// ---- Run ---------------------------------------------------------------

const assets = [
  { name: 'favicon-16.png',       w: 16,   h: 16,   html: htmlFaviconGlyph(16) },
  { name: 'favicon-32.png',       w: 32,   h: 32,   html: htmlFaviconGlyph(32) },
  { name: 'apple-touch-icon.png', w: 180,  h: 180,  html: htmlAppleTouchIcon() },
  { name: 'og-image.png',         w: 1200, h: 630,  html: htmlOgImage() },
  { name: 'logo-aiw.png',         w: 1024, h: 1024, html: htmlLogoSquare(1024) },
  { name: 'logo-aiw-email.png',   w: 600,  h: 600,  html: htmlLogoSquare(600) },
];

console.log(`Generating ${assets.length} brand bitmaps to ${PUBLIC_DIR}/`);
for (const a of assets) {
  render({
    html: a.html,
    width: a.w,
    height: a.h,
    outPath: join(PUBLIC_DIR, a.name),
  });
}
console.log('done.');
