import { Capacitor } from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();
export const isIOS = Capacitor.getPlatform() === 'ios';
export const isWeb = !isNative;

/** In native apps there's no reverse proxy — use absolute API URLs */
export const API_BASE_URL = isNative
  ? 'https://api.aiwholesail.com'
  : (import.meta.env.VITE_API_URL || 'https://api.aiwholesail.com');
