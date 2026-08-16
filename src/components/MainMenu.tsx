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
import { motion, AnimatePresence } from 'motion/react';
import { t, changeLanguage } from '../lib/TranslationSystem';
import { API_BASE_URL, WS_BASE_URL } from '../lib/apiConfig';
import { getCountryByCode } from '../lib/countryData';
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
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface Props {
  profile: UserProfile;
  onUpdateProfile: (updated: UserProfile) => void;
  onJoinRoom: (roomId: string, isOffline: boolean, password?: string) => void;
  adminSettings?: any;
  onUpdateAdminSettings?: (settings: any) => void;
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

export const MainMenu: React.FC<Props> = ({ profile, onUpdateProfile, onJoinRoom, adminSettings, onUpdateAdminSettings }) => {
  const [activeTab, setActiveTab] = React.useState<'play' | 'bot_practice' | 'tournaments' | 'shop' | 'customization' | 'profile' | 'rules' | 'leaderboard' | 'admin'>('play');
  const [showHowToPlayModal, setShowHowToPlayModal] = React.useState(false);
  const [showLuckyWheel, setShowLuckyWheel] = React.useState(false);
  const [questsExpanded, setQuestsExpanded] = React.useState(false);
  const [botDifficulty, setBotDifficulty] = React.useState<'easy' | 'medium' | 'hard'>('medium');
  const [rooms, setRooms] = React.useState<any[]>([]);
  const [customRoomId, setCustomRoomId] = React.useState('');
  const [roomPassword, setRoomPassword] = React.useState(''); // State to hold optional room password on creation
  const [tournamentJoined, setTournamentJoined] = React.useState(false);
  const [onlinePlayerCount, setOnlinePlayerCount] = React.useState<number>(1);

  // Matchmaking State and References
  const [matchmakingActive, setMatchmakingActive] = React.useState(false);
  const [matchmakingStatus, setMatchmakingStatus] = React.useState<'idle' | 'searching' | 'found'>('idle');
  const [matchmakingElapsed, setMatchmakingElapsed] = React.useState(0);
  const [matchmakingOpponent, setMatchmakingOpponent] = React.useState('');
  const [matchmakingIsBot, setMatchmakingIsBot] = React.useState(false);
  const [matchmakingCountdown, setMatchmakingCountdown] = React.useState(3);
  const [matchmakingErrorMsg, setMatchmakingErrorMsg] = React.useState<string | null>(null);
  const [selectedMatchmakingFee, setSelectedMatchmakingFee] = React.useState<number>(100);

  const matchmakingSocketRef = React.useRef<WebSocket | null>(null);
  const matchmakingTimerRef = React.useRef<any>(null);
  const matchmakingCountdownIntervalRef = React.useRef<any>(null);

  const handleCancelMatchmaking = (withRefundRequest = true) => {
    if (matchmakingTimerRef.current) {
      clearInterval(matchmakingTimerRef.current);
    }
    if (matchmakingCountdownIntervalRef.current) {
      clearInterval(matchmakingCountdownIntervalRef.current);
    }

    const socket = matchmakingSocketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      if (withRefundRequest) {
        socket.send(JSON.stringify({ type: 'cancel_matchmaking', userId: profile.id }));
      }
      setTimeout(() => {
        try {
          socket.close();
        } catch (e) {}
      }, 100);
    }

    matchmakingSocketRef.current = null;
    setMatchmakingActive(false);
    setMatchmakingStatus('idle');
  };

  const handleStartMatchmaking = () => {
    setMatchmakingErrorMsg(null);
    setMatchmakingStatus('idle');
    setMatchmakingElapsed(0);
    setMatchmakingOpponent('');
    setMatchmakingIsBot(false);
    setMatchmakingCountdown(3);

    sounds.playCoin(profile.settings);

    const entryFee = selectedMatchmakingFee;
    if (profile.coins < entryFee) {
      setMatchmakingErrorMsg(`Yetersiz altın! Seçilen dereceli ligde maça girmek için en az ${entryFee} altın gereklidir.`);
      return;
    }

    setMatchmakingActive(true);
    setMatchmakingStatus('searching');

    let wsUrl = WS_BASE_URL;

    const socket = new WebSocket(wsUrl);
    matchmakingSocketRef.current = socket;

    socket.onopen = () => {
      socket.send(JSON.stringify({
        type: 'register',
        userId: profile.id
      }));
      socket.send(JSON.stringify({
        type: 'start_matchmaking',
        entryFee: entryFee,
        userId: profile.id
      }));
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'matchmaking_started') {
          // Deduct entry fee in local state for immediate feedback
          const updated = { ...profile, coins: data.newCoins };
          onUpdateProfile(updated);

          // Start timer
          matchmakingTimerRef.current = setInterval(() => {
            setMatchmakingElapsed(prev => prev + 1);
          }, 1000);
        } else if (data.type === 'matchmaking_error') {
          setMatchmakingErrorMsg(data.error);
          handleCancelMatchmaking(false);
        } else if (data.type === 'matchmaking_found') {
          setMatchmakingStatus('found');
          setMatchmakingOpponent(data.opponentName);
          setMatchmakingIsBot(!!data.isBot);

          if (matchmakingTimerRef.current) {
            clearInterval(matchmakingTimerRef.current);
          }

          sounds.playDraw(profile.settings);

          let count = 3;
          setMatchmakingCountdown(count);
          matchmakingCountdownIntervalRef.current = setInterval(() => {
            count--;
            setMatchmakingCountdown(count);
            if (count <= 0) {
              clearInterval(matchmakingCountdownIntervalRef.current);
              
              matchmakingSocketRef.current = null;
              try {
                socket.close();
              } catch (e) {}

              setMatchmakingActive(false);
              onJoinRoom(data.roomId, false);
            }
          }, 1000);
        } else if (data.type === 'matchmaking_cancelled') {
          const updated = { ...profile, coins: data.newCoins };
          onUpdateProfile(updated);
        }
      } catch (err) {
        console.error('Error parsing matchmaking message:', err);
      }
    };

    socket.onerror = (err) => {
      console.error('Matchmaking WebSocket error:', err);
      setMatchmakingErrorMsg('Ağ bağlantı hatası oluştu.');
      handleCancelMatchmaking(true);
    };
  };

  React.useEffect(() => {
    return () => {
      if (matchmakingTimerRef.current) clearInterval(matchmakingTimerRef.current);
      if (matchmakingCountdownIntervalRef.current) clearInterval(matchmakingCountdownIntervalRef.current);
      if (matchmakingSocketRef.current) {
        try {
          matchmakingSocketRef.current.close();
        } catch (e) {}
      }
    };
  }, []);

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
    try {
      const res = await fetch(`${API_BASE_URL}/api/tournaments?userId=${profile.id}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setTournamentsList(data);
          if (!selectedTournamentId || !data.some((t: any) => t.id === selectedTournamentId)) {
            setSelectedTournamentId(data[0].id);
          }
        }
      }
    } catch (e) {
      console.error('Failed to fetch tournaments', e);
    }
  };

  React.useEffect(() => {
    if (activeTab === 'tournaments') {
      fetchTournaments();
      const interval = setInterval(fetchTournaments, 2000);
      return () => clearInterval(interval);
    }
  }, [activeTab, profile.id]);

  const handleStartTournament = async (tournamentId: string) => {
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
      } else {
        alert(data.error || 'Turnuva başlatılamadı.');
      }
    } catch (e) {
      console.error('Failed to start tournament', e);
    }
  };

  const handleResetTournament = async (tournamentId: string) => {
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
      }
    } catch (e) {
      console.error('Failed to reset tournament', e);
    }
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

  // Admin login custom states
  const [showAdminLoginModal, setShowAdminLoginModal] = React.useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = React.useState('');
  const [adminLoginError, setAdminLoginError] = React.useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = React.useState(false);

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

  return (
    <div id="main-menu" className="min-h-screen bg-[#07080b] text-zinc-100 font-sans flex flex-col justify-between relative overflow-hidden selection:bg-red-500/20">
      {/* Premium ambient decorative radial lights */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-red-950/5 rounded-full filter blur-[100px] pointer-events-none" />
      <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-zinc-800/5 rounded-full filter blur-[80px] pointer-events-none" />

      {/* Top Header bar */}
      <header className="border-b border-zinc-900/60 bg-zinc-950/50 backdrop-blur-xl px-2.5 sm:px-8 py-2.5 sm:py-3.5 flex items-center justify-between sticky top-0 z-40 max-w-full overflow-hidden">
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
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
            {/* Online Players Indicator */}
            <div className="flex items-center gap-1 bg-emerald-950/40 text-emerald-400 px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-xl border border-emerald-500/20 text-[9px] sm:text-xs font-bold shadow-sm" title="Anlık Çevrimiçi Oyuncu Sayısı">
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
              <span className="hidden md:inline">Canlı:</span>
              <span>{onlinePlayerCount} <span className="hidden xs:inline">Online</span></span>
            </div>

            {/* Connection Ping Indicator */}
            <div
              className={`flex items-center gap-1 px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-xl border text-[9px] sm:text-xs font-mono font-bold shadow-sm transition-all ${
                pingMs === null
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
                className={`w-1.5 h-1.5 rounded-full ${
                  pingMs === null
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
              { id: 'play', label: t('tab_multiplayer', profile) || '🎮 Çok Oyunculu', icon: Play, color: 'hover:text-red-400' },
              { id: 'bot_practice', label: t('tab_bot_practice', profile) || '🤖 Bot Pratik', icon: Bot, color: 'hover:text-red-400' },
              { id: 'tournaments', label: '🏆 Kupa Turnuvaları', icon: Trophy, badge: 'ÖDÜLLÜ', color: 'hover:text-amber-400', special: true },
              (!adminSettings || adminSettings.rankedLeagueEnabled !== false) && { id: 'leaderboard', label: t('tab_leaderboard', profile) || '🌍 Sıralama', icon: Award, color: 'hover:text-red-400' },
              { id: 'shop', label: t('tab_shop', profile) || '✨ Mağaza', icon: Sparkles, color: 'hover:text-red-400' },
              { id: 'customization', label: t('tab_customize', profile) || '🎨 Özelleştir', icon: Layout, color: 'hover:text-red-400' },
              { id: 'profile', label: t('tab_profile', profile) || '👤 Profil', icon: UserIcon, color: 'hover:text-red-400' },
              { id: 'rules', label: t('tab_rules', profile) || '📖 Kurallar', icon: BookOpen, color: 'hover:text-red-400' },
              { id: 'admin', label: t('tab_admin', profile) || '🛡️ Yönetici', icon: Shield, color: 'hover:text-amber-500' },
            ].filter(Boolean).map((tab: any) => {
              const IconComp = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (tab.id === 'admin') {
                      if (isAdminAuthenticated) {
                        setActiveTab('admin');
                        sounds.playPlay(profile.settings);
                      } else {
                        setAdminPasswordInput('');
                        setAdminLoginError('');
                        setShowAdminLoginModal(true);
                        sounds.playPlay(profile.settings);
                      }
                      return;
                    }
                    setActiveTab(tab.id as any);
                    sounds.playPlay(profile.settings);
                  }}
                  className={`flex-shrink-0 lg:w-full text-left px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-between gap-3.5 ${
                    isActive
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
                <h3 className="font-extrabold text-xs uppercase tracking-widest text-zinc-400">İstatistikler</h3>
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
                    <p className="text-[10px] leading-relaxed">Henüz oyun oynanmadı.<br />Arenaya katılarak hemen başla!</p>
                  </div>
                ) : (
                  profile.gamesHistory.slice(0, 3).map((game) => (
                    <div key={game.id} className="bg-zinc-900/20 border border-zinc-900/60 rounded-xl p-2.5 flex items-center justify-between text-xs gap-3">
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${game.result === 'won' ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                          <span className="font-extrabold text-zinc-300 text-[10px]">
                            {game.result === 'won' ? 'Zafer' : 'Bozgun'}
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

              {/* TAB 1: Multiplayer Lobby */}
              {activeTab === 'play' && (
                <div className="space-y-6">

                  {/* ═══════════════════════════════════════════════════════
                      🎮 ÖZEL ODA KUR
                  ═══════════════════════════════════════════════════════ */}
                  <div className="relative rounded-2xl overflow-hidden border border-white/8 bg-gradient-to-br from-slate-950 via-zinc-950 to-slate-950 shadow-xl">
                    {/* Glow accent top-left */}
                    <div className="absolute -top-16 -left-16 w-48 h-48 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

                    <div className="relative p-5 sm:p-6 space-y-5">
                      {/* Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center text-xl shadow-inner">
                            🎮
                          </div>
                          <div>
                            <h3 className="text-sm font-black text-white tracking-wide">
                              {profile.settings.language === 'en' ? 'Create Custom Room' : 'Özel Oda Kur'}
                            </h3>
                            <p className="text-[10px] text-zinc-500 font-medium mt-0.5">
                              {profile.settings.language === 'en' ? 'Play with friends using a custom room code' : 'Arkadaşlarınla özel oda koduyla oyna'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-[9px] font-black text-emerald-400 uppercase tracking-wider">{onlinePlayerCount} Çevrimiçi</span>
                        </div>
                      </div>

                      {/* Game Mode Selector */}
                      <div className="space-y-1.5">
                        <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">
                          {profile.settings.language === 'en' ? 'Game Mode' : 'Oyun Modu'}
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {[
                            { id: 'classic',  emoji: '🎲', label: profile.settings.language === 'en' ? 'Classic'   : 'Klasik',   desc: profile.settings.language === 'en' ? 'Standard rules, 3 sets to win' : 'Standart kurallar, 3 set' },
                            { id: '2v2_team', emoji: '⚔️', label: profile.settings.language === 'en' ? '2v2 Team'  : '2v2 Takım', desc: profile.settings.language === 'en' ? 'Blue vs Red, 4 shared sets'    : 'Mavi vs Kırmızı, ortak 4 set' },
                            { id: 'speed',    emoji: '⚡', label: profile.settings.language === 'en' ? 'Speed'     : 'Hızlı',    desc: profile.settings.language === 'en' ? '15s turns, 2 sets'             : '15sn tur süresi, 2 set' },
                            { id: 'chaos',    emoji: '🌀', label: profile.settings.language === 'en' ? 'Chaos'     : 'Kaos',     desc: profile.settings.language === 'en' ? 'Special chaos events & powers' : 'Özel kaos olayları ve güçler' },
                          ].map((mode) => {
                            const isSelected = createRoomGameMode === mode.id;
                            return (
                              <button
                                key={mode.id}
                                type="button"
                                onClick={() => { setCreateRoomGameMode(mode.id as any); sounds.playCoin(profile.settings); }}
                                title={mode.desc}
                                className={`relative flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all cursor-pointer group ${
                                  isSelected
                                    ? 'bg-red-500/15 border-red-500/50 shadow-[0_0_12px_rgba(239,68,68,0.15)]'
                                    : 'bg-white/3 border-white/8 hover:bg-white/5 hover:border-white/15'
                                }`}
                              >
                                <span className="text-base shrink-0">{mode.emoji}</span>
                                <div className="min-w-0">
                                  <span className={`text-[11px] font-black block truncate ${isSelected ? 'text-red-300' : 'text-zinc-300'}`}>
                                    {mode.label}
                                  </span>
                                  <span className="text-[8px] text-zinc-500 leading-tight block truncate">{mode.desc}</span>
                                </div>
                                {isSelected && (
                                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Player Count + Optional Fields Row */}
                      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
                        {/* Max Players */}
                        <div className="space-y-1.5 shrink-0">
                          <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">
                            {profile.settings.language === 'en' ? 'Max Players' : 'Oyuncu Sayısı'}
                          </span>
                          <div className="flex gap-1.5">
                            {[2, 3, 4, 5, 6].map((pCount) => (
                              <button
                                key={pCount}
                                type="button"
                                onClick={() => { setCreateRoomMaxPlayers(pCount); sounds.playCoin(profile.settings); }}
                                className={`w-9 h-9 rounded-xl border text-[11px] font-black transition-all cursor-pointer ${
                                  createRoomMaxPlayers === pCount
                                    ? 'bg-indigo-500/20 border-indigo-500/60 text-indigo-300 shadow-[0_0_8px_rgba(99,102,241,0.2)]'
                                    : 'bg-white/3 border-white/8 text-zinc-400 hover:bg-white/6 hover:border-white/15'
                                }`}
                              >
                                {pCount}P
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Room Code (optional) */}
                        <div className="flex-1 space-y-1.5 min-w-0">
                          <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">
                            {profile.settings.language === 'en' ? 'Room Code (optional)' : 'Oda Kodu (isteğe bağlı)'}
                          </span>
                          <input
                            type="text"
                            placeholder={profile.settings.language === 'en' ? 'e.g. myroom123' : 'örn. odam123'}
                            value={customRoomId}
                            onChange={(e) => setCustomRoomId(e.target.value)}
                            className="w-full bg-white/3 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-red-500/50 focus:bg-white/5 transition-all"
                          />
                        </div>

                        {/* Password (optional) */}
                        <div className="flex-1 space-y-1.5 min-w-0">
                          <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">
                            {profile.settings.language === 'en' ? 'Password (optional)' : 'Şifre (isteğe bağlı)'}
                          </span>
                          <input
                            type="password"
                            placeholder={profile.settings.language === 'en' ? 'Leave blank = public' : 'Boş bırak = herkese açık'}
                            value={roomPassword}
                            onChange={(e) => setRoomPassword(e.target.value)}
                            className="w-full bg-white/3 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-red-500/50 focus:bg-white/5 transition-all"
                          />
                        </div>
                      </div>

                      {/* CTA Button */}
                      <button
                        onClick={() => handleCreateRoom(false)}
                        className="w-full py-3.5 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-black rounded-xl text-sm uppercase tracking-widest transition-all shadow-lg shadow-red-600/20 active:scale-[0.98] transform flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <span>🚀</span>
                        <span>{profile.settings.language === 'en' ? 'Create & Enter Room' : 'Oda Oluştur ve Gir'}</span>
                      </button>

                      {/* How to play link */}
                      <div className="flex items-center justify-center pt-1">
                        <button
                          onClick={() => { sounds.playPlay(profile.settings); setShowHowToPlayModal(true); }}
                          className="text-[10px] text-zinc-500 hover:text-amber-400 font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <BookOpen className="w-3 h-3" />
                          <span>{profile.settings.language === 'en' ? 'How to Play?' : 'Nasıl Oynanır?'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* ═══════════════════════════════════════════════════════
                      🔥 AKTİF OYUN ODALARI
                  ═══════════════════════════════════════════════════════ */}
                  <div className="space-y-3">
                    {/* Section Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Flame className="w-4 h-4 text-orange-400" />
                        <h4 className="text-sm font-black text-zinc-100">
                          {profile.settings.language === 'en' ? 'Active Rooms' : 'Aktif Oyun Odaları'}
                        </h4>
                        {rooms.length > 0 && (
                          <span className="flex items-center gap-1 bg-orange-500/10 border border-orange-500/25 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                            <span className="text-[9px] font-black text-orange-400">{rooms.length}</span>
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider">
                        {profile.settings.language === 'en' ? 'Auto-refreshes every 5s' : 'Her 5sn güncellenir'}
                      </span>
                    </div>

                    {/* Rooms Grid */}
                    {rooms.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 rounded-2xl border border-dashed border-zinc-800/60 bg-zinc-950/20 text-center gap-3">
                        <span className="text-3xl opacity-30">🎲</span>
                        <div>
                          <p className="text-xs font-black text-zinc-500 uppercase tracking-wider">
                            {profile.settings.language === 'en' ? 'No active rooms yet' : 'Henüz aktif oda yok'}
                          </p>
                          <p className="text-[10px] text-zinc-600 mt-1">
                            {profile.settings.language === 'en' ? 'Be the first — create a room above! ↑' : 'İlk odayı sen kur! Yukarıdan oluştur ↑'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {rooms.map((room) => {
                          const isLobby = room.status === 'lobby';
                          const isMyRoom = room.players.includes(profile.username);
                          const canJoin = isLobby && room.playerCount < ((room as any).maxPlayers || 4);
                          const gameMode = (room as any).gameMode || 'classic';
                          const modeMap: Record<string, { emoji: string; label: string; color: string }> = {
                            classic:  { emoji: '🎲', label: profile.settings.language === 'en' ? 'Classic'  : 'Klasik',   color: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30' },
                            '2v2_team': { emoji: '⚔️', label: profile.settings.language === 'en' ? '2v2 Team' : '2v2 Takım', color: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' },
                            speed:    { emoji: '⚡', label: profile.settings.language === 'en' ? 'Speed'    : 'Hızlı',    color: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
                            chaos:    { emoji: '🌀', label: profile.settings.language === 'en' ? 'Chaos'    : 'Kaos',     color: 'bg-purple-500/15 text-purple-300 border-purple-500/30' },
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
                              className={`relative flex flex-col rounded-2xl border overflow-hidden transition-all duration-200 ${
                                isLobby && canJoin
                                  ? 'bg-zinc-950/60 border-zinc-800/60 hover:border-zinc-700/80 hover:shadow-lg hover:shadow-black/20'
                                  : 'bg-zinc-950/30 border-zinc-900/40'
                              }`}
                            >
                              {/* Status stripe */}
                              <div className={`h-0.5 w-full ${isLobby ? 'bg-gradient-to-r from-emerald-500/60 to-emerald-500/0' : 'bg-gradient-to-r from-amber-500/40 to-amber-500/0'}`} />

                              <div className="p-4 flex flex-col gap-3 flex-1">
                                {/* Room header */}
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    {/* Host avatar */}
                                    <div className="shrink-0">
                                      {(room as any).hostAvatarId ? (
                                        <AvatarWithFrame
                                          avatarId={(room as any).hostAvatarId}
                                          avatarUrl={(room as any).hostAvatarUrl}
                                          frameId={(room as any).hostProfileFrame || 'frame_none'}
                                          sizeClassName="w-9 h-9 text-[10px]"
                                        />
                                      ) : (
                                        <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-base">👤</div>
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-sm font-black text-white truncate leading-tight">
                                        {hostName}{profile.settings.language === 'en' ? "'s Room" : "'in Odası"}
                                      </p>
                                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                        {/* Mode badge */}
                                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[9px] font-black uppercase ${modeMeta.color}`}>
                                          {modeMeta.emoji} {modeMeta.label}
                                        </span>
                                        {/* Password */}
                                        {room.hasPassword && (
                                          <span className="text-[9px] text-zinc-500" title={profile.settings.language === 'en' ? 'Password protected' : 'Şifreli oda'}>🔒</span>
                                        )}
                                        {/* Room ID */}
                                        <span className="text-[8px] text-zinc-600 font-mono">#{room.roomId}</span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Player count badge */}
                                  <div className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-black ${
                                    canJoin ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' : 'bg-zinc-900/60 border-zinc-800 text-zinc-400'
                                  }`}>
                                    👥 {room.playerCount}/{(room as any).maxPlayers || 4}
                                  </div>
                                </div>

                                {/* Players list */}
                                <div className="flex flex-wrap gap-1.5">
                                  {playerDetails.map((pd, idx) => {
                                    const statusColor = pd.status === 'in_game'
                                      ? 'bg-amber-400'
                                      : pd.status === 'away'
                                      ? 'bg-orange-400'
                                      : 'bg-emerald-400';
                                    const countryInfo = getCountryByCode(pd.country);
                                    return (
                                      <span
                                        key={idx}
                                        title={`${pd.username}${pd.country ? ` (${profile.settings.language === 'en' ? countryInfo.nameEn : countryInfo.nameTr})` : ''}`}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/4 border border-white/8 text-[10px] font-medium text-zinc-200"
                                      >
                                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusColor}`} />
                                        {pd.country && <span className="text-[10px] shrink-0">{countryInfo.flag}</span>}
                                        <span className="truncate max-w-[80px]">{pd.username}</span>
                                        {pd.isBot && <span className="text-[8px] text-zinc-500">🤖</span>}
                                      </span>
                                    );
                                  })}
                                  {/* Empty slots */}
                                  {Array.from({ length: Math.max(0, ((room as any).maxPlayers || 4) - playerDetails.length) }).map((_, i) => (
                                    <span key={`empty-${i}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/2 border border-dashed border-white/8 text-[10px] text-zinc-700 font-medium">
                                      + Boş
                                    </span>
                                  ))}
                                </div>

                                {/* CTA Button */}
                                {isMyRoom ? (
                                  <button
                                    onClick={() => handleJoinExistingRoom(room.roomId, room.hasPassword)}
                                    className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black rounded-xl text-[11px] uppercase tracking-wider transition-all active:scale-[0.98] transform cursor-pointer shadow-md shadow-indigo-600/15 flex items-center justify-center gap-1.5"
                                  >
                                    ↩️ {profile.settings.language === 'en' ? 'Return to Room' : 'Odaya Geri Dön'}
                                  </button>
                                ) : canJoin ? (
                                  <button
                                    onClick={() => handleJoinExistingRoom(room.roomId, room.hasPassword)}
                                    className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-black rounded-xl text-[11px] uppercase tracking-wider transition-all active:scale-[0.98] transform cursor-pointer shadow-md shadow-emerald-600/15 flex items-center justify-center gap-1.5"
                                  >
                                    <span>{profile.settings.language === 'en' ? 'Join Room' : 'Odaya Katıl'}</span>
                                    <span>→</span>
                                  </button>
                                ) : (
                                  <div className="w-full py-2 bg-zinc-900/40 border border-zinc-800/40 rounded-xl text-[10px] text-zinc-600 font-black uppercase tracking-wider text-center flex items-center justify-center gap-1.5">
                                    {isLobby ? '🔒 Oda Dolu' : '🎮 Oyun Devam Ediyor'}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* ═══════════════════════════════════════════════════════
                      🏆 NAKAVT KUPA TURNUVALARI ARENA BANNER
                  ═══════════════════════════════════════════════════════ */}
                  <div className="relative overflow-hidden bg-gradient-to-r from-amber-950/60 via-slate-900 to-indigo-950/60 border-2 border-amber-500/40 rounded-2xl p-5 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-2xl shadow-inner shrink-0 animate-bounce">
                        👑
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            YENİ SEZON MODU
                          </span>
                          <span className="text-[10px] text-amber-400 font-bold">15,000🪙 Ödüllü</span>
                        </div>
                        <h4 className="text-sm sm:text-base font-black text-white uppercase tracking-wider mt-0.5">
                          🥊 Nakavt Kupa Turnuvaları (Knockout Arena)
                        </h4>
                        <p className="text-[11px] text-slate-300">
                          8 ve 16 kişilik eleme ağacı! Çeyrek, Yarı ve Büyük Finali kazanıp kupayı kaldırın.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => { sounds.playCoin(profile.settings); setActiveTab('tournaments'); }}
                      className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-amber-500/25 active:scale-95 transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5"
                    >
                      <Trophy className="w-4 h-4 text-slate-950" />
                      <span>🏆 Turnuvaya Katıl</span>
                    </button>
                  </div>

                  {/* Matchmaking section (unchanged) */}
                  {(!adminSettings || adminSettings.matchmakingEnabled !== false) && (
                    <div className="bg-gradient-to-r from-indigo-950/20 to-purple-950/10 border border-indigo-500/20 rounded-2xl p-6 relative overflow-hidden space-y-6">
                      {/* Background decor */}
                      <div className="absolute -top-12 -right-12 w-24 h-24 bg-indigo-600/10 rounded-full blur-2xl" />
                      <div className="absolute -bottom-12 -left-12 w-24 h-24 bg-purple-600/10 rounded-full blur-2xl" />

                      <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-indigo-500/10 pb-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm px-2.5 py-0.5 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 font-bold rounded-full tracking-wider uppercase text-[10px]">
                              DERECELİ LİG MODU
                            </span>
                            <span className="text-sm">🏆</span>
                          </div>
                          <h4 className="text-base font-black text-slate-100 flex items-center gap-2">
                            <span>Dereceli Arenalar (4 Kişilik Otomatik Eşleşme)</span>
                          </h4>
                          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
                            Aynı becerideki diğer aktif oyuncularla veya gelişmiş yapay zekalarla hızlıca **4 kişilik** kıran kırana dereceli rekabete girin. 
                            Birinci olan oyuncu toplam havuzun (<strong className="text-indigo-400">4x Giriş Ücreti</strong>) <strong className="text-emerald-400">%{adminSettings?.matchmakingWinnerShare ?? 80}</strong> miktarını kasasına götürür!
                          </p>
                          {matchmakingErrorMsg && (
                            <p className="text-xs text-red-400 font-bold bg-red-500/10 border border-red-500/20 p-2 rounded-lg mt-2 inline-block">
                              ⚠️ {matchmakingErrorMsg}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Arena Selection Grid */}
                      <div className="relative space-y-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Bir Arena / Lig Seçin
                        </span>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                          {[
                            { fee: 100, name: 'Bronz Arena', color: 'from-amber-600/10 to-amber-900/5 hover:from-amber-600/15 hover:to-amber-900/10 border-amber-500/20 text-amber-300', active: 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-500/10' },
                            { fee: 300, name: 'Gümüş Arena', color: 'from-slate-400/10 to-slate-600/5 hover:from-slate-400/15 hover:to-slate-600/10 border-slate-400/20 text-slate-200', active: 'border-slate-300 ring-2 ring-slate-300/20 bg-slate-500/10' },
                            { fee: 500, name: 'Altın Arena', color: 'from-yellow-500/10 to-yellow-800/5 hover:from-yellow-500/15 hover:to-yellow-800/10 border-yellow-500/20 text-yellow-300', active: 'border-yellow-500 ring-2 ring-yellow-500/20 bg-yellow-500/15' },
                            { fee: 750, name: 'Platin Arena', color: 'from-cyan-500/10 to-cyan-800/5 hover:from-cyan-500/15 hover:to-cyan-800/10 border-cyan-500/20 text-cyan-300', active: 'border-cyan-500 ring-2 ring-cyan-500/20 bg-cyan-500/15' },
                            { fee: 1000, name: 'Elmas Arena', color: 'from-indigo-500/10 to-indigo-800/5 hover:from-indigo-500/15 hover:to-indigo-800/10 border-indigo-500/20 text-indigo-300', active: 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-500/15' }
                          ].map((arena) => {
                            const isSelected = selectedMatchmakingFee === arena.fee;
                            const share = adminSettings?.matchmakingWinnerShare ?? 80;
                            const potentialPayout = Math.round((arena.fee * 4 * share) / 100);
                            return (
                              <button
                                key={arena.fee}
                                disabled={matchmakingActive}
                                onClick={() => { setSelectedMatchmakingFee(arena.fee); sounds.playDraw(profile.settings); }}
                                className={`group p-3 rounded-xl border bg-gradient-to-b text-left transition-all relative overflow-hidden ${
                                  isSelected ? arena.active : arena.color
                                } ${matchmakingActive ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'}`}
                              >
                                <div className="flex justify-between items-start mb-1.5">
                                  <span className="text-[10px] font-black uppercase tracking-wider block opacity-70 group-hover:opacity-100 transition-opacity">
                                    {arena.name}
                                  </span>
                                  {isSelected && (
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                  )}
                                </div>
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1">
                                    <Coins className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                    <span className="text-xs font-extrabold text-slate-100">
                                      {arena.fee} Altın
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-emerald-400 font-bold block">
                                    Ödül: {potentialPayout} Altın
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Search controls & Active indicator */}
                      <div className="relative flex justify-end">
                        <div className="w-full md:w-auto">
                          {!matchmakingActive ? (
                            <button
                              onClick={handleStartMatchmaking}
                              className="w-full md:w-auto px-10 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 active:scale-95 transform whitespace-nowrap cursor-pointer flex items-center justify-center gap-2"
                            >
                              <Play className="w-4 h-4 fill-current" />
                              <span>{selectedMatchmakingFee} Altın İle Arenaya Gir</span>
                            </button>
                          ) : (
                            <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-fadeIn">
                              <div className="bg-gradient-to-b from-slate-900 via-indigo-950/60 to-slate-900 border border-indigo-500/30 rounded-3xl p-6 sm:p-8 max-w-lg w-full text-center space-y-6 shadow-[0_0_50px_rgba(99,102,241,0.25)] relative overflow-hidden my-auto">
                                <div className="absolute -top-20 inset-x-0 h-40 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
                                <div className="space-y-2 relative z-10">
                                  <div className="inline-flex items-center gap-2 bg-indigo-500/15 border border-indigo-500/30 px-3 py-1 rounded-full text-indigo-300 font-extrabold text-[10px] uppercase tracking-widest shadow-sm">
                                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                                    <span>DERECELİ EŞLEŞTİRME SİSTEMİ</span>
                                  </div>
                                  <h3 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-wider">
                                    {matchmakingStatus === 'found' ? '✨ RAKİPLER BULUNDU!' : '⚡ RAKİP ARANIYOR...'}
                                  </h3>
                                  <p className="text-xs text-slate-300 font-medium">
                                    {matchmakingStatus === 'found'
                                      ? 'Dengeli dereceli eşleşme tamamlandı. Arenaya aktarılıyorsunuz!'
                                      : 'MMR seviyenize uygun dengeli rakipler aranıyor...'}
                                  </p>
                                </div>
                                <div className="relative w-32 h-32 mx-auto flex items-center justify-center my-4">
                                  <div className="absolute inset-0 rounded-full border border-indigo-500/20 animate-ping opacity-30" />
                                  <div className="absolute inset-2 rounded-full border border-purple-500/30 animate-pulse opacity-50" />
                                  <div className="absolute inset-6 rounded-full border border-indigo-400/40" />
                                  <div className="w-20 h-20 bg-slate-900 border-2 border-indigo-500 rounded-full flex flex-col items-center justify-center z-10 shadow-[0_0_20px_rgba(99,102,241,0.5)]">
                                    {matchmakingStatus === 'found' ? (
                                      <span className="text-3xl animate-bounce">⚔️</span>
                                    ) : (
                                      <>
                                        <span className="text-lg font-black text-amber-300 font-mono">{matchmakingElapsed}s</span>
                                        <span className="text-[8px] font-bold text-slate-400 uppercase">Süre</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <div className="bg-black/40 border border-white/10 rounded-2xl p-3 flex justify-between items-center text-xs font-mono">
                                  <div className="text-left">
                                    <span className="text-[9px] text-slate-400 font-bold uppercase block">Oyuncu MMR</span>
                                    <span className="text-amber-300 font-black">{profile.mmr ?? 1000} MMR</span>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-[9px] text-slate-400 font-bold uppercase block">Eşleşme Aralığı</span>
                                    <span className="text-indigo-400 font-black">
                                      [{Math.max(100, (profile.mmr ?? 1000) - matchmakingElapsed * 15)} - {(profile.mmr ?? 1000) + matchmakingElapsed * 15}]
                                    </span>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-left">
                                  <div className="bg-indigo-950/50 border border-indigo-500/40 rounded-xl p-2.5 flex items-center justify-between">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <AvatarWithFrame avatarId={profile.avatarId} avatarUrl={profile.avatarUrl} frameId={profile.settings.profileFrame || 'frame_none'} sizeClassName="w-7 h-7 text-[8px] shrink-0" />
                                      <div className="min-w-0">
                                        <span className="text-xs font-black text-white block truncate">{profile.username}</span>
                                        <span className="text-[8px] text-indigo-300 font-bold uppercase">Siz (Oyuncu #1)</span>
                                      </div>
                                    </div>
                                    <span className="text-[10px] text-emerald-400 font-black">✓</span>
                                  </div>
                                  {[2, 3, 4].map((num) => (
                                    <div key={num} className={`border rounded-xl p-2.5 flex items-center justify-between transition-all ${matchmakingStatus === 'found' ? 'bg-emerald-950/40 border-emerald-500/40' : 'bg-black/40 border-white/10'}`}>
                                      <div className="flex items-center gap-2 min-w-0">
                                        <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] shrink-0">
                                          {['🕵️', '👤', '🎭'][num - 2]}
                                        </div>
                                        <div className="min-w-0">
                                          <span className="text-xs font-black text-slate-200 block truncate">
                                            {matchmakingStatus === 'found' ? `Anonim ${['Alpha', 'Beta', 'Gamma'][num - 2]}` : `Anonim Oyuncu #${num}`}
                                          </span>
                                          <span className="text-[8px] text-slate-400 font-bold uppercase">
                                            {matchmakingStatus === 'found' ? 'Eşleşti' : 'Aranıyor...'}
                                          </span>
                                        </div>
                                      </div>
                                      {matchmakingStatus === 'found' ? (
                                        <span className="text-[10px] text-emerald-400 font-black">✓</span>
                                      ) : (
                                        <div className="w-2.5 h-2.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin shrink-0" />
                                      )}
                                    </div>
                                  ))}
                                </div>
                                <div className="pt-2">
                                  {matchmakingStatus === 'found' ? (
                                    <div className="bg-emerald-500/15 border border-emerald-500/30 p-3 rounded-2xl text-emerald-300 font-extrabold text-xs animate-pulse">
                                      ⚡ {matchmakingCountdown} saniye içinde maça aktarılıyorsunuz...
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => handleCancelMatchmaking(true)}
                                      className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-extrabold rounded-2xl text-xs uppercase tracking-wider transition-all cursor-pointer border border-white/10"
                                    >
                                      Aramayı İptal Et (İade Al)
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              )}
                        {/* TAB 2: Bot Practice */}
              {activeTab === 'bot_practice' && (
                <div className="bg-zinc-950/20 border border-zinc-900/80 rounded-2xl p-6 text-center space-y-6">
                  <div className="max-w-md mx-auto space-y-5">
                    <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                      <Bot className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-zinc-100 uppercase tracking-wider">{t('bot_practice_title', profile)}</h3>
                      <p className="text-xs text-zinc-500 leading-relaxed mt-1.5">
                        {t('bot_practice_desc', profile)}
                      </p>
                    </div>

                    {/* Bot zorluk seçimi (Improvement #20) */}
                    <div className="bg-zinc-900/10 border border-zinc-900/60 p-4 rounded-xl space-y-3">
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400 block text-left">{t('bot_difficulty_title', profile)}</span>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'easy', label: t('easy_lbl', profile), desc: t('easy_desc', profile) },
                          { id: 'medium', label: t('medium_lbl', profile), desc: t('medium_desc', profile) },
                          { id: 'hard', label: t('hard_lbl', profile), desc: t('hard_desc', profile) }
                        ].map((diff) => (
                          <button
                            key={diff.id}
                            type="button"
                            onClick={() => {
                              setBotDifficulty(diff.id as any);
                              sounds.playCoin(profile.settings);
                            }}
                            className={`p-2.5 rounded-xl border text-[10px] font-extrabold uppercase tracking-wider transition-all duration-150 cursor-pointer ${
                              botDifficulty === diff.id
                                ? 'bg-red-600/10 border-red-500/50 text-red-400 shadow-sm shadow-red-500/5'
                                : 'bg-zinc-900/20 border-zinc-900 text-zinc-500 hover:border-zinc-800'
                            }`}
                            title={diff.desc}
                          >
                            {diff.label}
                          </button>
                        ))}
                      </div>
                      <p className="text-[9px] text-zinc-500 text-left pt-1 italic leading-relaxed">
                        {botDifficulty === 'easy' && t('easy_hint', profile)}
                        {botDifficulty === 'medium' && t('medium_hint', profile)}
                        {botDifficulty === 'hard' && t('hard_hint', profile)}
                      </p>
                    </div>

                    <div className="bg-zinc-900/10 border border-zinc-900/40 rounded-xl p-4 text-left space-y-2.5 text-xs text-zinc-400">
                      <div className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-red-500" />
                        <span>{t('bot_practice_benefit1', profile)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-red-500" />
                        <span>{t('bot_practice_benefit2', profile)}</span>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <button
                        onClick={() => {
                          const rid = `offline-practice-${botDifficulty}-${Math.random().toString(36).substr(2, 5)}`;
                          sounds.playPlay(profile.settings);
                          onJoinRoom(rid, true);
                        }}
                        className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-extrabold rounded-xl transition-all shadow-sm active:scale-95 transform text-xs uppercase tracking-wider cursor-pointer border border-zinc-700"
                      >
                        1v1 Pratik ({botDifficulty === 'easy' ? t('easy_word', profile) : botDifficulty === 'medium' ? t('medium_word', profile) : t('hard_word', profile)})
                      </button>

                      <button
                        onClick={() => {
                          const rid = `offline-2v2-${botDifficulty}-${Math.random().toString(36).substr(2, 5)}`;
                          sounds.playPlay(profile.settings);
                          onJoinRoom(rid, true);
                        }}
                        className="flex-1 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-rose-600 hover:opacity-95 text-white font-black rounded-xl transition-all shadow-lg shadow-indigo-600/20 active:scale-95 transform text-xs uppercase tracking-wider cursor-pointer flex items-center justify-center gap-1.5 border border-indigo-400/30"
                      >
                        <span>⚔️</span>
                        <span>2v2 Takım Savaşı Başlat</span>
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
                          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                            selectedTournamentId === t.id
                              ? 'bg-gradient-to-br from-indigo-950/80 via-slate-900 to-indigo-950/80 border-indigo-400 shadow-xl shadow-indigo-600/20 ring-2 ring-indigo-500/50 scale-[1.02]'
                              : 'bg-zinc-900/40 border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-900/70'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-base">{t.icon || '🏆'}</span>
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              {t.prizeCoins ? `${t.prizeCoins.toLocaleString()} 🪙` : 'ÖDÜLLÜ'}
                            </span>
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-white">{t.name}</h4>
                            <p className="text-[9px] text-zinc-400 mt-0.5 line-clamp-1">{t.description}</p>
                          </div>
                          <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[8.5px] font-bold text-zinc-400">
                            <span>{t.entryFee ? `${t.entryFee} 🪙 Giriş` : 'Ücretsiz'}</span>
                            <span className="text-indigo-300">{t.maxParticipants || 8} Oyuncu</span>
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

              {/* TAB 4: Shop */}
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
                          className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-extrabold tracking-wider transition-all flex items-center gap-1 cursor-pointer ${
                            leaderboardSubTab === 'ranked'
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
                          className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-extrabold tracking-wider transition-all flex items-center gap-1 cursor-pointer ${
                            leaderboardSubTab === 'general'
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
                <AdminDashboard onSettingsUpdated={onUpdateAdminSettings} />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Mobile-only Persistent Stats & History Cards */}
          <div className="lg:hidden flex flex-col gap-4 mt-6">
            {/* Statistics Card */}
            <div className="bg-black/20 border border-white/5 rounded-2xl p-4 space-y-4 shadow-xl">
              <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                <span className="text-red-500">📊</span>
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-300">Oyuncu İstatistikleri</h3>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-emerald-500/10 border border-emerald-500/15 rounded-xl p-2.5 text-center">
                  <span className="text-base font-black text-emerald-400 block">{profile.stats.gamesWon}</span>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Galibiyet</span>
                </div>
                <div className="bg-slate-500/10 border border-white/5 rounded-xl p-2.5 text-center">
                  <span className="text-base font-black text-slate-400 block">{profile.stats.gamesLost}</span>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Yenilgi</span>
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
                            {game.result === 'won' ? 'Zafer' : 'Bozgun'}
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
                        // Submit login
                        const isCorrect = adminPasswordInput === 'admin123';
                        if (isCorrect) {
                          sounds.playCoin(profile.settings);
                          setIsAdminAuthenticated(true);
                          setActiveTab('admin');
                          setShowAdminLoginModal(false);
                        } else {
                          setAdminLoginError(
                            profile.settings.language === 'en'
                              ? 'Invalid password! Access denied.'
                              : 'Hatalı şifre girdiniz! Erişim reddedildi.'
                          );
                        }
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
                  onClick={() => {
                    const isCorrect = adminPasswordInput === 'admin123';
                    if (isCorrect) {
                      sounds.playCoin(profile.settings);
                      setIsAdminAuthenticated(true);
                      setActiveTab('admin');
                      setShowAdminLoginModal(false);
                    } else {
                      setAdminLoginError(
                        profile.settings.language === 'en'
                          ? 'Invalid password! Access denied.'
                          : 'Hatalı şifre girdiniz! Erişim reddedildi.'
                      );
                    }
                  }}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-amber-500/10 cursor-pointer"
                >
                  {profile.settings.language === 'en' ? 'Unlock Access' : 'Giriş Yap'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Custom Room Password Prompt Modal */}
        {showRoomPasswordModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="bg-slate-900 border border-white/10 rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl text-left"
            >
              {/* Header */}
              <div className="p-5 border-b border-white/10 flex justify-between items-center bg-black/20">
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-2 uppercase tracking-wide">
                    <span>🔑</span> {profile.settings.language === 'en' ? 'Locked Room' : 'Şifreli Oda'}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {profile.settings.language === 'en'
                      ? 'This room requires a password to join.'
                      : 'Bu odaya girmek için bir şifre gerekiyor.'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowRoomPasswordModal(false);
                    sounds.playPlay(profile.settings);
                  }}
                  className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all text-xs font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Form Input */}
              <div className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 uppercase tracking-widest font-black">
                    {profile.settings.language === 'en' ? 'Room Password' : 'Oda Şifresi'}
                  </label>
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
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/30 transition-all font-mono"
                    autoFocus
                  />
                </div>
              </div>

              {/* Action Footer */}
              <div className="p-4 border-t border-white/10 bg-black/20 flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    setShowRoomPasswordModal(false);
                    sounds.playPlay(profile.settings);
                  }}
                  className="px-4 py-2 hover:bg-white/5 text-slate-400 hover:text-white font-bold rounded-xl text-xs transition-all active:scale-95 cursor-pointer"
                >
                  {profile.settings.language === 'en' ? 'Cancel' : 'İptal'}
                </button>
                <button
                  onClick={() => {
                    sounds.playPlay(profile.settings);
                    setShowRoomPasswordModal(false);
                    onJoinRoom(pendingRoomId, false, roomPasswordInput.trim());
                  }}
                  className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow-lg shadow-red-600/10"
                >
                  {profile.settings.language === 'en' ? 'Join' : 'Katıl'}
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

      {/* Footer credits line */}
      <footer className="border-t border-white/10 py-4 text-center text-[10px] text-slate-500 bg-black/40 mt-8 z-10">
        © 2026 Deal Master PRO Deal Online. Tüm Hakları Saklıdır. Responsive & Fullstack UI.
      </footer>
    </div>
  );
};
