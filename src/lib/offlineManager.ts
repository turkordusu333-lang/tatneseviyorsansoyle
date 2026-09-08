import { UserProfile, Tournament, TournamentMatch } from '../types';

const OFFLINE_PROFILE_STORAGE_KEY = 'deal_master_offline_profile';
const OFFLINE_TOURNAMENTS_KEY = 'deal_master_offline_tournaments';

export const DEFAULT_OFFLINE_PROFILE: UserProfile = {
  id: 'user_offline_master',
  username: 'Çevrimdışı Oyuncu',
  coins: 1000,
  xp: 0,
  level: 1,
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
  unlockedItems: ['frame_none', 'sound_classic', 'board_classic', 'music_classic'],
  settings: {
    soundVolume: 0.8,
    soundPitch: 1.0,
    synthType: 'sine',
    cardBack: 'card_back_classic',
    boardTheme: 'theme_classic',
    avatarId: 'avatar_classic',
    clothesId: 'clothes_classic',
    profileFrame: 'frame_none',
    celebrationSound: 'sound_classic',
    language: localStorage.getItem('language') || 'tr',
    cardSkin: 'skin_classic',
    actionVfx: 'vfx_classic',
    playerBoard: 'board_classic',
    gameMusic: 'music_classic',
  },
  dailyQuests: [
    {
      id: 'quest_offline_1',
      description: 'Botlara karşı 1 maç kazan',
      targetValue: 1,
      currentValue: 0,
      completed: false,
      claimed: false,
      rewardCoins: 200,
      rewardXp: 50,
    },
    {
      id: 'quest_offline_2',
      description: 'Toplam 3 tam arsa grubu tamamla',
      targetValue: 3,
      currentValue: 0,
      completed: false,
      claimed: false,
      rewardCoins: 350,
      rewardXp: 80,
    },
    {
      id: 'quest_offline_3',
      description: 'Kupa Turnuvasında en az 1 tur ilerle',
      targetValue: 1,
      currentValue: 0,
      completed: false,
      claimed: false,
      rewardCoins: 500,
      rewardXp: 120,
    },
  ],
  achievements: [
    {
      id: 'ach_offline_1',
      title: 'İlk Çevrimdışı Zafer',
      description: 'Botlara karşı ilk oyununu kazan.',
      targetValue: 1,
      currentValue: 0,
      completed: false,
      rewardCoins: 300,
    },
    {
      id: 'ach_offline_2',
      title: 'Kupa Avcısı',
      description: 'Çevrimdışı kupa turnuvası şampiyonu ol.',
      targetValue: 1,
      currentValue: 0,
      completed: false,
      rewardCoins: 1000,
    },
    {
      id: 'ach_offline_3',
      title: 'Mülk Kralı',
      description: 'Toplam 10 mülk seti tamamla.',
      targetValue: 10,
      currentValue: 0,
      completed: false,
      rewardCoins: 750,
    },
  ],
  gamesHistory: [],
  rankPoints: 100,
  lastLuckyWheelSpin: '0',
};

/**
 * Gets or creates a local offline profile from localStorage
 */
export function getOrCreateLocalProfile(username?: string): UserProfile {
  const customKey = username ? `deal_master_local_profile_${username.trim().toLowerCase()}` : OFFLINE_PROFILE_STORAGE_KEY;
  try {
    const raw = localStorage.getItem(customKey) || localStorage.getItem(OFFLINE_PROFILE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (username && username.trim()) {
          parsed.username = username.trim();
        }
        return {
          ...DEFAULT_OFFLINE_PROFILE,
          ...parsed,
          settings: { ...DEFAULT_OFFLINE_PROFILE.settings, ...(parsed.settings || {}) },
          stats: { ...DEFAULT_OFFLINE_PROFILE.stats, ...(parsed.stats || {}) },
          dailyQuests: parsed.dailyQuests || DEFAULT_OFFLINE_PROFILE.dailyQuests,
          achievements: parsed.achievements || DEFAULT_OFFLINE_PROFILE.achievements,
          unlockedItems: parsed.unlockedItems || DEFAULT_OFFLINE_PROFILE.unlockedItems,
        };
      }
    }
  } catch (e) {
    console.error('Failed to load local offline profile:', e);
  }

  const newProfile: UserProfile = {
    ...DEFAULT_OFFLINE_PROFILE,
    id: `user_offline_${Date.now()}`,
    username: username && username.trim() ? username.trim() : 'Çevrimdışı Oyuncu',
  };
  saveLocalProfile(newProfile);
  return newProfile;
}

