import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { zillowAPI } from '@/lib/zillow-api';
import type { Property } from '@/types/zillow';
import { Banknote, Percent, RefreshCw, AlertTriangle, Calendar } from 'lucide-react';

/**
 * Live mortgage rates + monthly-payment estimator for the property.
 *
 * Calls TWO Zillow Scraper endpoints lazily on first render:
 *   - /v1/mortgage-rates  → current 30yr / 15yr / 5/1 ARM market rates
 *   - /v1/mortgage        → property-specific payment estimate (Zillow's
 *                            calc, includes taxes + insurance estimate)
 *
 * Either can fail independently — the section renders whatever it
 * has. If both fail, falls back to a basic client-side calc using
 * the property price and a stock 7.0% rate / 20% down assumption.
 */

interface MortgageRates {
  thirtyYearFixed?: number;
  fifteenYearFixed?: number;
  fiveOneArm?: number;
  asOf?: string;
}

interface MortgageDetail {
  monthlyPayment?: number;
  principalAndInterest?: number;
  propertyTax?: number;
  homeInsurance?: number;
  hoaFees?: number;
  mortgageInsurance?: number;
  downPaymentAmount?: number;
  downPaymentPercent?: number;
  loanAmount?: number;
  interestRate?: number;
  loanTerm?: number;
}

function readNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[%$,]/g, ''));
    return isFinite(n) ? n : undefined;
  }
  return undefined;
}

function normalizeRates(raw: unknown): MortgageRates {
  if (!raw || typeof raw !== 'object') return {};
  const d = raw as Record<string, unknown>;
  const root = (d.rates ?? d.data ?? d) as Record<string, unknown>;
  return {
    thirtyYearFixed: readNumber(root.thirtyYearFixed) ?? readNumber(root.thirty_year) ?? readNumber(root['30yr']),
    fifteenYearFixed: readNumber(root.fifteenYearFixed) ?? readNumber(root.fifteen_year) ?? readNumber(root['15yr']),
    fiveOneArm: readNumber(root.fiveOneArm) ?? readNumber(root.five_one_arm) ?? readNumber(root['5/1arm']),
    asOf: typeof root.asOf === 'string' ? root.asOf : (typeof root.updated === 'string' ? root.updated : undefined),
  };
}

function normalizeDetail(raw: unknown): MortgageDetail {
  if (!raw || typeof raw !== 'object') return {};
  const d = raw as Record<string, unknown>;
  const root = (d.mortgage ?? d.payment ?? d.data ?? d) as Record<string, unknown>;
  return {
    monthlyPayment: readNumber(root.monthlyPayment) ?? readNumber(root.monthly_payment) ?? readNumber(root.total),
    principalAndInterest: readNumber(root.principalAndInterest) ?? readNumber(root.principal_and_interest) ?? readNumber(root.piti) ?? readNumber(root.pAndI),
    propertyTax: readNumber(root.propertyTax) ?? readNumber(root.property_tax) ?? readNumber(root.taxes),
    homeInsurance: readNumber(root.homeInsurance) ?? readNumber(root.home_insurance) ?? readNumber(root.insurance),
    hoaFees: readNumber(root.hoaFees) ?? readNumber(root.hoa),
    mortgageInsurance: readNumber(root.mortgageInsurance) ?? readNumber(root.pmi),
    downPaymentAmount: readNumber(root.downPaymentAmount) ?? readNumber(root.down_payment),
    downPaymentPercent: readNumber(root.downPaymentPercent) ?? readNumber(root.down_payment_percent),
    loanAmount: readNumber(root.loanAmount) ?? readNumber(root.loan_amount),
    interestRate: readNumber(root.interestRate) ?? readNumber(root.interest_rate) ?? readNumber(root.rate),
    loanTerm: readNumber(root.loanTerm) ?? readNumber(root.loan_term),
  };
}

/** Client-side fallback when Zillow's mortgage endpoint is unavailable. */
function clientFallbackPayment(price: number, ratePct = 7.0, termYears = 30, downPct = 20): MortgageDetail {
  const down = (price * downPct) / 100;
  const principal = price - down;
  const r = ratePct / 100 / 12;
  const n = termYears * 12;
  // Standard amortization: M = P * r(1+r)^n / ((1+r)^n - 1)
  const factor = Math.pow(1 + r, n);
  const pi = (principal * r * factor) / (factor - 1);
  const tax = (price * 0.012) / 12;
  const ins = (price * 0.005) / 12;
  return {
    monthlyPayment: Math.round(pi + tax + ins),
    principalAndInterest: Math.round(pi),
    propertyTax: Math.round(tax),
    homeInsurance: Math.round(ins),
    downPaymentAmount: Math.round(down),
    downPaymentPercent: downPct,
    loanAmount: Math.round(principal),
    interestRate: ratePct,
    loanTerm: termYears,
  };
}

