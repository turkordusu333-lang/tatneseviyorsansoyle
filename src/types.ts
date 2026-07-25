/**
 * Deal Master PRO - Type Definitions
 */

export type CardColor =
  | 'brown'
  | 'lightblue'
  | 'pink'
  | 'orange'
  | 'red'
  | 'yellow'
  | 'green'
  | 'darkblue'
  | 'railroad'
  | 'utility';

export type CardType =
  | 'money'
  | 'property'
  | 'action'
  | 'rent'
  | 'house-hotel'
  | 'wildcard';

export interface Card {
  id: string;
  type: CardType;
  name: string;
  value: number; // In millions (e.g., 1, 2, 3, 4, 5, 10)
  color?: CardColor;
  secondaryColor?: CardColor; // For dual-rent or property wildcards
  isWildcard?: boolean;
  actionType?:
  | 'pass-go'
  | 'debt-collector'
  | 'birthday'
  | 'forced-deal'
  | 'sly-deal'
  | 'deal-breaker'
  | 'just-say-no'
  | 'double-rent'
  | 'house'
  | 'hotel';
  rentValues?: number[]; // Rent values corresponding to count [1, 2, 3, 4]
  maxInSet?: number; // Target count to complete a full set
  allowedColors?: CardColor[]; // Allowed colors for wildcards
  description: string;
}

export interface PlayerStats {
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  winRate: number;
  totalRentCollected: number;
  totalCardsStolen: number;
  totalSetsCompleted: number;
  totalMoneyBanked: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  targetValue: number;
  currentValue: number;
  completed: boolean;
  rewardCoins: number;
  type?: string;
}

export interface DailyQuest {
  id: string;
  description: string;
  targetValue: number;
  currentValue: number;
  completed: boolean;
  claimed: boolean;
  rewardCoins: number;
  rewardXp: number;
  type?: string;
}

export type StoreItemRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';

export interface StoreItem {
  id: string;
  name: string;
  category: 'avatar' | 'card_back' | 'board_theme' | 'sound_pack' | 'profile_frame' | 'celebration_sound' | 'card_skin' | 'action_vfx' | 'player_board';
  price: number;
  previewUrl?: string;
  previewColor?: string;
  description: string;
  isUnlocked: boolean;
  mediaUrl?: string;
  mediaType?: 'image' | 'gif' | 'video';
  rarity?: StoreItemRarity;
  overlayMode?: 'normal' | 'overlay' | 'screen' | 'multiply' | 'color-dodge' | 'soft-light' | 'hard-light';
  overlayOpacity?: number; // 0.1 to 1.0
  glowColor?: string; // CSS color string e.g. #f59e0b
  particleEffect?: 'none' | 'sparkles' | 'fire' | 'snow' | 'matrix' | 'bubbles' | 'stars';
  discountPercent?: number;
}

export interface UserSettings {
  soundVolume: number;
  soundPitch: number; // 0.5 to 2.0 multiplier
  synthType: 'sine' | 'square' | 'triangle' | 'sawtooth';
  cardBack: string; // ID of unlocked item
  boardTheme: string; // ID of unlocked item
  avatarId: string; // ID of unlocked avatar item
  clothesId: string; // ID of unlocked clothes item
  profileFrame?: string; // ID of unlocked profile frame
  celebrationSound?: string; // ID of unlocked celebration sound
  language?: string; // Active system language code
  cardSkin?: string; // ID of unlocked card skin
  actionVfx?: string; // ID of unlocked action VFX
  playerBoard?: string; // ID of unlocked player board theme/style!
}

export interface Friend {
  id: string;
  username: string;
  status: 'online' | 'offline' | 'in_game';
  avatarId: string;
}

export interface FriendRequest {
  id: string;
  fromId: string;
  fromUsername: string;
  toId: string;
  toUsername: string;
  status: 'pending' | 'accepted' | 'declined';
  timestamp: number;
}

