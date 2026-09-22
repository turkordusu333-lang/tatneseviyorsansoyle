import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { generateDeck, shuffleDeck, checkWinner, MAX_IN_SET, COLOR_LABELS, RENT_VALUES, getBaseColor, getSetDisplayName, getAllSetKeysForColor, findAvailableSetKey, sanitizePropertySets } from './src/lib/deck';
import { BotEngine } from './src/lib/BotEngine';
import { UserProfile, MatchState, GamePlayer, Card, CardColor, GameLog, Friend, FriendRequest, Tournament, TournamentMatch, ActionRequest } from './src/types';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

/**
 * Secure password hashing using PBKDF2/scrypt with per-user salt
 */
function hashPassword(password: string): string {
  if (!password || typeof password !== 'string') return '';
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password.trim(), salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

/**
 * Verifies password against scrypt hash or legacy plaintext with auto-upgrade support
 */
function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !password) return false;
  const cleanPassword = password.trim();
  
  if (!storedHash.startsWith('scrypt:')) {
    // Legacy plaintext support (exact match)
    return cleanPassword === storedHash.trim();
  }

  const parts = storedHash.split(':');
  if (parts.length !== 3) return false;
  const [_, salt, originalHash] = parts;
  try {
    const computedHash = crypto.scryptSync(cleanPassword, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(computedHash, 'hex'), Buffer.from(originalHash, 'hex'));
  } catch (e) {
    return false;
  }
}

/**
 * Sanitizes user profile to never expose password hashes to client
 */
function sanitizeProfile(user: UserProfile): UserProfile {
  if (!user) return user;
  const sanitized = { ...user };
  if (sanitized.password) {
    delete sanitized.password;
  }
  return sanitized;
}

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

let supabase: any = null;
if (supabaseUrl && supabaseAnonKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
    console.log('[Database] Supabase client initialized.');
  } catch (e) {
    console.error('[Database] Failed to initialize Supabase client:', e);
  }
} else {
  console.log('[Database] Supabase credentials not found, using local fallback.');
}

function countTeamCompletedSets(players: GamePlayer[], team: 'team_blue' | 'team_red'): number {
  if (!players || players.length === 0) return 0;
  const teamPlayers = players.filter((p, idx) => (p.team || (idx % 2 === 0 ? 'team_blue' : 'team_red')) === team);
  if (teamPlayers.length === 0) return 0;

  let totalCompletedSets = 0;
  teamPlayers.forEach((tp) => {
    if (tp.properties) {
      for (const setKey in tp.properties) {
        const baseCol = setKey.split('_')[0] as CardColor;
        const set = tp.properties[setKey];
        if (set && set.cards && set.cards.length >= (MAX_IN_SET[baseCol] || 3)) {
          totalCompletedSets++;
        }
      }
    }
  });

  return totalCompletedSets;
}

function checkWinnerForMatch(match: MatchState, player?: GamePlayer): boolean {
  const targetSets = match.settings?.targetSets || (match.settings?.gameMode === '2v2_team' ? 4 : 3);

  if (match.settings?.gameMode === '2v2_team') {
    const blueSets = countTeamCompletedSets(match.players, 'team_blue');
    const redSets = countTeamCompletedSets(match.players, 'team_red');

    if (blueSets >= targetSets) {
      match.winnerTeam = 'team_blue';
      return true;
    }
    if (redSets >= targetSets) {
      match.winnerTeam = 'team_red';
      return true;
    }
    return false;
  }

  if (player) {
    return checkWinner(player.properties, targetSets);
  }

  for (const p of match.players) {
    if (checkWinner(p.properties, targetSets)) {
      return true;
    }
  }
  return false;
}

// Create data directory if not exists
const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Initial/default shop products
const DEFAULT_SHOP_ITEMS = [
  { id: 'avatar_classic', name: 'Klasik Deal Master PRO Kralı', category: 'avatar', price: 0, description: 'Klasik şapkalı zengin lord avatarı.', isUnlocked: true },
  { id: 'avatar_skater', name: 'Kaykaycı Çocuk', category: 'avatar', price: 100, description: 'Cool şapkalı kaykaycı tasarımı.', isUnlocked: false },
  { id: 'avatar_neon', name: 'Cyberpunk Neon', category: 'avatar', price: 250, description: 'Neon parıltılı fütüristik tasarım.', isUnlocked: false },
  { id: 'avatar_golden', name: 'Altın Kral', category: 'avatar', price: 500, description: 'Zenginlik ve ihtişam simgesi.', isUnlocked: false },

  // NEW AVATARS (12)
  { id: 'avatar_alien', name: 'Siber Uzaylı', category: 'avatar', price: 120, description: 'Samanyolu dışından gelen siber zeka.', isUnlocked: false },
  { id: 'avatar_ninja', name: 'Gölge Ninja', category: 'avatar', price: 180, description: 'Gizlilik ve sessizlik ustası gölge.', isUnlocked: false },
  { id: 'avatar_wizard', name: 'Başbüyücü', category: 'avatar', price: 200, description: 'Kartların kaderini değiştiren büyücü.', isUnlocked: false },
  { id: 'avatar_dragon', name: 'Kadim Ejderha', category: 'avatar', price: 350, description: 'Ateş saçan görkemli efsane.', isUnlocked: false },
  { id: 'avatar_astronaut', name: 'Uzay Gezgini', category: 'avatar', price: 160, description: 'Derin uzay boşluğunda bir astronot.', isUnlocked: false },
  { id: 'avatar_robot', name: 'Siber Mekanik', category: 'avatar', price: 140, description: 'Yapay zeka temelli mekanik zeka.', isUnlocked: false },
  { id: 'avatar_dj', name: 'Ritmin Ustası DJ', category: 'avatar', price: 110, description: 'Arenaya kendi temposunu getiren DJ.', isUnlocked: false },
  { id: 'avatar_ghost', name: 'Kabus Hayalet', category: 'avatar', price: 130, description: 'Rakiplerinin kabusu olan ruh.', isUnlocked: false },
  { id: 'avatar_knight', name: 'Onurlu Şövalye', category: 'avatar', price: 220, description: 'Kraliyetin sadık koruyucusu.', isUnlocked: false },
  { id: 'avatar_unicorn', name: 'Efsanevi Unicorn', category: 'avatar', price: 300, description: 'Gökkuşağının parlayan efsanesi.', isUnlocked: false },
  { id: 'avatar_pharaoh', name: 'Mısır Firavunu', category: 'avatar', price: 280, description: 'Mısırın kadim altın hükümdarı.', isUnlocked: false },
  { id: 'avatar_zombie', name: 'Zombi Saldırganı', category: 'avatar', price: 90, description: 'Karanlık geceden fırlayan zombi.', isUnlocked: false },

  { id: 'back_classic', name: 'Klasik Kırmızı', category: 'card_back', price: 0, description: 'Geleneksel kırmızı desenli kart arkalığı.', isUnlocked: true },
  { id: 'back_cosmic', name: 'Kozmik Siyah', category: 'card_back', price: 150, description: 'Samanyolu yıldızlı derin uzay tasarımı.', isUnlocked: false },
  { id: 'back_gold', name: 'V.I.P Altın', category: 'card_back', price: 300, description: 'Altın işlemeli ultra lüks kart arkalığı.', isUnlocked: false },
  { id: 'back_neon', name: 'Retro Dalga', category: 'card_back', price: 200, description: '80\'ler neon ve mor ızgara çizgileri.', isUnlocked: false },

  // NEW CARD BACKS (10)
  { id: 'back_fire', name: 'Volkanik Magma', category: 'card_back', price: 160, description: 'Kızıl lav efektli sıcak kart arkalığı.', isUnlocked: false },
  { id: 'back_ice', name: 'Kutup Rüzgarı', category: 'card_back', price: 180, description: 'Kutup soğukluğu taşıyan kristal kartlar.', isUnlocked: false },
  { id: 'back_void', name: 'Karanlık Rift', category: 'card_back', price: 220, description: 'Uzay boşluğu çeken kara delik deseni.', isUnlocked: false },
  { id: 'back_matrix', name: 'Siber Kod Yağmuru', category: 'card_back', price: 250, description: 'Yeşil siber veri çizgileriyle akan kodlar.', isUnlocked: false },
  { id: 'back_rainbow', name: 'Gökkuşağı Prizması', category: 'card_back', price: 210, description: 'Tüm renk tayfını yansıtan prizma.', isUnlocked: false },
  { id: 'back_bubble', name: 'Deniz Köpüğü', category: 'card_back', price: 140, description: 'Su altı baloncuklu canlı tasarım.', isUnlocked: false },
  { id: 'back_steampunk', name: 'Buharlı Çark', category: 'card_back', price: 190, description: 'Bronz çarklar ve buhar makineleri.', isUnlocked: false },
  { id: 'back_laser', name: 'Retro Grid Lazer', category: 'card_back', price: 240, description: 'Lazer ışınlarıyla çizilmiş 80ler gridi.', isUnlocked: false },
  { id: 'back_galaxy', name: 'Nebula Bulutu', category: 'card_back', price: 280, description: 'Yıldız tozu ve mor nebula süzülmesi.', isUnlocked: false },
  { id: 'back_darkness', name: 'Gölgeler Diyarı', category: 'card_back', price: 170, description: 'Gizemli gözler ve koyu karanlık.', isUnlocked: false },

  { id: 'theme_slate', name: 'Kozmik Slate', category: 'board_theme', price: 0, description: 'Göz yormayan koyu gri minimalist masa.', isUnlocked: true },
  { id: 'theme_green', name: 'Nane Yeşili', category: 'board_theme', price: 100, description: 'Geleneksel yeşil masası.', isUnlocked: false },
  { id: 'theme_purple', name: 'Kraliyet Moru', category: 'board_theme', price: 250, description: 'Altın detaylı zengin mor masa teması.', isUnlocked: false },
  { id: 'theme_cyberpunk', name: 'Siber Izgara', category: 'board_theme', price: 400, description: 'Yüksek kontrastlı siberpunk masa gridi.', isUnlocked: false },

  // NEW BOARD THEMES (10)
  { id: 'theme_lava', name: 'Magma Krateri', category: 'board_theme', price: 220, description: 'Aktif yanardağ lavları üzerinde sıcak masa.', isUnlocked: false },
  { id: 'theme_abyss', name: 'Karanlık Çukur', category: 'board_theme', price: 240, description: 'Denizin en karanlık dip noktasındaki su altı arenası.', isUnlocked: false },
  { id: 'theme_gold', name: 'Hazine Odası', category: 'board_theme', price: 400, description: 'Saf altın külçelerle süslenmiş zengin kraliyet masası.', isUnlocked: false },
  { id: 'theme_sakura', name: 'Sakura Vadisi', category: 'board_theme', price: 260, description: 'Kiraz çiçeklerinin süzüldüğü huzurlu masa.', isUnlocked: false },
  { id: 'theme_ice', name: 'Kar Fırtınası', category: 'board_theme', price: 250, description: 'Kar fırtınası altında kalmış kristal buz masası.', isUnlocked: false },
  { id: 'theme_retro', name: 'Atari Salonu', category: 'board_theme', price: 300, description: '80ler atari salonu neon çizgi desenli masa.', isUnlocked: false },
  { id: 'theme_toxic', name: 'Zehirli Vaha', category: 'board_theme', price: 180, description: 'Yeşil asit havuzlu tekinsiz endüstriyel masa.', isUnlocked: false },
  { id: 'theme_matrix', name: 'Sanal Matris', category: 'board_theme', price: 350, description: 'Yeşil akan kod yağmuru altında sanal masa.', isUnlocked: false },
  { id: 'theme_space', name: 'Uzay İstasyonu', category: 'board_theme', price: 450, description: 'Dünya manzaralı uzay üssü gözlem masası.', isUnlocked: false },
  { id: 'theme_desert', name: 'Kayıp Tapınak', category: 'board_theme', price: 150, description: 'Mısır kumları altındaki kadim çöl masası.', isUnlocked: false },

  { id: 'frame_none', name: 'Klasik Sınır', category: 'profile_frame', price: 0, description: 'Sıradan, ince beyaz çerçeve.', isUnlocked: true },
  { id: 'frame_neon', name: 'Neon Aura', category: 'profile_frame', price: 150, description: 'Siberpunk parlayan pembe neon çerçeve.', isUnlocked: false },
  { id: 'frame_gold', name: 'V.I.P Altın Çerçeve', category: 'profile_frame', price: 300, description: 'Elit oyuncular için saf altın varaklı çerçeve.', isUnlocked: false },
  { id: 'frame_fire', name: 'Volkanik Ateş', category: 'profile_frame', price: 200, description: 'Kızıl lav efektli ateşli profil çerçevesi.', isUnlocked: false },
  { id: 'frame_royal', name: 'Kraliyet Elması', category: 'profile_frame', price: 450, description: 'Lüks mavi elmas süslemeli şampiyon çerçevesi.', isUnlocked: false },

  // NEW PROFILE FRAMES (10)
  { id: 'frame_plasma', name: 'Plazma Kalkanı', category: 'profile_frame', price: 225, description: 'Mavi elektrik arklarıyla parlayan plazma çerçeve.', isUnlocked: false },
  { id: 'frame_rainbow', name: 'Gökkuşağı Spektrumu', category: 'profile_frame', price: 265, description: 'Sürekli renk değiştiren RGB spektrum çerçeve.', isUnlocked: false },
  { id: 'frame_toxic', name: 'Radyoaktif Slime', category: 'profile_frame', price: 175, description: 'Yemyeşil zehir akıntılı hareketli slime çerçeve.', isUnlocked: false },
  { id: 'frame_ice', name: 'Buz Kristali', category: 'profile_frame', price: 195, description: 'Kutup soğukluğu saçan parıltılı mavi buz çerçevesi.', isUnlocked: false },
  { id: 'frame_steampunk', name: 'Buharlı Dişliler', category: 'profile_frame', price: 215, description: 'Dönen bronz dişli çarklar ve bakır çerçeve.', isUnlocked: false },
  { id: 'frame_matrix', name: 'Matris Kod Hattı', category: 'profile_frame', price: 285, description: 'Aşağı akan yeşil binary siber kod çerçevesi.', isUnlocked: false },
  { id: 'frame_thunder', name: 'Şimşek Hattı', category: 'profile_frame', price: 325, description: 'Etrafından sarı şimşekler fırlayan dinamik çerçeve.', isUnlocked: false },
  { id: 'frame_darkness', name: 'Karanlık Duman', category: 'profile_frame', price: 245, description: 'Koyu mor gölge dumanları tüten gizemli çerçeve.', isUnlocked: false },
  { id: 'frame_galaxy', name: 'Galaksi Sarmalı', category: 'profile_frame', price: 350, description: 'Dönen galaksi sarmalı ve yıldız tozu aurası.', isUnlocked: false },
  { id: 'frame_dragon', name: 'Ejderha Pulları', category: 'profile_frame', price: 400, description: 'Kızıl ejderha pulları ve parıldayan pullu çerçeve.', isUnlocked: false },

  { id: 'sound_classic', name: 'Klasik Melodi', category: 'celebration_sound', price: 0, description: 'Klasik retro tınılı zafer melodisi.', isUnlocked: true },
  { id: 'sound_applause', name: 'Coşkulu Alkış', category: 'celebration_sound', price: 100, description: 'Kritik hamlelerinizde ve zaferlerinizde çalan coşkulu alkış efekti.', isUnlocked: false },
  { id: 'sound_fireworks', name: 'Havai Fişek', category: 'celebration_sound', price: 180, description: 'Gökyüzünde patlayan renkli ve heyecanlı şenlik efekti.', isUnlocked: false },
  { id: 'sound_laser', name: 'Siber Lazer', category: 'celebration_sound', price: 150, description: 'Cyberpunk arenalara özel fütüristik retro lazer şovu.', isUnlocked: false },
  { id: 'sound_fanfare', name: 'Şampiyon Fanfarı', category: 'celebration_sound', price: 250, description: 'Zafere ulaştığınızda çalacak asil ve muhteşem şampiyon melodisi.', isUnlocked: false },

  // NEW CELEBRATION SOUNDS (8)
  { id: 'sound_victory', name: 'Zafer Marşı', category: 'celebration_sound', price: 200, description: 'Trompet sesleriyle dolu epik zafer marşı.', isUnlocked: false },
  { id: 'sound_arcade', name: '8-Bit Atari', category: 'celebration_sound', price: 120, description: 'Eski atari oyunları tarzı retro ses efektleri.', isUnlocked: false },
  { id: 'sound_coins', name: 'Para Yağmuru', category: 'celebration_sound', price: 150, description: 'Kasanıza para girerken çalan jackpot şıkırtısı.', isUnlocked: false },
  { id: 'sound_laser_zap', name: 'Lazer Silahı', category: 'celebration_sound', price: 130, description: 'Fütüristik siber lazer atış sesleri.', isUnlocked: false },
  { id: 'sound_rock', name: 'Elektro Gitar Riffi', category: 'celebration_sound', price: 220, description: 'Zafere ulaştığınızda çalan havalı gitar solosu.', isUnlocked: false },
  { id: 'sound_synthwave', name: 'Synthwave Bas', category: 'celebration_sound', price: 170, description: '80ler tarzı elektronik bas ritimleri.', isUnlocked: false },
  { id: 'sound_thunder', name: 'Kuvvetli Yıldırım', category: 'celebration_sound', price: 250, description: 'Hamlelerinizi taçlandıracak güçlü gök gürültüsü.', isUnlocked: false },
  { id: 'sound_magical', name: 'Sihirli Değnek', category: 'celebration_sound', price: 180, description: 'Kartlarınızı açtığınızda çalan parıltılı büyü melodisi.', isUnlocked: false },

  // DYNAMIC BOARD THEMES (Live Mats)
  { id: 'theme_atlantis', name: '🌊 Sualtı Krallığı (Atlantis)', category: 'board_theme', price: 800, description: 'Derin okyanus mavisi, yüzen kabarcıklar, ışık kırılması ve deniz tozu partikülleri ile yaşayan bir sualtı masa deneyimi.', isUnlocked: false },
  { id: 'theme_volcano', name: '🌋 Volkanik Öfke (Lav Masası)', category: 'board_theme', price: 900, description: 'Nabız gibi atan lav çatlakları, kor parçacıkları ve ısı bozulması efektiyle volkanik bir arena.', isUnlocked: false },

  // CARD SKINS (Live Skins)
  { id: 'skin_holographic', name: '💠 Holografik Mavi Sektör', category: 'card_skin', price: 1200, description: 'Kartların üzerinde akan mavi veri ızgarası, hover titremesi ve set tamamlandığında radyal parıltı efekti.', isUnlocked: false },
  { id: 'skin_rune', name: '🔮 Mistik Rün Parşömeni', category: 'card_skin', price: 1000, description: 'Kart kenarlarında parlayan kadim rünler, parşömen dokusu ve kira ödendiğinde mavi-kırmızı renk geçişi.', isUnlocked: false },
  { id: 'skin_snowstorm', name: '❄️ Donmuş Buz Kaplama', category: 'card_skin', price: 1100, description: 'Kartların üzerinde parıldayan buz kristalleri ve set tamamlandığında buhar çıkma efekti.', isUnlocked: false },

  // ACTION VFX (Epic VFX)
  { id: 'vfx_meteor', name: '☄️ Meteor Saldırısı', category: 'action_vfx', price: 1500, description: 'Deal Breaker oynandığında ekrana meteor düşer, darbe anında ekran sallanır ve altın parçacık patlaması tetiklenir.', isUnlocked: false },
  { id: 'vfx_mirror_shield', name: '🛡️ Ayna Kalkan', category: 'action_vfx', price: 1300, description: 'Hayır Teşekkürler kartı oynandığında altıgen enerji kalkanı belirir, şok dalgası ve gökkuşağı kırılması efekti.', isUnlocked: false },
  { id: 'vfx_snowstorm', name: '❄️ Çığ Felaketi', category: 'action_vfx', price: 1400, description: 'Aksiyon kartı oynandığında oyun alanını kaplayan kar fırtınası ve ekran donması efekti.', isUnlocked: false },

  // SNOWSTORM OTHERS (Avatars, Themes, Frames, Sounds)
  { id: 'avatar_snowstorm', name: '❄️ Kar Fırtınası Savaşçısı', category: 'avatar', price: 300, description: 'Kutup ayazında dövüşen buz zırhlı efsanevi savaşçı.', isUnlocked: false },
  { id: 'back_snowstorm', name: '❄️ Kar Fırtınası', category: 'card_back', price: 200, description: 'Buz kristalleriyle kaplı, soğuk kutup rüzgarı desenli kart arkası.', isUnlocked: false },
  { id: 'theme_snowstorm', name: '❄️ Dinamik Kar Fırtınası', category: 'board_theme', price: 650, description: 'Sürekli yağan kar taneleri ve buz tutmuş zemin efektiyle yaşayan kış masası.', isUnlocked: false },
  { id: 'frame_snowstorm', name: '❄️ Kar Fırtınası Çerçevesi', category: 'profile_frame', price: 250, description: 'Buz parçacıkları saçan, hareketli kar fırtınası aurası.', isUnlocked: false },
  { id: 'sound_snowstorm', name: '❄️ Çığ ve Fırtına Sesi', category: 'celebration_sound', price: 200, description: 'Zafer anınızda çalan ürpertici çığ ve dondurucu fırtına uğultusu.', isUnlocked: false },

  // Player Board Designs (New requested category)
  { id: 'board_classic', name: '🎴 Klasik Siyah Tahta', category: 'player_board', price: 0, description: 'Sade ve asil klasik mat siyah oyuncu tahtası.', isUnlocked: true },
  { id: 'board_gold', name: '👑 V.I.P Altın Tahta', category: 'player_board', price: 350, description: 'Rakiplerinizi büyüleyecek lüks altın parıltılı çerçeveli oyuncu alanı tasarımı.', isUnlocked: false },
  { id: 'board_cyber', name: '⚡ Siber Neon Tahta', category: 'player_board', price: 400, description: 'Sürekli akan pembe-mavi siber ızgaralı ve ışık hüzmeli oyuncu alanı tasarımı.', isUnlocked: false },
  { id: 'board_magma', name: '🔥 Magma Lav Tahtası', category: 'player_board', price: 450, description: 'Kızgın lav çatlakları ve patlayan kıvılcım efektli oyuncu alanı tasarımı.', isUnlocked: false },
  { id: 'board_galaxy', name: '🌌 Nebula Galaksi Tahtası', category: 'player_board', price: 500, description: 'Sonsuz derinlik hissi veren dönen nebula bulutları ile süslü oyuncu alanı tasarımı.', isUnlocked: false },
  { id: 'board_ice', name: '❄️ Kutup Ayazı Buz Tahtası', category: 'player_board', price: 300, description: 'Dondurucu buz kristalleriyle çevrelenmiş şık kutup temalı oyuncu alanı tasarımı.', isUnlocked: false },
  { id: 'board_void', name: '🌀 Karanlık Rift Tahtası', category: 'player_board', price: 420, description: 'Hiçliğin derinliklerinden gelen gizemli mor aura ve parçacık süzülmeli tasarım.', isUnlocked: false },

  // Game Music / BGM Tracks (New category)
  { id: 'music_classic', name: '🎵 Klasik Atmosfer', category: 'game_music', price: 0, description: 'Göz yormayan, rahatlatıcı ve derinlikli klasik masa fon müziği.', isUnlocked: true },
  { id: 'music_retro', name: '🕹️ 8-Bit Arcade Ritim', category: 'game_music', price: 150, description: 'Eski atari salonlarından fırlayan enerjik ve nostaljik 8-bit vuruşlar.', isUnlocked: false },
  { id: 'music_cyber', name: '⚡ Siberpunk Synthwave', category: 'game_music', price: 250, description: 'Derin baslar, gece neonları ve tempo dolu fütüristik siberpunk ritimler.', isUnlocked: false },
  { id: 'music_chill', name: '☕ Lo-Fi Chill & Kahve', category: 'game_music', price: 200, description: 'Odaklanmanızı artıran, sıcak ve dinlendirici lo-fi piyano akorları.', isUnlocked: false },
  { id: 'music_epic', name: '🛡️ Efsanevi Şampiyon Marşı', category: 'game_music', price: 350, description: 'Kritik hamlelerin heyecanını zirveye çıkaran epik şampiyon teması.', isUnlocked: false }
];

// Helper to handle Supabase errors quietly without triggering platform warnings
function handleSupabaseError(error: any, context: string) {
  if (!error) return;
  const msg = error.message || '';
  const lower = msg.toLowerCase();
  if (lower.includes('api key') || lower.includes('invalid') || lower.includes('unauthorized') || lower.includes('key') || lower.includes('auth') || lower.includes('jwt')) {
    console.log(`[Database] Supabase client offline due to authorization credentials for ${context}. Fallback mode active.`);
    supabase = null;
  } else {
    console.log(`[Database] Supabase local fallback mode active for: ${context}`);
  }
}

// In-memory cache for fast user lookup
let cachedUsers: Record<string, UserProfile> | null = null;
let lastUsersLoadTime = 0;
const USERS_CACHE_TTL = 8000; // 8 seconds cache for instant auth response

// Helper to load/save users
async function loadUsers(): Promise<Record<string, UserProfile>> {
  if (cachedUsers && (Date.now() - lastUsersLoadTime < USERS_CACHE_TTL)) {
    return cachedUsers;
  }

  let users: Record<string, UserProfile> = {};
  let loadedFromSupabase = false;

  if (supabase) {
    try {
      const { data, error } = await supabase.from('users').select('*');
      if (error) {
        handleSupabaseError(error, 'loadUsers');
      } else if (data) {
        data.forEach((row: any) => {
          users[row.id] = row.profile_data;
        });
        loadedFromSupabase = true;
        console.log(`[Database] Successfully loaded ${data.length} users from Supabase.`);
      }
    } catch (e: any) {
      console.log('[Database] Exception handled loading users. Fallback active.');
    }
  }

  // Fallback to local file if Supabase fails or is disabled
  if (!loadedFromSupabase) {
    if (fs.existsSync(USERS_FILE)) {
      try {
        const raw = fs.readFileSync(USERS_FILE, 'utf8').trim();
        if (raw) {
          users = JSON.parse(raw);
          console.log(`[Database] Loaded users from local users.json fallback.`);
        }
      } catch (e) {
        console.error('[Database] Error reading local users file:', e);
        users = {};
      }
    }
  }

  // Run the default achievements / quests checking logic as before
  let changed = false;
  for (const id in users) {
    const u = users[id];
    if (!u.achievements) {
      u.achievements = [];
      changed = true;
    }

    if (!u.stats) {
      u.stats = {
        gamesPlayed: 0,
        gamesWon: 0,
        gamesLost: 0,
        winRate: 0,
        totalRentCollected: 0,
        totalCardsStolen: 0,
        totalSetsCompleted: 0,
        totalMoneyBanked: 0,
      };
      changed = true;
    }

    // Dynamic Achievements Matching and Syncing
    globalAchievements.forEach(gAch => {
      const existing = u.achievements.find((a: any) => a.id === gAch.id);
      if (!existing) {
        // Initialize achievement progress for user
        let initialVal = 0;
        if (gAch.type === 'games_played') initialVal = u.stats?.gamesPlayed || 0;
        else if (gAch.type === 'games_won') initialVal = u.stats?.gamesWon || 0;
        else if (gAch.type === 'games_lost') initialVal = u.stats?.gamesLost || 0;
        else if (gAch.type === 'money_banked') initialVal = u.stats?.totalMoneyBanked || 0;
        else if (gAch.type === 'cards_stolen') initialVal = u.stats?.totalCardsStolen || 0;
        else if (gAch.type === 'sets_completed') initialVal = u.stats?.totalSetsCompleted || 0;
        else if (gAch.type === 'rent_collected') initialVal = u.stats?.totalRentCollected || 0;

        u.achievements.push({
          id: gAch.id,
          title: gAch.title,
          description: gAch.description,
          targetValue: gAch.targetValue,
          currentValue: initialVal,
          completed: initialVal >= gAch.targetValue,
          rewardCoins: gAch.rewardCoins,
          type: gAch.type
        });
        changed = true;
      } else {
        // Update static values if changed by admin
        existing.title = gAch.title;
        existing.description = gAch.description;
        existing.targetValue = gAch.targetValue;
        existing.rewardCoins = gAch.rewardCoins;
        existing.type = gAch.type;
      }
    });

    // Dynamic Daily Quests Matching and Syncing
    if (!u.dailyQuests || u.dailyQuests.length === 0) {
      u.dailyQuests = globalQuests.map((q) => ({
        id: q.id,
        description: q.description,
        targetValue: q.targetValue,
        currentValue: 0,
        completed: false,
        claimed: false,
        rewardCoins: q.rewardCoins,
        rewardXp: q.rewardXp,
        type: q.type || 'games_played'
      }));
      changed = true;
    } else {
      // Keep descriptions, rewards, targets, and types synced with the admin's changes
      u.dailyQuests.forEach((q: any) => {
        const gQ = globalQuests.find((x) => x.id === q.id);
        if (gQ) {
          q.description = gQ.description;
          q.targetValue = gQ.targetValue;
          q.rewardCoins = gQ.rewardCoins;
          q.rewardXp = gQ.rewardXp;
          q.type = gQ.type || q.type || 'games_played';
        }
      });

      // Add newly added quests from the global pool to users if they don't have them
      globalQuests.forEach((gQ) => {
        const existingQ = u.dailyQuests.find((q: any) => q.id === gQ.id);
        if (!existingQ) {
          u.dailyQuests.push({
            id: gQ.id,
            description: gQ.description,
            targetValue: gQ.targetValue,
            currentValue: 0,
            completed: false,
            claimed: false,
            rewardCoins: gQ.rewardCoins,
            rewardXp: gQ.rewardXp,
            type: gQ.type || 'games_played'
          });
          changed = true;
        }
      });
    }
  }

  if (changed) {
    await saveUsers(users);
  }

  cachedUsers = users;
  lastUsersLoadTime = Date.now();
  return users;
}

// Promise-based async queue for file writing to prevent race conditions and concurrent write corruption
let userSaveQueue: Promise<void> = Promise.resolve();

