import React from 'react';
import { UserProfile, Friend, DailyQuest, UserSettings } from '../types';
import { sounds } from '../lib/SoundSystem';
import { AvatarWithFrame } from './AvatarWithFrame';
import { PerformanceChart } from './PerformanceChart';
import { t } from '../lib/TranslationSystem';
import { API_BASE_URL } from '../lib/apiConfig';
import { STORE_ITEMS, BOARD_THEME_STYLES, CARD_BACK_STYLES, AVATAR_EMOJIS } from './ShopDialog';

interface Props {
  profile: UserProfile;
  onUpdateProfile: (updated: UserProfile) => void;
}

const DEFAULT_ITEMS = [
  { id: 'theme_slate', name: 'Kozmik Slate', category: 'board_theme', description: 'Klasik koyu gri minimalist arka plan.' },
  { id: 'back_classic', name: 'Klasik Kırmızı', category: 'card_back', description: 'Standart kırmızı arka desen.' },
  { id: 'avatar_classic', name: 'Klasik Hükümdar', category: 'avatar', description: 'Geleneksel şapkalı asilzade.' },
  { id: 'frame_none', name: 'Klasik Sınır', category: 'profile_frame', description: 'Standart sade çerçeve.' },
  { id: 'skin_none', name: 'Varsayılan Temiz Kart', category: 'card_skin', description: 'Standart kart tasarımı.' },
  { id: 'vfx_none', name: 'Efekt Yok', category: 'action_vfx', description: 'Sıradan kart oynama animasyonları.' },
  { id: 'sound_classic', name: 'Klasik Melodi', category: 'celebration_sound', description: 'Klasik retro zafer melodisi.' }
];

