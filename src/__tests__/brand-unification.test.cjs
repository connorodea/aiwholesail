#!/usr/bin/env node
/**
 * Source-level TDD for the cyan + font brand unification.
 *
 * Asserts:
 *   1. src/index.css --primary / --accent / --ring / --info all use the
 *      brand HSL "181 100% 39%" (= #00c4c8) in BOTH dark and light modes
 *   2. tailwind.config.ts overrides theme.extend.colors.cyan with a scale
 *      anchored on #00c4c8 at the 500 slot
 *   3. tailwind.config.ts fontFamily.sans starts with "Onest"
 *   4. tailwind.config.ts fontFamily.brand starts with "Onest"
 *   5. index.html loads Onest with weights 300;400;500;600;700;800
 *   6. index.html does NOT load Montserrat (or loads it only as a deferred
 *      fallback, see test note below)
 *   7. Zero hard-coded `#06b6d4` literals remain anywhere in src/
 *
 * Run with:
 *   node src/__tests__/brand-unification.test.cjs
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

function read(rel) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
}

function listSrcFiles() {
  const out = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
        walk(full);
      } else if (/\.(tsx?|css|html)$/.test(entry.name)) {
        out.push(full);
      }
    }
  })(path.join(REPO_ROOT, 'src'));
  return out;
}

// ---- CSS variables ------------------------------------------------------

test('src/index.css --primary uses brand HSL 181 100% 39% (dark mode)', () => {
  const css = read('src/index.css');
  // First :root block is dark theme; we want the FIRST --primary declaration.
  const firstPrimary = css.match(/--primary:\s*([0-9.\s%]+);/);
  assert.ok(firstPrimary, '--primary declaration not found in src/index.css');
  assert.match(
    firstPrimary[1].replace(/\s+/g, ' ').trim(),
    /^181\s+100%\s+39%$/,
    `--primary (dark) must be "181 100% 39%", got "${firstPrimary[1].trim()}"`,
  );
});

test('src/index.css --primary uses brand HSL in light mode too', () => {
  const css = read('src/index.css');
  // Find the .light block and check its --primary
  const lightBlock = css.match(/\.light\s*\{[\s\S]*?\n\s*\}/);
  assert.ok(lightBlock, '.light block not found in src/index.css');
  const lightPrimary = lightBlock[0].match(/--primary:\s*([0-9.\s%]+);/);
  assert.ok(lightPrimary, '--primary not declared in .light block');
  assert.match(
    lightPrimary[1].replace(/\s+/g, ' ').trim(),
    /^181\s+100%\s+39%$/,
    `--primary (light) must be "181 100% 39%", got "${lightPrimary[1].trim()}"`,
  );
});

test('src/index.css --accent uses brand HSL (dark mode)', () => {
  const css = read('src/index.css');
  const m = css.match(/--accent:\s*([0-9.\s%]+);/);
  assert.ok(m, '--accent not found');
  assert.match(
    m[1].replace(/\s+/g, ' ').trim(),
    /^181\s+100%\s+39%$/,
    `--accent (dark) must be "181 100% 39%"`,
  );
});

test('src/index.css --ring uses brand HSL (dark mode)', () => {
  const css = read('src/index.css');
  const m = css.match(/--ring:\s*([0-9.\s%]+);/);
  assert.ok(m, '--ring not found');
  assert.match(
    m[1].replace(/\s+/g, ' ').trim(),
    /^181\s+100%\s+39%$/,
    `--ring (dark) must be "181 100% 39%"`,
  );
});

test('src/index.css --info uses brand HSL (dark mode)', () => {
  const css = read('src/index.css');
  const m = css.match(/--info:\s*([0-9.\s%]+);/);
  assert.ok(m, '--info not found');
  assert.match(
    m[1].replace(/\s+/g, ' ').trim(),
    /^181\s+100%\s+39%$/,
    `--info (dark) must be "181 100% 39%"`,
  );
});

// ---- Tailwind cyan override --------------------------------------------

test('tailwind.config.ts overrides cyan palette with #00c4c8 at the 500 slot', () => {
  const cfg = read('tailwind.config.ts');
  // Strip comments so docstring mentions of the old hex don't satisfy the test.
  const code = cfg.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  // Must declare a `cyan: { ... 500: '#00c4c8' ... }` (case-insensitive on hex)
  assert.match(
    code,
    /cyan\s*:\s*\{[\s\S]*?500\s*:\s*['"]#00c4c8['"]/i,
    'tailwind.config.ts must override theme.extend.colors.cyan with 500: "#00c4c8"',
  );
});

test('tailwind.config.ts cyan override defines a usable 400 shade (lighter brand cousin)', () => {
  const cfg = read('tailwind.config.ts');
  const code = cfg.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  // 400 is the most-used text shade (1192 refs). Must exist in the override.
  assert.match(
    code,
    /cyan\s*:\s*\{[\s\S]*?400\s*:\s*['"]#[0-9a-f]{6}['"]/i,
    'tailwind.config.ts cyan override must define a 400 shade',
  );
});

// ---- Font: Onest globally ----------------------------------------------

test('tailwind.config.ts fontFamily.sans starts with Onest', () => {
  const cfg = read('tailwind.config.ts');
  // Match the sans declaration and assert Onest is the first entry.
  const m = cfg.match(/['"]sans['"]\s*:\s*\[\s*['"]([^'"]+)['"]/);
  assert.ok(m, "fontFamily.sans declaration not found");
  assert.equal(m[1], 'Onest', `fontFamily.sans must start with 'Onest', got '${m[1]}'`);
});

test('tailwind.config.ts fontFamily.brand starts with Onest', () => {
  const cfg = read('tailwind.config.ts');
  const m = cfg.match(/['"]brand['"]\s*:\s*\[\s*['"]([^'"]+)['"]/);
  assert.ok(m, "fontFamily.brand declaration not found");
  assert.equal(m[1], 'Onest', `fontFamily.brand must start with 'Onest', got '${m[1]}'`);
});

test('index.html loads Onest 300;400;500;600;700;800', () => {
  const html = read('index.html');
  // Match the Google Fonts URL with all six weights present in order.
  assert.match(
    html,
    /fonts\.googleapis\.com\/css2\?family=Onest:wght@300;400;500;600;700;800/,
    'index.html must load Onest with weights 300;400;500;600;700;800',
  );
});

test('index.html does not load Montserrat (font swap is complete)', () => {
  const html = read('index.html');
  assert.doesNotMatch(
    html,
    /fonts\.googleapis\.com\/css2\?family=Montserrat/,
    'index.html must not load Montserrat from Google Fonts',
  );
});

// ---- Legacy cyan hex literal sweep -------------------------------------

test('zero hard-coded #06b6d4 literals remain in src/ (case-insensitive)', () => {
  const offenders = [];
  for (const file of listSrcFiles()) {
    const txt = fs.readFileSync(file, 'utf8');
    if (/#06b6d4/i.test(txt)) {
      offenders.push(path.relative(REPO_ROOT, file));
    }
  }
  assert.equal(
    offenders.length,
    0,
    `legacy cyan #06b6d4 found in: ${offenders.join(', ')}`,
  );
});

test('zero hard-coded #06b6d4 literals remain in index.html', () => {
  const html = read('index.html');
  assert.doesNotMatch(
    html,
    /#06b6d4/i,
    'legacy cyan #06b6d4 still in index.html',
  );
});

// ---- Extended cyan sweep (added on review of PR #409) ------------------
// These pin the failure modes the first test pass missed: decimal rgba
// literals like `rgba(6, 182, 212, …)` and HSL literals like
// `hsl(187 85% 53% / …)` that bypass both Tailwind classes and CSS vars.

test('zero rgba(6, 182, 212, …) decimal cyan literals remain in src/', () => {
  const offenders = [];
  for (const file of listSrcFiles()) {
    const txt = fs.readFileSync(file, 'utf8');
    if (/rgba\(\s*6\s*,\s*182\s*,\s*212/i.test(txt)) {
      offenders.push(path.relative(REPO_ROOT, file));
    }
  }
  assert.equal(
    offenders.length,
    0,
    `legacy cyan rgba(6, 182, 212, …) found in: ${offenders.join(', ')}`,
  );
});

test('zero legacy old-HSL hsl(187 85% 53%) literals remain in src/', () => {
  const offenders = [];
  for (const file of listSrcFiles()) {
    const txt = fs.readFileSync(file, 'utf8');
    if (/hsl\(\s*187\s+85%\s+53%/i.test(txt)) {
      offenders.push(path.relative(REPO_ROOT, file));
    }
  }
  assert.equal(
    offenders.length,
    0,
    `legacy cyan hsl(187 85% 53%) found in: ${offenders.join(', ')}`,
  );
});

test('zero legacy secondary cyan hex literals (#22d3ee / #0891b2) remain in src/', () => {
  const offenders = [];
  for (const file of listSrcFiles()) {
    const txt = fs.readFileSync(file, 'utf8');
    if (/#22d3ee|#0891b2/i.test(txt)) {
      offenders.push(path.relative(REPO_ROOT, file));
    }
  }
  assert.equal(
    offenders.length,
    0,
    `legacy secondary cyan hex found in: ${offenders.join(', ')}`,
  );
});

test('aiwholesail-api/routes/emailCapture.js uses the brand seafoam, not the old cyan', () => {
  const js = fs.readFileSync(
    path.join(REPO_ROOT, 'aiwholesail-api/routes/emailCapture.js'),
    'utf8',
  );
  assert.doesNotMatch(js, /#06b6d4/i, 'email template still uses legacy #06b6d4');
  assert.doesNotMatch(js, /#22d3ee/i, 'email template still uses legacy #22d3ee');
  assert.doesNotMatch(
    js,
    /rgba\(\s*6\s*,\s*182\s*,\s*212/i,
    'email template still uses legacy rgba(6, 182, 212, …)',
  );
  assert.match(js, /#00c4c8/i, 'email template must use brand seafoam #00c4c8');
});
