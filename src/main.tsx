import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { AuthProvider } from './contexts/AuthContext';
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import { captureAttribution } from './lib/marketing-attribution';
import { applyBrandBoldAttribute, BRAND_BOLD_FLAG } from './lib/brand-flags.js';
import { getFlagFromCache, refreshFeatureFlags } from './hooks/useFeatureFlag';

// First-touch attribution capture. Runs before React mounts so the UTM
// payload is in localStorage by the time any signup form reads it.
captureAttribution();

// Brand-bold flag-gate (#413 follow-up). Apply once at boot using whatever
// is in the flag cache (likely undefined on a cold load → default OFF),
// then re-apply after the first server fetch resolves so the attribute
// matches the DB row for the current user.
applyBrandBoldAttribute(
  document.documentElement,
  () => getFlagFromCache(BRAND_BOLD_FLAG),
);
refreshFeatureFlags()
  .then(() =>
    applyBrandBoldAttribute(
      document.documentElement,
      () => getFlagFromCache(BRAND_BOLD_FLAG),
    ),
  )
  .catch(() => {/* keep default-off on fetch failure */});

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <SubscriptionProvider>
      <App />
    </SubscriptionProvider>
  </AuthProvider>
);
