import { events } from '@/lib/api-client';

/**
 * AIWholesail Analytics — Comprehensive Event Tracking
 *
 * GA4 Measurement ID: G-RDBNC7QBNB
 * GTM Container: GTM-NCS4QDFP
 *
 * All custom events fire to both GA4 (gtag) and GTM (dataLayer).
 * Configure conversion events in GA4 Admin → Events → Mark as conversion.
 *
 * RECOMMENDED CONVERSIONS (mark these in GA4 Admin):
 * - sign_up
 * - begin_trial
 * - begin_checkout
 * - purchase
 * - property_search
 * - lead_created
 * - contact_form_submit
 */

declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
    fbq: (command: string, ...args: any[]) => void;
  }
}

function fire(eventName: string, params?: Record<string, any>) {
  // GA4 gtag
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, params);
  }
  // GTM dataLayer
  if (typeof window !== 'undefined' && window.dataLayer) {
    window.dataLayer.push({ event: eventName, ...params });
  }
}

/** Fire a Facebook Pixel standard event (only if fbq is loaded) */
function fireFbq(eventName: string, params?: Record<string, any>) {
  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    if (params) {
      window.fbq('track', eventName, params);
    } else {
      window.fbq('track', eventName);
    }
  }
}

// ============ AUTH EVENTS ============