export const ProfilePanel: React.FC<Props> = ({ profile, onUpdateProfile }) => {
  const [friendUsername, setFriendUsername] = React.useState('');
  const [friendError, setFriendError] = React.useState<string | null>(null);
  const [friendSuccess, setFriendSuccess] = React.useState<string | null>(null);

  // Tab and Inventory State
  const [activeSubTab, setActiveSubTab] = React.useState<'stats' | 'inventory'>('stats');
  const [invCategory, setInvCategory] = React.useState<'all' | 'board_theme' | 'card' | 'profile' | 'effects'>('all');

  const allOwnedItems = React.useMemo(() => {
    // Collect unlocked store items
    const unlockedStore = STORE_ITEMS.filter(item => 
      profile.unlockedItems.includes(item.id) || item.price === 0
    );
    // Combine with default free items
    const combined = [...DEFAULT_ITEMS];
    unlockedStore.forEach(storeIdx => {
      if (!combined.some(c => c.id === storeIdx.id)) {
        combined.push(storeIdx);
      }
    });
    return combined;
  }, [profile.unlockedItems]);

  const filteredOwned = React.useMemo(() => {
    return allOwnedItems.filter(item => {
      if (invCategory === 'all') return true;
      if (invCategory === 'board_theme') return item.category === 'board_theme' || item.category === 'player_board';
      if (invCategory === 'card') return item.category === 'card_skin' || item.category === 'card_back';
      if (invCategory === 'profile') return item.category === 'avatar' || item.category === 'profile_frame';
      if (invCategory === 'effects') return item.category === 'celebration_sound' || item.category === 'action_vfx';
      return false;
    });
  }, [allOwnedItems, invCategory]);

  const isItemEquipped = (category: string, itemId: string) => {
    const s = profile.settings;
    if (category === 'board_theme') return s.boardTheme === itemId;
    if (category === 'player_board') return (s.playerBoard || 'board_classic') === itemId;
    if (category === 'card_skin') return (s.cardSkin || 'skin_none') === itemId;
    if (category === 'card_back') return s.cardBack === itemId;
    if (category === 'profile_frame') return (s.profileFrame || 'frame_none') === itemId;
    if (category === 'celebration_sound') return (s.celebrationSound || 'sound_classic') === itemId;
    if (category === 'avatar') return profile.avatarId === itemId;
    if (category === 'action_vfx') return (s.actionVfx || 'vfx_none') === itemId;
    return false;
  };

  const handleEquipItem = async (category: string, itemId: string) => {
    let key: keyof UserSettings;
    if (category === 'board_theme') key = 'boardTheme';
    else if (category === 'player_board') key = 'playerBoard';
    else if (category === 'card_skin') key = 'cardSkin';
    else if (category === 'card_back') key = 'cardBack';
    else if (category === 'profile_frame') key = 'profileFrame';
    else if (category === 'celebration_sound') key = 'celebrationSound';
    else if (category === 'avatar') key = 'avatarId';
    else if (category === 'action_vfx') key = 'actionVfx';
    else return;

    const updatedSettings = {
      ...profile.settings,
      [key]: itemId,
    };

    const updatedProfile = {
      ...profile,
      settings: updatedSettings,
      ...(key === 'avatarId' ? { avatarId: itemId } : {}),
    };

    onUpdateProfile(updatedProfile);

    // Persist on server
    try {
      const response = await fetch(`${API_BASE_URL}/api/settings/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile.id, settings: { [key]: itemId } }),
      });
      if (response.ok) {
        sounds.playPlay(updatedSettings);
      }
    } catch (e) {
      console.error('Failed to save settings on server', e);
    }
  };

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    setFriendError(null);
    setFriendSuccess(null);

    if (friendUsername.trim() === '') return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/friends/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile.id, targetUsername: friendUsername }),
      });

      if (response.ok) {
        const data = await response.json();
        const updated = {
          ...profile,
          friends: data.friends,
        };
        onUpdateProfile(updated);
        setFriendSuccess(`${friendUsername} arkadaş olarak başarıyla eklendi!`);
        setFriendUsername('');
        sounds.playCoin(profile.settings);
      } else {
        const err = await response.json();
        setFriendError(err.error || 'Arkadaş ekleme başarısız.');
        sounds.playAlert(profile.settings);
      }
    } catch (err) {
      setFriendError('Sunucu bağlantı hatası oluştu.');
      sounds.playAlert(profile.settings);
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

  const nextLevelXp = 500;
  const xpPercentage = Math.min(100, (profile.xp % nextLevelXp) / (nextLevelXp / 100));

  return (
    <div id="profile-panel" className="max-w-5xl mx-auto space-y-6 text-white p-2 animate-fadeIn">
      {/* Sub-tab selection */}
      <div className="flex bg-black/40 p-1.5 rounded-xl border border-white/10 w-full sm:w-fit gap-2">
        <button
          onClick={() => setActiveSubTab('stats')}
          className={`flex-1 sm:flex-none px-6 py-3 rounded-lg text-xs font-black tracking-wider uppercase transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'stats'
              ? 'bg-red-600 text-white shadow-lg shadow-red-600/25 border border-red-500'
              : 'text-slate-400 hover:text-white border border-transparent'
          }`}
        >
          📊 {profile.settings.language === 'en' ? 'Profile & Stats' : 'Profil & İstatistikler'}
        </button>
        <button
          onClick={() => setActiveSubTab('inventory')}
          className={`flex-1 sm:flex-none px-6 py-3 rounded-lg text-xs font-black tracking-wider uppercase transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'inventory'
              ? 'bg-red-600 text-white shadow-lg shadow-red-600/25 border border-red-500'
              : 'text-slate-400 hover:text-white border border-transparent'
          }`}
        >
          🎒 {profile.settings.language === 'en' ? 'My Inventory' : 'Benim Envanterim'}
        </button>
      </div>

      {activeSubTab === 'stats' ? (
        <>
          {/* Upper Grid: Profile Summary and Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Profile Info & XP Card */}
            <div className="md:col-span-1 bg-black/20 border border-white/10 rounded-2xl p-6 flex flex-col justify-between shadow-2xl">
              <div>
                <div className="flex items-center gap-4 mb-4">
                  <AvatarWithFrame
                    avatarId={profile.avatarId}
                    avatarUrl={profile.avatarUrl}
                    frameId={profile.settings.profileFrame || 'frame_none'}
                    sizeClassName="w-16 h-16 text-3xl"
                  />
                  <div>
                    <h3 className="font-bold text-xl text-white">{profile.username}</h3>
                    <span className="text-xs text-red-400 font-bold bg-red-500/10 px-2.5 py-1 rounded-full inline-block mt-1">
                      {t('level', profile)} {profile.level}
                    </span>
                  </div>
                </div>

                {/* XP progress bar */}
                <div className="space-y-2 mt-4">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>{t('xp_progress', profile)}</span>
                    <span className="text-red-400 font-semibold">{profile.xp % nextLevelXp} / {nextLevelXp} XP</span>
                  </div>
                  <div className="w-full bg-white/10 h-2.5 rounded-full overflow-hidden border border-white/5">
                    <div
                      className="bg-gradient-to-r from-red-600 to-red-500 h-full transition-all duration-500"
                      style={{ width: `${xpPercentage}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 border-t border-white/10 pt-4 flex justify-between items-center text-sm">
                <span className="text-slate-400">{t('gold_earned', profile)}</span>
                <span className="font-bold text-amber-300 flex items-center gap-1">
                  <div className="w-3 h-3 bg-yellow-400 rounded-full shadow-md shadow-yellow-400/20"></div>
                  {profile.coins} {t('coins', profile)}
                </span>
              </div>
            </div>

            {/* Player Stats Card */}
            <div className="md:col-span-2 bg-black/20 border border-white/10 rounded-2xl p-6 shadow-2xl">
              <h3 className="text-lg font-semibold text-white mb-4 border-b border-white/10 pb-2">{t('match_stats', profile)}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-black/40 p-4 rounded-xl border border-white/5 text-center">
                  <span className="text-2xl font-black text-slate-200">{profile.stats.gamesPlayed}</span>
                  <p className="text-xs text-slate-400 mt-1">{t('total_matches', profile)}</p>
                </div>
                <div className="bg-black/40 p-4 rounded-xl border border-white/5 text-center">
                  <span className="text-2xl font-black text-red-500">{profile.stats.gamesWon}</span>
                  <p className="text-xs text-slate-400 mt-1">{t('wins', profile)}</p>
                </div>
                <div className="bg-black/40 p-4 rounded-xl border border-white/5 text-center">
                  <span className="text-2xl font-black text-slate-500">{profile.stats.gamesLost}</span>
                  <p className="text-xs text-slate-400 mt-1">{t('losses', profile)}</p>
                </div>
                <div className="bg-black/40 p-4 rounded-xl border border-white/5 text-center">
                  <span className="text-2xl font-black text-indigo-400">
                    {profile.stats.gamesPlayed > 0
                      ? Math.round((profile.stats.gamesWon / profile.stats.gamesPlayed) * 100)
                      : 0}%
                  </span>
                  <p className="text-xs text-slate-400 mt-1">{t('win_rate', profile)}</p>
                </div>
              </div>

              {/* Additional details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 text-sm text-slate-300">
                <div className="flex justify-between p-2.5 bg-black/40 border border-white/5 rounded-lg">
                  <span>{t('rent_collected', profile)}</span>
                  <span className="font-bold text-red-400">{profile.stats.totalRentCollected}M</span>
                </div>
                <div className="flex justify-between p-2.5 bg-black/40 border border-white/5 rounded-lg">
                  <span>{t('cards_stolen', profile)}</span>
                  <span className="font-bold text-red-400">{profile.stats.totalCardsStolen} {t('cards_count', profile).toLowerCase()}</span>
                </div>
                <div className="flex justify-between p-2.5 bg-black/40 border border-white/5 rounded-lg">
                  <span>{t('sets_completed', profile)}</span>
                  <span className="font-bold text-red-400">{profile.stats.totalSetsCompleted} {t('completed_sets', profile).toLowerCase()}</span>
                </div>
                <div className="flex justify-between p-2.5 bg-black/40 border border-white/5 rounded-lg">
                  <span>{t('bank_total', profile)}</span>
                  <span className="font-bold text-red-400">{profile.stats.totalMoneyBanked}M</span>
                </div>
              </div>
            </div>

            {/* D3 Performance Chart Full-Width Card */}
            <div className="col-span-1 md:col-span-3">
              <PerformanceChart stats={profile.stats} />
            </div>
          </div>

          {/* Middle Grid: Friends and Daily Quests */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Friends Management Panel */}
            <div className="bg-black/20 border border-white/10 rounded-2xl p-6 md:col-span-1 shadow-2xl">
              <h3 className="text-lg font-bold text-white mb-4">{t('friends', profile)} ({profile.friends.length})</h3>

              {/* Add Friend Form */}
              <form onSubmit={handleAddFriend} className="mb-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={t('add_friend_placeholder', profile)}
                    value={friendUsername}
                    onChange={(e) => setFriendUsername(e.target.value)}
                    className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500 transition-all"
                  />
                  <button
                    type="submit"
                    className="bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-2 rounded-xl text-sm transition-all transform active:scale-95 cursor-pointer"
                  >
                    Ekle
                  </button>
                </div>
                {friendError && <p className="text-xs text-red-400 mt-1">{friendError}</p>}
                {friendSuccess && <p className="text-xs text-emerald-400 mt-1">{friendSuccess}</p>}
              </form>

              {/* Friends List */}
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {profile.friends.map((friend) => (
                  <div key={friend.id} className="flex items-center justify-between p-2.5 bg-black/40 rounded-xl border border-white/5 hover:border-white/10 transition-all">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-sm border border-slate-700">
                        👤
                      </div>
                      <div>
                        <span className="font-semibold text-xs block text-white">{friend.username}</span>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <span className={`w-2 h-2 rounded-full ${friend.status === 'online' ? 'bg-red-500' : 'bg-slate-600'}`} />
                          {friend.status === 'online' ? t('friend_status_online', profile) : t('friend_status_offline', profile)}
                        </span>
                      </div>
                    </div>
                    {friend.status === 'online' && (
                      <button
                        onClick={() => sounds.playPlay(profile.settings)}
                        className="text-[10px] bg-red-500/15 border border-red-500/25 text-red-400 px-2 py-1 rounded hover:bg-red-600 hover:text-white font-bold transition-all cursor-pointer"
                      >
                        {t('invite', profile)}
                      </button>
                    )}
                  </div>
                ))}
                {profile.friends.length === 0 && (
                  <p className="text-xs text-slate-500 text-center py-4">{t('no_friends_yet', profile)}</p>
                )}
              </div>
            </div>

            {/* Daily Quests and Achievements Panel */}
            <div className="bg-black/20 border border-white/10 rounded-2xl p-6 md:col-span-2 space-y-6 shadow-2xl">
              
              {/* Daily Quests */}
              <div>
                <h3 className="text-lg font-bold text-red-500 mb-3 flex items-center gap-2">
                  <span>📅</span> {t('daily_special_quests', profile)}
                </h3>
                <div className="space-y-3">
                  {profile.dailyQuests.map((quest) => (
                    <div
                      key={quest.id}
                      className="bg-black/40 border border-white/5 rounded-xl p-3 flex items-center justify-between gap-4"
                    >
                      <div className="flex-1">
                        <span className="text-xs text-slate-300 font-medium block">{t(quest.description, profile)}</span>
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="w-24 bg-white/10 h-1.5 rounded-full overflow-hidden border border-white/5">
                            <div
                              className="bg-red-500 h-full"
                              style={{ width: `${(quest.currentValue / quest.targetValue) * 100}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-400 font-bold">
                            {quest.currentValue} / {quest.targetValue}
                          </span>
                        </div>
                      </div>

                      <div>
                        {quest.claimed ? (
                          <span className="text-xs text-slate-500 font-bold bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5">
                            {t('quest_reward_claimed', profile)}
                          </span>
                        ) : quest.completed ? (
                          <button
                            onClick={() => handleClaimQuest(quest.id)}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-lg transition-all flex items-center gap-1 shadow cursor-pointer"
                          >
                            Claim 💰{quest.rewardCoins}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-500 font-bold bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5 inline-block">
                            💰{quest.rewardCoins}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Achievements */}
              <div>
                <h3 className="text-lg font-bold text-red-500 mb-4 flex items-center gap-2">
                  <span>🏆</span> {t('achievements_title', profile)}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {profile.achievements.map((ach) => {
                    let badge = { emoji: '⭐', color: 'from-slate-400 to-slate-600' };
                    if (ach.id === 'ach-1') badge = { emoji: '🏆', color: 'from-amber-400 to-yellow-600' };
                    else if (ach.id === 'ach-2') badge = { emoji: '💰', color: 'from-emerald-400 to-teal-650' };
                    else if (ach.id === 'ach-3') badge = { emoji: '🕵️', color: 'from-indigo-400 to-purple-600' };
                    else if (ach.id === 'ach-streak') badge = { emoji: '🔥', color: 'from-red-500 to-orange-600' };
                    else if (ach.id === 'ach-collector') badge = { emoji: '👑', color: 'from-fuchsia-400 to-pink-650' };
                    else if (ach.id === 'ach-fast') badge = { emoji: '⚡', color: 'from-cyan-400 to-blue-600' };

                    const isCompleted = ach.completed;
                    const percent = Math.min(100, (ach.currentValue / ach.targetValue) * 100);

                    return (
                      <div 
                        key={ach.id} 
                        className={`bg-black/40 border rounded-2xl p-4 flex gap-4 hover:border-white/25 transition-all items-center ${isCompleted ? 'border-red-500/25 shadow-lg shadow-red-500/5' : 'border-white/5'}`}
                      >
                        {/* Badge Visual Representation */}
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl flex-shrink-0 bg-gradient-to-br ${isCompleted ? badge.color + ' shadow-md shadow-white/10' : 'from-slate-800 to-slate-900 border border-white/5 opacity-40 grayscale'}`}>
                          {badge.emoji}
                        </div>

                        <div className="flex-1 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <h4 className={`font-bold text-xs ${isCompleted ? 'text-white font-black' : 'text-slate-400'}`}>
                                {t(ach.title, profile)}
                              </h4>
                              <p className="text-[9px] text-slate-400 leading-tight mt-0.5">{t(ach.description, profile)}</p>
                            </div>
                            <div className="text-right">
                              {isCompleted ? (
                                <span className="text-[8px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                                  {t('ach_status_unlocked', profile)}
                                </span>
                              ) : (
                                <span className="text-[8px] bg-slate-500/10 text-slate-400 border border-white/5 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                  {t('ach_status_locked', profile)}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Progress Bar and Indicator */}
                          <div className="space-y-1">
                            <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden border border-white/5">
                              <div 
                                className={`h-full transition-all duration-500 bg-gradient-to-r ${isCompleted ? badge.color : 'from-slate-650 to-slate-550'}`}
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                            <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 leading-none">
                              <span className="text-amber-300 font-bold">💰 +{ach.rewardCoins} {t('coins', profile)}</span>
                              <span className="font-mono">{ach.currentValue} / {ach.targetValue}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        </>
      ) : (
        <div className="space-y-6 animate-fadeIn">
          {/* Inventory Header */}
          <div className="bg-gradient-to-r from-red-950/40 to-black/40 border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                <span>🎒</span> {profile.settings.language === 'en' ? 'Personal Inventory' : 'Kişisel Envanter'}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {profile.settings.language === 'en' 
                  ? 'Manage, listen, and equip your purchased backgrounds, cards, sounds, and active effects.'
                  : 'Satın aldığın veya kazandığın tüm masa temalarını, kart görünümlerini ve efektleri buradan yönet.'}
              </p>
            </div>
            <div className="flex items-center gap-3 bg-black/50 px-4 py-2 rounded-xl border border-white/5">
              <span className="text-xs text-slate-400 font-bold">{profile.settings.language === 'en' ? 'Owned Items' : 'Sahip Olunan'}:</span>
              <span className="text-sm font-black text-amber-400 flex items-center gap-1">
                🏆 {allOwnedItems.length} {profile.settings.language === 'en' ? 'items' : 'Öğe'}
              </span>
            </div>
          </div>

          {/* Category Selector Tabs */}
          <div className="flex flex-wrap gap-2 border-b border-white/10 pb-4">
            {[
              { id: 'all', label: profile.settings.language === 'en' ? 'All' : 'Tümü', icon: '📁' },
              { id: 'board_theme', label: profile.settings.language === 'en' ? 'Board Themes' : 'Masa Temaları', icon: '🎨' },
              { id: 'card', label: profile.settings.language === 'en' ? 'Card Skins' : 'Kart Görünümleri', icon: '🃏' },
              { id: 'profile', label: profile.settings.language === 'en' ? 'Profile Items' : 'Profil & Avatarlar', icon: '👤' },
              { id: 'effects', label: profile.settings.language === 'en' ? 'Sounds & VFX' : 'Sesler & Efektler', icon: '⚡' },
            ].map(cat => (
              <button
                key={cat.id}
                onClick={() => setInvCategory(cat.id as any)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  invCategory === cat.id
                    ? 'bg-red-500/15 border border-red-500/40 text-red-400 shadow-md shadow-red-500/5'
                    : 'bg-black/20 border border-white/5 text-slate-400 hover:text-white'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          {/* Items Grid */}
          {filteredOwned.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredOwned.map(item => {
                const isEquipped = isItemEquipped(item.category, item.id);
                
                // Styles lookup
                const bTheme = BOARD_THEME_STYLES[item.id];
                const cBack = CARD_BACK_STYLES[item.id];
                const avatarEmoji = AVATAR_EMOJIS[item.id] || '👤';

                return (
                  <div
                    key={item.id}
                    className={`group bg-black/30 rounded-2xl border transition-all flex flex-col justify-between overflow-hidden shadow-xl ${
                      isEquipped 
                        ? 'border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.06)] bg-emerald-950/5' 
                        : 'border-white/5 hover:border-white/15'
                    }`}
                  >
                    {/* Visual Preview Area */}
                    <div className="relative h-44 flex items-center justify-center bg-black/40 overflow-hidden border-b border-white/5">
                      {/* Grid background pattern */}
                      <div className="absolute inset-0 bg-[radial-gradient(#ffffff03_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

                      {/* Item Preview Rendering based on Category */}
                      {item.category === 'board_theme' && (
                        <div className={`absolute inset-0 m-3 rounded-xl flex flex-col items-center justify-center p-4 shadow-inner ${bTheme?.bgClass || 'bg-slate-900'}`}>
                          <span className="text-4xl mb-2 filter drop-shadow animate-bounce">{bTheme?.icon || '🎨'}</span>
                          <span className="text-[10px] font-black tracking-wider uppercase bg-white/10 px-2 py-0.5 rounded-full text-slate-300">
                            {bTheme?.badge || 'Tema'}
                          </span>
                        </div>
                      )}

                      {item.category === 'card_back' && (
                        <div className="w-24 h-36 rounded-xl border border-white/20 p-2 shadow-2xl relative overflow-hidden flex flex-col justify-between" style={{ backgroundColor: cBack?.color || '#EF4444' }}>
                          {cBack?.bgClass && <div className={`absolute inset-0 ${cBack.bgClass}`} />}
                          <div className="relative z-10 flex justify-between text-xs font-black" style={{ color: cBack?.pColor || '#FFF' }}>
                            <span>10</span>
                            <span>A</span>
                          </div>
                          <div className="relative z-10 text-3xl self-center filter drop-shadow-md">{cBack?.symbol || '▲'}</div>
                          <div className="relative z-10 flex justify-between text-xs font-black rotate-180" style={{ color: cBack?.pColor || '#FFF' }}>
                            <span>10</span>
                            <span>A</span>
                          </div>
                        </div>
                      )}

                      {item.category === 'card_skin' && (
                        <div className="w-24 h-36 rounded-xl border border-white/20 p-3 bg-slate-800 shadow-2xl flex flex-col justify-between relative overflow-hidden">
                          {item.id === 'skin_holographic' && (
                            <div className="absolute inset-0 bg-gradient-to-tr from-pink-500/20 via-cyan-500/20 to-yellow-500/20 animate-pulse pointer-events-none" />
                          )}
                          {item.id === 'skin_rune' && (
                            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-500/10 via-slate-800 to-slate-900 pointer-events-none" />
                          )}
                          <div className="flex justify-between text-[10px] font-bold text-slate-400">
                            <span>M$ 5M</span>
                            <span>⚡</span>
                          </div>
                          <div className="text-center font-bold text-xs text-white">
                            {item.id === 'skin_holographic' ? '✨ HOLO' : item.id === 'skin_rune' ? '🔮 RUNE' : '🃏 TEMİZ'}
                          </div>
                          <div className="flex justify-between text-[10px] font-bold text-slate-400 rotate-180">
                            <span>M$ 5M</span>
                            <span>⚡</span>
                          </div>
                        </div>
                      )}

                      {item.category === 'avatar' && (
                        <div className="w-20 h-20 rounded-full bg-slate-800 border-2 border-white/10 flex items-center justify-center text-4xl shadow-2xl filter drop-shadow">
                          {avatarEmoji}
                        </div>
                      )}

                      {item.category === 'profile_frame' && (
                        <div className="scale-125">
                          <AvatarWithFrame
                            avatarId="avatar_classic"
                            avatarUrl=""
                            frameId={item.id}
                            sizeClassName="w-16 h-16 text-3xl"
                          />
                        </div>
                      )}

                      {item.category === 'celebration_sound' && (
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-3xl text-indigo-400">
                            🎶
                          </div>
                          <button
                            onClick={() => sounds.playCelebration(item.id, profile.settings)}
                            className="px-3 py-1 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 font-bold text-[10px] rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                          >
                            🔊 {profile.settings.language === 'en' ? 'Listen Preview' : 'Önizleme Dinle'}
                          </button>
                        </div>
                      )}

                      {item.category === 'action_vfx' && (
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-3xl text-amber-400 animate-pulse">
                            ✨
                          </div>
                          <span className="text-[10px] bg-amber-500/15 border border-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-black uppercase tracking-widest">
                            {item.id.replace('vfx_', '').toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Metadata Area */}
                    <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-sm text-white group-hover:text-red-400 transition-colors">{item.name}</h4>
                          <span className="text-[9px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-full text-slate-400 uppercase tracking-wider font-bold">
                            {item.category.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">{item.description}</p>
                      </div>

                      {/* Equip Button */}
                      <div className="pt-3 border-t border-white/5 mt-auto">
                        {isEquipped ? (
                          <button
                            disabled
                            className="w-full py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5"
                          >
                            <span className="text-sm">✓</span>
                            <span>{profile.settings.language === 'en' ? 'Active' : 'Aktif'}</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleEquipItem(item.category, item.id)}
                            className="w-full py-2 bg-red-600 hover:bg-red-500 text-white font-black text-xs rounded-xl transition-all shadow-md shadow-red-650/10 hover:shadow-red-650/20 active:scale-[0.98] cursor-pointer"
                          >
                            {profile.settings.language === 'en' ? 'Equip Item' : 'Aktifleştir'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-black/20 border border-white/10 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-4 max-w-lg mx-auto">
              <span className="text-5xl">📦</span>
              <h4 className="font-bold text-lg text-white">
                {profile.settings.language === 'en' ? 'No owned items in category' : 'Bu kategoride ürün bulunamadı'}
              </h4>
              <p className="text-xs text-slate-400 max-w-sm">
                {profile.settings.language === 'en'
                  ? 'You have not unlocked any items in this category yet. You can visit the shop to discover incredible visual styles!'
                  : 'Henüz bu kategori için özel bir öğe açmadın. Market sekmesine giderek birikmiş paraların ile harika görünümler ve ses paketleri satın alabilirsin!'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