/**
 * Persists offline profile to localStorage
 */
export function saveLocalProfile(profile: UserProfile): void {
  try {
    const customKey = `deal_master_local_profile_${profile.username.trim().toLowerCase()}`;
    const serialized = JSON.stringify(profile);
    localStorage.setItem(customKey, serialized);
    localStorage.setItem(OFFLINE_PROFILE_STORAGE_KEY, serialized);
    localStorage.setItem('deal_master_last_profile', serialized);
  } catch (e) {
    console.error('Failed to save local offline profile:', e);
  }
}

/**
 * Default offline tournaments configuration
 */
export function getDefaultOfflineTournaments(username: string): Tournament[] {
  const userDisplay = username || 'Sen';
  
  return [
    {
      id: 't-bronze',
      name: '🥉 Acemi Bronz Kupası',
      description: 'Hızlı 8 kişilik eleme kupası. Yeni taktikleri test etmek ve pratik yapmak için ideal!',
      tier: 'bronze',
      entryFee: 0,
      prizeCoins: 600,
      prizeXp: 200,
      maxParticipants: 8,
      icon: '🥉',
      format: '1v1',
      botDifficulty: 'easy',
      targetSets: 3,
      turnDurationSeconds: 30,
      participants: [userDisplay, 'Bot Memo', 'Bot Can', 'Bot Defne', 'Bot Mert', 'Bot Ada', 'Bot Ege', 'Bot Selin'],
      rounds: [],
      status: 'registration',
    },
    {
      id: 't-silver',
      name: '🥈 Usta Gümüş Şampiyonası',
      description: '8 kişilik zorlu usta turnuvası. Zeki hamleler ve taktiksel kart yönetimi gerektirir.',
      tier: 'silver',
      entryFee: 150,
      prizeCoins: 1500,
      prizeXp: 500,
      maxParticipants: 8,
      icon: '🥈',
      format: '1v1',
      botDifficulty: 'medium',
      targetSets: 3,
      turnDurationSeconds: 30,
      participants: [userDisplay, 'Usta Bot Burak', 'Stratejist Melis', 'Taktisyen Kaya', 'Kurt Bot Cem', 'Deha Elif', 'Gölge Ozan', 'Fırtına Zeynep'],
      rounds: [],
      status: 'registration',
    },
    {
      id: 't-gold',
      name: '👑 Efsanevi Altın Arena (2v2)',
      description: 'Takım çalışmasına dayalı 4 takımlı 2v2 şampiyona. Ortağınla beraber zaferi kazan!',
      tier: 'gold',
      entryFee: 300,
      prizeCoins: 3500,
      prizeXp: 1200,
      maxParticipants: 8,
      icon: '👑',
      format: '2v2_team',
      botDifficulty: 'hard',
      targetSets: 4,
      turnDurationSeconds: 30,
      participants: [userDisplay, 'Müttefik Bot Can', 'Rakip Bot Alpha', 'Rakip Bot Beta', 'Takım 3 Lideri', 'Takım 3 Destek', 'Takım 4 Lideri', 'Takım 4 Destek'],
      rounds: [],
      status: 'registration',
    },
  ];
}

/**
 * Gets offline tournaments from localStorage or initializes defaults
 */
