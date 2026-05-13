// SEO metadata for each /tools/[slug] calculator. Consumed by CalculatorSchema
// to emit Article + HowTo + FAQPage + SoftwareApplication JSON-LD and render
// matching visible UI.

export interface CalculatorMetadata {
  slug: string;
  name: string;
  summary: string;
  steps: { name: string; text: string }[];
  faqs: { q: string; a: string }[];
}

export const CALCULATOR_METADATA: Record<string, CalculatorMetadata> = {
  'cap-rate-calculator': {
    slug: 'cap-rate-calculator',
    name: 'Cap Rate Calculator',
    summary:
      "Cap rate (capitalization rate) measures a rental property's annual return independent of financing. Formula: Net Operating Income ÷ Purchase Price. AIWholesail's free calculator computes cap rate from your inputs (rent, expenses, vacancy, management) and shows whether the result is Low (under 4%), Average (4–7%), Good (7–10%), or Excellent (over 10%) for U.S. rental markets.",
    steps: [
      { name: 'Enter the property value', text: 'Use purchase price for an as-is acquisition, or appraised value if you already own it. Avoid using Zestimate as the only source — it has a 6.9% median error rate.' },
      { name: 'Enter gross annual rent', text: 'Sum 12 months of asking rent. For multi-unit properties, add each unit. Use comparable rents from Rentometer or AIWholesail rental-comps if the property is currently vacant.' },
      { name: 'Adjust vacancy and management', text: 'Vacancy rate defaults to 5%. Use 8–10% for higher-turnover properties or weak markets. Management fee runs 8–10% for residential, 4–6% for commercial.' },
      { name: 'Fill in operating expenses', text: 'Property tax (city/county records), insurance ($1,200–$2,400 typical), maintenance ($1,800–$3,600 typical for single-family), and any HOA. Be conservative.' },
      { name: 'Read the cap rate + valuation table', text: 'The cap rate appears alongside Low / Average / Good / Excellent benchmarks. The valuation table shows what the property is worth at 5%, 7%, and 10% target cap rates — useful for setting your maximum offer.' },
    ],
    faqs: [
      { q: 'What is a good cap rate for rental properties?', a: 'A cap rate of 6–8% (net) is solid for most U.S. buy-and-hold markets. Class A urban properties run 4–6% but with stronger appreciation. Class C/D properties in Cleveland or Memphis run 9–12% but carry higher tenant risk. Always use NET cap rate (after vacancy + management + maintenance) — gross figures overstate returns by 25–40%.' },
      { q: 'How is cap rate calculated?', a: 'Cap rate = Net Operating Income (NOI) ÷ Property Value × 100. NOI = Gross Rental Income − Vacancy Loss − Operating Expenses (taxes, insurance, maintenance, management, HOA). Financing costs are NOT included — that\'s cash-on-cash return, a different metric.' },
      { q: 'Is a higher cap rate always better?', a: 'No. A cap rate above 12% almost always signals risk: deferred maintenance, declining neighborhood, problematic tenants, or thin rental demand. Compare to local market norms before assuming a high cap rate means a deal — it often means a trap.' },
      { q: 'Cap rate vs. ROI — what\'s the difference?', a: 'Cap rate ignores financing and measures the unleveraged return on the property. ROI (or cash-on-cash return) factors in mortgage payments and measures the return on your actual cash invested. With 75% LTV financing, a 6% cap rate property often produces 15–20% cash-on-cash.' },
    ],
  },
  'wholesale-deal-calculator': {
    slug: 'wholesale-deal-calculator',
    name: 'Wholesale Deal Calculator',
    summary:
      "AIWholesail's free wholesale deal calculator computes the maximum allowable offer (MAO) for an assignment-of-contract deal. Formula: MAO = (ARV × 0.70) − rehab cost − target wholesale fee. The calculator also models your assignment fee, end-buyer profit, and minimum acceptable offer so you can negotiate within a known range. Used by wholesalers in all 50 states.",
    steps: [
      { name: 'Enter the after-repair value (ARV)', text: 'Pull 3–5 comparable sales within 0.5 miles, sold in the last 90 days, similar size and beds/baths. AIWholesail Elite\'s AI-ranked comps generate ARV with reasoning. Avoid Zestimate alone.' },
      { name: 'Estimate the rehab cost', text: 'Rules of thumb: cosmetic $15–$25/sqft, medium rehab $30–$50/sqft, full gut $60–$120/sqft. Add 15% contingency. Use AIWholesail\'s Rehab Estimator for line-item detail.' },
      { name: 'Set your target wholesale fee', text: 'Typical assignment fees: $5,000–$15,000 in most U.S. markets. Hot markets and larger properties support $20,000–$50,000. Don\'t price the deal so thin the buyer walks.' },
      { name: 'Read the maximum offer', text: 'The MAO is the highest price you can offer the seller while leaving the end buyer enough margin to flip or hold the property profitably. Anchor your first offer 10–15% below MAO.' },
    ],
    faqs: [
      { q: 'What is the 70% rule in wholesaling?', a: 'The 70% rule says your maximum offer should be 70% of ARV minus rehab cost: MAO = (ARV × 0.70) − Rehab. It assumes a flipper end buyer needs 30% margin to cover holding costs, closing, and profit. Wholesalers subtract their assignment fee from that MAO to set the seller offer.' },
      { q: 'How much do wholesalers typically make per deal?', a: 'Typical assignment fees: $5,000–$15,000. Experienced wholesalers in hot markets routinely earn $30,000–$50,000 per deal. Beginners usually book $3,000–$10,000 on their first 1–3 deals. Full-time wholesalers doing 2–4 deals/month earn $150K–$500K annually.' },
      { q: 'Should I use 70% or 75% in my MAO calculation?', a: 'Use 70% for fix-and-flip-targeted deals in normal markets. Use 75% if your end buyer is a buy-and-hold investor (they tolerate thinner margins for rentals) or if the market is hot enough that comps are rising faster than rehab timelines. Hot markets sometimes support 80%; lower means leaving deal flow on the table.' },
      { q: 'Does the wholesale fee come out of the MAO?', a: 'Yes — your wholesale fee reduces what the seller receives, not what the buyer pays. End-buyer pays (MAO + your assignment fee). Seller receives (MAO − your assignment fee). So your offer to the seller is MAO − assignment fee. Always model both perspectives before locking the contract.' },
    ],
  },
  'arv-calculator': {
    slug: 'arv-calculator',
    name: 'ARV Calculator',
    summary:
      "ARV (After-Repair Value) is the estimated market price a property will sell for after renovation. AIWholesail's free ARV calculator uses 3 comparable sales — adjusted for square footage, beds, baths, and lot size — to produce an ARV estimate. Use it as the input to the 70% rule (MAO = ARV × 0.70 − rehab) when underwriting a flip or wholesale deal.",
    steps: [
      { name: 'Pull 3 comparable sales', text: 'Use properties within 0.5 miles, sold in the last 90 days, similar bedroom and bathroom count, and similar square footage (±20%). MLS-sourced comps are most accurate; Zillow recent sales work as a fallback.' },
      { name: 'Enter each comp\'s sale price and size', text: 'Enter the actual sale price (not list price) and square footage. The calculator computes $/sqft for each comp and weights them based on proximity to your subject property.' },
      { name: 'Enter your subject property\'s size', text: 'Use county-recorded square footage (most accurate) or MLS-listed if the property is on-market. Don\'t use Zillow\'s estimated sqft for comp math — it can be 5–15% off.' },
      { name: 'Read the ARV range', text: 'The calculator returns a low / median / high ARV. Use the median as your baseline. For underwriting use the low end to stay conservative — buyers will appraise on the low end, not the high.' },
    ],
    faqs: [
      { q: 'How do I calculate ARV?', a: 'ARV = average $/sqft of comparable sales × your subject property\'s sqft. Refine by adjusting for differences: same neighborhood +0%, 0.5 miles away −5%, fewer beds/baths −5–10% each, smaller lot −2–5%. AIWholesail\'s AI ranks comps with adjustment reasoning.' },
      { q: 'How many comps do I need?', a: '3–5 comps is the industry standard. With fewer than 3, your ARV estimate has high variance. With more than 5, you start including marginal comps that drag accuracy. The best 3 (most similar, most recent, closest) beats 10 average ones.' },
      { q: 'How recent should comps be?', a: 'Sold within 90 days is the gold standard. Up to 180 days is acceptable in slower markets. Anything older than 6 months risks not reflecting the current market, especially in hot markets where prices move 1–2% monthly.' },
      { q: 'Why does my ARV differ from Zestimate?', a: 'Zestimate is an algorithm averaging public data — it has a 6.9% median error rate and runs blind to interior condition. Your manually-calculated ARV uses specific comparable sales tailored to YOUR subject property\'s features. Always trust hand-pulled comps over any AVM (automated valuation model).' },
    ],
  },
  'cash-flow-calculator': {
    slug: 'cash-flow-calculator',
    name: 'Cash Flow Calculator',
    summary:
      "Cash flow is what's left from monthly rent after all expenses — mortgage, taxes, insurance, maintenance, vacancy reserve, management, and capex reserve. AIWholesail's free cash flow calculator computes monthly cash flow, cash-on-cash return, and break-even occupancy from your inputs. Target positive monthly cash flow of $200–$600 per unit for sustainable buy-and-hold rentals.",
    steps: [
      { name: 'Enter purchase + financing details', text: 'Purchase price, down payment, interest rate, and loan term. For DSCR loans, use the rate from your pre-approval; conventional rates are 0.5–1% lower.' },
      { name: 'Enter monthly rental income', text: 'Use current rent (if leased) or comparable market rent (Rentometer, AIWholesail rental comps). For multi-unit properties, sum across units.' },
      { name: 'Set vacancy, maintenance, and management', text: 'Defaults: 5% vacancy, 8% maintenance, 8% property management. Bump vacancy to 8–10% for shorter-term rentals or weaker markets.' },
      { name: 'Fill in fixed costs', text: 'Property tax (from county records), insurance ($1,200–$2,400 annual typical), HOA (if applicable). Don\'t forget capex reserve — set aside 5–10% of rent for big-ticket items (roof, HVAC, water heater).' },
      { name: 'Read monthly cash flow + cash-on-cash', text: 'Monthly cash flow should be positive. Cash-on-cash return is annual cash flow ÷ cash invested (down payment + closing + rehab). 8–12% is solid; 15%+ is excellent.' },
    ],
    faqs: [
      { q: 'What is good cash flow on a rental property?', a: '$200–$600 net cash flow per door per month after ALL expenses is typical for buy-and-hold rentals. Below $200 you have little margin for surprises (vacancy, repairs, eviction). Above $600 usually indicates a great deal or a higher-risk market with tenant volatility.' },
      { q: 'What is the 50% rule in rental investing?', a: 'The 50% rule estimates that operating expenses (taxes, insurance, maintenance, management, vacancy) will consume 50% of gross rental income. The other 50% covers debt service and cash flow. It\'s a screening heuristic; underwrite actual expenses on any deal you\'re serious about.' },
      { q: 'Should I include capex reserves in cash flow?', a: 'Yes. Capex (roof, HVAC, water heater, plumbing, electrical) averages 5–10% of gross rent per year. Ignoring it produces an artificially high cash flow figure. Either include it as a line item or reduce your reported cash flow by 10–15% to be conservative.' },
      { q: 'Cash flow vs. cash-on-cash return — which matters more?', a: 'Cash flow tells you if you can hold the property month-to-month. Cash-on-cash return tells you if your capital is well-deployed compared to alternatives (stocks, other rentals, REITs). Both matter; cash flow first for survivability, cash-on-cash second for portfolio decisions.' },
    ],
  },
  'rehab-estimator': {
    slug: 'rehab-estimator',
    name: 'Rehab Estimator',
    summary:
      "Rehab estimation is the most common reason new investors lose money — underestimating repairs by 15–30% is normal without a checklist. AIWholesail's free rehab estimator walks you through line items (roof, HVAC, kitchen, baths, flooring, paint, exterior) with cost ranges per square foot. Add a 15% contingency. Conservative estimates protect your margin even when the contractor's bid comes in high.",
    steps: [
      { name: 'Pick your rehab scope', text: 'Cosmetic only ($15–$25/sqft), medium rehab including kitchens/baths/flooring/paint ($30–$50/sqft), or full gut ($60–$120/sqft). The estimator pre-fills line items per scope.' },
      { name: 'Confirm each line item cost', text: 'Override the default if you have a contractor bid. Use AIWholesail Elite\'s AI photo vision (reads listing photos) to pre-populate items the property visibly needs.' },
      { name: 'Add property-specific items', text: 'Foundation, septic, electrical panel, sewer line, well pump, mold remediation — any line items not in standard cosmetic/medium/full categories. These are the items that blow up budgets.' },
      { name: 'Apply 15% contingency', text: 'Always. The cheapest rehab you\'ll ever do is the one where surprises stay under your contingency budget. Solo flippers should use 20% until they\'ve closed 10+ projects.' },
      { name: 'Compare to your MAO model', text: 'Plug the total rehab estimate into AIWholesail\'s Wholesale Deal Calculator or 70% Rule Calculator to confirm your offer is still profitable. If the rehab kills the margin, walk away — there\'s another deal next week.' },
    ],
    faqs: [
      { q: 'How accurate are rehab estimators?', a: 'Estimator ranges (per sqft) are accurate to ±25% for typical residential rehabs. Final variance depends on local labor rates, contractor selection, and surprises like foundation/septic issues. The estimator is a screening tool — get 2–3 contractor bids before closing the deal.' },
      { q: 'How much should I budget for contingency?', a: 'Experienced flippers: 15% on cosmetic/medium, 20% on full gut. Beginners and out-of-state investors: 20% across the board until you have 10+ projects under your belt. Don\'t cheat on contingency to make a deal pencil — that\'s the #1 way solo flippers blow up.' },
      { q: 'What are the most underestimated rehab costs?', a: 'Foundation work ($5K–$30K), septic system replacement ($5K–$15K), main sewer line ($3K–$10K), electrical panel ($2K–$5K), and mold remediation ($1K–$10K depending on extent). Pre-purchase inspections catch most of these — pay for one before closing.' },
      { q: 'Should I use the estimator before or after walking the property?', a: 'Both. Before walking: rough estimate from listing photos and square footage to screen deals fast. After walking: detailed line-item estimate with the contractor walk-through. AIWholesail Elite\'s AI photo vision pre-populates the rough estimate from photos automatically.' },
    ],
  },
  'brrrr-calculator': {
    slug: 'brrrr-calculator',
    name: 'BRRRR Calculator',
    summary:
      "BRRRR is Buy, Rehab, Rent, Refinance, Repeat. The strategy recycles invested capital by cash-out refinancing at the post-rehab value, returning most of the original outlay to redeploy. AIWholesail's free BRRRR calculator models the full cycle: purchase + rehab cost, post-rehab ARV, 75% LTV refinance proceeds, monthly cash flow, and capital left in the deal after refi.",
    steps: [
      { name: 'Enter purchase + rehab', text: 'Purchase price plus rehab cost plus closing costs (~3%) plus 6 months of holding costs. This is your total all-in invested.' },
      { name: 'Enter post-rehab ARV', text: 'Use AIWholesail\'s ARV Calculator or hand-pulled comps. Be conservative — appraisers tend to come in 5–10% below market on refis.' },
      { name: 'Set the cash-out refinance LTV', text: 'Most lenders cap cash-out refi at 75% LTV. Some go to 80% for seasoned investors or DSCR loans. Use 70–75% to be safe.' },
      { name: 'Enter the long-term financing terms', text: 'Interest rate (typically 0.5–1.5% above 30-year owner-occupied), 30-year amortization, DSCR coverage ratio if using a DSCR loan.' },
      { name: 'Enter monthly rent', text: 'Use comparable rents post-rehab. Properties usually rent for higher post-rehab — but appraisers may not credit it unless the property is leased before refi.' },
      { name: 'Read the recap', text: 'You\'ll see: cash returned at refi, capital left in the deal, monthly cash flow, and 12-month cash-on-cash return. A "perfect" BRRRR returns 100% of capital; a typical solid BRRRR returns 60–85%.' },
    ],
    faqs: [
      { q: 'What does BRRRR stand for?', a: 'Buy, Rehab, Rent, Refinance, Repeat. It\'s a buy-and-hold strategy that recycles invested capital by cash-out refinancing the property at post-rehab value. The recovered capital funds the next deal — letting investors scale a portfolio with a fixed pool of cash.' },
      { q: 'How much money do I need for BRRRR?', a: 'You need enough cash or hard money to cover: purchase price, closing (~3%), full rehab budget plus 15% contingency, and ~6 months holding costs. On a $150K purchase + $40K rehab, plan for $210K–$230K deployed before the cash-out refi returns most of it.' },
      { q: 'What is a good ARV multiple for BRRRR?', a: 'Target ARV ≥ 1.3× total all-in cost. At 75% cash-out LTV that returns ~98% of capital. ARV 1.5× returns 100%+ (you actually pull MORE than you put in). Lower multiples leave money in the deal but can still cash flow profitably.' },
      { q: 'Can you BRRRR with no money down?', a: 'Not realistically — hard-money lenders require 10–20% of total project cost as borrower equity. The "no money down" BRRRR you see online usually means using private money or partnerships to cover that equity. Plan to deploy real capital, then recover most of it via refi.' },
    ],
  },
  'offer-price-calculator': {
    slug: 'offer-price-calculator',
    name: 'Offer Price Calculator',
    summary:
      "AIWholesail's free offer price calculator generates your maximum allowable offer (MAO) for any real estate deal type — wholesale, fix-and-flip, or buy-and-hold rental. Pick the strategy, enter ARV and rehab, and the calculator outputs MAO, recommended first offer (typically 10–15% below MAO for negotiation room), and minimum acceptable counter. Use it before every seller call.",
    steps: [
      { name: 'Pick the strategy', text: 'Wholesale (lower MAO — leaves room for assignment fee + flipper margin), Fix-and-Flip (70% rule), or Buy-and-Hold (DSCR-based; supports higher offers if rents are strong).' },
      { name: 'Enter ARV and rehab cost', text: 'Pull ARV from AIWholesail\'s ARV Calculator. Rehab from the Rehab Estimator with 15% contingency. Use conservative numbers — your offer can drop after inspection, but raising offers after locking erodes trust.' },
      { name: 'Add target margin/fee', text: 'Wholesalers: $5K–$15K assignment fee target. Flippers: $30K–$50K minimum net profit per deal. Landlords: target monthly cash flow ≥ $200/door after all expenses.' },
      { name: 'Read MAO and recommended offer', text: 'MAO is the ceiling; recommended first offer is typically MAO minus 10–15%. Anchor low on the first offer to leave negotiating room. Never reveal your MAO to the seller.' },
    ],
    faqs: [
      { q: 'How do I calculate the maximum offer on a property?', a: 'MAO depends on strategy. For flips: MAO = (ARV × 0.70) − Rehab. For wholesale: MAO_wholesale = (ARV × 0.70) − Rehab − Assignment Fee. For buy-and-hold: MAO = price where the property hits your target cash-on-cash + cash-flow numbers at current rents.' },
      { q: 'Should I make my first offer at MAO?', a: 'No. Anchor 10–15% below MAO so you have negotiating room. Most sellers counter the first offer regardless of price; coming in at MAO leaves you no room to come up. Start low, signal flexibility, and never reveal what you can actually pay.' },
      { q: 'What if the seller counters above my MAO?', a: 'Walk away politely. There\'s another deal next week, and chasing a thin deal is the #1 reason new investors lose money. Tell the seller "if your situation changes and you can hit X price, call me first" — many sellers do come back 30–60 days later.' },
      { q: 'How does the offer price calculator differ from the wholesale deal calculator?', a: 'The Wholesale Deal Calculator is specifically for assignment-of-contract wholesale deals (MAO_wholesale formula). The Offer Price Calculator covers wholesale, flips, and buy-and-hold in one tool. Use this when you\'re not sure yet which strategy fits the deal.' },
    ],
  },
  '70-percent-rule-calculator': {
    slug: '70-percent-rule-calculator',
    name: '70% Rule Calculator',
    summary:
      "The 70% rule says your maximum offer on a flip should be 70% of after-repair value (ARV) minus rehab cost: MAO = (ARV × 0.70) − Rehab. The 30% margin covers the flipper's holding costs, closing costs (both sides), commissions, and target profit. AIWholesail's free calculator applies the rule, shows MAO, and explains how to adjust for different markets and strategies.",
    steps: [
      { name: 'Enter ARV', text: 'Pull from comparable sales — 3–5 within 0.5 miles, sold last 90 days, similar size and beds/baths. Use AIWholesail\'s ARV Calculator if you need help.' },
      { name: 'Enter rehab cost', text: 'Detailed line items plus 15% contingency. Use AIWholesail\'s Rehab Estimator. Don\'t guess — overestimating ARV or underestimating rehab is how flippers lose money.' },
      { name: 'Read the MAO', text: 'The calculator outputs (ARV × 0.70) − Rehab. This is the highest price you should pay to keep flipper margin intact.' },
      { name: 'Adjust for market conditions', text: 'Hot markets sometimes support 75% (more buyers, faster sale). Cold markets require 65% (longer holding, more risk). Investors holding for rentals can stretch to 75–80% since they keep the property long-term.' },
    ],
    faqs: [
      { q: 'Where does the 30% margin go in the 70% rule?', a: 'Roughly: 10% to closing costs (both buy + sell), 6% to selling commissions, 5–8% to holding costs over 4–6 months (mortgage, taxes, insurance, utilities), and 6–9% to profit. In hot markets profit margin compresses; in cold markets it expands but holding costs eat more.' },
      { q: 'Does the 70% rule include rehab cost?', a: 'Yes. The formula is (ARV × 0.70) − Rehab, where rehab is SUBTRACTED after applying the 70% multiplier. Some new investors forget the subtraction and offer too high. Always include both steps.' },
      { q: 'When should I use 75% instead of 70%?', a: 'Use 75% when: (a) the market is hot and properties resell in under 60 days, (b) you\'re a buy-and-hold investor not flipping, (c) the rehab is mostly cosmetic with low risk of surprises. Use 65% when: the property is in a slow market, has structural issues, or the comps are thin.' },
      { q: 'Is the 70% rule the same as the wholesale formula?', a: 'Not exactly. Wholesalers subtract their assignment fee on top of the 70% rule: MAO_wholesale = (ARV × 0.70) − Rehab − Wholesale Fee. The 70% rule alone is the flipper\'s maximum; wholesalers offer less so the end-buyer flipper still hits 70%.' },
    ],
  },
  'dscr-calculator': {
    slug: 'dscr-calculator',
    name: 'DSCR Calculator',
    summary:
      "DSCR (Debt Service Coverage Ratio) is the rental property's annual rent divided by its annual debt service (mortgage P&I + taxes + insurance + HOA). Lenders use it to qualify rental-property loans without W-2 income — most require DSCR ≥ 1.0–1.25. AIWholesail's free calculator computes DSCR from your inputs and shows whether the property qualifies for a DSCR loan at major lender thresholds.",
    steps: [
      { name: 'Enter annual rent', text: 'Sum 12 months of rental income. For multi-unit, add each unit. Use current rent if leased; comparable market rent if vacant.' },
      { name: 'Enter mortgage details', text: 'Loan amount, interest rate (DSCR loans run 0.5–1.5% above conventional), 30-year amortization typically. AIWholesail Pro\'s pricing pulls live DSCR rates from major lenders for comparison.' },
      { name: 'Enter PITI components', text: 'Property tax (county records), insurance ($1,200–$2,400 annual), HOA if applicable. PITI = Principal + Interest + Taxes + Insurance (and HOA).' },
      { name: 'Read DSCR and qualifying threshold', text: 'DSCR ≥ 1.0 = property pays for itself. ≥ 1.25 = most lender minimums. ≥ 1.50 = best rates and terms. Below 1.0 means rent doesn\'t cover debt service — won\'t qualify for a DSCR loan.' },
    ],
    faqs: [
      { q: 'What is a DSCR loan?', a: 'A DSCR loan qualifies based on the property\'s ability to service the debt — rental income divided by annual debt payments. Unlike conventional loans, it doesn\'t require W-2 income or tax returns. Ideal for self-employed investors, full-time landlords, and out-of-state buyers.' },
      { q: 'What DSCR do most lenders require?', a: 'Minimum DSCR thresholds vary by lender: 1.0 (entry-level lenders), 1.10–1.25 (mainstream lenders), 1.50+ (best rates and 80% LTV). Below 1.0 the property doesn\'t cash flow positive — most lenders will decline unless you contribute extra equity.' },
      { q: 'DSCR loan vs. conventional mortgage — which is better?', a: 'Conventional loans are cheaper (0.5–1.5% lower rates) but require W-2 income and personal-debt ratios. DSCR loans are more flexible — no income check, qualify on property alone, faster close — but cost more in interest. Self-employed investors and high-DTI W-2 earners default to DSCR.' },
      { q: 'Can I get a DSCR loan for short-term rentals?', a: 'Yes, but lenders typically discount short-term rental income by 25–40% to account for vacancy and seasonality. Some lenders use the property\'s long-term-rental comp instead. Calculate both DSCR scenarios before approaching a lender.' },
    ],
  },
  'wholesale-fee-calculator': {
    slug: 'wholesale-fee-calculator',
    name: 'Wholesale Fee Calculator',
    summary:
      "How much should you charge as an assignment fee on a wholesale deal? AIWholesail's free calculator models typical wholesale fees by deal size, market type, and buyer pool. Output range: $5,000–$15,000 for typical deals, $20,000–$50,000 for hot markets and larger properties. The calculator shows the fee structure where you maximize income without pricing the end-buyer out of the deal.",
    steps: [
      { name: 'Enter the after-repair value', text: 'Pull from AIWholesail\'s ARV Calculator or comparable sales. Higher ARVs support higher fees in absolute dollars (5–10% of ARV is typical, capped by buyer margin needs).' },
      { name: 'Enter your seller-locked price', text: 'The price you have under contract with the motivated seller. The spread between this and the buyer\'s maximum determines your fee ceiling.' },
      { name: 'Pick your market temperature', text: 'Hot markets (Austin, Phoenix, Tampa): buyers compete, you can charge higher fees. Cold markets (Detroit, Cleveland): buyers selective, fees compress. Balanced markets default to mid-range.' },
      { name: 'Read the recommended fee range', text: 'Calculator outputs minimum / typical / maximum fee given the spread and market. Don\'t take the maximum on your first deal — leave margin for the buyer to feel they won.' },
    ],
    faqs: [
      { q: 'What is the typical wholesale assignment fee?', a: 'In most U.S. markets: $5,000–$15,000 per assignment. Hot markets and larger properties (ARV $400K+): $20,000–$50,000. Beginners typically book $3K–$10K on their first 1–3 deals. The fee depends on the spread between your contracted price and the buyer\'s maximum offer (MAO), not a fixed percentage.' },
      { q: 'Should I tell the buyer my assignment fee?', a: 'Disclose it on the assignment-of-contract paperwork — that\'s standard practice (and required in some states). Don\'t volunteer the exact figure during negotiation; let the buyer see the deal\'s margin on their side first. Sophisticated buyers understand wholesalers earn a fee.' },
      { q: 'Can I charge a percentage instead of a flat fee?', a: 'Flat fees are standard ($5K–$50K). Percentage-based fees (3–5% of purchase price) appear in larger commercial deals or new construction. For residential single-family wholesale, stick with flat fees — buyers expect them and they\'re cleaner on the paperwork.' },
      { q: 'What if the buyer wants me to lower my fee?', a: 'If the buyer\'s margin truly is too thin, lower your fee to save the deal — partial income is better than zero. But verify their math first; many buyers ask for fee cuts as a negotiation tactic when their margin is actually fine. Use AIWholesail\'s 70% Rule Calculator on the buyer\'s end to confirm.' },
    ],
  },
  'holding-cost-calculator': {
    slug: 'holding-cost-calculator',
    name: 'Holding Cost Calculator',
    summary:
      "Holding costs are what a flipper pays per month while the property is being rehabbed and sold — mortgage interest, property tax, insurance, utilities, HOA, and lawn care. AIWholesail's free calculator computes monthly holding costs and total holding for the projected timeline. Most flippers budget 4–6 months of holding; ignoring it is the #1 reason solo flippers lose money on otherwise good deals.",
    steps: [
      { name: 'Enter purchase price + financing', text: 'Hard money typically 8–14% interest, 1–3 origination points, interest-only payments. Conventional rates only apply if you live in the property during rehab (owner-occupied).' },
      { name: 'Enter property tax + insurance', text: 'Tax from county records (monthly = annual ÷ 12). Insurance during rehab/vacant: $150–$250/mo (vacant-property rider — about 2x normal rate).' },
      { name: 'Enter utilities + maintenance during rehab', text: 'Electric ($150/mo typical with crews working), water/sewer ($50–$80/mo), gas, HOA, lawn care ($50–$100/mo). Vacant properties also need fire/security checks.' },
      { name: 'Set the projected timeline', text: 'Cosmetic rehab + sale: 3 months. Medium rehab: 4–5 months. Full gut: 6–9 months. Add 2 months for any contractor delays or appraisal/financing slips during sale.' },
      { name: 'Subtract total holding from your profit projection', text: 'A $5,000/mo holding cost × 5-month rehab = $25,000 — easy to forget, painful to discover at closing. Always include holding in your MAO calculation.' },
    ],
    faqs: [
      { q: 'What are typical holding costs for a flip?', a: 'Average $3,500–$6,500/month on a $200K–$300K property. Components: hard money interest ($1,800–$2,500), property tax + insurance ($400–$600), utilities ($200–$300), HOA + maintenance ($100–$300), lawn/security ($50–$150). Multiply by 4–6 months for total holding budget.' },
      { q: 'How long does a typical flip take?', a: 'Cosmetic rehab + sale: 3 months. Medium rehab: 4–5 months. Full gut: 6–9 months. Slow markets add 1–3 months on the sale side. Always budget MORE time than your "expected" timeline — schedule slippage is the rule, not the exception.' },
      { q: 'Can I reduce holding costs by living in the property?', a: 'Yes, with caveats. Owner-occupied financing (FHA, conventional) is far cheaper than hard money, and you eliminate utilities double-billing. But you must legitimately live there during rehab — IRS scrutinizes "live-in flips" that look like investment activity. Plan to stay 12+ months to qualify for the capital-gains exclusion.' },
      { q: 'Does the 70% rule include holding costs?', a: 'Yes, implicitly. The 30% margin in (ARV × 0.70) − Rehab is meant to cover closing both ways, commissions, holding costs (4–6 months), AND target profit. If your holding will exceed 6 months, drop the multiplier to 65% to maintain margin.' },
    ],
  },
  'rental-roi-calculator': {
    slug: 'rental-roi-calculator',
    name: 'Rental ROI Calculator',
    summary:
      "Return on investment (ROI) for rentals combines four components: cash flow (monthly net rent), principal paydown (mortgage equity built over time), appreciation (~4% annually average in U.S.), and tax depreciation. AIWholesail's free calculator combines all four into total ROI — typically 12–18% annualized for well-underwritten single-family rentals, higher with leverage.",
    steps: [
      { name: 'Enter property + financing details', text: 'Purchase price, down payment, interest rate, term. Calculator computes loan amount + amortization.' },
      { name: 'Enter monthly rent + vacancy + management', text: 'Current rent or comparable market rent. 5–8% vacancy. 8–10% management (or 0% if self-managing — but factor your time at $50/hr).' },
      { name: 'Fill operating expenses', text: 'Property tax, insurance, maintenance, capex reserve, HOA. Be conservative — under-budgeting these is how spreadsheets lie.' },
      { name: 'Set appreciation + depreciation assumptions', text: 'Appreciation: 4% U.S. average; adjust for market (hot markets 5–7%, cool markets 2–3%). Depreciation: 1/27.5 of building value (land excluded) per year — a non-cash tax deduction that shelters cash flow.' },
      { name: 'Read total ROI breakdown', text: 'Cash flow ROI + appreciation ROI + principal paydown ROI + tax savings ROI = total ROI. Typical buy-and-hold rentals: 12–18% annualized total ROI in year 1.' },
    ],
    faqs: [
      { q: 'How do you calculate rental property ROI?', a: 'Total ROI = (Annual Cash Flow + Annual Appreciation + Annual Principal Paydown + Annual Tax Savings) ÷ Cash Invested × 100. Cash invested = down payment + closing + rehab. Year 1 typical: 12–18% for solid single-family rentals; higher with leverage and value-add improvements.' },
      { q: 'What is a good ROI for rental properties?', a: '10–15% annualized total ROI is solid for buy-and-hold. 15–25% is excellent (usually requires BRRRR or value-add). Above 25% means you got an exceptional deal or you\'re including assumptions (high appreciation, full occupancy) that may not hold long-term.' },
      { q: 'Is cash-on-cash return the same as ROI?', a: 'No. Cash-on-cash return = annual cash flow ÷ cash invested (ignores appreciation, paydown, depreciation). Total ROI includes all four wealth-building mechanisms. Cash-on-cash measures short-term cash returns; total ROI measures wealth growth over the hold period.' },
      { q: 'How much should I assume for appreciation?', a: 'U.S. long-term average is ~4% nominal (CPI-adjusted closer to 1–2%). Hot markets (Austin, Tampa, Phoenix): 5–7% in growth years, but flat/negative in recessions. Cool markets (Memphis, Detroit, Cleveland): 2–3%. Use 3–4% as your base case to avoid over-modeling.' },
    ],
  },
  'mortgage-calculator': {
    slug: 'mortgage-calculator',
    name: 'Mortgage Calculator',
    summary:
      "AIWholesail's free mortgage calculator computes monthly payment (P&I), full amortization schedule, total interest over the loan, and effective LTV. Works for conventional, FHA, VA, DSCR, and hard money loans by adjusting the rate and term inputs. Use it before every offer to confirm the deal cash flows at current rates.",
    steps: [
      { name: 'Enter purchase price + down payment', text: 'Conventional investment: 20–25% down. FHA owner-occupied: 3.5%. DSCR: 20–25%. Hard money: 10–20% borrower equity. Use the right number for your loan type.' },
      { name: 'Enter interest rate', text: 'Current investment-property rates run 7.0–8.5% for conventional, 8.5–11% for DSCR, 10–14% for hard money. Check your pre-approval letter; don\'t guess.' },
      { name: 'Pick loan term', text: '30-year fixed for buy-and-hold rentals. 15-year for accelerated principal paydown (higher payment, less interest). 12-month interest-only for hard-money flip loans.' },
      { name: 'Read monthly payment + amortization', text: 'Calculator outputs P&I (principal + interest only). Add property tax, insurance, HOA separately for full PITI. Amortization schedule shows principal/interest split per year — useful for refinance and equity planning.' },
    ],
    faqs: [
      { q: 'What are current investment property mortgage rates?', a: 'Conventional 30-year investment loans: 7.0–8.5% (2026). DSCR loans: 8.5–11%. Hard money / fix-and-flip: 10–14%. Owner-occupied house hack with FHA: 6.5–7.5%. Rates change weekly — check with 2–3 lenders before locking.' },
      { q: 'How much down payment do I need for an investment property?', a: 'Conventional investment: 20–25%. FHA (owner-occupied only, 2–4 unit eligible for house-hacking): 3.5%. DSCR rental: 20–25%. Hard money: 10–20% borrower equity. VA loans: 0% down for owner-occupied multifamily up to 4 units (eligible veterans).' },
      { q: 'Should I use a 15 or 30 year mortgage for rentals?', a: '30-year fixed for buy-and-hold — maximizes monthly cash flow and lets inflation work for you. 15-year accelerates equity build but kills cash flow in years 1–10. Most buy-and-hold investors take 30-year and use the cash flow to fund the next purchase.' },
      { q: 'What is PITI?', a: 'P + I + T + I = Principal + Interest + Property Tax + Insurance. Sometimes "PITI" includes HOA dues. This is your total monthly housing cost — what cash flow analysis subtracts from rent to determine net cash flow. Mortgage calculators output P&I only; PITI requires adding T + I separately.' },
    ],
  },
};
