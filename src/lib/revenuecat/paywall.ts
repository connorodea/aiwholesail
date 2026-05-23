import { RevenueCatUI, PAYWALL_RESULT } from '@revenuecat/purchases-capacitor-ui';

import { REVENUECAT_PRO_ENTITLEMENT } from './config';
import { ensureConfigured } from './client';

export type PaywallOutcome = 'purchased' | 'restored' | 'cancelled' | 'unavailable' | 'error';

function mapResult(result: PAYWALL_RESULT): PaywallOutcome {
  switch (result) {
    case PAYWALL_RESULT.PURCHASED:
      return 'purchased';
    case PAYWALL_RESULT.RESTORED:
      return 'restored';
    case PAYWALL_RESULT.CANCELLED:
      return 'cancelled';
    case PAYWALL_RESULT.NOT_PRESENTED:
      return 'unavailable';
    case PAYWALL_RESULT.ERROR:
    default:
      return 'error';
  }
}

export async function presentPaywall(): Promise<PaywallOutcome> {
  const configured = await ensureConfigured();
  if (!configured) return 'unavailable';
  try {
    const { result } = await RevenueCatUI.presentPaywall();
    return mapResult(result);
  } catch (err) {
    console.error('[RevenueCat] presentPaywall failed', err);
    return 'error';
  }
}

export async function presentPaywallIfNeeded(
  entitlement: string = REVENUECAT_PRO_ENTITLEMENT,
): Promise<PaywallOutcome> {
  const configured = await ensureConfigured();
  if (!configured) return 'unavailable';
  try {
    const { result } = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: entitlement,
    });
    return mapResult(result);
  } catch (err) {
    console.error('[RevenueCat] presentPaywallIfNeeded failed', err);
    return 'error';
  }
}

export async function presentCustomerCenter(): Promise<void> {
  const configured = await ensureConfigured();
  if (!configured) return;
  try {
    await RevenueCatUI.presentCustomerCenter();
  } catch (err) {
    console.error('[RevenueCat] presentCustomerCenter failed', err);
  }
}