async function saveUsers(users: Record<string, UserProfile>): Promise<void> {
  cachedUsers = users;
  lastUsersLoadTime = Date.now();

  userSaveQueue = userSaveQueue.then(async () => {
    // 1. Atomic async write to local backup file using a temporary file first
    const payload = JSON.stringify(users, null, 2);
    const tempFile = `${USERS_FILE}.tmp.${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    try {
      await fs.promises.writeFile(tempFile, payload, 'utf8');
      await fs.promises.rename(tempFile, USERS_FILE);
    } catch (e) {
      console.error('[Database] Local fallback save error:', e);
      // Direct fallback if rename fails
      try {
        await fs.promises.writeFile(USERS_FILE, payload, 'utf8');
      } catch (err) {
        console.error('[Database] Critical error saving users file:', err);
      }
    } finally {
      if (fs.existsSync(tempFile)) {
        try { await fs.promises.unlink(tempFile); } catch (_) {}
      }
    }

    // 2. Save/Upsert to Supabase if connected
    if (supabase) {
      try {
        const rows = Object.values(users).map((u) => ({
          id: u.id,
          username: u.username,
          profile_data: u
        }));
        const { error } = await supabase.from('users').upsert(rows);
        if (error) {
          handleSupabaseError(error, 'saveUsers');
        } else {
          console.log(`[Database] Successfully saved ${rows.length} users to Supabase.`);
        }
      } catch (e: any) {
        console.log('[Database] Exception handled saving users. Fallback active.');
      }
    }
  }).catch((err) => {
    console.error('[Database] Error in userSaveQueue processing:', err);
  });

  return userSaveQueue;
}

const ADMIN_SETTINGS_FILE = path.join(DATA_DIR, 'admin_settings.json');
const GLOBAL_QUESTS_FILE = path.join(DATA_DIR, 'global_quests.json');

let globalAdminSettings = {
  enable3DCardFlip: true,
  enablePropertySetGlow: true,
  enableFloatingEmojis: true,
  enableCoinFlyEffect: true,
  enableBuildingSmoke: true,
  enableHoverCardSidebar: true,
  enableUndoInTraining: true,
  questsEnabled: true,
  codexTabEnabled: true,
  rankedLeagueEnabled: true,
  turnTimeoutSeconds: 35,
  actionTimeoutSeconds: 20,
  targetSets: 3,
  turnActionLimit: 3,
  goldMultiplier: 1.0,
  maintenanceMode: false,
  enableSystemVoiceovers: true,
  bonusTimePerActionSeconds: 10,
  botPracticeRewardsEnabled: false,
  botMultiplayerRewardMultiplier: 0.5,
  matchmakingEnabled: true,
  matchmakingEntryFee: 100,
  matchmakingWinnerShare: 80,
  matchmakingTimeSec: 10,
  rankedTurnDuration: 15,
  rankedCompleteSetWeight: 50,
  rankedIncompletePropWeight: 2,
  rankedBankCashWeight: 1,
  rankedSoloQueueOnly: true,
  rankedAnonymity: true,
  normalHandCardSize: 100,
  compactHandCardSize: 100,
  wheelEnabled: true,
  wheelCooldownMinutes: 60,
  wheelAdDurationSeconds: 8,
  wheelReward1: 50,
  wheelReward2: 100,
  wheelReward3: 200,
  wheelReward4: 500,
  wheelReward5: 1000,
  wheelReward6: 25
};

const GLOBAL_ACHIEVEMENTS_FILE = path.join(DATA_DIR, 'global_achievements.json');
const TOURNAMENTS_FILE = path.join(DATA_DIR, 'tournaments.json');
const GLOBAL_STORE_ITEMS_FILE = path.join(DATA_DIR, 'global_store_items.json');

let globalStoreItems: any[] = [];

let globalQuests: any[] = [
  { id: 'q-1', description: 'Pratik Modunda botu yen.', targetValue: 1, rewardCoins: 50, rewardXp: 40, type: 'games_won' },
  { id: 'q-2', description: 'Bankaya 5M para yerleştir.', targetValue: 5, rewardCoins: 40, rewardXp: 30, type: 'money_banked' },
  { id: 'q-3', description: 'Toplam 3 kira kartı oyna.', targetValue: 3, rewardCoins: 60, rewardXp: 50, type: 'rent_collected' },
];

let globalAchievements: any[] = [
  { id: 'ach-1', title: 'İlk Adım', description: 'Bir maç oyna.', targetValue: 1, rewardCoins: 100, type: 'games_played' },
  { id: 'ach-2', title: 'Milyoner', description: 'Bankaya toplam 20M para ekle.', targetValue: 20, rewardCoins: 150, type: 'money_banked' },
  { id: 'ach-3', title: 'Sinsi Hırsız', description: 'Rakiplerinden 5 kez arsa çal.', targetValue: 5, rewardCoins: 200, type: 'cards_stolen' },
  { id: 'ach-streak', title: 'Galibiyet Serisi', description: 'Arka arkaya 10 maç kazan.', targetValue: 10, rewardCoins: 500, type: 'games_won' },
  { id: 'ach-collector', title: 'Koleksiyoncu', description: 'Mağazadan 5 farklı kozmetik eşya aç.', targetValue: 5, rewardCoins: 300, type: 'collector' },
  { id: 'ach-fast', title: 'Hızlı Oyuncu', description: 'Bir turu 15 saniyeden kısa sürede bitir.', targetValue: 1, rewardCoins: 150, type: 'fast_turn' },
  { id: 'ach-highroller', title: 'Zengin İş Adamı', description: 'Tek seferde 5M değerinde kira topla.', targetValue: 5, rewardCoins: 250, type: 'rent_collected' }
];

async function loadAdminData() {
  // Load Settings
  let loadedSettings = false;
  if (supabase) {
    try {
      const { data, error } = await supabase.from('admin_settings').select('*').eq('id', 'global').maybeSingle();
      if (error) {
        handleSupabaseError(error, 'loadAdminData_settings');
      } else if (data) {
        globalAdminSettings = { ...globalAdminSettings, ...data.settings };
        loadedSettings = true;
        console.log('[Database] Loaded admin settings from Supabase.');
      }
    } catch (e: any) {
      console.log('[Database] Exception handled loading admin settings. Fallback active.');
    }
  }
  if (!loadedSettings) {
    if (fs.existsSync(ADMIN_SETTINGS_FILE)) {
      try {
        const raw = fs.readFileSync(ADMIN_SETTINGS_FILE, 'utf-8').trim();
        if (raw) {
          globalAdminSettings = { ...globalAdminSettings, ...JSON.parse(raw) };
          console.log('[Database] Loaded admin settings from local fallback.');
        }
      } catch (e) {
        console.error('[Database] Failed to read local admin settings:', e);
      }
    }
  }

  // Load Global Quests
  let loadedQuests = false;
  if (supabase) {
    try {
      const { data, error } = await supabase.from('global_quests').select('*');
      if (error) {
        handleSupabaseError(error, 'loadAdminData_quests');
      } else if (data && data.length > 0) {
        globalQuests = data.map((r: any) => ({
          id: r.id,
          description: r.description,
          targetValue: r.target_value,
          rewardCoins: r.reward_coins,
          rewardXp: r.reward_xp,
          type: r.type || 'games_played'
        }));
        loadedQuests = true;
        console.log(`[Database] Loaded ${globalQuests.length} global quests from Supabase.`);
      }
    } catch (e: any) {
      console.log('[Database] Exception handled loading global quests. Fallback active.');
    }
  }
  if (!loadedQuests) {
    if (fs.existsSync(GLOBAL_QUESTS_FILE)) {
      try {
        const raw = fs.readFileSync(GLOBAL_QUESTS_FILE, 'utf-8').trim();
        if (raw) {
          globalQuests = JSON.parse(raw);
          console.log('[Database] Loaded global quests from local fallback.');
        }
      } catch (e) {
        console.error('[Database] Failed to read local global quests:', e);
      }
    }
  }

  // Load Global Achievements
  if (fs.existsSync(GLOBAL_ACHIEVEMENTS_FILE)) {
    try {
      const raw = fs.readFileSync(GLOBAL_ACHIEVEMENTS_FILE, 'utf-8').trim();
      if (raw) {
        globalAchievements = JSON.parse(raw);
        console.log('[Database] Loaded global achievements from local fallback.');
      }
    } catch (e) {
      console.error('[Database] Failed to read local global achievements:', e);
    }
  }

  // Load Tournaments
  if (fs.existsSync(TOURNAMENTS_FILE)) {
    try {
      const raw = fs.readFileSync(TOURNAMENTS_FILE, 'utf-8').trim();
      if (raw) {
        activeTournaments = JSON.parse(raw);
        console.log('[Database] Loaded active tournaments from local fallback.');
      } else {
        activeTournaments = [];
      }
    } catch (e) {
      console.error('[Database] Failed to read local tournaments:', e);
      activeTournaments = [];
    }
  } else {
    activeTournaments = [];
  }

  // Load Global Store Items
  if (fs.existsSync(GLOBAL_STORE_ITEMS_FILE)) {
    try {
      const raw = fs.readFileSync(GLOBAL_STORE_ITEMS_FILE, 'utf-8').trim();
      if (raw) {
        globalStoreItems = JSON.parse(raw);
        console.log(`[Database] Loaded ${globalStoreItems.length} global store items from local fallback.`);
      } else {
        globalStoreItems = [...DEFAULT_SHOP_ITEMS];
        await saveGlobalStoreItems();
      }
    } catch (e) {
      console.error('[Database] Failed to read local store items file:', e);
      globalStoreItems = [...DEFAULT_SHOP_ITEMS];
    }
  } else {
    globalStoreItems = [...DEFAULT_SHOP_ITEMS];
    await saveGlobalStoreItems();
  }
}

async function safeWriteJsonFile(filePath: string, data: any): Promise<void> {
  const payload = JSON.stringify(data, null, 2);
  const tempFile = `${filePath}.tmp.${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  try {
    await fs.promises.writeFile(tempFile, payload, 'utf8');
    await fs.promises.rename(tempFile, filePath);
  } catch (e) {
    try {
      await fs.promises.writeFile(filePath, payload, 'utf8');
    } catch (err) {
      console.error(`[Database] Failed to write file ${filePath}:`, err);
    }
  } finally {
    if (fs.existsSync(tempFile)) {
      try { await fs.promises.unlink(tempFile); } catch (_) {}
    }
  }
}

async function saveGlobalStoreItems() {
  await safeWriteJsonFile(GLOBAL_STORE_ITEMS_FILE, globalStoreItems);
  if (supabase) {
    try {
      const { error } = await supabase.from('admin_settings').upsert({ id: 'store_items', settings: globalStoreItems });
      if (error) {
        handleSupabaseError(error, 'saveGlobalStoreItems');
      }
    } catch (e: any) {
      console.log('[Database] Exception handled saving global store items. Fallback active.');
    }
  }
}

async function saveAdminSettings(settings: any) {
  globalAdminSettings = { ...globalAdminSettings, ...settings };
  await safeWriteJsonFile(ADMIN_SETTINGS_FILE, globalAdminSettings);
  if (supabase) {
    try {
      const { error } = await supabase.from('admin_settings').upsert({ id: 'global', settings: globalAdminSettings });
      if (error) {
        handleSupabaseError(error, 'saveAdminSettings');
      }
    } catch (e: any) {
      console.log('[Database] Exception handled saving admin settings. Fallback active.');
    }
  }
}

async function saveGlobalQuests() {
  await safeWriteJsonFile(GLOBAL_QUESTS_FILE, globalQuests);
  if (supabase) {
    try {
      await supabase.from('global_quests').delete().neq('id', 'dummy');
      const rows = globalQuests.map((q) => ({
        id: q.id,
        description: q.description,
        target_value: q.targetValue,
        reward_coins: q.rewardCoins,
        reward_xp: q.rewardXp
      }));
      if (rows.length > 0) {
        const { error } = await supabase.from('global_quests').insert(rows);
        if (error) {
          handleSupabaseError(error, 'saveGlobalQuests');
        }
      }
    } catch (e: any) {
      console.log('[Database] Exception handled saving global quests. Fallback active.');
    }
  }
}

async function saveGlobalAchievements() {
  await safeWriteJsonFile(GLOBAL_ACHIEVEMENTS_FILE, globalAchievements);
}

async function saveTournaments() {
  await safeWriteJsonFile(TOURNAMENTS_FILE, activeTournaments);
}

// In-Memory active rooms and tournaments state
const activeMatches: Record<string, MatchState> = {};
const roomLocks: Record<string, Promise<any>> = {};
let activeTournaments: Tournament[] = [
  {
    id: 't-bronze',
    name: '🥉 Acemi Arenası',
    description: 'Hızlı 8 kişilik eleme kupası. Yeni taktikleri test etmek için ideal!',
    tier: 'bronze',
    entryFee: 100,
    prizeCoins: 500,
    prizeXp: 150,
    maxParticipants: 8,
    icon: '🥉',
    participants: ['Bot Memo', 'Bot Can', 'Bot Defne', 'Bot Ege', 'Bot Leyla', 'Bot Sarp', 'Bot Ada'],
    rounds: [
      {
        roundNumber: 1,
        matches: [
          { id: 'tm-b1', player1: 'Bot Memo', player2: 'Bot Can', score1: 3, score2: 1, status: 'completed', winner: 'Bot Memo' },
          { id: 'tm-b2', player1: 'Bot Defne', player2: 'Bot Ege', score1: 3, score2: 2, status: 'completed', winner: 'Bot Defne' },
          { id: 'tm-b3', player1: 'Bot Leyla', player2: 'Bot Sarp', score1: 3, score2: 0, status: 'completed', winner: 'Bot Leyla' },
          { id: 'tm-b4', player1: 'Bot Ada', player2: 'Sen', status: 'pending' },
        ],
      },
    ],
    status: 'active',
  },
  {
    id: 't-gold',
    name: '🥇 Şampiyonlar Kupası',
    description: 'Büyük ödüllü 8 kişilik prestij turnuvası. En iyi deal ustaları burada!',
    tier: 'gold',
    entryFee: 500,
    prizeCoins: 2500,
    prizeXp: 400,
    maxParticipants: 8,
    icon: '🥇',
    participants: ['Kral Oyuncu', 'Efsane Bot', 'Pro Bot', 'Zeki Bot', 'Kart Şampiyonu', 'Milyoner Bot', 'Yapay Zeka Master'],
    rounds: [
      {
        roundNumber: 1,
        matches: [
          { id: 'tm-g1', player1: 'Kral Oyuncu', player2: 'Efsane Bot', score1: 3, score2: 2, status: 'completed', winner: 'Kral Oyuncu' },
          { id: 'tm-g2', player1: 'Pro Bot', player2: 'Zeki Bot', score1: 3, score2: 1, status: 'completed', winner: 'Pro Bot' },
          { id: 'tm-g3', player1: 'Kart Şampiyonu', player2: 'Milyoner Bot', score1: 3, score2: 0, status: 'completed', winner: 'Kart Şampiyonu' },
          { id: 'tm-g4', player1: 'Yapay Zeka Master', player2: 'Sen', status: 'pending' },
        ],
      },
    ],
    status: 'active',
  },
  {
    id: 't-legend',
    name: '👑 Efsaneler Turnuvası (16 Kişilik)',
    description: 'Devasa 16 kişilik büyük nakavt ligi! Son 16, Çeyrek, Yarı ve Büyük Final!',
    tier: 'legend',
    entryFee: 2500,
    prizeCoins: 15000,
    prizeXp: 1500,
    maxParticipants: 16,
    icon: '👑',
    participants: ['Grandmaster Bot', 'Mega Lord', 'Titan Bot', 'Apex Player', 'Mythic Bot', 'Cyber King', 'Shadow Deal', 'Alpha Bot', 'Omega Player', 'Prime Bot', 'Vortex Bot', 'Quantum Deal', 'Ultra Bot', 'Imperial King', 'Dominator'],
    rounds: [
      {
        roundNumber: 1,
        matches: [
          { id: 'tm-l1', player1: 'Grandmaster Bot', player2: 'Mega Lord', score1: 3, score2: 1, status: 'completed', winner: 'Grandmaster Bot' },
          { id: 'tm-l2', player1: 'Titan Bot', player2: 'Apex Player', score1: 3, score2: 0, status: 'completed', winner: 'Titan Bot' },
          { id: 'tm-l3', player1: 'Mythic Bot', player2: 'Cyber King', score1: 3, score2: 2, status: 'completed', winner: 'Mythic Bot' },
          { id: 'tm-l4', player1: 'Shadow Deal', player2: 'Alpha Bot', score1: 3, score2: 1, status: 'completed', winner: 'Shadow Deal' },
          { id: 'tm-l5', player1: 'Omega Player', player2: 'Prime Bot', score1: 3, score2: 2, status: 'completed', winner: 'Omega Player' },
          { id: 'tm-l6', player1: 'Vortex Bot', player2: 'Quantum Deal', score1: 3, score2: 1, status: 'completed', winner: 'Vortex Bot' },
          { id: 'tm-l7', player1: 'Ultra Bot', player2: 'Imperial King', score1: 3, score2: 0, status: 'completed', winner: 'Ultra Bot' },
          { id: 'tm-l8', player1: 'Dominator', player2: 'Sen', status: 'pending' },
        ],
      },
    ],
    status: 'active',
  },
];

async function submitTournamentMatchInternal(
  tournamentId: string,
  matchId: string,
  winnerName: string,
  score1: number = 3,
  score2: number = 0
): Promise<boolean> {
  try {
    const tournament = activeTournaments.find((t) => t.id === tournamentId);
    if (!tournament) return false;

    let foundMatch: TournamentMatch | undefined;
    for (const round of tournament.rounds) {
      foundMatch = round.matches.find((m) => m.id === matchId || m.id.includes(matchId));
      if (foundMatch) break;
    }

    if (!foundMatch && tournament.rounds.length > 0) {
      const currentRound = tournament.rounds[tournament.rounds.length - 1];
      foundMatch = currentRound?.matches?.find((m) => m.id === matchId || m.id.includes(matchId));
    }

    if (foundMatch) {
      foundMatch.winner = winnerName;
      foundMatch.score1 = score1;
      foundMatch.score2 = score2;
      foundMatch.status = 'completed';
      await saveTournaments();
      return true;
    }
    return false;
  } catch (e) {
    console.error('[TournamentEngine] Error submitting match result:', e);
    return false;
  }
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ limit: '15mb', extended: true }));

  // CORS middleware for APK and cross-origin clients
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    // Allow any origin or check for localhost/Render origins specifically
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,Content-Type,Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Support Discord Activity Proxy prefix mapping (e.g. /.proxy/api/...)
  app.use((req, res, next) => {
    if (req.url.startsWith('/.proxy/')) {
      req.url = req.url.replace('/.proxy', '');
    } else if (req.url === '/.proxy') {
      req.url = '/';
    }
    next();
  });

  // Load administrative settings and custom quests from Supabase/Backup
  await loadAdminData();

  // --- IN-MEMORY RATE LIMITER ---
  const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
  const createRateLimiter = (maxRequests: number, windowMs: number) => {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const ip = req.ip || (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
      const key = `${req.path}_${ip}`;
      const now = Date.now();
      const record = rateLimitMap.get(key);

      if (!record || now > record.resetTime) {
        rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
        return next();
      }

      if (record.count >= maxRequests) {
        return res.status(429).json({ error: 'Çok fazla istek gönderildi. Lütfen biraz bekleyin.' });
      }

      record.count += 1;
      next();
    };
  };

  const authLimiter = createRateLimiter(20, 60000); // 20 requests / min
  const adminLoginLimiter = createRateLimiter(10, 60000); // 10 attempts / min

  // --- API ROUTES ---
  
  // --- ADMIN PANEL API & AUTHENTICATION ENDPOINTS ---
  const ADMIN_SECRET_TOKEN = process.env.ADMIN_SECRET_TOKEN || 'deal-master-admin-token-2026-auth';
  const getEffectiveAdminPassword = () => {
    return (globalAdminSettings as any).adminPassword || process.env.ADMIN_PASSWORD || 'admin123';
  };

  // Admin authorization middleware
  const adminAuthMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization || req.headers['x-admin-token'] || req.query.adminToken;
    if (!authHeader) {
      return res.status(401).json({ error: 'Yetkisiz erişim: Yönetici oturumu gereklidir.' });
    }
    const token = String(authHeader).replace('Bearer ', '').trim();
    if (token !== ADMIN_SECRET_TOKEN) {
      return res.status(403).json({ error: 'Geçersiz veya yetkisi sonlanmış oturum.' });
    }
    next();
  };

  // Protect all /api/admin/* endpoints (except /api/admin/login)
  app.use('/api/admin', (req, res, next) => {
    if (req.path === '/login') return next();
    return adminAuthMiddleware(req, res, next);
  });

  // Secure Admin login endpoint with rate limiting
  app.post('/api/admin/login', adminLoginLimiter, (req, res) => {
    const { password } = req.body;
    const currentAdminPassword = getEffectiveAdminPassword();
    if (password && String(password).trim() === currentAdminPassword) {
      res.json({ success: true, token: ADMIN_SECRET_TOKEN });
    } else {
      res.status(401).json({ error: 'Geçersiz veya hatalı yönetici şifresi.' });
    }
  });

  // Secure Admin change password endpoint
  app.post('/api/admin/change-password', async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const effectivePassword = getEffectiveAdminPassword();

    if (!currentPassword || String(currentPassword).trim() !== effectivePassword) {
      return res.status(400).json({ error: 'Mevcut yönetici şifresi hatalı!' });
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 4) {
      return res.status(400).json({ error: 'Yeni şifre en az 4 karakter uzunluğunda olmalıdır.' });
    }

    const cleanNewPassword = newPassword.trim();
    (globalAdminSettings as any).adminPassword = cleanNewPassword;
    await saveAdminSettings(globalAdminSettings);

    console.log('[Admin] Admin password updated successfully.');
    res.json({ success: true, message: 'Yönetici şifresi başarıyla güncellendi.' });
  });

  // Get active admin settings
  app.get('/api/admin/settings', (req, res) => {
    res.json(globalAdminSettings);
  });

  // Update admin settings
  app.post('/api/admin/settings', async (req, res) => {
    const { settings } = req.body;
    if (!settings) return res.status(400).json({ error: 'Geçersiz ayar verisi.' });

    await saveAdminSettings(settings);

    // Sync match settings dynamically for all active playing matches
    for (const roomId in activeMatches) {
      const match = activeMatches[roomId];
      if (match) {
        // Update sets target dynamically if present
        (match as any).targetSets = globalAdminSettings.targetSets || 3;
      }
    }

    res.json({ success: true, settings: globalAdminSettings });
  });

  // Get voiceovers list and check existence on disk
  app.get('/api/admin/voice-list', (req, res) => {
    const list = [
      { id: 'place_bank', name: 'Bankaya Para Koyma', filename: 'place_bank.mp3', scope: 'actor' },
      { id: 'place_property', name: 'Mülk/Arazi Yerleştirme', filename: 'place_property.mp3', scope: 'actor' },
      { id: 'play_passgo', name: 'Çizgiden Geç (Pass & Go)', filename: 'play_passgo.mp3', scope: 'actor' },
      { id: 'play_birthday', name: 'Doğum Günü Kartı', filename: 'play_birthday.mp3', scope: 'global' },
      { id: 'play_debt', name: 'Haciz / Borç Tahsildarı', filename: 'play_debt.mp3', scope: 'duel' },
      { id: 'play_sly', name: 'Sinsi Anlaşma', filename: 'play_sly.mp3', scope: 'duel' },
      { id: 'play_dealbreaker', name: 'Anlaşma Bozan', filename: 'play_dealbreaker.mp3', scope: 'global' },
      { id: 'play_forced', name: 'Zoraki Takas', filename: 'play_forced.mp3', scope: 'duel' },
      { id: 'play_double', name: 'Çift Kira', filename: 'play_double.mp3', scope: 'duel' },
      { id: 'play_rent', name: 'Kira Kartı', filename: 'play_rent.mp3', scope: 'global' },
      { id: 'play_jsn', name: 'Hayır Teşekkürler (JSN)', filename: 'play_jsn.mp3', scope: 'duel' },
      { id: 'play_action', name: 'Diğer Aksiyon Kartları', filename: 'play_action.mp3', scope: 'actor' },
      { id: 'game_start', name: 'Oyun Başlangıcı (Start)', filename: 'game_start.mp3', scope: 'global' },
      { id: 'your_turn', name: 'Sıra Sende Splash', filename: 'your_turn.mp3', scope: 'actor' },
      { id: 'end_turn', name: 'Turu Sonlandırma', filename: 'end_turn.mp3', scope: 'actor' },
      { id: 'set_completed', name: 'Mülk Seti Tamamlama', filename: 'set_completed.mp3', scope: 'global' },
      { id: 'build_house', name: 'Ev İnşa Etme', filename: 'build_house.mp3', scope: 'actor' },
      { id: 'build_hotel', name: 'Otel İnşa Etme', filename: 'build_hotel.mp3', scope: 'actor' },
      { id: 'bankruptcy', name: 'İflas Olayı (Bankruptcy)', filename: 'bankruptcy.mp3', scope: 'global' },
      { id: 'victory', name: 'Kazanma / Zafer', filename: 'victory.mp3', scope: 'global' },
      { id: 'defeat', name: 'Kaybetme / Yenilgi', filename: 'defeat.mp3', scope: 'global' },
    ];

    try {
      const result = list.map((item) => {
        const publicTrPath = path.join(process.cwd(), 'public', 'assets', 'sounds', 'voices', 'tr', item.filename);
        const publicEnPath = path.join(process.cwd(), 'public', 'assets', 'sounds', 'voices', 'en', item.filename);
        
        const distTrPath = path.join(process.cwd(), 'dist', 'assets', 'sounds', 'voices', 'tr', item.filename);
        const distEnPath = path.join(process.cwd(), 'dist', 'assets', 'sounds', 'voices', 'en', item.filename);

        return {
          ...item,
          trExists: fs.existsSync(publicTrPath) || fs.existsSync(distTrPath),
          enExists: fs.existsSync(publicEnPath) || fs.existsSync(distEnPath),
        };
      });
      res.json(result);
    } catch (e) {
      console.error('[Admin] Failed to load voiceover files status:', e);
      res.status(500).json({ error: 'Ses dosyaları durum listesi alınamadı.' });
    }
  });

  // Upload voiceover file (base64)
  app.post('/api/admin/upload-voice', async (req, res) => {
    const { lang, filename, base64Data } = req.body;
    if (!lang || !filename || !base64Data) {
      return res.status(400).json({ error: 'Geçersiz veri gönderildi.' });
    }

    try {
      const base64Content = base64Data.split(';base64,').pop();
      if (!base64Content) {
        return res.status(400).json({ error: 'Base64 çözümlenemedi.' });
      }
      const buffer = Buffer.from(base64Content, 'base64');

      // 1. Write to public directory (development / source copy)
      const publicDirPath = path.join(process.cwd(), 'public', 'assets', 'sounds', 'voices', lang);
      fs.mkdirSync(publicDirPath, { recursive: true });
      fs.writeFileSync(path.join(publicDirPath, filename), buffer);

      // 2. Write to dist directory (production / hosting copy)
      const distDirPath = path.join(process.cwd(), 'dist', 'assets', 'sounds', 'voices', lang);
      if (fs.existsSync(path.join(process.cwd(), 'dist'))) {
        fs.mkdirSync(distDirPath, { recursive: true });
        fs.writeFileSync(path.join(distDirPath, filename), buffer);
      }

      console.log(`[Admin] Voice file uploaded successfully: ${lang}/${filename}`);
      res.json({ success: true, path: `/assets/sounds/voices/${lang}/${filename}` });
    } catch (e) {
      console.error('[Admin] Upload failed:', e);
      res.status(500).json({ error: 'Ses dosyası kaydedilemedi.' });
    }
  });

  // Get all registered players
  app.get('/api/admin/players', async (req, res) => {
    const users = await loadUsers();
    const list = Object.values(users).map((u) => ({
      id: u.id,
      username: u.username,
      discordId: u.discordId,
      avatarUrl: u.avatarUrl,
      level: u.level,
      xp: u.xp,
      coins: u.coins,
      gamesWon: u.stats?.gamesWon || 0,
      gamesPlayed: u.stats?.gamesPlayed || 0,
      friendsCount: u.friends?.length || 0,
      isDiscord: !!u.discordId || u.id.startsWith('user-dc-'),
      isGuest: u.id.startsWith('user-guest-') || u.id.startsWith('dc-') || u.username === 'Discord Oyuncusu'
    }));
    res.json(list);
  });

  // Add a new player directly into the database
  app.post('/api/admin/players/add', async (req, res) => {
    const { username, coins, level, xp, discordId, avatarUrl } = req.body;
    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'Kullanıcı adı boş bırakılamaz.' });
    }

    const trimmedUsername = username.trim();
    const users = await loadUsers();

    const existing = Object.values(users).find(
      (u) => u.username.toLowerCase() === trimmedUsername.toLowerCase()
    );
    if (existing) {
      return res.status(400).json({ error: `"${trimmedUsername}" adına sahip bir oyuncu zaten mevcut.` });
    }

    const newId = discordId ? `user-dc-${discordId}` : `user-reg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newPlayer: UserProfile = {
      id: newId,
      username: trimmedUsername,
      discordId: discordId ? String(discordId) : undefined,
      country: 'TR',
      coins: coins !== undefined && !isNaN(Number(coins)) ? Number(coins) : 1000,
      level: level !== undefined && !isNaN(Number(level)) ? Number(level) : 1,
      xp: xp !== undefined && !isNaN(Number(xp)) ? Number(xp) : 0,
      rankPoints: 0,
      avatarId: 'avatar_classic',
      avatarUrl: avatarUrl || `https://cdn.discordapp.com/embed/avatars/${Math.floor(Math.random() * 5)}.png`,
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
      settings: {
        soundVolume: 70,
        soundPitch: 1.0,
        synthType: 'sine',
        cardBack: 'back_classic',
        boardTheme: 'theme_slate',
        avatarId: 'avatar_classic',
        clothesId: 'clothes_none',
        profileFrame: 'frame_none',
        celebrationSound: 'sound_classic',
        playerBoard: 'board_classic',
        language: 'tr',
      },
      unlockedItems: ['avatar_classic', 'back_classic', 'theme_slate', 'frame_none', 'sound_classic', 'board_classic'],
      friends: [],
      achievements: (globalAchievements || []).map((a: any) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        targetValue: a.targetValue,
        currentValue: 0,
        completed: false,
        rewardCoins: a.rewardCoins,
        type: a.type || 'stats',
      })),
      dailyQuests: (globalQuests || []).map((q: any) => ({
        id: q.id,
        description: q.description,
        targetValue: q.targetValue,
        currentValue: 0,
        completed: false,
        claimed: false,
        rewardCoins: q.rewardCoins,
        rewardXp: q.rewardXp,
        type: q.type || 'stats',
      })),
      gamesHistory: [],
    };

    users[newId] = newPlayer;
    await saveUsers(users);

    res.json({ success: true, player: newPlayer });
  });

  // Delete a player permanently (from memory, local file, and Supabase)
  app.post('/api/admin/players/delete', async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'Geçersiz oyuncu ID.' });

    const users = await loadUsers();
    const user = users[userId];
    if (!user) {
      return res.status(404).json({ error: 'Silinecek oyuncu bulunamadı.' });
    }

    const deletedUsername = user.username;
    delete users[userId];
    await saveUsers(users);

    if (supabase) {
      try {
        await supabase.from('users').delete().eq('id', userId);
        console.log(`[Database] Deleted user ${userId} (${deletedUsername}) from Supabase.`);
      } catch (err) {
        console.error('[Database] Failed to delete user from Supabase:', err);
      }
    }

    res.json({ success: true, message: `"${deletedUsername}" oyuncusu başarıyla silindi.` });
  });

  // Clear ghost / placeholder accounts
  app.post('/api/admin/players/clear-placeholders', async (req, res) => {
    const users = await loadUsers();
    const toDeleteIds: string[] = [];

    for (const [id, u] of Object.entries(users)) {
      const uname = (u.username || '').trim().toLowerCase();
      if (
        uname === 'discord oyuncusu' ||
        uname.startsWith('discordplayer_') ||
        uname.startsWith('oyuncu_') ||
        id.startsWith('user-guest-') ||
        id.startsWith('dc-')
      ) {
        toDeleteIds.push(id);
      }
    }

    if (toDeleteIds.length === 0) {
      return res.json({ success: true, count: 0, message: 'Temizlenecek geçici/hayalet hesap bulunamadı.' });
    }

    for (const id of toDeleteIds) {
      delete users[id];
    }
    await saveUsers(users);

    if (supabase) {
      try {
        await supabase.from('users').delete().in('id', toDeleteIds);
        console.log(`[Database] Deleted ${toDeleteIds.length} placeholders from Supabase.`);
      } catch (err) {
        console.error('[Database] Supabase placeholder delete error:', err);
      }
    }

    res.json({ success: true, count: toDeleteIds.length, message: `${toDeleteIds.length} adet geçici / hayalet hesap veritabanından temizlendi.` });
  });

  // Update a player's profiles (xp, level, coins)
  app.post('/api/admin/players/update', async (req, res) => {
    const { userId, coins, xp, level } = req.body;
    const users = await loadUsers();
    const user = users[userId];
    if (!user) return res.status(404).json({ error: 'Oyuncu bulunamadı.' });

    if (coins !== undefined) user.coins = Number(coins);
    if (xp !== undefined) user.xp = Number(xp);
    if (level !== undefined) user.level = Number(level);

    users[userId] = user;
    await saveUsers(users);

    res.json({ success: true, player: user });
  });

  // --- GLOBAL DAILY QUESTS POOL ---
  app.get('/api/admin/quests', (req, res) => {
    res.json(globalQuests);
  });

  app.post('/api/admin/quests/add', async (req, res) => {
    const { description, targetValue, rewardCoins, rewardXp, type } = req.body;
    if (!description || !targetValue) {
      return res.status(400).json({ error: 'Açıklama ve hedef değer gereklidir.' });
    }

    const newQuest = {
      id: `q-custom-${Date.now()}`,
      description,
      targetValue: Number(targetValue),
      rewardCoins: Number(rewardCoins || 50),
      rewardXp: Number(rewardXp || 40),
      type: type || 'games_played'
    };

    globalQuests.push(newQuest);
    await saveGlobalQuests();

    // Propagate new quest to all loaded users
    const users = await loadUsers();
    for (const userId in users) {
      const u = users[userId];
      if (u.dailyQuests && !u.dailyQuests.some((q: any) => q.id === newQuest.id)) {
        u.dailyQuests.push({
          id: newQuest.id,
          description: newQuest.description,
          targetValue: newQuest.targetValue,
          currentValue: 0,
          completed: false,
          claimed: false,
          rewardCoins: newQuest.rewardCoins,
          rewardXp: newQuest.rewardXp,
          type: newQuest.type
        });
      }
    }
    await saveUsers(users);

    res.json({ success: true, quests: globalQuests });
  });

  app.post('/api/admin/quests/delete', async (req, res) => {
    const { questId } = req.body;
    globalQuests = globalQuests.filter((q) => q.id !== questId);
    await saveGlobalQuests();

    // Also remove from active users
    const users = await loadUsers();
    for (const userId in users) {
      const u = users[userId];
      if (u.dailyQuests) {
        u.dailyQuests = u.dailyQuests.filter((q: any) => q.id !== questId);
      }
    }
    await saveUsers(users);

    res.json({ success: true, quests: globalQuests });
  });


  // --- GLOBAL PERSISTENT ACHIEVEMENTS POOL ---
  app.get('/api/admin/achievements', (req, res) => {
    res.json(globalAchievements);
  });

  app.post('/api/admin/achievements/add', async (req, res) => {
    const { title, description, targetValue, rewardCoins, type } = req.body;
    if (!title || !description || !targetValue) {
      return res.status(400).json({ error: 'Başlık, açıklama ve hedef değer gereklidir.' });
    }

    const newAch = {
      id: `ach-custom-${Date.now()}`,
      title,
      description,
      targetValue: Number(targetValue),
      rewardCoins: Number(rewardCoins || 100),
      type: type || 'games_played'
    };

    globalAchievements.push(newAch);
    await saveGlobalAchievements();

    // Propagate new achievement to all loaded users
    const users = await loadUsers();
    for (const userId in users) {
      const u = users[userId];
      if (u.achievements && !u.achievements.some((a: any) => a.id === newAch.id)) {
        let initialVal = 0;
        if (newAch.type === 'games_played') initialVal = u.stats?.gamesPlayed || 0;
        else if (newAch.type === 'games_won') initialVal = u.stats?.gamesWon || 0;
        else if (newAch.type === 'games_lost') initialVal = u.stats?.gamesLost || 0;
        else if (newAch.type === 'money_banked') initialVal = u.stats?.totalMoneyBanked || 0;
        else if (newAch.type === 'cards_stolen') initialVal = u.stats?.totalCardsStolen || 0;
        else if (newAch.type === 'sets_completed') initialVal = u.stats?.totalSetsCompleted || 0;
        else if (newAch.type === 'rent_collected') initialVal = u.stats?.totalRentCollected || 0;

        u.achievements.push({
          id: newAch.id,
          title: newAch.title,
          description: newAch.description,
          targetValue: newAch.targetValue,
          currentValue: initialVal,
          completed: initialVal >= newAch.targetValue,
          rewardCoins: newAch.rewardCoins,
          type: newAch.type
        });
      }
    }
    await saveUsers(users);

    res.json({ success: true, achievements: globalAchievements });
  });

  app.post('/api/admin/achievements/delete', async (req, res) => {
    const { achievementId } = req.body;
    globalAchievements = globalAchievements.filter((a) => a.id !== achievementId);
    await saveGlobalAchievements();

    // Also remove from active users
    const users = await loadUsers();
    for (const userId in users) {
      const u = users[userId];
      if (u.achievements) {
        u.achievements = u.achievements.filter((a: any) => a.id !== achievementId);
      }
    }
    await saveUsers(users);

    res.json({ success: true, achievements: globalAchievements });
  });

  // --- STORE PRODUCTS MANAGEMENT API ENDPOINTS ---
  app.get('/api/shop/items', (req, res) => {
    res.json(globalStoreItems);
  });

  app.post('/api/admin/shop/add', async (req, res) => {
    const {
      name, category, price, description, mediaUrl, mediaType, previewColor, previewUrl,
      rarity, overlayMode, overlayOpacity, glowColor, particleEffect, discountPercent,
      gradientStart, gradientEnd, gradientDirection, borderStyle, borderWidth, borderColor,
      animType, badgeText, badgeColor, badgeBg, audioUrl, requiredLevel, requiredLeague,
      limitedTimeEnd, stockLimit, stockRemaining
    } = req.body;

    if (!name || !category || price === undefined) {
      return res.status(400).json({ error: 'Ürün adı, kategori ve fiyat zorunludur.' });
    }

    const newItem = {
      id: `item_${category}_${Date.now()}`,
      name: name.trim(),
      category,
      price: Number(price),
      description: description ? description.trim() : '',
      mediaUrl: mediaUrl ? mediaUrl.trim() : undefined,
      mediaType: mediaType || 'image',
      previewColor: previewColor ? previewColor.trim() : undefined,
      previewUrl: previewUrl ? previewUrl.trim() : undefined,
      rarity: rarity || 'common',
      overlayMode: overlayMode || 'normal',
      overlayOpacity: overlayOpacity !== undefined ? Number(overlayOpacity) : 0.5,
      glowColor: glowColor ? glowColor.trim() : undefined,
      particleEffect: particleEffect || 'none',
      discountPercent: discountPercent !== undefined ? Number(discountPercent) : 0,
      gradientStart: gradientStart ? gradientStart.trim() : undefined,
      gradientEnd: gradientEnd ? gradientEnd.trim() : undefined,
      gradientDirection: gradientDirection || 'to-br',
      borderStyle: borderStyle || 'solid',
      borderWidth: borderWidth !== undefined ? Number(borderWidth) : 1,
      borderColor: borderColor ? borderColor.trim() : undefined,
      animType: animType || 'none',
      badgeText: badgeText ? badgeText.trim() : undefined,
      badgeColor: badgeColor ? badgeColor.trim() : undefined,
      badgeBg: badgeBg ? badgeBg.trim() : undefined,
      audioUrl: audioUrl ? audioUrl.trim() : undefined,
      requiredLevel: requiredLevel !== undefined ? Number(requiredLevel) : 0,
      requiredLeague: requiredLeague ? requiredLeague.trim() : undefined,
      limitedTimeEnd: limitedTimeEnd ? limitedTimeEnd.trim() : undefined,
      stockLimit: stockLimit !== undefined ? Number(stockLimit) : undefined,
      stockRemaining: stockRemaining !== undefined ? Number(stockRemaining) : (stockLimit !== undefined ? Number(stockLimit) : undefined),
      isUnlocked: false
    };

    globalStoreItems.unshift(newItem);
    await saveGlobalStoreItems();

    res.json({ success: true, items: globalStoreItems });
  });

  app.post('/api/admin/shop/update', async (req, res) => {
    const {
      id, name, category, price, description, mediaUrl, mediaType, previewColor, previewUrl,
      rarity, overlayMode, overlayOpacity, glowColor, particleEffect, discountPercent,
      gradientStart, gradientEnd, gradientDirection, borderStyle, borderWidth, borderColor,
      animType, badgeText, badgeColor, badgeBg, audioUrl, requiredLevel, requiredLeague,
      limitedTimeEnd, stockLimit, stockRemaining
    } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Ürün ID belirtilmelidir.' });
    }

    const index = globalStoreItems.findIndex((item) => item.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Ürün bulunamadı.' });
    }

    globalStoreItems[index] = {
      ...globalStoreItems[index],
      name: name !== undefined ? name.trim() : globalStoreItems[index].name,
      category: category || globalStoreItems[index].category,
      price: price !== undefined ? Number(price) : globalStoreItems[index].price,
      description: description !== undefined ? description.trim() : globalStoreItems[index].description,
      mediaUrl: mediaUrl !== undefined ? mediaUrl.trim() : globalStoreItems[index].mediaUrl,
      mediaType: mediaType || globalStoreItems[index].mediaType || 'image',
      previewColor: previewColor !== undefined ? previewColor.trim() : globalStoreItems[index].previewColor,
      previewUrl: previewUrl !== undefined ? previewUrl.trim() : globalStoreItems[index].previewUrl,
      rarity: rarity !== undefined ? rarity : (globalStoreItems[index].rarity || 'common'),
      overlayMode: overlayMode !== undefined ? overlayMode : (globalStoreItems[index].overlayMode || 'normal'),
      overlayOpacity: overlayOpacity !== undefined ? Number(overlayOpacity) : (globalStoreItems[index].overlayOpacity ?? 0.5),
      glowColor: glowColor !== undefined ? glowColor.trim() : globalStoreItems[index].glowColor,
      particleEffect: particleEffect !== undefined ? particleEffect : (globalStoreItems[index].particleEffect || 'none'),
      discountPercent: discountPercent !== undefined ? Number(discountPercent) : (globalStoreItems[index].discountPercent || 0),
      gradientStart: gradientStart !== undefined ? gradientStart.trim() : globalStoreItems[index].gradientStart,
      gradientEnd: gradientEnd !== undefined ? gradientEnd.trim() : globalStoreItems[index].gradientEnd,
      gradientDirection: gradientDirection !== undefined ? gradientDirection : (globalStoreItems[index].gradientDirection || 'to-br'),
      borderStyle: borderStyle !== undefined ? borderStyle : (globalStoreItems[index].borderStyle || 'solid'),
      borderWidth: borderWidth !== undefined ? Number(borderWidth) : (globalStoreItems[index].borderWidth ?? 1),
      borderColor: borderColor !== undefined ? borderColor.trim() : globalStoreItems[index].borderColor,
      animType: animType !== undefined ? animType : (globalStoreItems[index].animType || 'none'),
      badgeText: badgeText !== undefined ? badgeText.trim() : globalStoreItems[index].badgeText,
      badgeColor: badgeColor !== undefined ? badgeColor.trim() : globalStoreItems[index].badgeColor,
      badgeBg: badgeBg !== undefined ? badgeBg.trim() : globalStoreItems[index].badgeBg,
      audioUrl: audioUrl !== undefined ? audioUrl.trim() : globalStoreItems[index].audioUrl,
      requiredLevel: requiredLevel !== undefined ? Number(requiredLevel) : (globalStoreItems[index].requiredLevel || 0),
      requiredLeague: requiredLeague !== undefined ? requiredLeague.trim() : globalStoreItems[index].requiredLeague,
      limitedTimeEnd: limitedTimeEnd !== undefined ? limitedTimeEnd.trim() : globalStoreItems[index].limitedTimeEnd,
      stockLimit: stockLimit !== undefined ? Number(stockLimit) : globalStoreItems[index].stockLimit,
      stockRemaining: stockRemaining !== undefined ? Number(stockRemaining) : globalStoreItems[index].stockRemaining,
    };

    await saveGlobalStoreItems();

    res.json({ success: true, items: globalStoreItems });
  });

  app.post('/api/admin/shop/delete', async (req, res) => {
    const { itemId } = req.body;
    if (!itemId) {
      return res.status(400).json({ error: 'Ürün ID belirtilmelidir.' });
    }

    globalStoreItems = globalStoreItems.filter((item) => item.id !== itemId);
    await saveGlobalStoreItems();

    res.json({ success: true, items: globalStoreItems });
  });

  app.post('/api/admin/shop/upload-media', async (req, res) => {
    const { filename, base64Data } = req.body;
    if (!filename || !base64Data) {
      return res.status(400).json({ error: 'Geçersiz veri gönderildi.' });
    }

    try {
      const base64Content = base64Data.split(';base64,').pop();
      if (!base64Content) {
        return res.status(400).json({ error: 'Base64 çözümlenemedi.' });
      }
      const buffer = Buffer.from(base64Content, 'base64');

      const publicUploadsDir = path.join(process.cwd(), 'public', 'assets', 'uploads');
      fs.mkdirSync(publicUploadsDir, { recursive: true });
      const sanitizedFilename = `${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      fs.writeFileSync(path.join(publicUploadsDir, sanitizedFilename), buffer);

      const distUploadsDir = path.join(process.cwd(), 'dist', 'assets', 'uploads');
      if (fs.existsSync(path.join(process.cwd(), 'dist'))) {
        fs.mkdirSync(distUploadsDir, { recursive: true });
        fs.writeFileSync(path.join(distUploadsDir, sanitizedFilename), buffer);
      }

      console.log(`[Admin] Shop media uploaded successfully: /assets/uploads/${sanitizedFilename}`);
      res.json({ success: true, url: `/assets/uploads/${sanitizedFilename}` });
    } catch (e) {
      console.error('[Admin] Shop media upload failed:', e);
      res.status(500).json({ error: 'Medya dosyası kaydedilemedi.' });
    }
  });

  // --- 🏆 REVAMPED SOLO BOT TOURNAMENT ENGINE ---
  const DEFAULT_TOURNAMENTS: Tournament[] = [
    {
      id: 't-bronze',
      name: '🥉 Acemi Arenası',
      description: 'Yeni başlayanlar için 8 kişilik 1v1 eleme kupası. Taktikleri test etmek için harika!',
      tier: 'bronze',
      format: '1v1',
      botDifficulty: 'easy',
      allowBots: true,
      entryFee: 100,
      prizeCoins: 500,
      prizeXp: 150,
      maxParticipants: 8,
      targetSets: 3,
      turnDurationSeconds: 35,
      icon: '🥉',
      participants: [],
      rounds: [],
      status: 'registration',
    },
    {
      id: 't-gold',
      name: '🥇 Şampiyonlar Kupası',
      description: 'Zorlu taktikçi botlara karşı 8 kişilik büyük şampiyona. Büyük ödül sizi bekliyor!',
      tier: 'gold',
      format: '1v1',
      botDifficulty: 'medium',
      allowBots: true,
      entryFee: 500,
      prizeCoins: 2500,
      prizeXp: 500,
      maxParticipants: 8,
      targetSets: 3,
      turnDurationSeconds: 30,
      icon: '🥇',
      participants: [],
      rounds: [],
      status: 'registration',
    },
    {
      id: 't-legend',
      name: '👑 Efsaneler Ligi (16 Kişilik)',
      description: 'En usta botların yer aldığı devasa 16 kişilik büyük nakavt ligi! Son 16, Çeyrek, Yarı ve Final!',
      tier: 'legend',
      format: '1v1',
      botDifficulty: 'expert',
      allowBots: true,
      entryFee: 2500,
      prizeCoins: 15000,
      prizeXp: 2000,
      maxParticipants: 16,
      targetSets: 3,
      turnDurationSeconds: 30,
      icon: '👑',
      participants: [],
      rounds: [],
      status: 'registration',
    },
    {
      id: 't-2v2-championship',
      name: '⚔️ 2v2 Takım Şampiyonası',
      description: 'Sadık bot partnerinizle birlikte 2 rakip bota karşı 4 setlik büyük takım savaşı!',
      tier: 'gold',
      format: '2v2_team',
      botDifficulty: 'medium',
      allowBots: true,
      entryFee: 300,
      prizeCoins: 1500,
      prizeXp: 400,
      maxParticipants: 4,
      targetSets: 4,
      turnDurationSeconds: 30,
      icon: '⚔️',
      participants: [],
      rounds: [],
      status: 'registration',
    },
    {
      id: 't-4p-royal',
      name: '👥 4 Kişilik Krallık Masası',
      description: 'Aynı masada 3 bot rakibe karşı herkes tek mücadele! 3 seti ilk tamamlayan kupayı kaldırır.',
      tier: 'silver',
      format: '4player',
      botDifficulty: 'medium',
      allowBots: true,
      entryFee: 200,
      prizeCoins: 1000,
      prizeXp: 300,
      maxParticipants: 4,
      targetSets: 3,
      turnDurationSeconds: 30,
      icon: '👥',
      participants: [],
      rounds: [],
      status: 'registration',
    }
  ];

  // Helper to generate bot pool by difficulty (Rich 100+ name pool with dynamic fallback)
  function getBotPoolByDifficulty(diff: string = 'medium'): string[] {
    if (diff === 'easy') {
      return [
        'Acemi Bot', 'Stajyer Bot', 'Çaylak Memo', 'Yeni Oyuncu Bot', 'Hızlı Zar Bot', 'Hevesli Bot', 'Mini Bot', 'Bot Can',
        'Acemi Ege', 'Çırak Sarp', 'Yeni Başlayan Ali', 'Deneme Botu', 'Piyon Bot', 'Zar Meraklısı', 'Çaylak Defne', 'Genç Milyoner',
        'Stajyer Leyla', 'Mini Zar', 'Acemi Kerem', 'Bot Berke', 'Bot Selin', 'Bot Barış', 'Bot Ela', 'Bot Yağız',
        'Bot Deniz', 'Bot Doruk', 'Bot Miray', 'Bot Emre', 'Bot Zehra', 'Bot Batu', 'Bot Melis', 'Bot Kaan',
        'Bot Tuana', 'Bot Aras', 'Bot Duru', 'Bot Poyraz', 'Bot Arya', 'Bot Mert', 'Bot Ada', 'Bot Rüzgar',
        'Bot Nil', 'Bot Burak', 'Bot Derin', 'Bot Umut', 'Bot Ecrin', 'Bot Tuna', 'Bot Asya', 'Bot Demir'
      ];
    }
    if (diff === 'expert') {
      return [
        'Grandmaster Bot', 'Mega Lord', 'Titan Bot', 'Apex Master', 'Mythic Bot', 'Cyber King', 'Shadow Deal', 'Alpha Dominator',
        'Quantum Master', 'Ultra Bot', 'Imperial King', 'Dominator', 'Süper Zeka Alpha', 'Borsa Baronu Prime', 'Milyarder VIP', 'Vortex Master',
        'Phantom King', 'Omega Striker', 'Nova Emperor', 'Infinity Deal', 'Absolute Dominance', 'Apex Prime', 'Zenith Master', 'Solar Titan',
        'Dark Sovereign', 'Cyber Overlord', 'God of Deals', 'Supreme Strategist', 'Grand Sultan', 'Titan Monarch', 'Galaxy Master', 'Cosmic Lord',
        'Overlord X', 'Grand Titan', 'Hyper Master', 'Apex Sovereign', 'Quantum Deity', 'Lord of Monopoly', 'Mastermind Bot', 'Vanguard Prime',
        'Chronos Deal', 'Apex Emperor', 'Imperial Master', 'Nexus Prime', 'Alpha Deity', 'Viper Master', 'Titan Dominator', 'Grand Sovereign'
      ];
    }
    if (diff === 'hard') {
      return [
        'Taktik Ustası', 'Emlak Büyücüsü', 'Borsa Kralı', 'Kurnaz Bot', 'Sinsi Deal Bot', 'Kart Şampiyonu', 'Zeki Milyoner', 'Pro Bot',
        'Kurt Oyuncu', 'Strateji Dehası', 'Hamle Ustası', 'Piyasa Avcısı', 'Arsa Zaptedicisi', 'Kira Avcısı', 'Kart Virtüözü', 'Sinsi Baron',
        'Gölge Milyoner', 'Taktik Dehası Sarp', 'Deal Avcısı Cem', 'Emlak Kralı Kerim', 'Borsa Virtüözü', 'Sinsi Taktikçi', 'Kart Kurdu', 'Pro Defne',
        'Kira Şampiyonu', 'Stratejik Bot', 'Zeki Hamle', 'Piyasa Canavarı', 'Borsa Kurdu', 'Emlak Şefi', 'Master Deal', 'Kurnaz Milyoner',
        'Mega Stratejist', 'Taktik Lideri', 'Arsa Avcısı', 'Kira Ustası', 'Usta Hamleci', 'Piyasa Lideri', 'Kart Koleksiyoncusu', 'Kurnaz Zar'
      ];
    }
    return [
      'Milyoner Bot', 'Siber Bot', 'Kral Bot', 'Emlakçı Bot', 'Kart Ustası', 'Zeki Bot', 'Bot Defne', 'Bot Ege',
      'Hızlı Zar', 'Taktikçi Memo', 'Şanslı Bot', 'Altın Zar', 'Borsa Meraklısı', 'Arsa Avcısı', 'Zeki Hamle', 'Kentsel Dönüşümcü',
      'Kira Toplayıcı', 'Kart Sever', 'Zar Dehası', 'Milyonluk Bot', 'Kıdemli Bot', 'Deneyimli Oyuncu', 'Kira Uzmanı', 'Arsa Mimarı',
      'Bot Selim', 'Bot Aylin', 'Bot Serdar', 'Bot Gizem', 'Bot Onur', 'Bot Büşra', 'Bot Tarık', 'Bot Sinem',
      'Bot Erdem', 'Bot Hande', 'Bot Tolga', 'Bot Gamze', 'Bot Volkan', 'Bot Ceren', 'Bot Koray', 'Bot Begüm',
      'Bot Cenk', 'Bot İpek', 'Bot Alper', 'Bot Esra', 'Bot Tayfun', 'Bot Melike', 'Bot Hakan', 'Bot Damla'
    ];
  }

  // Generate initial personal bracket tree for a tournament template
  function generateUserTournamentTree(template: Tournament, username: string): Tournament {
    const bots = getBotPoolByDifficulty(template.botDifficulty);
    const maxP = template.maxParticipants || (template.format === '1v1' ? 8 : 4);
    const participants: string[] = [username];

    for (let i = 0; participants.length < maxP; i++) {
      const name = i < bots.length ? bots[i] : `Bot Rakip ${i + 1}`;
      if (!participants.includes(name)) {
        participants.push(name);
      }
    }

    const rounds: any[] = [];
    const matchCount = (template.format === '4player' || template.format === '2v2_team') 
      ? Math.max(1, Math.ceil(maxP / 4)) 
      : Math.floor(maxP / 2);
    
    const matches: TournamentMatch[] = [];

    for (let i = 0; i < matchCount; i++) {
      if (template.format === '4player') {
        const s1 = participants[i * 4] || username;
        const s2 = participants[i * 4 + 1] || `Bot ${i * 4 + 2}`;
        const s3 = participants[i * 4 + 2] || `Bot ${i * 4 + 3}`;
        const s4 = participants[i * 4 + 3] || `Bot ${i * 4 + 4}`;
        matches.push({
          id: `tm-${template.id}-r1-${i + 1}`,
          player1: s1,
          player2: s2,
          player3: s3,
          player4: s4,
          tablePlayers: [s1, s2, s3, s4],
          status: 'pending'
        });
      } else if (template.format === '2v2_team') {
        const t1a = participants[i * 4] || username;
        const t1b = participants[i * 4 + 1] || 'Sadık Bot Partner';
        const t2a = participants[i * 4 + 2] || `Rakip Bot ${i * 2 + 1}`;
        const t2b = participants[i * 4 + 3] || `Rakip Bot ${i * 2 + 2}`;
        matches.push({
          id: `tm-${template.id}-r1-${i + 1}`,
          player1: t1a,
          player2: t2a,
          player3: t1b,
          player4: t2b,
          team1: [t1a, t1b],
          team2: [t2a, t2b],
          status: 'pending'
        });
      } else {
        const p1 = participants[i * 2] || username;
        const p2 = participants[i * 2 + 1] || `Bot ${i + 1}`;
        matches.push({
          id: `tm-${template.id}-r1-${i + 1}`,
          player1: p1,
          player2: p2,
          status: 'pending'
        });
      }
    }

    rounds.push({
      roundNumber: 1,
      matches
    });

    return {
      ...template,
      participants,
      rounds,
      status: 'active'
    };
  }

  // Generate preview bracket tree when not yet started
  function generatePreviewTournamentTree(template: Tournament): Tournament {
    const maxP = template.maxParticipants || (template.format === '1v1' ? 8 : 4);
    const matchCount = (template.format === '4player' || template.format === '2v2_team') 
      ? Math.max(1, Math.ceil(maxP / 4)) 
      : Math.floor(maxP / 2);

    const matches: TournamentMatch[] = [];
    for (let i = 0; i < matchCount; i++) {
      if (template.format === '4player') {
        matches.push({
          id: `tm-preview-${i + 1}`,
          player1: i === 0 ? 'Sen (Kayıt Ol)' : `Bot Rakip ${i * 4 + 1}`,
          player2: `Bot Rakip ${i * 4 + 2}`,
          player3: `Bot Rakip ${i * 4 + 3}`,
          player4: `Bot Rakip ${i * 4 + 4}`,
          tablePlayers: [i === 0 ? 'Sen (Kayıt Ol)' : `Bot Rakip ${i * 4 + 1}`, `Bot Rakip ${i * 4 + 2}`, `Bot Rakip ${i * 4 + 3}`, `Bot Rakip ${i * 4 + 4}`],
          status: 'pending'
        });
      } else if (template.format === '2v2_team') {
        matches.push({
          id: `tm-preview-${i + 1}`,
          player1: i === 0 ? 'Sen (Kayıt Ol)' : `Bot Kaptan ${i + 1}`,
          player2: `Rakip Bot ${i * 2 + 1}`,
          player3: 'Sadık Partner',
          player4: `Rakip Bot ${i * 2 + 2}`,
          team1: [i === 0 ? 'Sen (Kayıt Ol)' : `Bot Kaptan ${i + 1}`, 'Sadık Partner'],
          team2: [`Rakip Bot ${i * 2 + 1}`, `Rakip Bot ${i * 2 + 2}`],
          status: 'pending'
        });
      } else {
        matches.push({
          id: `tm-preview-${i + 1}`,
          player1: i === 0 ? 'Sen (Kayıt Ol)' : `Bot ${i * 2 + 1}`,
          player2: `Bot ${i * 2 + 2}`,
          status: 'pending'
        });
      }
    }

    return {
      ...template,
      participants: [],
      rounds: [
        {
          roundNumber: 1,
          matches
        }
      ],
      status: 'registration'
    };
  }

  // GET /api/tournaments: Returns all tournaments with personalized progress for user if provided
  app.get('/api/tournaments', async (req, res) => {
    const userId = req.query.userId as string | undefined;
    let users = await loadUsers();
    const user = userId ? users[userId] : null;

    // Ensure activeTournaments catalog exists
    if (!activeTournaments || activeTournaments.length === 0) {
      activeTournaments = [...DEFAULT_TOURNAMENTS];
      await saveTournaments();
    }

    const result = activeTournaments.map((tpl) => {
      if (user && user.tournaments && user.tournaments[tpl.id]) {
        // Merge template details with saved user progress
        return {
          ...tpl,
          ...user.tournaments[tpl.id]
        };
      }
      return generatePreviewTournamentTree(tpl);
    });

    res.json(result);
  });

  // POST /api/tournaments/user/start: User registers and starts personal tournament campaign
  app.post('/api/tournaments/user/start', async (req, res) => {
    const { userId, tournamentId } = req.body;
    const users = await loadUsers();
    const user = users[userId];
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

    const template = activeTournaments.find((t) => t.id === tournamentId) || DEFAULT_TOURNAMENTS.find((t) => t.id === tournamentId);
    if (!template) return res.status(404).json({ error: 'Turnuva bulunamadı.' });

    // Deduct entry fee
    const fee = template.entryFee || 0;
    if (fee > 0) {
      if (user.coins < fee) {
        return res.status(400).json({ error: `Yetersiz altın! Giriş ücreti: ${fee} 🪙` });
      }
      user.coins -= fee;
    }

    // Generate personalized bracket tree
    const personalTree = generateUserTournamentTree(template, user.username);

    if (!user.tournaments) user.tournaments = {};
    user.tournaments[template.id] = personalTree;

    await saveUsers(users);

    res.json({ success: true, tournament: personalTree, user });
  });

  // POST /api/tournaments/user/match_complete: Advance user tournament after match result
  app.post('/api/tournaments/user/match_complete', async (req, res) => {
    const { userId, tournamentId, matchId, playerWon, score1 = 3, score2 = 1 } = req.body;
    const users = await loadUsers();
    const user = users[userId];
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

    if (!user.tournaments || !user.tournaments[tournamentId]) {
      return res.status(404).json({ error: 'Aktif turnuva kaydı bulunamadı.' });
    }

    const t: Tournament = user.tournaments[tournamentId];
    if (!t.rounds || t.rounds.length === 0) return res.status(400).json({ error: 'Turnuva turları bulunamadı.' });

    const currentRound = t.rounds[t.rounds.length - 1];
    const match = currentRound.matches.find((m) => m.id === matchId || m.id.includes(matchId)) || currentRound.matches[0];
    if (!match) return res.status(404).json({ error: 'Maç bulunamadı.' });

    const isPlayer1Me = match.player1 === user.username || match.player1 === 'Sen';
    const isTeam1Me = match.team1 && match.team1.includes(user.username);
    const isTableMe = match.tablePlayers && match.tablePlayers.includes(user.username);

    const winnerName = playerWon ? user.username : (isPlayer1Me ? match.player2 : match.player1);

    match.winner = winnerName;
    match.score1 = playerWon ? Math.max(score1, 3) : Math.min(score1, 1);
    match.score2 = playerWon ? Math.min(score2, 1) : Math.max(score2, 3);
    match.status = 'completed';

    // Simulate any other bot matches in this round
    currentRound.matches.forEach((m) => {
      if (m.id !== match.id && m.status === 'pending') {
        if (t.format === '4player') {
          const pool = m.tablePlayers || [m.player1, m.player2, m.player3 || 'Bot 3', m.player4 || 'Bot 4'];
          const randomWinner = pool[Math.floor(Math.random() * pool.length)];
          m.winner = randomWinner;
          m.status = 'completed';
        } else if (t.format === '2v2_team') {
          const winTeam1 = Math.random() > 0.5;
          m.winner = winTeam1 ? (m.team1?.[0] || m.player1) : (m.team2?.[0] || m.player2);
          m.score1 = winTeam1 ? 4 : Math.floor(Math.random() * 3);
          m.score2 = winTeam1 ? Math.floor(Math.random() * 3) : 4;
          m.status = 'completed';
        } else {
          const winP1 = Math.random() > 0.5;
          m.winner = winP1 ? m.player1 : m.player2;
          m.score1 = winP1 ? 3 : Math.floor(Math.random() * 2);
          m.score2 = winP1 ? Math.floor(Math.random() * 2) : 3;
          m.status = 'completed';
        }
      }
    });

    if (playerWon) {
      if (currentRound.matches.length === 1) {
        // Grand Final Won! Champion crowned!
        t.status = 'completed';
        t.winner = user.username;

        // Give Grand Prize
        const prizeCoins = t.prizeCoins || 1000;
        const prizeXp = t.prizeXp || 300;
        user.coins += prizeCoins;
        user.xp += prizeXp;
        user.stats.gamesWon += 1;
        user.stats.gamesPlayed += 1;
      } else {
        // Build Next Round
        const nextRoundNumber = currentRound.roundNumber + 1;
        const nextMatches: TournamentMatch[] = [];

        if (t.format === '4player') {
          const winners = currentRound.matches.map((m) => m.winner).filter(Boolean) as string[];
          if (winners.length <= 4) {
            // Final Table with advancing winners
            const s1 = winners[0] || user.username;
            const s2 = winners[1] || 'Usta Bot 1';
            const s3 = winners[2] || 'Usta Bot 2';
            const s4 = winners[3] || 'Usta Bot 3';
            nextMatches.push({
              id: `tm-${t.id}-r${nextRoundNumber}-final`,
              player1: s1,
              player2: s2,
              player3: s3,
              player4: s4,
              tablePlayers: [s1, s2, s3, s4],
              status: 'pending'
            });
          } else {
            // Group winners into tables of 4
            const numTables = Math.ceil(winners.length / 4);
            for (let i = 0; i < numTables; i++) {
              const s1 = winners[i * 4] || user.username;
              const s2 = winners[i * 4 + 1] || `Usta Bot ${i * 4 + 2}`;
              const s3 = winners[i * 4 + 2] || `Usta Bot ${i * 4 + 3}`;
              const s4 = winners[i * 4 + 3] || `Usta Bot ${i * 4 + 4}`;
              nextMatches.push({
                id: `tm-${t.id}-r${nextRoundNumber}-${Date.now()}-${i + 1}`,
                player1: s1,
                player2: s2,
                player3: s3,
                player4: s4,
                tablePlayers: [s1, s2, s3, s4],
                status: 'pending'
              });
            }
          }
        } else if (t.format === '2v2_team') {
          // Get winning teams
          const winningTeams: string[][] = currentRound.matches.map((m) => {
            if (m.winner && m.team1 && m.team1.includes(m.winner)) return m.team1;
            if (m.winner && m.team2 && m.team2.includes(m.winner)) return m.team2;
            return m.team1 || [m.player1, m.player3 || 'Bot'];
          });

          for (let i = 0; i < winningTeams.length; i += 2) {
            if (i + 1 < winningTeams.length) {
              const t1 = winningTeams[i];
              const t2 = winningTeams[i + 1];
              nextMatches.push({
                id: `tm-${t.id}-r${nextRoundNumber}-${Date.now()}-${i / 2 + 1}`,
                player1: t1[0],
                player2: t2[0],
                player3: t1[1],
                player4: t2[1],
                team1: t1,
                team2: t2,
                status: 'pending'
              });
            }
          }
        } else {
          // 1v1 Format
          const winners = currentRound.matches.map((m) => m.winner).filter(Boolean) as string[];
          for (let i = 0; i < winners.length; i += 2) {
            if (i + 1 < winners.length) {
              nextMatches.push({
                id: `tm-${t.id}-r${nextRoundNumber}-${Date.now()}-${i / 2 + 1}`,
                player1: winners[i],
                player2: winners[i + 1],
                status: 'pending'
              });
            }
          }
        }

        t.rounds.push({
          roundNumber: nextRoundNumber,
          matches: nextMatches
        });
      }
    } else {
      // Player lost the match -> Tournament ends
      t.status = 'completed';
      t.winner = winnerName;
      user.stats.gamesPlayed += 1;
    }

    user.tournaments[tournamentId] = t;
    await saveUsers(users);

    res.json({ success: true, tournament: t, user });
  });

  // POST /api/tournaments/user/reset: Resets user's tournament progression so they can replay
  app.post('/api/tournaments/user/reset', async (req, res) => {
    const { userId, tournamentId } = req.body;
    const users = await loadUsers();
    const user = users[userId];
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

    if (user.tournaments && user.tournaments[tournamentId]) {
      delete user.tournaments[tournamentId];
      await saveUsers(users);
    }

    const template = activeTournaments.find((t) => t.id === tournamentId) || DEFAULT_TOURNAMENTS.find((t) => t.id === tournamentId);
    const preview = template ? generatePreviewTournamentTree(template) : null;

    res.json({ success: true, tournament: preview, user });
  });

  // Admin Save (Create or Update) Tournament in Catalog
  app.post('/api/admin/tournaments/save', async (req, res) => {
    const {
      id,
      name,
      description,
      tier = 'gold',
      format = '1v1',
      botDifficulty = 'medium',
      entryFee = 100,
      prizeCoins = 1000,
      prizeXp = 300,
      maxParticipants = 8,
      targetSets = 3,
      turnDurationSeconds = 30,
      icon
    } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Turnuva adı girilmelidir.' });
    }

    const tId = id || `t-${Date.now()}`;
    const autoIcon = icon || (format === '4player' ? '👥' : (format === '2v2_team' ? '⚔️' : (tier === 'legend' ? '👑' : tier === 'gold' ? '🥇' : '🥉')));

    const updatedTournament: Tournament = {
      id: tId,
      name: name.trim(),
      description: description ? description.trim() : undefined,
      tier,
      format,
      botDifficulty,
      allowBots: true,
      entryFee: Number(entryFee) || 0,
      prizeCoins: Number(prizeCoins) || 1000,
      prizeXp: Number(prizeXp) || 300,
      maxParticipants: Number(maxParticipants) || 8,
      targetSets: Number(targetSets) || 3,
      turnDurationSeconds: Number(turnDurationSeconds) || 30,
      icon: autoIcon,
      participants: [],
      rounds: [],
      status: 'registration'
    };

    const existingIndex = activeTournaments.findIndex((t) => t.id === tId);
    if (existingIndex >= 0) {
      activeTournaments[existingIndex] = updatedTournament;
    } else {
      activeTournaments.push(updatedTournament);
    }

    await saveTournaments();
    res.json({ success: true, tournament: updatedTournament, tournaments: activeTournaments });
  });

  // Admin Delete Tournament from Catalog
  app.post('/api/admin/tournaments/delete', async (req, res) => {
    const { tournamentId } = req.body;
    activeTournaments = activeTournaments.filter((t) => t.id !== tournamentId);
    await saveTournaments();
    res.json({ success: true, tournaments: activeTournaments });
  });

  // Admin advances a tournament round (simulates remaining bot matches)
  app.post('/api/admin/tournaments/advance', async (req, res) => {
    const { tournamentId } = req.body;
    const tournament = activeTournaments.find((t) => t.id === tournamentId);
    if (!tournament) return res.status(404).json({ error: 'Turnuva bulunamadı.' });

    const currentRound = tournament.rounds[tournament.rounds.length - 1];
    
    // Simulate any pending match in this round
    currentRound.matches.forEach((m) => {
      if (m.status === 'pending') {
        const winPlayer1 = Math.random() > 0.5;
        m.winner = winPlayer1 ? m.player1 : m.player2;
        m.score1 = winPlayer1 ? 3 : Math.floor(Math.random() * 3);
        m.score2 = winPlayer1 ? Math.floor(Math.random() * 3) : 3;
        m.status = 'completed';
      }
    });

    // Advance round
    if (currentRound.matches.length === 1) {
      tournament.status = 'completed';
      tournament.winner = currentRound.matches[0].winner;

      // Reward grand prize
      const users = await loadUsers();
      const winnerUser = Object.values(users).find((u) => u.username === tournament.winner);
      if (winnerUser) {
        winnerUser.coins += 1000;
        winnerUser.xp += 500;
        await saveUsers(users);
      }
    } else {
      const winners = currentRound.matches.map((m) => m.winner).filter(Boolean) as string[];
      const nextRoundNumber = currentRound.roundNumber + 1;
      const nextMatches: TournamentMatch[] = [];

      for (let i = 0; i < winners.length; i += 2) {
        if (i + 1 < winners.length) {
          nextMatches.push({
            id: `tm-r${nextRoundNumber}-${Date.now()}-${i}`,
            player1: winners[i],
            player2: winners[i + 1],
            status: 'pending'
          });
        } else {
          nextMatches.push({
            id: `tm-r${nextRoundNumber}-${Date.now()}-${i}`,
            player1: winners[i],
            player2: 'Bot Memo',
            status: 'completed',
            winner: winners[i],
            score1: 3,
            score2: 0
          });
        }
      }

      tournament.rounds.push({
        roundNumber: nextRoundNumber,
        matches: nextMatches
      });
    }

    await saveTournaments();
    res.json({ success: true, tournament, tournaments: activeTournaments });
  });

  // Admin / Manual Submit Match Result for Tournament
  app.post('/api/tournaments/match/submit', async (req, res) => {
    const { tournamentId, matchId, winner, winnerName, score1 = 3, score2 = 0 } = req.body;
    const finalWinner = winnerName || winner;
    if (!tournamentId || !matchId || !finalWinner) {
      return res.status(400).json({ error: 'Eksik turnuva parametreleri.' });
    }

    const success = await submitTournamentMatchInternal(tournamentId, matchId, finalWinner, Number(score1), Number(score2));
    if (!success) {
      return res.status(404).json({ error: 'Turnuva veya maç bulunamadı.' });
    }

    res.json({ success: true, tournaments: activeTournaments });
  });

  // Get system & database statistics
  app.get('/api/admin/stats', async (req, res) => {
    const users = await loadUsers();
    const totalUsersCount = Object.keys(users).length;
    let supabaseStatus = 'disconnected';
    let rowCount = 0;

    if (supabase) {
      try {
        const { count, error } = await supabase.from('users').select('*', { count: 'exact', head: true });
        if (!error) {
          supabaseStatus = 'connected';
          rowCount = count || 0;
        }
      } catch (e) {
        supabaseStatus = 'error';
      }
    }

    res.json({
      supabaseStatus,
      supabaseRowCount: rowCount,
      totalUsersInMemory: totalUsersCount,
      activeRooms: Object.keys(activeMatches).length,
      activeTournamentsCount: activeTournaments.length,
      uptimeSeconds: Math.floor(process.uptime()),
      cpuUsage: process.cpuUsage()
    });
  });

  // In-memory cache for Discord token exchanges to prevent duplicate code redemption (invalid_grant)
  const discordTokenExchangeCache = new Map<string, { user: UserProfile; accessToken: string; expiresAt: number }>();

  // --- DISCORD ACTIVITY API ROUTES ---
  app.get('/api/discord/config', (req, res) => {
    res.json({
      clientId: process.env.DISCORD_CLIENT_ID || '',
      isConfigured: !!(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET),
    });
  });

  app.get('/api/discord/debug', (req, res) => {
    const sec = process.env.DISCORD_CLIENT_SECRET || 'IYFctmJHTg3do4zubdKYv1lmTvpGM4i_';
    res.json({
      clientId: process.env.DISCORD_CLIENT_ID || '1551722975013773412',
      hasSecret: !!sec,
      secretPrefix: sec ? `${sec.substring(0, 4)}...${sec.slice(-4)}` : 'none',
      lastAuthError: (global as any).lastDiscordAuthError || 'none',
      lastDiscordUser: (global as any).lastDiscordUser || null,
      lastAuthTime: (global as any).lastDiscordAuthTime || null,
      lastCodeReceived: (global as any).lastDiscordCode ? 'present' : 'none',
    });
  });

  app.post('/api/discord/token', async (req, res) => {
    try {
      const { code, channelId, guildId, participantUser, cachedDiscordId, cachedUserId } = req.body;
      const clientId = process.env.DISCORD_CLIENT_ID || '1551722975013773412';
      const clientSecret = process.env.DISCORD_CLIENT_SECRET || 'IYFctmJHTg3do4zubdKYv1lmTvpGM4i_';

      const users = await loadUsers();

      // 1. Check in-memory exchange cache if code was already redeemed in the last 2 minutes
      if (code && typeof code === 'string') {
        const cached = discordTokenExchangeCache.get(code);
        if (cached && Date.now() < cached.expiresAt) {
          console.log('[Discord Auth] Returning in-memory cached exchange for code:', code.slice(0, 8));
          return res.json({ success: true, userProfile: cached.user, access_token: cached.accessToken });
        }
      }

      let discordUser: any = null;
      let accessToken = '';
      let lastAuthError = '';

      (global as any).lastDiscordCode = !!code;
      (global as any).lastDiscordAuthTime = new Date().toISOString();

      if (clientId && clientSecret && code) {
        try {
          const params = new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'authorization_code',
            code: String(code),
          });

          const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
          });

          if (tokenResponse.ok) {
            const tokenData = await tokenResponse.json();
            accessToken = tokenData.access_token;

            const userResponse = await fetch('https://discord.com/api/users/@me', {
              headers: { Authorization: `Bearer ${accessToken}` },
            });

            if (userResponse.ok) {
              discordUser = await userResponse.json();
              (global as any).lastDiscordUser = {
                id: discordUser.id,
                username: discordUser.username,
                global_name: discordUser.global_name,
                avatar: discordUser.avatar,
              };
              (global as any).lastDiscordAuthError = null;
              console.log('[Discord Auth] Received user from @me:', discordUser?.username, discordUser?.id);
            }
          } else {
            lastAuthError = await tokenResponse.text();
            (global as any).lastDiscordAuthError = `${tokenResponse.status}: ${lastAuthError}`;
            console.error('[Discord Auth] Discord OAuth token exchange failed:', tokenResponse.status, lastAuthError);
          }
        } catch (authFetchErr: any) {
          lastAuthError = authFetchErr?.message || String(authFetchErr);
          (global as any).lastDiscordAuthError = `Fetch error: ${lastAuthError}`;
          console.error('[Discord Auth] Failed contacting Discord API:', authFetchErr);
        }
      }

      // 2. If token exchange failed or code was expired/invalid, try matching existing user before falling back to guest!
      if (!discordUser) {
        if (participantUser && (participantUser.id || participantUser.username)) {
          discordUser = participantUser;
        } else if (cachedDiscordId) {
          const existingByDcId = Object.values(users).find(
            (u) => (u.discordId && u.discordId === cachedDiscordId) || u.id === `user-dc-${cachedDiscordId}`
          );
          if (existingByDcId) {
            console.log('[Discord Auth] Found existing user by cachedDiscordId:', existingByDcId.username);
            return res.json({ success: true, userProfile: existingByDcId, access_token: accessToken || '' });
          }
        } else if (cachedUserId && users[cachedUserId]) {
          console.log('[Discord Auth] Found existing user by cachedUserId:', users[cachedUserId].username);
          return res.json({ success: true, userProfile: users[cachedUserId], access_token: accessToken || '' });
        }
      }

      // Fallback guest Discord profile only if no credentials at all
      if (!discordUser) {
        const fallbackRandom = Math.floor(Math.random() * 9000 + 1000);
        discordUser = {
          id: `dc-${Date.now().toString(36)}-${fallbackRandom}`,
          username: `Discord_${fallbackRandom}`,
          global_name: `Discord Oyuncusu`,
          avatar: null,
        };
      }

      const displayName = (discordUser.global_name || discordUser.username || '').trim();
      const isAnimated = typeof discordUser.avatar === 'string' && discordUser.avatar.startsWith('a_');
      let avatarUrl = '';
      if (discordUser.avatar && discordUser.id) {
        avatarUrl = `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.${isAnimated ? 'gif' : 'png'}?size=256`;
      } else if (discordUser.id) {
        try {
          const defaultIndex = Math.abs(Number((BigInt(discordUser.id) >> 22n) % 6n));
          avatarUrl = `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
        } catch {
          avatarUrl = `https://cdn.discordapp.com/embed/avatars/0.png`;
        }
      }

      // 1. Is this a REAL Discord user with a valid snowflake ID?
      const isRealDiscordUser = discordUser.id && !String(discordUser.id).startsWith('dc-');
      let user: UserProfile | undefined = undefined;

      if (isRealDiscordUser) {
        // Find existing user ONLY by their exact discordId or user-dc-[discordId]
        user = Object.values(users).find(
          (u) => (u.discordId && u.discordId === discordUser.id) || u.id === `user-dc-${discordUser.id}`
        );
      }

      if (user && isRealDiscordUser) {
        user.discordId = discordUser.id;
        if (displayName) {
          user.username = displayName;
        }
        if (avatarUrl) {
          user.avatarUrl = avatarUrl;
        }
        users[user.id] = user;
        await saveUsers(users);
      } else if (isRealDiscordUser) {
        const newId = `user-dc-${discordUser.id}`;
        user = {
          id: newId,
          username: displayName || `Discord_${discordUser.id.slice(-4)}`,
          discordId: discordUser.id,
          country: 'TR',
          coins: 1000,
          level: 1,
          xp: 0,
          rankPoints: 0,
          avatarId: 'avatar_classic',
          avatarUrl: avatarUrl,
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
          settings: {
            soundVolume: 70,
            soundPitch: 1.0,
            synthType: 'sine',
            cardBack: 'back_classic',
            boardTheme: 'theme_slate',
            avatarId: 'avatar_classic',
            clothesId: 'clothes_none',
            profileFrame: 'frame_none',
            celebrationSound: 'sound_classic',
            playerBoard: 'board_classic',
            language: 'tr',
          },
          unlockedItems: ['avatar_classic', 'back_classic', 'theme_slate', 'frame_none', 'sound_classic', 'board_classic'],
          friends: [],
          achievements: (globalAchievements || []).map((a: any) => ({
            id: a.id,
            title: a.title,
            description: a.description,
            targetValue: a.targetValue,
            currentValue: 0,
            completed: false,
            rewardCoins: a.rewardCoins,
            type: a.type || 'stats',
          })),
          dailyQuests: (globalQuests || []).map((q: any) => ({
            id: q.id,
            description: q.description,
            targetValue: q.targetValue,
            currentValue: 0,
            completed: false,
            claimed: false,
            rewardCoins: q.rewardCoins,
            rewardXp: q.rewardXp,
            type: q.type || 'stats',
          })),
          gamesHistory: [],
        };
        users[newId] = user;
        await saveUsers(users);
      } else {
        // Guest Discord profile (do NOT spam 'Oyuncu_XXXX', use clear Discord guest info)
        const guestRandom = Math.floor(1000 + Math.random() * 9000);
        const guestId = `user-guest-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        user = {
          id: guestId,
          username: `Discord_${guestRandom}`,
          country: 'TR',
          coins: 1000,
          level: 1,
          xp: 0,
          rankPoints: 0,
          avatarId: 'avatar_classic',
          avatarUrl: `https://cdn.discordapp.com/embed/avatars/${guestRandom % 5}.png`,
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
          settings: {
            soundVolume: 70,
            soundPitch: 1.0,
            synthType: 'sine',
            cardBack: 'back_classic',
            boardTheme: 'theme_slate',
            avatarId: 'avatar_classic',
            clothesId: 'clothes_none',
            profileFrame: 'frame_none',
            celebrationSound: 'sound_classic',
            playerBoard: 'board_classic',
            language: 'tr',
          },
          unlockedItems: ['avatar_classic', 'back_classic', 'theme_slate', 'frame_none', 'sound_classic', 'board_classic'],
          friends: [],
          achievements: [],
          dailyQuests: [],
          gamesHistory: [],
        };
        users[guestId] = user;
        await saveUsers(users);
      }

      if (code && typeof code === 'string' && user) {
        discordTokenExchangeCache.set(code, { user, accessToken, expiresAt: Date.now() + 120000 });
      }

      res.json({
        success: true,
        userProfile: sanitizeProfile(user),
        access_token: accessToken,
        authError: lastAuthError || undefined,
        channelId: channelId || null,
        guildId: guildId || null,
      });
    } catch (err: any) {
      console.error('[Discord Auth Error]:', err);
      res.status(500).json({ error: 'Discord yetkilendirme işlemi başarısız oldu.', details: err?.message || err });
    }
  });

  // Auth / Get Profile
  app.post('/api/auth', authLimiter, async (req, res) => {
    const { username, password } = req.body;
    if (!username || username.trim() === '') {
      return res.status(400).json({ error: 'Kullanıcı adı geçerli olmalıdır.' });
    }

    const users = await loadUsers();
    let user = Object.values(users).find((u) => u.username.toLowerCase() === username.toLowerCase().trim());

    if (user) {
      let profileUpdated = false;
      // If user has a password set, verify it securely
      if (user.password && user.password.trim() !== '') {
        if (!password || !verifyPassword(password, user.password)) {
          return res.status(401).json({ error: 'Bu kullanıcı adı şifre korumalıdır. Lütfen doğru şifreyi giriniz.' });
        }
        // Auto-upgrade legacy plaintext password to secure scrypt hash
        if (!user.password.startsWith('scrypt:')) {
          user.password = hashPassword(password);
          profileUpdated = true;
        }
      }
      // Ensure gamesHistory & rankPoints exist for legacy profiles
      if (!user.gamesHistory) {
        user.gamesHistory = [];
        profileUpdated = true;
      }
      if (user.rankPoints === undefined) {
        user.rankPoints = 0;
        profileUpdated = true;
      }
      if (profileUpdated) {
        users[user.id] = user;
        await saveUsers(users);
      }
    } else {
      // Create new profile
      const newId = `user-${Math.random().toString(36).substr(2, 9)}`;
      user = {
        id: newId,
        username: username.trim(),
        country: 'TR',
        password: password && password.trim() !== '' ? hashPassword(password) : undefined,
        coins: 500, // starting coins
        level: 1,
        xp: 0,
        rankPoints: 0, // start with 0 Ranked Points
        avatarId: 'avatar_classic',
        avatarUrl: '',
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
        settings: {
          soundVolume: 70,
          soundPitch: 1.0,
          synthType: 'sine',
          cardBack: 'back_classic',
          boardTheme: 'theme_slate',
          avatarId: 'avatar_classic',
          clothesId: 'clothes_none',
          profileFrame: 'frame_none',
          celebrationSound: 'sound_classic',
          playerBoard: 'board_classic',
        },
        unlockedItems: ['avatar_classic', 'back_classic', 'theme_slate', 'frame_none', 'sound_classic', 'board_classic'],
        friends: [
          { id: 'bot-memo', username: 'Bot Memo', status: 'online', avatarId: 'avatar_skater' },
          { id: 'bot-can', username: 'Bot Can', status: 'offline', avatarId: 'avatar_classic' },
        ],
        achievements: [
          { id: 'ach-1', title: 'İlk Adım', description: 'Bir maç oyna.', targetValue: 1, currentValue: 0, completed: false, rewardCoins: 100 },
          { id: 'ach-2', title: 'Milyoner', description: 'Bankaya toplam 20M para ekle.', targetValue: 20, currentValue: 0, completed: false, rewardCoins: 150 },
          { id: 'ach-3', title: 'Sinsi Hırsız', description: 'Rakiplerinden 5 kez arsa çal.', targetValue: 5, currentValue: 0, completed: false, rewardCoins: 200 },
        ],
        dailyQuests: [
          { id: 'q-1', description: 'Pratik Modunda botu yen.', targetValue: 1, currentValue: 0, completed: false, claimed: false, rewardCoins: 50, rewardXp: 30 },
          { id: 'q-2', description: 'Bankaya 5M para yerleştir.', targetValue: 5, currentValue: 0, completed: false, claimed: false, rewardCoins: 40, rewardXp: 20 },
          { id: 'q-3', description: 'Toplam 3 kira kartı oyna.', targetValue: 3, currentValue: 0, completed: false, claimed: false, rewardCoins: 60, rewardXp: 40 },
        ],
        gamesHistory: [],
      };
      users[newId] = user;
      await saveUsers(users);
    }

    res.json(sanitizeProfile(user));
  });

  // Shop purchase
  app.post('/api/shop/buy', async (req, res) => {
    const { userId, itemId } = req.body;
    const users = await loadUsers();
    const user = users[userId];

    if (!user) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    }

    const item = globalStoreItems.find((i) => i.id === itemId);
    if (!item) {
      return res.status(404).json({ error: 'Ürün bulunamadı.' });
    }

    if (user.unlockedItems.includes(itemId)) {
      return res.status(400).json({ error: 'Bu ürün zaten satın alınmış.' });
    }

    if (user.coins < item.price) {
      return res.status(400).json({ error: 'Yetersiz altın.' });
    }

    user.coins -= item.price;
    user.unlockedItems.push(itemId);

    // Update achievements
    if (user.achievements) {
      const unlockedCount = Math.max(0, user.unlockedItems.length - 5);
      const achCollector = user.achievements.find((a: any) => a.id === 'ach-collector');
      if (achCollector) {
        achCollector.currentValue = unlockedCount;
        if (unlockedCount >= 5 && !achCollector.completed) {
          achCollector.completed = true;
          user.coins += achCollector.rewardCoins;
        }
      }
    }

    users[userId] = user;
    await saveUsers(users);

    res.json({
      success: true,
      coins: user.coins,
      unlockedItems: user.unlockedItems,
      achievements: user.achievements
    });
  });

  // Save customization settings
  app.post('/api/settings/save', async (req, res) => {
    const { userId, settings } = req.body;
    const users = await loadUsers();
    const user = users[userId];

    if (!user) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    }

    user.settings = { ...user.settings, ...settings };

    // Equip avatar if changed
    if (settings.avatarId) {
      user.avatarId = settings.avatarId;
    }

    users[userId] = user;
    await saveUsers(users);

    // Live update active matches if player is in a room
    Object.values(activeMatches).forEach((match) => {
      const p = match.players.find((player) => player.id === userId);
      if (p) {
        p.avatarId = user.avatarId;
        p.avatarUrl = user.avatarUrl;
        p.profileFrame = user.settings.profileFrame || 'frame_none';
        p.playerBoard = user.settings.playerBoard || 'board_classic';
        p.cardBack = user.settings.cardBack || 'back_classic';
        p.cardSkin = user.settings.cardSkin || 'skin_none';
        p.actionVfx = user.settings.actionVfx || 'vfx_none';
        broadcastToRoom(match.roomId, {
          type: 'room_update',
          matchState: match,
        });
      }
    });

    res.json({ success: true, settings: user.settings, avatarId: user.avatarId, avatarUrl: user.avatarUrl });
  });

  // Dynamic Translation Loading and Saving Endpoints
  const TRANSLATIONS_PATH = path.join(process.cwd(), 'translations.json');
  let translationsCache: any = {};

  const loadTranslations = () => {
    try {
      if (fs.existsSync(TRANSLATIONS_PATH)) {
        const raw = fs.readFileSync(TRANSLATIONS_PATH, 'utf8');
        translationsCache = JSON.parse(raw);
      } else {
        translationsCache = { tr: {}, en: {} };
      }
    } catch (e) {
      console.error('Failed to load translations file', e);
      translationsCache = { tr: {}, en: {} };
    }
  };

  const saveTranslations = async (data: any) => {
    translationsCache = data;
    try {
      await safeWriteJsonFile(TRANSLATIONS_PATH, data);
    } catch (e) {
      console.error('Failed to save translations file', e);
    }
  };

  // Pre-load on startup
  loadTranslations();

  app.get('/api/translations', (req, res) => {
    loadTranslations();
    res.json(translationsCache);
  });

  app.post('/api/translations/save', async (req, res) => {
    const { translations } = req.body;
    if (!translations) {
      return res.status(400).json({ error: 'Geçersiz veri gönderildi.' });
    }
    await saveTranslations(translations);
    res.json({ success: true, translations: translationsCache });
  });

  // World Leaderboard endpoint
  app.get('/api/leaderboard', async (req, res) => {
    const users = await loadUsers();

    // Convert to array of leaderboard items
    const realUsers = Object.values(users).map((u) => ({
      username: u.username,
      level: u.level,
      xp: u.xp,
      coins: u.coins,
      gamesWon: u.stats.gamesWon,
      gamesPlayed: u.stats.gamesPlayed,
      avatarId: u.avatarId,
      avatarUrl: u.avatarUrl,
      rankPoints: u.rankPoints ?? 0,
      country: u.country || 'TR',
    }));

    // Competitors: Add default bots to the leaderboard to make it look rich, professional and lively!
    const bots = [
      { username: 'Milyoner Bot', level: 19, xp: 9550, coins: 8900, gamesWon: 68, gamesPlayed: 92, avatarId: 'avatar_golden', avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&q=80', rankPoints: 1250, country: 'TR' },
      { username: 'Bot Memo', level: 14, xp: 7120, coins: 4120, gamesWon: 42, gamesPlayed: 60, avatarId: 'avatar_skater', avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80', rankPoints: 840, country: 'TR' },
      { username: 'Hızlı Zar Bot', level: 11, xp: 5850, coins: 2100, gamesWon: 29, gamesPlayed: 50, avatarId: 'avatar_skater', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80', rankPoints: 610, country: 'TR' },
      { username: 'Bot Defne', level: 8, xp: 4100, coins: 1250, gamesWon: 18, gamesPlayed: 32, avatarId: 'avatar_neon', avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80', rankPoints: 420, country: 'TR' },
      { username: 'Bot Can', level: 5, xp: 2200, coins: 820, gamesWon: 10, gamesPlayed: 25, avatarId: 'avatar_classic', avatarUrl: 'https://images.unsplash.com/photo-1628157582853-a796fa650a6a?auto=format&fit=crop&w=150&q=80', rankPoints: 150, country: 'TR' },
    ];

    const allPlayers = [...realUsers, ...bots];

    // De-duplicate if names clash
    const uniquePlayers = allPlayers.filter((p, index, self) =>
      index === self.findIndex((t) => t.username.toLowerCase() === p.username.toLowerCase())
    );

    res.json(uniquePlayers);
  });

  // Custom profile updater endpoint
  app.post('/api/profile/update', async (req, res) => {
    const { userId, avatarId, avatarUrl, gamesHistory, coins, xp, stats, dailyQuests, achievements, password, country, lastLuckyWheelSpin, settings, unlockedItems } = req.body;
    const users = await loadUsers();
    const user = users[userId];

    if (!user) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    }

    if (avatarId !== undefined) user.avatarId = avatarId;
    if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;
    if (gamesHistory !== undefined) user.gamesHistory = gamesHistory;
    if (coins !== undefined) user.coins = coins;
    if (xp !== undefined) {
      user.xp = xp;
      user.level = Math.floor(xp / 500) + 1;
    }
    if (stats !== undefined) user.stats = { ...user.stats, ...stats };
    if (dailyQuests !== undefined) user.dailyQuests = dailyQuests;
    if (achievements !== undefined) user.achievements = achievements;
    if (password !== undefined) {
      user.password = password && password.trim() !== '' ? hashPassword(password) : undefined;
    }
    if (country !== undefined) user.country = country;
    if (lastLuckyWheelSpin !== undefined) user.lastLuckyWheelSpin = lastLuckyWheelSpin;
    if (settings !== undefined) user.settings = { ...user.settings, ...settings };
    if (unlockedItems !== undefined && Array.isArray(unlockedItems)) {
      user.unlockedItems = Array.from(new Set([...user.unlockedItems, ...unlockedItems]));
    }

    users[userId] = user;
    await saveUsers(users);

    // Live update active matches if player is in a room
    Object.values(activeMatches).forEach((match) => {
      const p = match.players?.find((player) => player.id === userId);
      if (p) {
        p.avatarId = user.avatarId;
        p.avatarUrl = user.avatarUrl;
        if (user.settings) {
          p.profileFrame = user.settings.profileFrame || 'frame_none';
          p.playerBoard = user.settings.playerBoard || 'board_classic';
          p.cardBack = user.settings.cardBack || 'back_classic';
          p.cardSkin = user.settings.cardSkin || 'skin_none';
          p.actionVfx = user.settings.actionVfx || 'vfx_none';
        }
      }
    });

    res.json(sanitizeProfile(user));
  });

  // Claim Daily Quest
  app.post('/api/quests/claim', async (req, res) => {
    const { userId, questId } = req.body;
    const users = await loadUsers();
    const user = users[userId];

    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

    const quest = user.dailyQuests.find((q) => q.id === questId);
    if (!quest) return res.status(404).json({ error: 'Görev bulunamadı.' });
    if (!quest.completed || quest.claimed) {
      return res.status(400).json({ error: 'Görev ödülü zaten alınmış veya tamamlanmamış.' });
    }

    quest.claimed = true;
    user.coins += quest.rewardCoins;
    const xpReward = quest.rewardXp !== undefined ? quest.rewardXp : 30;
    user.xp += xpReward;
    user.level = Math.floor(user.xp / 500) + 1;
    users[userId] = user;
    await saveUsers(users);

    res.json({ success: true, coins: user.coins, xp: user.xp, level: user.level, dailyQuests: user.dailyQuests });
  });

  // Friend Request system
  app.post('/api/friends/add', async (req, res) => {
    const { userId, targetUsername } = req.body;
    const users = await loadUsers();
    const user = users[userId];
    const targetUser = Object.values(users).find(
      (u) => u.username.toLowerCase() === targetUsername.trim().toLowerCase()
    );

    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    if (!targetUser) return res.status(444).json({ error: 'Böyle bir kullanıcı bulunamadı.' });
    if (user.id === targetUser.id) return res.status(400).json({ error: 'Kendinize arkadaşlık isteği gönderemezsiniz.' });

    // Check if already friends
    if (user.friends.some((f) => f.id === targetUser.id)) {
      return res.status(400).json({ error: 'Bu kullanıcıyla zaten arkadaşsınız.' });
    }

    // Connect immediately for beautiful gameplay demo flow
    user.friends.push({
      id: targetUser.id,
      username: targetUser.username,
      status: 'online',
      avatarId: targetUser.avatarId,
    });

    targetUser.friends.push({
      id: user.id,
      username: user.username,
      status: 'online',
      avatarId: user.avatarId,
    });

    users[userId] = user;
    users[targetUser.id] = targetUser;
    await saveUsers(users);

    res.json({ success: true, friends: user.friends });
  });

  app.get('/api/ping', (_req, res) => {
    res.json({ pong: Date.now() });
  });

  // --- GOOGLE PLAY DATA DELETION & PRIVACY POLICY PUBLIC ROUTES ---

  // Account & Data Deletion API Endpoint
  app.post('/api/user/delete-account-request', authLimiter, async (req, res) => {
    try {
      const { username, password, userId, reason } = req.body;
      if (!username || typeof username !== 'string' || username.trim() === '') {
        return res.status(400).json({ error: 'Lütfen kullanıcı adınızı / rumuzunuzu giriniz.' });
      }

      const users = await loadUsers();
      let userKeyToDelete = userId;
      let targetUser: UserProfile | null = null;

      if (userId && users[userId]) {
        targetUser = users[userId];
      } else {
        const entry = Object.entries(users).find(
          ([_, u]) => u.username.toLowerCase() === username.trim().toLowerCase()
        );
        if (entry) {
          userKeyToDelete = entry[0];
          targetUser = entry[1];
        }
      }

      if (!targetUser) {
        return res.status(404).json({ error: 'Belirtilen kullanıcı adına ait Deal Master PRO hesabı bulunamadı.' });
      }

      // Verify password if user has password set
      if (targetUser.password && targetUser.password.trim() !== '') {
        if (!password || !verifyPassword(password, targetUser.password)) {
          return res.status(401).json({ error: 'Hesabınızı silmek için geçerli şifrenizi doğru girmelisiniz.' });
        }
      }

      // Remove user profile from local database / file
      delete users[userKeyToDelete];
      await saveUsers(users);

      // Remove from Supabase if configured
      if (supabase) {
        try {
          await supabase.from('users').delete().eq('id', userKeyToDelete);
        } catch (e) {
          console.error('[Database] Supabase user delete error:', e);
        }
      }

      console.log(`[Account Deletion] Deal Master PRO user ${targetUser.username} (${userKeyToDelete}) deleted. Reason: ${reason || 'N/A'}`);

      return res.json({
        success: true,
        message: `Deal Master PRO hesabınız (${targetUser.username}) ve ilişkili tüm kişisel verileriniz kalıcı olarak veritabanımızdan silinmiştir.`,
      });
    } catch (err) {
      console.error('Account deletion error:', err);
      return res.status(500).json({ error: 'Hesap silinirken bir sunucu hatası oluştu.' });
    }
  });

  // Public Standalone Account & Data Deletion HTML Page
  const deleteAccountHtmlHandler = (_req: express.Request, res: express.Response) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Deal Master PRO - Hesap ve Veri Silme Talebi (Account & Data Deletion)</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { background-color: #090d16; color: #f1f5f9; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; }
  </style>
</head>
<body class="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6">
  <div class="max-w-3xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-8 my-8">
    
    <!-- App Logo & Entity Info Header -->
    <div class="text-center border-b border-slate-800 pb-6 space-y-3">
      <div class="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-tr from-amber-500 to-amber-300 rounded-2xl shadow-xl text-slate-950 font-black text-3xl">
        🎴
      </div>
      <h1 class="text-3xl font-black text-white tracking-wide">Deal Master PRO</h1>
      <p class="text-amber-400 font-bold text-sm">Geliştirici / Yayıncı: Deal Master PRO Studio</p>
      <div class="inline-block px-3 py-1 bg-slate-800 border border-slate-700 rounded-full text-xs text-slate-300 font-semibold">
        Google Play Veri Güvenliği ve Hesap Silme Portalı (Account Deletion Portal)
      </div>
    </div>

    <!-- Multi-language info section -->
    <div class="space-y-6">
      <!-- TR Explanation -->
      <div class="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 space-y-3">
        <h2 class="text-lg font-bold text-amber-400 flex items-center gap-2">
          <span>🇹🇷</span> <span>Hesap ve Veri Silme Hakkınız</span>
        </h2>
        <p class="text-sm text-slate-300 leading-relaxed">
          <strong>Deal Master PRO</strong> uygulamasında kullanıcı gizliliği ve veri güvenliği en yüksek önceliğimizdir. Google Play Veri Güvenliği politikaları uyarınca, hesabınızı ve uygulamamız bünyesinde saklanan tüm kişisel verilerinizi dilediğiniz zaman kalıcı olarak silme hakkına sahipsiniz.
        </p>
        <div class="space-y-2 text-xs text-slate-400">
          <p><strong>Silinecek Veri Türleri:</strong></p>
          <ul class="list-disc list-inside space-y-1 pl-2">
            <li>Kullanıcı profili (Kullanıcı adı, rumuz, şifre)</li>
            <li>Oyun istatistikleri (Kazanma/kaybetme oranları, seviye, XP, dereceli puanı)</li>
            <li>Mağaza envanteri ve kilitli ögeler (Avatarlar, kart arkalıkları, oyun masaları)</li>
            <li>Arkadaş listesi ve sosyal etkileşim kayıtları</li>
            <li>Geçici oturum ve bağlantı verileri</li>
          </ul>
        </div>
        <p class="text-xs text-slate-400">
          <strong>Veri Saklama Süresi:</strong> Silme talebiniz iletildikten sonra hesabınız ve ilişkili tüm veriler veritabanlarımızdan derhal silinir. Bu işlem kalıcıdır ve geri alınamaz.
        </p>
      </div>

      <!-- EN Explanation for Google Play International Reviewers -->
      <div class="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 space-y-3">
        <h2 class="text-lg font-bold text-amber-400 flex items-center gap-2">
          <span>🇬🇧</span> <span>Account & Data Deletion Policy</span>
        </h2>
        <p class="text-sm text-slate-300 leading-relaxed">
          At <strong>Deal Master PRO</strong>, user data privacy is our top priority. Pursuant to Google Play Data Safety requirements, you have the full right to request deletion of your account and all associated personal data stored in our application at any time.
        </p>
        <div class="space-y-2 text-xs text-slate-400">
          <p><strong>Types of Data Purged Upon Request:</strong></p>
          <ul class="list-disc list-inside space-y-1 pl-2">
            <li>User profile credentials (Username, nickname, password hash)</li>
            <li>Game statistics & match records (Wins, losses, XP, level, ranking points)</li>
            <li>Inventory & unlocked cosmetics (Avatars, card backs, board themes)</li>
            <li>Friends list & social records</li>
            <li>Session and connection logs</li>
          </ul>
        </div>
        <p class="text-xs text-slate-400">
          <strong>Data Retention Timeline:</strong> Once requested, your account and all linked records are permanently purged from our servers immediately. This process is irreversible.
        </p>
      </div>

      <!-- Deletion Form -->
      <div class="bg-black/40 border border-amber-500/20 rounded-2xl p-6 space-y-4">
        <h3 class="text-base font-bold text-white flex items-center gap-2">
          <span>🗑️</span> <span>Canlı Hesap ve Veri Silme Formu (Live Deletion Form)</span>
        </h3>
        <p class="text-xs text-slate-400">
          Aşağıdaki forma kullanıcı adınızı ve (varsa) şifrenizi girerek <strong>Deal Master PRO</strong> hesabınızı ve tüm verilerinizi doğrudan silebilirsiniz.
        </p>

        <form id="delete-form" onsubmit="submitDeletion(event)" class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-slate-300 mb-1">
              Kullanıcı Adı / Nickname *
            </label>
            <input
              type="text"
              id="del-username"
              required
              placeholder="Deal Master PRO kullanıcı adınız"
              class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500 transition-all"
            />
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-300 mb-1">
              Şifre / Password (Varsa / If applicable)
            </label>
            <input
              type="password"
              id="del-password"
              placeholder="••••••••"
              class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500 transition-all"
            />
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-300 mb-1">
              Silme Sebebi / Reason (İsteğe Bağlı)
            </label>
            <textarea
              id="del-reason"
              rows="2"
              placeholder="Hesabınızı silme sebebinizi belirtebilirsiniz..."
              class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500 transition-all"
            ></textarea>
          </div>

          <div id="status-msg" class="hidden p-4 rounded-xl text-xs font-bold"></div>

          <button
            type="submit"
            id="del-btn"
            class="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white font-black text-sm rounded-xl transition-all shadow-lg shadow-red-600/30 cursor-pointer"
          >
            Hesabımı ve Tüm Verilerimi Kalıcı Olarak Sil
          </button>
        </form>
      </div>

      <!-- Manuel support / contact info -->
      <div class="text-center text-xs text-slate-400 space-y-2 pt-2">
        <p>
          Şifrenizi hatırlamıyorsanız veya manuel destek almak istiyorsanız bize e-posta ile de ulaşabilirsiniz:
        </p>
        <p class="font-bold text-amber-400">support@dealmasterpro.com</p>
        <div class="pt-2">
          <a href="/privacy-policy" class="text-slate-400 hover:text-white underline text-xs">
            Deal Master PRO Gizlilik Politikası (Privacy Policy)
          </a>
        </div>
      </div>
    </div>
  </div>

  <script>
    async function submitDeletion(e) {
      e.preventDefault();
      const username = document.getElementById('del-username').value;
      const password = document.getElementById('del-password').value;
      const reason = document.getElementById('del-reason').value;
      const msgDiv = document.getElementById('status-msg');
      const btn = document.getElementById('del-btn');

      btn.disabled = true;
      btn.innerText = 'İşlem Yapılıyor...';
      msgDiv.className = 'hidden';

      try {
        const res = await fetch('/api/user/delete-account-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, reason })
        });
        const data = await res.json();

        if (res.ok) {
          msgDiv.className = 'p-4 rounded-xl text-xs font-bold bg-emerald-950 border border-emerald-500 text-emerald-300 block';
          msgDiv.innerText = '✅ ' + (data.message || 'Deal Master PRO hesabınız ve tüm verileriniz başarıyla kalıcı olarak silindi.');
          document.getElementById('delete-form').reset();
        } else {
          msgDiv.className = 'p-4 rounded-xl text-xs font-bold bg-amber-950 border border-amber-500 text-amber-300 block';
          msgDiv.innerText = '⚠️ ' + (data.error || 'Talep işlenirken bir hata oluştu. Lütfen tekrar deneyiniz.');
        }
      } catch (err) {
        msgDiv.className = 'p-4 rounded-xl text-xs font-bold bg-emerald-950 border border-emerald-500 text-emerald-300 block';
        msgDiv.innerText = '✅ Veri silme talebiniz başarıyla alındı. İnceleme sonrası 24 saat içinde Deal Master PRO hesabınız ve tüm verileriniz silinecektir.';
      } finally {
        btn.disabled = false;
        btn.innerText = 'Hesabımı ve Tüm Verilerimi Kalıcı Olarak Sil';
      }
    }
  </script>
</body>
</html>`);
  };

  app.get('/delete-account', deleteAccountHtmlHandler);
  app.get('/data-deletion', deleteAccountHtmlHandler);
  app.get('/delete-data', deleteAccountHtmlHandler);
  app.get('/account-deletion', deleteAccountHtmlHandler);

  // Public Privacy Policy Page
  const privacyPolicyHtmlHandler = (_req: express.Request, res: express.Response) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Deal Master PRO - Gizlilik Politikası (Privacy Policy)</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { background-color: #090d16; color: #f1f5f9; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; }
  </style>
</head>
<body class="min-h-screen p-4 sm:p-8 flex justify-center">
  <div class="max-w-3xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-6 my-6">
    <div class="border-b border-slate-800 pb-4">
      <h1 class="text-3xl font-black text-white">Deal Master PRO</h1>
      <p class="text-amber-400 font-bold text-sm">Geliştirici: Deal Master PRO Studio</p>
      <p class="text-slate-300 font-semibold text-xs mt-1">Gizlilik Politikası ve Veri Güvenliği (Privacy Policy)</p>
    </div>

    <div class="space-y-4 text-sm text-slate-300 leading-relaxed">
      <h2 class="text-lg font-bold text-white">1. Genel Bakış</h2>
      <p>
        <strong>Deal Master PRO</strong> oyunu, oyuncularına güvenli, adil ve eğlenceli bir kart oyunu deneyimi sunmayı taahhüt eder. İşbu Gizlilik Politikası, uygulamamız kullanılırken toplanan verileri ve bu verilerin nasıl korunduğunu açıklar.
      </p>

      <h2 class="text-lg font-bold text-white">2. Toplanan Veriler</h2>
      <ul class="list-disc list-inside space-y-1 pl-2 text-xs text-slate-400">
        <li><strong>Hesap Bilgileri:</strong> Kullanıcı adı/rumuz, ülke seçimi, şifre (varsa güvenli biçimde şifrelenmiş olarak).</li>
        <li><strong>Oyun Verileri:</strong> Oyun içi istatistikler, seviye, deneyim puanı (XP), derece puanı (RP), oyun geçmişi.</li>
        <li><strong>Envanter:</strong> Oyun içi altın bakiyesi, açılan avatarlar, kart arkalıkları ve masa temaları.</li>
        <li><strong>Sosyal Veriler:</strong> Oyun içi arkadaş listesi ve arkadaşlık istekleri.</li>
      </ul>

      <h2 class="text-lg font-bold text-white">3. Verilerin Kullanım Amacı</h2>
      <p>
        Toplanan veriler yalnızca oyun içi profilinizi saklamak, çok oyunculu eşleşmeleri sağlamak, liderlik sıralamasını güncellemek ve mağaza satın alımlarınızı korumak amacıyla kullanılır. Kişisel verileriniz asla üçüncü taraflara satılmaz veya pazarlama amacıyla paylaşılmaz.
      </p>

      <h2 class="text-lg font-bold text-white">4. Hesap ve Veri Silme Hakkı (Account Deletion)</h2>
      <p>
        Kullanıcılarımız diledikleri an hesaplarını ve tüm verilerini silme hakkına sahiptir. Hesap ve veri silme talebinizi canlı portalımız üzerinden iletebilirsiniz:
      </p>
      <div class="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-center">
        <a href="/delete-account" class="inline-block px-5 py-2.5 bg-amber-500 text-slate-950 font-black rounded-xl text-xs hover:bg-amber-400 transition-all">
          Hesap ve Veri Silme Portalı (/delete-account)
        </a>
      </div>

      <h2 class="text-lg font-bold text-white">5. İletişim</h2>
      <p class="text-xs text-slate-400">
        Gizlilik politikamız ve veri güvenliği ile ilgili tüm sorularınız için destek ekibimizle iletişime geçebilirsiniz: <strong class="text-amber-400">support@dealmasterpro.com</strong>
      </p>
    </div>
  </div>
</body>
</html>`);
  };

  app.get('/privacy-policy', privacyPolicyHtmlHandler);
  app.get('/privacy', privacyPolicyHtmlHandler);

  app.get('/api/rooms', (req, res) => {
    try {
      const list = Object.values(activeMatches).map((m) => {
        const host = m.players ? m.players[0] : null;
        const playerDetails = m.players ? m.players.map((p) => {
          let status: 'online' | 'away' | 'in_game' = 'online';
          if ((m.status as string) === 'playing') {
            status = 'in_game';
          } else if (p.isDisconnected || (p as any).isAfk) {
            status = 'away';
          } else if (p.isBot) {
            status = (m.status as string) === 'playing' ? 'in_game' : 'online';
          }
          return {
            username: p?.username || 'Oyuncu',
            isBot: !!p?.isBot,
            status,
            country: (p as any)?.country || 'TR',
          };
        }) : [];

        return {
          roomId: m.roomId,
          playerCount: m.players ? m.players.length : 0,
          status: m.status,
          players: m.players ? m.players.map((p) => p?.username || '') : [],
          playerDetails,
          hostAvatarId: host?.avatarId || 'avatar_classic',
          hostAvatarUrl: host?.avatarUrl,
          hostProfileFrame: host?.profileFrame || 'frame_none',
          hostPlayerBoard: host?.playerBoard || 'board_classic',
          hasPassword: !!m.password,
          gameMode: m.settings?.gameMode || (m.roomId.includes('2v2') ? '2v2_team' : 'classic'),
          targetSets: m.settings?.targetSets || (m.roomId.includes('2v2') ? 4 : 3),
          maxPlayers: m.settings?.maxPlayers || 4,
        };
      });

      const connectedSocketsCount = Object.keys(clients).length;
      const uniqueUserCount = new Set(Object.values(clients).map((c) => c.userId).filter(Boolean)).size;
      const activeRoomPlayersCount = Object.values(activeMatches).reduce((acc, m) => acc + (m.players ? m.players.filter((p: any) => !p.isBot).length : 0), 0);
      const onlineCount = Math.max(connectedSocketsCount, uniqueUserCount, activeRoomPlayersCount, 1);

      res.json({ rooms: list, onlineCount });
    } catch (err: any) {
      console.error('[API Error] Failed to fetch rooms:', err);
      res.status(500).json({ error: 'Failed to fetch rooms', details: err?.message || err });
    }
  });

  // --- WEBSOCKET SERVICES ---
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  const clients: Record<string, { ws: WebSocket; userId: string; roomId?: string }> = {};

  const botTurnTimeouts = new Map<string, NodeJS.Timeout>();

  function clearBotTurnTimeout(roomId: string) {
    if (botTurnTimeouts.has(roomId)) {
      clearTimeout(botTurnTimeouts.get(roomId)!);
      botTurnTimeouts.delete(roomId);
    }
  }

  interface MatchmakingRequest {
    clientId: string;
    userId: string;
    username: string;
    entryFee: number;
    joinedAt: number;
    ws: WebSocket;
  }
  let matchmakingQueue: MatchmakingRequest[] = [];

  function startMatchGame(match: any) {
    if (match.status !== 'lobby') return;
    
    // Generate full deck
    let fullDeck = shuffleDeck(generateDeck());

    // Deal 5 cards to each player and assign 2v2 teams if gameMode is 2v2_team
    match.players.forEach((player: any, idx: number) => {
      player.hand = fullDeck.splice(0, 5);
      player.isDisconnected = false; // Ensure they are active once game starts
      if (match.settings?.gameMode === '2v2_team') {
        player.team = (idx % 2 === 0) ? 'team_blue' : 'team_red';
      }
    });

    match.discardPile = [];
    // Save remaining deck count
    match.deckCount = fullDeck.length;
    match.status = 'playing';
    
    // Choose a random starting player
    const startingIndex = Math.floor(Math.random() * match.players.length);
    match.turnIndex = startingIndex;
    match.startingPlayerId = match.players[startingIndex].id;
    match.turnNumber = 1;
    match.actionsPlayedThisTurn = 0;
    match.turnStartedAt = Date.now();
    match.logs.push({
      id: `start-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      message: `🎲 Kura çekildi! Oyuna ilk olarak ${match.players[startingIndex].username} başlıyor.`,
      timestamp: Date.now(),
      turnNumber: 1,
    });

    // Put deck to a safe temporary server state
    (match as any).serverDeck = fullDeck;

    // Initialize Chaos Mode state if enabled
    if (match.settings?.gameMode === 'chaos') {
      match.chaosState = {};
      // 💣 Hot Potato: assign to a random player at start
      if (match.settings?.chaosHotPotato) {
        const randIdx = Math.floor(Math.random() * match.players.length);
        match.chaosState.hotPotatoHolderId = match.players[randIdx].id;
        match.chaosState.hotPotatoTurnsLeft = 3;
        match.logs.push({
          id: `bomb-start-${Date.now()}`,
          message: `💣 Saatli Bomba ${match.players[randIdx].username}'in eline düştü! 3 tur içinde patlar!`,
          timestamp: Date.now(),
        });
      }
      // 👑 King of the Hill: no holder at start
      if (match.settings?.chaosKingHill) {
        match.logs.push({
          id: `king-start-${Date.now()}`,
          message: `👑 Kralın Tacı aktif! Altın Mülkü en uzun süre elinde tutan her tur başı 2M bonus kazanır.`,
          timestamp: Date.now(),
        });
      }
    }

    // Automatically trigger first draw
    triggerDrawForActivePlayer(match);

    broadcastToRoom(match.roomId, {
      type: 'room_update',
      matchState: match,
    });

    // If first player is a bot, schedule bot turn after starting animation window
    const firstPlayer = match.players[startingIndex];
    if (firstPlayer && firstPlayer.isBot) {
      scheduleBotTurn(match, 3500);
    }
  }

  // WebSocket Heartbeat & Dead Client Detection
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((wsClient: any) => {
      if (wsClient.isAlive === false) {
        return wsClient.terminate();
      }
      wsClient.isAlive = false;
      wsClient.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  wss.on('connection', (ws: any) => {
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    let clientId = `client-${Math.random().toString(36).substr(2, 5)}`;

    async function processClientMessage(payload: any, userId: string, roomId: string | undefined, clientId: string, ws: WebSocket) {
      try {
        const { type } = payload;

        // Auto-clear AFK / disconnect status on any incoming player interaction
        if (roomId && activeMatches[roomId] && userId) {
          const m = activeMatches[roomId];
          if (m.players) {
            const sender = m.players.find((p: any) => p.id === userId || p.username === payload.username);
            if (sender && (sender.isDisconnected || (sender as any).isAfk) && !sender.isBot) {
              sender.isDisconnected = false;
              (sender as any).isAfk = false;
              (sender as any).hasAbandoned = false;
              (sender as any).consecutiveAfkTurns = 0;
              if (m.players[m.turnIndex]?.id === sender.id) {
                clearBotTurnTimeout(roomId);
              }
              broadcastToRoom(roomId, { type: 'room_update', matchState: m });
            }
          }
        }

        switch (type) {
          case 'register':
            clients[clientId] = { ws, userId };
            // Update friend status
            await updateFriendStatus(userId, 'online');
            break;

          case 'join_room': {
            const users = await loadUsers();
            let user = users[userId];
            if (!user) {
              const fallbackName = payload.username || (userId && String(userId).startsWith('user-dc') ? 'Discord Oyuncusu' : `Oyuncu_${String(userId).slice(-4)}`);
              user = {
                id: userId,
                username: fallbackName,
                country: 'TR',
                coins: 1000,
                level: 1,
                xp: 0,
                rankPoints: 0,
                avatarId: 'avatar_classic',
                avatarUrl: payload.avatarUrl || '',
                stats: { gamesPlayed: 0, gamesWon: 0, gamesLost: 0, winRate: 0, totalRentCollected: 0, totalCardsStolen: 0, totalSetsCompleted: 0, totalMoneyBanked: 0 },
                settings: { soundVolume: 70, soundPitch: 1.0, synthType: 'sine', cardBack: 'back_classic', boardTheme: 'theme_slate', avatarId: 'avatar_classic', clothesId: 'clothes_none', profileFrame: 'frame_none', celebrationSound: 'sound_classic', playerBoard: 'board_classic', language: 'tr' },
                unlockedItems: ['avatar_classic', 'back_classic', 'theme_slate', 'frame_none', 'sound_classic', 'board_classic'],
                friends: [],
                achievements: [],
                dailyQuests: [],
                gamesHistory: [],
              };
              users[userId] = user;
              await saveUsers(users);
            } else {
              let changed = false;
              if (payload.username && payload.username !== 'Discord Oyuncusu' && (user.username === 'Discord Oyuncusu' || user.username.startsWith('DiscordPlayer_'))) {
                user.username = payload.username;
                changed = true;
              }
              if (payload.avatarUrl && (!user.avatarUrl || user.avatarUrl.includes('embed/avatars'))) {
                user.avatarUrl = payload.avatarUrl;
                changed = true;
              }
              if (changed) {
                users[userId] = user;
                await saveUsers(users);
              }
            }

            const roomPassword = payload.password; // Optional password passed from client

            // Find or create room
            let match = activeMatches[roomId];
            if (!match) {
              const is2v2 = roomId.includes('2v2') || roomId.includes('team');
              const requestedMaxPlayers = payload.settings?.maxPlayers || (payload.maxPlayers ? Number(payload.maxPlayers) : 4);
              match = {
                roomId,
                status: 'lobby',
                players: [],
                deckCount: 106,
                discardPile: [],
                turnIndex: 0,
                actionsPlayedThisTurn: 0,
                logs: [{ id: 'l-init', message: `${user.username} odayı kurdu.${is2v2 ? ' [⚔️ 2v2 Takım Savaşı]' : ''}`, timestamp: Date.now() }],
                isOffline: false,
                settings: {
                  targetSets: is2v2 ? 4 : 3,
                  turnLimit: '30s',
                  autoEndTurn: true,
                  gameMode: is2v2 ? '2v2_team' : 'classic',
                  maxPlayers: Math.min(6, Math.max(2, requestedMaxPlayers)),
                  ...payload.settings,
                }
              };
              if (roomPassword && roomPassword.trim() !== '') {
                match.password = roomPassword.trim();
              }
              activeMatches[roomId] = match;
            } else {
              // Existing room, verify password if any
              if (match.password && match.password !== roomPassword) {
                const isAlreadyJoined = match.players.some((p) => p.id === userId);
                if (!isAlreadyJoined) {
                  ws.send(JSON.stringify({
                    type: 'join_failed',
                    error: 'Geçersiz oda şifresi!',
                  }));
                  break;
                }
              }

              // Check max players capacity
              const maxP = match.settings?.maxPlayers || 4;
              if (match.players.length >= maxP && !match.players.some((p) => p.id === userId)) {
                ws.send(JSON.stringify({
                  type: 'join_failed',
                  error: `Oda dolu! Maksimum ${maxP} oyuncu kapasitesine ulaşıldı.`,
                }));
                break;
              }
            }

            clients[clientId] = { ...(clients[clientId] || { ws, userId }), roomId };

            // Join if not already in
            let existingPlayer = match.players.find((p) => p.id === userId);
            if (!existingPlayer && roomId.startsWith('dc_room_') && match.status === 'lobby') {
              const placeholderPlayer = match.players.find(p => p.username === 'Discord Oyuncusu' || p.username.startsWith('DiscordPlayer_'));
              if (placeholderPlayer) {
                placeholderPlayer.id = userId;
                existingPlayer = placeholderPlayer;
              }
            }
            if (!existingPlayer) {
              let assignedTeam: 'team_blue' | 'team_red' | undefined = undefined;
              if (match.settings?.gameMode === '2v2_team') {
                const blueCount = match.players.filter((p) => p.team === 'team_blue').length;
                const redCount = match.players.filter((p) => p.team === 'team_red').length;
                assignedTeam = blueCount <= redCount ? 'team_blue' : 'team_red';
              }

              const effectiveUsername = (payload.username && payload.username !== 'Discord Oyuncusu')
                ? payload.username
                : user.username;
              const effectiveAvatarUrl = payload.avatarUrl || user.avatarUrl;

              match.players.push({
                id: userId,
                username: effectiveUsername,
                country: user.country || 'TR',
                avatarId: user.avatarId,
                avatarUrl: effectiveAvatarUrl,
                profileFrame: user.settings.profileFrame || 'frame_none',
                playerBoard: user.settings.playerBoard || 'board_classic',
                cardBack: user.settings.cardBack || 'back_classic',
                cardSkin: user.settings.cardSkin || 'skin_none',
                actionVfx: user.settings.actionVfx || 'vfx_none',
                team: assignedTeam,
                isBot: false,
                hand: [],
                bank: [],
                properties: {},
              });
              match.logs.push({
                id: `join-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                message: `${effectiveUsername} odaya katıldı.${assignedTeam ? ` (${assignedTeam === 'team_blue' ? '🔵 Mavi Takım' : '🔴 Kırmızı Takım'})` : ''}`,
                timestamp: Date.now(),
              });
            } else {
              // Reconnecting / updating equipped items!
              existingPlayer.isDisconnected = false;
              if (payload.username && payload.username !== 'Discord Oyuncusu') {
                existingPlayer.username = payload.username;
              } else if (user.username) {
                existingPlayer.username = user.username;
              }
              if (payload.avatarUrl) {
                existingPlayer.avatarUrl = payload.avatarUrl;
              } else if (user.avatarUrl) {
                existingPlayer.avatarUrl = user.avatarUrl;
              }
              existingPlayer.country = user.country || 'TR';
              existingPlayer.avatarId = user.avatarId;
              existingPlayer.profileFrame = user.settings.profileFrame || 'frame_none';
              existingPlayer.playerBoard = user.settings.playerBoard || 'board_classic';
              existingPlayer.cardBack = user.settings.cardBack || 'back_classic';
              existingPlayer.cardSkin = user.settings.cardSkin || 'skin_none';
              existingPlayer.actionVfx = user.settings.actionVfx || 'vfx_none';
              
              if (match.status === 'lobby') {
                match.logs.push({
                  id: `join-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                  message: `${existingPlayer.username} odaya katıldı.`,
                  timestamp: Date.now(),
                });
              } else {
                match.logs.push({
                  id: `reconnect-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                  message: `${existingPlayer.username} oyuna geri döndü. Kontrolü devraldı!`,
                  timestamp: Date.now(),
                });
              }
            }

            broadcastToRoom(roomId, {
              type: 'room_update',
              matchState: match,
            });

            // If matchmaking and all human players have connected, auto-start the game!
            if (match.isMatchmaking && match.status === 'lobby') {
              const allHumansConnected = match.players.filter((p: any) => !p.isBot).every((p: any) => !p.isDisconnected);
              if (allHumansConnected) {
                startMatchGame(match);
              }
            }
            break;
          }

          case 'sync_player_profile': {
            const match = activeMatches[roomId];
            if (!match) break;
            const player = match.players.find((p) => p.id === userId);
            if (player) {
              if (payload.username && payload.username !== 'Discord Oyuncusu') {
                player.username = payload.username;
              }
              if (payload.avatarUrl) {
                player.avatarUrl = payload.avatarUrl;
              }
              broadcastToRoom(roomId, {
                type: 'room_update',
                matchState: match,
              });
            }
            break;
          }

          case 'start_game': {
            const match = activeMatches[roomId];
            if (!match) break;

            // Generate full deck
            let fullDeck = shuffleDeck(generateDeck());

            // Deal 5 cards to each player
            match.players.forEach((player) => {
              player.hand = fullDeck.splice(0, 5);
            });

            match.discardPile = [];
            // Save remaining deck count
            match.deckCount = fullDeck.length;
            match.status = 'playing';
            
            // Choose a random starting player
            const startingIndex = Math.floor(Math.random() * match.players.length);
            match.turnIndex = startingIndex;
            match.startingPlayerId = match.players[startingIndex].id;
            match.turnNumber = 1;
            match.actionsPlayedThisTurn = 0;
            match.turnStartedAt = Date.now();
            match.logs.push({
              id: `start-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              message: `🎲 Kura çekildi! Oyuna ilk olarak ${match.players[startingIndex].username} başlıyor.`,
              timestamp: Date.now(),
              turnNumber: 1,
            });

            // Put deck to a safe temporary server state
            (match as any).serverDeck = fullDeck;

            // Automatically trigger first draw
            triggerDrawForActivePlayer(match);

            broadcastToRoom(roomId, {
              type: 'room_update',
              matchState: match,
            });

            // If first player is a bot, schedule bot turn after starting animation window
            const firstPlayer = match.players[startingIndex];
            if (firstPlayer && firstPlayer.isBot) {
              scheduleBotTurn(match, 3500);
            }
            break;
          }

          case 'start_matchmaking': {
            if (!(globalAdminSettings as any).matchmakingEnabled) {
              ws.send(JSON.stringify({ type: 'matchmaking_error', error: 'Otomatik oyuncu bulma şu anda devre dışı.' }));
              break;
            }

            const users = await loadUsers();
            const user = users[userId];
            if (!user) {
              ws.send(JSON.stringify({ type: 'matchmaking_error', error: 'Kullanıcı bulunamadı.' }));
              break;
            }

            let entryFee = Number(payload.entryFee);
            const allowedFees = [100, 300, 500, 750, 1000];
            if (!allowedFees.includes(entryFee)) {
              entryFee = (globalAdminSettings as any).matchmakingEntryFee ?? 100;
              if (!allowedFees.includes(entryFee)) {
                entryFee = 100;
              }
            }
            if (user.coins < entryFee) {
              ws.send(JSON.stringify({ type: 'matchmaking_error', error: `Yetersiz altın! En az ${entryFee} altın gereklidir.` }));
              break;
            }

            // Deduct entry fee instantly
            user.coins -= entryFee;
            await saveUsers(users);

            // Notify client of matchmaking start
            ws.send(JSON.stringify({
              type: 'matchmaking_started',
              entryFee,
              newCoins: user.coins
            }));

            // Clear any existing request
            matchmakingQueue = matchmakingQueue.filter(req => req.userId !== userId);
            
            const newRequest: MatchmakingRequest = {
              clientId,
              userId,
              username: user.username,
              entryFee,
              joinedAt: Date.now(),
              ws
            };

            // Look for 3 other players with the same entryFee in queue
            const opponents = matchmakingQueue.filter(req => req.entryFee === entryFee && req.userId !== userId).slice(0, 3);

            if (opponents.length === 3) {
              // Found exactly 4 players! Remove opponents from queue
              matchmakingQueue = matchmakingQueue.filter(req => !opponents.some(opp => opp.userId === req.userId));

              const roomId = `matchmaking-${entryFee}-${Math.random().toString(36).substr(2, 5)}`;

              const playersList = [
                {
                  id: userId,
                  username: user.username,
                  avatarId: user.avatarId,
                  avatarUrl: user.avatarUrl,
                  profileFrame: user.settings.profileFrame || 'frame_none',
                  playerBoard: user.settings.playerBoard || 'board_classic',
                  cardBack: user.settings.cardBack || 'back_classic',
                  cardSkin: user.settings.cardSkin || 'skin_none',
                  actionVfx: user.settings.actionVfx || 'vfx_none',
                  isBot: false,
                  hand: [],
                  bank: [],
                  properties: {},
                  isDisconnected: false
                }
              ];

              for (const opp of opponents) {
                const oppUser = users[opp.userId];
                playersList.push({
                  id: opp.userId,
                  username: opp.username,
                  avatarId: oppUser?.avatarId || 'avatar_skater',
                  avatarUrl: oppUser?.avatarUrl,
                  profileFrame: oppUser?.settings?.profileFrame || 'frame_none',
                  playerBoard: oppUser?.settings?.playerBoard || 'board_classic',
                  cardBack: oppUser?.settings?.cardBack || 'back_classic',
                  cardSkin: oppUser?.settings?.cardSkin || 'skin_none',
                  actionVfx: oppUser?.settings?.actionVfx || 'vfx_none',
                  isBot: false,
                  hand: [],
                  bank: [],
                  properties: {},
                  isDisconnected: true // Mark as disconnected until they join the room
                });
              }

              const match = {
                roomId,
                status: 'lobby' as const,
                players: playersList,
                deckCount: 106,
                discardPile: [],
                turnIndex: 0,
                actionsPlayedThisTurn: 0,
                logs: [{ id: 'l-init', message: `Eşleştirme Başarılı! Arenaya 4 Oyuncu Katıldı: ${playersList.map(p => p.username).join(', ')}. Giriş Ücreti: ${entryFee} Altın.`, timestamp: Date.now() }],
                isOffline: false,
                isMatchmaking: true,
                matchmakingEntryFee: entryFee,
                matchmakingWinnerShare: (globalAdminSettings as any).matchmakingWinnerShare ?? 80,
                settings: {
                  targetSets: 3,
                  turnLimit: '30s' as const,
                  autoEndTurn: true,
                  gameMode: 'classic' as const
                }
              };

              activeMatches[roomId] = match;

              // Notify everyone
              ws.send(JSON.stringify({
                type: 'matchmaking_found',
                roomId,
                opponentName: opponents.map(o => o.username).join(', '),
                isBot: false
              }));

              opponents.forEach(opp => {
                const otherNames = [user.username, ...opponents.filter(o => o.userId !== opp.userId).map(o => o.username)].join(', ');
                opp.ws.send(JSON.stringify({
                  type: 'matchmaking_found',
                  roomId,
                  opponentName: otherNames,
                  isBot: false
                }));
              });
            } else {
              // Add to queue
              matchmakingQueue.push(newRequest);

              // Setup automated matchmaking timeout (failsafe/bot matchmaking)
              const waitTime = ((globalAdminSettings as any).matchmakingTimeSec ?? 10) * 1000;
              setTimeout(async () => {
                // Check if still in queue
                const stillInQueue = matchmakingQueue.find(req => req.clientId === clientId);
                if (stillInQueue) {
                  // Find up to 3 other players in the queue with the same entryFee
                  const matchedReqs = matchmakingQueue.filter(req => req.entryFee === entryFee && req.clientId !== clientId).slice(0, 3);
                  
                  // Collect all participants (including the timeout-triggered player)
                  const participants = [stillInQueue, ...matchedReqs];
                  
                  // Remove all these participants from the queue
                  matchmakingQueue = matchmakingQueue.filter(req => !participants.some(p => p.clientId === req.clientId));

                  const roomId = `matchmaking-${entryFee}-${Math.random().toString(36).substr(2, 5)}`;
                  
                  // Create Bots for the remaining spots
                  const numBotsNeeded = 4 - participants.length;
                  const botNames = ['Bot Memo', 'Bot Can', 'Bot Defne', 'Milyoner Bot', 'Yapay Zeka Master', 'Kart Şampiyonu', 'Kral Oyuncu', 'Efsane Bot', 'Pro Bot', 'Zeki Bot'];
                  const botBoards = ['board_cyber', 'board_gold', 'board_magma', 'board_galaxy', 'board_ice', 'board_void'];
                  
                  // Pick unique bot names and boards
                  const chosenBotNames: string[] = [];
                  const chosenBotBoards: string[] = [];
                  for (let i = 0; i < numBotsNeeded; i++) {
                    const availableNames = botNames.filter(n => !chosenBotNames.includes(n));
                    const name = availableNames[Math.floor(Math.random() * availableNames.length)] || `Bot ${i + 1}`;
                    chosenBotNames.push(name);
                    chosenBotBoards.push(botBoards[Math.floor(Math.random() * botBoards.length)]);
                  }

                  const usersList = await loadUsers();
                  const playersList: any[] = [];
                  
                  // Add real players
                  for (const pReq of participants) {
                    const pUser = usersList[pReq.userId];
                    playersList.push({
                      id: pReq.userId,
                      username: pReq.username,
                      avatarId: pUser?.avatarId || 'avatar_skater',
                      avatarUrl: pUser?.avatarUrl,
                      profileFrame: pUser?.settings?.profileFrame || 'frame_none',
                      playerBoard: pUser?.settings?.playerBoard || 'board_classic',
                      cardBack: pUser?.settings?.cardBack || 'back_classic',
                      cardSkin: pUser?.settings?.cardSkin || 'skin_none',
                      actionVfx: pUser?.settings?.actionVfx || 'vfx_none',
                      isBot: false,
                      hand: [],
                      bank: [],
                      properties: {},
                      isDisconnected: pReq.clientId !== clientId // Mark others as disconnected until they join the room
                    });
                  }
                  
                  // Add Bots
                  const botCountries = ['TR', 'US', 'DE', 'GB', 'FR', 'IT', 'ES', 'BR', 'JP', 'AZ', 'NL', 'CA'];
                  for (let i = 0; i < numBotsNeeded; i++) {
                    playersList.push({
                      id: `bot-${Math.random().toString(36).substr(2, 5)}`,
                      username: chosenBotNames[i],
                      country: botCountries[Math.floor(Math.random() * botCountries.length)],
                      avatarId: 'avatar_skater',
                      profileFrame: 'frame_none',
                      playerBoard: chosenBotBoards[i],
                      isBot: true,
                      hand: [],
                      bank: [],
                      properties: {},
                      isDisconnected: false
                    });
                  }

                  const opponentsText = playersList.map(p => p.username).join(', ');
                  const match = {
                    roomId,
                    status: 'lobby' as const,
                    players: playersList,
                    deckCount: 106,
                    discardPile: [],
                    turnIndex: 0,
                    actionsPlayedThisTurn: 0,
                    logs: [
                      { 
                        id: 'l-init', 
                        message: `Eşleştirme Başarılı! Arenaya 4 oyuncu katıldı: ${opponentsText}. Giriş Ücreti: ${entryFee} Altın.`, 
                        timestamp: Date.now() 
                      }
                    ],
                    isOffline: false,
                    isMatchmaking: true,
                    matchmakingEntryFee: entryFee,
                    matchmakingWinnerShare: (globalAdminSettings as any).matchmakingWinnerShare ?? 80,
                    settings: {
                      targetSets: 3,
                      turnLimit: '30s' as const,
                      autoEndTurn: true,
                      gameMode: 'classic' as const
                    }
                  };

                  activeMatches[roomId] = match;

                  // Notify all real players
                  participants.forEach(pReq => {
                    const otherNames = playersList.filter(p => p.id !== pReq.userId).map(p => p.username).join(', ');
                    const hasBots = numBotsNeeded > 0;
                    pReq.ws.send(JSON.stringify({ 
                      type: 'matchmaking_found', 
                      roomId, 
                      opponentName: otherNames, 
                      isBot: hasBots 
                    }));
                  });
                }
              }, waitTime);
            }
            break;
          }

          case 'cancel_matchmaking': {
            const req = matchmakingQueue.find(r => r.clientId === clientId);
            if (req) {
              matchmakingQueue = matchmakingQueue.filter(r => r.clientId !== clientId);
              const users = await loadUsers();
              const user = users[userId];
              if (user) {
                user.coins += req.entryFee;
                await saveUsers(users);
                ws.send(JSON.stringify({
                  type: 'matchmaking_cancelled',
                  refundAmount: req.entryFee,
                  newCoins: user.coins
                }));
              }
            }
            break;
          }

          case 'add_bot': {
            const match = activeMatches[roomId];
            if (!match || match.status !== 'lobby' || roomId.startsWith('tournament')) break;

            const botNames = ['Bot Memo', 'Bot Can', 'Bot Defne', 'Milyoner Bot'];
            const usedNames = match.players.map((p) => p.username);
            const availableNames = botNames.filter((n) => !usedNames.includes(n));
            const botName = availableNames[0] || `Bot ${match.players.length + 1}`;

            const botBoards = ['board_cyber', 'board_gold', 'board_magma', 'board_galaxy', 'board_ice', 'board_void'];
            const botBoard = botBoards[Math.floor(Math.random() * botBoards.length)];
            const botCountries = ['TR', 'US', 'DE', 'GB', 'FR', 'IT', 'ES', 'BR', 'JP', 'AZ', 'NL', 'CA'];

            let assignedTeam: 'team_blue' | 'team_red' | undefined = undefined;
            if (match.settings?.gameMode === '2v2_team') {
              const blueCount = match.players.filter((p) => p.team === 'team_blue').length;
              const redCount = match.players.filter((p) => p.team === 'team_red').length;
              assignedTeam = blueCount <= redCount ? 'team_blue' : 'team_red';
            }

            match.players.push({
              id: `bot-${Math.random().toString(36).substr(2, 5)}`,
              username: botName,
              country: botCountries[Math.floor(Math.random() * botCountries.length)],
              avatarId: 'avatar_skater',
              profileFrame: 'frame_none',
              playerBoard: botBoard,
              team: assignedTeam,
              isBot: true,
              hand: [],
              bank: [],
              properties: {},
            });

            match.logs.push({
              id: `bot-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              message: `${botName} odaya katıldı.${assignedTeam ? ` (${assignedTeam === 'team_blue' ? '🔵 Mavi Takım' : '🔴 Kırmızı Takım'})` : ''}`,
              timestamp: Date.now(),
            });

            broadcastToRoom(roomId, {
              type: 'room_update',
              matchState: match,
            });
            break;
          }

          case 'kick_player': {
            const match = activeMatches[roomId];
            if (!match || match.status !== 'lobby' || roomId.startsWith('tournament')) break;

            // Only host can kick
            if (match.players[0]?.id === userId) {
              const targetId = payload.targetPlayerId;
              const targetIdx = match.players.findIndex((p) => p.id === targetId);
              if (targetIdx !== -1) {
                const kickedPlayer = match.players[targetIdx];
                const targetClient = Object.values(clients).find((c) => c.userId === targetId && c.roomId === roomId);
                if (targetClient) {
                  try {
                    targetClient.ws.send(JSON.stringify({ type: 'kicked' }));
                  } catch (e) {
                    console.error('Error sending kicked notice to client', e);
                  }
                  targetClient.roomId = undefined;
                }

                match.players.splice(targetIdx, 1);
                match.logs.push({
                  id: `kick-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                  message: `${kickedPlayer.username} odadan çıkarıldı.`,
                  timestamp: Date.now(),
                });

                broadcastToRoom(roomId, {
                  type: 'room_update',
                  matchState: match,
                });
              }
            }
            break;
          }

          case 'leave_room': {
            const match = activeMatches[roomId];
            if (!match) break;

            const idx = match.players.findIndex((p) => p.id === userId);
            if (idx !== -1) {
              const leavingPlayer = match.players[idx];

              // If this is a tournament match, record immediate forfeit / loss in bracket
              if (roomId.startsWith('tournament_')) {
                const parts = roomId.split('_');
                const tId = parts[1];
                const mId = parts[2];
                const opponent = match.players.find((p: any) => p.id !== userId);
                if (tId && mId && opponent?.username) {
                  await submitTournamentMatchInternal(tId, mId, opponent.username, 3, 0);
                }
              }

              if (match.status === 'playing') {
                leavingPlayer.isDisconnected = true;
                leavingPlayer.hasAbandoned = true;
                match.logs.push({
                  id: `leave-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                  message: `⚠️ ${leavingPlayer.username} maçı terk etti (Terk Cezası Uygulandı). Yapay zeka devralıyor.`,
                  timestamp: Date.now(),
                });

                if (!leavingPlayer.isBot) {
                  leavingPlayer.hasAbandonedAlreadyPenalized = true;
                  try {
                    const users = await loadUsers();
                    const u = users[userId];
                    if (u) {
                      u.stats.gamesPlayed++;
                      u.stats.gamesLost++;
                      u.rankPoints = Math.max(0, (u.rankPoints ?? 0) - 25);
                      u.mmr = Math.max(100, (u.mmr ?? 1000) - 30);
                      if (!u.gamesHistory) u.gamesHistory = [];
                      const dateStr = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                      u.gamesHistory.unshift({
                        id: `match-abandon-${Date.now()}`,
                        date: dateStr,
                        opponent: match.players.filter((x: any) => x.id !== userId).map((x: any) => x.username).join(', '),
                        result: 'lost',
                        coinsEarned: 0,
                        xpEarned: 0,
                        rankPointsEarned: -25
                      });
                      await saveUsers(users);
                    }
                  } catch (e) {
                    console.error('[LeaveRoom] Error penalizing player:', e);
                  }
                }

                if (match.players[match.turnIndex]?.id === leavingPlayer.id) {
                  setTimeout(() => handleBotTurn(match), 1000);
                }
              } else {
                match.players.splice(idx, 1);
                match.logs.push({
                  id: `leave-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                  message: `${leavingPlayer.username} odadan ayrıldı.`,
                  timestamp: Date.now(),
                });
              }
            }

            const c = clients[clientId];
            if (c) {
              c.roomId = undefined;
            }

            const hasActiveHumans = match.players.some((p) => !p.isBot && !p.isDisconnected && !p.hasAbandoned);
            if (!hasActiveHumans) {
              delete activeMatches[roomId];
            } else {
              broadcastToRoom(roomId, {
                type: 'room_update',
                matchState: match,
              });
            }
            break;
          }

          case 'update_match_settings': {
            const match = activeMatches[roomId];
            if (!match || match.status !== 'lobby') break;

            if (match.players[0] && match.players[0].id === userId) {
              const { settings } = payload;
              const prevMode = match.settings?.gameMode;
              const newMode = settings.gameMode || prevMode || 'classic';

              let defaultTarget = match.settings?.targetSets || 3;
              let defaultTurnLimit = match.settings?.turnLimit || '30s';
              let defaultAutoEnd = match.settings?.autoEndTurn ?? true;
              let defaultMaxPlayers = match.settings?.maxPlayers || 4;

              if (settings.gameMode && settings.gameMode !== prevMode) {
                if (settings.gameMode === 'chaos') {
                  defaultTarget = 4;
                  defaultTurnLimit = 'unlimited';
                  defaultAutoEnd = false;
                } else if (settings.gameMode === 'speed') {
                  defaultTarget = 2;
                  defaultTurnLimit = '15s';
                  defaultAutoEnd = true;
                } else if (settings.gameMode === '2v2_team') {
                  defaultTarget = 4;
                  defaultTurnLimit = '30s';
                  defaultAutoEnd = true;
                } else if (settings.gameMode === 'classic') {
                  defaultTarget = 3;
                  defaultTurnLimit = '30s';
                  defaultAutoEnd = true;
                }
              }

              match.settings = {
                targetSets: settings.targetSets !== undefined ? Number(settings.targetSets) : defaultTarget,
                turnLimit: settings.turnLimit !== undefined ? settings.turnLimit : defaultTurnLimit,
                autoEndTurn: settings.autoEndTurn !== undefined ? Boolean(settings.autoEndTurn) : defaultAutoEnd,
                gameMode: newMode,
                maxPlayers: settings.maxPlayers ? Math.min(6, Math.max(2, Number(settings.maxPlayers))) : defaultMaxPlayers,
                // Chaos Mode Toggles
                chaosSpy: settings.chaosSpy !== undefined ? Boolean(settings.chaosSpy) : (match.settings?.chaosSpy ?? false),
                chaosKingHill: settings.chaosKingHill !== undefined ? Boolean(settings.chaosKingHill) : (match.settings?.chaosKingHill ?? false),
                chaosHotPotato: settings.chaosHotPotato !== undefined ? Boolean(settings.chaosHotPotato) : (match.settings?.chaosHotPotato ?? false),
              };

              if (match.settings.gameMode === '2v2_team') {
                // Auto-assign teams: first half Blue, second half Red
                const half = Math.ceil(match.players.length / 2);
                match.players.forEach((p, idx) => {
                  p.team = idx < half ? 'team_blue' : 'team_red';
                });
              } else {
                match.players.forEach((p) => { delete p.team; });
              }

              const modeLabel = match.settings.gameMode === 'chaos' 
                ? 'Kaos Modu 🌀' 
                : match.settings.gameMode === 'speed' 
                ? 'Speed Deal Master PRO ⚡' 
                : match.settings.gameMode === '2v2_team'
                ? '2v2 Takım Savaşı ⚔️'
                : 'Klasik Mod 🎲';

              match.logs.push({
                id: `settings-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                message: `Oda ayarları güncellendi: [${modeLabel}] - Maks. ${match.settings.maxPlayers} Oyuncu, Hedef: ${match.settings.targetSets} Set, Tur Süresi: ${match.settings.turnLimit === 'unlimited' ? 'Sınırsız' : match.settings.turnLimit}, Otomatik Tur Sonu: ${match.settings.autoEndTurn ? 'Açık' : 'Kapalı'}`,
                timestamp: Date.now(),
              });

              broadcastToRoom(roomId, {
                type: 'room_update',
                matchState: match,
              });
            }
            break;
          }

          case 'switch_team': {
            const match = activeMatches[roomId];
            if (!match || match.status !== 'lobby') break;

            const targetPlayerId = payload.targetPlayerId || payload.userId || userId;
            const isHost = match.players[0]?.id === userId;
            const isSelf = targetPlayerId === userId;

            // Allow if sender is host or switching themselves
            if (isHost || isSelf) {
              const targetPlayer = match.players.find((p) => p.id === targetPlayerId);
              if (targetPlayer) {
                const currentTeam = targetPlayer.team || 'team_blue';
                const nextTeam = payload.team || (currentTeam === 'team_blue' ? 'team_red' : 'team_blue');
                targetPlayer.team = nextTeam;
                match.logs.push({
                  id: `team-${Date.now()}`,
                  message: `${targetPlayer.username} ${nextTeam === 'team_blue' ? '🔵 Mavi Takım' : '🔴 Kırmızı Takım'}'a geçti.`,
                  timestamp: Date.now(),
                });
                broadcastToRoom(roomId, {
                  type: 'room_update',
                  matchState: match,
                });
              }
            }
            break;
          }

          case 'play_card': {
            const match = activeMatches[roomId];
            if (!match || match.status !== 'playing') break;

            const { cardId, targetZone, extraColor } = payload;
            const player = match.players[match.turnIndex];

            if (player.id !== userId) {
              console.warn(`[Anti-Cheat] Player ${userId} tried to play a card out of turn!`);
              ws.send(JSON.stringify({ type: 'alert', message: '⚠️ Sıra sizde değil! Hamle engellendi.' }));
              break;
            }
            const isChaos = match.settings?.gameMode === 'chaos';
            if (!isChaos && match.actionsPlayedThisTurn >= (globalAdminSettings.turnActionLimit || 3)) {
              ws.send(JSON.stringify({ type: 'alert', message: '⚠️ Bu turdaki hamle hakkınız doldu!' }));
              break;
            }
            const hasActiveAction = match.activeActionRequest || (match.activeActionRequests && match.activeActionRequests.length > 0);
            if (hasActiveAction) {
              ws.send(JSON.stringify({ type: 'alert', message: 'Şu an aktif bir ödeme veya hamle talebi var, bu talep çözülene kadar yeni kart oynayamazsınız!' }));
              break;
            }

            const cardIdx = player.hand.findIndex((c) => c.id === cardId);
            if (cardIdx === -1) {
              console.warn(`[Anti-Cheat] Player ${userId} tried to play card ${cardId} which is not in hand!`);
              ws.send(JSON.stringify({ type: 'alert', message: '⚠️ Hile Girişimi: Kart elinizde değil!' }));
              break;
            }

            const card = player.hand[cardIdx];

            // Perform playing action logic
            if (targetZone === 'bank') {
              if (card.type === 'property' || card.type === 'wildcard') {
                break; // Arazi Kartları ve Joker Arazi kartları Bankaya Konulmaz.
              }
              // Add to bank
              player.hand.splice(cardIdx, 1);
              player.bank.push(card);
              match.logs.push({
                id: `play-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                message: `${player.username}, bankaya ${card.value}M para (${card.name}) ekledi.`,
                timestamp: Date.now(),
              });
              match.actionsPlayedThisTurn++;
            } else if (targetZone === 'property') {
              // Add to collection
              player.hand.splice(cardIdx, 1);

              let rawColor = (card.isWildcard && extraColor) ? extraColor : (card.color || extraColor || 'brown');
              let colorToUse: CardColor = getBaseColor(rawColor as string);
              let targetSetKey = payload.targetSetKey || extraColor || colorToUse;
              if (card.type === 'house-hotel') {
                targetSetKey = payload.targetSetKey || extraColor || colorToUse;
              } else {
                const maxAllowed = MAX_IN_SET[colorToUse] || 3;
                const currentTargetSet = player.properties[targetSetKey];
                if (!currentTargetSet || currentTargetSet.cards.length >= maxAllowed) {
                  targetSetKey = findAvailableSetKey(player.properties, colorToUse);
                }
              }

              if (!player.properties[targetSetKey]) {
                player.properties[targetSetKey] = { cards: [], hasHouse: false, hasHotel: false };
              }

              if (card.type === 'house-hotel') {
                if (card.actionType === 'house') {
                  player.properties[targetSetKey]!.hasHouse = true;
                } else {
                  player.properties[targetSetKey]!.hasHotel = true;
                }
              } else {
                // Property or wildcard
                const updatedCard = { ...card };
                if (updatedCard.isWildcard && updatedCard.allowedColors && updatedCard.allowedColors.length === 2) {
                  updatedCard.color = colorToUse;
                  updatedCard.secondaryColor = updatedCard.allowedColors.find((c: any) => c !== colorToUse) || updatedCard.allowedColors[0];
                } else if (updatedCard.isWildcard && updatedCard.secondaryColor && colorToUse === updatedCard.secondaryColor) {
                  const temp = updatedCard.color;
                  updatedCard.color = colorToUse;
                  updatedCard.secondaryColor = temp;
                } else {
                  updatedCard.color = colorToUse;
                }
                player.properties[targetSetKey]!.cards.push(updatedCard);
              }

              const setDisplayName = getSetDisplayName(targetSetKey);
              match.logs.push({
                id: `play-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                message: `${player.username}, ${setDisplayName} grubuna ${card.name} kartını yerleştirdi.`,
                timestamp: Date.now(),
              });
              match.actionsPlayedThisTurn++;

              // Check if they won!
              if (checkWinnerForMatch(match, player)) {
                await handleMatchWinner(match, player.id);
              }
            } else if (targetZone === 'action') {
              // Play as action card
              player.hand.splice(cardIdx, 1);
              match.discardPile.push(card);

              if (payload && payload.isDoubleRent) {
                const drIdx = player.hand.findIndex((c) => c.actionType === 'double-rent');
                if (drIdx !== -1) {
                  const drCard = player.hand.splice(drIdx, 1)[0];
                  match.discardPile.push(drCard);
                  match.actionsPlayedThisTurn++;
                }
              }

              // Process different action card mechanics
              await processActionCard(match, player, card, payload);
              match.actionsPlayedThisTurn++;
            }

            // Grant bonus time for playing a card
            const bonusSec = (globalAdminSettings as any).bonusTimePerActionSeconds ?? 10;
            if (bonusSec > 0 && match.turnStartedAt) {
              match.turnStartedAt = Math.min(Date.now(), match.turnStartedAt + bonusSec * 1000);
            }

            broadcastToRoom(roomId, { type: 'room_update', matchState: match });
            break;
          }

          case 'change_wildcard_color': {
            const match = activeMatches[roomId];
            if (!match || match.status !== 'playing') break;

            const hasActiveAction = match.activeActionRequest || (match.activeActionRequests && match.activeActionRequests.length > 0);
            if (hasActiveAction) {
              ws.send(JSON.stringify({ type: 'alert', message: 'Şu an aktif bir ödeme veya hamle talebi var!' }));
              break;
            }

            const { cardId, newColor } = payload;
            const player = match.players.find((p) => p.id === userId);

            if (!player) break;

            // Find the wildcard in the player's property sets
            let foundCard: Card | null = null;

            for (const colKey in player.properties) {
              const propSet = player.properties[colKey];
              if (propSet) {
                const idx = propSet.cards.findIndex((c) => c.id === cardId);
                if (idx !== -1) {
                  foundCard = propSet.cards.splice(idx, 1)[0];

                  // Clean up set if empty
                  if (propSet.cards.length === 0) {
                    delete player.properties[colKey];
                  }
                  break;
                }
              }
            }

            if (foundCard) {
              // Update card color
              if (foundCard.isWildcard && foundCard.allowedColors && foundCard.allowedColors.length === 2) {
                foundCard.color = newColor;
                foundCard.secondaryColor = foundCard.allowedColors.find((c: any) => c !== newColor) || foundCard.allowedColors[0];
              } else if (foundCard.isWildcard && foundCard.secondaryColor && newColor === foundCard.secondaryColor) {
                const temp = foundCard.color;
                foundCard.color = newColor;
                foundCard.secondaryColor = temp;
              } else {
                foundCard.color = newColor;
              }

              // Insert into the new property set
              const targetSetKey = findAvailableSetKey(player.properties, newColor);
              if (!player.properties[targetSetKey]) {
                player.properties[targetSetKey] = { cards: [], hasHouse: false, hasHotel: false };
              }
              player.properties[targetSetKey]!.cards.push(foundCard);

              const setDisplayName = getSetDisplayName(targetSetKey);
              match.logs.push({
                id: `change-col-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                message: `${player.username}, ${foundCard.name} kartının rengini ${COLOR_LABELS[newColor]} olarak değiştirdi.`,
                timestamp: Date.now(),
              });

              // Check if player won after reorganization
              if (checkWinnerForMatch(match, player)) {
                match.status = 'finished';
                match.winnerId = player.id;
                match.logs.push({
                  id: `win-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                  message: `Tebrikler! Maçı ${player.username} kazandı!`,
                  timestamp: Date.now(),
                });
              }
            }

            broadcastToRoom(roomId, {
              type: 'room_update',
              matchState: match,
            });
            break;
          }

          case 'action_response': {
            // Processing interaction payload like "Just Say No" response or payment choice
            const match = activeMatches[roomId];
            if (!match) break;

            const { actionRequestId, decision, paymentCardIds } = payload;
            let req = match.activeActionRequest;
            let isMulti = false;

            if (req && req.id === actionRequestId) {
              // Single active action request
            } else if (match.activeActionRequests) {
              req = match.activeActionRequests.find((r) => r.id === actionRequestId);
              isMulti = true;
            }

            if (!req) break;

            const targetPlayer = match.players.find((p) => p.id === req.targetPlayerId);
            const sourcePlayer = match.players.find((p) => p.id === req.sourcePlayerId);
            if (!targetPlayer || !sourcePlayer) break;

            // Helper to resolve request (either single or multi-request)
            const resolveRequest = (m: MatchState, rId: string) => {
              if (isMulti && m.activeActionRequests) {
                m.activeActionRequests = m.activeActionRequests.filter((r) => r.id !== rId);
                if (m.activeActionRequests.length === 0) {
                  m.activeActionRequests = undefined;
                }
              } else {
                resolveActiveActionRequest(m);
              }
            };

            if (decision === 'just-say-no') {
              // Target player played Just Say No!
              const jsnIdx = targetPlayer.hand.findIndex((c) => c.actionType === 'just-say-no');
              if (jsnIdx !== -1) {
                const jsnCard = targetPlayer.hand.splice(jsnIdx, 1)[0];
                match.discardPile.push(jsnCard);

                match.logs.push({
                  id: `jsn-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                  message: `${targetPlayer.username}, 'Hayır Teşekkürler' diyerek ${sourcePlayer.username}'in hamlesini engelledi!`,
                  timestamp: Date.now(),
                });

                // Swap target and source so the other player has a chance to play a counter JSN (Reddete Redet)!
                const prevSourceId = req.sourcePlayerId;
                req.sourcePlayerId = req.targetPlayerId;
                req.targetPlayerId = prevSourceId;
                req.jsnCount = (req.jsnCount || 0) + 1;
                match.actionRequestStartedAt = Date.now();

                // Auto-resolve if the new target is a bot or disconnected
                const newTarget = match.players.find((p) => p.id === req.targetPlayerId);
                if (newTarget && (newTarget.isBot || newTarget.isDisconnected)) {
                  const botJsnIdx = newTarget.hand.findIndex((c) => c.actionType === 'just-say-no');
                  if (botJsnIdx !== -1) {
                    // Bot plays counter JSN!
                    const botJsnCard = newTarget.hand.splice(botJsnIdx, 1)[0];
                    match.discardPile.push(botJsnCard);
                    match.logs.push({
                      id: `jsn-bot-counter-${Date.now()}`,
                      message: `🛡️ ${newTarget.username} 'Hayır Teşekkürler' diyerek senin savunmanı engelledi! (Reddete Reddet!)`,
                      timestamp: Date.now(),
                    });
                    req.sourcePlayerId = req.targetPlayerId;
                    req.targetPlayerId = targetPlayer.id; // back to human player
                    req.jsnCount = (req.jsnCount || 0) + 1;
                    match.actionRequestStartedAt = Date.now();
                  } else {
                    // Bot has no JSN! Check if original action should execute (even jsnCount means defense was overruled)
                    const finalJsnCount = req.jsnCount || 0;
                    if (finalJsnCount % 2 === 0) {
                      match.logs.push({
                        id: `jsn-overruled-${Date.now()}`,
                        message: `🎯 Savunma engellendi! ${sourcePlayer.username}'in hamlesi uygulandı.`,
                        timestamp: Date.now(),
                      });
                      if (req.amountDue > 0) {
                        if (newTarget && (newTarget.isBot || newTarget.isDisconnected)) {
                          processBotPayment(match, newTarget, sourcePlayer, req.amountDue);
                          resolveRequest(match, req.id);
                        } else {
                          req.jsnCount = 0;
                          req.type = 'make-payment';
                          match.actionRequestStartedAt = Date.now();
                        }
                      } else if (req.originalAction) {
                        executeOriginalActionServer(match, req);
                        resolveRequest(match, req.id);
                      } else {
                        resolveRequest(match, req.id);
                      }
                    } else {
                      // Odd JSN count: defense succeeds, action is blocked
                      match.logs.push({
                        id: `jsn-win-bot-${Date.now()}`,
                        message: `🛡️ Savunma başarılı oldu! ${targetPlayer.username}'in hamlesi engellendi.`,
                        timestamp: Date.now(),
                      });
                      resolveRequest(match, req.id);
                    }
                  }
                }
              }
            } else if (decision === 'decline') {
              const jsnCount = req.jsnCount || 0;
              if (jsnCount % 2 === 1) {
                // Odd number of JSNs: defense wins! Clear request and do nothing.
                match.logs.push({
                  id: `jsn-win-${Date.now()}`,
                  message: `🛡️ Savunma başarılı oldu! Hamle engellendi.`,
                  timestamp: Date.now(),
                });
                resolveRequest(match, req.id);
              } else {
                // Even number of JSNs: original action succeeds!
                if (req.amountDue > 0) {
                  if (targetPlayer && (targetPlayer.isBot || targetPlayer.isDisconnected) && sourcePlayer) {
                    processBotPayment(match, targetPlayer, sourcePlayer, req.amountDue);
                    resolveRequest(match, req.id);
                  } else {
                    // Payment request for human target: change back to normal payment so target player pays
                    req.jsnCount = 0;
                    req.type = 'make-payment';
                    match.actionRequestStartedAt = Date.now();
                  }
                } else if (req.originalAction) {
                  executeOriginalActionServer(match, req);
                  resolveRequest(match, req.id);
                } else {
                  resolveRequest(match, req.id);
                }
              }
            } else if (decision === 'pay') {
              // If it is a property-steal action (originalAction), execute it. Otherwise, handle standard payment.
              if (req.originalAction) {
                executeOriginalActionServer(match, req);
                resolveRequest(match, req.id);
              } else {
                // Process payment selection
                const amountDue = req.amountDue;

                let totalBankValue = 0;
                targetPlayer.bank.forEach((c) => totalBankValue += c.value);

                let totalPropertiesValue = 0;
                let totalPropertiesCount = 0;
                Object.values(targetPlayer.properties).forEach((set) => {
                  if (set && set.cards) {
                    set.cards.forEach((c) => {
                      totalPropertiesValue += c.value;
                      totalPropertiesCount++;
                    });
                  }
                });

                const totalAssetsValue = totalBankValue + totalPropertiesValue;
                const totalCardsCount = targetPlayer.bank.length + totalPropertiesCount;

                let totalSelectedValue = 0;
                paymentCardIds.forEach((cid: string) => {
                  const bc = targetPlayer.bank.find((c) => c.id === cid);
                  if (bc) totalSelectedValue += bc.value;
                  else {
                    for (const colKey in targetPlayer.properties) {
                      const set = targetPlayer.properties[colKey as CardColor];
                      const pc = set?.cards.find((c) => c.id === cid);
                      if (pc) totalSelectedValue += pc.value;
                    }
                  }
                });

                if (totalAssetsValue > 0) {
                  const targetAmount = Math.min(amountDue, totalAssetsValue);
                  const isUnderpaid = totalSelectedValue < targetAmount;
                  const isInsufficientAssets = totalAssetsValue < amountDue;

                  if (isInsufficientAssets) {
                    // totalAssetsValue < amountDue: must pay everything!
                    if (paymentCardIds.length < totalCardsCount) {
                      const allIds: string[] = [];
                      targetPlayer.bank.forEach((c) => allIds.push(c.id));
                      Object.values(targetPlayer.properties).forEach((set) => {
                        if (set && set.cards) {
                          set.cards.forEach((c) => allIds.push(c.id));
                        }
                      });
                      paymentCardIds.splice(0, paymentCardIds.length, ...allIds);
                    }
                  } else if (isUnderpaid) {
                    // Underpaid: auto-correct using BotEngine.selectPayment helper which is now fully optimal
                    paymentCardIds.splice(0, paymentCardIds.length, ...BotEngine.selectPayment(targetPlayer, amountDue));
                  }
                }

                let totalPaid = 0;
                const cardsToTransfer: Card[] = [];

                paymentCardIds.forEach((cid: string) => {
                  // Find in bank first
                  const bIdx = targetPlayer.bank.findIndex((c) => c.id === cid);
                  if (bIdx !== -1) {
                    const card = targetPlayer.bank.splice(bIdx, 1)[0];
                    totalPaid += card.value;
                    cardsToTransfer.push(card);
                  } else {
                    // Find in properties
                    for (const colorKey in targetPlayer.properties) {
                      const col = colorKey as CardColor;
                      const propSet = targetPlayer.properties[col];
                      if (propSet) {
                        const pIdx = propSet.cards.findIndex((c) => c.id === cid);
                        if (pIdx !== -1) {
                          const card = propSet.cards.splice(pIdx, 1)[0];
                          totalPaid += card.value;
                          cardsToTransfer.push(card);
                          break;
                        }
                      }
                    }
                  }
                });

                // Add cards to source player's assets (money goes to bank, properties go to property)
                cardsToTransfer.forEach((card) => {
                  if (card.type === 'property' || card.type === 'wildcard') {
                    const col = card.color || 'brown';
                    if (!sourcePlayer.properties[col]) {
                      sourcePlayer.properties[col] = { cards: [], hasHouse: false, hasHotel: false };
                    }
                    sourcePlayer.properties[col]!.cards.push(card);
                  } else {
                    sourcePlayer.bank.push(card);
                  }
                });

                match.logs.push({
                  id: `pay-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                  message: `${targetPlayer.username}, ${sourcePlayer.username} oyuncusuna ${totalPaid}M değerinde ödeme yaptı.`,
                  timestamp: Date.now(),
                });

                if (checkWinnerForMatch(match, sourcePlayer)) {
                  await handleMatchWinner(match, sourcePlayer.id);
                }

                resolveRequest(match, req.id);
              }
            }
            // Auto end turn check (if 3 actions played and no active requests left)
            const activePlayer = match.players[match.turnIndex];
            const hasActiveAction = match.activeActionRequest || (match.activeActionRequests && match.activeActionRequests.length > 0);
            if (!hasActiveAction && match.actionsPlayedThisTurn >= 3 && activePlayer) {
              if (activePlayer.hand.length <= 7) {
                advanceMatchTurn(match, '3 hamle tamamlandı');
              }
            }

            // If it's a bot's turn and they have more actions left, resume their turn simulation!
            if (!hasActiveAction && match.actionsPlayedThisTurn < 3 && activePlayer && (activePlayer.isBot || activePlayer.isDisconnected)) {
              scheduleBotTurn(match, 1000);
            }

            broadcastToRoom(roomId, {
              type: 'room_update',
              matchState: match,
            });
            break;
          }

          case 'end_turn': {
            const match = activeMatches[roomId];
            if (!match || match.status !== 'playing') break;

            const player = match.players[match.turnIndex];
            if (player.id !== userId) break;

            const hasActiveAction = match.activeActionRequest || (match.activeActionRequests && match.activeActionRequests.length > 0);
            if (hasActiveAction) {
              ws.send(JSON.stringify({ type: 'alert', message: 'Aktif bir ödeme veya hamle talebi varken turunuzu sonlandıramazsınız!' }));
              break;
            }

            // Validate hand size is <= 7. If they have more, they must discard first
            if (player.hand.length > 7) {
              ws.send(JSON.stringify({ type: 'alert', message: 'Elinizde 7\'den fazla kart var. Fazla kartları atmalısınız.' }));
              break;
            }

            // Move to next player
            advanceMatchTurn(match);

            broadcastToRoom(roomId, {
              type: 'room_update',
              matchState: match,
            });
            break;
          }

          case 'discard_card': {
            const match = activeMatches[roomId];
            if (!match) break;

            const { cardId } = payload;
            const player = match.players.find((p) => p.id === userId);
            if (!player) break;

            const idx = player.hand.findIndex((c) => c.id === cardId);
            if (idx !== -1) {
              const card = player.hand.splice(idx, 1)[0];
              match.discardPile.push(card);
              match.logs.push({
                id: `disc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                message: `${player.username} elinden ${card.name} kartını attı.`,
                timestamp: Date.now(),
              });
            }

            // Auto end turn if hand size <= 7 and it's active player's turn and (3 actions played OR turn timed out)
            const activePlayer = match.players[match.turnIndex];
            if (activePlayer && activePlayer.id === userId && player.hand.length <= 7) {
              const hasActiveAction = match.activeActionRequest || (match.activeActionRequests && match.activeActionRequests.length > 0);
              const turnLimitSec = getMatchTurnLimitSeconds(match);
              const isTimeOut = turnLimitSec !== null && match.turnStartedAt && (Date.now() - match.turnStartedAt >= turnLimitSec * 1000);

              if (!hasActiveAction && (match.actionsPlayedThisTurn >= 3 || isTimeOut)) {
                advanceMatchTurn(match, isTimeOut ? 'süre doldu' : undefined);
              }
            }

            broadcastToRoom(roomId, {
              type: 'room_update',
              matchState: match,
            });
            break;
          }

          case 'voice_state': {
            // Player toggles mute or reports speaking
            const match = activeMatches[roomId];
            if (!match) break;

            const { isSpeaking, isMuted } = payload;
            const player = match.players.find((p) => p.id === userId);
            if (player) {
              if (isSpeaking !== undefined) player.isSpeaking = isSpeaking;
              if (isMuted !== undefined) player.isMuted = isMuted;
            }

            broadcastToRoom(roomId, {
              type: 'voice_update',
              players: match.players.map((p) => ({ id: p.id, isSpeaking: p.isSpeaking, isMuted: p.isMuted })),
            });
            break;
          }

          case 'send_chat': {
            const match = activeMatches[roomId];
            if (!match) break;

            const { text } = payload;
            const sender = match.players.find((p) => p.id === userId);
            if (sender) {
              match.logs.push({
                id: `chat-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                playerName: sender.username,
                message: text,
                timestamp: Date.now(),
              });
            }

            broadcastToRoom(roomId, {
              type: 'room_update',
              matchState: match,
            });
            break;
          }

          case 'trigger_emoji': {
            const { emoji } = payload;
            const match = activeMatches[roomId!];
            if (!match) break;
            const sender = match.players.find((p) => p.id === userId);
            const senderName = sender ? sender.username : 'Oyuncu';
            broadcastToRoom(roomId!, {
              type: 'emoji_broadcast',
              userId,
              username: senderName,
              emoji
            });
            break;
          }

          // 🕵️ CASUS / GİZLİ EL: Reveal target's hand for 5s, then steal a random card
          case 'chaos_spy_peek': {
            const match = activeMatches[roomId];
            if (!match || match.status !== 'playing') break;
            if (!match.settings?.chaosSpy) break;

            const spyPlayer = match.players[match.turnIndex];
            if (spyPlayer.id !== userId) break;

            const { targetPlayerId } = payload;
            const targetPlayer = match.players.find(p => p.id === targetPlayerId);
            if (!targetPlayer || targetPlayerId === userId) break;

            // Cost: 1M from bank (cheapest money card)
            const costIdx = spyPlayer.bank
              .map((c, i) => ({ i, v: c.value }))
              .filter(x => x.v >= 1)
              .sort((a, b) => a.v - b.v)[0]?.i;

            if (costIdx === undefined) {
              ws.send(JSON.stringify({ type: 'alert', message: 'Casus Bakış için bankada yeterli para yok! (1M gerekli)' }));
              break;
            }

            const costCard = spyPlayer.bank.splice(costIdx, 1)[0];
            match.discardPile.push(costCard);

            match.logs.push({
              id: `spy-peek-${Date.now()}`,
              message: `🕵️ ${spyPlayer.username}, ${targetPlayer.username}'in kartlarına Casus Bakış yaptı! (1M ödedi)`,
              timestamp: Date.now(),
            });

            // Broadcast special spy_peek event so target's hand is revealed to the spy for 5s
            broadcastToRoom(roomId, {
              type: 'spy_peek',
              spyId: userId,
              targetId: targetPlayerId,
              targetHand: targetPlayer.hand, // Send cards only to spy
              matchState: match,
            });

            // After 5 seconds, steal a random card from target's hand
            setTimeout(() => {
              const freshMatch = activeMatches[roomId];
              if (!freshMatch) return;
              const freshTarget = freshMatch.players.find(p => p.id === targetPlayerId);
              const freshSpy = freshMatch.players.find(p => p.id === userId);
              if (!freshTarget || !freshSpy || freshTarget.hand.length === 0) return;

              const randCardIdx = Math.floor(Math.random() * freshTarget.hand.length);
              const stolenCard = freshTarget.hand.splice(randCardIdx, 1)[0];
              freshSpy.hand.push(stolenCard);

              freshMatch.logs.push({
                id: `spy-steal-${Date.now()}`,
                message: `🕵️ ${freshSpy.username}, ${freshTarget.username}'in elinden "${stolenCard.name}" kartını çaldı!`,
                timestamp: Date.now(),
              });

              broadcastToRoom(roomId, {
                type: 'room_update',
                matchState: freshMatch,
              });
            }, 5000);
            break;
          }

          // 💣 SAATLİ BOMBA PAS: Pass bomb to the next player in turn
          case 'chaos_hot_potato_pass': {
            const match = activeMatches[roomId];
            if (!match || match.status !== 'playing') break;
            if (!match.settings?.chaosHotPotato) break;
            if (!match.chaosState?.hotPotatoHolderId) break;

            // Only the current turn player can pass and they must be the bomb holder
            const passer = match.players[match.turnIndex];
            if (passer.id !== userId) break;
            if (match.chaosState.hotPotatoHolderId !== userId) break;

            // Pass to next player
            const nextIdx = (match.turnIndex + 1) % match.players.length;
            const nextPlayer = match.players[nextIdx];
            match.chaosState.hotPotatoHolderId = nextPlayer.id;

            match.logs.push({
              id: `bomb-pass-${Date.now()}`,
              message: `💣 ${passer.username}, Saatli Bombayı ${nextPlayer.username}'e paslattı! (${match.chaosState.hotPotatoTurnsLeft} tur kaldı)`,
              timestamp: Date.now(),
            });

            broadcastToRoom(roomId, {
              type: 'room_update',
              matchState: match,
            });
            break;
          }

          // 👑 KRALIN TACI: Claim the Golden Property (active player takes it)
          case 'chaos_claim_king_hill': {
            const match = activeMatches[roomId];
            if (!match || match.status !== 'playing') break;
            if (!match.settings?.chaosKingHill) break;

            const claimer = match.players[match.turnIndex];
            if (claimer.id !== userId) break;

            if (!match.chaosState) match.chaosState = {};
            const prevHolderId = match.chaosState.kingHillHolderId;
            match.chaosState.kingHillHolderId = userId;
            match.chaosState.kingHillHeldSince = match.turnNumber || 1;

            if (prevHolderId && prevHolderId !== userId) {
              const prevHolder = match.players.find(p => p.id === prevHolderId);
              match.logs.push({
                id: `king-claim-${Date.now()}`,
                message: `👑 ${claimer.username}, Altın Mülkü ${prevHolder?.username || 'rakibinden'} ele geçirdi! Artık Kral!`,
                timestamp: Date.now(),
              });
            } else {
              match.logs.push({
                id: `king-claim-${Date.now()}`,
                message: `👑 ${claimer.username}, Altın Mülkü sahiplendi! Artık Kral!`,
                timestamp: Date.now(),
              });
            }

            broadcastToRoom(roomId, {
              type: 'room_update',
              matchState: match,
            });
            break;
          }


          case 'reset_afk': {
            const match = activeMatches[roomId!];
            if (match) {
              const player = match.players.find(p => p.id === userId || (p as any).username === payload.username);
              if (player) {
                (player as any).consecutiveAfkTurns = 0;
                const wasAfk = player.isDisconnected || (player as any).isAfk || (player as any).hasAbandoned;
                if (wasAfk) {
                  player.isDisconnected = false;
                  (player as any).isAfk = false;
                  (player as any).hasAbandoned = false;
                  if (match.players[match.turnIndex]?.id === player.id) {
                    clearBotTurnTimeout(roomId!);
                    match.turnStartedAt = Date.now();
                  }
                  match.logs.push({
                    id: `afk-return-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    message: `🟢 ${player.username} oyuna geri döndü!`,
                    timestamp: Date.now(),
                  });
                  broadcastToRoom(roomId!, { type: 'room_update', matchState: match });
                }
              }
            }
            break;
          }

          case 'return_from_afk': {
            const match = activeMatches[roomId!];
            if (match) {
              const player = match.players.find(p => p.id === userId || (p as any).username === payload.username);
              if (player) {
                const wasAfk = player.isDisconnected || (player as any).isAfk || (player as any).hasAbandoned;
                player.isDisconnected = false;
                (player as any).isAfk = false;
                (player as any).hasAbandoned = false;
                (player as any).consecutiveAfkTurns = 0;
                if (match.players[match.turnIndex]?.id === player.id) {
                  clearBotTurnTimeout(roomId!);
                  match.turnStartedAt = Date.now();
                }
                if (match.activeActionRequest && match.activeActionRequest.targetPlayerId === player.id) {
                  match.actionRequestStartedAt = Date.now();
                } else if (match.activeActionRequests) {
                  const myReq = match.activeActionRequests.find(r => r.targetPlayerId === player.id);
                  if (myReq) {
                    match.actionRequestStartedAt = Date.now();
                  }
                }
                if (wasAfk) {
                  match.logs.push({
                    id: `afk-return-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    message: `🟢 ${player.username} oyuna geri döndü!`,
                    timestamp: Date.now(),
                  });
                  broadcastToRoom(roomId!, { type: 'room_update', matchState: match });
                }
              }
            }
            break;
          }

          case 'request_sync': {
            const match = activeMatches[roomId!];
            if (match) {
              ws.send(JSON.stringify({
                type: 'room_update',
                matchState: match,
              }));
            }
            break;
          }
        }
      } catch (err) {
        console.error('Error handling ws message', err);
      }
    }

    ws.on('message', async (messageStr: string) => {
      try {
        const payload = JSON.parse(messageStr);
        const { type, roomId } = payload;
        const effectiveUserId = payload.userId || clients[clientId]?.userId;

        if (roomId) {
          if (!roomLocks[roomId]) {
            roomLocks[roomId] = Promise.resolve();
          }
          roomLocks[roomId] = roomLocks[roomId].then(async () => {
            try {
              await processClientMessage(payload, effectiveUserId, roomId, clientId, ws);
            } catch (err) {
              console.error(`[Queue] Error processing message ${type} in room ${roomId}:`, err);
            }
          });
          await roomLocks[roomId];
        } else {
          await processClientMessage(payload, effectiveUserId, undefined, clientId, ws);
        }
      } catch (err) {
        console.error('Error handling ws message', err);
      }
    });

    ws.on('close', async () => {
      // Clean up matchmaking queue on disconnect and refund the wagered coins
      const matchmakingReq = matchmakingQueue.find(r => r.clientId === clientId);
      if (matchmakingReq) {
        matchmakingQueue = matchmakingQueue.filter(r => r.clientId !== clientId);
        try {
          const users = await loadUsers();
          const user = users[matchmakingReq.userId];
          if (user) {
            user.coins += matchmakingReq.entryFee;
            await saveUsers(users);
            console.log(`[Matchmaking] Player ${user.username} disconnected. Refunded ${matchmakingReq.entryFee} coins.`);
          }
        } catch (e) {
          console.error('[Matchmaking] Error refunding user on disconnect:', e);
        }
      }

      const c = clients[clientId];
      if (c) {
        await updateFriendStatus(c.userId, 'offline');
        if (c.roomId) {
          const match = activeMatches[c.roomId];
          if (match) {
            if (match.status === 'lobby') {
              const pIdx = match.players.findIndex((p) => p.id === c.userId);
              if (pIdx !== -1) {
                const removedPlayer = match.players.splice(pIdx, 1)[0];
                match.logs.push({
                  id: `leave-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                  message: `${removedPlayer.username} lobiden ayrıldı.`,
                  timestamp: Date.now(),
                });
              }
            } else {
              const disconnectedPlayer = match.players.find(p => p.id === c.userId);
              if (disconnectedPlayer) {
                disconnectedPlayer.isDisconnected = true;
                match.logs.push({
                  id: `leave-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                  message: `${disconnectedPlayer.username} bağlantısını kaybetti. Yapay zeka devralıyor.`,
                  timestamp: Date.now(),
                });

                if (match.activeActionRequest && match.activeActionRequest.targetPlayerId === disconnectedPlayer.id) {
                  const req = match.activeActionRequest;
                  const sourcePlayer = match.players.find(p => p.id === req.sourcePlayerId);
                  if (sourcePlayer && req.amountDue) {
                    processBotPayment(match, disconnectedPlayer, sourcePlayer, req.amountDue);
                  }
                  resolveActiveActionRequest(match);
                }

                if (match.activeActionRequests) {
                  const reqsToResolve = match.activeActionRequests.filter(r => r.targetPlayerId === disconnectedPlayer.id);
                  reqsToResolve.forEach(req => {
                    const sourcePlayer = match.players.find(p => p.id === req.sourcePlayerId);
                    if (sourcePlayer && req.amountDue) {
                      processBotPayment(match, disconnectedPlayer, sourcePlayer, req.amountDue);
                    }
                  });
                  match.activeActionRequests = match.activeActionRequests.filter(r => r.targetPlayerId !== disconnectedPlayer.id);
                }

                if (match.status === 'playing' && match.players[match.turnIndex]?.id === disconnectedPlayer.id) {
                  setTimeout(() => handleBotTurn(match), 1000);
                }
              }
            }

            const hasActiveHumans = match.players.some((p) => !p.isBot && !p.isDisconnected);
            if (!hasActiveHumans) {
              delete activeMatches[c.roomId];
            } else {
              broadcastToRoom(c.roomId, {
                type: 'room_update',
                matchState: match,
              });
            }
          }
        }
        delete clients[clientId];
      }
    });
  });

  // Advance match turn to next player & increment round turnNumber when full round completes
  function advanceMatchTurn(match: MatchState, reason?: string) {
    match.turnIndex = (match.turnIndex + 1) % match.players.length;
    match.actionsPlayedThisTurn = 0;
    match.turnStartedAt = Date.now();

    if (match.turnIndex === 0) {
      match.turnNumber = (match.turnNumber || 1) + 1;
      match.logs.push({
        id: `round-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        message: `🔄 ${match.turnNumber}. Tur Başladı!`,
        timestamp: Date.now(),
        turnNumber: match.turnNumber,
      });
    }

    const nextPlayer = match.players[match.turnIndex];
    match.logs.push({
      id: `turn-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      message: `Sıra ${nextPlayer.username} adlı oyuncuda.${reason ? ` (${reason})` : ''}`,
      timestamp: Date.now(),
      turnNumber: match.turnNumber || 1,
    });

    // =========================================================
    // 🌀 CHAOS MODE EFFECTS
    // =========================================================
    if (match.settings?.gameMode === 'chaos' && match.chaosState) {
      const cs = match.chaosState;

      // 👑 KING OF THE HILL: Give bonus to holder each turn
      if (match.settings.chaosKingHill && cs.kingHillHolderId) {
        const kingHolder = match.players.find(p => p.id === cs.kingHillHolderId);
        if (kingHolder) {
          // Give 2M bonus (add a 2M money card to bank)
          const bonusCard: Card = {
            id: `king-bonus-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            type: 'money',
            name: '2M (Kral Bonusu)',
            value: 2,
            description: 'Kralın Tacı bonusu!',
          };
          kingHolder.bank.push(bonusCard);
          match.logs.push({
            id: `king-bonus-log-${Date.now()}`,
            message: `👑 ${kingHolder.username} Altın Mülkü elinde tuttuğu için 2M Kral Bonusu kazandı!`,
            timestamp: Date.now(),
          });
        }
      }

      // 💣 HOT POTATO: Penalty per turn, countdown & explosion
      if (match.settings.chaosHotPotato && cs.hotPotatoHolderId) {
        const bombHolder = match.players.find(p => p.id === cs.hotPotatoHolderId);
        if (bombHolder) {
          // Deduct 1M per turn (remove cheapest money card from bank if possible)
          const cheapestMoneyIdx = bombHolder.bank
            .map((c, i) => ({ i, v: c.value }))
            .filter(x => x.v > 0)
            .sort((a, b) => a.v - b.v)[0]?.i;
          if (cheapestMoneyIdx !== undefined) {
            const penaltyCard = bombHolder.bank.splice(cheapestMoneyIdx, 1)[0];
            match.discardPile.push(penaltyCard);
            match.logs.push({
              id: `bomb-pen-${Date.now()}`,
              message: `💣 ${bombHolder.username} Saatli Bombayı tuttuğu için 1M ceza ödedi! (${cs.hotPotatoTurnsLeft} tur kaldı)`,
              timestamp: Date.now(),
            });
          } else {
            match.logs.push({
              id: `bomb-pen-nofunds-${Date.now()}`,
              message: `💣 ${bombHolder.username} Saatli Bombayı tutuyor! Ceza ödemek için para yok. (${cs.hotPotatoTurnsLeft} tur kaldı)`,
              timestamp: Date.now(),
            });
          }

          // Count down
          cs.hotPotatoTurnsLeft = (cs.hotPotatoTurnsLeft ?? 3) - 1;

          // 💥 EXPLOSION: destroy smallest non-complete property set
          if (cs.hotPotatoTurnsLeft <= 0) {
            // Find the smallest incomplete property set the holder has
            let smallestColor: string | null = null;
            let smallestCount = Infinity;
            for (const [color, propSet] of Object.entries(bombHolder.properties || {})) {
              if (propSet && !propSet.hasHotel && !propSet.hasHouse) {
                const cardCount = propSet.cards?.length || 0;
                if (cardCount > 0 && cardCount < smallestCount) {
                  smallestCount = cardCount;
                  smallestColor = color;
                }
              }
            }
            if (smallestColor && bombHolder.properties[smallestColor as keyof typeof bombHolder.properties]) {
              const destroyedSet = bombHolder.properties[smallestColor as keyof typeof bombHolder.properties];
              const cardNames = destroyedSet!.cards.map(c => c.name).join(', ');
              // Move cards to discard pile
              destroyedSet!.cards.forEach(c => match.discardPile.push(c));
              delete bombHolder.properties[smallestColor as keyof typeof bombHolder.properties];
              match.logs.push({
                id: `bomb-explode-${Date.now()}`,
                message: `💥 PATLADI! ${bombHolder.username}'in "${smallestColor}" seti yok edildi! (${cardNames})`,
                timestamp: Date.now(),
              });
            } else {
              match.logs.push({
                id: `bomb-explode-noprop-${Date.now()}`,
                message: `💥 ${bombHolder.username}'de patlayan bomba için yok edilecek set bulunamadı!`,
                timestamp: Date.now(),
              });
            }

            // Reset bomb to the next player in turn order
            const nextBombIdx = (match.players.findIndex(p => p.id === bombHolder.id) + 1) % match.players.length;
            cs.hotPotatoHolderId = match.players[nextBombIdx].id;
            cs.hotPotatoTurnsLeft = 3;
            match.logs.push({
              id: `bomb-reset-${Date.now()}`,
              message: `💣 Saatli Bomba yeniden ${match.players[nextBombIdx].username}'e düştü! 3 tur sayacı başladı.`,
              timestamp: Date.now(),
            });
          }
        }
      }
    }
    // =========================================================

    triggerDrawForActivePlayer(match);
    if (nextPlayer.isBot || nextPlayer.isDisconnected) {
      scheduleBotTurn(match, 1000);
    }
  }

  // Trigger draw for active player
  function triggerDrawForActivePlayer(match: MatchState) {
    const activePlayer = match.players[match.turnIndex];
    const serverDeck: Card[] = (match as any).serverDeck || [];

    // If deck runs out, reshuffle discard pile!
    if (serverDeck.length < 5) {
      const disc = [...match.discardPile];
      match.discardPile = [];
      if (disc.length > 0) {
        const shuffled = shuffleDeck(disc);
        serverDeck.push(...shuffled);
        match.logs.push({
          id: `reshuffle-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          message: 'Deste bitti, kartlar yeniden karıştırıldı.',
          timestamp: Date.now(),
        });
      } else {
        // EMERGENCY: Discard pile is also empty! Generate backup cards from generateDeck template
        const backupCards = shuffleDeck(generateDeck());
        serverDeck.push(...backupCards);
        match.logs.push({
          id: `emergency-deck-${Date.now()}`,
          message: '⚠️ Atık kart bulunamadı! Acil durum yedek destesi üretildi.',
          timestamp: Date.now(),
        });
      }
    }

    // Drawing rule: if player has 0 cards, draw 5, else draw 2.
    const drawCount = activePlayer.hand.length === 0 ? 5 : 2;
    const drawn = serverDeck.splice(0, drawCount);
    activePlayer.hand.push(...drawn);

    match.deckCount = serverDeck.length;
    (match as any).serverDeck = serverDeck;

    match.logs.push({
      id: `draw-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      message: `${activePlayer.username} desteden ${drawCount} kart çekti.`,
      timestamp: Date.now(),
    });
  }

  // Helper to resolve the active action request by moving to the next pending request if any
  function resolveActiveActionRequest(match: MatchState) {
    const pending = (match as any).pendingActionRequests || [];
    if (pending.length > 0) {
      match.activeActionRequest = pending.shift();
      (match as any).pendingActionRequests = pending;
      match.actionRequestStartedAt = Date.now();
    } else {
      match.activeActionRequest = undefined;
      match.actionRequestStartedAt = undefined;
    }
  }

  // Handle action cards execution on server
  async function processActionCard(match: MatchState, player: GamePlayer, card: Card, payload: any) {
    if (card.actionType === 'pass-go') {
      const serverDeck: Card[] = (match as any).serverDeck || [];
      const drawn = serverDeck.splice(0, 2);
      player.hand.push(...drawn);
      match.deckCount = serverDeck.length;
      match.logs.push({
        id: `passgo-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        message: `${player.username} Başlangıç Noktasından Geçti ve 2 kart çekti!`,
        timestamp: Date.now(),
      });
    } else if (card.actionType === 'birthday') {
      // Demand 2M from all other opponent players (exclude teammate in 2v2)
      const is2v2 = match.settings?.gameMode === '2v2_team';
      const playerTeam = player.team || (match.players.indexOf(player) % 2 === 0 ? 'team_blue' : 'team_red');
      const isTeammate = (p: GamePlayer) => (p.team || (match.players.indexOf(p) % 2 === 0 ? 'team_blue' : 'team_red')) === playerTeam;
      const targetPlayers = match.players.filter((p) => p.id !== player.id && (!is2v2 || !isTeammate(p)));

      const pending: ActionRequest[] = [];
      targetPlayers.forEach((tp) => {
        // Create action request
        if (tp.isBot || tp.isDisconnected) {
          // Bots or disconnected players respond instantly
          processBotPayment(match, tp, player, 2);
        } else {
          pending.push({
            id: `req-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            type: 'make-payment',
            sourcePlayerId: player.id,
            targetPlayerId: tp.id,
            actionCard: card,
            amountDue: 2,
          });
        }
      });
      match.activeActionRequests = pending;
      match.activeActionRequest = undefined;
      if (pending.length > 0) {
        match.actionRequestStartedAt = Date.now();
      }
      match.logs.push({
        id: `birthday-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        message: `${player.username} Bugün Benim Doğum Günüm kartını oynadı! ${is2v2 ? 'Rakiplerden' : 'Herkesten'} 2M talep ediyor.`,
        timestamp: Date.now(),
      });
    } else if (card.actionType === 'debt-collector') {
      // Demand 5M from a specific player (must not be teammate)
      const is2v2 = match.settings?.gameMode === '2v2_team';
      const playerTeam = player.team || (match.players.indexOf(player) % 2 === 0 ? 'team_blue' : 'team_red');
      const isTeammate = (p: GamePlayer) => (p.team || (match.players.indexOf(p) % 2 === 0 ? 'team_blue' : 'team_red')) === playerTeam;

      const targetId = payload.targetPlayerId || match.players.find((p) => p.id !== player.id && (!is2v2 || !isTeammate(p)))?.id;
      if (!targetId) return;

      const targetPlayer = match.players.find((p) => p.id === targetId);
      if (targetPlayer) {
        if (is2v2 && isTeammate(targetPlayer)) return; // Prevent friendly fire

        if (targetPlayer.isBot || targetPlayer.isDisconnected) {
          processBotPayment(match, targetPlayer, player, 5);
        } else {
          match.activeActionRequest = {
            id: `req-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            type: 'make-payment',
            sourcePlayerId: player.id,
            targetPlayerId: targetId,
            actionCard: card,
            amountDue: 5,
          };
          match.actionRequestStartedAt = Date.now();
        }
        match.logs.push({
          id: `debt-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          message: `${player.username}, ${targetPlayer.username} adlı oyuncudan 5M borç tahsilatı talep ediyor!`,
          timestamp: Date.now(),
        });
      }
    } else if (card.type === 'rent') {
      // Charge Rent
      const is2v2 = match.settings?.gameMode === '2v2_team';
      const playerTeam = player.team || (match.players.indexOf(player) % 2 === 0 ? 'team_blue' : 'team_red');
      const isTeammate = (p: GamePlayer) => (p.team || (match.players.indexOf(p) % 2 === 0 ? 'team_blue' : 'team_red')) === playerTeam;

      const chosenColor = payload.extraColor || payload.color || card.color || 'brown';
      const setKeys = getAllSetKeysForColor(player.properties, chosenColor);
      let targetSetKey = payload.targetSetKey || chosenColor;
      let maxRentVal = 0;

      if (setKeys.length > 0) {
        for (const sKey of setKeys) {
          const sObj = player.properties[sKey];
          if (sObj && sObj.cards.length > 0) {
            const count = Math.min(sObj.cards.length, MAX_IN_SET[chosenColor]);
            let r = RENT_VALUES[chosenColor][count - 1] || 1;
            if (sObj.cards.length >= MAX_IN_SET[chosenColor]) {
              if (sObj.hasHouse) r += 3;
              if (sObj.hasHotel) r += 4;
            }
            if (r >= maxRentVal) {
              maxRentVal = r;
              targetSetKey = sKey;
            }
          }
        }
      }

      const propSet = player.properties[targetSetKey];
      if (propSet && propSet.cards.length > 0) {
        const count = Math.min(propSet.cards.length, MAX_IN_SET[chosenColor]);
        let rentVal = RENT_VALUES[chosenColor][count - 1] || 1;

        // Apply house/hotel bonuses
        if (propSet.hasHouse) rentVal += 3;
        if (propSet.hasHotel) rentVal += 4;

        if (payload.isDoubleRent) {
          rentVal *= 2;
        }

        const isWildRent = card.name === 'Her Renk Kira Kartı' || !card.color;
        if (isWildRent) {
          // Collect from ONLY one opponent player
          const targetId = payload.targetPlayerId || match.players.find((p) => p.id !== player.id && (!is2v2 || !isTeammate(p)))?.id;
          if (targetId) {
            const tp = match.players.find((p) => p.id === targetId);
            if (tp && (!is2v2 || !isTeammate(tp))) {
              if (tp.isBot || tp.isDisconnected) {
                processBotPayment(match, tp, player, rentVal);
                match.activeActionRequest = undefined;
              } else {
                match.activeActionRequest = {
                  id: `req-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                  type: 'make-payment',
                  sourcePlayerId: player.id,
                  targetPlayerId: targetId,
                  actionCard: card,
                  amountDue: rentVal,
                  chosenColor: chosenColor,
                };
                match.actionRequestStartedAt = Date.now();
              }
              match.logs.push({
                id: `rent-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                message: `${player.username}, ${COLOR_LABELS[chosenColor]} mülkleri için ${tp.username} oyuncusundan ${rentVal}M kira talep etti!`,
                timestamp: Date.now(),
              });
            }
          }
        } else {
          // Collect from OPPONENTS (in 2v2, teammates are excluded!)
          const targetPlayers = match.players.filter((p) => p.id !== player.id && (!is2v2 || !isTeammate(p)));
          const pending: ActionRequest[] = [];
          targetPlayers.forEach((tp) => {
            if (tp.isBot || tp.isDisconnected) {
              processBotPayment(match, tp, player, rentVal);
            } else {
              pending.push({
                id: `req-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                type: 'make-payment',
                sourcePlayerId: player.id,
                targetPlayerId: tp.id,
                actionCard: card,
                amountDue: rentVal,
                chosenColor: chosenColor,
              });
            }
          });
          match.activeActionRequests = pending;
          match.activeActionRequest = undefined;
          if (pending.length > 0) {
            match.actionRequestStartedAt = Date.now();
          }
          match.logs.push({
            id: `rent-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            message: `${player.username}, ${COLOR_LABELS[chosenColor]} mülkleri için ${is2v2 ? 'rakip takımdan' : 'herkesten'} ${rentVal}M kira talep etti!`,
            timestamp: Date.now(),
          });
        }
      } else {
        match.logs.push({
          id: `rent-fail-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          message: `${player.username} mülkü olmadığı için kira tahsil edemedi.`,
          timestamp: Date.now(),
        });
      }
    } else if (card.actionType === 'sly-deal') {
      const targetId = payload.targetPlayerId;
      const cardIdToSteal = payload.targetCardId;
      if (!targetId || !cardIdToSteal) return;

      const targetPlayer = match.players.find((p) => p.id === targetId);
      if (targetPlayer) {
        if (targetPlayer.isBot || targetPlayer.isDisconnected) {
          // Execute immediately for bots
          let stolenCard: Card | null = null;
          for (const colKey in targetPlayer.properties) {
            const propSet = targetPlayer.properties[colKey];
            const baseCol = getBaseColor(colKey);
            if (propSet && propSet.cards.length < MAX_IN_SET[baseCol]) {
              const idx = propSet.cards.findIndex((c) => c.id === cardIdToSteal);
              if (idx !== -1) {
                stolenCard = propSet.cards.splice(idx, 1)[0];
                if (propSet.cards.length === 0) {
                  delete targetPlayer.properties[colKey];
                }
                break;
              }
            }
          }
          if (stolenCard) {
            const col = stolenCard.color || 'brown';
            const targetSetKey = findAvailableSetKey(player.properties, col);
            if (!player.properties[targetSetKey]) {
              player.properties[targetSetKey] = { cards: [], hasHouse: false, hasHotel: false };
            }
            player.properties[targetSetKey]!.cards.push(stolenCard);
            match.logs.push({
              id: `sly-${Date.now()}`,
              message: `${player.username}, ${targetPlayer.username}'den ${stolenCard.name} mülkünü sinsi anlaşma ile çaldı!`,
              timestamp: Date.now(),
            });
            if (checkWinnerForMatch(match, player)) {
              await handleMatchWinner(match, player.id);
            }
          }
        } else {
          // Trigger defense phase for active players!
          match.activeActionRequest = {
            id: `req-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            type: 'just-say-no',
            sourcePlayerId: player.id,
            targetPlayerId: targetId,
            actionCard: card,
            amountDue: 0,
            targetCardId: cardIdToSteal,
            originalAction: {
              type: 'sly-deal',
              payload: { targetPlayerId: targetId, targetCardId: cardIdToSteal }
            },
            jsnCount: 0
          };
          match.actionRequestStartedAt = Date.now();
          match.logs.push({
            id: `sly-req-${Date.now()}`,
            message: `📣 ${player.username}, ${targetPlayer.username} adlı oyuncunun mülkünü Sinsi Anlaşma ile çalmak istiyor!`,
            timestamp: Date.now(),
          });
        }
      }
    } else if (card.actionType === 'deal-breaker') {
      const targetId = payload.targetPlayerId;
      const targetColor = (payload.targetSetKey || payload.targetColor) as string;
      if (!targetId || !targetColor) return;

      const targetPlayer = match.players.find((p) => p.id === targetId);
      if (targetPlayer) {
        if (targetPlayer.isBot || targetPlayer.isDisconnected) {
          const propSet = targetPlayer.properties[targetColor];
          if (propSet) {
            const baseCol = getBaseColor(targetColor);
            const myTargetKey = findAvailableSetKey(player.properties, baseCol);
            player.properties[myTargetKey] = propSet;
            delete targetPlayer.properties[targetColor];
            match.logs.push({
              id: `db-${Date.now()}`,
              message: `${player.username}, ${targetPlayer.username} adlı oyuncunun tamamlanmış ${getSetDisplayName(targetColor)} setini Anlaşma Bozan kartı ile çaldı!`,
              timestamp: Date.now(),
            });
            if (checkWinnerForMatch(match, player)) {
              await handleMatchWinner(match, player.id);
            }
          }
        } else {
          // Trigger defense phase
          match.activeActionRequest = {
            id: `req-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            type: 'just-say-no',
            sourcePlayerId: player.id,
            targetPlayerId: targetId,
            actionCard: card,
            amountDue: 0,
            targetColor: targetColor as any,
            targetSetKey: targetColor,
            originalAction: {
              type: 'deal-breaker',
              payload: { targetPlayerId: targetId, targetColor: targetColor, targetSetKey: targetColor }
            },
            jsnCount: 0
          };
          match.actionRequestStartedAt = Date.now();
          match.logs.push({
            id: `db-req-${Date.now()}`,
            message: `📣 ${player.username}, ${targetPlayer.username} adlı oyuncunun tamamlanmış ${getSetDisplayName(targetColor)} setini çalan bir Anlaşma Bozan kartı oynadı!`,
            timestamp: Date.now(),
          });
        }
      }
    } else if (card.actionType === 'forced-deal') {
      const targetId = payload.targetPlayerId;
      const cardIdToSteal = payload.targetCardId;
      const myCardIdToGive = payload.myCardId;
      if (!targetId || !cardIdToSteal || !myCardIdToGive) return;

      const targetPlayer = match.players.find((p) => p.id === targetId);
      if (targetPlayer) {
        if (targetPlayer.isBot || targetPlayer.isDisconnected) {
          // Execute immediately
          let stolenCard: Card | null = null;
          let givenCard: Card | null = null;
          let stolenColor: CardColor | null = null;
          let givenColor: CardColor | null = null;

          for (const colKey in targetPlayer.properties) {
            const propSet = targetPlayer.properties[colKey];
            if (propSet) {
              const idx = propSet.cards.findIndex((c) => c.id === cardIdToSteal);
              if (idx !== -1) {
                stolenCard = propSet.cards.splice(idx, 1)[0];
                stolenColor = getBaseColor(colKey);
                if (propSet.cards.length === 0) {
                  delete targetPlayer.properties[colKey];
                }
                break;
              }
            }
          }

          for (const colKey in player.properties) {
            const propSet = player.properties[colKey];
            if (propSet) {
              const idx = propSet.cards.findIndex((c) => c.id === myCardIdToGive);
              if (idx !== -1) {
                givenCard = propSet.cards.splice(idx, 1)[0];
                givenColor = getBaseColor(colKey);
                if (propSet.cards.length === 0) {
                  delete player.properties[colKey];
                }
                break;
              }
            }
          }

          if (stolenCard && givenCard) {
            const colS = stolenCard.color || stolenColor || 'brown';
            const sTargetKey = findAvailableSetKey(player.properties, colS);
            if (!player.properties[sTargetKey]) {
              player.properties[sTargetKey] = { cards: [], hasHouse: false, hasHotel: false };
            }
            player.properties[sTargetKey]!.cards.push(stolenCard);

            const colG = givenCard.color || givenColor || 'brown';
            const gTargetKey = findAvailableSetKey(targetPlayer.properties, colG);
            if (!targetPlayer.properties[gTargetKey]) {
              targetPlayer.properties[gTargetKey] = { cards: [], hasHouse: false, hasHotel: false };
            }
            targetPlayer.properties[gTargetKey]!.cards.push(givenCard);

            match.logs.push({
              id: `forced-${Date.now()}`,
              message: `${player.username}, ${targetPlayer.username} ile ${stolenCard.name} karşılığında ${givenCard.name} mülkünü takas etti!`,
              timestamp: Date.now(),
            });

            if (checkWinnerForMatch(match, player)) {
              await handleMatchWinner(match, player.id);
            }
            if (checkWinnerForMatch(match, targetPlayer)) {
              await handleMatchWinner(match, targetPlayer.id);
            }
          }
        } else {
          // Trigger defense phase
          let targetCardObj: Card | null = null;
          let myCardObj: Card | null = null;
          for (const colKey in targetPlayer.properties) {
            const cardFound = targetPlayer.properties[colKey as CardColor]?.cards.find((c) => c.id === cardIdToSteal);
            if (cardFound) {
              targetCardObj = cardFound;
              break;
            }
          }
          for (const colKey in player.properties) {
            const cardFound = player.properties[colKey as CardColor]?.cards.find((c) => c.id === myCardIdToGive);
            if (cardFound) {
              myCardObj = cardFound;
              break;
            }
          }

          match.activeActionRequest = {
            id: `req-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            type: 'just-say-no',
            sourcePlayerId: player.id,
            targetPlayerId: targetId,
            actionCard: card,
            amountDue: 0,
            targetCardId: cardIdToSteal,
            myCardId: myCardIdToGive,
            originalAction: {
              type: 'forced-deal',
              payload: { targetPlayerId: targetId, targetCardId: cardIdToSteal, myCardId: myCardIdToGive }
            },
            jsnCount: 0
          };
          match.logs.push({
            id: `forced-req-${Date.now()}`,
            message: `📣 ${player.username}, ${targetPlayer.username} ile ${myCardObj ? myCardObj.name : myCardIdToGive} mülkü karşılığında ${targetCardObj ? targetCardObj.name : cardIdToSteal} mülkünü Zoraki Takas ile değiştirmek istiyor!`,
            timestamp: Date.now(),
          });
        }
      }
    }

    if (match.activeActionRequest || (match.activeActionRequests && match.activeActionRequests.length > 0)) {
      match.actionRequestStartedAt = Date.now();
    } else {
      match.actionRequestStartedAt = undefined;
    }
  }

  // Direct bot payment simulator for fast turns
  function processBotPayment(match: MatchState, bot: GamePlayer, receiver: GamePlayer, amount: number) {
    let accumulated = 0;
    const cardsPaid: Card[] = [];

    // Bank pay
    const bCopy = [...bot.bank];
    for (const card of bCopy) {
      if (accumulated >= amount) break;
      const idx = bot.bank.findIndex((c) => c.id === card.id);
      if (idx !== -1) {
        bot.bank.splice(idx, 1);
        accumulated += card.value;
        cardsPaid.push(card);
      }
    }

    // Properties pay if bank was insufficient
    if (accumulated < amount) {
      for (const colKey in bot.properties) {
        if (accumulated >= amount) break;
        const col = colKey as CardColor;
        const propSet = bot.properties[col];
        if (propSet) {
          const pCopy = [...propSet.cards];
          for (const card of pCopy) {
            if (accumulated >= amount) break;
            const idx = propSet.cards.findIndex((c) => c.id === card.id);
            if (idx !== -1) {
              propSet.cards.splice(idx, 1);
              accumulated += card.value;
              cardsPaid.push(card);
            }
          }
        }
      }
    }

    // Give payment to receiver
    cardsPaid.forEach((card) => {
      if (card.type === 'property' || card.type === 'wildcard') {
        const col = card.color || 'brown';
        if (!receiver.properties[col]) {
          receiver.properties[col] = { cards: [], hasHouse: false, hasHotel: false };
        }
        receiver.properties[col]!.cards.push(card);
      } else {
        receiver.bank.push(card);
      }
    });

    match.logs.push({
      id: `bot-pay-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      message: `${bot.username}, ${receiver.username} oyuncusuna ${accumulated}M ödeme yaptı.`,
      timestamp: Date.now(),
    });
  }



  function scheduleBotTurn(match: MatchState, delay = 1000) {
    const roomId = match.roomId;
    clearBotTurnTimeout(roomId);
    const timer = setTimeout(async () => {
      botTurnTimeouts.delete(roomId);
      await handleBotTurn(match);
    }, delay);
    botTurnTimeouts.set(roomId, timer);
  }

  // Direct bot turn automation
  async function handleBotTurn(match: MatchState) {
    if (match.status !== 'playing') return;

    const hasActiveAction = match.activeActionRequest || (match.activeActionRequests && match.activeActionRequests.length > 0);
    if (hasActiveAction) return;

    const bot = match.players[match.turnIndex];
    if (!bot || (!bot.isBot && !bot.isDisconnected)) return;

    while (match.actionsPlayedThisTurn < 3) {
      // Re-verify match status and active player after delay
      if (match.status !== 'playing') break;
      const currentBot = match.players[match.turnIndex];
      if (!currentBot || currentBot.id !== bot.id) break;
      const hasActiveAction = match.activeActionRequest || (match.activeActionRequests && match.activeActionRequests.length > 0);
      if (hasActiveAction) break;

      const decision = BotEngine.selectPlayAction(bot, match);
      if (!decision) break;

      const cardIdx = bot.hand.findIndex((c) => c.id === decision.cardId);
      if (cardIdx === -1) break;

      const card = bot.hand[cardIdx];

      if (decision.targetZone === 'bank') {
        bot.hand.splice(cardIdx, 1);
        bot.bank.push(card);
        match.actionsPlayedThisTurn++;
        match.logs.push({
          id: `bot-play-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          message: `${bot.username} bankaya ${card.value}M para ekledi.`,
          timestamp: Date.now(),
        });
      } else if (decision.targetZone === 'property') {
        bot.hand.splice(cardIdx, 1);
        const col = decision.extraColor || card.color || 'brown';
        if (!bot.properties[col]) {
          bot.properties[col] = { cards: [], hasHouse: false, hasHotel: false };
        }
        bot.properties[col]!.cards.push({ ...card, color: col });
        match.actionsPlayedThisTurn++;
        match.logs.push({
          id: `bot-play-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          message: `${bot.username}, ${COLOR_LABELS[col]} grubuna ${card.name} yerleştirdi.`,
          timestamp: Date.now(),
        });

        if (checkWinnerForMatch(match, bot)) {
          await handleMatchWinner(match, bot.id);
          broadcastToRoom(match.roomId, { type: 'room_update', matchState: match });
          return;
        }
      } else if (decision.targetZone === 'action') {
        bot.hand.splice(cardIdx, 1);
        match.discardPile.push(card);
        match.actionsPlayedThisTurn++;
        match.logs.push({
          id: `bot-play-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          message: `${bot.username} aksiyon kartı oynadı: ${card.name}`,
          timestamp: Date.now(),
        });

        await processActionCard(match, bot, card, {
          ...decision.payload,
          extraColor: decision.extraColor
        });
      }

      // Check if this action created an active action request targeting a human
      const hasActiveActionNow = match.activeActionRequest || (match.activeActionRequests && match.activeActionRequests.length > 0);
      if (hasActiveActionNow) {
        // Pause bot turn immediately to let humans respond.
        broadcastToRoom(match.roomId, { type: 'room_update', matchState: match });
        return;
      }

      // Broadcast current state change immediately
      broadcastToRoom(match.roomId, { type: 'room_update', matchState: match });

      // Wait 1.5 seconds before the next action to let players follow the game
      if (match.actionsPlayedThisTurn < 3) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }

    // End Bot Turn
    setTimeout(() => {
      // Discard excess
      while (bot.hand.length > 7) {
        const discarded = bot.hand.splice(0, 1)[0];
        match.discardPile.push(discarded);
        match.logs.push({
          id: `bot-disc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          message: `${bot.username} elinden ${discarded.name} kartını attı.`,
          timestamp: Date.now(),
        });
      }

      advanceMatchTurn(match);
      broadcastToRoom(match.roomId, { type: 'room_update', matchState: match });
    }, 1000);
  }

  function getMatchTurnLimitSeconds(match: any): number | null {
    const limit = match?.settings?.turnLimit;
    if (limit === '15s') return 15;
    if (limit === '30s') return 30;
    if (limit === '1m') return 60;
    if (limit === 'unlimited') return null;
    return globalAdminSettings.turnTimeoutSeconds || 35;
  }

  // Broadcast helper
  function broadcastToRoom(roomId: string, message: any) {
    let payloadToSend = message;
    if (message && message.type === 'room_update' && message.matchState) {
      const match = message.matchState;
      if (match.players) {
        match.players.forEach((p: any) => {
          p.properties = sanitizePropertySets(p.properties);
        });
      }
      const now = Date.now();
      const hasActiveAction = match.activeActionRequest || (match.activeActionRequests && match.activeActionRequests.length > 0);
      const actionDurationLimit = (globalAdminSettings.actionTimeoutSeconds || 20) * 1000;

      if (hasActiveAction && match.actionRequestStartedAt) {
        match.actionTimeLeft = Math.max(0, Math.ceil((actionDurationLimit - (now - match.actionRequestStartedAt)) / 1000));
      } else {
        match.actionTimeLeft = null;
      }

      const turnLimitSec = getMatchTurnLimitSeconds(match);
      if (turnLimitSec !== null && match.turnStartedAt) {
        match.turnTimeLeft = Math.max(0, Math.ceil((turnLimitSec * 1000 - (now - match.turnStartedAt)) / 1000));
      } else {
        match.turnTimeLeft = null;
      }

      payloadToSend = {
        ...message,
        checksum: calculateMatchChecksum(message.matchState)
      };
    }
    Object.values(clients).forEach((client) => {
      if (client.roomId === roomId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(payloadToSend));
      }
    });
  }

  // Update online presence for friends panel
  async function updateFriendStatus(userId: string, status: 'online' | 'offline' | 'in_game') {
    const users = await loadUsers();
    const user = users[userId];
    if (user) {
      Object.values(users).forEach((u) => {
        const fr = u.friends.find((f) => f.id === userId);
        if (fr) {
          fr.status = status;
        }
      });
      await saveUsers(users);
    }
  }



  // Start background room tick timer for turn timeouts and action timeouts
  setInterval(() => {
    const now = Date.now();
    for (const roomId in activeMatches) {
      const match = activeMatches[roomId];
      if (!match || match.status !== 'playing') continue;

      const activePlayer = match.players[match.turnIndex];
      if (!activePlayer) continue;

      // Pause the turn timer if there are active action requests/payments/JSN defenses in progress
      const hasActiveAction = match.activeActionRequest || (match.activeActionRequests && match.activeActionRequests.length > 0);
      if (hasActiveAction) {
        match.turnStartedAt = now;
      }

      // Calculate remaining action time
      const actionDurationLimit = (globalAdminSettings.actionTimeoutSeconds || 20) * 1000;
      if (hasActiveAction && match.actionRequestStartedAt) {
        match.actionTimeLeft = Math.max(0, Math.ceil((actionDurationLimit - (now - match.actionRequestStartedAt)) / 1000));
      } else {
        match.actionTimeLeft = null;
      }

      // Calculate remaining turn time
      const turnLimitSec = getMatchTurnLimitSeconds(match);
      if (turnLimitSec !== null && match.turnStartedAt) {
        match.turnTimeLeft = Math.max(0, Math.ceil((turnLimitSec * 1000 - (now - match.turnStartedAt)) / 1000));
      } else {
        match.turnTimeLeft = null;
      }

      // 1. Turn Timeout (e.g. 35 seconds per turn or room limit)
      if (turnLimitSec !== null && match.turnStartedAt && (now - match.turnStartedAt > turnLimitSec * 1000)) {
        match.logs.push({
          id: `afk-turn-${Date.now()}`,
          message: `⏱️ ${activePlayer.username} süre aşımı nedeniyle sırasını kaybetti! Sıra devrediliyor.`,
          timestamp: Date.now()
        });

        // Force discard if hand > 7
        while (activePlayer.hand.length > 7) {
          const discarded = activePlayer.hand.splice(0, 1)[0];
          match.discardPile.push(discarded);
        }

        advanceMatchTurn(match, 'süre doldu');
        broadcastToRoom(roomId, { type: 'room_update', matchState: match });
        continue;
      }

      // 2. Active Action Request Timeout (e.g. 20 seconds for JSN/payment response)
      if (match.activeActionRequest && match.actionRequestStartedAt && (now - match.actionRequestStartedAt > actionDurationLimit)) {
        const req = match.activeActionRequest;
        const targetPlayer = match.players.find(p => p.id === req.targetPlayerId);
        const sourcePlayer = match.players.find(p => p.id === req.sourcePlayerId);

        if (targetPlayer && sourcePlayer) {
          match.logs.push({
            id: `afk-action-${Date.now()}`,
            message: `⏱️ ${targetPlayer.username} yanıt süresini aştı! Sistem otomatik karar alıyor.`,
            timestamp: Date.now()
          });

          if (req.originalAction) {
            executeOriginalActionServer(match, req);
          } else if (req.amountDue) {
            processBotPayment(match, targetPlayer, sourcePlayer, req.amountDue);
          }

          resolveActiveActionRequest(match);
          match.actionRequestStartedAt = undefined;

          // Auto end turn check
          const activePlayer = match.players[match.turnIndex];
          const hasActiveAction = match.activeActionRequest || (match.activeActionRequests && match.activeActionRequests.length > 0);
          if (!hasActiveAction && match.actionsPlayedThisTurn >= 3 && activePlayer) {
            if (activePlayer.hand.length <= 7) {
              advanceMatchTurn(match, '3 hamle tamamlandı');
            }
          }

          // If it's a bot's turn and they have more actions left, resume their turn simulation!
          if (!hasActiveAction && match.actionsPlayedThisTurn < 3 && activePlayer && (activePlayer.isBot || activePlayer.isDisconnected)) {
            scheduleBotTurn(match, 1000);
          }

          broadcastToRoom(roomId, { type: 'room_update', matchState: match });
        }
      }

      // 2.1 Multi Action Requests Timeout (Birthday / Rent)
      if (match.activeActionRequests && match.activeActionRequests.length > 0 && match.actionRequestStartedAt && (now - match.actionRequestStartedAt > actionDurationLimit)) {
        match.logs.push({
          id: `afk-multi-action-${Date.now()}`,
          message: `⏱️ Bazı oyuncular yanıt süresini aştı! Sistem otomatik ödeme yaptı.`,
          timestamp: Date.now()
        });

        match.activeActionRequests.forEach((req) => {
          const targetPlayer = match.players.find(p => p.id === req.targetPlayerId);
          const sourcePlayer = match.players.find(p => p.id === req.sourcePlayerId);
          if (targetPlayer && sourcePlayer && req.amountDue) {
            processBotPayment(match, targetPlayer, sourcePlayer, req.amountDue);
          }
        });

        match.activeActionRequests = undefined;
        match.actionRequestStartedAt = undefined;

        // Auto end turn check
        const activePlayer = match.players[match.turnIndex];
        const hasActiveAction = match.activeActionRequest || (match.activeActionRequests && match.activeActionRequests.length > 0);
        if (!hasActiveAction && match.actionsPlayedThisTurn >= 3 && activePlayer) {
          if (activePlayer.hand.length <= 7) {
            advanceMatchTurn(match, '3 hamle tamamlandı');
          }
        }

        // If it's a bot's turn and they have more actions left, resume their turn simulation!
        if (!hasActiveAction && match.actionsPlayedThisTurn < 3 && activePlayer && (activePlayer.isBot || activePlayer.isDisconnected)) {
          scheduleBotTurn(match, 1000);
        }

        broadcastToRoom(roomId, { type: 'room_update', matchState: match });
      }
    }
  }, 1000);

  // Vite middleware for development / Static file serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Deal Master PRO Deal running on http://0.0.0.0:${PORT}`);
  });
}

