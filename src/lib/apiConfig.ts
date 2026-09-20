// Sunucu Domain ve Port Adresi (DuckDNS SSL / Fallback / Mobil APK)
export const SERVER_HOST = 'dealcard.duckdns.org';
export const USE_HTTPS = true;

export function isDiscordActivity(): boolean {
  if (typeof window === 'undefined') return false;
  const isDiscordHost = window.location.hostname.endsWith('.discordsays.com');
  const hasFrameId = new URLSearchParams(window.location.search).has('frame_id');
  return isDiscordHost || (hasFrameId && window.parent !== window);
}

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    // Discord Activity on discordsays.com uses Discord's root URL mapping
    if (isDiscordActivity() && window.location.hostname.endsWith('.discordsays.com')) {
      return '';
    }

    // Check if we are running in a native mobile wrapper (Capacitor / Cordova)
    const isNativeApp = 
      (window as any).Capacitor || 
      (window as any).cordova || 
      window.location.protocol === 'capacitor:' || 
      window.location.protocol === 'app:';

    // If it's a web browser environment, always use relative paths
    if (!isNativeApp && (window.location.protocol.startsWith('http') || window.location.host)) {
      return '';
    }
  }

  // APK (Capacitor WebView) ve Build zamanında varsayılan olarak güncel sunucu adresini ver
  return `${USE_HTTPS ? 'https' : 'http'}://${SERVER_HOST}`;
}

export function getWsBaseUrl(): string {
  if (typeof window !== 'undefined') {
    if (isDiscordActivity() && window.location.hostname.endsWith('.discordsays.com')) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${window.location.host}`;
    }

    const isNativeApp = 
      (window as any).Capacitor || 
      (window as any).cordova || 
      window.location.protocol === 'capacitor:' || 
      window.location.protocol === 'app:';

    if (!isNativeApp && (window.location.protocol.startsWith('http') || window.location.host)) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${window.location.host}`;
    }
  }

  return `${USE_HTTPS ? 'wss' : 'ws'}://${SERVER_HOST}`;
}

export const API_BASE_URL = getApiBaseUrl();
export const WS_BASE_URL = getWsBaseUrl();

if (typeof window !== 'undefined') {
  console.log(`[apiConfig] API_BASE_URL: "${API_BASE_URL}", WS_BASE_URL: "${WS_BASE_URL}", isDiscord: ${isDiscordActivity()}`);
}


