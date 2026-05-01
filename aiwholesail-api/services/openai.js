const axios = require('axios');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * Call Anthropic Claude API
 */
async function callClaude(systemPrompt, userMessage, options = {}) {
  const {
    model = 'claude-sonnet-4-6',
    maxTokens = 4000,
    temperature = 0.7
  } = options;

  const response = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }]
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      }
    }
  );

  return response.data;
}

/**
 * Call Anthropic Claude API with tools
 */
async function callClaudeWithTools(systemPrompt, messages, tools, options = {}) {
  const {
    model = 'claude-sonnet-4-6',
    maxTokens = 4000
  } = options;

  const response = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      tools,
      messages
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      }
    }
  );

  return response.data;
}

/**
 * Call OpenAI API (for vision tasks)
 */
async function callOpenAI(messages, options = {}) {
  const {
    model = 'gpt-4.1',
    maxTokens = 4000
  } = options;

  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model,
      messages,
      max_tokens: maxTokens
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      }
    }
  );

  return response.data;
}

/**
 * Property Analysis System Prompt
 */
const PROPERTY_ANALYSIS_PROMPT = `You are an expert real estate wholesale analyst with deep knowledge of property investment, market analysis, and deal evaluation. Your role is to analyze properties for wholesale opportunities and provide detailed, actionable insights.

ANALYSIS FRAMEWORK:
1. Market Value Assessment - Compare list price vs market value using comps and Zestimate
2. Wholesale Potential - Calculate spread, equity position, and profit margins
3. Property Condition - Analyze photos and descriptions for repair needs
4. Market Trends - Review price history and neighborhood dynamics
5. Investment Metrics - ARV, MAO, required repairs, holding costs
6. Risk Assessment - Market conditions, days on market, price reductions

WHOLESALE CRITERIA:
- Minimum 20% spread between purchase and ARV
- Properties with motivated sellers (high DOM, price reductions)
- Below market value opportunities
- Properties needing cosmetic/light rehab
- Strong rental potential or resale market

Be specific with numbers, percentages, and actionable recommendations.`;

/**
 * Lead Scoring System Prompt
 */
const LEAD_SCORING_PROMPT = `You are an expert real estate lead scoring analyst. Analyze the provided property and owner information to score this lead on a scale of 0-100.

SCORING CRITERIA:

1. MOTIVATION (0-25 points):
- Days on market (higher = more motivated)
- Price reductions history
- Absentee owner status
- Financial distress indicators
- Foreclosure/pre-foreclosure status

2. URGENCY (0-25 points):
- Time-sensitive situations
- Vacant property
- Code violations
- Tax delinquency
- Estate/probate situations

3. PROFITABILITY (0-25 points):
- Spread between price and ARV
- Repair estimate vs potential profit
- Equity position
- Comparable sales data
- Neighborhood appreciation trends

4. CONTACTABILITY (0-25 points):
- Owner contact info available
- Property accessibility
- Clear ownership (not corporate/trust complex)
- Response likelihood indicators

Return your analysis as a structured JSON response with scores for each category and an overall score.`;

/**
 * Wholesale Deal Analysis Prompt
 */
const WHOLESALE_ANALYSIS_PROMPT = `You are an expert wholesale real estate deal analyzer. Analyze the provided property data and calculate key metrics.

CALCULATIONS TO PERFORM:
1. ARV (After Repair Value) - Based on comps and market data
2. Repair Estimate - Based on condition, age, and visible issues
3. MAO (Maximum Allowable Offer) - Using 70% rule minus repairs
4. Potential Profit - Spread between MAO and asking price
5. Assignment Fee Potential - Typical 5-15% of ARV

PROVIDE:
- Detailed breakdown of all calculations
- Risk assessment (LOW/MEDIUM/HIGH)
- Deal recommendation (PURSUE/MAYBE/PASS)
- Negotiation strategy suggestions
- Key concerns or red flags

Format your response in clear sections with numbers and percentages.`;

module.exports = {
  callClaude,
  callClaudeWithTools,
  callOpenAI,
  PROPERTY_ANALYSIS_PROMPT,
  LEAD_SCORING_PROMPT,
  WHOLESALE_ANALYSIS_PROMPT
};
