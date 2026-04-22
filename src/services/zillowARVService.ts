const ZILLOW_API_URL = import.meta.env.VITE_ZILLOW_API_URL || 'https://api.aiwholesail.com/zillow';

export interface PropertyParams {
  byzpid?: string;
  byurl?: string;
  byaddress?: string;
  bylotid?: string;
  zpid?: string;
}

export interface ARVScenario {
  multiplier: number;
  mao: number;
}

export interface ARVResult {
  arv: number;
  ppsf: number;
  repairEstimate: number;
  scenarios: ARVScenario[];
}

/**
 * Auto Repair Estimate Function
 * @param sqft - property square footage
 * @param condition - "light", "medium", "heavy"
 */
function estimateRepairs(sqft: number, condition: "light" | "medium" | "heavy"): number {
  const costPerSqFt = {
    light: 15,   // paint, flooring, cosmetics
    medium: 30,  // kitchens, baths, roof
    heavy: 50,   // full gut rehab
  };
  return sqft * costPerSqFt[condition];
}

/**
 * Get comparable homes via Hetzner API
 */
export async function getComparableHomes(params: PropertyParams) {
  // Use zpid if available, otherwise try byzpid
  const zpid = params.zpid || params.byzpid;

  if (!zpid) {
    throw new Error('ZPID is required for comparable homes lookup');
  }

  const response = await fetch(ZILLOW_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'comps',
      searchParams: { zpid }
    })
  });

  if (!response.ok) {
    console.error('❌ Error fetching comparable homes:', response.statusText);
    throw new Error(`Failed to fetch comparable homes: ${response.statusText}`);
  }

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch comparable homes');
  }

  return data?.data;
}

/**
 * Calculate ARV with Multiple MAO Scenarios
 */
export async function calculateARVFull(
  params: PropertyParams,
  condition: "light" | "medium" | "heavy" = "medium"
): Promise<ARVResult> {
  const compsData: any = await getComparableHomes(params);

  if (!compsData || !Array.isArray(compsData.comps) || compsData.comps.length === 0) {
    throw new Error("No comps found for ARV calculation.");
  }

  // Extract PPSF from valid comps
  const ppsfList = compsData.comps
    .filter((comp: any) => comp.price && comp.sqft && comp.sqft > 0)
    .map((comp: any) => comp.price / comp.sqft);

  if (ppsfList.length === 0) {
    throw new Error("No valid PPSF data from comps.");
  }

  const avgPPSF = ppsfList.reduce((sum: number, val: number) => sum + val, 0) / ppsfList.length;

  // Subject property square footage
  const subjectSqFt = compsData.subject?.sqft || compsData.comps[0]?.sqft || 0;
  const arv = avgPPSF * subjectSqFt;

  // Auto repair cost estimate
  const repairEstimate = estimateRepairs(subjectSqFt, condition);

  // Multiple MAO scenarios
  const multipliers = [0.65, 0.70, 0.75];
  const scenarios = multipliers.map(multiplier => ({
    multiplier,
    mao: Math.max(Math.round((arv * multiplier) - repairEstimate), 0),
  }));

  return {
    arv: Math.round(arv),
    ppsf: Math.round(avgPPSF),
    repairEstimate,
    scenarios,
  };
}