export function getOfflineTournaments(username: string): Tournament[] {
  try {
    const raw = localStorage.getItem(OFFLINE_TOURNAMENTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to parse offline tournaments:', e);
  }

  const initial = getDefaultOfflineTournaments(username);
  saveOfflineTournaments(initial);
  return initial;
}

export function saveOfflineTournaments(tournaments: Tournament[]): void {
  try {
    localStorage.setItem(OFFLINE_TOURNAMENTS_KEY, JSON.stringify(tournaments));
  } catch (e) {
    console.error('Failed to save offline tournaments:', e);
  }
}

/**
 * Starts a tournament locally in offline mode
 */
export function startOfflineTournament(tournamentId: string, username: string): Tournament[] {
  const tournaments = getOfflineTournaments(username);
  const target = tournaments.find((t) => t.id === tournamentId);
  if (!target) return tournaments;

  const participants = [...target.participants];
  if (!participants.includes(username)) {
    participants[0] = username;
  }

  // Generate Round 1 (Quarter Finals for 8 players)
  const round1Matches: TournamentMatch[] = [];
  const totalMatches = Math.floor(participants.length / 2);

  for (let i = 0; i < totalMatches; i++) {
    const p1 = participants[i * 2];
    const p2 = participants[i * 2 + 1];
    round1Matches.push({
      id: `m-r1-${i + 1}`,
      player1: p1,
      player2: p2,
      status: 'pending',
    });
  }

  target.status = 'active';
  target.rounds = [
    {
      roundNumber: 1,
      matches: round1Matches,
    },
  ];

  saveOfflineTournaments(tournaments);
  return tournaments;
}

/**
 * Resets an offline tournament
 */
export function resetOfflineTournament(tournamentId: string, username: string): Tournament[] {
  const defaults = getDefaultOfflineTournaments(username);
  const current = getOfflineTournaments(username);
  const defaultTarget = defaults.find((t) => t.id === tournamentId);

  const updated = current.map((t) => {
    if (t.id === tournamentId && defaultTarget) {
      return { ...defaultTarget };
    }
    return t;
  });

  saveOfflineTournaments(updated);
  return updated;
}

/**
 * Advances tournament round upon match completion
 */
export function advanceOfflineTournamentMatch(
  tournamentId: string,
  matchId: string,
  playerWon: boolean,
  profile: UserProfile
): { tournaments: Tournament[]; updatedProfile: UserProfile } {
  const tournaments = getOfflineTournaments(profile.username);
  const target = tournaments.find((t) => t.id === tournamentId);
  let updatedProfile = { ...profile };

  if (!target || !target.rounds || target.rounds.length === 0) {
    return { tournaments, updatedProfile };
  }

  const currentRound = target.rounds[target.rounds.length - 1];
  const targetMatch = currentRound.matches.find((m) => m.id === matchId);

  if (targetMatch && targetMatch.status === 'pending') {
    targetMatch.status = 'completed';
    targetMatch.winner = playerWon ? profile.username : (targetMatch.player1 === profile.username ? targetMatch.player2 : targetMatch.player1);
    targetMatch.score1 = playerWon ? 3 : 1;
    targetMatch.score2 = playerWon ? 1 : 3;

    // Simulate other bot matches in the round
    currentRound.matches.forEach((m) => {
      if (m.id !== matchId && m.status === 'pending') {
        m.status = 'completed';
        // Randomly pick a bot winner
        const randWinner = Math.random() > 0.5 ? m.player1 : m.player2;
        m.winner = randWinner;
        m.score1 = randWinner === m.player1 ? 3 : Math.floor(Math.random() * 2);
        m.score2 = randWinner === m.player2 ? 3 : Math.floor(Math.random() * 2);
      }
    });

    if (!playerWon) {
      // Player eliminated
      target.status = 'completed';
      target.winner = targetMatch.winner;
    } else {
      // Check if this was the Final
      if (currentRound.matches.length === 1) {
        target.status = 'completed';
        target.winner = profile.username;
        // Award championship prizes!
        updatedProfile.coins += target.prizeCoins || 600;
        updatedProfile.xp += target.prizeXp || 200;
        updatedProfile.stats.gamesWon++;
        updatedProfile.stats.gamesPlayed++;
        
        // Check achievement
        const ach = updatedProfile.achievements.find(a => a.id === 'ach_offline_2');
        if (ach && !ach.completed) {
          ach.completed = true;
          ach.currentValue = 1;
          updatedProfile.coins += ach.rewardCoins;
        }
      } else {
        // Generate next round
        const winners = currentRound.matches.map((m) => m.winner || m.player1);
        const nextRoundMatches: TournamentMatch[] = [];
        for (let i = 0; i < Math.floor(winners.length / 2); i++) {
          nextRoundMatches.push({
            id: `m-r${currentRound.roundNumber + 1}-${i + 1}`,
            player1: winners[i * 2],
            player2: winners[i * 2 + 1],
            status: 'pending',
          });
        }

        const nextRoundNumber = currentRound.roundNumber + 1;
        target.rounds.push({
          roundNumber: nextRoundNumber,
          matches: nextRoundMatches,
        });

        // Award round progress
        updatedProfile.coins += 100;
        updatedProfile.xp += 40;
      }
    }
  }

  saveOfflineTournaments(tournaments);
  saveLocalProfile(updatedProfile);

  return { tournaments, updatedProfile };
}
