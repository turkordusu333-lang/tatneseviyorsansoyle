import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.deal.master.pro',
  appName: 'Deal-Master-PRO',
  webDir: 'dist',
  backgroundColor: '#020617',
  server: {
    androidScheme: 'https',
    cleartext: true,
    allowNavigation: [
      "dealcard.duckdns.org",
      "*.duckdns.org",
      "*"
    ]
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    backgroundColor: '#020617',
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    }
  },
  plugins: {
    CapacitorCookies: {
      enabled: true,
    },
    CapacitorHttp: {
      enabled: true,
    },
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#020617',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    }
  }
};

export default config;


