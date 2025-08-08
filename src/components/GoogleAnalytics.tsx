import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

declare global {
  interface Window {
    gtag: (command: string, targetId: string, config?: any) => void;
  }
}

// Google Analytics Measurement ID - replace with your actual GA4 ID
const GA_MEASUREMENT_ID = 'G-XXXXXXXXXX'; // User needs to replace this

export function GoogleAnalytics() {
  const location = useLocation();

  useEffect(() => {
    // Load Google Analytics script
    const script1 = document.createElement('script');
    script1.async = true;
    script1.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    document.head.appendChild(script1);

    const script2 = document.createElement('script');
    script2.innerHTML = `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${GA_MEASUREMENT_ID}', {
        page_title: document.title,
        page_location: window.location.href,
      });
    `;
    document.head.appendChild(script2);

    // Clean up function
    return () => {
      document.head.removeChild(script1);
      document.head.removeChild(script2);
    };
  }, []);

  // Track page views on route changes
  useEffect(() => {
    if (typeof window.gtag !== 'undefined') {
      window.gtag('config', GA_MEASUREMENT_ID, {
        page_title: document.title,
        page_location: window.location.href,
        page_path: location.pathname,
      });
    }
  }, [location]);

  return null;
}

// Helper functions for tracking events
export const trackEvent = (eventName: string, parameters?: any) => {
  if (typeof window.gtag !== 'undefined') {
    window.gtag('event', eventName, parameters);
  }
};

export const trackConversion = (conversionId: string, value?: number) => {
  if (typeof window.gtag !== 'undefined') {
    window.gtag('event', 'conversion', {
      send_to: conversionId,
      value: value,
      currency: 'USD'
    });
  }
};

export const trackPurchase = (transactionId: string, value: number, items?: any[]) => {
  if (typeof window.gtag !== 'undefined') {
    window.gtag('event', 'purchase', {
      transaction_id: transactionId,
      value: value,
      currency: 'USD',
      items: items
    });
  }
};