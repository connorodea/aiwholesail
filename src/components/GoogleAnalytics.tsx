import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

declare global {
  interface Window {
    gtag: (command: string, targetId: string, config?: any) => void;
    dataLayer: any[];
  }
}

// Google Tag Manager ID
const GTM_ID = 'GTM-NCS4QDFP';

export function GoogleAnalytics() {
  const location = useLocation();

  useEffect(() => {
    // Load Google Tag Manager script
    const script = document.createElement('script');
    script.innerHTML = `
      (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
      new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
      j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
      'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
      })(window,document,'script','dataLayer','${GTM_ID}');
    `;
    document.head.appendChild(script);

    // Add noscript fallback
    const noscript = document.createElement('noscript');
    noscript.innerHTML = '<iframe src="https://www.googletagmanager.com/ns.html?id=${GTM_ID}" height="0" width="0" style="display:none;visibility:hidden"></iframe>';
    document.body.insertBefore(noscript, document.body.firstChild);

    return () => {
      document.head.removeChild(script);
      if (noscript.parentNode) noscript.parentNode.removeChild(noscript);
    };
  }, []);

  // Track page views on route changes
  useEffect(() => {
    if (typeof window !== 'undefined' && window.dataLayer) {
      window.dataLayer.push({
        event: 'page_view',
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