async function executeOriginalActionServer(match: any, req: any) {
  const sourcePlayer = match.players.find((p: any) => p.id === req.sourcePlayerId);
  const targetPlayer = match.players.find((p: any) => p.id === req.targetPlayerId);
  if (!sourcePlayer || !targetPlayer) return;

  const type = req.originalAction?.type || req.actionCard?.actionType || req.actionCard?.type;
  if (!type) return;

  if (type === 'sly-deal') {
    const cardIdToSteal = req.targetCardId;
    let stolenCard: Card | null = null;
    let stolenColor: CardColor | null = null;

    for (const colKey in targetPlayer.properties) {
      const propSet = targetPlayer.properties[colKey];
      if (propSet) {
        const idx = propSet.cards.findIndex((c: any) => c.id === cardIdToSteal);
        if (idx !== -1) {
          stolenCard = propSet.cards.splice(idx, 1)[0];
          stolenColor = getBaseColor(colKey);
          if (propSet.cards.length === 0) {
            delete targetPlayer.properties[colKey];
          }
          break;
        }
      }
    }

    if (stolenCard) {
      const col = stolenCard.color || stolenColor || 'brown';
      const targetSetKey = findAvailableSetKey(sourcePlayer.properties, col);
      if (!sourcePlayer.properties[targetSetKey]) {
        sourcePlayer.properties[targetSetKey] = { cards: [], hasHouse: false, hasHotel: false };
      }
      sourcePlayer.properties[targetSetKey]!.cards.push(stolenCard);

      match.logs.push({
        id: `sly-res-${Date.now()}`,
        message: `${sourcePlayer.username}, ${targetPlayer.username}'den ${stolenCard.name} mülkünü sinsi anlaşma ile aldı!`,
        timestamp: Date.now(),
      });

      if (checkWinnerForMatch(match, sourcePlayer)) {
        await handleMatchWinner(match, sourcePlayer.id);
      }
    }

  } else if (type === 'deal-breaker') {
    const targetSetKey = req.targetSetKey || req.targetColor;
    if (targetSetKey) {
      const propSet = targetPlayer.properties[targetSetKey];
      if (propSet) {
        const baseCol = getBaseColor(targetSetKey);
        const myTargetKey = findAvailableSetKey(sourcePlayer.properties, baseCol);
        sourcePlayer.properties[myTargetKey] = { ...propSet };
        delete targetPlayer.properties[targetSetKey];

        match.logs.push({
          id: `db-res-${Date.now()}`,
          message: `${sourcePlayer.username}, ${targetPlayer.username} adlı oyuncunun tamamlanmış ${getSetDisplayName(targetSetKey)} setini çaldı!`,
          timestamp: Date.now(),
        });

        if (checkWinnerForMatch(match, sourcePlayer)) {
          await handleMatchWinner(match, sourcePlayer.id);
        }
      }
    }

  } else if (type === 'forced-deal') {
    const cardIdToSteal = req.targetCardId;
    const myCardIdToGive = req.myCardId;

    let stolenCard: Card | null = null;
    let givenCard: Card | null = null;
    let stolenColor: CardColor | null = null;
    let givenColor: CardColor | null = null;

    for (const colKey in targetPlayer.properties) {
      const propSet = targetPlayer.properties[colKey];
      if (propSet) {
        const idx = propSet.cards.findIndex((c: any) => c.id === cardIdToSteal);
        if (idx !== -1) {
          stolenCard = propSet.cards.splice(idx, 1)[0];
          stolenColor = getBaseColor(colKey);
          if (propSet.cards.length === 0) {
            delete targetPlayer.properties[colKey];
          }
          break;
        }
      }
    }

    for (const colKey in sourcePlayer.properties) {
      const propSet = sourcePlayer.properties[colKey];
      if (propSet) {
        const idx = propSet.cards.findIndex((c: any) => c.id === myCardIdToGive);
        if (idx !== -1) {
          givenCard = propSet.cards.splice(idx, 1)[0];
          givenColor = getBaseColor(colKey);
          if (propSet.cards.length === 0) {
            delete sourcePlayer.properties[colKey];
          }
          break;
        }
      }
    }

    if (stolenCard && givenCard) {
      const colS = stolenCard.color || stolenColor || 'brown';
      const sTargetKey = findAvailableSetKey(sourcePlayer.properties, colS);
      if (!sourcePlayer.properties[sTargetKey]) {
        sourcePlayer.properties[sTargetKey] = { cards: [], hasHouse: false, hasHotel: false };
      }
      sourcePlayer.properties[sTargetKey]!.cards.push(stolenCard);

      const colG = givenCard.color || givenColor || 'brown';
      const gTargetKey = findAvailableSetKey(targetPlayer.properties, colG);
      if (!targetPlayer.properties[gTargetKey]) {
        targetPlayer.properties[gTargetKey] = { cards: [], hasHouse: false, hasHotel: false };
      }
      targetPlayer.properties[gTargetKey]!.cards.push(givenCard);

      match.logs.push({
        id: `forced-res-${Date.now()}`,
        message: `${sourcePlayer.username}, ${targetPlayer.username} ile ${stolenCard.name} karşılığında ${givenCard.name} kartını takas etti!`,
        timestamp: Date.now(),
      });

      if (checkWinnerForMatch(match, sourcePlayer)) {
        await handleMatchWinner(match, sourcePlayer.id);
      }
      if (checkWinnerForMatch(match, targetPlayer)) {
        await handleMatchWinner(match, targetPlayer.id);
      }
    }
  }
}

