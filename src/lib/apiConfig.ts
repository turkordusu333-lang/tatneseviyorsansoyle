// AWS EC2 Sunucu Adresi
export const SERVER_HOST = '16.170.166.112:3000';

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const port = window.location.port;

    // Doğrudan web tarayıcısından girildiğinde (örn: http://16.170.166.112:3000 veya yerel localhost:3000)
    if (hostname === '16.170.166.112' || port === '3000') {
      return '';
    }
  }

  // APK (Capacitor WebView) ve Build zamanında varsayılan olarak EC2 sunucu adresini ver
  return `http://${SERVER_HOST}`;
}

export function getWsBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const port = window.location.port;

    if (hostname === '16.170.166.112' || port === '3000') {
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

