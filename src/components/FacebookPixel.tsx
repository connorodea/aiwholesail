import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

declare global {
  interface Window {
    fbq: (command: string, ...args: any[]) => void;
    _fbq: any;
  }
}

// Facebook Pixel ID
const PIXEL_ID = '733914336084655';

export function FacebookPixel() {
  const location = useLocation();

  useEffect(() => {
    // Load Facebook Pixel script
    const script = document.createElement('script');
    script.innerHTML = `
      !function(f,b,e,v,n,t,s)
      {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s)}(window, document,'script',
      'https://connect.facebook.net/en_US/fbevents.js');
      fbq('init', '${PIXEL_ID}');
      fbq('track', 'PageView');
    `;
    document.head.appendChild(script);

    // Add noscript fallback
    const noscript = document.createElement('noscript');
    noscript.innerHTML = `<img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1" />`;
    document.body.insertBefore(noscript, document.body.firstChild);

    return () => {
      if (script.parentNode) document.head.removeChild(script);
      if (noscript.parentNode) noscript.parentNode.removeChild(noscript);
    };
  }, []);

  // Track page views on route changes
  useEffect(() => {
    if (typeof window !== 'undefined' && window.fbq) {
      window.fbq('track', 'PageView');
    }
  }, [location]);

  return null;
}

// Helper functions for tracking events
export const trackFacebookEvent = (eventName: string, parameters?: any) => {
  if (typeof window.fbq !== 'undefined') {
    window.fbq('track', eventName, parameters);
  }
};

export const trackFacebookCustomEvent = (eventName: string, parameters?: any) => {
  if (typeof window.fbq !== 'undefined') {
    window.fbq('trackCustom', eventName, parameters);
  }
};

export const trackFacebookPurchase = (value: number, currency: string = 'USD') => {
  if (typeof window.fbq !== 'undefined') {
    window.fbq('track', 'Purchase', {
      value: value,
      currency: currency
    });
  }
};

export const trackFacebookLead = () => {
  if (typeof window.fbq !== 'undefined') {
    window.fbq('track', 'Lead');
  }
};