const fmtCurrency = (val?: number) =>
  val != null
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val)
    : '—';
const fmtPct = (val?: number) => (val != null ? `${val.toFixed(2)}%` : '—');

export function PropertyMortgageSection({ property }: { property: Property }) {
  const zpid = property.zpid || property.id;
  const [loading, setLoading] = useState(true);
  const [rates, setRates] = useState<MortgageRates>({});
  const [detail, setDetail] = useState<MortgageDetail>({});
  const [usedFallback, setUsedFallback] = useState(false);

  useEffect(() => {
    if (!zpid) {
      // No zpid → fallback only
      if (property.price) {
        setDetail(clientFallbackPayment(property.price));
        setUsedFallback(true);
      }
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const [ratesRes, detailRes] = await Promise.allSettled([
        zillowAPI.getMortgageRates(String(zpid)),
        zillowAPI.getMortgage(String(zpid)),
      ]);
      if (cancelled) return;
      if (ratesRes.status === 'fulfilled') {
        setRates(normalizeRates(ratesRes.value));
      }
      if (detailRes.status === 'fulfilled') {
        const d = normalizeDetail(detailRes.value);
        // If upstream returned nothing usable, fall back
        if (!d.monthlyPayment && !d.principalAndInterest) {
          if (property.price) {
            setDetail(clientFallbackPayment(property.price));
            setUsedFallback(true);
          }
        } else {
          setDetail(d);
        }
      } else if (property.price) {
        setDetail(clientFallbackPayment(property.price));
        setUsedFallback(true);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [zpid, property.price]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <RefreshCw className="h-4 w-4 animate-spin mr-2" /> Loading mortgage data…
      </div>
    );
  }

  const total =
    detail.monthlyPayment ??
    [detail.principalAndInterest, detail.propertyTax, detail.homeInsurance, detail.hoaFees, detail.mortgageInsurance]
      .filter((n): n is number => typeof n === 'number')
      .reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Banknote className="h-4 w-4 text-primary" />
            Estimated Monthly Payment
            {usedFallback && (
              <Badge variant="outline" className="text-[10px] gap-1 ml-auto">
                <AlertTriangle className="h-3 w-3" />
                Estimated (7% / 20% down)
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {total > 0 && (
            <div className="text-center py-2">
              <div className="text-3xl font-bold text-foreground">{fmtCurrency(total)}</div>
              <div className="text-xs text-muted-foreground mt-1">per month, all-in</div>
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
            <PaymentLine label="Principal & Interest" value={detail.principalAndInterest} />
            <PaymentLine label="Property Tax" value={detail.propertyTax} />
            <PaymentLine label="Home Insurance" value={detail.homeInsurance} />
            {detail.hoaFees != null && detail.hoaFees > 0 && (
              <PaymentLine label="HOA Fees" value={detail.hoaFees} />
            )}
            {detail.mortgageInsurance != null && detail.mortgageInsurance > 0 && (
              <PaymentLine label="PMI" value={detail.mortgageInsurance} />
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-3 border-t border-border/40">
            <Stat icon={Banknote} label="Down" value={fmtCurrency(detail.downPaymentAmount)} sub={detail.downPaymentPercent != null ? `${detail.downPaymentPercent.toFixed(0)}%` : undefined} />
            <Stat icon={Banknote} label="Loan" value={fmtCurrency(detail.loanAmount)} />
            <Stat icon={Percent} label="Rate" value={fmtPct(detail.interestRate)} />
            <Stat icon={Calendar} label="Term" value={detail.loanTerm != null ? `${detail.loanTerm} yr` : '—'} />
          </div>
        </CardContent>
      </Card>

      {(rates.thirtyYearFixed || rates.fifteenYearFixed || rates.fiveOneArm) && (
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Percent className="h-4 w-4 text-primary" />
              Current Market Rates
              {rates.asOf && <span className="ml-auto text-xs text-muted-foreground font-normal">as of {rates.asOf}</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 text-center">
              <RateTile label="30yr fixed" rate={rates.thirtyYearFixed} />
              <RateTile label="15yr fixed" rate={rates.fifteenYearFixed} />
              <RateTile label="5/1 ARM" rate={rates.fiveOneArm} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PaymentLine({ label, value }: { label: string; value?: number }) {
  return (
    <div className="flex justify-between items-baseline py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{fmtCurrency(value)}</span>
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub?: string }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1 text-muted-foreground"><Icon className="h-3 w-3" /> {label}</div>
      <div className="font-medium text-sm">{value}{sub ? ` (${sub})` : ''}</div>
    </div>
  );
}

function RateTile({ label, rate }: { label: string; rate?: number }) {
  return (
    <div>
      <div className="text-2xl font-bold">{fmtPct(rate)}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}
