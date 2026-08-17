import React, { Component } from 'react';
import { UserProfile } from './types';
import { motion, AnimatePresence } from 'motion/react';
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
      return (
        <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-center space-y-4 z-50 text-white font-sans">
          <div className="w-16 h-16 border-4 border-t-transparent border-amber-500 rounded-full animate-spin" />
          <h2 className="text-xl font-black text-amber-400 uppercase tracking-widest">Bağlantı Yenileniyor...</h2>
          <p className="text-xs text-slate-400 max-w-xs">Bir arayüz hatası algılandı. Oyun durumunuz sunucu üzerinden otomatik olarak kurtarılıyor.</p>
          <button
            onClick={() => {
              (this as any).setState({ hasError: false });
              (this as any).props.onReset();
            }}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs transition-all cursor-pointer shadow-lg"
          >
            Yeniden Bağlan
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

  // Pathname routing state for standalone Google Play pages (/delete-account, /privacy-policy)
  const [pathname, setPathname] = React.useState(window.location.pathname);

  React.useEffect(() => {
    const handlePopState = () => {
      setPathname(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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

  // ⚡ 1-Click Quick Login with Saved Account
  const handleSavedAccountLogin = async (acc: SavedAccount) => {
    if (loading) return;
    setLoading(true);
    setAuthError(null);
    setUsernameInput(acc.username);
    if (acc.password) setPasswordInput(acc.password);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: acc.username, password: acc.password }),
      });

      if (response.ok) {
        const user = await response.json();
        setProfile(user);
        saveAccountToStorage(user, acc.password);
        sounds.playCoin(user.settings);
      } else {
        const err = await response.json();
        setAuthError(err.error || `${acc.username} için giriş yapılamadı.`);
      }
    } catch (err: any) {
      console.error('Saved account quick auth error:', err);
      setAuthError(`Sunucu bağlantısı kurulamadı (${err?.message || 'Ağ Hatası'}).`);
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
      const response = await fetch(`${API_BASE_URL}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput.trim(), password: passwordInput.trim() || undefined }),
      });

      if (response.ok) {
        const user = await response.json();
        setProfile(user);
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
      console.error('Auth error:', err);
      setAuthError(`Sunucu bağlantısı kurulamadı (${err?.message || 'Ağ Hatası'}). Hedef: ${API_BASE_URL || 'Göreceli Path'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = (updated: UserProfile) => {
    setProfile(updated);

    // Sync with the server database!
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
        if (!res.ok) console.error('Profil sunucuyla senkronize edilemedi.');
      })
      .catch((err) => console.error('Senkronizasyon hatası:', err));
  };

  const handleJoinRoom = (roomId: string, isOffline: boolean, password?: string) => {
    // Play sounds
    sounds.playCoin(profile?.settings);
    sounds.playDraw(profile?.settings);
    
    // Set transition state
    setIsFlippingTransition(true);
    
    setTimeout(() => {
      setCurrentRoom({ roomId, isOffline, password });
    }, 650);
    
    setTimeout(() => {
      setIsFlippingTransition(false);
    }, 1500);
  };

  const handleLeaveRoom = () => {
    setCurrentRoom(null);
    // Refresh user profile stats on game completion
    if (profile) {
      fetch(`${API_BASE_URL}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: profile.username }),
      })
        .then((res) => {
          if (res.ok) return res.json();
        })
        .then((data) => {
          if (data) setProfile(data);
        })
        .catch(console.error);
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

  return (
    <div className="min-h-screen bg-[#0A0C10] flex flex-col justify-between selection:bg-red-500 selection:text-white">

      {/* 1. Login State */}
      {!profile ? (
        <div className="flex-1 flex flex-col justify-center items-center px-4 py-16">
          <div className="w-full max-w-md bg-black/40 border border-white/10 rounded-[32px] p-8 space-y-6 shadow-2xl relative overflow-hidden backdrop-blur-xl">
            {/* Background glowing effects */}
            <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full bg-red-600/10 blur-3xl" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 rounded-full bg-slate-500/5 blur-3xl" />

            {/* Quick Language Toggle for Login Screen */}
            <div className="flex justify-end items-center relative z-20">
              <button
                type="button"
                onClick={() => {
                  const currentLang = localStorage.getItem('language') || 'tr';
                  const nextLang = currentLang === 'tr' ? 'en' : 'tr';
                  changeLanguage(nextLang);
                  sounds.playPlay();
                }}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-extrabold text-slate-300 hover:text-white transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95"
              >
                <span>🌐</span>
                <span>{(localStorage.getItem('language') || 'tr') === 'tr' ? 'EN 🇺🇸' : 'TR 🇹🇷'}</span>
              </button>
            </div>

            <div className="text-center space-y-4 relative">
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-red-600 to-red-800 rounded-xl flex items-center justify-center font-black text-2xl shadow-lg shadow-red-900/40 text-white italic">
                  M
                </div>
                <h1 className="text-xl font-bold tracking-tight uppercase italic text-white">
                  Deal Master <span className="text-red-500">PRO</span>
                </h1>
              </div>
              <h2 className="font-extrabold text-sm text-slate-300 tracking-tight mt-2">
                {t('login_arena_subtitle')}
              </h2>
              <p className="text-xs text-slate-400">
                {t('login_arena_desc')}
              </p>
            </div>

            {/* ⚡ SAVED ACCOUNTS / QUICK LOGIN SECTION */}
            {savedAccounts.length > 0 && (
              <div className="space-y-3 relative z-10 bg-zinc-950/60 border border-amber-500/30 p-4 rounded-2xl shadow-xl shadow-amber-950/20 backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-amber-400 font-black text-xs uppercase tracking-wider">
                    <span className="text-sm animate-pulse">⚡</span>
                    <span>{t('saved_accounts_title')}</span>
                  </div>
                  <span className="text-[9px] text-zinc-500 font-bold">{savedAccounts.length} Hesap</span>
                </div>
                <p className="text-[10px] text-zinc-400">
                  {t('saved_accounts_desc')}
                </p>

                <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-0.5 scrollbar-thin">
                  {savedAccounts.map((acc) => (
                    <div
                      key={acc.username}
                      onClick={() => handleSavedAccountLogin(acc)}
                      className="group relative flex items-center justify-between p-2.5 bg-gradient-to-r from-zinc-900/90 to-zinc-950/90 hover:from-amber-950/40 hover:to-zinc-900 border border-zinc-800 hover:border-amber-500/50 rounded-xl transition-all cursor-pointer shadow-md active:scale-[0.98]"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <AvatarWithFrame
                          avatarId={acc.avatarId || 'avatar_classic'}
                          avatarUrl={acc.avatarUrl}
                          frameId={acc.profileFrame || 'frame_none'}
                          sizeClassName="w-8 h-8 text-[11px]"
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="font-black text-xs text-white group-hover:text-amber-300 transition-colors truncate">
                            {acc.username}
                          </span>
                          <div className="flex items-center gap-1.5 text-[9px] font-bold text-zinc-400">
                            <span className="bg-amber-500/10 text-amber-300 border border-amber-500/20 px-1 py-0.2 rounded font-extrabold">
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
                          className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-[10px] uppercase tracking-wider rounded-lg shadow-md group-hover:brightness-110 active:scale-95 transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          <span>⚡</span>
                          <span>GİRİŞ</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleRemoveSavedAccount(e, acc.username)}
                          title={t('remove_saved_account')}
                          className="w-6 h-6 rounded-lg bg-zinc-800/80 hover:bg-rose-500/20 text-zinc-500 hover:text-rose-400 text-xs flex items-center justify-center transition-all cursor-pointer border border-transparent hover:border-rose-500/30 shrink-0"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-white/10"></div>
                  <span className="flex-shrink mx-2 text-[8px] font-black uppercase text-zinc-500 tracking-wider">
                    {t('login_with_another_account')}
                  </span>
                  <div className="flex-grow border-t border-white/10"></div>
                </div>
              </div>
            )}

            <form onSubmit={handleAuth} className="space-y-4 relative">
              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-bold block">
                  {t('login_username_label')}
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    placeholder={t('login_username_placeholder')}
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    disabled={loading}
                    maxLength={16}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-500 placeholder:text-slate-500 transition-all focus:ring-1 focus:ring-red-500/30 pr-10"
                  />
                  {usernameInput && (
                    <button
                      type="button"
                      onClick={() => setUsernameInput('')}
                      className="absolute right-3 text-slate-500 hover:text-slate-300 text-xs font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs text-slate-400 font-bold block">
                    {t('login_password_label')}
                  </label>
                  <span className="text-[9px] text-slate-500 font-semibold leading-none">{t('login_password_hint')}</span>
                </div>
                <input
                  type="password"
                  placeholder={t('login_password_placeholder')}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  disabled={loading}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-500 placeholder:text-slate-500 transition-all focus:ring-1 focus:ring-red-500/30"
                />
              </div>

              {/* Remember Account on this device Checkbox */}
              <div className="flex items-center gap-2 pt-0.5">
                <input
                  type="checkbox"
                  id="rememberAccountCheckbox"
                  checked={rememberAccount}
                  onChange={(e) => setRememberAccount(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-amber-500/30 cursor-pointer accent-amber-500"
                />
                <label htmlFor="rememberAccountCheckbox" className="text-[10px] text-zinc-400 font-bold cursor-pointer select-none">
                  {t('save_account_checkbox')}
                </label>
              </div>

              {authError && (
                <div className="p-3 bg-red-500/10 border border-red-500/25 rounded-xl text-red-400 text-xs flex items-center gap-1.5 animate-fadeIn">
                  <span>⚠️</span> {authError}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || usernameInput.trim() === ''}
                className="w-full py-3.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black rounded-xl text-sm transition-all shadow-lg shadow-red-600/25 flex items-center justify-center gap-2 transform active:scale-95 cursor-pointer"
              >
                <span>🚀</span>
                <span>{loading ? t('login_loading') : t('login_button')}</span>
              </button>
            </form>

            <div className="border-t border-white/10 pt-4 text-center space-y-3">
              <div>
                <span className="text-[10px] text-slate-500 block font-bold uppercase tracking-wider">
                  {t('login_compatibility_title')}
                </span>
                <p className="text-[9px] text-slate-400 mt-0.5">
                  {t('login_compatibility_desc')}
                </p>
              </div>

              <div className="border-t border-white/5 pt-3 flex justify-center items-center gap-3 text-[10px] font-bold">
                <a
                  href="/privacy-policy"
                  onClick={(e) => {
                    e.preventDefault();
                    window.history.pushState({}, '', '/privacy-policy');
                    setPathname('/privacy-policy');
                  }}
                  className="text-slate-400 hover:text-amber-400 transition-colors flex items-center gap-1 cursor-pointer"
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
                  className="text-slate-400 hover:text-red-400 transition-colors flex items-center gap-1 cursor-pointer"
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
            <MainMenu
              profile={profile}
              onUpdateProfile={handleUpdateProfile}
              onJoinRoom={handleJoinRoom}
              adminSettings={adminSettings}
              onUpdateAdminSettings={(settings) => setAdminSettings(settings)}
            />
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
