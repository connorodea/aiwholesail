import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { AuthProvider } from './contexts/AuthContext';
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import { captureAttribution } from './lib/marketing-attribution';

// First-touch attribution capture. Runs before React mounts so the UTM
// payload is in localStorage by the time any signup form reads it.
captureAttribution();

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <SubscriptionProvider>
      <App />
    </SubscriptionProvider>
  </AuthProvider>
);