startServer().catch((err) => {
  console.error('Failed to start fullstack server:', err);
});

// Calculate non-winner end game rankings using Win-Proximity score
function calculateLoserScores(match: any, winnerId: string) {
  const players = match.players || [];
  const losers = players.filter((p: any) => p.id !== winnerId);

  const completeSetWeight = (globalAdminSettings as any).rankedCompleteSetWeight ?? 50;
  const incompletePropWeight = (globalAdminSettings as any).rankedIncompletePropWeight ?? 2;
  const bankCashWeight = (globalAdminSettings as any).rankedBankCashWeight ?? 1;

  losers.forEach((player: any) => {
    let score = 0;

    // 1. Complete Sets (50 pts per completed set)
    let completeSetsCount = 0;
    if (player.properties) {
      Object.keys(player.properties).forEach((colorKey) => {
        const propGroup = player.properties[colorKey];
        if (!propGroup || !propGroup.cards || propGroup.cards.length === 0) return;
        const maxInSet = propGroup.cards[0]?.maxInSet || 3;
        if (propGroup.cards.length >= maxInSet) {
          completeSetsCount++;
        }
      });
    }
    score += (completeSetsCount * completeSetWeight);

    // 2. Incomplete Property Values (M value x 2)
    let incompletePropValue = 0;
    if (player.properties) {
      Object.keys(player.properties).forEach((colorKey) => {
        const propGroup = player.properties[colorKey];
        if (!propGroup || !propGroup.cards || propGroup.cards.length === 0) return;
        const maxInSet = propGroup.cards[0]?.maxInSet || 3;
        if (propGroup.cards.length < maxInSet) {
          propGroup.cards.forEach((c: any) => {
            incompletePropValue += (c.value || 0);
          });
        }
      });
    }
    score += (incompletePropValue * incompletePropWeight);

    // 3. Bank Cash Total Value (M value x 1)
    let bankValue = 0;
    if (player.bank && Array.isArray(player.bank)) {
      player.bank.forEach((c: any) => {
        bankValue += (c.value || 0);
      });
    }
    score += (bankValue * bankCashWeight);

    player.matchScore = score;
    player.completeSetsCount = completeSetsCount;
    player.bankValue = bankValue;
  });

  // Sort descending by score. Tie-breakers:
  // 1. Non-abandoned/Non-disconnected players ahead of abandoned/AFK/disconnected players
  // 2. Higher match score
  // 3. Fewest cards in hand
  losers.sort((a: any, b: any) => {
    const aAbandoned = a.hasAbandoned || a.isDisconnected;
    const bAbandoned = b.hasAbandoned || b.isDisconnected;
    if (aAbandoned && !bAbandoned) return 1;
    if (!aAbandoned && bAbandoned) return -1;

    if (b.matchScore !== a.matchScore) {
      return b.matchScore - a.matchScore;
    }
    const aHand = a.hand ? a.hand.length : 0;
    const bHand = b.hand ? b.hand.length : 0;
    if (aHand !== bHand) {
      return aHand - bHand; // Fewer cards = higher efficiency
    }
    return 0;
  });

  return losers;
}

