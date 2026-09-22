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
    // 3. Authorize via Discord OAuth2 (wait up to 90 seconds for user to click 'Yetkilendir / Authorize')
    try {
      console.log('[Discord SDK] Requesting OAuth2 authorization modal...');
      const authResult = await withTimeout(
        discordSdk.commands.authorize({
          client_id: clientId,
          response_type: 'code',
          state: '',
          prompt: 'none',
          scope: ['identify'],
        }),
        90000,
        'Authorize modal timeout'
      );
      code = authResult.code;
      console.log('[Discord SDK] Authorize code received successfully!');
    } catch (authErr) {
      console.warn('[Discord SDK] Authorize cancelled, timed out or skipped:', authErr);
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
        10000,
        'Backend token exchange timeout'
      );

      if (tokenRes.ok) {
        const data = await tokenRes.json();
        userProfile = data.userProfile;
        accessToken = data.access_token;
        if (data.authError) {
          console.error('[Discord SDK] Backend OAuth error from Discord API:', data.authError);
        }
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

    // 6. Once authenticated, we can safely query connected participants
    try {
      const participantsRes = await withTimeout(
        discordSdk.commands.getInstanceConnectedParticipants(),
        3000,
        'Participants fetch timeout'
      );
      if (participantsRes?.participants && participantsRes.participants.length > 0 && userProfile) {
        const p = participantsRes.participants[0];
        if (p && (userProfile.username.includes('Discord Oyuncusu') || userProfile.username.startsWith('DiscordPlayer_'))) {
          const realName = (p.global_name || p.nickname || p.username || '').trim();
          if (realName) {
            userProfile.username = realName;
          }
          if (p.avatar) {
            const ext = p.avatar.startsWith('a_') ? 'gif' : 'png';
            userProfile.avatarUrl = `https://cdn.discordapp.com/avatars/${p.id}/${p.avatar}.${ext}?size=256`;
          }
        }
      }
    } catch (pErr) {
      // Ignored if not yet authenticated
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
