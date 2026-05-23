#!/usr/bin/env node
/**
 * check-blog-meta.js — Lint blog article JSON files for SEO meta hygiene.
 *
 * Walks src/data/blog/*.json and flags articles whose title or
 * metaDescription falls outside SERP-safe length bands. By default this
 * is a warning-only lint (exit 0). Pass --strict to fail CI on any issue.
 *
 * Usage:
 *   node scripts/seo/check-blog-meta.js
 *   node scripts/seo/check-blog-meta.js --dir src/data/blog
 *   node scripts/seo/check-blog-meta.js --strict
 *   node scripts/seo/check-blog-meta.js --json
 *
 * Exports pure functions for tests.
 */
const fs = require('fs');
const path = require('path');

const LIMITS = {
  TITLE_MIN: 30,
  TITLE_MAX: 60,
  DESC_MIN: 80,
  DESC_MAX: 160,
};

function lintArticle(article) {
  const issues = [];
  const slug = article.slug || '(no slug)';
  const title = String(article.title || '').trim();
  if (!title) {
    issues.push({ slug, code: 'TITLE_MISSING', message: 'No title' });
  } else {
    if (title.length > LIMITS.TITLE_MAX) {
      issues.push({
        slug,
        code: 'TITLE_TOO_LONG',
        message: `Title is ${title.length} chars (max ${LIMITS.TITLE_MAX}); Google will truncate.`,
        value: title,
      });
    } else if (title.length < LIMITS.TITLE_MIN) {
      issues.push({
        slug,
        code: 'TITLE_TOO_SHORT',
        message: `Title is ${title.length} chars (min ${LIMITS.TITLE_MIN}); wastes SERP real estate.`,
        value: title,
      });
    }
  }
  const desc = String(article.metaDescription || article.excerpt || '').trim();
  if (!desc) {
    issues.push({ slug, code: 'DESC_MISSING', message: 'No metaDescription or excerpt' });
  } else {
    if (desc.length > LIMITS.DESC_MAX) {
      issues.push({
        slug,
        code: 'DESC_TOO_LONG',
        message: `Description is ${desc.length} chars (max ${LIMITS.DESC_MAX}); Google will truncate.`,
        value: desc,
      });
    } else if (desc.length < LIMITS.DESC_MIN) {
      issues.push({
        slug,
        code: 'DESC_TOO_SHORT',
        message: `Description is ${desc.length} chars (min ${LIMITS.DESC_MIN}); under-serves the SERP snippet.`,
        value: desc,
      });
    }
  }
  return issues;
}

function lintDir(dir) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  const warnings = [];
  let errorFiles = 0;
  for (const f of files) {
    let article;
    try {
      article = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    } catch (e) {
      warnings.push({ slug: f, code: 'PARSE_ERROR', message: e.message });
      errorFiles++;
      continue;
    }
    // Skip index/manifest files (have an `articles` array, no top-level title).
    if (Array.isArray(article.articles) && !article.title) continue;
    for (const issue of lintArticle(article)) {
      warnings.push({ ...issue, file: f });
    }
  }
  return {
    totalFiles: files.length,
    errorFiles,
    warnings,
  };
}

function formatReport(report) {
  const lines = [];
  lines.push(`# Blog meta lint`);
  lines.push('');
  lines.push(`Scanned **${report.totalFiles}** article(s).`);
  lines.push(`Warnings: **${report.warnings.length}**.`);
  lines.push('');
  if (report.warnings.length === 0) {
    lines.push('✅ All articles within SERP-safe limits.');
    return lines.join('\n');
  }
  // Group by code
  const byCode = {};
  for (const w of report.warnings) {
    if (!byCode[w.code]) byCode[w.code] = [];
    byCode[w.code].push(w);
  }
  for (const code of Object.keys(byCode).sort()) {
    lines.push(`## ${code} (${byCode[code].length})`);
    lines.push('');
    for (const w of byCode[code]) {
      lines.push(`- \`${w.slug}\` — ${w.message}`);
      if (w.value) lines.push(`  > ${w.value.slice(0, 120)}${w.value.length > 120 ? '…' : ''}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

// ---- CLI. ----
function parseArgs(argv) {
  const opts = {
    dir: path.join(__dirname, '..', '..', 'src', 'data', 'blog'),
    strict: false,
    json: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    switch (a) {
      case '--dir': opts.dir = next; i++; break;
      case '--strict': opts.strict = true; break;
      case '--json': opts.json = true; break;
      default: break;
    }
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(opts.dir)) {
    console.error(`Blog data dir not found: ${opts.dir}`);
    process.exit(2);
  }
  const report = lintDir(opts.dir);
  if (opts.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else {
    process.stdout.write(formatReport(report) + '\n');
  }
  const failOnAny = opts.strict && report.warnings.length > 0;
  process.exit(failOnAny ? 1 : 0);
}

if (require.main === module) {
  main();
}

module.exports = { lintArticle, lintDir, formatReport, LIMITS };
