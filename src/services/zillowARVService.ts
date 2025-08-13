import { supabase } from "@/integrations/supabase/client";

export interface PropertyParams {
  byzpid?: string;
  byurl?: string;
  byaddress?: string;
  bylotid?: string;
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
 * Get comparable homes via Supabase edge function
 */
export async function getComparableHomes(params: PropertyParams) {
  const { data, error } = await supabase.functions.invoke('get-zillow-data', {
    body: {
      action: 'comparableHomes',
      searchParams: params
    }
  });

  if (error) {
    console.error('❌ Error fetching comparable homes:', error);
    throw error;
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