export const analytics = {
  /** User creates a new account */
  signUp(method: string = 'email') {
    fire('sign_up', { method });
    // CompleteRegistration is Meta's canonical signup event; Lead kept for
    // back-compat with existing custom audiences/conversion configs.
    fireFbq('CompleteRegistration', {
      content_name: 'sign_up',
      status: 'completed',
      method,
    });
    fireFbq('Lead', { content_name: 'sign_up', method });
  },

  /** User logs in */
  login(method: string = 'email') {
    fire('login', { method });
  },

  /** User starts free trial */
  beginTrial(plan: string) {
    fire('begin_trial', { plan, value: 0, currency: 'USD' });
    fireFbq('StartTrial', {
      content_name: plan,
      predicted_ltv: plan === 'Elite' ? 99 : 29,
      currency: 'USD',
      value: 0,
    });
  },

  // ============ CHECKOUT EVENTS ============

  /** User clicks "Start Free Trial" or pricing CTA */
  beginCheckout(plan: string, price: number) {
    fire('begin_checkout', {
      currency: 'USD',
      value: price,
      items: [{ item_name: plan, price, quantity: 1 }],
    });
    fireFbq('InitiateCheckout', {
      content_name: plan,
      currency: 'USD',
      value: price,
    });
  },

  /** User completes subscription purchase (paid conversion) */
  purchase(transactionId: string, plan: string, price: number) {
    fire('purchase', {
      transaction_id: transactionId,
      currency: 'USD',
      value: price,
      items: [{ item_name: plan, price, quantity: 1 }],
    });
    fireFbq('Purchase', {
      content_name: plan,
      content_type: 'subscription',
      currency: 'USD',
      value: price,
    });
    // Subscribe is Meta's dedicated SaaS subscription event — fires
    // alongside Purchase so either can be used as the optimization event.
    fireFbq('Subscribe', {
      content_name: plan,
      currency: 'USD',
      value: price,
      predicted_ltv: price * 12,
    });
  },

  /** User reaches the pricing page (high-intent ViewContent for FB optimization) */
  viewPricing() {
    fire('view_pricing');
    fireFbq('ViewContent', {
      content_name: 'Pricing',
      content_category: 'pricing',
      content_type: 'product_group',
    });
  },

  /** User views a paid-traffic landing page (cold traffic) */
  viewLandingPage(landingPageId: string) {
    fire('view_landing_page', { landing_page_id: landingPageId });
    fireFbq('ViewContent', {
      content_name: landingPageId,
      content_category: 'landing_page',
    });
  },

  /** User submits email on a cold-traffic LP (top-of-funnel lead) */
  leadCaptured(email: string, source: string) {
    fire('lead_captured', { source, email_domain: email.split('@')[1] || '' });
    fireFbq('Lead', { content_name: source, content_category: 'lp_email_capture' });
  },

  // ============ TRIAL LIFECYCLE EVENTS ============

  /** Trial countdown banner shown to user (impression) */
  trialCountdownBannerShown(daysRemaining: number) {
    fire('trial_countdown_banner_shown', { days_remaining: daysRemaining });
  },

  /** User's trial expired and the blocking modal was shown */
  trialExpired() {
    fire('trial_expired');
    fireFbq('Lead', { content_name: 'trial_expired', content_category: 'lifecycle' });
  },

  /**
   * User clicked an upgrade CTA. `source` identifies where:
   *   'banner' (in-app countdown) | 'modal' (expired modal) |
   *   'email_d-1' | 'email_d0' | 'email_d+1' | 'email_d+7' (lifecycle emails)
   */
  trialUpgradeClicked(source: 'banner' | 'modal' | 'email_d-1' | 'email_d0' | 'email_d+1' | 'email_d+7') {
    fire('trial_upgrade_clicked', { source });
    fireFbq('Lead', { content_name: 'trial_upgrade', content_category: source });
  },

  /** User completed a trial → paid upgrade (Stripe checkout success) */
  trialUpgradeCompleted(plan: string, price: number) {
    fire('trial_upgrade_completed', { plan, price, currency: 'USD' });
    fireFbq('Subscribe', { content_name: plan, currency: 'USD', value: price });
  },

  // ============ PROPERTY SEARCH EVENTS ============

  /** User performs a property search */
  propertySearch(location: string, filters?: Record<string, any>) {
    fire('property_search', {
      search_term: location,
      ...filters,
    });
    fireFbq('Search', { search_string: location });
    // Also log to our own user_events table — GA4/FB Pixel are for ads
    // attribution; the DB is what founder-hot-list and activation funnel
    // queries read from. Without this, the table stays near-empty.
    events.log('property_search', { location, ...(filters || {}) });
  },

  /** User views property details */
  viewProperty(propertyId: string, address: string, price?: number) {
    fire('view_item', {
      currency: 'USD',
      value: price || 0,
      items: [{ item_id: propertyId, item_name: address, price }],
    });
    fireFbq('ViewContent', {
      content_name: address,
      content_ids: [propertyId],
      content_type: 'property',
      currency: 'USD',
      value: price || 0,
    });
    events.log('property_viewed', { propertyId, address, price: price ?? null });
  },

  /** User adds property to favorites */
  addToFavorites(propertyId: string, address: string, price?: number) {
    fire('add_to_wishlist', {
      currency: 'USD',
      value: price || 0,
      items: [{ item_id: propertyId, item_name: address, price }],
    });
    fireFbq('AddToWishlist', {
      content_name: address,
      content_ids: [propertyId],
      content_type: 'property',
      currency: 'USD',
      value: price || 0,
    });
  },

  /** User adds property to deal pipeline */
  addToPipeline(propertyId: string, address: string) {
    fire('lead_created', {
      property_id: propertyId,
      address,
    });
    fireFbq('Lead', { content_name: address, content_category: 'deal_pipeline' });
  },

  // ============ DEAL PIPELINE EVENTS ============

  /** User moves deal to new stage */
  dealStageChange(dealId: string, fromStage: string, toStage: string) {
    fire('deal_stage_change', {
      deal_id: dealId,
      from_stage: fromStage,
      to_stage: toStage,
    });
  },

  /** User generates a contract */
  contractGenerated(contractType: string) {
    fire('contract_generated', { contract_type: contractType });
  },

  /** User starts a follow-up sequence */
  sequenceStarted(templateName: string) {
    fire('sequence_started', { template_name: templateName });
  },

  // ============ BUYER EVENTS ============

  /** User adds a buyer */
  buyerAdded() {
    fire('buyer_added');
  },

  /** User matches buyers to a property */
  buyerMatch(propertyId: string, matchCount: number) {
    fire('buyer_match', { property_id: propertyId, match_count: matchCount });
  },

  // ============ TOOL USAGE EVENTS ============

  /** User uses a free calculator tool */
  toolUsed(toolName: string) {
    fire('tool_used', { tool_name: toolName });
  },

  // ============ CONTENT EVENTS ============

  /** User reads a blog article */
  articleRead(slug: string, title: string) {
    fire('article_read', { article_slug: slug, article_title: title });
  },

  /** User views a market page */
  marketViewed(city: string, state: string) {
    fire('market_viewed', { city, state });
  },

  /** User views a competitor comparison */
  comparisonViewed(competitor: string) {
    fire('comparison_viewed', { competitor });
  },

  // ============ ENGAGEMENT EVENTS ============

  /** User submits contact form */
  contactFormSubmit() {
    fire('contact_form_submit');
    fireFbq('Lead', { content_name: 'contact_form' });
  },

  /** User clicks CTA button */
  ctaClick(ctaName: string, location: string) {
    fire('cta_click', { cta_name: ctaName, cta_location: location });
  },

  /** User watches demo video */
  watchDemo() {
    fire('watch_demo');
  },

  /** User toggles light/dark mode */
  themeToggle(theme: string) {
    fire('theme_toggle', { theme });
  },

  /** User exports data (CSV, PDF) */
  dataExport(exportType: string, itemCount: number) {
    fire('data_export', { export_type: exportType, item_count: itemCount });
  },

  /** User uses AI chat assistant */
  aiChatMessage() {
    fire('ai_chat_message');
  },

  /** User runs AI property analysis */
  aiAnalysis(propertyId: string) {
    fire('ai_analysis', { property_id: propertyId });
  },
};
