import React, { Component } from 'react';
import { UserProfile } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { MainMenu } from './components/MainMenu';
import { GameRoom } from './components/GameRoom';
import { sounds } from './lib/SoundSystem';
import { initTranslations, addTranslationListener } from './lib/TranslationSystem';
import { API_BASE_URL } from './lib/apiConfig';
import { GlobalToast } from './components/GlobalToast';
import { STORE_ITEMS } from './components/ShopDialog';

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

export default function App() {
  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [usernameInput, setUsernameInput] = React.useState('');
  const [passwordInput, setPasswordInput] = React.useState(''); // Password field to secure nicknames
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [adminSettings, setAdminSettings] = React.useState<any>(null);

  // Navigation states
  const [currentRoom, setCurrentRoom] = React.useState<{ roomId: string; isOffline: boolean; password?: string } | null>(null);

  // Transition states for card flip
  const [isFlippingTransition, setIsFlippingTransition] = React.useState(false);

  // Translation update listener state
  const [translationVersion, setTranslationVersion] = React.useState(0);

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

  // Authenticate user on startup or after input
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (usernameInput.trim() === '') return;

    setLoading(true);
    setAuthError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput, password: passwordInput }),
      });

      if (response.ok) {
        const user = await response.json();
        setProfile(user);

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
        avatarUrl: updated.avatarUrl,
        gamesHistory: updated.gamesHistory,
        coins: updated.coins,
        xp: updated.xp,
        stats: updated.stats,
        dailyQuests: updated.dailyQuests,
        achievements: updated.achievements,
        password: updated.password,
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

  return (
    <div className="min-h-screen bg-[#0A0C10] flex flex-col justify-between selection:bg-red-500 selection:text-white">

      {/* 1. Login State */}
      {!profile ? (
        <div className="flex-1 flex flex-col justify-center items-center px-4 py-16">
          <div className="w-full max-w-md bg-black/40 border border-white/10 rounded-[32px] p-8 space-y-6 shadow-2xl relative overflow-hidden backdrop-blur-xl">
            {/* Background glowing effects */}
            <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full bg-red-600/10 blur-3xl" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 rounded-full bg-slate-500/5 blur-3xl" />

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
                Kart Oyunu Arenası
              </h2>
              <p className="text-xs text-slate-400">
                Eş zamanlı çok oyunculu, sesli sohbetli ve bot pratikli modern Deal Master PRO deneyimi.
              </p>
            </div>

            <form onSubmit={handleAuth} className="space-y-4 relative">
              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-bold block">
                  Kullanıcı Adınız (Nickname)
                </label>
                <input
                  type="text"
                  placeholder="Örn: Deal Master PRO Kralı"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  disabled={loading}
                  maxLength={16}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-500 placeholder:text-slate-500 transition-all focus:ring-1 focus:ring-red-500/30"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs text-slate-400 font-bold block">
                    Şifre (Güvenlik / İsteğe Bağlı)
                  </label>
                  <span className="text-[9px] text-slate-500 font-semibold leading-none">Başkası kullanamasın diye</span>
                </div>
                <input
                  type="password"
                  placeholder="Hesabınızı korumak için bir şifre girin"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  disabled={loading}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-500 placeholder:text-slate-500 transition-all focus:ring-1 focus:ring-red-500/30"
                />
              </div>

              {authError && (
                <div className="p-3 bg-red-500/10 border border-red-500/25 rounded-xl text-red-400 text-xs flex items-center gap-1.5">
                  <span>⚠️</span> {authError}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || usernameInput.trim() === ''}
                className="w-full py-3.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black rounded-xl text-sm transition-all shadow-lg shadow-red-600/20 flex items-center justify-center gap-2 transform active:scale-95"
              >
                {loading ? 'Yükleniyor...' : 'Arenaya Giriş Yap 🚀'}
              </button>
            </form>

            <div className="border-t border-white/10 pt-4 text-center">
              <span className="text-[10px] text-slate-500 block font-bold uppercase tracking-wider">
                Platform ve Cihaz Uyumluluğu
              </span>
              <p className="text-[9px] text-slate-400 mt-1">
                Hem masaüstü tarayıcılarda hem de mobil tarayıcılarda tam dokunmatik hassasiyeti ve optimize performans.
              </p>
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
                  {profile?.settings?.language === 'en' ? 'ENTERING ARENA...' : 'ARENAYA GİRİLİYOR...'}
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