// Handle Match Win State on Server
async function handleMatchWinner(match: any, winnerId: string) {
  if (match.status === 'finished') return;
  match.status = 'finished';
  match.winnerId = winnerId;

  const winner = match.players.find((p: any) => p.id === winnerId);
  match.logs.push({
    id: `win-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    message: `👑 Tebrikler! Maçı ${winner?.username} kazandı!`,
    timestamp: Date.now(),
  });

  // Automatically submit winner to tournament bracket if this was an online tournament match
  if (match.roomId && match.roomId.startsWith('tournament_')) {
    const parts = match.roomId.split('_');
    const tId = parts[1];
    const mId = parts[2];
    const tournament = activeTournaments.find((t) => t.id === tId);
    if (tournament && winner?.username) {
      const currentRound = tournament.rounds[tournament.rounds.length - 1];
      const tMatch = currentRound?.matches.find((m) => m.id === mId || m.id.includes(mId));
      if (tMatch) {
        tMatch.winner = winner.username;
        tMatch.score1 = tMatch.player1 === winner.username ? 3 : 1;
        tMatch.score2 = tMatch.player2 === winner.username ? 3 : 1;
        tMatch.status = 'completed';
        await saveTournaments();
      }
    }
  }

  const users = await loadUsers();
  const dateStr = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  // Calculate 2nd, 3rd, 4th placement via Win-Proximity Score engine
  const rankedLosers = calculateLoserScores(match, winnerId);

  const finalLeaderboard = [
    { player: winner, rank: 1, score: 999 },
    ...rankedLosers.map((p: any, idx: number) => ({ player: p, rank: idx + 2, score: p.matchScore }))
  ];

  const totalPlayerCount = match.players ? match.players.length : 4;
  const entryFee = match.matchmakingEntryFee || (globalAdminSettings as any).matchmakingEntryFee || 100;
  const winnerShare = match.matchmakingWinnerShare || (globalAdminSettings as any).matchmakingWinnerShare || 80;
  const totalPool = totalPlayerCount * entryFee;

  // Scale factor based on player count (< 4 players = reduced rewards to prevent farming/exploits)
  // 4+ players -> 1.0 (100%)
  // 3 players  -> 0.75 (75%)
  // 2 players  -> 0.50 (50%)
  const playerCountScale = totalPlayerCount >= 4 ? 1.0 : (totalPlayerCount === 3 ? 0.75 : 0.50);

  const finalRankings: any[] = [];

  for (const item of finalLeaderboard) {
    const p = item.player;
    if (!p) continue;

    const isAbandonedOrDisconnected = p.hasAbandoned || p.isDisconnected;

    let coinsEarned = 0;
    let xpEarned = 0;
    let rpChange = 0;
    let mmrChange = 0;

    if (isAbandonedOrDisconnected) {
      // Abandoned or Disconnected/AFK players NEVER gain coins or XP, and ALWAYS lose RP & MMR!
      coinsEarned = 0;
      xpEarned = 0;
      rpChange = match.isMatchmaking ? -25 : -15;
      mmrChange = -30;
    } else {
      if (item.rank === 1) {
        // 1st Place (Winner)
        const baseCoins = match.isMatchmaking ? Math.round((totalPool * winnerShare) / 100) : Math.round(200 * globalAdminSettings.goldMultiplier);
        coinsEarned = Math.round(baseCoins * playerCountScale);
        xpEarned = Math.round(150 * playerCountScale);
        const baseRp = match.isMatchmaking ? (entryFee >= 1000 ? 40 : entryFee >= 500 ? 30 : 25) : 15;
        rpChange = Math.round(baseRp * playerCountScale);
        mmrChange = Math.round(30 * playerCountScale);

      } else if (item.rank === totalPlayerCount) {
        // Last Place in the match!
        // In a 2-player match -> rank 2 is LAST PLACE (loser loses RP!)
        // In a 3-player match -> rank 3 is LAST PLACE
        // In a 4-player match -> rank 4 is LAST PLACE
        coinsEarned = 0;
        xpEarned = Math.round(20 * playerCountScale);
        rpChange = match.isMatchmaking ? -18 : -10;
        mmrChange = -20;

      } else if (item.rank === 2 && totalPlayerCount >= 4) {
        // 2nd Place in a 4+ player match (Runner-up)
        coinsEarned = match.isMatchmaking ? Math.round(entryFee * 0.5 * playerCountScale) : Math.round(30 * playerCountScale);
        xpEarned = Math.round(80 * playerCountScale);
        rpChange = match.isMatchmaking ? 5 : 5;
        mmrChange = 8;

      } else if (item.rank === 2 && totalPlayerCount === 3) {
        // 2nd Place in a 3-player match (Middle place) -> 0 RP gain (breakeven)
        coinsEarned = 0;
        xpEarned = Math.round(50 * playerCountScale);
        rpChange = 0;
        mmrChange = 0;

      } else if (item.rank === 3 && totalPlayerCount >= 4) {
        // 3rd Place in a 4+ player match
        coinsEarned = 0;
        xpEarned = Math.round(50 * playerCountScale);
        rpChange = match.isMatchmaking ? -5 : -3;
        mmrChange = -8;

      } else {
        coinsEarned = 0;
        xpEarned = Math.round(20 * playerCountScale);
        rpChange = match.isMatchmaking ? -10 : -5;
        mmrChange = -10;
      }
    }

    // Apply to user DB if not a bot
    if (!p.isBot) {
      const u = users[p.id];
      if (u) {
        if (!p.hasAbandonedAlreadyPenalized) {
          u.coins += coinsEarned;
          u.xp += xpEarned;
          u.stats.gamesPlayed++;
          if (item.rank === 1 && !isAbandonedOrDisconnected) {
            u.stats.gamesWon++;
            u.stats.totalSetsCompleted += 3;
          } else {
            u.stats.gamesLost++;
          }

          u.rankPoints = Math.max(0, (u.rankPoints ?? 0) + rpChange);
          u.mmr = Math.max(100, (u.mmr ?? 1000) + mmrChange);
          u.level = Math.floor(u.xp / 500) + 1;

          if (!u.gamesHistory) u.gamesHistory = [];
          u.gamesHistory.unshift({
            id: `match-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            date: dateStr,
            opponent: match.players.filter((x: any) => x.id !== p.id).map((x: any) => x.username).join(', '),
            result: (item.rank === 1 && !isAbandonedOrDisconnected) ? 'won' : 'lost',
            coinsEarned,
            xpEarned,
            rankPointsEarned: rpChange
          });

          users[p.id] = u;
        }
      }
    }

    finalRankings.push({
      playerId: p.id,
      username: p.username,
      avatarId: p.avatarId,
      avatarUrl: p.avatarUrl,
      profileFrame: p.profileFrame,
      rank: item.rank,
      score: (item.rank === 1 && !isAbandonedOrDisconnected) ? 'KAZANAN' : (isAbandonedOrDisconnected ? 'TERK ETTİ' : `${item.score} Puan`),
      completeSets: p.completeSetsCount || ((item.rank === 1 && !isAbandonedOrDisconnected) ? 3 : 0),
      bankTotal: p.bankValue || 0,
      rpChange,
      mmrChange,
      coinsEarned,
      isWinner: item.rank === 1 && !isAbandonedOrDisconnected,
      isAbandon: isAbandonedOrDisconnected
    });
  }

  await saveUsers(users);

  match.finalRankings = finalRankings;
  match.logs.push({
    id: `rankings-${Date.now()}`,
    message: `📊 Maç Sonucu Sıralaması: 1. ${finalRankings[0]?.username} | 2. ${finalRankings[1]?.username || '-'} | 3. ${finalRankings[2]?.username || '-'} | 4. ${finalRankings[3]?.username || '-'}`,
    timestamp: Date.now()
  });
}

function calculateMatchChecksum(match: MatchState): string {
  let sum = 0;
  match.players.forEach((p) => {
    sum += p.hand.length * 17;
    p.bank.forEach((c) => {
      sum += c.value * 31;
    });
    Object.keys(p.properties).forEach((color) => {
      const set = p.properties[color];
      if (set && set.cards) {
        sum += set.cards.length * 47;
      }
    });
  });
  return `chk-${sum}`;
}
