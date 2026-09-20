import { DiscordSDK, patchUrlMappings } from '@discord/embedded-app-sdk';
import { UserProfile } from '../types';
import { getApiBaseUrl } from './apiConfig';

export interface DiscordSession {
  discordSdk: DiscordSDK;
  userProfile: UserProfile;
  channelId: string | null;
  guildId: string | null;
  instanceId: string;
}

let discordSdkInstance: DiscordSDK | null = null;
let activeSession: DiscordSession | null = null;

/**
 * Checks if current environment is inside a Discord Activity iframe
 */
export function isDiscordEmbedded(): boolean {
  if (typeof window === 'undefined') return false;
  
  const hasFrameId = new URLSearchParams(window.location.search).has('frame_id');
  const isDiscordSays = window.location.hostname.endsWith('.discordsays.com');
  const isInIframe = window.parent !== window;

  return isDiscordSays || (hasFrameId && isInIframe);
}

/**
 * Retrieves the current Discord SDK instance if initialized
 */
export function getDiscordSdk(): DiscordSDK | null {
  return discordSdkInstance;
}

/**
 * Retrieves the active Discord session
 */
export function getDiscordSession(): DiscordSession | null {
  return activeSession;
}

/**
 * Generates an automatic room name based on Discord Voice Channel
 */
export function getDiscordChannelRoomId(channelId?: string | null): string | null {
  if (!channelId) return null;
  return `dc_room_${channelId}`;
}

/**
 * Initializes Discord Embedded App SDK, authenticates with Discord,
 * and fetches/synchronizes the UserProfile with the backend.
 */
export async function initializeDiscordActivity(): Promise<DiscordSession | null> {
  if (!isDiscordEmbedded()) {
    return null;
  }

  try {
    console.log('[Discord SDK] Initializing Discord Activity session...');

    // 1. Fetch public Discord Client ID from backend
    const apiBase = getApiBaseUrl();
    let clientId = '';
    try {
      const configRes = await fetch(`${apiBase}/api/discord/config`);
      if (configRes.ok) {
        const configData = await configRes.json();
        clientId = configData.clientId || '';
      }
    } catch (e) {
      console.warn('[Discord SDK] Could not fetch discord config from backend:', e);
    }

    // Fallback client ID from environment or URL search params if present
    if (!clientId) {
      const urlParams = new URLSearchParams(window.location.search);
      clientId = urlParams.get('client_id') || (import.meta as any).env?.VITE_DISCORD_CLIENT_ID || '';
    }

    if (!clientId) {
      console.warn('[Discord SDK] No Discord Client ID configured on server or client.');
      return null;
    }

    // With Root Mapping configured in Developer Portal, all relative requests map automatically.

    // 2. Instantiate Discord SDK
    const discordSdk = new DiscordSDK(clientId);
    discordSdkInstance = discordSdk;

    await discordSdk.ready();
    console.log('[Discord SDK] Discord client is ready. Channel:', discordSdk.channelId, 'Guild:', discordSdk.guildId);

    // 3. Authorize via Discord OAuth2
    const { code } = await discordSdk.commands.authorize({
      client_id: clientId,
      response_type: 'code',
      state: '',
      prompt: 'none',
      scope: ['identify', 'guilds'],
    });

    // 4. Exchange code on backend for access_token & authenticated profile
    const tokenRes = await fetch(`${apiBase}/api/discord/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        channelId: discordSdk.channelId,
        guildId: discordSdk.guildId,
      }),
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      throw new Error(`Backend token exchange failed: ${errorText}`);
    }

    const { access_token, userProfile } = await tokenRes.json();

    // 5. Authenticate with Discord Client
    if (access_token) {
      await discordSdk.commands.authenticate({ access_token });
      console.log('[Discord SDK] Discord authentication completed successfully!');
    }

    activeSession = {
      discordSdk,
      userProfile,
      channelId: discordSdk.channelId,
      guildId: discordSdk.guildId,
      instanceId: discordSdk.instanceId,
    };

    return activeSession;
  } catch (error) {
    console.error('[Discord SDK] Failed to initialize Discord Activity:', error);
    return null;
  }
}
