import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { AuthProvider } from './contexts/AuthContext';
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import { captureAttribution } from './lib/marketing-attribution';
import { initPostHog } from './lib/posthog';

// First-touch attribution capture. Runs before React mounts so the UTM
// payload is in localStorage by the time any signup form reads it.
captureAttribution();
// PostHog must init AFTER captureAttribution so the first autocapture'd
// pageview already sits behind a known distinct_id (which signup will
// later alias to the user.id). No-ops when VITE_POSTHOG_KEY is unset.
initPostHog();

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <SubscriptionProvider>
      <App />
    </SubscriptionProvider>
  </AuthProvider>
);
