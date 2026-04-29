import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aiwholesail.app',
  appName: 'AIWholesail',
  webDir: 'dist',
  server: {
    // Native app uses absolute URLs to the production API
    // No proxy layer like the web version has
    androidScheme: 'https',
    iosScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#0B1120',
      showSpinner: false,
    },
    StatusBar: {
      style: 'Dark',
    },
  },
};

export default config;
