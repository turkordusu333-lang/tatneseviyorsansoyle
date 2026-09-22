import React, { Component } from 'react';
import { UserProfile } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { MainMenu } from './components/MainMenu';
import { GameRoom } from './components/GameRoom';
import { sounds } from './lib/SoundSystem';
import { initTranslations, addTranslationListener, t, changeLanguage } from './lib/TranslationSystem';
import { API_BASE_URL } from './lib/apiConfig';
import { GlobalToast } from './components/GlobalToast';
import { STORE_ITEMS } from './components/ShopDialog';
import { loadShopItems } from './lib/shopItemsStore';
import { PrivacyAndDeleteAccountPages } from './components/PrivacyAndDeleteAccountPages';
import { AdMobBanner } from './components/AdMobBanner';
import { AvatarWithFrame } from './components/AvatarWithFrame';
import { getOrCreateLocalProfile, saveLocalProfile } from './lib/offlineManager';
import { isDiscordEmbedded, initializeDiscordActivity, getDiscordChannelRoomId, DiscordSession } from './lib/discordSdk';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  onReset: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class GameRoomErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      const isEn = localStorage.getItem('language') === 'en';
      return (
        <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-center space-y-4 z-50 text-white font-sans">
          <div className="w-16 h-16 border-4 border-t-transparent border-amber-500 rounded-full animate-spin" />
          <h2 className="text-xl font-black text-amber-400 uppercase tracking-widest">
            {isEn ? 'Restoring Session...' : 'Bağlantı Yenileniyor...'}
          </h2>
          <p className="text-xs text-slate-400 max-w-xs">
            {isEn
              ? 'An interface issue was detected. Your game session is being automatically recovered.'
              : 'Bir arayüz hatası algılandı. Oyun durumunuz sunucu üzerinden otomatik olarak kurtarılıyor.'}
          </p>
          <button
            onClick={() => {
              (this as any).setState({ hasError: false });
              (this as any).props.onReset();
            }}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs transition-all cursor-pointer shadow-lg"
          >
            {isEn ? 'Reconnect' : 'Yeniden Bağlan'}
          </button>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

export interface SavedAccount {
  id?: string;
  username: string;
  password?: string;
  avatarId?: string;
  avatarUrl?: string;
  profileFrame?: string;
  level?: number;
  coins?: number;
  lastLogin: number;
}

export default function App() {
  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [usernameInput, setUsernameInput] = React.useState(() => {
    return localStorage.getItem('last_logged_username') || '';
  });
  const [passwordInput, setPasswordInput] = React.useState(''); // Password field to secure nicknames
  const [savedAccounts, setSavedAccounts] = React.useState<SavedAccount[]>(() => {
    try {
      const raw = localStorage.getItem('mono_deal_saved_accounts');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return [];
  });
  const [rememberAccount, setRememberAccount] = React.useState<boolean>(true);
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [adminSettings, setAdminSettings] = React.useState<any>(null);

  // Navigation & Arena states
  const [currentRoom, setCurrentRoom] = React.useState<{ roomId: string; isOffline: boolean; password?: string } | null>(null);
  const [isArenaCollapsed, setIsArenaCollapsed] = React.useState(false);

  // Transition states for card flip
  const [isFlippingTransition, setIsFlippingTransition] = React.useState(false);

  // Translation update listener state
  const [translationVersion, setTranslationVersion] = React.useState(0);

  const [discordSession, setDiscordSession] = React.useState<DiscordSession | null>(null);
  const [isDiscordConnecting, setIsDiscordConnecting] = React.useState<boolean>(() => isDiscordEmbedded());

  // Discord Embedded App SDK Lifecycle
  React.useEffect(() => {
    if (!isDiscordEmbedded()) return;

    let isMounted = true;
    setIsDiscordConnecting(true);

    initializeDiscordActivity()
      .then((session) => {
        if (!isMounted) return;
        if (session && session.userProfile) {
          setDiscordSession(session);
          setProfile(session.userProfile);
          setIsOfflineMode(false);
          saveLocalProfile(session.userProfile);
          sounds.playCoin(session.userProfile.settings);

          // If launched from a Discord voice/text channel, automatically join channel's match room!
          if (session.channelId) {
            const dcRoomId = getDiscordChannelRoomId(session.channelId);
            if (dcRoomId) {
              setCurrentRoom({ roomId: dcRoomId, isOffline: false });
            }
          }
        } else {
          const fallbackUser = getOrCreateLocalProfile('Discord Oyuncusu');
          setProfile(fallbackUser);
        }
      })
      .catch((err) => {
        console.error('[Discord SDK] Error during activity initialization:', err);
        const fallbackUser = getOrCreateLocalProfile('Discord Oyuncusu');
        setProfile(fallbackUser);
      })
      .finally(() => {
        if (isMounted) {
          setIsDiscordConnecting(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  React.useEffect(() => {
    return addTranslationListener(() => setTranslationVersion((v) => v + 1));
  }, []);

  // Pathname routing state for standalone Google Play pages (/delete-account, /privacy-policy)
  const [pathname, setPathname] = React.useState(window.location.pathname);

  React.useEffect(() => {
    const handlePopState = () => {
      setPathname(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Android Capacitor Hardware Back Button & Lifecycle Handling
  React.useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let lastBackPress = 0;
    const backListener = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      // 1. If currently in a game room, confirm before leaving to prevent accidental loss
      if (currentRoom) {
        const isEn = profile?.settings?.language === 'en';
        const confirmExit = window.confirm(
          isEn
            ? 'Are you sure you want to leave the active match?'
            : 'Mevcut oyundan ayrılmak istediğinize emin misiniz?'
        );
        if (confirmExit) {
          setCurrentRoom(null);
        }
        return;
      }

      // 2. If browser/web history can go back
      if (canGoBack) {
        window.history.back();
        return;
      }

      // 3. Double press back button within 2 seconds to safely exit app
      const now = Date.now();
      if (now - lastBackPress < 2000) {
        CapacitorApp.exitApp();
      } else {
        lastBackPress = now;
        const isEn = profile?.settings?.language === 'en';
        window.dispatchEvent(
          new CustomEvent('show-global-toast', {
            detail: {
              type: 'info',
              title: isEn ? 'Exit App' : 'Çıkış',
              message: isEn ? 'Press back again to exit' : 'Çıkmak için tekrar geri tuşuna basın',
              emoji: '👋',
            },
          })
        );
      }
    });

    // App state listener for background/foreground pause
    const appStateListener = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) {
        try {
          sounds.stopMusic();
        } catch (_) {}
      } else {
        try {
          sounds.resumeAudioContext();
          if (profile?.settings && profile.settings.gameMusic !== 'music_none') {
            sounds.startMusic(profile.settings);
          }
        } catch (_) {}
      }
    });

    return () => {
      backListener.then((l) => l.remove()).catch(() => {});
      appStateListener.then((l) => l.remove()).catch(() => {});
    };
  }, [currentRoom, profile]);

  // Fetch admin settings & translations on mount
  React.useEffect(() => {
    fetch(`${API_BASE_URL}/api/admin/settings`)
      .then((res) => {
        if (res.ok) return res.json();
      })
      .then((data) => {
        if (data) setAdminSettings(data);
      })
      .catch(console.error);

    loadShopItems();
    initTranslations();
    const unsubscribe = addTranslationListener(() => {
      setTranslationVersion((v) => v + 1);
    });
    return () => unsubscribe();
  }, []);

  // Sync profile language to localStorage
  React.useEffect(() => {
    if (profile?.settings?.language) {
      localStorage.setItem('language', profile.settings.language);
      initTranslations();
    }
  }, [profile]);

  // Track achievement and item unlock state changes for live corner notifications!
  const prevAchievementsRef = React.useRef<any[]>([]);
  const prevUnlockedItemsRef = React.useRef<string[]>([]);

  React.useEffect(() => {
    if (profile) {
      // 1. Achievements tracking
      if (prevAchievementsRef.current && prevAchievementsRef.current.length > 0) {
        profile.achievements.forEach((ach) => {
          const prevAch = prevAchievementsRef.current.find((pa) => pa.id === ach.id);
          if (prevAch && !prevAch.completed && ach.completed) {
            window.dispatchEvent(
              new CustomEvent('show-global-toast', {
                detail: {
                  type: 'achievement',
                  title: profile.settings.language === 'en' ? '🏆 Achievement Unlocked!' : '🏆 Başarım Kilidi Açıldı!',
                  message: ach.title,
                  description: ach.description,
                  rewardCoins: ach.rewardCoins,
                  emoji: '🏆',
                },
              })
            );
          }
        });
      }
      prevAchievementsRef.current = JSON.parse(JSON.stringify(profile.achievements || []));

      // 2. Unlocked items tracking
      if (prevUnlockedItemsRef.current && prevUnlockedItemsRef.current.length > 0) {
        profile.unlockedItems.forEach((itemId) => {
          if (!prevUnlockedItemsRef.current.includes(itemId)) {
            const storeItem = STORE_ITEMS.find((item) => item.id === itemId);
            if (storeItem) {
              window.dispatchEvent(
                new CustomEvent('show-global-toast', {
                  detail: {
                    type: 'unlock',
                    title: profile.settings.language === 'en' ? '✨ New Item Unlocked!' : '✨ Yeni Öğe Kilidi Açıldı!',
                    message: storeItem.name,
                    description: storeItem.description,
                    category: storeItem.category,
                    itemId: storeItem.id,
                    emoji:
                      storeItem.category === 'board_theme'
                        ? '🎨'
                        : storeItem.category === 'card_skin'
                        ? '🃏'
                        : storeItem.category === 'card_back'
                        ? '🎴'
                        : storeItem.category === 'avatar'
                        ? '👤'
                        : '🎁',
                  },
                })
              );
            }
          }
        });
      }
      prevUnlockedItemsRef.current = [...(profile.unlockedItems || [])];
    }
  }, [profile]);

  // Offline mode state flag
  const [isOfflineMode, setIsOfflineMode] = React.useState<boolean>(false);

  // Direct 100% Offline Login Handler
  const handleOfflineLogin = (customName?: string) => {
    const isEn = (localStorage.getItem('language') || 'tr') === 'en';
    const defaultName = isEn ? 'Offline Player' : 'Çevrimdışı Oyuncu';
    const rawName = customName && customName.trim() ? customName.trim() : (usernameInput.trim() || defaultName);
    const localUser = getOrCreateLocalProfile(rawName);
    setIsOfflineMode(true);
    setProfile(localUser);
    saveAccountToStorage(localUser);
    sounds.playPlay(localUser.settings);

    window.dispatchEvent(
      new CustomEvent('show-global-toast', {
        detail: {
          type: 'info',
          title: localUser.settings.language === 'en' ? '📴 Offline Mode Active' : '📴 Çevrimdışı Mod Aktif',
          message: localUser.settings.language === 'en' ? 'Playing offline with bots & tournaments without internet.' : 'İnternet olmadan botlar ve kupa turnuvalarıyla çevrimdışı oynuyorsunuz.',
          emoji: '📴',
        },
      })
    );
  };

  // Save account to persistent local storage for 1-click Quick Login
  const saveAccountToStorage = (user: UserProfile, pass?: string) => {
    try {
      const existingList: SavedAccount[] = JSON.parse(localStorage.getItem('mono_deal_saved_accounts') || '[]');
      const filtered = existingList.filter((a) => a.username.toLowerCase() !== user.username.toLowerCase());

      const newAccount: SavedAccount = {
        id: user.id,
        username: user.username,
        password: pass && pass.trim() !== '' ? pass.trim() : (existingList.find(a => a.username.toLowerCase() === user.username.toLowerCase())?.password || undefined),
        avatarId: user.avatarId || 'avatar_classic',
        avatarUrl: user.avatarUrl,
        profileFrame: user.settings?.profileFrame || 'frame_none',
        level: user.level || 1,
        coins: user.coins || 0,
        lastLogin: Date.now(),
      };

      const updated = [newAccount, ...filtered].slice(0, 6);
      setSavedAccounts(updated);
      localStorage.setItem('mono_deal_saved_accounts', JSON.stringify(updated));
      localStorage.setItem('last_logged_username', user.username);
    } catch (e) {
      console.error('Failed to save account:', e);
    }
  };

  const handleRemoveSavedAccount = (e: React.MouseEvent, username: string) => {
    e.stopPropagation();
    const filtered = savedAccounts.filter((a) => a.username.toLowerCase() !== username.toLowerCase());
    setSavedAccounts(filtered);
    localStorage.setItem('mono_deal_saved_accounts', JSON.stringify(filtered));
    sounds.playPlay();
  };

  // ⚡ 1-Click Quick Login with Saved Account (with graceful offline fallback)
  const handleSavedAccountLogin = async (acc: SavedAccount) => {
    if (loading) return;
    setLoading(true);
    setAuthError(null);
    setUsernameInput(acc.username);
    if (acc.password) setPasswordInput(acc.password);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const response = await fetch(`${API_BASE_URL}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: acc.username, password: acc.password }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));

      if (response.ok) {
        const user = await response.json();
        setProfile(user);
        setIsOfflineMode(false);
        saveAccountToStorage(user, acc.password);
        saveLocalProfile(user);
        sounds.playCoin(user.settings);
      } else {
        const err = await response.json();
        setAuthError(err.error || `${acc.username} için giriş yapılamadı.`);
      }
    } catch (err: any) {
      console.log('Network unavailable, falling back to local offline profile:', err?.message);
      // Offline fallback: load local profile from storage!
      const localUser = getOrCreateLocalProfile(acc.username);
      setProfile(localUser);
      setIsOfflineMode(true);
      sounds.playCoin(localUser.settings);

      window.dispatchEvent(
        new CustomEvent('show-global-toast', {
          detail: {
            type: 'info',
            title: localUser.settings.language === 'en' ? '📴 Offline Login' : '📴 Çevrimdışı Giriş',
            message: localUser.settings.language === 'en' ? 'Connected in offline mode.' : 'Sunucuya ulaşılamadı, çevrimdışı profilinizle giriş yapıldı.',
            emoji: '📴',
          },
        })
      );
    } finally {
      setLoading(false);
    }
  };

  // Authenticate user on manual input
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (usernameInput.trim() === '') return;

    setLoading(true);
    setAuthError(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const response = await fetch(`${API_BASE_URL}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput.trim(), password: passwordInput.trim() || undefined }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));

      if (response.ok) {
        const user = await response.json();
        setProfile(user);
        setIsOfflineMode(false);
        saveLocalProfile(user);
        if (rememberAccount) {
          saveAccountToStorage(user, passwordInput.trim() || undefined);
        } else {
          localStorage.setItem('last_logged_username', usernameInput.trim());
        }

        // Play welcome sound!
        sounds.playCoin(user.settings);
      } else {
        const err = await response.json();
        setAuthError(err.error || 'Giriş yapılamadı.');
      }
    } catch (err: any) {
      console.log('Auth network error:', err?.message);
      setAuthError('OFFLINE_FALLBACK');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = (updated: UserProfile) => {
    setProfile(updated);
    // Always persist offline locally
    saveLocalProfile(updated);

    // If online, sync with the server database!
    if (!isOfflineMode) {
      fetch(`${API_BASE_URL}/api/profile/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: updated.id,
          avatarId: updated.avatarId,
          avatarUrl: updated.avatarUrl,
          gamesHistory: updated.gamesHistory,
          coins: updated.coins,
          xp: updated.xp,
          stats: updated.stats,
          dailyQuests: updated.dailyQuests,
          achievements: updated.achievements,
          password: updated.password,
          country: updated.country,
          lastLuckyWheelSpin: updated.lastLuckyWheelSpin,
          settings: updated.settings,
          unlockedItems: updated.unlockedItems,
        }),
      })
        .then((res) => {
          if (!res.ok) console.log('Profil sunucuyla senkronize edilemedi (çevrimdışı kaydedildi).');
        })
        .catch((_) => {});
    }
  };

  const handleJoinRoom = (roomId: string, isOffline: boolean, password?: string) => {
    // Play sounds
    sounds.playCoin(profile?.settings);
    sounds.playDraw(profile?.settings);
    
    // Set transition state
    setIsFlippingTransition(true);
    
    setTimeout(() => {
      setCurrentRoom({ roomId, isOffline: isOffline || isOfflineMode, password });
    }, 650);
    
    setTimeout(() => {
      setIsFlippingTransition(false);
    }, 1500);
  };

  const handleLeaveRoom = () => {
    setCurrentRoom(null);
    // Refresh user profile stats on game completion if online
    if (profile && !isOfflineMode) {
      fetch(`${API_BASE_URL}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: profile.username }),
      })
        .then((res) => {
          if (res.ok) return res.json();
        })
        .then((data) => {
          if (data) {
            setProfile(data);
            saveLocalProfile(data);
          }
        })
        .catch(() => {});
    }
  };

  const isDeleteAccountRoute = ['/delete-account', '/data-deletion', '/delete-data', '/account-deletion'].includes(pathname);
  const isPrivacyRoute = ['/privacy-policy', '/privacy'].includes(pathname);

  if (isDeleteAccountRoute) {
    return (
      <PrivacyAndDeleteAccountPages
        page="delete-account"
        onGoHome={() => {
          window.history.pushState({}, '', '/');
          setPathname('/');
        }}
      />
    );
  }

  if (isPrivacyRoute) {
    return (
      <PrivacyAndDeleteAccountPages
        page="privacy-policy"
        onGoHome={() => {
          window.history.pushState({}, '', '/');
          setPathname('/');
        }}
      />
    );
  }

  if (isDiscordConnecting) {
    const isEn = (localStorage.getItem('language') || 'tr') === 'en';
    return (
      <div className="fixed inset-0 bg-[#0f1117] flex flex-col items-center justify-center p-6 text-center z-50 text-white font-sans select-none">
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-3xl bg-[#5865F2]/20 border border-[#5865F2]/40 flex items-center justify-center shadow-[0_0_40px_rgba(88,101,242,0.35)]">
            <span className="text-4xl animate-bounce">🎮</span>
          </div>
          <div className="absolute -inset-1 rounded-3xl border border-[#5865F2]/30 animate-ping pointer-events-none" />
        </div>
        <h2 className="text-xl font-black text-[#5865F2] uppercase tracking-wider mb-2">
          {isEn ? 'Connecting to Discord Activity...' : 'Discord Aktivitesine Bağlanılıyor...'}
        </h2>
        <p className="text-xs text-zinc-400 max-w-xs mb-4">
          {isEn
            ? 'Synchronizing your Discord profile and session arena.'
            : 'Discord profiliniz ve ses kanalı oturumunuz senkronize ediliyor.'}
        </p>
        <div className="w-8 h-8 border-4 border-t-transparent border-[#5865F2] rounded-full animate-spin mb-6" />

        <button
          type="button"
          onClick={() => {
            const guest = getOrCreateLocalProfile('Discord Oyuncusu');
            setProfile(guest);
            setIsDiscordConnecting(false);
          }}
          className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-xs font-bold text-zinc-300 hover:text-white rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
        >
          {isEn ? '⚡ Enter Game Now' : '⚡ Hemen Masaya Gir'}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#0A0C10] flex flex-col justify-between selection:bg-red-500 selection:text-white overflow-x-clip overflow-y-visible">

      {/* 1. Login State (Ultra-Modern Esports & Glassmorphism Redesign) */}
      {!profile ? (
        <div className="flex-1 flex flex-col justify-center items-center px-4 py-8 sm:py-16 relative overflow-x-clip overflow-y-visible selection:bg-red-500 selection:text-white pb-16">
          {/* Ambient Lighting Orbs */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-red-600/10 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute bottom-10 -right-20 w-[380px] h-[380px] bg-amber-500/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute top-10 -left-20 w-[350px] h-[350px] bg-red-950/20 rounded-full blur-[100px] pointer-events-none" />

          {/* Main Glassmorphic Card */}
          <div className="w-full max-w-[440px] login-glass-card rounded-[36px] p-6 sm:p-9 space-y-6 relative overflow-hidden z-10">
            {/* Top Bar: Language Pill Switcher */}
            <div className="flex justify-between items-center relative z-20">
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 bg-white/5 border border-white/10 px-2.5 py-1 rounded-full">
                ONLINE & BOT ARENA
              </span>

              <button
                type="button"
                onClick={() => {
                  const currentLang = localStorage.getItem('language') || 'tr';
                  const nextLang = currentLang === 'tr' ? 'en' : 'tr';
                  changeLanguage(nextLang);
                  sounds.playPlay();
                }}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/6 hover:bg-white/12 border border-white/15 text-xs font-black text-zinc-300 hover:text-white transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95"
              >
                <span>🌐</span>
                <span>{(localStorage.getItem('language') || 'tr') === 'tr' ? 'TR 🇹🇷' : 'EN 🇺🇸'}</span>
              </button>
            </div>

            {/* 3D Glowing Brand Header */}
            <div className="text-center space-y-3 relative">
              {/* Metallic 3D Emblem */}
              <div className="relative mx-auto w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-tr from-red-600 to-amber-500 rounded-3xl blur-md opacity-60 animate-pulse" />
                <div className="relative w-full h-full bg-gradient-to-b from-red-500 via-red-600 to-red-800 rounded-2xl sm:rounded-3xl border-2 border-amber-400/50 shadow-2xl flex items-center justify-center transform hover:rotate-3 transition-transform">
                  <span className="font-black text-3xl sm:text-4xl text-white italic tracking-tighter drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]">
                    D
                  </span>
                </div>
              </div>

              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase italic text-white leading-none">
                  DEAL MASTER <span className="bg-gradient-to-r from-red-500 to-amber-400 bg-clip-text text-transparent">PRO</span>
                </h1>
                <p className="text-xs text-zinc-400 font-medium mt-1.5">
                  {t('login_arena_subtitle')} • {t('login_arena_desc')}
                </p>
              </div>
            </div>

            {/* ⚡ SAVED ACCOUNTS / 1-CLICK QUICK LOGIN SECTION */}
            {savedAccounts.length > 0 && (
              <div className="space-y-2.5 relative z-10 login-glass-chip p-3.5 rounded-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-amber-400 font-black text-[11px] uppercase tracking-wider">
                    <span className="text-xs animate-pulse">⚡</span>
                    <span>{t('saved_accounts_title')}</span>
                  </div>
                  <span className="text-[9px] text-zinc-500 font-bold bg-black/40 px-2 py-0.5 rounded-md border border-white/5">
                    {t('saved_profiles_count', null, savedAccounts.length) || `${savedAccounts.length} Profil`}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-0.5 scrollbar-thin">
                  {savedAccounts.map((acc) => (
                    <div
                      key={acc.username}
                      onClick={() => handleSavedAccountLogin(acc)}
                      className="group relative flex items-center justify-between p-2.5 bg-black/40 hover:bg-red-950/30 border border-white/8 hover:border-amber-500/50 rounded-xl transition-all cursor-pointer shadow-sm active:scale-[0.98]"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <AvatarWithFrame
                          avatarId={acc.avatarId || 'avatar_classic'}
                          avatarUrl={acc.avatarUrl}
                          frameId={acc.profileFrame || 'frame_none'}
                          sizeClassName="w-8 h-8 text-[11px]"
                        />
                        <div className="flex flex-col min-w-0 text-left">
                          <span className="font-black text-xs text-white group-hover:text-amber-300 transition-colors truncate">
                            {acc.username}
                          </span>
                          <div className="flex items-center gap-1.5 text-[9px] font-bold text-zinc-400">
                            <span className="bg-amber-500/15 text-amber-300 px-1.5 py-0.2 rounded font-extrabold text-[8.5px]">
                              Lv. {acc.level || 1}
                            </span>
                            <span>{acc.coins !== undefined ? `${acc.coins.toLocaleString()} 🪙` : ''}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={loading}
                          className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black text-[10px] uppercase tracking-wider rounded-lg shadow-md group-hover:brightness-110 active:scale-95 transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          <span>⚡</span>
                          <span>{t('quick_login_btn')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleRemoveSavedAccount(e, acc.username)}
                          title={t('remove_saved_account')}
                          className="w-6 h-6 rounded-lg bg-white/5 hover:bg-rose-500/20 text-zinc-500 hover:text-rose-400 text-xs flex items-center justify-center transition-all cursor-pointer shrink-0"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-white/8"></div>
                  <span className="flex-shrink mx-2 text-[8px] font-black uppercase text-zinc-500 tracking-wider">
                    {t('login_with_another_account')}
                  </span>
                  <div className="flex-grow border-t border-white/8"></div>
                </div>
              </div>
            )}

            {/* Login Credentials Form */}
            <form onSubmit={handleAuth} className="space-y-4 relative">
              {/* Username Input with User Icon */}
              <div className="space-y-1.5 text-left">
                <label className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider block">
                  {t('login_username_label')}
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-zinc-500 text-sm select-none pointer-events-none">
                    👤
                  </span>
                  <input
                    type="text"
                    placeholder={t('login_username_placeholder')}
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    disabled={loading}
                    maxLength={16}
                    className="w-full bg-black/50 border border-white/10 rounded-2xl pl-10 pr-10 py-3.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all font-semibold"
                  />
                  {usernameInput && (
                    <button
                      type="button"
                      onClick={() => setUsernameInput('')}
                      className="absolute right-3.5 text-zinc-500 hover:text-zinc-300 text-xs font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Password Input (Optional) */}
              <div className="space-y-1.5 text-left">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider block">
                    {t('login_password_label')}
                  </label>
                  <span className="text-[9px] text-zinc-500 font-medium">{t('login_password_hint')}</span>
                </div>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-zinc-500 text-sm select-none pointer-events-none">
                    🔒
                  </span>
                  <input
                    type="password"
                    placeholder={t('login_password_placeholder')}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    disabled={loading}
                    className="w-full bg-black/50 border border-white/10 rounded-2xl pl-10 pr-4 py-3.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all font-semibold"
                  />
                </div>
              </div>

              {/* Remember Account on this device Checkbox */}
              <div className="flex items-center gap-2 pt-0.5 text-left">
                <input
                  type="checkbox"
                  id="rememberAccountCheckbox"
                  checked={rememberAccount}
                  onChange={(e) => setRememberAccount(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-red-500 focus:ring-red-500/30 cursor-pointer accent-red-500"
                />
                <label htmlFor="rememberAccountCheckbox" className="text-[10px] text-zinc-400 font-bold cursor-pointer select-none">
                  {t('save_account_checkbox')}
                </label>
              </div>

              {/* Offline fallback warning banner */}
              {authError === 'OFFLINE_FALLBACK' ? (
                <div className="p-3.5 bg-amber-500/15 border border-amber-500/30 rounded-2xl text-amber-300 text-xs space-y-2 animate-fadeIn text-left">
                  <div className="flex items-center gap-2 font-bold">
                    <span>📡</span>
                    <span>{t('offline_server_unavailable')}</span>
                  </div>
                  <p className="text-[10px] text-amber-200/80">
                    {t('offline_fallback_desc')}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleOfflineLogin(usernameInput)}
                    className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>📴</span>
                    <span>{t('offline_continue_btn')}</span>
                  </button>
                </div>
              ) : authError ? (
                <div className="p-3 bg-red-500/10 border border-red-500/25 rounded-xl text-red-400 text-xs flex items-center gap-1.5 animate-fadeIn text-left">
                  <span>⚠️</span> {authError}
                </div>
              ) : null}

              {/* Dual Large Action Buttons */}
              <div className="space-y-2.5 pt-2">
                <button
                  type="submit"
                  disabled={loading || usernameInput.trim() === ''}
                  className="w-full py-4 login-btn-shimmer bg-gradient-to-r from-red-600 via-red-500 to-amber-500 hover:from-red-500 hover:to-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black rounded-2xl text-sm uppercase tracking-widest transition-all shadow-xl shadow-red-600/30 flex items-center justify-center gap-2.5 transform active:scale-[0.98] cursor-pointer"
                >
                  <span className="text-base">🚀</span>
                  <span>{loading ? t('login_loading') : (t('login_enter_arena') || 'ARENAYA GİRİŞ YAP')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOfflineLogin(usernameInput)}
                  className="w-full py-3.5 bg-zinc-900/80 hover:bg-zinc-800/90 border border-white/10 hover:border-amber-500/40 text-zinc-300 hover:text-white font-black rounded-2xl text-xs uppercase tracking-wider transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>📴</span>
                  <span>{t('play_offline_btn') || 'İNTERNETSİZ ÇEVRİMDIŞI OYNA'}</span>
                </button>
              </div>
            </form>

            {/* Footer Legal & Info Links */}
            <div className="border-t border-white/8 pt-4 text-center space-y-2.5">
              <p className="text-[9.5px] text-zinc-500 font-medium">
                {t('login_compatibility_title')} • {t('login_compatibility_desc')}
              </p>

              <div className="flex justify-center items-center gap-3 text-[10px] font-bold">
                <a
                  href="/privacy-policy"
                  onClick={(e) => {
                    e.preventDefault();
                    window.history.pushState({}, '', '/privacy-policy');
                    setPathname('/privacy-policy');
                  }}
                  className="text-zinc-400 hover:text-amber-400 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span>🛡️</span> {t('privacy_policy')}
                </a>
                <span className="text-white/10">|</span>
                <a
                  href="/delete-account"
                  onClick={(e) => {
                    e.preventDefault();
                    window.history.pushState({}, '', '/delete-account');
                    setPathname('/delete-account');
                  }}
                  className="text-zinc-400 hover:text-red-400 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span>🗑️</span> {t('data_deletion')}
                </a>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* 2. Navigation Flow */
        <div className="flex-1 flex flex-col">
          {currentRoom ? (
            <GameRoomErrorBoundary onReset={handleLeaveRoom}>
              <GameRoom
                roomId={currentRoom.roomId}
                isOffline={currentRoom.isOffline}
                profile={profile}
                onLeaveRoom={handleLeaveRoom}
                onUpdateProfile={handleUpdateProfile}
                adminSettings={adminSettings}
                roomPassword={currentRoom.password}
                onArenaCollapseChange={(collapsed) => setIsArenaCollapsed(collapsed)}
              />
            </GameRoomErrorBoundary>
          ) : (
            <>
              {discordSession?.channelId && (
                <div className="max-w-4xl mx-auto w-full px-4 pt-3">
                  <div className="bg-[#5865F2]/20 border border-[#5865F2]/40 rounded-2xl p-3 flex items-center justify-between shadow-lg backdrop-blur-md">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#5865F2] flex items-center justify-center text-white text-lg shadow-md">
                        🎮
                      </div>
                      <div>
                        <div className="text-xs font-black text-white uppercase tracking-wider">
                          Discord Ses Kanalı Masası
                        </div>
                        <div className="text-[10px] text-[#A2A9FA] font-medium">
                          Aynı ses kanalındaki arkadaşlarınla ortak masaya tek tıkla gir
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const dcRoomId = getDiscordChannelRoomId(discordSession.channelId);
                        if (dcRoomId) {
                          handleJoinRoom(dcRoomId, false);
                        }
                      }}
                      className="px-4 py-2 bg-[#5865F2] hover:bg-[#4752C4] text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5"
                    >
                      <span>🚀</span>
                      <span>Kanal Masasına Gir</span>
                    </button>
                  </div>
                </div>
              )}
              <MainMenu
                profile={profile}
                onUpdateProfile={handleUpdateProfile}
                onJoinRoom={handleJoinRoom}
                adminSettings={adminSettings}
                onUpdateAdminSettings={(settings) => setAdminSettings(settings)}
                isOfflineMode={isOfflineMode}
              />
            </>
          )}
        </div>
      )}

      {/* 📱 Google AdMob Banner Ad (Giriş / Ana Sayfa / Lobi) */}
      <AdMobBanner adminSettings={adminSettings} visible={!currentRoom} />
      {/* 🎴 Cinematic Card Flip Transition Overlay */}
      <AnimatePresence>
        {isFlippingTransition && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/95 backdrop-blur-md pointer-events-auto select-none"
          >
            <motion.div
              initial={{ rotateY: 0, scale: 0.8 }}
              animate={{ 
                rotateY: [0, 180, 360],
                scale: [0.8, 1.1, 1],
                filter: ['blur(0px)', 'blur(2px)', 'blur(0px)']
              }}
              transition={{ duration: 1.3, ease: "easeInOut" }}
              className="w-64 h-96 rounded-3xl border-2 border-amber-400/40 p-1 flex items-center justify-center relative overflow-hidden shadow-[0_0_60px_rgba(245,158,11,0.35)] bg-gradient-to-br from-slate-900 to-slate-950"
              style={{ transformStyle: 'preserve-3d', perspective: '1200px' }}
            >
              {/* Holographic background */}
              <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 via-purple-500/10 to-pink-500/10" />
              
              {/* Card back logo and design */}
              <div className="absolute inset-2 border border-white/5 rounded-2xl flex flex-col items-center justify-between p-6">
                <div className="text-[10px] font-black tracking-widest text-slate-500">DEAL MASTER PRO</div>
                
                <div className="relative">
                  <div className="w-20 h-20 rounded-full border border-amber-500/30 flex items-center justify-center bg-amber-500/5">
                    <span className="text-4xl animate-pulse">🃏</span>
                  </div>
                  {/* Glowing ring */}
                  <div className="absolute inset-0 rounded-full border border-amber-400/20 animate-ping" />
                </div>

                <div className="text-[10px] font-black tracking-widest text-amber-500/80 animate-pulse">
                  {t('entering_arena', profile)}
                </div>
              </div>

              {/* Felt details */}
              <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.02)_1.5px,transparent_1.5px)] [background-size:16px_16px] opacity-40 pointer-events-none" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <GlobalToast profile={profile} />
    </div>
  );
}
