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
 * Helper to race any promise with a timeout
 */
function withTimeout<T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errorMessage)), ms)),
  ]);
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

    // 1. Resolve Discord Client ID (env first, then config API)
    const apiBase = getApiBaseUrl();
    let clientId = (import.meta as any).env?.VITE_DISCORD_CLIENT_ID || '1551722975013773412';

    if (!clientId) {
      try {
        const configRes = await withTimeout(fetch(`${apiBase}/api/discord/config`), 2000, 'Config fetch timeout');
        if (configRes.ok) {
          const configData = await configRes.json();
          if (configData.clientId) {
            clientId = configData.clientId;
          }
        }
      } catch (e) {
        console.warn('[Discord SDK] Config fetch fallback:', e);
      }
    }

    // 2. Instantiate Discord SDK
    const discordSdk = new DiscordSDK(clientId);
    discordSdkInstance = discordSdk;

    // Ready handshake with Discord client (max 3.5s)
    try {
      await withTimeout(discordSdk.ready(), 3500, 'Discord ready() timeout');
      console.log('[Discord SDK] Ready! Channel:', discordSdk.channelId, 'Guild:', discordSdk.guildId);
    } catch (readyErr) {
      console.warn('[Discord SDK] ready() timed out or failed, continuing in fallback mode:', readyErr);
    }

    let code = '';
    // 3. Authorize via Discord OAuth2
    try {
      // Step 3a: Try silent authorization first (quick check if already consented)
      const silentAuth = await withTimeout(
        discordSdk.commands.authorize({
          client_id: clientId,
          response_type: 'code',
          state: '',
          prompt: 'none',
          scope: ['identify'],
        }),
        2500,
        'Silent authorize timeout'
      );
      code = silentAuth.code;
      console.log('[Discord SDK] Silent authorization successful!');
    } catch (silentErr) {
      console.log('[Discord SDK] Silent auth not available, requesting authorization modal...');
      try {
        // Step 3b: If not previously authorized, open Discord OAuth consent modal
        const promptAuth = await withTimeout(
          discordSdk.commands.authorize({
            client_id: clientId,
            response_type: 'code',
            state: '',
            scope: ['identify'],
          }),
          45000,
          'User authorize modal timeout or cancelled'
        );
        code = promptAuth.code;
        console.log('[Discord SDK] User modal authorization successful!');
      } catch (modalErr) {
        console.warn('[Discord SDK] Authorization modal skipped or rejected:', modalErr);
      }
    }

    // 4. Exchange code or create session on backend
    let userProfile: UserProfile | null = null;
    let accessToken = '';

    try {
      const tokenRes = await withTimeout(
        fetch(`${apiBase}/api/discord/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: code || undefined,
            channelId: discordSdk.channelId,
            guildId: discordSdk.guildId,
          }),
        }),
        8000,
        'Backend token exchange timeout'
      );

      if (tokenRes.ok) {
        const data = await tokenRes.json();
        userProfile = data.userProfile;
        accessToken = data.access_token;
      }
    } catch (backendErr) {
      console.warn('[Discord SDK] Backend sync failed, using local profile fallback:', backendErr);
    }

    // 5. Authenticate with Discord Client if token available
    if (accessToken) {
      try {
        const authClientRes = await withTimeout(
          discordSdk.commands.authenticate({ access_token: accessToken }),
          5000,
          'Authenticate timeout'
        );
        console.log('[Discord SDK] Authenticated successfully with Discord Client!', authClientRes);
        
        // Ensure user profile contains real Discord username and avatar
        if (authClientRes?.user && userProfile) {
          const authUser = authClientRes.user;
          const realName = (authUser.global_name || authUser.username || '').trim();
          if (realName) {
            userProfile.username = realName;
          }
          if (authUser.avatar) {
            const ext = authUser.avatar.startsWith('a_') ? 'gif' : 'png';
            userProfile.avatarUrl = `https://cdn.discordapp.com/avatars/${authUser.id}/${authUser.avatar}.${ext}?size=256`;
          }
        }
      } catch (authClientErr) {
        console.warn('[Discord SDK] authenticate command warning:', authClientErr);
      }
    }

    if (!userProfile) {
      // Create guest Discord profile if backend was unreachable
      const randomId = Math.floor(Math.random() * 9000 + 1000);
      userProfile = {
        id: `user-dc-${randomId}`,
        username: `Discord Oyuncusu #${randomId}`,
        coins: 1000,
        level: 1,
        xp: 0,
        avatarId: 'avatar_classic',
        friends: [],
        stats: {
          gamesPlayed: 0,
          gamesWon: 0,
          gamesLost: 0,
          winRate: 0,
          totalRentCollected: 0,
          totalCardsStolen: 0,
          totalSetsCompleted: 0,
          totalMoneyBanked: 0,
        },
        unlockedItems: ['avatar_classic', 'back_classic', 'theme_slate', 'frame_none', 'sound_classic'],
        settings: {
          soundVolume: 70,
          soundPitch: 1.0,
          synthType: 'sine',
          cardBack: 'back_classic',
          boardTheme: 'theme_slate',
          avatarId: 'avatar_classic',
          clothesId: 'clothes_classic',
          profileFrame: 'frame_none',
          celebrationSound: 'sound_classic',
          language: 'tr',
        },
        achievements: [],
        dailyQuests: [],
        gamesHistory: [],
      };
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
    console.error('[Discord SDK] Unexpected error in initializeDiscordActivity:', error);
    return null;
  }
}