export interface TournamentMatch {
  id: string;
  player1: string;
  player2: string;
  winner?: string;
  score1?: number;
  score2?: number;
  status: 'pending' | 'playing' | 'completed';
}

export interface Tournament {
  id: string;
  name: string;
  participants: string[];
  rounds: {
    roundNumber: number;
    matches: TournamentMatch[];
  }[];
  status: 'registration' | 'active' | 'completed';
  winner?: string;
}

export interface GameHistoryItem {
  id: string;
  date: string; // Tarih bilgisi
  opponent: string; // Rakip oyuncular
  result: 'won' | 'lost'; // Sonuç
  coinsEarned: number; // Kazanılan jeton
  xpEarned: number; // Kazanılan XP
}

export interface UserProfile {
  id: string;
  username: string;
  coins: number;
  level: number;
  xp: number;
  avatarId: string;
  avatarUrl?: string;
  stats: PlayerStats;
  settings: UserSettings;
  unlockedItems: string[]; // IDs of store items
  friends: Friend[];
  achievements: Achievement[];
  dailyQuests: DailyQuest[];
  gamesHistory?: GameHistoryItem[];
  password?: string; // Optional user account password
}

// Multiplayer Game Types
export interface GamePlayer {
  id: string;
  username: string;
  avatarId: string;
  avatarUrl?: string;
  profileFrame?: string;
  playerBoard?: string; // ID of unlocked player board theme/style!
  cardBack?: string; // ID of equipped card back
  cardSkin?: string; // ID of equipped card skin
  actionVfx?: string; // ID of equipped action VFX
  isBot: boolean;
  isDisconnected?: boolean;
  isSpeaking?: boolean;
  isMuted?: boolean;
  hand: Card[];
  bank: Card[];
  // Grouped properties: color -> list of cards (and action attachments like house/hotel)
  properties: {
    [key in CardColor]?: {
      cards: Card[];
      hasHouse: boolean;
      hasHotel: boolean;
    };
  };
}

export interface GameLog {
  id: string;
  message: string;
  timestamp: number;
  playerName?: string;
  turnNumber?: number;
}

export interface MatchState {
  roomId: string;
  status: 'lobby' | 'playing' | 'finished';
  players: GamePlayer[];
  deckCount: number;
  discardPile: Card[];
  turnIndex: number;
  turnNumber?: number; // Round/Turn number (starts at 1, increments when round completes)
  actionsPlayedThisTurn: number; // Max 3
  winnerId?: string;
  logs: GameLog[];
  isOffline: boolean;
  activeActionRequest?: ActionRequest; // For interactions like "Just Say No", payments, forced-deal target, etc.
  activeActionRequests?: ActionRequest[]; // For simultaneous payments/interactions (e.g., birthday or rent to everyone)
  turnStartedAt?: number;
  actionRequestStartedAt?: number;
  actionTimeLeft?: number | null;
  turnTimeLeft?: number | null;
  settings?: {
    targetSets: number;
    turnLimit: '15s' | '30s' | '1m' | 'unlimited';
    autoEndTurn: boolean;
    gameMode: 'classic' | 'chaos' | 'speed';
  };
  password?: string; // Optional password to enter the room
}

export interface ActionRequest {
  id: string;
  type: 'just-say-no' | 'make-payment' | 'choose-property';
  sourcePlayerId: string;
  targetPlayerId: string;
  actionCard: Card;
  amountDue?: number; // for rent, birthday, debt-collector
  isDoubleRent?: boolean;
  selectedPropertyId?: string; // for forced/sly deal
  targetCardId?: string;
  myCardId?: string;
  targetColor?: CardColor;
  chosenColor?: CardColor;
  originalAction?: {
    type: 'sly-deal' | 'forced-deal' | 'deal-breaker' | 'rent' | 'debt-collector' | 'birthday';
    payload: any;
  };
  jsnCount?: number; // how many JSNs have been played in this chain
}
