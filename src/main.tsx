import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { AuthProvider } from './contexts/AuthContext';
import { SubscriptionProvider } from './contexts/SubscriptionContext';

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <SubscriptionProvider>
      <App />
    </SubscriptionProvider>
  </AuthProvider>
);
