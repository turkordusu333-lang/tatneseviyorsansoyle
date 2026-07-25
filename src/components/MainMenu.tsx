import React from 'react';
import { UserProfile, MatchState } from '../types';
import { ShopDialog } from './ShopDialog';
import { ProfilePanel } from './ProfilePanel';
import { CustomizationPanel } from './CustomizationPanel';
import { sounds } from '../lib/SoundSystem';
import { AvatarWithFrame } from './AvatarWithFrame';
import { AdminDashboard } from './AdminDashboard';
import { motion, AnimatePresence } from 'motion/react';
import { t } from '../lib/TranslationSystem';
import { API_BASE_URL } from '../lib/apiConfig';

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

export const MainMenu: React.FC<Props> = ({ profile, onUpdateProfile, onJoinRoom, adminSettings, onUpdateAdminSettings }) => {
  const [activeTab, setActiveTab] = React.useState<'play' | 'bot_practice' | 'tournaments' | 'shop' | 'customization' | 'profile' | 'rules' | 'leaderboard' | 'admin'>('play');
  const [botDifficulty, setBotDifficulty] = React.useState<'easy' | 'medium' | 'hard'>('medium');
  const [rooms, setRooms] = React.useState<any[]>([]);
  const [customRoomId, setCustomRoomId] = React.useState('');
  const [roomPassword, setRoomPassword] = React.useState(''); // State to hold optional room password on creation
  const [tournamentJoined, setTournamentJoined] = React.useState(false);

  React.useEffect(() => {
    if (adminSettings && adminSettings.rankedLeagueEnabled === false && activeTab === 'leaderboard') {
      setActiveTab('play');
    }
  }, [adminSettings, activeTab]);

  // Avatar ve Liderlik Tablosu Durumları
  const [showAvatarModal, setShowAvatarModal] = React.useState(false);
  const [leaderboardData, setLeaderboardData] = React.useState<any[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = React.useState(false);
  const [leaderboardCategory, setLeaderboardCategory] = React.useState<'wins' | 'coins' | 'level'>('wins');

  const fetchLeaderboard = async (cat: 'wins' | 'coins' | 'level' = leaderboardCategory) => {
    setLeaderboardLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/leaderboard?category=${cat}`);
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
      fetchLeaderboard(leaderboardCategory);
    }
  }, [activeTab, leaderboardCategory]);

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
    setShowAvatarModal(false);

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
  const [activeTournament, setActiveTournament] = React.useState<any>({
    id: 't-1',
    name: 'Deal Master PRO Türkiye Kupası 2026',
    status: 'registration',
    participants: ['Bot Memo', 'Bot Can', 'Bot Defne', 'Milyoner Bot', 'Hızlı Zar Bot'],
    rounds: []
  });

  // Fetch active multiplayer lobbies
  const fetchLobbies = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/rooms`);
      if (res.ok) {
        const data = await res.json();
        setRooms(data);
      }
    } catch (e) {
      console.error('Failed to fetch lobbies', e);
    }
  };

  React.useEffect(() => {
    if (activeTab === 'play') {
      fetchLobbies();
      const interval = setInterval(fetchLobbies, 4000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  // Admin login custom states
  const [showAdminLoginModal, setShowAdminLoginModal] = React.useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = React.useState('');
  const [adminLoginError, setAdminLoginError] = React.useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = React.useState(false);

  // Room joining custom password states
  const [showRoomPasswordModal, setShowRoomPasswordModal] = React.useState(false);
  const [roomPasswordInput, setRoomPasswordInput] = React.useState('');
  const [pendingRoomId, setPendingRoomId] = React.useState('');

  const handleCreateRoom = (offline: boolean = false) => {
    const rid = offline
      ? `offline-${Math.random().toString(36).substr(2, 5)}`
      : customRoomId.trim() !== ''
        ? customRoomId.trim()
        : `oda-${Math.random().toString(36).substr(2, 5)}`;

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

  const handleRegisterTournament = () => {
    sounds.playCoin(profile.settings);
    setTournamentJoined(true);
    setActiveTournament((prev: any) => ({
      ...prev,
      status: 'active',
      participants: [...prev.participants, profile.username],
      rounds: [
        {
          roundNumber: 1,
          matches: [
            { id: 'tm-1', player1: 'Bot Memo', player2: 'Bot Can', score1: 3, score2: 2, status: 'completed', winner: 'Bot Memo' },
            { id: 'tm-2', player1: 'Bot Defne', player2: 'Milyoner Bot', score1: 1, score2: 3, status: 'completed', winner: 'Milyoner Bot' },
            { id: 'tm-3', player1: 'Hızlı Zar Bot', player2: profile.username, status: 'pending' }
          ]
        }
      ]
    }));
  };

  const handlePlayTournamentMatch = () => {
    sounds.playPlay(profile.settings);
    // Start bot practice match simulating tournament matchup
    onJoinRoom(`tournament-match-${Math.random().toString(36).substr(2, 5)}`, true);
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
    <div id="main-menu" className="min-h-screen bg-[#0A0C10] text-white font-sans flex flex-col justify-between relative overflow-hidden">

      {/* Top Header bar */}
      <header className="border-b border-white/10 bg-black/40 backdrop-blur-md px-4 sm:px-8 py-3 sm:py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-red-600 to-red-800 rounded-lg flex items-center justify-center font-black text-lg sm:text-xl shadow-lg shadow-red-955/20 text-white italic">
            M
          </div>
          <div>
            <h1 className="text-sm sm:text-lg font-bold tracking-tight uppercase italic text-white leading-none mb-0.5 sm:mb-1">
              Deal Master <span className="text-red-500">PRO</span>
            </h1>
            <span className="text-[8px] sm:text-[10px] text-slate-400 font-bold block leading-none">MOBİL & WEB DESTEKLİ</span>
          </div>
        </div>

        {/* Quick User summary */}
        <div className="flex items-center gap-2 sm:gap-6">
          <div className="flex gap-2">
            <div className="flex items-center gap-1.5 bg-black/40 px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-full border border-white/5">
              <div className="w-2.5 h-2.5 bg-yellow-400 rounded-full shadow-md shadow-yellow-500/20 animate-pulse"></div>
              <span className="text-[10px] sm:text-xs font-mono font-bold text-amber-300">💰 {profile.coins}</span>
            </div>

            {/* Quick Language Toggle */}
            <div className="flex items-center bg-black/40 px-2.5 py-1 rounded-full border border-white/5 text-[10px] sm:text-xs">
              <button
                onClick={async () => {
                  const nextLang = (profile.settings.language || 'tr') === 'tr' ? 'en' : 'tr';
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
                className="hover:text-amber-400 transition-colors uppercase font-black cursor-pointer px-1 flex items-center gap-1"
              >
                🌐 {(profile.settings.language || 'tr') === 'tr' ? 'EN' : 'TR'}
              </button>
            </div>
          </div>

          <div
            onClick={() => {
              setShowAvatarModal(true);
              sounds.playPlay(profile.settings);
            }}
            title="Profil Resmini Değiştir"
            className="flex items-center gap-2 sm:gap-3 border-l border-white/10 pl-2 sm:pl-6 cursor-pointer hover:opacity-80 transition-all select-none group"
          >
            <div className="text-right hidden sm:block">
              <p className="text-[10px] text-slate-400 font-medium leading-none flex items-center gap-1 justify-end">
                <span>Level {profile.level}</span>
                <span className="text-[8px] bg-red-600/20 text-red-400 font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider group-hover:bg-red-600 group-hover:text-white transition-all">Değiştir</span>
              </p>
              <p className="text-sm font-bold text-slate-200 mt-1 leading-none">{profile.username}</p>
            </div>

            {/* XP Ring Progress Gauge (Improvement #18) */}
            <div className="relative flex items-center justify-center p-1">
              <svg className="w-10 h-10 sm:w-11 sm:h-11 absolute transform -rotate-90 pointer-events-none">
                <circle cx="20" cy="20" r="17" className="sm:cx-22 sm:cy-22 sm:r-19" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" fill="transparent" />
                <circle
                  cx="20"
                  cy="20"
                  r="17"
                  className="sm:cx-22 sm:cy-22 sm:r-19"
                  stroke="#ef4444"
                  strokeWidth="2.5"
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 17}
                  strokeDashoffset={2 * Math.PI * 17 * (1 - Math.min(Math.max((profile.xp % 100) / 100, 0), 0.999))}
                  strokeLinecap="round"
                  style={{
                    transition: 'stroke-dashoffset 1s ease-in-out',
                    filter: 'drop-shadow(0 0 3px rgba(239, 68, 68, 0.4))'
                  }}
                />
              </svg>
              <AvatarWithFrame
                avatarId={profile.avatarId}
                avatarUrl={profile.avatarUrl}
                frameId={profile.settings.profileFrame || 'frame_none'}
                sizeClassName="w-8 h-8 sm:w-9 sm:h-9 text-[10px] sm:text-xs"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout Grid */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6 items-start z-10">

        {/* Navigation Sidebar */}
        <nav className="lg:col-span-1 flex flex-col gap-4">
          <div className="bg-black/20 border border-white/5 rounded-2xl p-2 sm:p-4 flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible pb-3 lg:pb-0 whitespace-nowrap scrollbar-none w-full">
            {[
              { id: 'play', label: t('tab_multiplayer', profile), color: 'hover:text-red-500' },
              { id: 'bot_practice', label: t('tab_bot_practice', profile), color: 'hover:text-red-500' },
              { id: 'tournaments', label: t('tab_tournaments', profile), color: 'hover:text-red-500' },
              (!adminSettings || adminSettings.rankedLeagueEnabled !== false) && { id: 'leaderboard', label: t('tab_leaderboard', profile), color: 'hover:text-red-500' },
              { id: 'shop', label: t('tab_shop', profile), color: 'hover:text-red-500' },
              { id: 'customization', label: t('tab_customize', profile), color: 'hover:text-red-500' },
              { id: 'profile', label: t('tab_profile', profile), color: 'hover:text-red-500' },
              { id: 'rules', label: t('tab_rules', profile), color: 'hover:text-red-500' },
              { id: 'admin', label: t('tab_admin', profile), color: 'hover:text-amber-500' },
            ].filter(Boolean).map((tab: any) => (
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
                className={`flex-shrink-0 lg:w-full text-left px-3.5 py-2 rounded-xl font-semibold text-xs sm:text-sm transition-all flex items-center justify-between gap-4 ${activeTab === tab.id
                  ? 'bg-gradient-to-r from-red-600/15 to-transparent border-l-4 border-red-500 text-red-400 font-bold shadow-lg shadow-red-600/5'
                  : `text-slate-400 ${tab.color} hover:bg-white/5`
                  }`}
              >
                <span>{tab.label}</span>
                {activeTab === tab.id && <span className="text-red-500 text-xs hidden lg:inline">●</span>}
              </button>
            ))}
          </div>

          {/* Persistent Stats & History Cards (Visible on Desktop) */}
          <div className="hidden lg:flex flex-col gap-4 w-full">
            {/* Statistics Card */}
            <div className="bg-black/20 border border-white/5 rounded-2xl p-4 space-y-4 shadow-xl">
              <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                <span className="text-red-500">📊</span>
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-300">İstatistikler</h3>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <div className="bg-emerald-500/10 border border-emerald-500/15 rounded-xl p-2 text-center">
                  <span className="text-sm font-black text-emerald-400 block">{profile.stats.gamesWon}</span>
                  <span className="text-[8px] text-slate-400 block uppercase font-bold">{t('wins', profile)}</span>
                </div>
                <div className="bg-slate-500/10 border border-white/5 rounded-xl p-2 text-center">
                  <span className="text-sm font-black text-slate-400 block">{profile.stats.gamesLost}</span>
                  <span className="text-[8px] text-slate-400 block uppercase font-bold">{t('losses', profile)}</span>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/15 rounded-xl p-2 text-center">
                  <span className="text-sm font-black text-amber-400 block">
                    {profile.stats.gamesPlayed > 0 ? Math.round((profile.stats.gamesWon / profile.stats.gamesPlayed) * 100) : 0}%
                  </span>
                  <span className="text-[8px] text-slate-400 block uppercase font-bold">{t('win_rate', profile)}</span>
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
                  <span className="text-[9px] bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded-full font-bold">
                    {t('wins_count', profile, profile.gamesHistory.length)}
                  </span>
                )}
              </div>

              <div className="space-y-2 max-h-[220px] overflow-y-auto scrollbar-none">
                {!profile.gamesHistory || profile.gamesHistory.length === 0 ? (
                  <div className="text-center py-6 text-slate-500">
                    <span className="text-xl block mb-1">🎮</span>
                    <p className="text-[10px] leading-relaxed">Henüz oyun oynanmadı.<br />Arenaya katılarak hemen başla!</p>
                  </div>
                ) : (
                  profile.gamesHistory.slice(0, 3).map((game) => (
                    <div key={game.id} className="bg-black/30 border border-white/5 rounded-xl p-2.5 flex items-center justify-between text-xs gap-3">
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${game.result === 'won' ? 'bg-emerald-500 shadow-md shadow-emerald-500/30' : 'bg-red-500 shadow-md shadow-red-500/30'}`}></span>
                          <span className="font-extrabold text-slate-200 text-[10px]">
                            {game.result === 'won' ? 'Zafer' : 'Bozgun'}
                          </span>
                          <span className="text-[8px] text-slate-500 font-mono flex-shrink-0">{game.date.split(' ')[0]}</span>
                        </div>
                        <p className="text-[9px] text-slate-400 truncate max-w-[100px]">vs {game.opponent}</p>
                      </div>
                      <div className="text-right flex flex-col items-end flex-shrink-0">
                        <span className="text-[9px] font-bold text-amber-300 font-mono">+{game.coinsEarned}💰</span>
                        <span className="text-[8px] font-semibold text-slate-400 font-mono">+{game.xpEarned} XP</span>
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
            <div className="bg-black/30 border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl relative overflow-hidden backdrop-blur-sm">
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/5 rounded-full filter blur-2xl pointer-events-none" />
              <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📅</span>
                  <div>
                    <h3 className="font-bold text-sm sm:text-base text-white">{t('daily_special_quests', profile)}</h3>
                    <p className="text-[10px] text-slate-400">{t('complete_quests_to_earn', profile)}</p>
                  </div>
                </div>
                <span className="text-[10px] bg-red-500/15 text-red-400 border border-red-500/20 px-2.5 py-1 rounded-full font-bold">
                  {t('todays_quests', profile)}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {profile.dailyQuests.map((quest) => {
                  const percent = Math.min(100, (quest.currentValue / quest.targetValue) * 100);
                  return (
                    <div key={quest.id} className="bg-black/40 border border-white/5 rounded-xl p-3 flex flex-col justify-between gap-3 hover:border-white/10 transition-all">
                      <div>
                        <span className="text-xs text-slate-200 font-bold block min-h-[32px] leading-tight">
                          {t(quest.description, profile)}
                        </span>

                        <div className="space-y-1 mt-2">
                          <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden border border-white/5">
                            <div
                              className="bg-gradient-to-r from-red-600 to-red-500 h-full transition-all duration-500"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                            <span>{t('progress_lbl', profile)}</span>
                            <span>{quest.currentValue} / {quest.targetValue}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-white/5 pt-2 mt-1">
                        <div className="flex flex-col text-[10px]">
                          <span className="text-amber-300 font-bold flex items-center gap-1">
                            💰 +{quest.rewardCoins} Altın
                          </span>
                          <span className="text-red-400 font-bold flex items-center gap-1">
                            ⚡ +{quest.rewardXp !== undefined ? quest.rewardXp : 30} XP
                          </span>
                        </div>

                        {quest.claimed ? (
                          <span className="text-[10px] text-slate-500 font-extrabold bg-white/5 px-2 py-1 rounded border border-white/5 uppercase">
                            Alındı
                          </span>
                        ) : quest.completed ? (
                          <button
                            onClick={() => handleClaimQuest(quest.id)}
                            className="px-2.5 py-1.5 bg-red-600 hover:bg-red-500 text-white font-extrabold text-[10px] rounded-lg transition-all shadow-md shadow-red-600/20 animate-pulse uppercase"
                          >
                            Ödülü Al
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-bold bg-white/5 px-2.5 py-1 rounded border border-white/5 uppercase">
                            Bekliyor
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
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
                <div className="bg-black/20 border border-white/10 rounded-2xl p-6 space-y-6 shadow-2xl">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
                    <div>
                      <h3 className="text-xl font-bold text-white">{t('multiplayer_lobby_title', profile)}</h3>
                      <p className="text-xs text-slate-400">{t('multiplayer_lobby_desc', profile)}</p>
                    </div>

                    {/* Create Room Actions */}
                    <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-2 items-center">
                      <input
                        type="text"
                        placeholder={t('enter_code', profile)}
                        value={customRoomId}
                        onChange={(e) => setCustomRoomId(e.target.value)}
                        className="w-full sm:w-36 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500 transition-all focus:ring-1 focus:ring-red-500/20"
                      />
                      <input
                        type="password"
                        placeholder={profile.settings.language === 'en' ? "Password (optional)" : "Şifre (isteğe bağlı)"}
                        value={roomPassword}
                        onChange={(e) => setRoomPassword(e.target.value)}
                        className="w-full sm:w-36 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500 transition-all focus:ring-1 focus:ring-red-500/20"
                      />
                      <button
                        onClick={() => handleCreateRoom(false)}
                        className="w-full sm:w-auto px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-red-600/20 active:scale-95 transform whitespace-nowrap cursor-pointer"
                      >
                        {t('create_room_btn', profile)}
                      </button>
                    </div>
                  </div>

                  {/* Lobbies List */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-slate-300">{t('active_rooms_title', profile, rooms.length)}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {rooms.map((room) => (
                        <div
                          key={room.roomId}
                          className="bg-black/20 border border-white/5 rounded-xl p-4 flex flex-col justify-between hover:border-white/10 transition-all relative overflow-hidden"
                        >
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-xs text-red-400 bg-red-600/10 border border-red-500/10 px-2.5 py-0.5 rounded-full">
                                  ID: {room.roomId}
                                </span>
                                {room.hasPassword && (
                                  <span className="text-xs" title={profile.settings.language === 'en' ? "Password Protected" : "Şifreli Oda"}>
                                    🔒
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-slate-400 font-medium">
                                👥 {room.playerCount} Oyuncu
                              </span>
                            </div>
                            <p className="text-xs text-slate-300 mb-4 font-semibold">
                              Oyuncular: {room.players.join(', ')}
                            </p>
                          </div>

                          {room.status === 'lobby' || room.players.includes(profile.username) ? (
                            <button
                              onClick={() => handleJoinExistingRoom(room.roomId, room.hasPassword)}
                              className="w-full py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-xs transition-all active:scale-95 transform font-black cursor-pointer"
                            >
                              {room.status === 'lobby' ? 'Odaya Katıl' : 'Oyuna Geri Dön'}
                            </button>
                          ) : (
                            <button
                              disabled
                              className="w-full py-2 bg-white/5 text-slate-500 border border-white/5 font-bold rounded-lg text-xs cursor-not-allowed"
                            >
                              Oyun Devam Ediyor
                            </button>
                          )}
                        </div>
                      ))}

                      {rooms.length === 0 && (
                        <div className="col-span-2 text-center py-8 bg-black/10 rounded-xl border border-dashed border-white/5 text-slate-500 text-xs">
                          {t('no_rooms_lbl', profile)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: Bot Practice */}
              {activeTab === 'bot_practice' && (
                <div className="bg-black/20 border border-white/10 rounded-2xl p-6 text-center space-y-6 shadow-2xl">
                  <div className="max-w-md mx-auto space-y-4">
                    <div className="w-20 h-20 bg-red-500/10 border border-red-500/30 text-red-500 text-4xl rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-red-500/5 animate-bounce-subtle">
                      🤖
                    </div>
                    <h3 className="text-xl font-bold text-white">Bot Pratik Modu (Çevrimdışı)</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      İnternet bağlantısına ihtiyaç duymadan akıllı bot rakiplere karşı kendinizi test edin. Kuralları öğrenmek ve desteleri denemek için mükemmel bir fırsat!
                    </p>

                    {/* Bot zorluk seçimi (Improvement #20) */}
                    <div className="bg-black/40 border border-white/5 p-4 rounded-xl space-y-2">
                      <span className="text-xs font-bold text-slate-300 block text-left">🤖 Bot Yapay Zeka Zorluk Derecesi:</span>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'easy', label: 'Kolay 🟢', desc: 'Yavaş düşünür, basit kararlar alır' },
                          { id: 'medium', label: 'Orta 🟡', desc: 'Standart taktikler ve hız' },
                          { id: 'hard', label: 'Zor 🔴', desc: 'Hızlı hamleler, agresif taktikler' }
                        ].map((diff) => (
                          <button
                            key={diff.id}
                            type="button"
                            onClick={() => {
                              setBotDifficulty(diff.id as any);
                              sounds.playCoin(profile.settings);
                            }}
                            className={`p-2.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${botDifficulty === diff.id
                              ? 'bg-red-600/20 border-red-500 text-red-400 font-extrabold shadow-md shadow-red-500/10'
                              : 'bg-black/20 border-white/5 hover:border-white/15 text-slate-400'
                              }`}
                            title={diff.desc}
                          >
                            {diff.label}
                          </button>
                        ))}
                      </div>
                      <span className="text-[10px] text-slate-400 block text-left pt-1 italic">
                        {botDifficulty === 'easy' && '🟢 Kolay: Bot karar verirken 2.5 saniye bekler ve basit hamleler yapar.'}
                        {botDifficulty === 'medium' && '🟡 Orta: Bot standart 1.8 saniye bekleme süresiyle akılcı hamleler üretir.'}
                        {botDifficulty === 'hard' && '🔴 Zor: Bot anında (0.9 sn) karar verir, mülk takaslarını ve "Anlaşma Bozan" kartlarını çok agresif kullanır!'}
                      </span>
                    </div>

                    <div className="bg-black/40 border border-white/5 rounded-xl p-4 text-left space-y-2.5 text-xs text-slate-300">
                      <div className="flex items-center gap-2">
                        <span className="text-red-500 font-bold">✔</span> Akıllı yapay zeka hamleleri
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-red-500 font-bold">✔</span> Hızlı ve kesintisiz oynanış
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-red-500 font-bold">✔</span> Pratik modu görevleriyle ödüller kazanma şansı
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        // Pass difficulty inside the Room ID (Improvement #20)
                        const rid = `offline-practice-${botDifficulty}-${Math.random().toString(36).substr(2, 5)}`;
                        sounds.playPlay(profile.settings);
                        onJoinRoom(rid, true);
                      }}
                      className="w-full py-3.5 bg-red-600 hover:bg-red-500 text-white font-extrabold rounded-xl transition-all shadow-lg shadow-red-600/20 active:scale-95 transform text-sm cursor-pointer"
                    >
                      Pratik Maçı Başlat ({botDifficulty === 'easy' ? 'Kolay' : botDifficulty === 'medium' ? 'Orta' : 'Zor'}) 🚀
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: Tournaments */}
              {activeTab === 'tournaments' && (
                <div className="bg-black/20 border border-white/10 rounded-2xl p-6 space-y-6 shadow-2xl">
                  <div className="border-b border-white/10 pb-4">
                    <h3 className="text-xl font-bold flex items-center gap-2 text-white">
                      <span>🏆</span> Turnuva Sistemi
                    </h3>
                    <p className="text-xs text-slate-400">Turnuvalara kaydolun, rakiplerinizi eleyin ve şampiyonluk ödülü 1000 Altını kazanın!</p>
                  </div>

                  {!tournamentJoined ? (
                    <div className="bg-black/40 border border-white/5 rounded-2xl p-6 text-center space-y-4 max-w-md mx-auto">
                      <span className="text-4xl">👑</span>
                      <h4 className="font-extrabold text-red-500 uppercase tracking-tight">Deal Master PRO Türkiye Kupası 2026</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Kayıtlar devam ediyor! Turnuva başladığında oyuncular rastgele eşleştirilir ve her turda en hızlı 3 galibiyete ulaşan bir üst tura yükselir.
                      </p>
                      <div className="flex items-center justify-between bg-black/60 px-4 py-3 rounded-xl border border-white/5 text-xs">
                        <span className="text-slate-400">Katılım Bedeli:</span>
                        <span className="font-bold text-amber-400">Ücretsiz (Giriş seviyesi)</span>
                      </div>
                      <button
                        onClick={handleRegisterTournament}
                        className="w-full py-3.5 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl text-sm transition-all shadow-lg shadow-red-600/20 active:scale-95 transform"
                      >
                        Turnuvaya Kaydol (Katıl)
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Bracket visualization */}
                      <div className="bg-black/40 rounded-2xl p-5 border border-white/5 space-y-4">
                        <div className="flex justify-between items-center">
                          <h4 className="font-bold text-sm text-red-400">1. Tur Brackets (Eşleşmeler)</h4>
                          <span className="text-xs bg-red-500/10 text-red-400 border border-red-500/25 px-2.5 py-0.5 rounded-full font-bold">
                            Kaydınız Aktif
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {activeTournament.rounds[0].matches.map((m: any) => (
                            <div key={m.id} className="bg-black/50 border border-white/5 rounded-xl p-3 flex flex-col justify-between hover:border-white/10 transition-all">
                              <div className="space-y-2">
                                <div className="flex justify-between items-center text-xs">
                                  <span className={m.winner === m.player1 ? 'text-red-400 font-bold' : 'text-slate-300'}>
                                    {m.player1} {m.winner === m.player1 ? '👑' : ''}
                                  </span>
                                  <span className="font-bold text-slate-400">{m.score1 !== undefined ? m.score1 : '-'}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                  <span className={m.winner === m.player2 ? 'text-red-400 font-bold' : 'text-slate-300'}>
                                    {m.player2} {m.winner === m.player2 ? '👑' : ''}
                                  </span>
                                  <span className="font-bold text-slate-400">{m.score2 !== undefined ? m.score2 : '-'}</span>
                                </div>
                              </div>

                              <div className="mt-4 pt-2 border-t border-white/5 flex justify-between items-center">
                                <span className={`text-[10px] font-bold uppercase ${m.status === 'completed' ? 'text-slate-500' : 'text-red-500 animate-pulse'}`}>
                                  {m.status === 'completed' ? 'Tamamlandı' : 'Sıra Sende'}
                                </span>
                                {m.status === 'pending' && (
                                  <button
                                    onClick={handlePlayTournamentMatch}
                                    className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-black text-[10px] rounded uppercase transition-all shadow shadow-red-600/10"
                                  >
                                    Maçı Oyna
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: Shop */}
              {activeTab === 'shop' && <ShopDialog profile={profile} onUpdateProfile={onUpdateProfile} />}

              {/* TAB 5: Customization */}
              {activeTab === 'customization' && <CustomizationPanel profile={profile} onUpdateProfile={onUpdateProfile} />}

              {/* TAB 6: Profile */}
              {activeTab === 'profile' && <ProfilePanel profile={profile} onUpdateProfile={onUpdateProfile} />}

              {/* TAB 7: Rules / Instructions */}
              {activeTab === 'rules' && (
                <div className="bg-black/20 border border-white/10 rounded-2xl p-6 space-y-6 shadow-2xl">
                  <div className="border-b border-white/10 pb-4">
                    <h3 className="text-xl font-bold text-red-500">📜 Deal Master PRO Deal Kuralları</h3>
                    <p className="text-xs text-slate-400">Hızlıca öğrenip kazanmaya başlayın</p>
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
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-white/10 pb-4 gap-4">
                    <div>
                      <h3 className="text-xl font-bold flex items-center gap-2 text-white">
                        <span>🏆</span> {t('leaderboard_title', profile)}
                      </h3>
                      <p className="text-xs text-slate-400">{t('leaderboard_desc', profile)}</p>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                      <div className="flex bg-black/40 border border-white/10 p-1 rounded-xl gap-1">
                        <button
                          onClick={() => setLeaderboardCategory('wins')}
                          className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${leaderboardCategory === 'wins' ? 'bg-red-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                        >
                          👑 {t('wins', profile)}
                        </button>
                        <button
                          onClick={() => setLeaderboardCategory('coins')}
                          className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${leaderboardCategory === 'coins' ? 'bg-red-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                        >
                          💰 {t('coins', profile)}
                        </button>
                        <button
                          onClick={() => setLeaderboardCategory('level')}
                          className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${leaderboardCategory === 'level' ? 'bg-red-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                        >
                          ⭐ {t('level', profile)}
                        </button>
                      </div>

                      <button
                        onClick={() => fetchLeaderboard(leaderboardCategory)}
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
                              <th className="py-3 px-4 text-center">{t('level', profile)}</th>
                              <th className="py-3 px-4 text-center">Kazanma Oranı</th>
                              <th className="py-3 px-4 text-center">{t('wins', profile)}</th>
                              <th className="py-3 px-4 text-center">{t('coins', profile)}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {leaderboardData.map((player, index) => {
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
                                      frameId={player.profileFrame || 'frame_none'}
                                      sizeClassName="w-8 h-8 text-sm"
                                    />
                                    <span className={`text-sm ${isCurrentUser ? 'text-red-400 font-extrabold' : 'text-slate-100'}`}>
                                      {player.username} {isCurrentUser && <span className="text-[9px] bg-red-600 text-white font-extrabold px-1.5 py-0.5 rounded ml-1.5 uppercase tracking-wide">SEN</span>}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                    <span className="text-xs bg-red-500/10 text-red-400 border border-red-500/15 font-extrabold px-2 py-0.5 rounded-full">
                                      Seviye {player.level}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-center font-bold text-amber-400">
                                    %{player.winRate || 0}
                                  </td>
                                  <td className="py-3 px-4 text-center font-bold text-emerald-400">{player.gamesWon} / {player.gamesPlayed}</td>
                                  <td className="py-3 px-4 text-center text-amber-300 font-mono font-bold">💰 {player.coins}</td>
                                </tr>
                              );
                            })}
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
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Avatar Seçim Modalı */}
      <AnimatePresence>
        {showAvatarModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="bg-slate-900 border border-white/10 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl text-left"
            >
              {/* Header */}
              <div className="p-5 border-b border-white/10 flex justify-between items-center bg-black/20">
                <div>
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <span>🖼️</span> Avatar Seçimi
                  </h3>
                  <p className="text-xs text-slate-400">Giriş yaptıktan sonra diğer oyuncuların göreceği avatarı seçin</p>
                </div>
                <button
                  onClick={() => {
                    setShowAvatarModal(false);
                    sounds.playPlay(profile.settings);
                  }}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Grid content */}
              <div className="p-6 space-y-6 max-h-[380px] overflow-y-auto">
                {/* Active Avatar Indicator */}
                <div className="flex items-center gap-4 bg-black/40 p-4 rounded-2xl border border-white/5">
                  <AvatarWithFrame
                    avatarId={profile.avatarId}
                    avatarUrl={profile.avatarUrl}
                    frameId={profile.settings.profileFrame || 'frame_none'}
                    sizeClassName="w-14 h-14 text-2xl"
                  />
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Mevcut Avatarın</span>
                    <span className="text-sm font-extrabold text-white">{profile.username}</span>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3.5">
                  {/* Option to clear custom photo and use Emojis */}
                  <button
                    onClick={() => handleSelectAvatar('')}
                    className={`aspect-square rounded-2xl bg-black/40 border-2 p-1.5 flex flex-col items-center justify-center transition-all ${!profile.avatarUrl
                      ? 'border-red-500 ring-2 ring-red-500/25 bg-red-500/5'
                      : 'border-white/5 hover:border-white/20'
                      }`}
                  >
                    <span className="text-2xl mb-1 select-none">🎭</span>
                    <span className="text-[8px] uppercase font-bold text-slate-400 text-center leading-none">Emojili Klasik</span>
                  </button>

                  {PRESET_AVATARS.map((av) => {
                    const isSelected = profile.avatarUrl === av.url;
                    return (
                      <button
                        key={av.id}
                        onClick={() => handleSelectAvatar(av.url)}
                        className={`aspect-square rounded-2xl bg-black/40 border-2 overflow-hidden p-1 relative group transition-all ${isSelected
                          ? 'border-red-500 ring-2 ring-red-500/25'
                          : 'border-white/5 hover:border-white/20'
                          }`}
                      >
                        <img
                          src={av.url}
                          alt={av.name}
                          className="w-full h-full object-cover rounded-xl group-hover:scale-105 transition-all duration-300"
                          referrerPolicy="no-referrer"
                        />
                        {isSelected && (
                          <div className="absolute inset-0 bg-red-600/10 flex items-center justify-center">
                            <span className="bg-red-600 text-white rounded-full p-0.5 text-[8px] font-black uppercase px-1.5">Seçildi</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Action Footer */}
              <div className="p-4 border-t border-white/10 bg-black/20 flex justify-end">
                <button
                  onClick={() => {
                    setShowAvatarModal(false);
                    sounds.playPlay(profile.settings);
                  }}
                  className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-extrabold rounded-xl text-xs uppercase tracking-wide transition-all active:scale-95 transform"
                >
                  Kapat (Tamam)
                </button>
              </div>
            </motion.div>
          </div>
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

      {/* Footer credits line */}
      <footer className="border-t border-white/10 py-4 text-center text-[10px] text-slate-500 bg-black/40 mt-8 z-10">
        © 2026 Deal Master PRO Deal Online. Tüm Hakları Saklıdır. Responsive & Fullstack UI.
      </footer>
    </div>
  );
};
