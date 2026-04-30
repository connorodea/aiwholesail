#!/usr/bin/env node
/**
 * AI Blog Generator for AIWholesail
 *
 * Generates SEO-optimized real estate articles using Claude API.
 * Runs 3x/day via cron on hetznerCO.
 *
 * Usage: node blog-generator.js [--type long-tail|city|both]
 *
 * Cron: 0 6,12,18 * * * cd /var/www/aiwholesail && node aiwholesail-api/scripts/blog-generator.js >> /var/log/blog-generator.log 2>&1
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk').default;

const BLOG_DIR = path.join(__dirname, '..', '..', 'src', 'data', 'blog');
const INDEX_PATH = path.join(BLOG_DIR, 'index.json');
const REPO_DIR = path.join(__dirname, '..', '..');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ============ KEYWORD POOLS ============

// Load keywords dynamically from the silo file
let LONG_TAIL_KEYWORDS = [];
try {
  const siloData = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'data', 'keyword-silos.json'), 'utf8')
  );
  for (const silo of siloData.silos || []) {
    for (const kw of silo.keywords || []) {
      LONG_TAIL_KEYWORDS.push({ keyword: kw.keyword, category: kw.category });
    }
  }
  console.log(`[Blog] Loaded ${LONG_TAIL_KEYWORDS.length} keywords from ${siloData.silos.length} silos`);
} catch (e) {
  console.warn('[Blog] Failed to load keyword-silos.json, using fallback');
  LONG_TAIL_KEYWORDS = [
    { keyword: "how to find wholesale real estate deals", category: "Beginner Guide" },
    { keyword: "how to calculate ARV for real estate", category: "Strategy" },
    { keyword: "what is a good cap rate for rental property", category: "Strategy" },
    { keyword: "how to flip houses for beginners", category: "Beginner Guide" },
    { keyword: "BRRRR method explained", category: "Strategy" },
  ];
}

// Load cities dynamically from the expanded cities file
let CITIES = [];
try {
  const citiesData = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'data', 'cities.json'), 'utf8')
  );
  CITIES = citiesData.map(c => `${c.city} ${c.state}`);
  console.log(`[Blog] Loaded ${CITIES.length} cities`);
} catch (e) {
  console.warn('[Blog] Failed to load cities.json, using fallback');
  CITIES = ["Houston TX", "Dallas TX", "Phoenix AZ", "Atlanta GA", "Tampa FL"];
}

// ============ ARTICLE GENERATION ============

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function getUsedKeywords() {
  try {
    const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
    return new Set((index.articles || []).map(a => a.slug));
  } catch {
    return new Set();
  }
}

function pickKeyword(type) {
  const usedSlugs = getUsedKeywords();

  if (type === 'city') {
    const availableCities = CITIES.filter(city => {
      const slug = slugify(`real-estate-deals-${city}`);
      return !usedSlugs.has(slug);
    });
    if (availableCities.length === 0) return null;
    const city = availableCities[Math.floor(Math.random() * availableCities.length)];
    return {
      keyword: `real estate deals in ${city}`,
      category: 'Market Insights',
      city,
      type: 'city',
    };
  }

  const available = LONG_TAIL_KEYWORDS.filter(k => {
    const slug = slugify(k.keyword);
    return !usedSlugs.has(slug);
  });
  if (available.length === 0) return null;
  return {
    ...available[Math.floor(Math.random() * available.length)],
    type: 'long-tail',
  };
}

async function generateArticle(keywordData) {
  const { keyword, category, city, type } = keywordData;

  const systemPrompt = `You are an expert SEO content writer for AIWholesail, an AI-powered real estate deal-finding platform at aiwholesail.com. Write informative, actionable blog articles that help real estate professionals find profitable deals.

Guidelines:
- Write for real estate investors, wholesalers, flippers, landlords, and agents
- Use natural language, avoid keyword stuffing
- Include specific numbers, examples, and actionable advice
- Mention AIWholesail naturally (1-2 times max) as a tool that can help
- Target the primary keyword in the title and naturally throughout
- Write at an 8th grade reading level for accessibility
- Include practical tips readers can use immediately
- Use varied section types for visual interest: paragraph, heading, subheading, list, quote, tip
- Include at least one "tip" section and one "quote" section per article
- Reference related AIWholesail tools when relevant (e.g., "Use our free ARV Calculator at aiwholesail.com/tools/arv-calculator")
- End with a CTA section mentioning AIWholesail's free trial`;

  const userPrompt = type === 'city'
    ? `Write a comprehensive article about finding profitable real estate deals in ${city}.

Include: local market overview, average home prices, best neighborhoods for investors, types of deals available (wholesale, flip, rental), local market trends, and practical tips for out-of-state investors looking at this market.

Primary keyword: "${keyword}"
Target length: 1200-1500 words.`
    : `Write a comprehensive article targeting the keyword: "${keyword}"

This should be an informative, SEO-optimized article that thoroughly answers this topic for real estate investors. Include practical examples, numbers, and step-by-step guidance where appropriate.

Primary keyword: "${keyword}"
Target length: 1000-1400 words.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `${userPrompt}

IMPORTANT: Return your response as valid JSON with this exact structure:
{
  "title": "SEO-optimized title (include primary keyword naturally)",
  "excerpt": "2 sentence summary for the blog index card",
  "metaDescription": "155 character meta description with keyword",
  "metaKeywords": "comma separated SEO keywords",
  "readTime": <number of minutes to read>,
  "sections": [
    {"type": "paragraph", "content": "..."},
    {"type": "heading", "content": "Main section heading"},
    {"type": "subheading", "content": "Sub-section heading"},
    {"type": "paragraph", "content": "..."},
    {"type": "list", "items": ["...", "..."]},
    {"type": "tip", "content": "Pro tip for readers"},
    {"type": "quote", "content": "Notable insight or industry wisdom"},
    {"type": "cta", "content": "Natural CTA mentioning AIWholesail and its free tools"}
  ]
}

Use a mix of paragraph, heading, list, and one cta section at the end. Return ONLY valid JSON, no markdown.`,
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  // Extract JSON from response (handle potential markdown wrapping)
  let jsonStr = text.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  const articleData = JSON.parse(jsonStr);

  const slug = slugify(articleData.title || keyword);
  const now = new Date().toISOString();

  const article = {
    slug,
    title: articleData.title,
    excerpt: articleData.excerpt,
    category,
    author: 'AIWholesail Team',
    publishedAt: now,
    readTime: articleData.readTime || 7,
    tags: (articleData.metaKeywords || keyword).split(',').map(t => t.trim()).slice(0, 5),
    metaDescription: articleData.metaDescription,
    metaKeywords: articleData.metaKeywords,
    sections: articleData.sections,
  };

  return article;
}

// ============ FILE MANAGEMENT ============

function saveArticle(article) {
  // Ensure blog directory exists
  if (!fs.existsSync(BLOG_DIR)) {
    fs.mkdirSync(BLOG_DIR, { recursive: true });
  }

  // Write article JSON
  const articlePath = path.join(BLOG_DIR, `${article.slug}.json`);
  fs.writeFileSync(articlePath, JSON.stringify(article, null, 2));

  // Update index
  let index = { articles: [] };
  try {
    index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  } catch {}

  // Add to beginning, remove featured from others if this is featured
  const indexEntry = {
    slug: article.slug,
    title: article.title,
    excerpt: article.excerpt,
    category: article.category,
    author: article.author,
    publishedAt: article.publishedAt,
    readTime: article.readTime,
    tags: article.tags,
    featured: false,
  };

  // Most recent article becomes featured
  index.articles = index.articles.map(a => ({ ...a, featured: false }));
  indexEntry.featured = true;
  index.articles.unshift(indexEntry);

  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));

  console.log(`[Blog] Saved: ${article.slug}`);
  return articlePath;
}

async function gitCommitAndPush(article) {
  const { execSync } = require('child_process');

  try {
    process.chdir(REPO_DIR);

    execSync('git add src/data/blog/', { stdio: 'pipe' });
    execSync(
      `git commit --author="AIWholesail Bot <bot@aiwholesail.com>" -m "blog: ${article.title.slice(0, 60)}"`,
      { stdio: 'pipe' }
    );
    execSync('git push origin staging', { stdio: 'pipe' });
    console.log(`[Blog] Pushed to staging: ${article.slug}`);
  } catch (err) {
    console.error('[Blog] Git push failed:', err.message);
  }
}

// ============ MAIN ============

async function main() {
  const args = process.argv.slice(2);
  const typeArg = args.find(a => a.startsWith('--type='))?.split('=')[1] || 'both';

  console.log(`[Blog] Starting generation at ${new Date().toISOString()}, type: ${typeArg}`);

  // Pick a keyword based on type
  let keywordData;
  if (typeArg === 'city') {
    keywordData = pickKeyword('city');
  } else if (typeArg === 'long-tail') {
    keywordData = pickKeyword('long-tail');
  } else {
    // Alternate between types
    const hour = new Date().getHours();
    keywordData = hour < 12 ? pickKeyword('long-tail') : pickKeyword('city');
    if (!keywordData) {
      keywordData = pickKeyword(hour < 12 ? 'city' : 'long-tail');
    }
  }

  if (!keywordData) {
    console.log('[Blog] No unused keywords available. Add more to the pool.');
    return;
  }

  console.log(`[Blog] Generating article for: "${keywordData.keyword}" (${keywordData.type})`);

  try {
    const article = await generateArticle(keywordData);
    saveArticle(article);
    await gitCommitAndPush(article);
    console.log(`[Blog] Complete: "${article.title}"`);
  } catch (err) {
    console.error('[Blog] Generation failed:', err.message);
    if (err.message.includes('JSON')) {
      console.error('[Blog] Claude returned invalid JSON. Retrying may help.');
    }
    process.exit(1);
  }
}

main();
