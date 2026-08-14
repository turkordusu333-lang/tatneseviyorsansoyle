import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.deal.master.pro',
  appName: 'Deal-Master-PRO',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
    allowNavigation: [
      "dealcard.duckdns.org",
      "*.duckdns.org",
      "*"
    ]
  }
};

export default config;


