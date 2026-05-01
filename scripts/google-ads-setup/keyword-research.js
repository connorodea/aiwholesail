#!/usr/bin/env node
/**
 * Google Ads Keyword Planner - Find high-ROI, low-competition keywords
 * for AIWholesail.com
 */
const { GoogleAdsApi, enums } = require('google-ads-api');
const fs = require('fs');

const adc = JSON.parse(fs.readFileSync(
  process.env.HOME + '/.config/gcloud/application_default_credentials.json', 'utf8'
));

const DEVELOPER_TOKEN = 'kRCDpeAatWU0jkitEB5Ycg';
const CUSTOMER_ID = '1754727937';

// Seed keywords for real estate investing / wholesaling
const SEED_KEYWORDS = [
  'real estate deals',
  'wholesale real estate',
  'investment properties',
  'find off market properties',
  'real estate investing software',
  'property deal finder',
  'real estate lead generation',
  'wholesale houses',
  'distressed properties for sale',
  'real estate investor tools',
  'flip houses software',
  'motivated seller leads',
  'real estate CRM',
  'property analysis tool',
  'ARV calculator',
  'real estate wholesaling software',
  'buy rental properties',
  'real estate deal analysis',
  'skip tracing real estate',
  'cash buyer leads'
];

async function main() {
  console.log('=== Google Ads Keyword Planner ===\n');
  console.log('Using developer token (Test Access)...');
  console.log('Customer ID:', CUSTOMER_ID);
  console.log('Seed keywords:', SEED_KEYWORDS.length, '\n');

  const client = new GoogleAdsApi({
    client_id: adc.client_id,
    client_secret: adc.client_secret,
    developer_token: DEVELOPER_TOKEN
  });

  const customer = client.Customer({
    customer_id: CUSTOMER_ID,
    login_customer_id: CUSTOMER_ID,
    refresh_token: adc.refresh_token
  });

  try {
    // Generate keyword ideas
    console.log('Fetching keyword ideas...\n');

    const keywordIdeas = await customer.keywordPlanIdeas.generateKeywordIdeas({
      customer_id: CUSTOMER_ID,
      language: 'languageConstants/1000', // English
      geo_target_constants: ['geoTargetConstants/2840'], // United States
      keyword_plan_network: enums.KeywordPlanNetwork.GOOGLE_SEARCH,
      keyword_seed: {
        keywords: SEED_KEYWORDS
      }
    });

    if (!keywordIdeas || keywordIdeas.length === 0) {
      console.log('No keyword ideas returned.');
      return;
    }

    console.log(`Found ${keywordIdeas.length} keyword ideas.\n`);

    // Process and sort by opportunity score
    const processed = keywordIdeas
      .map(idea => {
        const metrics = idea.keyword_idea_metrics || {};
        const avgSearches = Number(metrics.avg_monthly_searches || 0);
        const competition = metrics.competition || 'UNSPECIFIED';
        const competitionIdx = Number(metrics.competition_index || 50);
        const lowBid = Number(metrics.low_top_of_page_bid_micros || 0) / 1_000_000;
        const highBid = Number(metrics.high_top_of_page_bid_micros || 0) / 1_000_000;
        const avgBid = (lowBid + highBid) / 2;

        // ROI Score: high volume + low competition + low cost = best
        // Normalize: volume 0-100, competition inverted 0-100, cost inverted 0-100
        const volumeScore = Math.min(avgSearches / 500, 1) * 100;
        const compScore = (100 - competitionIdx);
        const costScore = avgBid > 0 ? Math.max(0, 100 - (avgBid * 5)) : 50;
        const roiScore = (volumeScore * 0.35) + (compScore * 0.35) + (costScore * 0.3);

        return {
          keyword: idea.text || '',
          avgSearches,
          competition,
          competitionIdx,
          lowBid: lowBid.toFixed(2),
          highBid: highBid.toFixed(2),
          avgBid: avgBid.toFixed(2),
          roiScore: roiScore.toFixed(1)
        };
      })
      .filter(k => k.avgSearches > 0)
      .sort((a, b) => b.roiScore - a.roiScore);

    // Display top results
    console.log('TOP KEYWORDS BY ROI SCORE (high volume + low competition + low cost)\n');
    console.log('Score | Searches/mo | Competition | CPC Range      | Keyword');
    console.log('------|-------------|-------------|----------------|--------');

    processed.slice(0, 50).forEach(k => {
      const searches = String(k.avgSearches).padStart(11);
      const comp = k.competition.padEnd(11);
      const cpc = `$${k.lowBid}-$${k.highBid}`.padEnd(14);
      const score = k.roiScore.padStart(5);
      console.log(`${score} | ${searches} | ${comp} | ${cpc} | ${k.keyword}`);
    });

    // Save full results to CSV
    const csvPath = '/Users/connorodea/Desktop/APRIL2026/AIwholesail.com/scripts/google-ads-setup/keyword-research-results.csv';
    const csvHeader = 'Keyword,Avg Monthly Searches,Competition,Competition Index,Low Bid,High Bid,Avg Bid,ROI Score\n';
    const csvRows = processed.map(k =>
      `"${k.keyword}",${k.avgSearches},${k.competition},${k.competitionIdx},${k.lowBid},${k.highBid},${k.avgBid},${k.roiScore}`
    ).join('\n');
    fs.writeFileSync(csvPath, csvHeader + csvRows);
    console.log(`\nFull results saved to: ${csvPath}`);
    console.log(`Total keywords analyzed: ${processed.length}`);

  } catch (err) {
    console.error('Error:', err.message?.substring(0, 500));

    if (err.message?.includes('test account') || err.message?.includes('DEVELOPER_TOKEN')) {
      console.log('\nNote: Test developer tokens can only access test accounts.');
      console.log('Apply for Basic Access to use the Keyword Planner with your production account.');
      console.log('In the meantime, let me try with a test account approach...');
    }
  }
}

main();
