import React from 'react';
import { UserProfile, MatchState, Tournament } from '../types';
import { ShopDialog } from './ShopDialog';
import { ProfilePanel } from './ProfilePanel';
import { CustomizationPanel } from './CustomizationPanel';
import { TournamentBracket } from './TournamentBracket';
import { sounds } from '../lib/SoundSystem';
import { AvatarWithFrame } from './AvatarWithFrame';
import { AdminDashboard } from './AdminDashboard';
import { ProfileOperationsModal } from './ProfileOperationsModal';
import { HowToPlayModal } from './HowToPlayModal';
import { LuckyWheel } from './LuckyWheel';
import { CardsCatalog } from './CardsCatalog';
import { AdMobBanner } from './AdMobBanner';
import { motion, AnimatePresence } from 'motion/react';
import { t, changeLanguage } from '../lib/TranslationSystem';
import { API_BASE_URL, WS_BASE_URL } from '../lib/apiConfig';
import { getCountryByCode } from '../lib/countryData';
import { getOfflineTournaments, startOfflineTournament, resetOfflineTournament } from '../lib/offlineManager';
import {
  Play,
  Bot,
  Trophy,
  Users,
  Shield,
  BookOpen,
  User as UserIcon,
  Sparkles,
  RefreshCw,
  Layout,
  Coins,
  Check,
  X,
  Lock,
  Flame,
  Calendar,
  Award,
  Layers,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface Props {
  profile: UserProfile;
  onUpdateProfile: (updated: UserProfile) => void;
  onJoinRoom: (roomId: string, isOffline: boolean, password?: string) => void;
  adminSettings?: any;
  onUpdateAdminSettings?: (settings: any) => void;
  isOfflineMode?: boolean;
}

const PRESET_AVATARS = [
  { id: 'av_1', name: 'Karizmatik Oyuncu', url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80' },
  { id: 'av_2', name: 'Zeki Taktisyen', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80' },
  { id: 'av_3', name: 'Gizemli Lord', url: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&q=80' },
  { id: 'av_4', name: 'Neşeli Oyuncu', url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&q=80' },
  { id: 'av_5', name: 'Siber Deha', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80' },
  { id: 'av_6', name: 'Kreatif Sanatçı', url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80' },
  { id: 'av_7', name: 'Retro Çocuk', url: 'https://images.unsplash.com/photo-1628157582853-a796fa650a6a?auto=format&fit=crop&w=150&q=80' },
  { id: 'av_8', name: 'Usta Stratejist', url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=150&q=80' },
];

export function getLeagueTier(points: number) {
  if (points >= 1200) return { name: 'Elmas', color: 'text-indigo-400 bg-indigo-500/15 border-indigo-500/30', icon: '🏆' };
  if (points >= 900) return { name: 'Platin', color: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/30', icon: '💎' };
  if (points >= 600) return { name: 'Altın', color: 'text-yellow-400 bg-yellow-500/15 border-yellow-500/30', icon: '🥇' };
  if (points >= 300) return { name: 'Gümüş', color: 'text-slate-300 bg-slate-500/15 border-slate-500/20', icon: '🥈' };
  return { name: 'Bronz', color: 'text-amber-500 bg-amber-500/15 border-amber-500/20', icon: '🥉' };
}

export const MainMenu: React.FC<Props> = ({ profile, onUpdateProfile, onJoinRoom, adminSettings, onUpdateAdminSettings, isOfflineMode }) => {
  const [activeTab, setActiveTab] = React.useState<'play' | 'bot_practice' | 'tournaments' | 'cards' | 'shop' | 'customization' | 'profile' | 'rules' | 'leaderboard' | 'admin'>('play');
  const [showHowToPlayModal, setShowHowToPlayModal] = React.useState(false);
  const [showLuckyWheel, setShowLuckyWheel] = React.useState(false);
  const [questsExpanded, setQuestsExpanded] = React.useState(false);
  const [botDifficulty, setBotDifficulty] = React.useState<'easy' | 'medium' | 'hard'>('medium');
  const [botPlayerCount, setBotPlayerCount] = React.useState<number>(2);
  const [botGameFormat, setBotGameFormat] = React.useState<'classic' | '2v2_team'>('classic');
  const [botTargetSets, setBotTargetSets] = React.useState<number>(3);
  const [rooms, setRooms] = React.useState<any[]>([]);
  const [customRoomId, setCustomRoomId] = React.useState('');
  const [roomPassword, setRoomPassword] = React.useState(''); // State to hold optional room password on creation
  const [joinRoomCodeInput, setJoinRoomCodeInput] = React.useState('');
  const [roomSearchQuery, setRoomSearchQuery] = React.useState('');
  const [roomFilterCategory, setRoomFilterCategory] = React.useState<'all' | 'open' | 'locked' | '2v2' | 'classic'>('all');
  const [lobbyJoinCode, setLobbyJoinCode] = React.useState('');
  const [lobbyJoinPass, setLobbyJoinPass] = React.useState('');
  const [showQuickCreateInLobby, setShowQuickCreateInLobby] = React.useState(false);
  const [multiplayerMode, setMultiplayerMode] = React.useState<'custom_room' | 'active_rooms'>('custom_room');
  const [tournamentJoined, setTournamentJoined] = React.useState(false);
  const [onlinePlayerCount, setOnlinePlayerCount] = React.useState<number>(1);

  React.useEffect(() => {
    if (adminSettings && adminSettings.rankedLeagueEnabled === false && activeTab === 'leaderboard') {
      setActiveTab('play');
    }
  }, [adminSettings, activeTab]);

  // Avatar ve Liderlik Tablosu Durumları
  const [showProfileOperationsModal, setShowProfileOperationsModal] = React.useState(false);
  const [leaderboardData, setLeaderboardData] = React.useState<any[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = React.useState(false);
  const [leaderboardSubTab, setLeaderboardSubTab] = React.useState<'general' | 'ranked'>('ranked');

  const fetchLeaderboard = async () => {
    setLeaderboardLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/leaderboard`);
      if (res.ok) {
        const data = await res.json();
        setLeaderboardData(data);
      }
    } catch (e) {
      console.error('Failed to fetch leaderboard', e);
    } finally {
      setLeaderboardLoading(false);
    }
  };

  React.useEffect(() => {
    if (activeTab === 'leaderboard') {
      fetchLeaderboard();
    }
  }, [activeTab]);

  const handleSelectAvatar = async (url: string) => {
    sounds.playCoin(profile.settings);
    const updated = {
      ...profile,
      avatarUrl: url,
      avatarId: 'avatar_classic',
      settings: {
        ...profile.settings,
        avatarId: 'avatar_classic'
      }
    };
    onUpdateProfile(updated);
    setShowProfileOperationsModal(false);

    // Persist this change on server
    try {
      await fetch(`${API_BASE_URL}/api/settings/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile.id, settings: { avatarId: 'avatar_classic' } }),
      });
    } catch (e) {
      console.error('Failed to sync avatar selection settings', e);
    }
  };
  const [tournamentsList, setTournamentsList] = React.useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = React.useState<string>('t-bronze');

  const fetchTournaments = async () => {
    if (isOfflineMode) {
      const offlineList = getOfflineTournaments(profile.username);
      setTournamentsList(offlineList);
      if (!selectedTournamentId || !offlineList.some((t: any) => t.id === selectedTournamentId)) {
        setSelectedTournamentId(offlineList[0]?.id || 't-bronze');
      }
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/tournaments?userId=${profile.id}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setTournamentsList(data);
          if (!selectedTournamentId || !data.some((t: any) => t.id === selectedTournamentId)) {
            setSelectedTournamentId(data[0].id);
          }
          return;
        }
      }
    } catch (e) {
      // Graceful offline fallback
    }

    const offlineList = getOfflineTournaments(profile.username);
    setTournamentsList(offlineList);
    if (!selectedTournamentId || !offlineList.some((t: any) => t.id === selectedTournamentId)) {
      setSelectedTournamentId(offlineList[0]?.id || 't-bronze');
    }
  };

  React.useEffect(() => {
    if (activeTab === 'tournaments') {
      fetchTournaments();
      const interval = setInterval(fetchTournaments, 3000);
      return () => clearInterval(interval);
    }
  }, [activeTab, profile.id, isOfflineMode]);

  const handleStartTournament = async (tournamentId: string) => {
    if (isOfflineMode) {
      const updated = startOfflineTournament(tournamentId, profile.username);
      setTournamentsList(updated);
      sounds.playPlay(profile.settings);
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/tournaments/user/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile.id, tournamentId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.user) onUpdateProfile(data.user);
        fetchTournaments();
        return;
      }
    } catch (e) {
      console.log('Online tournament start failed, using offline tournament instead');
    }

    const updated = startOfflineTournament(tournamentId, profile.username);
    setTournamentsList(updated);
    sounds.playPlay(profile.settings);
  };

  const handleResetTournament = async (tournamentId: string) => {
    if (isOfflineMode) {
      const updated = resetOfflineTournament(tournamentId, profile.username);
      setTournamentsList(updated);
      sounds.playPlay(profile.settings);
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/tournaments/user/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile.id, tournamentId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.user) onUpdateProfile(data.user);
        fetchTournaments();
        return;
      }
    } catch (e) {
      console.log('Online tournament reset failed, using offline tournament instead');
    }

    const updated = resetOfflineTournament(tournamentId, profile.username);
    setTournamentsList(updated);
    sounds.playPlay(profile.settings);
  };

  const handlePlayTournamentMatch = (
    tournamentId: string,
    matchId: string,
    opponentName: string,
    format: string = '1v1',
    botDifficulty: string = 'medium',
    targetSets: number = 3,
    turnDurationSeconds: number = 30
  ) => {
    const roomId = `tournament:${tournamentId}:${matchId}:${opponentName}:${format}:${botDifficulty}:${targetSets}:${turnDurationSeconds}`;
    onJoinRoom(roomId, true);
  };

  // Ping indicator state
  const [pingMs, setPingMs] = React.useState<number | null>(null);

  const measurePing = async () => {
    const start = performance.now();
    try {
      const res = await fetch(`${API_BASE_URL}/api/ping`, { method: 'GET', cache: 'no-store' });
      if (res.ok) {
        const elapsed = Math.round(performance.now() - start);
        setPingMs(elapsed);
      }
    } catch {
      setPingMs(null);
    }
  };

  // Fetch active multiplayer lobbies and online player count
  const fetchLobbies = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/rooms`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setRooms(data);
        } else if (data && typeof data === 'object') {
          if (Array.isArray(data.rooms)) {
            setRooms(data.rooms);
          }
          if (typeof data.onlineCount === 'number') {
            setOnlinePlayerCount(data.onlineCount);
          }
        }
      }
    } catch (e) {
      console.error('Failed to fetch lobbies', e);
    }
  };

  React.useEffect(() => {
    fetchLobbies();
    measurePing();
    const interval = setInterval(() => {
      fetchLobbies();
      measurePing();
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Admin authentication state & secure secret triggers
  const [isAdminAuthenticated, setIsAdminAuthenticated] = React.useState(() => {
    return localStorage.getItem('deal_master_admin_token') === 'deal-master-admin-token-2026-auth';
  });
  const [showAdminLoginModal, setShowAdminLoginModal] = React.useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = React.useState('');
  const [adminLoginError, setAdminLoginError] = React.useState('');
  const [adminLoginLoading, setAdminLoginLoading] = React.useState(false);
  const [adminClickCount, setAdminClickCount] = React.useState(0);
  const adminClickTimerRef = React.useRef<any>(null);

  // Keyboard shortcut (Ctrl+Shift+A or Alt+Shift+A) for admin login
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') || (e.altKey && e.shiftKey && e.key.toLowerCase() === 'a')) {
        e.preventDefault();
        setShowAdminLoginModal(true);
        setAdminPasswordInput('');
        setAdminLoginError('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Secret logo/footer clicks trigger (5 rapid clicks)
  const handleSecretAdminTrigger = () => {
    setAdminClickCount((prev) => {
      const next = prev + 1;
      if (next >= 5) {
        setShowAdminLoginModal(true);
        setAdminPasswordInput('');
        setAdminLoginError('');
        return 0;
      }
      if (adminClickTimerRef.current) clearTimeout(adminClickTimerRef.current);
      adminClickTimerRef.current = setTimeout(() => {
        setAdminClickCount(0);
      }, 2500);
      return next;
    });
  };

  const handleAdminLoginSubmit = async () => {
    if (!adminPasswordInput.trim() || adminLoginLoading) return;
    setAdminLoginLoading(true);
    setAdminLoginError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPasswordInput })
      });
      const data = await res.json();
      if (res.ok && data.success && data.token) {
        localStorage.setItem('deal_master_admin_token', data.token);
        setIsAdminAuthenticated(true);
        setActiveTab('admin');
        setShowAdminLoginModal(false);
        sounds.playCoin(profile.settings);
      } else {
        setAdminLoginError(data.error || (profile.settings.language === 'en' ? 'Invalid password! Access denied.' : 'Hatalı şifre girdiniz! Erişim reddedildi.'));
      }
    } catch (e) {
      setAdminLoginError('Sunucuya bağlanılamadı.');
    } finally {
      setAdminLoginLoading(false);
    }
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('deal_master_admin_token');
    setIsAdminAuthenticated(false);
    setActiveTab('play');
  };

  // Room joining custom password states
  const [showRoomPasswordModal, setShowRoomPasswordModal] = React.useState(false);
  const [roomPasswordInput, setRoomPasswordInput] = React.useState('');
  const [pendingRoomId, setPendingRoomId] = React.useState('');
  const [createRoomGameMode, setCreateRoomGameMode] = React.useState<'classic' | '2v2_team' | 'chaos' | 'speed'>('classic');
  const [createRoomMaxPlayers, setCreateRoomMaxPlayers] = React.useState<number>(4);

  const handleCreateRoom = (offline: boolean = false) => {
    let prefix = 'oda';
    if (createRoomGameMode === '2v2_team') prefix = 'oda-2v2';
    else if (createRoomGameMode === 'chaos') prefix = 'oda-chaos';
    else if (createRoomGameMode === 'speed') prefix = 'oda-speed';

    const rid = offline
      ? `offline-${Math.random().toString(36).substr(2, 5)}`
      : customRoomId.trim() !== ''
        ? (createRoomGameMode === '2v2_team' && !customRoomId.includes('2v2') ? `2v2-${customRoomId.trim()}` : customRoomId.trim())
        : `${prefix}-${Math.random().toString(36).substr(2, 5)}`;

    sounds.playPlay(profile.settings);
    onJoinRoom(rid, offline, roomPassword.trim() !== '' ? roomPassword.trim() : undefined);
    // Clear room password input field
    setRoomPassword('');
  };

  const generateRandomRoomCode = () => {
    const prefixes = ['KARTAL', 'ASLAN', 'KAPLAN', 'KUPON', 'EJDER', 'YILDIZ', 'TITAN', 'ZIRVE', 'ARENA', 'MONOPOL'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const num = Math.floor(100 + Math.random() * 900);
    setCustomRoomId(`${prefix}-${num}`);
    sounds.playCoin(profile.settings);
  };

  const handleJoinExistingRoom = (roomId: string, hasPassword?: boolean) => {
    sounds.playPlay(profile.settings);
    if (hasPassword) {
      setPendingRoomId(roomId);
      setRoomPasswordInput('');
      setShowRoomPasswordModal(true);
    } else {
      onJoinRoom(roomId, false, undefined);
    }
  };

  const handleClaimQuest = async (questId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/quests/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile.id, questId }),
      });

      if (response.ok) {
        const data = await response.json();
        const updated = {
          ...profile,
          coins: data.coins,
          xp: data.xp !== undefined ? data.xp : profile.xp,
          level: data.level !== undefined ? data.level : profile.level,
          dailyQuests: data.dailyQuests,
        };
        onUpdateProfile(updated);
        sounds.playCoin(profile.settings);
      }
    } catch (e) {
      console.error('Failed to claim quest reward', e);
    }
  };

  const isEn = profile?.settings?.language === 'en' || localStorage.getItem('language') === 'en';

  return (
    <div id="main-menu" className="min-h-screen min-h-[100dvh] bg-[#07080b] text-zinc-100 font-sans flex flex-col justify-between relative overflow-x-clip overflow-y-visible selection:bg-red-500/20 pb-24 sm:pb-8">
      {/* Premium ambient decorative radial lights */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-red-950/5 rounded-full filter blur-[100px] pointer-events-none" />
      <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-zinc-800/5 rounded-full filter blur-[80px] pointer-events-none" />

      {/* Top Header bar */}
      <header className="border-b border-zinc-900/60 bg-zinc-950/50 backdrop-blur-xl px-2.5 sm:px-8 py-2.5 sm:py-3.5 flex items-center justify-between sticky top-0 z-40 max-w-full overflow-hidden">
        <div onClick={handleSecretAdminTrigger} className="flex items-center gap-2 sm:gap-3 flex-shrink-0 cursor-pointer select-none" title="Deal Master PRO">
          <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-red-600 to-red-800 rounded-xl flex items-center justify-center font-black text-base sm:text-lg shadow-lg shadow-red-900/10 text-white italic tracking-tighter">
            D
          </div>
          <div>
            <h1 className="text-xs sm:text-base font-black tracking-tight uppercase italic text-white leading-none flex items-center gap-1">
              Deal Master <span className="text-[9px] sm:text-xs bg-red-600/10 text-red-500 font-extrabold px-1 sm:px-1.5 py-0.5 rounded border border-red-500/10 italic">PRO</span>
            </h1>
            <span className="text-[7.5px] sm:text-[9px] text-zinc-500 font-bold tracking-widest hidden sm:block uppercase mt-1">MOBİL & WEB DESTEKLİ</span>
          </div>
        </div>

        {/* Quick User summary */}
        <div className="flex items-center gap-1 sm:gap-4 overflow-x-auto sm:overflow-visible no-scrollbar max-w-[calc(100vw-120px)] sm:max-w-none justify-end">
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {isOfflineMode ? (
              <div className="flex items-center gap-1.5 bg-amber-950/40 text-amber-300 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-xl border border-amber-500/30 text-[9px] sm:text-xs font-black shadow-sm" title={t('offline_mode_tooltip', profile)}>
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-amber-400 animate-pulse" />
                <span>{t('offline_badge_text', profile)}</span>
              </div>
            ) : (
              <>
                {/* Online Players Indicator */}
                <div className="flex items-center gap-1 bg-emerald-950/40 text-emerald-400 px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-xl border border-emerald-500/20 text-[9px] sm:text-xs font-bold shadow-sm" title="Anlık Çevrimiçi Oyuncu Sayısı">
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                  <span className="hidden md:inline">Canlı:</span>
                  <span>{onlinePlayerCount} <span className="hidden xs:inline">Online</span></span>
                </div>

                {/* Connection Ping Indicator */}
                <div
                  className={`flex items-center gap-1 px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-xl border text-[9px] sm:text-xs font-mono font-bold shadow-sm transition-all ${pingMs === null
                      ? 'bg-zinc-900/40 text-zinc-500 border-zinc-800/80'
                      : pingMs < 80
                        ? 'bg-emerald-950/30 text-emerald-400 border-emerald-500/20'
                        : pingMs < 160
                          ? 'bg-amber-950/30 text-amber-400 border-amber-500/20'
                          : 'bg-red-950/30 text-red-400 border-red-500/20'
                    }`}
                  title={pingMs !== null ? `Sunucu Yanıt Gecikmesi: ${pingMs}ms` : 'Bağlantı Kalitesi Ölçülüyor...'}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${pingMs === null
                        ? 'bg-zinc-500'
                        : pingMs < 80
                          ? 'bg-emerald-400'
                          : pingMs < 160
                            ? 'bg-amber-400'
                            : 'bg-red-500 animate-ping'
                      }`}
                  />
                  <span>{pingMs !== null ? `${pingMs}ms` : '---'}</span>
                </div>
              </>
            )}

            <div className="flex items-center gap-1 bg-zinc-900/40 px-2 py-0.5 sm:px-3 sm:py-1.5 rounded-xl border border-zinc-800/80">
              <Coins className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500" />
              <span className="text-[9px] sm:text-xs font-mono font-bold text-amber-400">{profile.coins}</span>
            </div>

            {/* Quick Language Toggle */}
            <div className="flex items-center bg-zinc-900/40 px-0.5 py-0.5 sm:px-1 sm:py-1 rounded-xl border border-zinc-800/80 text-[9px] sm:text-xs">
              <button
                onClick={async () => {
                  const currentLang = profile?.settings?.language || localStorage.getItem('language') || 'tr';
                  const nextLang = currentLang === 'tr' ? 'en' : 'tr';
                  changeLanguage(nextLang);
                  const updated = {
                    ...profile,
                    settings: { ...profile.settings, language: nextLang }
                  };
                  onUpdateProfile(updated);
                  sounds.playPlay(profile.settings);
                  // Persist to server
                  await fetch(`${API_BASE_URL}/api/settings/save`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: profile.id, settings: { language: nextLang } }),
                  });
                }}
                className="hover:text-red-400 text-zinc-400 transition-colors uppercase font-bold cursor-pointer px-1.5 flex items-center gap-0.5"
              >
                🌐 {(profile.settings.language || 'tr') === 'tr' ? 'EN' : 'TR'}
              </button>
            </div>
          </div>

          <div
            onClick={() => {
              setShowProfileOperationsModal(true);
              sounds.playPlay(profile.settings);
            }}
            title="Profil ve Hesap İşlemleri"
            className="flex items-center gap-1.5 sm:gap-3 border-l border-zinc-900/80 pl-2 sm:pl-5 cursor-pointer hover:opacity-90 transition-all select-none group flex-shrink-0"
          >
            <div className="text-right hidden sm:block">
              <p className="text-[10px] text-zinc-500 font-bold leading-none flex items-center gap-1.5 justify-end">
                <span>LVL {profile.level}</span>
                <span className="text-[8px] bg-zinc-800 text-zinc-400 font-extrabold px-1 py-0.5 rounded uppercase tracking-wider group-hover:bg-red-950 group-hover:text-red-400 transition-all border border-zinc-700/50 group-hover:border-red-900/40">GÜNCELLE</span>
              </p>
              <div className="flex items-center gap-2 justify-end mt-1.5">
                <span className="text-xs sm:text-sm font-bold text-zinc-300 leading-none">{profile.username}</span>
                {(() => {
                  const league = getLeagueTier(profile.rankPoints ?? 0);
                  return (
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded flex items-center gap-1 border ${league.color}`}>
                      <span>{league.icon}</span>
                      <span>{league.name} ({profile.rankPoints ?? 0} RP)</span>
                    </span>
                  );
                })()}
              </div>
            </div>

            {/* XP Ring Progress Gauge (Improvement #18) */}
            <div className="relative flex items-center justify-center p-0.5">
              <svg className="w-8 h-8 sm:w-10 sm:h-10 absolute transform -rotate-90 pointer-events-none">
                <circle cx="16" cy="16" r="13" className="sm:cx-20 sm:cy-20 sm:r-17" stroke="rgba(255,255,255,0.03)" strokeWidth="2" fill="transparent" />
                <circle
                  cx="16"
                  cy="16"
                  r="13"
                  className="sm:cx-20 sm:cy-20 sm:r-17"
                  stroke="#ef4444"
                  strokeWidth="2"
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 13}
                  strokeDashoffset={2 * Math.PI * 13 * (1 - Math.min(Math.max((profile.xp % 100) / 100, 0), 0.999))}
                  strokeLinecap="round"
                  style={{
                    transition: 'stroke-dashoffset 0.8s ease-in-out',
                  }}
                />
              </svg>
              <AvatarWithFrame
                avatarId={profile.avatarId}
                avatarUrl={profile.avatarUrl}
                frameId={profile.settings.profileFrame || 'frame_none'}
                sizeClassName="w-6 h-6 sm:w-8 sm:h-8 text-[8px] sm:text-[10px]"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout Grid */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6 items-start z-10">

        {/* Navigation Sidebar */}
        <nav className="lg:col-span-1 flex flex-col gap-5">
          <div className="bg-zinc-950/40 border border-zinc-900/85 rounded-2xl p-2.5 flex flex-row lg:flex-col gap-1.5 overflow-x-auto lg:overflow-x-visible pb-3.5 lg:pb-2.5 whitespace-nowrap scrollbar-none w-full">
            {[
              { id: 'play', label: profile.settings.language === 'en' ? '🎮 Lobby & Tables' : '🎮 Lobi Salonu & Masalar', icon: Play, color: 'hover:text-red-400' },
              { id: 'bot_practice', label: t('tab_bot_practice', profile) || '🤖 Bot Pratik', icon: Bot, color: 'hover:text-red-400' },
              { id: 'tournaments', label: '🏆 Kupa Turnuvaları', icon: Trophy, badge: 'ÖDÜLLÜ', color: 'hover:text-amber-400', special: true },
              { id: 'cards', label: t('tab_cards', profile) || '🃏 Kartlar', icon: Layers, badge: '106 KART', color: 'hover:text-red-400' },
              (!adminSettings || adminSettings.rankedLeagueEnabled !== false) && { id: 'leaderboard', label: t('tab_leaderboard', profile) || '🌍 Sıralama', icon: Award, color: 'hover:text-red-400' },
              { id: 'shop', label: t('tab_shop', profile) || '✨ Mağaza', icon: Sparkles, color: 'hover:text-red-400' },
              { id: 'customization', label: t('tab_customize', profile) || '🎨 Özelleştir', icon: Layout, color: 'hover:text-red-400' },
              { id: 'profile', label: t('tab_profile', profile) || '👤 Profil', icon: UserIcon, color: 'hover:text-red-400' },
              { id: 'rules', label: t('tab_rules', profile) || '📖 Kurallar', icon: BookOpen, color: 'hover:text-red-400' },
              isAdminAuthenticated && { id: 'admin', label: t('tab_admin', profile) || '🛡️ Yönetici ', icon: Shield, color: 'hover:text-amber-500', special: true },
            ].filter(Boolean).map((tab: any) => {
              const IconComp = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    sounds.playPlay(profile.settings);
                  }}
                  className={`flex-shrink-0 lg:w-full text-left px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-between gap-3.5 ${isActive
                      ? tab.special
                        ? 'bg-amber-500/20 border-l-2 border-amber-400 text-amber-300 font-black shadow-lg shadow-amber-500/10'
                        : 'bg-zinc-900/60 border-l-2 border-red-500 text-red-400 font-extrabold shadow-sm'
                      : tab.special
                        ? 'bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 font-bold'
                        : `text-zinc-400 ${tab.color} hover:bg-zinc-900/20`
                    }`}
                >
                  <div className="flex items-center gap-2.5">
                    <IconComp className={`w-4 h-4 ${isActive ? (tab.special ? 'text-amber-300' : 'text-red-400') : (tab.special ? 'text-amber-400' : 'text-zinc-500')}`} />
                    <span>{tab.label}</span>
                  </div>
                  {tab.badge && (
                    <span className="text-[8px] font-black uppercase px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      {tab.badge}
                    </span>
                  )}
                  {isActive && !tab.badge && <span className="text-red-500 text-xs hidden lg:inline-block">●</span>}
                </button>
              );
            })}
          </div>

          {/* Lucky Wheel Promo Card */}
          {(!adminSettings || adminSettings.wheelEnabled !== false) && (
            <div className="bg-gradient-to-br from-indigo-950/40 to-slate-900/60 border border-yellow-500/20 rounded-2xl p-4.5 space-y-3 shadow-md relative overflow-hidden group">
              {/* Decorative background glow */}
              <div className="absolute -right-6 -bottom-6 w-16 h-16 rounded-full bg-yellow-500/10 blur-xl group-hover:scale-150 transition-all duration-500 pointer-events-none" />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold text-sm">
                    🎡
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-100 uppercase tracking-wide">
                      {t('lucky_wheel', profile)}
                    </h4>
                    <span className="text-[10px] text-yellow-400/90 font-bold block">
                      Ücretsiz Ödüller!
                    </span>
                  </div>
                </div>
                <Sparkles className="w-3.5 h-3.5 text-yellow-400 animate-pulse shrink-0" />
              </div>

              <p className="text-[10px] sm:text-[11px] text-slate-400 leading-relaxed">
                Her saat başı ücretsiz çevir, Gold ve XP kazan veya bekleme süresini reklam izleyerek atla!
              </p>

              <button
                onClick={() => {
                  sounds.playPlay(profile.settings);
                  setShowLuckyWheel(true);
                }}
                className="w-full py-2.5 bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-slate-950 text-xs font-extrabold uppercase tracking-wider rounded-xl transition shadow-md hover:shadow-yellow-500/10 active:scale-95 cursor-pointer"
              >
                Çarkı Çevir
              </button>
            </div>
          )}

          {/* Persistent Stats & History Cards (Visible on Desktop) */}
          <div className="hidden lg:flex flex-col gap-5 w-full">
            {/* Statistics Card */}
            <div className="bg-zinc-950/20 border border-zinc-900/80 rounded-2xl p-4.5 space-y-4">
              <div className="flex items-center gap-2.5 border-b border-zinc-900/80 pb-2.5">
                <Layout className="w-3.5 h-3.5 text-red-500" />
                <h3 className="font-extrabold text-xs uppercase tracking-widest text-zinc-400">
                  {isEn ? 'Statistics' : 'İstatistikler'}
                </h3>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-zinc-900/30 border border-zinc-900 rounded-xl p-2.5 text-center">
                  <span className="text-sm font-black text-emerald-400 block">{profile.stats.gamesWon}</span>
                  <span className="text-[8px] text-zinc-500 block uppercase font-bold tracking-wider mt-0.5">{t('wins', profile)}</span>
                </div>
                <div className="bg-zinc-900/30 border border-zinc-900 rounded-xl p-2.5 text-center">
                  <span className="text-sm font-black text-zinc-400 block">{profile.stats.gamesLost}</span>
                  <span className="text-[8px] text-zinc-500 block uppercase font-bold tracking-wider mt-0.5">{t('losses', profile)}</span>
                </div>
                <div className="bg-zinc-900/30 border border-zinc-900 rounded-xl p-2.5 text-center">
                  <span className="text-sm font-black text-amber-400 block">
                    {profile.stats.gamesPlayed > 0 ? Math.round((profile.stats.gamesWon / profile.stats.gamesPlayed) * 100) : 0}%
                  </span>
                  <span className="text-[8px] text-zinc-500 block uppercase font-bold tracking-wider mt-0.5">{t('win_rate', profile)}</span>
                </div>
              </div>
            </div>

            {/* Game History Card */}
            <div className="bg-zinc-950/20 border border-zinc-900/80 rounded-2xl p-4.5 space-y-3.5">
              <div className="flex items-center justify-between border-b border-zinc-900/80 pb-2.5">
                <div className="flex items-center gap-2.5">
                  <BookOpen className="w-3.5 h-3.5 text-red-500" />
                  <h3 className="font-extrabold text-xs uppercase tracking-widest text-zinc-400">{t('game_history', profile)}</h3>
                </div>
                {profile.gamesHistory && profile.gamesHistory.length > 0 && (
                  <span className="text-[8px] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                    {t('wins_count', profile, profile.gamesHistory.length)}
                  </span>
                )}
              </div>

              <div className="space-y-2 max-h-[220px] overflow-y-auto scrollbar-none">
                {!profile.gamesHistory || profile.gamesHistory.length === 0 ? (
                  <div className="text-center py-7 text-zinc-600">
                    <span className="text-xl block mb-2 select-none">🎮</span>
                    <p className="text-[10px] leading-relaxed">
                      {isEn ? <>No matches played yet.<br />Join the arena to start!</> : <>Henüz oyun oynanmadı.<br />Arenaya katılarak hemen başla!</>}
                    </p>
                  </div>
                ) : (
                  profile.gamesHistory.slice(0, 3).map((game) => (
                    <div key={game.id} className="bg-zinc-900/20 border border-zinc-900/60 rounded-xl p-2.5 flex items-center justify-between text-xs gap-3">
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${game.result === 'won' ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                          <span className="font-extrabold text-zinc-300 text-[10px]">
                            {game.result === 'won' ? (isEn ? 'Victory' : 'Zafer') : (isEn ? 'Defeat' : 'Bozgun')}
                          </span>
                          <span className="text-[8px] text-zinc-500 font-mono flex-shrink-0">{game.date.split(' ')[0]}</span>
                        </div>
                        <p className="text-[9px] text-zinc-400 truncate max-w-[100px]">vs {game.opponent}</p>
                      </div>
                      <div className="text-right flex flex-col items-end flex-shrink-0">
                        <span className="text-[9px] font-bold text-amber-400 font-mono">+{game.coinsEarned}💰</span>
                        <span className="text-[8px] font-semibold text-zinc-500 font-mono">+{game.xpEarned} XP</span>
                        {game.rankPointsEarned !== undefined && (
                          <span className={`text-[8px] font-black font-mono px-1 rounded mt-0.5 ${game.rankPointsEarned >= 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'}`}>
                            {game.rankPointsEarned >= 0 ? `+${game.rankPointsEarned}` : game.rankPointsEarned} RP
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </nav>

        {/* Content Panel Area */}
        <div className="lg:col-span-3 space-y-6">
          {/* Daily Quests Widget on Main Menu */}
          {(activeTab === 'play' || activeTab === 'bot_practice' || activeTab === 'tournaments') && profile.dailyQuests && (!adminSettings || adminSettings.questsEnabled !== false) && (
            <div className={`bg-zinc-950/30 border border-zinc-900/80 rounded-2xl relative overflow-hidden transition-all duration-300 ${questsExpanded ? 'p-4 space-y-4' : 'p-3'}`}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/5 rounded-full filter blur-2xl pointer-events-none" />
              <div
                onClick={() => {
                  setQuestsExpanded(!questsExpanded);
                  sounds.playPlay(profile.settings);
                }}
                className={`flex items-center justify-between cursor-pointer select-none group ${questsExpanded ? 'border-b border-zinc-900/80 pb-3' : ''}`}
              >
                <div className="flex items-center gap-2.5">
                  <Calendar className="w-4 h-4 text-red-500 group-hover:scale-110 transition-transform" />
                  <div>
                    <h3 className="font-extrabold text-xs sm:text-sm text-zinc-100 flex items-center gap-2">
                      <span>{t('daily_special_quests', profile)}</span>
                      <span className="text-[9px] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full font-bold">
                        {profile.dailyQuests.filter(q => q.completed).length} / {profile.dailyQuests.length} {profile.settings.language === 'tr' ? 'Tamamlandı' : 'Completed'}
                      </span>
                    </h3>
                    <p className="text-[10px] text-zinc-500 mt-0.5">{t('complete_quests_to_earn', profile)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] bg-zinc-900/40 text-zinc-400 border border-zinc-800/60 px-2.5 py-1 rounded-xl font-bold uppercase tracking-wider group-hover:text-red-400 transition-colors">
                    {questsExpanded ? (profile.settings.language === 'tr' ? 'Gizle' : 'Hide') : (profile.settings.language === 'tr' ? 'Göster' : 'Show')}
                  </span>
                  {questsExpanded ? (
                    <ChevronUp className="w-4 h-4 text-zinc-400 group-hover:text-red-400 transition-colors" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-zinc-400 group-hover:text-red-400 transition-colors" />
                  )}
                </div>
              </div>

              {questsExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  transition={{ duration: 0.2 }}
                  className="grid grid-cols-1 md:grid-cols-3 gap-3"
                >
                  {profile.dailyQuests.map((quest) => {
                    const percent = Math.min(100, (quest.currentValue / quest.targetValue) * 100);
                    return (
                      <div key={quest.id} className="bg-zinc-900/10 border border-zinc-900/60 rounded-xl p-3 flex flex-col justify-between gap-3 hover:border-zinc-800 transition-all duration-200">
                        <div>
                          <span className="text-xs text-zinc-300 font-bold block min-h-[32px] leading-snug">
                            {t(quest.description, profile)}
                          </span>

                          <div className="space-y-1.5 mt-2">
                            <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden border border-zinc-800/40">
                              <div
                                className="bg-gradient-to-r from-red-600 to-red-500 h-full transition-all duration-500"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-[9px] text-zinc-500 font-bold uppercase tracking-wider">
                              <span>{t('progress_lbl', profile)}</span>
                              <span className="font-mono">{quest.currentValue} / {quest.targetValue}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-zinc-900/60 pt-2">
                          <div className="flex flex-col text-[9px] gap-0.5">
                            <span className="text-amber-400 font-bold font-mono">
                              💰 +{quest.rewardCoins} Altın
                            </span>
                            <span className="text-red-400 font-bold font-mono">
                              ⚡ +{quest.rewardXp !== undefined ? quest.rewardXp : 30} XP
                            </span>
                          </div>

                          {quest.claimed ? (
                            <span className="text-[9px] text-zinc-600 font-extrabold bg-zinc-900/30 px-2 py-1 rounded border border-zinc-800/40 uppercase tracking-wider">
                              Alındı
                            </span>
                          ) : quest.completed ? (
                            <button
                              onClick={() => handleClaimQuest(quest.id)}
                              className="px-2.5 py-1.5 bg-red-600 hover:bg-red-500 text-white font-extrabold text-[9px] rounded-lg transition-all shadow-sm shadow-red-600/20 uppercase tracking-wider cursor-pointer"
                            >
                              Ödülü Al
                            </button>
                          ) : (
                            <span className="text-[9px] text-zinc-500 font-bold bg-zinc-900/20 px-2 py-1 rounded border border-zinc-800/20 uppercase tracking-wider">
                              Bekliyor
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </motion.div>
              )}
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >

              {/* TAB 1: Multiplayer Hub (Clean & Modern Architecture) */}
              {activeTab === 'play' && (
                <div className="space-y-5">
                  {/* Offline helper banner */}
                  {isOfflineMode && (
                    <div className="p-4 bg-gradient-to-r from-amber-950/50 via-slate-900 to-amber-950/50 border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
                      <div className="flex items-center gap-3 text-left">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-xl shrink-0">
                          📴
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-amber-300 uppercase tracking-wide">
                            {t('offline_banner_title', profile)}
                          </h4>
                          <p className="text-[10px] text-zinc-400">
                            {t('offline_banner_desc', profile)}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('bot_practice');
                          sounds.playPlay(profile.settings);
                        }}
                        className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
                      >
                        {t('go_to_bot_practice', profile)}
                      </button>
                    </div>
                  )}

                  {/* Top Segmented Sub-Mode Switcher */}
                  <div className="bg-zinc-950/70 border border-zinc-900 p-1.5 rounded-2xl flex flex-col sm:flex-row items-center gap-2 shadow-xl backdrop-blur-xl">
                    {[
                      {
                        id: 'custom_room',
                        icon: '🎮',
                        label: profile.settings.language === 'en' ? 'Custom Rooms (Create & Join)' : 'Özel Oda (Kur & Katıl)',
                        desc: profile.settings.language === 'en' ? 'Create a private room or join with a code' : 'Oda kur veya kod ile katıl',
                      },
                      {
                        id: 'active_rooms',
                        icon: '🌐',
                        label: profile.settings.language === 'en' ? 'Lobby Hall (Active & Locked Rooms)' : 'Lobi Salonu (Canlı & Şifreli Masalar)',
                        badge: rooms.length > 0 ? `${rooms.length}` : undefined,
                        badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
                        desc: profile.settings.language === 'en' ? 'Browse active lobbies, filter locked & open tables' : 'Açık masalar, şifreli odalar ve canlı lobiler',
                      },
                    ].map((mode) => {
                      const isActive = multiplayerMode === mode.id;
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => {
                            setMultiplayerMode(mode.id as any);
                            sounds.playPlay(profile.settings);
                          }}
                          className={`w-full sm:flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-extrabold transition-all duration-200 flex items-center justify-between gap-2 select-none cursor-pointer ${isActive
                              ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg shadow-red-600/25 scale-[1.01]'
                              : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                            }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-lg">{mode.icon}</span>
                            <div className="text-left min-w-0">
                              <span className="truncate block font-black">{mode.label}</span>
                              <span className={`text-[9px] block truncate font-medium ${isActive ? 'text-red-100' : 'text-zinc-500'}`}>{mode.desc}</span>
                            </div>
                          </div>
                          {mode.badge && (
                            <span
                              className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border shrink-0 ${isActive ? 'bg-white/20 text-white border-white/30' : mode.badgeColor || 'bg-zinc-800 text-zinc-400 border-zinc-700'
                                }`}
                            >
                              {mode.badge} CANLI
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* ────────────────────────────────────────────────────────
                      SUB-TAB: 🎮 ÖZEL ODA KUR & KODLA KATIL (PREMIUM REDESIGN)
                  ──────────────────────────────────────────────────────── */}
                  {multiplayerMode === 'custom_room' && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                      {/* CARD A: Özel Oda Oluştur (7 Columns on large) */}
                      <div className="lg:col-span-7 relative rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 via-zinc-950 to-zinc-900/90 shadow-2xl p-4 sm:p-7 space-y-6">
                        {/* Ambient glow */}
                        <div className="absolute -top-20 -left-20 w-52 h-52 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
                        <div className="absolute -bottom-20 -right-20 w-48 h-48 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

                        {/* Header */}
                        <div className="relative flex items-center justify-between border-b border-white/8 pb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-red-600 to-amber-600 p-0.5 shadow-lg shadow-red-600/20">
                              <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center text-xl">
                                🛠️
                              </div>
                            </div>
                            <div>
                              <h3 className="text-sm sm:text-base font-black text-white tracking-wide uppercase">
                                {isEn ? 'Create Custom Game Room' : 'Özel Oyun Odası Kur'}
                              </h3>
                              <p className="text-[10.5px] text-zinc-400 font-medium">
                                {isEn ? 'Set rules, invite friends or open a public table' : 'Kuralları belirleyin, arkadaşlarınızı davet edin veya açık masa açın'}
                              </p>
                            </div>
                          </div>

                          <span className="hidden sm:inline-flex text-[9px] font-black uppercase px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/25">
                            {isEn ? 'ROOM HOST' : 'ODA SAHİBİ'}
                          </span>
                        </div>

                        {/* Game Mode Selection */}
                        <div className="relative space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                              <span>{isEn ? '1. Select Game Mode' : '1. Oyun Modunu Seçin'}</span>
                            </span>
                            <span className="text-[9px] text-zinc-500 font-bold uppercase">
                              {createRoomGameMode === 'classic' && (isEn ? '🎲 Classic Rules' : '🎲 Klasik Kurallar')}
                              {createRoomGameMode === '2v2_team' && (isEn ? '⚔️ 2v2 Team Battle' : '⚔️ 2v2 Takım Savaşı')}
                              {createRoomGameMode === 'speed' && (isEn ? '⚡ Speed Lightning' : '⚡ Hızlı Yıldırım')}
                              {createRoomGameMode === 'chaos' && (isEn ? '🌀 Chaos & Events' : '🌀 Kaos & Olaylar')}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {[
                              {
                                id: 'classic',
                                emoji: '🎲',
                                label: isEn ? 'Classic Mode' : 'Klasik Mod',
                                subtitle: isEn ? '3 Full Sets' : '3 Tam Set',
                                desc: isEn ? 'Original Monopoly Deal rules. All action and rent cards enabled.' : 'Orijinal Monopoly Deal kuralları. Tüm aksiyon ve kira kartları devrede.',
                                tag: isEn ? 'STANDARD' : 'STANDART',
                                activeBorder: 'border-amber-500/60 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.15)] text-amber-300',
                                activeTag: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
                              },
                              {
                                id: '2v2_team',
                                emoji: '⚔️',
                                label: isEn ? '2v2 Team' : '2v2 Takım',
                                subtitle: isEn ? 'Shared 4 Sets' : 'Ortak 4 Set',
                                desc: isEn ? 'Blue vs Red! Complete shared sets with your teammate, make strategic plays.' : 'Mavi vs Kırmızı! Takım arkadaşınla ortak set tamamla, stratejik hamleler yap.',
                                tag: isEn ? 'TEAM' : 'TAKIM',
                                activeBorder: 'border-indigo-500/60 bg-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.15)] text-indigo-300',
                                activeTag: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
                              },
                              {
                                id: 'speed',
                                emoji: '⚡',
                                label: isEn ? 'Speed Lightning' : 'Hızlı Yıldırım',
                                subtitle: isEn ? '15s / 2 Sets' : '15sn / 2 Set',
                                desc: isEn ? 'Only 15 seconds per turn! Make quick decisions, collect 2 full sets first to win.' : 'Her tur sadece 15 saniye! Seri kararlar ver, 2 tam set toplayıp ilk sen bitir.',
                                tag: isEn ? 'FAST PACED' : 'TEMPOLU',
                                activeBorder: 'border-red-500/60 bg-red-500/10 shadow-[0_0_15px_rgba(239,68,68,0.15)] text-red-300',
                                activeTag: 'bg-red-500/20 text-red-300 border-red-500/40',
                              },
                              {
                                id: 'chaos',
                                emoji: '🌀',
                                label: isEn ? 'Chaos Arena' : 'Kaos Arenası',
                                subtitle: isEn ? 'Special Powers' : 'Özel Güçler',
                                desc: isEn ? 'Random turn events, mystery chaos cards and extraordinary powers.' : 'Rastgele tur olayları, gizemli kaos kartları ve sıra dışı güçler.',
                                tag: isEn ? 'SPECIAL' : 'ÖZEL',
                                activeBorder: 'border-purple-500/60 bg-purple-500/10 shadow-[0_0_15px_rgba(168,85,247,0.15)] text-purple-300',
                                activeTag: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
                              },
                            ].map((mode) => {
                              const isSelected = createRoomGameMode === mode.id;
                              return (
                                <button
                                  key={mode.id}
                                  type="button"
                                  onClick={() => {
                                    setCreateRoomGameMode(mode.id as any);
                                    sounds.playCoin(profile.settings);
                                  }}
                                  className={`group p-3 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between gap-2 relative overflow-hidden ${isSelected
                                      ? mode.activeBorder
                                      : 'bg-white/3 border-white/8 hover:bg-white/6 hover:border-white/15 text-zinc-300'
                                    }`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xl shrink-0 group-hover:scale-110 transition-transform">{mode.emoji}</span>
                                      <div>
                                        <span className="text-xs font-black block leading-none">{mode.label}</span>
                                        <span className="text-[9px] text-zinc-500 font-bold block mt-0.5">{mode.subtitle}</span>
                                      </div>
                                    </div>
                                    <span
                                      className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border ${isSelected ? mode.activeTag : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                                        }`}
                                    >
                                      {mode.tag}
                                    </span>
                                  </div>

                                  <p className="text-[9.5px] text-zinc-400 leading-snug line-clamp-2">
                                    {mode.desc}
                                  </p>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Player Count */}
                        <div className="relative space-y-2">
                          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">
                            {isEn ? '2. Table Player Capacity:' : '2. Masa Oyuncu Kapasitesi:'}
                          </span>
                          <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                            {[
                              { count: 2, label: '1v1', sub: isEn ? 'Duel' : 'Düello' },
                              { count: 3, label: '3P', sub: isEn ? 'Trio' : 'Trio' },
                              { count: 4, label: '4P', sub: isEn ? 'Classic' : 'Klasik' },
                              { count: 5, label: '5P', sub: isEn ? 'Group' : 'Grup' },
                              { count: 6, label: '6P', sub: isEn ? 'Party' : 'Parti' },
                            ].map((p) => {
                              const isSelected = createRoomMaxPlayers === p.count;
                              return (
                                <button
                                  key={p.count}
                                  type="button"
                                  onClick={() => {
                                    setCreateRoomMaxPlayers(p.count);
                                    sounds.playCoin(profile.settings);
                                  }}
                                  className={`py-2.5 px-1 rounded-2xl border text-center transition-all duration-200 cursor-pointer flex flex-col items-center justify-center ${isSelected
                                      ? 'bg-gradient-to-b from-indigo-600/30 to-indigo-900/40 border-indigo-500 text-white shadow-lg shadow-indigo-500/20 scale-[1.03]'
                                      : 'bg-white/3 border-white/8 text-zinc-400 hover:bg-white/6 hover:text-zinc-200'
                                    }`}
                                >
                                  <span className="text-xs font-black">{p.label}</span>
                                  <span className="text-[8px] font-bold text-zinc-500 uppercase">{p.sub}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Custom Code & Password Settings */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                                {isEn ? 'Custom Room Code:' : 'Özel Oda Kodu:'}
                              </span>
                              <button
                                type="button"
                                onClick={generateRandomRoomCode}
                                className="text-[9px] text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <span>🎲</span>
                                <span>{isEn ? 'Generate Random' : 'Rastgele Üret'}</span>
                              </button>
                            </div>
                            <input
                              type="text"
                              placeholder={isEn ? 'e.g., EAGLE-777 or MyRoom' : 'örn. KARTAL-777 veya Odam'}
                              value={customRoomId}
                              onChange={(e) => setCustomRoomId(e.target.value)}
                              className="w-full bg-white/4 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-red-500/60 font-mono uppercase font-bold"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1">
                              <span>{isEn ? '🔒 Room Password (Optional):' : '🔒 Oda Şifresi (İsteğe Bağlı):'}</span>
                            </span>
                            <input
                              type="password"
                              placeholder={isEn ? 'Leave empty = Public for Everyone' : 'Boş bırak = Herkese Açık'}
                              value={roomPassword}
                              onChange={(e) => setRoomPassword(e.target.value)}
                              className="w-full bg-white/4 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-red-500/60"
                            />
                          </div>
                        </div>

                        {/* Create Room Launch Button */}
                        <button
                          type="button"
                          onClick={() => handleCreateRoom(false)}
                          className="w-full py-4 bg-gradient-to-r from-red-600 via-red-500 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-black rounded-2xl text-xs sm:text-sm uppercase tracking-widest transition-all shadow-xl shadow-red-600/25 active:scale-[0.98] transform flex items-center justify-center gap-2.5 cursor-pointer"
                        >
                          <span className="text-base">🚀</span>
                          <span>{isEn ? 'Create Room & Enter Table' : 'Odayı Oluştur ve Masaya Geç'}</span>
                        </button>
                      </div>

                      {/* CARD B: Kodu Girerek Katıl (5 Columns on large) */}
                      <div className="lg:col-span-5 relative rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 via-zinc-950 to-slate-950 shadow-2xl p-4 sm:p-7 flex flex-col justify-between gap-6">
                        {/* Ambient glow */}
                        <div className="absolute -top-20 -right-20 w-48 h-48 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

                        <div className="space-y-5">
                          {/* Header */}
                          <div className="flex items-center gap-3 border-b border-white/8 pb-4">
                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-600 to-green-600 p-0.5 shadow-lg shadow-emerald-600/20">
                              <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center text-xl">
                                🔑
                              </div>
                            </div>
                            <div>
                              <h3 className="text-sm sm:text-base font-black text-white tracking-wide uppercase">
                                {isEn ? 'Connect with Room Code' : 'Oda Koduna Bağlan'}
                              </h3>
                              <p className="text-[10.5px] text-zinc-400 font-medium">
                                {isEn ? 'Join table instantly with the code shared by your friend' : 'Arkadaşınızın paylaştığı kodla anında masaya oturun'}
                              </p>
                            </div>
                          </div>

                          {/* Code Entry Input */}
                          <div className="space-y-3.5">
                            <div className="space-y-1.5">
                              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">
                                {isEn ? 'Enter Lobby / Room Code:' : 'Lobi / Oda Kodunu Girin:'}
                              </span>
                              <div className="relative">
                                <input
                                  type="text"
                                  placeholder={isEn ? 'E.G. ROOM-123 OR EAGLE-777' : 'ÖRN. ODA-123 VEYA KARTAL-777'}
                                  value={joinRoomCodeInput}
                                  onChange={(e) => setJoinRoomCodeInput(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && joinRoomCodeInput.trim()) {
                                      handleJoinExistingRoom(joinRoomCodeInput.trim(), false);
                                    }
                                  }}
                                  className="w-full bg-white/4 border-2 border-white/10 rounded-2xl px-4 py-3.5 text-sm sm:text-base text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 focus:bg-emerald-950/10 font-mono uppercase font-black tracking-wider transition-all"
                                />
                                {joinRoomCodeInput && (
                                  <button
                                    type="button"
                                    onClick={() => setJoinRoomCodeInput('')}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-xs font-bold"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Direct Join Button */}
                            <button
                              type="button"
                              onClick={() => {
                                if (!joinRoomCodeInput.trim()) return;
                                handleJoinExistingRoom(joinRoomCodeInput.trim(), false);
                              }}
                              disabled={!joinRoomCodeInput.trim()}
                              className={`w-full py-4 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-widest transition-all duration-200 flex items-center justify-center gap-2.5 ${joinRoomCodeInput.trim()
                                  ? 'bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 text-white shadow-xl shadow-emerald-600/25 active:scale-[0.98] transform cursor-pointer'
                                  : 'bg-zinc-900 border border-zinc-800 text-zinc-600 cursor-not-allowed'
                                }`}
                            >
                              <span>🔑</span>
                              <span>{isEn ? 'Join Room' : 'Odaya Katıl'}</span>
                            </button>
                          </div>

                          {/* Quick Guide / Help Box */}
                          <div className="bg-zinc-900/40 border border-zinc-800/80 p-4 rounded-2xl space-y-2">
                            <div className="flex items-center gap-2 text-amber-400">
                              <Sparkles className="w-4 h-4 shrink-0" />
                              <span className="text-xs font-bold uppercase tracking-wider">
                                {isEn ? 'Quick Tips' : 'Hızlı İpuçları'}
                              </span>
                            </div>
                            <ul className="text-[10px] text-zinc-400 space-y-1 leading-relaxed list-disc list-inside">
                              <li>{isEn ? 'You can share the room code via WhatsApp or direct messages.' : 'Oda kodunu WhatsApp veya mesajla arkadaşlarınızla paylaşabilirsiniz.'}</li>
                              <li>{isEn ? 'When the host starts the game, everyone enters automatically.' : 'Oda sahibi oyunu başlattığında herkes otomatik olarak oyuna girer.'}</li>
                              <li>{isEn ? 'The first player to complete 3 full property sets wins.' : '3 tam arsa setini ilk tamamlayan oyuncu oyunu kazanır.'}</li>
                            </ul>
                          </div>
                        </div>

                        {/* How to Play helper */}
                        <div className="bg-white/2 border border-white/6 p-3.5 rounded-2xl flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <BookOpen className="w-4 h-4 text-amber-400 shrink-0" />
                            <div>
                              <span className="text-xs font-bold text-zinc-200 block">
                                {isEn ? 'Rules & Guide' : 'Kurallar ve Rehber'}
                              </span>
                              <span className="text-[9.5px] text-zinc-500">
                                {isEn ? 'All cards and strategy tips' : 'Tüm kartlar ve strateji ipuçları'}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              sounds.playPlay(profile.settings);
                              setShowHowToPlayModal(true);
                            }}
                            className="px-3.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-extrabold text-[10px] rounded-xl transition cursor-pointer shrink-0"
                          >
                            {isEn ? 'How to Play?' : 'Nasıl Oynanır?'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ────────────────────────────────────────────────────────
                      SUB-TAB: 🌐 LOBİ SALONU (CANLI & ŞİFRELİ MASALAR)
                  ──────────────────────────────────────────────────────── */}
                  {multiplayerMode === 'active_rooms' && (
                    <div className="space-y-5">
                      {/* 1. LOBİ SALONU ANA BAŞLIK & HIZLI AKSİYONLAR */}
                      <div className="relative rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 via-zinc-950 to-zinc-900/90 shadow-2xl p-4 sm:p-6 space-y-4">
                        {/* Ambient glow */}
                        <div className="absolute -top-24 -left-24 w-60 h-60 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
                        <div className="absolute -bottom-24 -right-24 w-60 h-60 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

                        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/8 pb-4">
                          <div className="flex items-center gap-3.5">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 p-0.5 shadow-xl shadow-emerald-600/20">
                              <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center text-2xl">
                                🌐
                              </div>
                            </div>
                            <div>
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-wide">
                                  {isEn ? 'Lobby Hall & Live Tables' : 'Lobi Salonu & Canlı Masalar'}
                                </h3>
                                <span className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">
                                    {isEn ? `${onlinePlayerCount} Players Online` : `${onlinePlayerCount} Oyuncu Çevrimiçi`}
                                  </span>
                                </span>
                              </div>
                              <p className="text-[11px] text-zinc-400 font-medium mt-0.5">
                                {isEn
                                  ? 'Browse active tables, join password-protected rooms, or create a new table instantly'
                                  : 'Aktif oyun masalarını inceleyin, şifreli özel odalara bağlanın veya anında yeni masa açın'}
                              </p>
                            </div>
                          </div>

                          {/* Quick Action Buttons */}
                          <div className="flex items-center gap-2 self-start sm:self-auto">
                            <button
                              type="button"
                              onClick={() => {
                                setShowQuickCreateInLobby(!showQuickCreateInLobby);
                                sounds.playCoin(profile.settings);
                              }}
                              className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all duration-200 flex items-center gap-2 cursor-pointer shadow-lg active:scale-95 ${showQuickCreateInLobby
                                  ? 'bg-amber-500 text-slate-950 shadow-amber-500/20'
                                  : 'bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white shadow-red-600/20'
                                }`}
                            >
                              <span>{showQuickCreateInLobby ? '✕' : '🛠️'}</span>
                              <span>
                                {showQuickCreateInLobby
                                  ? (isEn ? 'Close Setup Panel' : 'Ayar Panelini Kapat')
                                  : (isEn ? '🛠️ Create & Setup Table' : '🛠️ Yeni Masa Kur & Ayarla')}
                              </span>
                            </button>
                          </div>
                        </div>

                        {/* 2. HIZLI MASA KUR & ŞİFRE EKLEME PANELİ (AÇILIR KAPANIR) */}
                        {showQuickCreateInLobby && (
                          <div className="bg-zinc-900/60 border border-amber-500/30 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl relative">
                            <div className="flex items-center justify-between border-b border-white/8 pb-3">
                              <span className="text-xs font-black text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                                <span>{isEn ? '🛠️ Quick Setup Table & Add Password' : '🛠️ Lobi Salonundan Hızlı Masa Kur & Şifre Ekle'}</span>
                              </span>
                              <span className="text-[10px] text-zinc-400 font-bold">
                                {isEn ? 'Set rules and password to open table instantly' : 'Kural ve şifreyi belirleyip masayı hemen açın'}
                              </span>
                            </div>

                            {/* Mode Selection */}
                            <div className="space-y-1.5">
                              <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block">
                                {isEn ? 'Game Mode:' : 'Oyun Modu:'}
                              </span>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {[
                                  { id: 'classic', emoji: '🎲', label: isEn ? 'Classic' : 'Klasik' },
                                  { id: '2v2_team', emoji: '⚔️', label: isEn ? '2v2 Team' : '2v2 Takım' },
                                  { id: 'speed', emoji: '⚡', label: isEn ? 'Speed' : 'Hızlı' },
                                  { id: 'chaos', emoji: '🌀', label: isEn ? 'Chaos' : 'Kaos' },
                                ].map((m) => {
                                  const isSel = createRoomGameMode === m.id;
                                  return (
                                    <button
                                      key={m.id}
                                      type="button"
                                      onClick={() => {
                                        setCreateRoomGameMode(m.id as any);
                                        sounds.playCoin(profile.settings);
                                      }}
                                      className={`py-2 px-3 rounded-xl border text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${isSel
                                          ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-md shadow-amber-500/15'
                                          : 'bg-white/3 border-white/8 text-zinc-400 hover:bg-white/6 hover:text-zinc-200'
                                        }`}
                                    >
                                      <span>{m.emoji}</span>
                                      <span>{m.label}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Capacity & Code & Password */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              {/* Capacity */}
                              <div className="space-y-1.5">
                                <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block">
                                  {isEn ? 'Capacity:' : 'Kapasite:'}
                                </span>
                                <div className="flex gap-1.5">
                                  {[2, 3, 4, 5, 6].map((p) => (
                                    <button
                                      key={p}
                                      type="button"
                                      onClick={() => {
                                        setCreateRoomMaxPlayers(p);
                                        sounds.playCoin(profile.settings);
                                      }}
                                      className={`flex-1 py-2 rounded-xl border text-xs font-black transition-all cursor-pointer ${createRoomMaxPlayers === p
                                          ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300 shadow-sm'
                                          : 'bg-white/3 border-white/8 text-zinc-400 hover:bg-white/6'
                                        }`}
                                    >
                                      {p}P
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Room Code */}
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                                    {isEn ? 'Room Code:' : 'Oda Kodu:'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={generateRandomRoomCode}
                                    className="text-[9px] text-amber-400 hover:text-amber-300 font-bold cursor-pointer"
                                  >
                                    <span>🎲</span>
                                    <span>{isEn ? 'Random' : 'Rastgele'}</span>
                                  </button>
                                </div>
                                <input
                                  type="text"
                                  placeholder={isEn ? 'e.g., LOBBY-123' : 'örn. LOBI-123'}
                                  value={customRoomId}
                                  onChange={(e) => setCustomRoomId(e.target.value)}
                                  className="w-full bg-white/4 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 font-mono uppercase font-bold"
                                />
                              </div>

                              {/* Room Password */}
                              <div className="space-y-1.5">
                                <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block">
                                  {isEn ? '🔒 Add Password (Optional):' : '🔒 Şifre Ekle (İsteğe Bağlı):'}
                                </span>
                                <input
                                  type="password"
                                  placeholder={isEn ? 'Leave empty = Public for Everyone' : 'Boş bırak = Herkese Açık'}
                                  value={roomPassword}
                                  onChange={(e) => setRoomPassword(e.target.value)}
                                  className="w-full bg-white/4 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                                />
                              </div>
                            </div>

                            {/* Create Button */}
                            <button
                              type="button"
                              onClick={() => {
                                handleCreateRoom(false);
                              }}
                              className="w-full py-3 bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black rounded-xl text-xs uppercase tracking-widest transition-all shadow-lg shadow-amber-500/20 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                            >
                              <span>🚀</span>
                              <span>{isEn ? 'Open Table to Lobby' : 'Masayı Lobiye Aç'}</span>
                            </button>
                          </div>
                        )}

                        {/* 3. ŞİFRELİ ODAYA KATIL / KODLA GİRİŞ PANELİ */}
                        <div className="bg-zinc-900/40 border border-white/8 p-3.5 sm:p-4 rounded-2xl space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="text-base">🔑</span>
                            <span className="text-xs font-black text-white uppercase tracking-wider">
                              {isEn ? 'Join Locked Room or Enter Code:' : 'Şifreli Odaya Katıl veya Kod Gir:'}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                            <div className="sm:col-span-5">
                              <input
                                type="text"
                                placeholder={isEn ? 'ROOM CODE (E.G. EAGLE-777)' : 'ODA KODU (ÖRN. KARTAL-777)'}
                                value={lobbyJoinCode}
                                onChange={(e) => setLobbyJoinCode(e.target.value)}
                                className="w-full bg-white/4 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 font-mono uppercase font-black"
                              />
                            </div>
                            <div className="sm:col-span-4">
                              <input
                                type="password"
                                placeholder={isEn ? 'ROOM PASSWORD (IF ANY)' : 'ODA ŞİFRESİ (VARSA)'}
                                value={lobbyJoinPass}
                                onChange={(e) => setLobbyJoinPass(e.target.value)}
                                className="w-full bg-white/4 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 font-mono"
                              />
                            </div>
                            <div className="sm:col-span-3">
                              <button
                                type="button"
                                onClick={() => {
                                  if (!lobbyJoinCode.trim()) return;
                                  sounds.playPlay(profile.settings);
                                  onJoinRoom(lobbyJoinCode.trim(), false, lobbyJoinPass.trim() || undefined);
                                }}
                                disabled={!lobbyJoinCode.trim()}
                                className={`w-full h-full py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${lobbyJoinCode.trim()
                                    ? 'bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 text-white shadow-lg shadow-emerald-600/20 active:scale-95 cursor-pointer'
                                    : 'bg-zinc-900 border border-zinc-800 text-zinc-600 cursor-not-allowed'
                                  }`}
                              >
                                <span>🔑</span>
                                <span>{isEn ? 'Join Room' : 'Odaya Katıl'}</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* 4. ARAMA VE KATEGORİ FİLTRELEME ÇUBUĞU */}
                        <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-2">
                          {/* Filter Pills */}
                          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full md:w-auto pb-1 md:pb-0">
                            {[
                              { id: 'all', label: isEn ? 'All Tables' : 'Tüm Masalar', count: rooms.length },
                              { id: 'open', label: isEn ? '🟢 Open to Join' : '🟢 Katılıma Açık', count: rooms.filter(r => r.status === 'lobby' && r.playerCount < ((r as any).maxPlayers || 4)).length },
                              { id: 'locked', label: isEn ? '🔒 Locked Tables' : '🔒 Şifreli Masalar', count: rooms.filter(r => r.hasPassword).length },
                              { id: '2v2', label: isEn ? '⚔️ 2v2 Team' : '⚔️ 2v2 Takım', count: rooms.filter(r => (r as any).gameMode === '2v2_team').length },
                              { id: 'classic', label: isEn ? '🎲 Classic' : '🎲 Klasik', count: rooms.filter(r => !(r as any).gameMode || (r as any).gameMode === 'classic').length },
                            ].map((cat) => {
                              const isSelected = roomFilterCategory === cat.id;
                              return (
                                <button
                                  key={cat.id}
                                  type="button"
                                  onClick={() => {
                                    setRoomFilterCategory(cat.id as any);
                                    sounds.playCoin(profile.settings);
                                  }}
                                  className={`px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${isSelected
                                      ? 'bg-red-600/20 border-red-500/80 text-red-300 shadow-sm shadow-red-500/10'
                                      : 'bg-white/3 border-white/8 text-zinc-400 hover:bg-white/6 hover:text-zinc-200'
                                    }`}
                                >
                                  <span>{cat.label}</span>
                                  <span className={`text-[9px] px-1 py-0.2 rounded-md ${isSelected ? 'bg-red-500/30 text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                                    {cat.count}
                                  </span>
                                </button>
                              );
                            })}
                          </div>

                          {/* Search box */}
                          <div className="w-full md:w-64 relative">
                            <input
                              type="text"
                              placeholder={isEn ? 'Search room code or host...' : 'Oda kodu veya kurucu ara...'}
                              value={roomSearchQuery}
                              onChange={(e) => setRoomSearchQuery(e.target.value)}
                              className="w-full bg-white/4 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500/60 transition-all font-medium"
                            />
                            {roomSearchQuery && (
                              <button
                                type="button"
                                onClick={() => setRoomSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-xs"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 5. CANLI MASALAR LİSTESİ */}
                      {(() => {
                        const filtered = rooms.filter((r) => {
                          // Category filter
                          if (roomFilterCategory === 'open') {
                            if (r.status !== 'lobby' || r.playerCount >= ((r as any).maxPlayers || 4)) return false;
                          } else if (roomFilterCategory === 'locked') {
                            if (!r.hasPassword) return false;
                          } else if (roomFilterCategory === '2v2') {
                            if ((r as any).gameMode !== '2v2_team') return false;
                          } else if (roomFilterCategory === 'classic') {
                            if ((r as any).gameMode && (r as any).gameMode !== 'classic') return false;
                          }

                          // Search query filter
                          if (!roomSearchQuery.trim()) return true;
                          const q = roomSearchQuery.toLowerCase().trim();
                          return (
                            r.roomId.toLowerCase().includes(q) ||
                            r.players?.some((p: string) => p.toLowerCase().includes(q))
                          );
                        });

                        if (filtered.length === 0) {
                          return (
                            <div className="flex flex-col items-center justify-center py-16 rounded-3xl border border-dashed border-zinc-800 bg-zinc-950/40 text-center gap-4 shadow-xl">
                              <div className="w-16 h-16 rounded-3xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-center text-3xl shadow-inner">
                                🎲
                              </div>
                              <div className="space-y-1">
                                <p className="text-sm font-black text-zinc-300 uppercase tracking-wider">
                                  {isEn
                                    ? (roomSearchQuery || roomFilterCategory !== 'all' ? 'No Matching Lobby Tables Found' : 'No Live Lobby Tables Right Now')
                                    : (roomSearchQuery || roomFilterCategory !== 'all' ? 'Filtreye Uygun Lobi Masası Bulunamadı' : 'Şu Anda Canlı Lobi Masası Yok')}
                                </p>
                                <p className="text-xs text-zinc-500 max-w-sm">
                                  {isEn
                                    ? 'Create the first room now, set your rules & password, and invite your friends!'
                                    : 'İlk odayı hemen sen oluştur, kuralları ve şifreni belirleyip arkadaşlarını davet et!'}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowQuickCreateInLobby(true);
                                  sounds.playPlay(profile.settings);
                                }}
                                className="px-6 py-3 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition shadow-lg shadow-red-600/25 active:scale-95 cursor-pointer flex items-center gap-2"
                              >
                                <span>🚀</span>
                                <span>{isEn ? 'Open New Table' : 'Yeni Masa Aç'}</span>
                              </button>
                            </div>
                          );
                        }

                        return (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filtered.map((room) => {
                              const isLobby = room.status === 'lobby';
                              const isMyRoom = room.players.includes(profile.username);
                              const maxP = (room as any).maxPlayers || 4;
                              const canJoin = isLobby && room.playerCount < maxP;
                              const gameMode = (room as any).gameMode || 'classic';
                              const modeMap: Record<string, { emoji: string; label: string; color: string; borderGlow: string }> = {
                                classic: { emoji: '🎲', label: isEn ? 'Classic Mode' : 'Klasik Mod', color: 'bg-amber-500/15 text-amber-300 border-amber-500/30', borderGlow: 'from-amber-500 to-transparent' },
                                '2v2_team': { emoji: '⚔️', label: isEn ? '2v2 Team' : '2v2 Takım', color: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30', borderGlow: 'from-indigo-500 to-transparent' },
                                speed: { emoji: '⚡', label: isEn ? 'Speed Lightning' : 'Hızlı Yıldırım', color: 'bg-red-500/15 text-red-300 border-red-500/30', borderGlow: 'from-red-500 to-transparent' },
                                chaos: { emoji: '🌀', label: isEn ? 'Chaos Arena' : 'Kaos Arenası', color: 'bg-purple-500/15 text-purple-300 border-purple-500/30', borderGlow: 'from-purple-500 to-transparent' },
                              };
                              const modeMeta = modeMap[gameMode] || modeMap.classic;
                              const playerDetails: { username: string; isBot?: boolean; status?: string; country?: string }[] =
                                (room as any).playerDetails?.length > 0
                                  ? (room as any).playerDetails
                                  : room.players.map((p: string) => ({ username: p, status: isLobby ? 'online' : 'in_game' }));
                              const hostName = playerDetails[0]?.username || room.roomId;

                              return (
                                <div
                                  key={room.roomId}
                                  className={`relative flex flex-col rounded-3xl border overflow-hidden transition-all duration-200 shadow-xl ${isLobby && canJoin
                                      ? 'bg-zinc-950/80 border-white/10 hover:border-zinc-700 hover:shadow-2xl hover:shadow-black/40'
                                      : 'bg-zinc-950/50 border-zinc-900/60 opacity-90'
                                    }`}
                                >
                                  {/* Mode accent stripe */}
                                  <div className={`h-1 w-full bg-gradient-to-r ${modeMeta.borderGlow}`} />

                                  <div className="p-5 flex flex-col gap-4 flex-1 justify-between">
                                    {/* Room Header */}
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="flex items-center gap-3 min-w-0">
                                        <div className="shrink-0">
                                          {(room as any).hostAvatarId ? (
                                            <AvatarWithFrame
                                              avatarId={(room as any).hostAvatarId}
                                              avatarUrl={(room as any).hostAvatarUrl}
                                              frameId={(room as any).hostProfileFrame || 'frame_none'}
                                              sizeClassName="w-10 h-10 text-[10px]"
                                            />
                                          ) : (
                                            <div className="w-10 h-10 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-lg">👤</div>
                                          )}
                                        </div>
                                        <div className="min-w-0">
                                          <p className="text-sm font-black text-white truncate leading-tight flex items-center gap-1.5">
                                            <span>{isEn ? `${hostName}'s Room` : `${hostName}'in Odası`}</span>
                                            {room.hasPassword && (
                                              <span className="text-[10px] text-amber-400 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.2 rounded-md font-bold" title={isEn ? 'Password Protection Active' : 'Şifre Koruma Aktif'}>
                                                {isEn ? '🔒 Locked' : '🔒 Şifreli'}
                                              </span>
                                            )}
                                          </p>
                                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[9px] font-black uppercase ${modeMeta.color}`}>
                                              {modeMeta.emoji} {modeMeta.label}
                                            </span>
                                            <span className="text-[9px] text-zinc-500 font-mono bg-zinc-900/60 px-1.5 py-0.5 rounded border border-zinc-800">
                                              #{room.roomId}
                                            </span>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Slot Capacity Badge */}
                                      <div className={`shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-xl border text-[11px] font-black ${canJoin ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-zinc-900/60 border-zinc-800 text-zinc-400'
                                        }`}>
                                        👥 {room.playerCount}/{maxP}
                                      </div>
                                    </div>

                                    {/* Players Seat Grid */}
                                    <div className="space-y-1.5">
                                      <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block">
                                        {isEn ? `Players (${playerDetails.length}/${maxP}):` : `Oyuncular (${playerDetails.length}/${maxP}):`}
                                      </span>
                                      <div className="flex flex-wrap gap-1.5">
                                        {playerDetails.map((pd, idx) => {
                                          const statusColor = pd.status === 'in_game' ? 'bg-amber-400' : pd.status === 'away' ? 'bg-orange-400' : 'bg-emerald-400';
                                          const countryInfo = getCountryByCode(pd.country);
                                          return (
                                            <span
                                              key={idx}
                                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/4 border border-white/8 text-[10.5px] font-bold text-zinc-200"
                                            >
                                              <span className={`w-2 h-2 rounded-full shrink-0 ${statusColor}`} />
                                              {pd.country && <span className="text-xs shrink-0">{countryInfo.flag}</span>}
                                              <span className="truncate max-w-[90px]">{pd.username}</span>
                                              {pd.isBot && <span className="text-[9px] text-zinc-500">🤖</span>}
                                            </span>
                                          );
                                        })}
                                        {Array.from({ length: Math.max(0, maxP - playerDetails.length) }).map((_, i) => (
                                          <span key={`empty-${i}`} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/2 border border-dashed border-white/8 text-[10px] text-zinc-700 font-medium">
                                            {isEn ? '+ Empty Seat' : '+ Boş Koltuk'}
                                          </span>
                                        ))}
                                      </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="pt-2 border-t border-white/6">
                                      {isMyRoom ? (
                                        <button
                                          type="button"
                                          onClick={() => handleJoinExistingRoom(room.roomId, room.hasPassword)}
                                          className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
                                        >
                                          <span>↩️</span>
                                          <span>{isEn ? 'Return to Room' : 'Odaya Geri Dön'}</span>
                                        </button>
                                      ) : canJoin ? (
                                        <button
                                          type="button"
                                          onClick={() => handleJoinExistingRoom(room.roomId, room.hasPassword)}
                                          className={`w-full py-3 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg active:scale-[0.98] transform flex items-center justify-center gap-2 ${room.hasPassword
                                              ? 'bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 shadow-amber-600/20 text-slate-950'
                                              : 'bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 shadow-emerald-600/20'
                                            }`}
                                        >
                                          <span>{room.hasPassword ? (isEn ? '🔒 Join with Password' : '🔒 Şifreyle Katıl') : (isEn ? '🚀 Take a Seat' : '🚀 Masaya Otur')}</span>
                                        </button>
                                      ) : (
                                        <div className="w-full py-2.5 bg-zinc-900/50 border border-zinc-800/60 rounded-xl text-[10px] text-zinc-500 font-black uppercase tracking-wider text-center flex items-center justify-center gap-1.5">
                                          {isLobby ? (isEn ? '🔒 Room Full' : '🔒 Oda Doldu') : (isEn ? '🎮 Match in Progress' : '🎮 Oyun Oynanıyor')}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
              {/* TAB 2: Bot Practice (Full Player Count, 2v2 & FFA Customization) */}
              {activeTab === 'bot_practice' && (
                <div className="bg-zinc-950/40 border border-zinc-900/80 rounded-3xl p-5 sm:p-7 space-y-6 shadow-2xl relative overflow-hidden">
                  {/* Ambient background glows */}
                  <div className="absolute -top-24 -left-24 w-56 h-56 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
                  <div className="absolute -bottom-24 -right-24 w-56 h-56 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

                  {/* Header */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-zinc-900 pb-5">
                    <div className="flex items-center gap-3.5 text-left">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-600 to-amber-600 p-0.5 shadow-lg shadow-red-600/20 shrink-0">
                        <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center text-2xl">
                          🤖
                        </div>
                      </div>
                      <div>
                        <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                          <span>{t('bot_practice_title', profile) || 'Bot Pratik Arenası'}</span>
                          <span className="text-[9px] bg-red-500/15 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full font-bold">
                            {t('offline_badge_label', profile)}
                          </span>
                        </h3>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          {t('bot_practice_subtitle', profile)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    {/* LEFT COLUMN: Configuration Controls (7 Cols) */}
                    <div className="lg:col-span-7 space-y-5">
                      {/* 1. Game Format Selector */}
                      <div className="space-y-2 text-left">
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">
                          {t('bot_game_format_label', profile)}
                        </span>
                        <div className="grid grid-cols-2 gap-2.5">
                          <button
                            type="button"
                            onClick={() => {
                              setBotGameFormat('classic');
                              sounds.playCoin(profile.settings);
                            }}
                            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-3 ${botGameFormat === 'classic'
                                ? 'bg-gradient-to-r from-red-950/60 to-zinc-900 border-red-500/60 text-white shadow-lg shadow-red-950/40 ring-1 ring-red-500/30'
                                : 'bg-zinc-900/30 border-zinc-800/80 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                              }`}
                          >
                            <span className="text-2xl">🎲</span>
                            <div>
                              <span className="text-xs font-black block">{t('bot_format_ffa', profile)}</span>
                              <span className="text-[9px] text-zinc-500 block mt-0.5">{t('bot_format_ffa_desc', profile)}</span>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setBotGameFormat('2v2_team');
                              setBotPlayerCount(4);
                              sounds.playCoin(profile.settings);
                            }}
                            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-3 ${botGameFormat === '2v2_team'
                                ? 'bg-gradient-to-r from-indigo-950/60 to-zinc-900 border-indigo-500/60 text-white shadow-lg shadow-indigo-950/40 ring-1 ring-indigo-500/30'
                                : 'bg-zinc-900/30 border-zinc-800/80 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                              }`}
                          >
                            <span className="text-2xl">⚔️</span>
                            <div>
                              <span className="text-xs font-black block">{t('bot_format_2v2', profile)}</span>
                              <span className="text-[9px] text-zinc-500 block mt-0.5">{t('bot_format_2v2_desc', profile)}</span>
                            </div>
                          </button>
                        </div>
                      </div>

                      {/* 2. Player Count (Only for Classic FFA) */}
                      {botGameFormat === 'classic' && (
                        <div className="space-y-2 text-left">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">
                              {t('bot_table_size_label', profile)}
                            </span>
                            <span className="text-[9px] text-amber-400 font-bold">
                              {botPlayerCount === 2 && t('duel_1v1_desc', profile)}
                              {botPlayerCount === 3 && t('table_3p_desc', profile)}
                              {botPlayerCount === 4 && t('table_4p_desc', profile)}
                              {botPlayerCount === 5 && t('table_5p_desc', profile)}
                            </span>
                          </div>

                          <div className="grid grid-cols-4 gap-2">
                            {[
                              { count: 2, label: '1 vs 1', sub: profile?.settings?.language === 'en' ? '2 Players' : '2 Kişi', icon: '🤺' },
                              { count: 3, label: profile?.settings?.language === 'en' ? '3 Players' : '3 Kişi', sub: profile?.settings?.language === 'en' ? '2 Bots' : '2 Bot', icon: '👥' },
                              { count: 4, label: profile?.settings?.language === 'en' ? '4 Players' : '4 Kişi', sub: profile?.settings?.language === 'en' ? '3 Bots' : '3 Bot', icon: '🏰' },
                              { count: 5, label: profile?.settings?.language === 'en' ? '5 Players' : '5 Kişi', sub: profile?.settings?.language === 'en' ? '4 Bots' : '4 Bot', icon: '🎪' },
                            ].map((item) => (
                              <button
                                key={item.count}
                                type="button"
                                onClick={() => {
                                  setBotPlayerCount(item.count);
                                  sounds.playCoin(profile.settings);
                                }}
                                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${botPlayerCount === item.count
                                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-black shadow-md shadow-amber-500/10 scale-[1.02]'
                                    : 'bg-zinc-900/30 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                                  }`}
                              >
                                <span className="text-base">{item.icon}</span>
                                <span className="text-xs font-black">{item.label}</span>
                                <span className="text-[8.5px] text-zinc-500 font-bold">{item.sub}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 3. Bot Difficulty */}
                      <div className="space-y-2 text-left">
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">
                          {botGameFormat === 'classic' ? t('bot_difficulty_step_classic', profile) : t('bot_difficulty_step_team', profile)}
                        </span>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: 'easy', label: t('bot_diff_easy', profile) || (profile?.settings?.language === 'en' ? '🟢 Easy' : '🟢 Kolay'), desc: profile?.settings?.language === 'en' ? 'Beginner level, relaxed learning' : 'Acemi seviye, rahat öğrenme' },
                            { id: 'medium', label: t('bot_diff_medium', profile) || (profile?.settings?.language === 'en' ? '🟡 Medium' : '🟡 Orta'), desc: profile?.settings?.language === 'en' ? 'Balanced & tactical moves' : 'Dengeli & taktiksel hamleler' },
                            { id: 'hard', label: t('bot_diff_hard', profile) || (profile?.settings?.language === 'en' ? '🔴 Hard' : '🔴 Zor'), desc: profile?.settings?.language === 'en' ? 'Master & aggressive steals' : 'Usta & agresif kart çalma' },
                          ].map((diff) => (
                            <button
                              key={diff.id}
                              type="button"
                              onClick={() => {
                                setBotDifficulty(diff.id as any);
                                sounds.playCoin(profile.settings);
                              }}
                              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${botDifficulty === diff.id
                                  ? 'bg-red-600/20 border-red-500 text-red-300 font-black shadow-md shadow-red-500/10 scale-[1.02]'
                                  : 'bg-zinc-900/30 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                                }`}
                            >
                              <span className="text-xs font-black">{diff.label}</span>
                              <span className="text-[8.5px] text-zinc-500 mt-1 leading-tight">{diff.desc}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 4. Target Sets Count */}
                      <div className="space-y-2 text-left">
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">
                          {botGameFormat === 'classic' ? t('bot_target_sets_step_classic', profile) : t('bot_target_sets_step_team', profile)}
                        </span>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { sets: 2, label: profile?.settings?.language === 'en' ? '⚡ 2 Sets' : '⚡ 2 Set', desc: t('bot_target_2_desc', profile) },
                            { sets: 3, label: profile?.settings?.language === 'en' ? '🎯 3 Sets' : '🎯 3 Set', desc: t('bot_target_3_desc', profile) },
                            { sets: 4, label: profile?.settings?.language === 'en' ? '🏆 4 Sets' : '🏆 4 Set', desc: t('bot_target_4_desc', profile) },
                          ].map((s) => (
                            <button
                              key={s.sets}
                              type="button"
                              onClick={() => {
                                setBotTargetSets(s.sets);
                                sounds.playCoin(profile.settings);
                              }}
                              className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${botTargetSets === s.sets
                                  ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300 font-black shadow-sm'
                                  : 'bg-zinc-900/30 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                                }`}
                            >
                              <span className="text-xs font-black block">{s.label}</span>
                              <span className="text-[8px] text-zinc-500 block mt-0.5">{s.desc}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* RIGHT COLUMN: Live Match Preview & Launch Card (5 Cols) */}
                    <div className="lg:col-span-5 flex flex-col justify-between bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-4.5 space-y-4">
                      <div className="space-y-3.5 text-left">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                          <span className="text-xs font-black uppercase text-white flex items-center gap-1.5">
                            <span>📋</span>
                            <span>{t('bot_table_summary_title', profile)}</span>
                          </span>
                          <span className="text-[9px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                            {t('ready_status', profile)}
                          </span>
                        </div>

                        {/* Summary details */}
                        <div className="space-y-2 text-xs">
                          <div className="flex items-center justify-between bg-black/30 p-2.5 rounded-xl border border-white/5">
                            <span className="text-zinc-400 text-[11px]">{t('bot_summary_format', profile)}</span>
                            <span className="font-bold text-white">
                              {botGameFormat === '2v2_team'
                                ? (profile?.settings?.language === 'en' ? '⚔️ 2v2 Team Battle' : '⚔️ 2v2 Takım Savaşı')
                                : (profile?.settings?.language === 'en' ? `🎲 Free For All (${botPlayerCount} Players)` : `🎲 Herkes Tek (${botPlayerCount} Oyuncu)`)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between bg-black/30 p-2.5 rounded-xl border border-white/5">
                            <span className="text-zinc-400 text-[11px]">{t('bot_summary_ai', profile)}</span>
                            <span className="font-bold text-amber-300 capitalize">
                              {botDifficulty === 'easy'
                                ? (profile?.settings?.language === 'en' ? '🟢 Easy Level' : '🟢 Kolay Seviye')
                                : botDifficulty === 'medium'
                                ? (profile?.settings?.language === 'en' ? '🟡 Medium Level' : '🟡 Orta Seviye')
                                : (profile?.settings?.language === 'en' ? '🔴 Hard Level' : '🔴 Zor Seviye')}
                            </span>
                          </div>

                          <div className="flex items-center justify-between bg-black/30 p-2.5 rounded-xl border border-white/5">
                            <span className="text-zinc-400 text-[11px]">{t('bot_summary_target', profile)}</span>
                            <span className="font-bold text-indigo-300">
                              {t('bot_summary_sets_count', profile, botTargetSets)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between bg-black/30 p-2.5 rounded-xl border border-white/5">
                            <span className="text-zinc-400 text-[11px]">{t('bot_summary_participants', profile)}</span>
                            <span className="font-bold text-zinc-300 text-[10px]">
                              {botGameFormat === '2v2_team'
                                ? t('bot_summary_team_desc', profile)
                                : t('bot_summary_solo_desc', profile, botPlayerCount - 1)}
                            </span>
                          </div>
                        </div>

                        {/* Bot Practice Benefits */}
                        <div className="p-3 bg-red-950/20 border border-red-500/20 rounded-xl space-y-1.5 text-[10px] text-zinc-300">
                          <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                            <span>✨</span>
                            <span>{t('bot_practice_benefits_title', profile)}</span>
                          </div>
                          <p className="text-zinc-400 text-[9.5px] leading-relaxed">
                            {t('bot_practice_benefits_desc', profile)}
                          </p>
                        </div>
                      </div>

                      {/* Main Launch Button */}
                      <button
                        type="button"
                        onClick={() => {
                          const pCount = botGameFormat === '2v2_team' ? 4 : botPlayerCount;
                          const rid = botGameFormat === '2v2_team'
                            ? `offline-2v2-${pCount}p-${botDifficulty}-${botTargetSets}sets-${Math.random().toString(36).substr(2, 5)}`
                            : `offline-practice-${pCount}p-${botDifficulty}-${botTargetSets}sets-${Math.random().toString(36).substr(2, 5)}`;
                          sounds.playPlay(profile.settings);
                          onJoinRoom(rid, true);
                        }}
                        className="w-full py-4 bg-gradient-to-r from-red-600 via-red-500 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white font-black rounded-2xl text-xs sm:text-sm uppercase tracking-wider transition-all shadow-xl shadow-red-600/30 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                      >
                        <span>🚀</span>
                        <span>
                          {botGameFormat === '2v2_team'
                            ? t('start_2v2_bot_match', profile)
                            : t('start_n_player_bot_match', profile, botPlayerCount)}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: Tournaments */}
              {activeTab === 'tournaments' && (
                <div className="bg-zinc-950/20 border border-zinc-900/80 rounded-2xl p-6 space-y-6">
                  {tournamentsList.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pb-2">
                      {tournamentsList.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => {
                            sounds.playCoin(profile.settings);
                            setSelectedTournamentId(t.id);
                          }}
                          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-2 ${selectedTournamentId === t.id
                              ? 'bg-gradient-to-br from-indigo-950/80 via-slate-900 to-indigo-950/80 border-indigo-400 shadow-xl shadow-indigo-600/20 ring-2 ring-indigo-500/50 scale-[1.02]'
                              : 'bg-zinc-900/40 border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-900/70'
                            }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-base">{t.icon || '🏆'}</span>
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              {t.prizeCoins ? `${t.prizeCoins.toLocaleString()} 🪙` : (profile?.settings?.language === 'en' ? 'PRIZE POOL' : 'ÖDÜLLÜ')}
                            </span>
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-white">{t(t.name, profile)}</h4>
                            <p className="text-[9px] text-zinc-400 mt-0.5 line-clamp-1">{t(t.description, profile)}</p>
                          </div>
                          <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[8.5px] font-bold text-zinc-400">
                            <span>{t.entryFee ? `${t.entryFee} 🪙 ${profile?.settings?.language === 'en' ? 'Entry' : 'Giriş'}` : (profile?.settings?.language === 'en' ? 'Free' : 'Ücretsiz')}</span>
                            <span className="text-indigo-300">{t.maxParticipants || 8} {profile?.settings?.language === 'en' ? 'Players' : 'Oyuncu'}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {(() => {
                    const activeT =
                      tournamentsList.find((t) => t.id === selectedTournamentId) ||
                      tournamentsList[0] || {
                        id: 't-bronze',
                        name: '🥉 Acemi Arenası',
                        description: 'Hızlı 8 kişilik eleme kupası. Yeni taktikleri test etmek için ideal!',
                        tier: 'bronze',
                        entryFee: 100,
                        prizeCoins: 500,
                        prizeXp: 150,
                        maxParticipants: 8,
                        icon: '🥉',
                        participants: ['Bot Memo', 'Bot Can', 'Bot Defne'],
                        rounds: [],
                        status: 'registration',
                      };

                    return (
                      <TournamentBracket
                        tournament={activeT}
                        profile={profile}
                        onPlayMatch={handlePlayTournamentMatch}
                        onStartTournament={handleStartTournament}
                      />
                    );
                  })()}
                </div>
              )}

              {/* TAB 4: Cards Catalog & Inspector */}
              {activeTab === 'cards' && <CardsCatalog profile={profile} />}

              {/* TAB 5: Shop */}
              {activeTab === 'shop' && <ShopDialog profile={profile} onUpdateProfile={onUpdateProfile} adminSettings={adminSettings} />}

              {/* TAB 5: Customization */}
              {activeTab === 'customization' && <CustomizationPanel profile={profile} onUpdateProfile={onUpdateProfile} />}

              {/* TAB 6: Profile */}
              {activeTab === 'profile' && <ProfilePanel profile={profile} onUpdateProfile={onUpdateProfile} />}

              {/* TAB 7: Rules / Instructions */}
              {activeTab === 'rules' && (
                <div className="bg-black/20 border border-white/10 rounded-2xl p-6 space-y-6 shadow-2xl">
                  <div className="border-b border-white/10 pb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-red-500">📜 Deal Master PRO Deal Kuralları</h3>
                      <p className="text-xs text-slate-400">Hızlıca öğrenip kazanmaya başlayın</p>
                    </div>
                    <button
                      onClick={() => {
                        sounds.playPlay(profile.settings);
                        setShowHowToPlayModal(true);
                      }}
                      className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider shadow-lg hover:brightness-110 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <BookOpen className="w-4 h-4" />
                      <span>{profile.settings.language === 'en' ? 'Master Guide' : 'Kapsamlı Rehberi Aç'}</span>
                    </button>
                  </div>

                  <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
                    <div>
                      <h4 className="font-bold text-white mb-1 text-sm">1. Amaç</h4>
                      <p>Farklı renklerde tamamlanmış 3 tam arsa grubuna sahip olan ilk oyuncu oyunu kazanır.</p>
                    </div>

                    <div>
                      <h4 className="font-bold text-white mb-1 text-sm">2. Sıra Sende Ne Yaparsın?</h4>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Sıranın başında desteden 2 kart çekersin (hiç kartın yoksa 5 kart).</li>
                        <li>Sıran boyunca en fazla 3 kart oynayabilirsin (zorunlu değildir, oynamamayı da seçebilirsin).</li>
                        <li>Kartları bankana para olarak koyabilir, mülk grubuna ekleyebilir veya aksiyon olarak masaya oynayabilirsin.</li>
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-bold text-white mb-1 text-sm">3. Kritik Kartların İşlevleri</h4>
                      <ul className="list-disc pl-5 space-y-1">
                        <li><strong className="text-red-400">Anlaşma Bozan (Deal Breaker):</strong> Rakibin tamamlanmış tam bir mülk setini her şeyiyle çalar.</li>
                        <li><strong className="text-emerald-400">Hayır Teşekkürler (Just Say No):</strong> Sana karşı oynanan tüm aksiyonları durdurur.</li>
                        <li><strong className="text-amber-400">Sinsi Anlaşma (Sly Deal):</strong> Rakibin tamamlanmamış bir setindeki mülkü çalar.</li>
                        <li><strong className="text-blue-400">Zoraki Takas (Forced Deal):</strong> Rakiple mülk takas etmeni sağlar.</li>
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-bold text-white mb-1 text-sm">4. Ödeme Kuralları</h4>
                      <p>
                        Kira istendiğinde veya borç istendiğinde ödemeyi bankandaki paralardan veya önündeki mülklerden yapabilirsin. Ödemeler eldeki kartlardan YAPILMAZ. Eğer önünde hiç para veya mülk yoksa, ödeme yapmazsın (borç silinir, elindeki kartlara dokunulmaz).
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 8: World Leaderboard */}
              {activeTab === 'leaderboard' && (
                <div className="bg-black/20 border border-white/10 rounded-2xl p-6 space-y-6 shadow-2xl">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
                    <div>
                      <h3 className="text-xl font-bold flex items-center gap-2 text-white">
                        <span>🏆</span> {leaderboardSubTab === 'ranked' ? 'Dereceli Lig Sıralaması' : t('leaderboard_title', profile)}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {leaderboardSubTab === 'ranked'
                          ? 'Dereceli otomatik eşleşme maçlarında kazandığın veya kaybettiğin Dereceli Puan (RP) sıralaması.'
                          : t('leaderboard_desc', profile)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {/* Sub-tab selection */}
                      <div className="flex bg-zinc-900/60 p-1 rounded-xl border border-white/5">
                        <button
                          onClick={() => {
                            setLeaderboardSubTab('ranked');
                            sounds.playPlay(profile.settings);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-extrabold tracking-wider transition-all flex items-center gap-1 cursor-pointer ${leaderboardSubTab === 'ranked'
                              ? 'bg-red-600 text-white shadow-md'
                              : 'text-slate-400 hover:text-white'
                            }`}
                        >
                          <span>🏆</span>
                          <span>DERECELİ LİG</span>
                        </button>
                        <button
                          onClick={() => {
                            setLeaderboardSubTab('general');
                            sounds.playPlay(profile.settings);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-extrabold tracking-wider transition-all flex items-center gap-1 cursor-pointer ${leaderboardSubTab === 'general'
                              ? 'bg-red-600 text-white shadow-md'
                              : 'text-slate-400 hover:text-white'
                            }`}
                        >
                          <span>🌍</span>
                          <span>GENEL (ZAFER)</span>
                        </button>
                      </div>

                      <button
                        onClick={fetchLeaderboard}
                        disabled={leaderboardLoading}
                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/15 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 transform cursor-pointer"
                      >
                        {leaderboardLoading ? (
                          <div className="w-3.5 h-3.5 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <span>🔄 {t('refresh_lbl', profile)}</span>
                        )}
                      </button>
                    </div>
                  </div>

                  {leaderboardLoading && leaderboardData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-4">
                      <div className="w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-xs text-slate-400 animate-pulse">{t('loading_leaderboard_lbl', profile)}</p>
                    </div>
                  ) : (
                    <div className="overflow-hidden border border-white/5 rounded-2xl bg-black/40">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-white/10 bg-white/5 text-slate-300 font-extrabold uppercase tracking-wider text-[10px]">
                              <th className="py-3 px-4 text-center">{t('rank_lbl', profile)}</th>
                              <th className="py-3 px-4">{t('player_lbl', profile)}</th>
                              {leaderboardSubTab === 'ranked' ? (
                                <th className="py-3 px-4 text-center">Dereceli Lig / Puan</th>
                              ) : (
                                <th className="py-3 px-4 text-center">{t('level', profile)}</th>
                              )}
                              <th className="py-3 px-4 text-center">{t('wins', profile)}</th>
                              <th className="py-3 px-4 text-center">{t('total_matches', profile)}</th>
                              <th className="py-3 px-4 text-center">{t('coins', profile)}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              // Sort data before rendering
                              const sortedData = [...leaderboardData];
                              if (leaderboardSubTab === 'ranked') {
                                sortedData.sort((a, b) => {
                                  const ap = a.rankPoints ?? 0;
                                  const bp = b.rankPoints ?? 0;
                                  if (bp !== ap) return bp - ap;
                                  if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
                                  return b.level - a.level;
                                });
                              } else {
                                sortedData.sort((a, b) => {
                                  if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
                                  if (b.level !== a.level) return b.level - a.level;
                                  return b.coins - a.coins;
                                });
                              }

                              return sortedData.map((player, index) => {
                                const isCurrentUser = player.username.toLowerCase() === profile.username.toLowerCase();
                                const rank = index + 1;
                                let rankBadge: React.ReactNode = rank;
                                if (rank === 1) rankBadge = <span className="text-xl">🥇</span>;
                                else if (rank === 2) rankBadge = <span className="text-xl">🥈</span>;
                                else if (rank === 3) rankBadge = <span className="text-xl">🥉</span>;

                                return (
                                  <tr
                                    key={player.username}
                                    className={`border-b border-white/5 transition-colors hover:bg-white/5 ${isCurrentUser ? 'bg-red-500/10 font-bold border-l-4 border-l-red-500' : ''
                                      }`}
                                  >
                                    <td className="py-3 px-4 text-center font-black text-slate-300">{rankBadge}</td>
                                    <td className="py-3 px-4 flex items-center gap-3">
                                      <AvatarWithFrame
                                        avatarId={player.avatarId}
                                        avatarUrl={player.avatarUrl}
                                        frameId="frame_none"
                                        sizeClassName="w-8 h-8 text-sm"
                                      />
                                      <span className={`text-sm flex items-center gap-1.5 ${isCurrentUser ? 'text-red-400 font-extrabold' : 'text-slate-100'}`}>
                                        <span className="text-base shrink-0 select-none" title={profile.settings.language === 'en' ? getCountryByCode(player.country).nameEn : getCountryByCode(player.country).nameTr}>
                                          {getCountryByCode(player.country).flag}
                                        </span>
                                        <span>{player.username}</span>
                                        {isCurrentUser && <span className="text-[9px] bg-red-600 text-white font-extrabold px-1.5 py-0.5 rounded ml-1.5 uppercase tracking-wide">SEN</span>}
                                      </span>
                                    </td>
                                    {leaderboardSubTab === 'ranked' ? (
                                      <td className="py-3 px-4 text-center">
                                        {(() => {
                                          const league = getLeagueTier(player.rankPoints ?? 0);
                                          return (
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black border ${league.color}`}>
                                              <span>{league.icon}</span>
                                              <span>{league.name} ({player.rankPoints ?? 0} RP)</span>
                                            </span>
                                          );
                                        })()}
                                      </td>
                                    ) : (
                                      <td className="py-3 px-4 text-center">
                                        <span className="text-xs bg-red-500/10 text-red-400 border border-red-500/15 font-extrabold px-2 py-0.5 rounded-full">
                                          Seviye {player.level}
                                        </span>
                                      </td>
                                    )}
                                    <td className="py-3 px-4 text-center font-bold text-emerald-400">{player.gamesWon} Maç</td>
                                    <td className="py-3 px-4 text-center text-slate-400">{player.gamesPlayed} Maç</td>
                                    <td className="py-3 px-4 text-center text-amber-300 font-mono font-bold">💰 {player.coins}</td>
                                  </tr>
                                );
                              });
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 9: Admin Dashboard */}
              {activeTab === 'admin' && (
                <AdminDashboard onSettingsUpdated={onUpdateAdminSettings} onLogout={handleAdminLogout} />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Mobile-only Persistent Stats & History Cards */}
          <div className="lg:hidden flex flex-col gap-4 mt-6">
            {/* Statistics Card */}
            <div className="bg-black/20 border border-white/5 rounded-2xl p-4 space-y-4 shadow-xl">
              <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                <span className="text-red-500">📊</span>
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-300">
                  {isEn ? 'Player Statistics' : 'Oyuncu İstatistikleri'}
                </h3>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-emerald-500/10 border border-emerald-500/15 rounded-xl p-2.5 text-center">
                  <span className="text-base font-black text-emerald-400 block">{profile.stats.gamesWon}</span>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">
                    {isEn ? 'Wins' : 'Galibiyet'}
                  </span>
                </div>
                <div className="bg-slate-500/10 border border-white/5 rounded-xl p-2.5 text-center">
                  <span className="text-base font-black text-slate-400 block">{profile.stats.gamesLost}</span>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">
                    {isEn ? 'Losses' : 'Yenilgi'}
                  </span>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/15 rounded-xl p-2.5 text-center">
                  <span className="text-base font-black text-amber-400 block">
                    {profile.stats.gamesPlayed > 0 ? Math.round((profile.stats.gamesWon / profile.stats.gamesPlayed) * 100) : 0}%
                  </span>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">{t('win_rate', profile)}</span>
                </div>
              </div>
            </div>

            {/* Game History Card */}
            <div className="bg-black/20 border border-white/5 rounded-2xl p-4 space-y-3 shadow-xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-red-500">📜</span>
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-300">{t('game_history', profile)}</h3>
                </div>
                {profile.gamesHistory && profile.gamesHistory.length > 0 && (
                  <span className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full font-bold">
                    {t('wins_count', profile, profile.gamesHistory.length)}
                  </span>
                )}
              </div>

              <div className="space-y-2 max-h-[220px] overflow-y-auto scrollbar-none">
                {!profile.gamesHistory || profile.gamesHistory.length === 0 ? (
                  <div className="text-center py-6 text-slate-500">
                    <span className="text-xl block mb-1">🎮</span>
                    <p className="text-[11px] leading-relaxed" dangerouslySetInnerHTML={{ __html: t('no_games_played_yet_lbl', profile).replace('\n', '<br/>') }} />
                  </div>
                ) : (
                  profile.gamesHistory.slice(0, 3).map((game) => (
                    <div key={game.id} className="bg-black/30 border border-white/5 rounded-xl p-3 flex items-center justify-between text-xs gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${game.result === 'won' ? 'bg-emerald-500 shadow-md shadow-emerald-500/30' : 'bg-red-500 shadow-md shadow-red-500/30'}`}></span>
                          <span className="font-extrabold text-slate-200">
                            {game.result === 'won' ? (isEn ? 'Victory' : 'Zafer') : (isEn ? 'Defeat' : 'Bozgun')}
                          </span>
                          <span className="text-[9px] text-slate-500 font-mono flex-shrink-0">{game.date.split(' ')[0]}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 truncate max-w-[120px]">vs {game.opponent}</p>
                      </div>
                      <div className="text-right flex flex-col items-end flex-shrink-0">
                        <span className="text-[10px] font-bold text-amber-300 font-mono">+{game.coinsEarned}💰</span>
                        <span className="text-[9px] font-semibold text-slate-400 font-mono">+{game.xpEarned} XP</span>
                        {game.rankPointsEarned !== undefined && (
                          <span className={`text-[8px] font-black font-mono px-1.5 py-0.5 rounded mt-0.5 ${game.rankPointsEarned >= 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'}`}>
                            {game.rankPointsEarned >= 0 ? `+${game.rankPointsEarned}` : game.rankPointsEarned} RP
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Modallar */}
      <AnimatePresence>
        {/* Profil & Hesap İşlemleri Modalı */}
        {showProfileOperationsModal && (
          <ProfileOperationsModal
            profile={profile}
            onUpdateProfile={onUpdateProfile}
            onClose={() => setShowProfileOperationsModal(false)}
            onOpenInventory={() => setActiveTab('profile')}
          />
        )}

        {/* Custom Admin Login Modal */}
        {showAdminLoginModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="bg-slate-900 border border-white/10 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl text-left"
            >
              {/* Header */}
              <div className="p-5 border-b border-white/10 flex justify-between items-center bg-black/20">
                <div>
                  <h3 className="text-base font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
                    <span>🔐</span> {profile.settings.language === 'en' ? 'Admin Authentication' : 'Yönetici Girişi'}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {profile.settings.language === 'en'
                      ? 'Please enter the administrator password to gain dashboard access.'
                      : 'Yönetici paneline erişebilmek için lütfen yetkili şifresini giriniz.'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowAdminLoginModal(false);
                    sounds.playPlay(profile.settings);
                  }}
                  className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all text-xs font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Form Input Content */}
              <div className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 uppercase tracking-widest font-black">
                    {profile.settings.language === 'en' ? 'Admin Password' : 'Yönetici Şifresi'}
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={adminPasswordInput}
                    onChange={(e) => {
                      setAdminPasswordInput(e.target.value);
                      if (adminLoginError) setAdminLoginError('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAdminLoginSubmit();
                      }
                    }}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 transition-all font-mono"
                    autoFocus
                  />
                </div>

                {adminLoginError && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2.5 text-xs text-rose-400 font-medium flex items-center gap-2"
                  >
                    <span>⚠️</span> {adminLoginError}
                  </motion.div>
                )}
              </div>

              {/* Action Footer */}
              <div className="p-4 border-t border-white/10 bg-black/20 flex items-center justify-end gap-2.5">
                <button
                  onClick={() => {
                    setShowAdminLoginModal(false);
                    sounds.playPlay(profile.settings);
                  }}
                  className="px-4 py-2 hover:bg-white/5 text-slate-400 hover:text-white font-bold rounded-xl text-xs transition-all active:scale-95 cursor-pointer"
                >
                  {profile.settings.language === 'en' ? 'Cancel' : 'İptal'}
                </button>
                <button
                  disabled={adminLoginLoading}
                  onClick={handleAdminLoginSubmit}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-amber-500/10 cursor-pointer flex items-center gap-2"
                >
                  {adminLoginLoading ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      <span>{isEn ? 'Checking...' : 'Kontrol Ediliyor...'}</span>
                    </>
                  ) : (
                    <span>{profile.settings.language === 'en' ? 'Unlock Access' : 'Giriş Yap'}</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Custom Room Password Prompt Modal */}
        {showRoomPasswordModal && (
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 10 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="bg-gradient-to-b from-zinc-900 to-slate-950 border border-white/15 rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl text-left"
            >
              {/* Header */}
              <div className="p-5 border-b border-white/10 flex justify-between items-center bg-black/40">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-xl shadow-lg shadow-amber-500/10">
                    🔒
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                      <span>{profile.settings.language === 'en' ? 'Locked Room' : 'Şifreli Oda Girişi'}</span>
                    </h3>
                    <p className="text-[10px] text-zinc-400 font-mono">
                      #{pendingRoomId}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowRoomPasswordModal(false);
                    sounds.playPlay(profile.settings);
                  }}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all text-xs font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Form Input */}
              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-zinc-400 uppercase tracking-widest font-black">
                      {profile.settings.language === 'en' ? 'Enter Room Password' : 'Oda Şifresini Girin:'}
                    </label>
                  </div>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={roomPasswordInput}
                    onChange={(e) => setRoomPasswordInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        sounds.playPlay(profile.settings);
                        setShowRoomPasswordModal(false);
                        onJoinRoom(pendingRoomId, false, roomPasswordInput.trim());
                      }
                    }}
                    className="w-full bg-black/50 border-2 border-white/15 focus:border-amber-500 rounded-2xl px-4 py-3.5 text-base text-white focus:outline-none transition-all font-mono tracking-widest text-center"
                    autoFocus
                  />
                  <p className="text-[10px] text-zinc-500 text-center">
                    {profile.settings.language === 'en'
                      ? 'Ask the room host for the access password.'
                      : 'Oda kurucusundan şifreyi öğrenip giriş yapabilirsiniz.'}
                  </p>
                </div>
              </div>

              {/* Action Footer */}
              <div className="p-4 border-t border-white/10 bg-black/30 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowRoomPasswordModal(false);
                    sounds.playPlay(profile.settings);
                  }}
                  className="px-4 py-2.5 hover:bg-white/5 text-zinc-400 hover:text-zinc-200 font-bold rounded-xl text-xs transition-all active:scale-95 cursor-pointer"
                >
                  {profile.settings.language === 'en' ? 'Cancel' : 'Vazgeç'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    sounds.playPlay(profile.settings);
                    setShowRoomPasswordModal(false);
                    onJoinRoom(pendingRoomId, false, roomPasswordInput.trim());
                  }}
                  className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow-lg shadow-amber-500/20"
                >
                  {profile.settings.language === 'en' ? 'Unlock & Join' : 'Kilidi Aç & Katıl'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* How to Play Overlay Modal */}
      <HowToPlayModal
        isOpen={showHowToPlayModal}
        onClose={() => setShowHowToPlayModal(false)}
        profile={profile}
      />

      {/* Şans Çarkı / Lucky Wheel Overlay Modal */}
      <LuckyWheel
        isOpen={showLuckyWheel}
        onClose={() => setShowLuckyWheel(false)}
        profile={profile}
        onUpdateProfile={onUpdateProfile}
        adminSettings={adminSettings}
      />

      {/* Footer credits line with secret admin trigger */}
      <footer onClick={handleSecretAdminTrigger} className="border-t border-white/10 py-4 text-center text-[10px] text-slate-500 bg-black/40 mt-8 z-10 select-none cursor-pointer">
        {isEn ? '© 2026 Deal Master PRO Deal Online. All Rights Reserved. Responsive & Fullstack UI.' : '© 2026 Deal Master PRO Deal Online. Tüm Hakları Saklıdır. Responsive & Fullstack UI.'}
      </footer>
    </div>
  );
};
