// AWS EC2 Sunucu Adresi (fallback)
export const SERVER_HOST = '16.170.166.112:3000';

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
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

  // APK (Capacitor WebView) ve Build zamanında varsayılan olarak EC2 sunucu adresini ver
  return `http://${SERVER_HOST}`;
}

export function getWsBaseUrl(): string {
  if (typeof window !== 'undefined') {
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

  return `ws://${SERVER_HOST}`;
}

export const API_BASE_URL = getApiBaseUrl();
export const WS_BASE_URL = getWsBaseUrl();

if (typeof window !== 'undefined') {
  console.log(`[apiConfig] API_BASE_URL: "${API_BASE_URL}", WS_BASE_URL: "${WS_BASE_URL}"`);
}

