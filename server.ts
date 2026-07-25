import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { generateDeck, shuffleDeck, checkWinner, MAX_IN_SET } from './src/lib/deck';
import { BotEngine } from './src/lib/BotEngine';
import { UserProfile, MatchState, GamePlayer, Card, CardColor, GameLog, Friend, FriendRequest, Tournament, TournamentMatch, ActionRequest } from './src/types';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

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

function checkWinnerForMatch(match: MatchState, player: GamePlayer): boolean {
  return checkWinner(player.properties, match.settings?.targetSets || 3);
}

// Create data directory if not exists
const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const STORE_ITEMS_FILE = path.join(DATA_DIR, 'store_items.json');

async function loadStoreItems(): Promise<any[]> {
  try {
    if (fs.existsSync(STORE_ITEMS_FILE)) {
      const data = fs.readFileSync(STORE_ITEMS_FILE, 'utf-8');
      return JSON.parse(data);
    } else {
      fs.writeFileSync(STORE_ITEMS_FILE, JSON.stringify(DEFAULT_SHOP_ITEMS, null, 2), 'utf-8');
      return DEFAULT_SHOP_ITEMS;
    }
  } catch (e) {
    console.error('[Database] Error loading store_items.json:', e);
    return DEFAULT_SHOP_ITEMS;
  }
}

async function saveStoreItems(items: any[]): Promise<boolean> {
  try {
    fs.writeFileSync(STORE_ITEMS_FILE, JSON.stringify(items, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('[Database] Error saving store_items.json:', e);
    return false;
  }
}

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
  { id: 'board_void', name: '🌀 Karanlık Rift Tahtası', category: 'player_board', price: 420, description: 'Hiçliğin derinliklerinden gelen gizemli mor aura ve parçacık süzülmeli tasarım.', isUnlocked: false }
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

// Helper to load/save users
async function loadUsers(): Promise<Record<string, UserProfile>> {
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
        users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
        console.log(`[Database] Loaded users from local users.json fallback.`);
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

  return users;
}

async function saveUsers(users: Record<string, UserProfile>): Promise<void> {
  // 1. Always save to local backup file first for durability
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
  } catch (e) {
    console.error('[Database] Local fallback save error:', e);
  }

  // 2. Save/Upsert to Supabase
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
  bonusTimePerActionSeconds: 10
};

const GLOBAL_ACHIEVEMENTS_FILE = path.join(DATA_DIR, 'global_achievements.json');
const TOURNAMENTS_FILE = path.join(DATA_DIR, 'tournaments.json');

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
  if (!loadedSettings && fs.existsSync(ADMIN_SETTINGS_FILE)) {
    try {
      globalAdminSettings = { ...globalAdminSettings, ...JSON.parse(fs.readFileSync(ADMIN_SETTINGS_FILE, 'utf-8')) };
      console.log('[Database] Loaded admin settings from local fallback.');
    } catch (e) {
      console.error('[Database] Failed to read local admin settings:', e);
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
  if (!loadedQuests && fs.existsSync(GLOBAL_QUESTS_FILE)) {
    try {
      globalQuests = JSON.parse(fs.readFileSync(GLOBAL_QUESTS_FILE, 'utf-8'));
      console.log('[Database] Loaded global quests from local fallback.');
    } catch (e) {
      console.error('[Database] Failed to read local global quests:', e);
    }
  }

  // Load Global Achievements
  if (fs.existsSync(GLOBAL_ACHIEVEMENTS_FILE)) {
    try {
      globalAchievements = JSON.parse(fs.readFileSync(GLOBAL_ACHIEVEMENTS_FILE, 'utf-8'));
      console.log('[Database] Loaded global achievements from local fallback.');
    } catch (e) {
      console.error('[Database] Failed to read local global achievements:', e);
    }
  }

  // Load Tournaments
  if (fs.existsSync(TOURNAMENTS_FILE)) {
    try {
      activeTournaments = JSON.parse(fs.readFileSync(TOURNAMENTS_FILE, 'utf-8'));
      console.log('[Database] Loaded active tournaments from local fallback.');
    } catch (e) {
      console.error('[Database] Failed to read local tournaments:', e);
    }
  }
}

async function saveAdminSettings(settings: any) {
  globalAdminSettings = { ...globalAdminSettings, ...settings };
  try {
    fs.writeFileSync(ADMIN_SETTINGS_FILE, JSON.stringify(globalAdminSettings, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Database] Failed to save local admin settings:', e);
  }
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
  try {
    fs.writeFileSync(GLOBAL_QUESTS_FILE, JSON.stringify(globalQuests, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Database] Failed to save local global quests:', e);
  }
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
  try {
    fs.writeFileSync(GLOBAL_ACHIEVEMENTS_FILE, JSON.stringify(globalAchievements, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Database] Failed to save local global achievements:', e);
  }
}

async function saveTournaments() {
  try {
    fs.writeFileSync(TOURNAMENTS_FILE, JSON.stringify(activeTournaments, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Database] Failed to save local tournaments:', e);
  }
}

// In-Memory active rooms and tournaments state
const activeMatches: Record<string, MatchState> = {};
const roomPreviousTurnIndex: Record<string, number> = {};
const roomLocks: Record<string, Promise<any>> = {};
let activeTournaments: Tournament[] = [
  {
    id: 't-1',
    name: 'Yaz Kupası 2026',
    participants: ['Bot Memo', 'Bot Can', 'Bot Defne'],
    rounds: [
      {
        roundNumber: 1,
        matches: [
          { id: 'tm-1', player1: 'Bot Memo', player2: 'Bot Can', score1: 3, score2: 1, status: 'completed', winner: 'Bot Memo' },
          { id: 'tm-2', player1: 'Bot Defne', player2: 'Sen', status: 'pending' },
        ],
      },
    ],
    status: 'active',
  },
];

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

  // Load administrative settings and custom quests from Supabase/Backup
  await loadAdminData();

  // --- API ROUTES ---

  // --- ADMIN PANEL API ENDPOINTS ---

  // Admin login check
  app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === 'admin123') {
      res.json({ success: true, token: 'admin-token-xyz' });
    } else {
      res.status(401).json({ error: 'Geçersiz yönetici şifresi.' });
    }
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
      level: u.level,
      xp: u.xp,
      coins: u.coins,
      gamesWon: u.stats?.gamesWon || 0,
      gamesPlayed: u.stats?.gamesPlayed || 0,
      friendsCount: u.friends?.length || 0
    }));
    res.json(list);
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

  // --- STORE CATALOG ADMIN ENDPOINTS (Create, Read, Update, Delete) ---
  app.get('/api/admin/store-items', async (req, res) => {
    const items = await loadStoreItems();
    res.json(items);
  });

  app.post('/api/admin/store-items', async (req, res) => {
    const newItem = req.body;
    if (!newItem || !newItem.name) {
      return res.status(400).json({ error: 'Ürün adı gereklidir.' });
    }

    if (!newItem.id) {
      newItem.id = `item_${Date.now()}`;
    }

    const items = await loadStoreItems();
    const idx = items.findIndex((i: any) => i.id === newItem.id);
    if (idx !== -1) {
      items[idx] = newItem;
    } else {
      items.push(newItem);
    }

    await saveStoreItems(items);
    res.json({ success: true, items });
  });

  app.put('/api/admin/store-items/:id', async (req, res) => {
    const { id } = req.params;
    const updatedData = req.body;

    const items = await loadStoreItems();
    const idx = items.findIndex((i: any) => i.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Ürün bulunamadı.' });
    }

    items[idx] = { ...items[idx], ...updatedData, id };
    await saveStoreItems(items);
    res.json({ success: true, items });
  });

  app.post('/api/admin/store-items/update', async (req, res) => {
    const { id, ...updatedData } = req.body;
    const items = await loadStoreItems();
    const idx = items.findIndex((i: any) => i.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Ürün bulunamadı.' });
    }

    items[idx] = { ...items[idx], ...updatedData, id };
    await saveStoreItems(items);
    res.json({ success: true, items });
  });

  app.delete('/api/admin/store-items/:id', async (req, res) => {
    const { id } = req.params;
    let items = await loadStoreItems();
    items = items.filter((i: any) => i.id !== id);

    await saveStoreItems(items);
    res.json({ success: true, items });
  });

  app.post('/api/admin/store-items/delete', async (req, res) => {
    const { itemId } = req.body;
    let items = await loadStoreItems();
    items = items.filter((i: any) => i.id !== itemId);

    await saveStoreItems(items);
    res.json({ success: true, items });
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


  // --- TOURNAMENTS SYSTEM ---
  app.get('/api/tournaments', (req, res) => {
    res.json(activeTournaments);
  });

  app.post('/api/admin/tournaments/create', async (req, res) => {
    const { name, participants, entryFee, rewardCoins } = req.body;
    if (!name || !participants || participants.length < 2) {
      return res.status(400).json({ error: 'Turnuva ismi ve en az 2 katılımcı gereklidir.' });
    }

    // Build Round 1 matches elegantly
    const matches: TournamentMatch[] = [];
    const shuffled = [...participants].sort(() => Math.random() - 0.5);
    for (let i = 0; i < shuffled.length; i += 2) {
      if (i + 1 < shuffled.length) {
        matches.push({
          id: `tm-${Date.now()}-${i}`,
          player1: shuffled[i],
          player2: shuffled[i + 1],
          status: 'pending'
        });
      } else {
        matches.push({
          id: `tm-${Date.now()}-${i}`,
          player1: shuffled[i],
          player2: 'Bot Memo',
          status: 'completed',
          winner: shuffled[i],
          score1: 3,
          score2: 0
        });
      }
    }

    const newTournament: Tournament = {
      id: `t-${Date.now()}`,
      name,
      participants,
      rounds: [
        {
          roundNumber: 1,
          matches
        }
      ],
      status: 'active'
    };

    activeTournaments.unshift(newTournament);
    await saveTournaments();

    res.json({ success: true, tournaments: activeTournaments });
  });

  app.post('/api/tournaments/join', async (req, res) => {
    const { userId, tournamentId } = req.body;
    const users = await loadUsers();
    const user = users[userId];
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

    const tournament = activeTournaments.find((t) => t.id === tournamentId);
    if (!tournament) return res.status(404).json({ error: 'Turnuva bulunamadı.' });

    if (tournament.status !== 'registration') {
      return res.status(400).json({ error: 'Bu turnuvaya kayıtlar kapanmış.' });
    }

    if (!tournament.participants.includes(user.username)) {
      tournament.participants.push(user.username);
    }

    // If registration limit reached or Admin starts it, it becomes active. For simplicity, join instantly.
    await saveTournaments();
    res.json({ success: true, tournament });
  });

  // Submit match score
  app.post('/api/tournaments/match/submit', async (req, res) => {
    const { tournamentId, matchId, winnerName, score1, score2 } = req.body;
    const tournament = activeTournaments.find((t) => t.id === tournamentId);
    if (!tournament) return res.status(404).json({ error: 'Turnuva bulunamadı.' });

    // Find the match in the latest round
    const currentRound = tournament.rounds[tournament.rounds.length - 1];
    const match = currentRound.matches.find((m) => m.id === matchId);
    if (!match) return res.status(404).json({ error: 'Maç bulunamadı.' });

    match.winner = winnerName;
    match.score1 = score1 !== undefined ? Number(score1) : 3;
    match.score2 = score2 !== undefined ? Number(score2) : 1;
    match.status = 'completed';

    // If all matches in this round are completed, advance round automatically or let Admin advance
    const allCompleted = currentRound.matches.every((m) => m.status === 'completed');
    if (allCompleted) {
      // If only 1 match and it is completed, tournament is completed!
      if (currentRound.matches.length === 1) {
        tournament.status = 'completed';
        tournament.winner = winnerName;

        // Reward the tournament winner if they are a real loaded user!
        const users = await loadUsers();
        const winnerUser = Object.values(users).find((u) => u.username === winnerName);
        if (winnerUser) {
          winnerUser.coins += 1000; // 1000 Coins grand tournament winner prize!
          winnerUser.xp += 500;
          await saveUsers(users);
        }
      } else {
        // Build next round matches!
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
    }

    await saveTournaments();
    res.json({ success: true, tournament, tournaments: activeTournaments });
  });

  // Admin deletes a tournament
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

  // --- STANDARD API ROUTES ---

  // Auth / Get Profile
  app.post('/api/auth', async (req, res) => {
    const { username, password } = req.body;
    if (!username || username.trim() === '') {
      return res.status(400).json({ error: 'Kullanıcı adı geçerli olmalıdır.' });
    }

    const users = await loadUsers();
    let user = Object.values(users).find((u) => u.username.toLowerCase() === username.toLowerCase());

    if (user) {
      // If user has a password set, verify it
      if (user.password && user.password.trim() !== '') {
        if (!password || password.trim() !== user.password) {
          return res.status(401).json({ error: 'Bu kullanıcı adı şifre korumalıdır. Lütfen doğru şifreyi giriniz.' });
        }
      }
      // Ensure gamesHistory exists for legacy profiles
      if (!user.gamesHistory) {
        user.gamesHistory = [];
        users[user.id] = user;
        await saveUsers(users);
      }
    } else {
      // Create new profile
      const newId = `user-${Math.random().toString(36).substr(2, 9)}`;
      user = {
        id: newId,
        username: username.trim(),
        password: password && password.trim() !== '' ? password.trim() : undefined,
        coins: 500, // starting coins
        level: 1,
        xp: 0,
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

    res.json(user);
  });

  // Shop purchase
  app.post('/api/shop/buy', async (req, res) => {
    const { userId, itemId } = req.body;
    const users = await loadUsers();
    const user = users[userId];

    if (!user) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    }

    const storeItems = await loadStoreItems();
    const item = storeItems.find((i: any) => i.id === itemId);
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

  const saveTranslations = (data: any) => {
    try {
      fs.writeFileSync(TRANSLATIONS_PATH, JSON.stringify(data, null, 2), 'utf8');
      translationsCache = data;
    } catch (e) {
      console.error('Failed to save translations file', e);
    }
  };

  // Pre-load on startup
  loadTranslations();

  app.get('/api/translations', (req, res) => {
    res.json(translationsCache);
  });

  app.post('/api/translations/save', (req, res) => {
    const { translations } = req.body;
    if (!translations) {
      return res.status(400).json({ error: 'Geçersiz veri gönderildi.' });
    }
    saveTranslations(translations);
    res.json({ success: true, translations: translationsCache });
  });

  // World Leaderboard endpoint
  app.get('/api/leaderboard', async (req, res) => {
    const category = (req.query.category as string) || 'wins';
    const users = await loadUsers();

    // Convert to array of leaderboard items
    const realUsers = Object.values(users).map((u) => {
      const gWon = u.stats?.gamesWon || 0;
      const gPlayed = u.stats?.gamesPlayed || 0;
      const wRate = gPlayed > 0 ? Math.round((gWon / gPlayed) * 100) : 0;
      return {
        id: u.id,
        username: u.username,
        level: u.level || 1,
        xp: u.xp || 0,
        coins: u.coins || 0,
        gamesWon: gWon,
        gamesPlayed: gPlayed,
        winRate: wRate,
        avatarId: u.avatarId || 'avatar_classic',
        avatarUrl: u.avatarUrl || '',
        profileFrame: u.settings?.profileFrame || 'frame_none',
      };
    });

    // Competitors: Add default bots to the leaderboard to make it look rich, professional and lively!
    const bots = [
      { id: 'bot-milyoner', username: 'Milyoner Bot', level: 19, xp: 9550, coins: 8900, gamesWon: 68, gamesPlayed: 92, winRate: 74, avatarId: 'avatar_golden', avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&q=80', profileFrame: 'frame_snowstorm' },
      { id: 'bot-memo', username: 'Bot Memo', level: 14, xp: 7120, coins: 4120, gamesWon: 42, gamesPlayed: 60, winRate: 70, avatarId: 'avatar_skater', avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80', profileFrame: 'frame_none' },
      { id: 'bot-zar', username: 'Hızlı Zar Bot', level: 11, xp: 5850, coins: 2100, gamesWon: 29, gamesPlayed: 50, winRate: 58, avatarId: 'avatar_skater', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80', profileFrame: 'frame_none' },
      { id: 'bot-defne', username: 'Bot Defne', level: 8, xp: 4100, coins: 1250, gamesWon: 18, gamesPlayed: 32, winRate: 56, avatarId: 'avatar_neon', avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80', profileFrame: 'frame_none' },
      { id: 'bot-can', username: 'Bot Can', level: 5, xp: 2200, coins: 820, gamesWon: 10, gamesPlayed: 25, winRate: 40, avatarId: 'avatar_classic', avatarUrl: 'https://images.unsplash.com/photo-1628157582853-a796fa650a6a?auto=format&fit=crop&w=150&q=80', profileFrame: 'frame_none' },
    ];

    const allPlayers = [...realUsers, ...bots];

    // De-duplicate if names clash
    const uniquePlayers = allPlayers.filter((p, index, self) =>
      index === self.findIndex((t) => t.username.toLowerCase() === p.username.toLowerCase())
    );

    // Sort based on category
    uniquePlayers.sort((a, b) => {
      if (category === 'coins') return b.coins - a.coins;
      if (category === 'level') return b.level - a.level || b.xp - a.xp;
      // Default: wins
      if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      return b.level - a.level;
    });

    res.json(uniquePlayers.slice(0, 50));
  });

  // Custom profile updater endpoint
  app.post('/api/profile/update', async (req, res) => {
    const { userId, avatarUrl, gamesHistory, coins, xp, stats, dailyQuests, achievements, password } = req.body;
    const users = await loadUsers();
    const user = users[userId];

    if (!user) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    }

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
    if (password !== undefined) user.password = password;

    users[userId] = user;
    await saveUsers(users);

    res.json(user);
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

  // Store Catalog Admin CRUD Endpoints
  app.get('/api/admin/store-items', async (req, res) => {
    const items = await loadStoreItems();
    res.json(items);
  });

  app.post('/api/admin/store-items', async (req, res) => {
    const items = await loadStoreItems();
    const newItem = {
      id: req.body.id || `item_${Date.now()}`,
      name: req.body.name || 'Yeni Mağaza Ürünü',
      category: req.body.category || 'avatar',
      price: Number(req.body.price) || 100,
      description: req.body.description || '',
      isUnlocked: req.body.isUnlocked || false,
      previewUrl: req.body.previewUrl || '',
      previewColor: req.body.previewColor || '',
      mediaType: req.body.mediaType || 'image',
      mediaUrl: req.body.mediaUrl || '',
      options: req.body.options || {},
    };
    items.push(newItem);
    await saveStoreItems(items);

    // Broadcast updated catalog to all connected WebSockets
    Object.values(clients).forEach((c) => {
      if (c.ws.readyState === WebSocket.OPEN) {
        c.ws.send(JSON.stringify({ type: 'store_catalog_updated', items }));
      }
    });

    res.status(201).json({ success: true, item: newItem, items });
  });

  app.put('/api/admin/store-items/:id', async (req, res) => {
    const items = await loadStoreItems();
    const index = items.findIndex((i: any) => i.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Ürün bulunamadı.' });
    }
    items[index] = {
      ...items[index],
      ...req.body,
      id: req.params.id, // ID is immutable
    };
    await saveStoreItems(items);

    // Broadcast to WebSocket clients
    Object.values(clients).forEach((c) => {
      if (c.ws.readyState === WebSocket.OPEN) {
        c.ws.send(JSON.stringify({ type: 'store_catalog_updated', items }));
      }
    });

    res.json({ success: true, item: items[index], items });
  });

  app.delete('/api/admin/store-items/:id', async (req, res) => {
    let items = await loadStoreItems();
    const filtered = items.filter((i: any) => i.id !== req.params.id);
    if (filtered.length === items.length) {
      return res.status(404).json({ error: 'Ürün bulunamadı.' });
    }
    await saveStoreItems(filtered);

    // Broadcast update
    Object.values(clients).forEach((c) => {
      if (c.ws.readyState === WebSocket.OPEN) {
        c.ws.send(JSON.stringify({ type: 'store_catalog_updated', items: filtered }));
      }
    });

    res.json({ success: true, id: req.params.id, items: filtered });
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

  app.get('/api/rooms', (req, res) => {
    const list = Object.values(activeMatches).map((m) => ({
      roomId: m.roomId,
      playerCount: m.players.length,
      status: m.status,
      players: m.players.map((p) => p.username),
      hasPassword: !!m.password,
    }));
    res.json(list);
  });

  // --- WEBSOCKET SERVICES ---
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  const clients: Record<string, { ws: WebSocket; userId: string; roomId?: string }> = {};

  wss.on('connection', (ws) => {
    let clientId = `client-${Math.random().toString(36).substr(2, 5)}`;

    async function processClientMessage(payload: any, userId: string, roomId: string | undefined, clientId: string, ws: WebSocket) {
      try {
        const { type } = payload;
        switch (type) {
          case 'register':
            clients[clientId] = { ws, userId };
            // Update friend status
            await updateFriendStatus(userId, 'online');
            break;

          case 'join_room': {
            const users = await loadUsers();
            const user = users[userId];
            if (!user) break;

            const roomPassword = payload.password; // Optional password passed from client

            // Find or create room
            let match = activeMatches[roomId];
            if (!match) {
              match = {
                roomId,
                status: 'lobby',
                players: [],
                deckCount: 106,
                discardPile: [],
                turnIndex: 0,
                actionsPlayedThisTurn: 0,
                logs: [{ id: 'l-init', message: `${user.username} odayı kurdu.`, timestamp: Date.now() }],
                isOffline: false,
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
            }

            clients[clientId].roomId = roomId;

            // Join if not already in
            const existingPlayer = match.players.find((p) => p.id === userId);
            if (!existingPlayer) {
              match.players.push({
                id: userId,
                username: user.username,
                avatarId: user.avatarId,
                avatarUrl: user.avatarUrl,
                profileFrame: user.settings?.profileFrame || 'frame_none',
                playerBoard: user.settings?.playerBoard || 'board_classic',
                boardTheme: user.settings?.boardTheme || 'theme_slate',
                cardBack: user.settings?.cardBack || 'back_classic',
                cardSkin: user.settings?.cardSkin || 'skin_none',
                actionVfx: user.settings?.actionVfx || 'vfx_none',
                isBot: false,
                hand: [],
                bank: [],
                properties: {},
              });
              match.logs.push({
                id: `join-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                message: `${user.username} odaya katıldı.`,
                timestamp: Date.now(),
              });
            } else {
              // Reconnecting! Clear isDisconnected flag
              existingPlayer.isDisconnected = false;
              match.logs.push({
                id: `reconnect-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                message: `${user.username} oyuna geri döndü. Kontrolü devraldı!`,
                timestamp: Date.now(),
              });
            }

            broadcastToRoom(roomId, {
              type: 'room_update',
              matchState: match,
            });
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
            match.turnIndex = 0;
            match.actionsPlayedThisTurn = 0;
            match.turnStartedAt = Date.now();
            match.logs.push({
              id: `start-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              message: `Oyun başladı! Sıra ${match.players[0].username} adlı oyuncuda.`,
              timestamp: Date.now(),
            });

            // Put deck to a safe temporary server state
            (match as any).serverDeck = fullDeck;

            // Automatically trigger first draw
            triggerDrawForActivePlayer(match);

            broadcastToRoom(roomId, {
              type: 'room_update',
              matchState: match,
            });
            break;
          }

          case 'add_bot': {
            const match = activeMatches[roomId];
            if (!match || match.status !== 'lobby') break;

            const botNames = ['Bot Memo', 'Bot Can', 'Bot Defne', 'Milyoner Bot'];
            const usedNames = match.players.map((p) => p.username);
            const availableNames = botNames.filter((n) => !usedNames.includes(n));
            const botName = availableNames[0] || `Bot ${match.players.length + 1}`;

            const botBoards = ['board_cyber', 'board_gold', 'board_magma', 'board_galaxy', 'board_ice', 'board_void'];
            const botBoard = botBoards[Math.floor(Math.random() * botBoards.length)];

            match.players.push({
              id: `bot-${Math.random().toString(36).substr(2, 5)}`,
              username: botName,
              avatarId: 'avatar_skater',
              profileFrame: 'frame_none',
              playerBoard: botBoard,
              isBot: true,
              hand: [],
              bank: [],
              properties: {},
            });

            match.logs.push({
              id: `bot-add-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              message: `${botName} odaya eklendi.`,
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
            if (!match || match.status !== 'lobby') break;

            if (match.players[0] && match.players[0].id === userId) {
              const { targetPlayerId } = payload;
              const idx = match.players.findIndex((p) => p.id === targetPlayerId);
              if (idx !== -1) {
                const kickedPlayer = match.players[idx];

                const targetClient = Object.values(clients).find((c) => c.userId === targetPlayerId && c.roomId === roomId);
                if (targetClient) {
                  try {
                    targetClient.ws.send(JSON.stringify({ type: 'kicked' }));
                  } catch (e) {
                    console.error('Error sending kicked notice to client', e);
                  }
                  targetClient.roomId = undefined;
                }

                match.players.splice(idx, 1);
                match.logs.push({
                  id: `kick-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                  message: `${kickedPlayer.username} odadan atıldı.`,
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
              const leavingPlayer = match.players.splice(idx, 1)[0];
              match.logs.push({
                id: `leave-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                message: `${leavingPlayer.username} odadan ayrıldı.`,
                timestamp: Date.now(),
              });
            }

            const c = clients[clientId];
            if (c) {
              c.roomId = undefined;
            }

            const hasActiveHumans = match.players.some((p) => !p.isBot);
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
              match.settings = {
                targetSets: 3,
                turnLimit: 'unlimited',
                autoEndTurn: false,
                gameMode: 'classic',
                ...match.settings,
                ...settings
              };

              if (settings.gameMode === 'chaos') {
                match.settings.targetSets = 4;
                match.settings.turnLimit = 'unlimited';
                match.settings.autoEndTurn = false;
              } else if (settings.gameMode === 'speed') {
                match.settings.targetSets = 2;
                match.settings.turnLimit = '15s';
                match.settings.autoEndTurn = true;
              }

              const modeLabel = match.settings.gameMode === 'chaos' ? 'Kaos Modu 🌀' : match.settings.gameMode === 'speed' ? 'Speed Deal Master PRO ⚡' : 'Klasik Mod 🎲';
              match.logs.push({
                id: `settings-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                message: `Oda ayarları güncellendi: [${modeLabel}] - Hedef: ${match.settings.targetSets} Set, Tur Süresi: ${match.settings.turnLimit === 'unlimited' ? 'Sınırsız' : match.settings.turnLimit}, Otomatik Tur Sonu: ${match.settings.autoEndTurn ? 'Açık' : 'Kapalı'}`,
                timestamp: Date.now(),
              });

              broadcastToRoom(roomId, {
                type: 'room_update',
                matchState: match,
              });
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
            if (match.activeActionRequest) {
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

              let colorToUse: CardColor = (card.isWildcard && extraColor) ? extraColor : (card.color || extraColor || 'brown');

              if (!player.properties[colorToUse]) {
                player.properties[colorToUse] = { cards: [], hasHouse: false, hasHotel: false };
              }

              if (card.type === 'house-hotel') {
                if (card.actionType === 'house') {
                  player.properties[colorToUse]!.hasHouse = true;
                } else {
                  player.properties[colorToUse]!.hasHotel = true;
                }
              } else {
                // Property or wildcard
                const updatedCard = { ...card };
                if (updatedCard.isWildcard && updatedCard.secondaryColor && colorToUse === updatedCard.secondaryColor) {
                  const temp = updatedCard.color;
                  updatedCard.color = colorToUse;
                  updatedCard.secondaryColor = temp;
                } else {
                  updatedCard.color = colorToUse;
                }
                player.properties[colorToUse]!.cards.push(updatedCard);
              }

              match.logs.push({
                id: `play-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                message: `${player.username}, ${COLOR_LABELS[colorToUse]} grubuna ${card.name} kartını yerleştirdi.`,
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

            broadcastToRoom(roomId, {
              type: 'room_update',
              matchState: match,
            });
            break;
          }

          case 'change_wildcard_color': {
            const match = activeMatches[roomId];
            if (!match || match.status !== 'playing') break;

            const { cardId, newColor } = payload;
            const player = match.players.find((p) => p.id === userId);

            if (!player) break;

            // Find the wildcard in the player's property sets
            let foundCard: Card | null = null;

            for (const colKey in player.properties) {
              const col = colKey as CardColor;
              const propSet = player.properties[col];
              if (propSet) {
                const idx = propSet.cards.findIndex((c) => c.id === cardId);
                if (idx !== -1) {
                  foundCard = propSet.cards.splice(idx, 1)[0];

                  // Clean up set if empty
                  if (propSet.cards.length === 0) {
                    delete player.properties[col];
                  }
                  break;
                }
              }
            }

            if (foundCard) {
              // Update card color
              if (foundCard.isWildcard && foundCard.secondaryColor && newColor === foundCard.secondaryColor) {
                const temp = foundCard.color;
                foundCard.color = newColor;
                foundCard.secondaryColor = temp;
              } else {
                foundCard.color = newColor;
              }

              // Insert into the new property set
              if (!player.properties[newColor]) {
                player.properties[newColor] = { cards: [], hasHouse: false, hasHotel: false };
              }
              player.properties[newColor]!.cards.push(foundCard);

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
                    // Bot has no JSN! The human JSN defense succeeds, clear request
                    match.logs.push({
                      id: `jsn-win-bot-${Date.now()}`,
                      message: `🛡️ Savunma başarılı oldu! ${targetPlayer.username}'in hamlesi engellendi.`,
                      timestamp: Date.now(),
                    });
                    resolveRequest(match, req.id);
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
                if (req.originalAction) {
                  executeOriginalActionServer(match, req);
                  resolveRequest(match, req.id);
                } else if (req.amountDue > 0) {
                  // Payment request: change back to normal payment so target player pays
                  req.jsnCount = 0;
                  req.type = 'make-payment';
                  match.actionRequestStartedAt = Date.now();
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
                match.turnIndex = (match.turnIndex + 1) % match.players.length;
                match.actionsPlayedThisTurn = 0;
                match.turnStartedAt = Date.now();

                const nextPlayer = match.players[match.turnIndex];
                match.logs.push({
                  id: `turn-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                  message: `Sıra ${nextPlayer.username} adlı oyuncuda. (Önceki oyuncu 3 hamlesini tamamladı)`,
                  timestamp: Date.now(),
                });

                triggerDrawForActivePlayer(match);

                if (nextPlayer.isBot || nextPlayer.isDisconnected) {
                  scheduleBotTurn(match, 1000);
                }
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
            match.turnIndex = (match.turnIndex + 1) % match.players.length;
            match.actionsPlayedThisTurn = 0;
            match.turnStartedAt = Date.now();

            const nextPlayer = match.players[match.turnIndex];
            match.logs.push({
              id: `turn-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              message: `Sıra ${nextPlayer.username} adlı oyuncuda.`,
              timestamp: Date.now(),
            });

            // Trigger draw for next player
            triggerDrawForActivePlayer(match);

            broadcastToRoom(roomId, {
              type: 'room_update',
              matchState: match,
            });

            // If next player is a bot or disconnected, handle its turn asynchronously
            if (nextPlayer.isBot || nextPlayer.isDisconnected) {
              scheduleBotTurn(match, 1000);
            }
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
                match.turnIndex = (match.turnIndex + 1) % match.players.length;
                match.actionsPlayedThisTurn = 0;
                match.turnStartedAt = Date.now();

                const nextPlayer = match.players[match.turnIndex];
                match.logs.push({
                  id: `turn-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                  message: `Sıra ${nextPlayer.username} adlı oyuncuda.`,
                  timestamp: Date.now(),
                });

                triggerDrawForActivePlayer(match);
                if (nextPlayer.isBot || nextPlayer.isDisconnected) {
                  scheduleBotTurn(match, 1000);
                }
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

          case 'reset_afk': {
            const match = activeMatches[roomId!];
            if (match && match.status === 'playing') {
              if (match.activeActionRequest && match.activeActionRequest.targetPlayerId === userId) {
                match.actionRequestStartedAt = Date.now();
              } else if (match.activeActionRequests) {
                const myReq = match.activeActionRequests.find(r => r.targetPlayerId === userId);
                if (myReq) {
                  match.actionRequestStartedAt = Date.now();
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

          case 'reconnect_game': {
            const match = activeMatches[roomId!];
            if (match) {
              const player = match.players.find((p) => p.id === userId);
              if (player) {
                player.isDisconnected = false;
                const c = clients[clientId];
                if (c) {
                  c.roomId = roomId;
                  c.userId = userId;
                }
                match.logs.push({
                  id: `reconnect-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                  message: `🟢 ${player.username} oyuna yeniden bağlandı!`,
                  timestamp: Date.now(),
                });
                broadcastToRoom(roomId!, {
                  type: 'room_update',
                  matchState: match,
                });
              }
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
        const { type, userId, roomId } = payload;

        if (roomId) {
          if (!roomLocks[roomId]) {
            roomLocks[roomId] = Promise.resolve();
          }
          roomLocks[roomId] = roomLocks[roomId].then(async () => {
            try {
              await processClientMessage(payload, userId, roomId, clientId, ws);
            } catch (err) {
              console.error(`[Queue] Error processing message ${type} in room ${roomId}:`, err);
            }
          });
          await roomLocks[roomId];
        } else {
          await processClientMessage(payload, userId, undefined, clientId, ws);
        }
      } catch (err) {
        console.error('Error handling ws message', err);
      }
    });

    ws.on('close', async () => {
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

    // Drawing rule: if player has 0 cards, draw 5, else draw 2 (or 4 in Chaos mode).
    const isChaos = match.settings?.gameMode === 'chaos';
    const drawCount = activePlayer.hand.length === 0 ? 5 : (isChaos ? 4 : 2);
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
      // Demand 2M from all other players
      const targetPlayers = match.players.filter((p) => p.id !== player.id);
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
        message: `${player.username} Bugün Benim Doğum Günüm kartını oynadı! Herkesten 2M talep ediyor.`,
        timestamp: Date.now(),
      });
    } else if (card.actionType === 'debt-collector') {
      // Demand 2M from a specific player
      const targetId = payload.targetPlayerId || match.players.find((p) => p.id !== player.id)?.id;
      if (!targetId) return;

      const targetPlayer = match.players.find((p) => p.id === targetId);
      if (targetPlayer) {
        if (targetPlayer.isBot || targetPlayer.isDisconnected) {
          processBotPayment(match, targetPlayer, player, 2);
        } else {
          match.activeActionRequest = {
            id: `req-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            type: 'make-payment',
            sourcePlayerId: player.id,
            targetPlayerId: targetId,
            actionCard: card,
            amountDue: 2,
          };
          match.actionRequestStartedAt = Date.now();
        }
        match.logs.push({
          id: `debt-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          message: `${player.username}, ${targetPlayer.username} adlı oyuncudan 2M borç tahsilatı talep ediyor!`,
          timestamp: Date.now(),
        });
      }
    } else if (card.type === 'rent') {
      // Charge Rent
      const chosenColor = payload.extraColor || payload.color || card.color || 'brown';
      // Find rent value based on property count
      const propSet = player.properties[chosenColor];
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
          // Collect from ONLY one player
          const targetId = payload.targetPlayerId || match.players.find((p) => p.id !== player.id)?.id;
          if (targetId) {
            const tp = match.players.find((p) => p.id === targetId);
            if (tp) {
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
          // Collect from EVERYONE (standard dual-color rent)
          const targetPlayers = match.players.filter((p) => p.id !== player.id);
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
            message: `${player.username}, ${COLOR_LABELS[chosenColor]} mülkleri için herkesten ${rentVal}M kira talep etti!`,
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
            const col = colKey as CardColor;
            const propSet = targetPlayer.properties[col];
            if (propSet && propSet.cards.length < MAX_IN_SET[col]) {
              const idx = propSet.cards.findIndex((c) => c.id === cardIdToSteal);
              if (idx !== -1) {
                stolenCard = propSet.cards.splice(idx, 1)[0];
                if (propSet.cards.length === 0) {
                  delete targetPlayer.properties[col];
                }
                break;
              }
            }
          }
          if (stolenCard) {
            const col = stolenCard.color || 'brown';
            if (!player.properties[col]) {
              player.properties[col] = { cards: [], hasHouse: false, hasHotel: false };
            }
            player.properties[col]!.cards.push(stolenCard);
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
      const targetColor = payload.targetColor as CardColor;
      if (!targetId || !targetColor) return;

      const targetPlayer = match.players.find((p) => p.id === targetId);
      if (targetPlayer) {
        if (targetPlayer.isBot || targetPlayer.isDisconnected) {
          const propSet = targetPlayer.properties[targetColor];
          if (propSet) {
            player.properties[targetColor] = propSet;
            delete targetPlayer.properties[targetColor];
            match.logs.push({
              id: `db-${Date.now()}`,
              message: `${player.username}, ${targetPlayer.username} adlı oyuncunun tamamlanmış ${COLOR_LABELS[targetColor]} setini Anlaşma Bozan kartı ile çaldı!`,
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
            targetColor: targetColor,
            originalAction: {
              type: 'deal-breaker',
              payload: { targetPlayerId: targetId, targetColor: targetColor }
            },
            jsnCount: 0
          };
          match.actionRequestStartedAt = Date.now();
          match.logs.push({
            id: `db-req-${Date.now()}`,
            message: `📣 ${player.username}, ${targetPlayer.username} adlı oyuncunun tamamlanmış ${COLOR_LABELS[targetColor]} setini çalan bir Anlaşma Bozan kartı oynadı!`,
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
            const col = colKey as CardColor;
            const propSet = targetPlayer.properties[col];
            if (propSet) {
              const idx = propSet.cards.findIndex((c) => c.id === cardIdToSteal);
              if (idx !== -1) {
                stolenCard = propSet.cards.splice(idx, 1)[0];
                stolenColor = col;
                if (propSet.cards.length === 0) {
                  delete targetPlayer.properties[col];
                }
                break;
              }
            }
          }

          for (const colKey in player.properties) {
            const col = colKey as CardColor;
            const propSet = player.properties[col];
            if (propSet) {
              const idx = propSet.cards.findIndex((c) => c.id === myCardIdToGive);
              if (idx !== -1) {
                givenCard = propSet.cards.splice(idx, 1)[0];
                givenColor = col;
                if (propSet.cards.length === 0) {
                  delete player.properties[col];
                }
                break;
              }
            }
          }

          if (stolenCard && givenCard) {
            const colS = stolenCard.color || stolenColor || 'brown';
            if (!player.properties[colS]) {
              player.properties[colS] = { cards: [], hasHouse: false, hasHotel: false };
            }
            player.properties[colS]!.cards.push(stolenCard);

            const colG = givenCard.color || givenColor || 'brown';
            if (!targetPlayer.properties[colG]) {
              targetPlayer.properties[colG] = { cards: [], hasHouse: false, hasHotel: false };
            }
            targetPlayer.properties[colG]!.cards.push(givenCard);

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



  const botTurnTimeouts = new Map<string, NodeJS.Timeout>();

  function scheduleBotTurn(match: MatchState, delay = 1000) {
    const roomId = match.roomId;
    if (botTurnTimeouts.has(roomId)) {
      clearTimeout(botTurnTimeouts.get(roomId)!);
    }
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

      match.turnIndex = (match.turnIndex + 1) % match.players.length;
      match.actionsPlayedThisTurn = 0;
      match.turnStartedAt = Date.now();

      const nextPlayer = match.players[match.turnIndex];
      match.logs.push({
        id: `turn-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        message: `Sıra ${nextPlayer.username} adlı oyuncuda.`,
        timestamp: Date.now(),
      });

      triggerDrawForActivePlayer(match);
      broadcastToRoom(match.roomId, { type: 'room_update', matchState: match });

      // If next is bot or disconnected too, chain
      if (nextPlayer.isBot || nextPlayer.isDisconnected) {
        scheduleBotTurn(match, 1000);
      }
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

      // Centralized Turn & Round tracking
      if (match.turnNumber === undefined) {
        match.turnNumber = 1;
      }

      if (roomPreviousTurnIndex[roomId] !== undefined && roomPreviousTurnIndex[roomId] !== match.turnIndex) {
        const nextIdx = match.turnIndex;
        if (nextIdx === 0 && roomPreviousTurnIndex[roomId] > 0) {
          match.turnNumber++;
          match.logs.push({
            id: `round-start-${Date.now()}`,
            message: `${match.turnNumber}. Tur Başladı!`,
            timestamp: Date.now(),
            turnNumber: match.turnNumber
          });
        }
      }
      roomPreviousTurnIndex[roomId] = match.turnIndex;

      if (match.logs) {
        match.logs.forEach((log: any) => {
          if (log.turnNumber === undefined) {
            log.turnNumber = match.turnNumber;
          }
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

  // Host/Port binding
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

        match.turnIndex = (match.turnIndex + 1) % match.players.length;
        match.actionsPlayedThisTurn = 0;
        match.turnStartedAt = Date.now();

        const nextPlayer = match.players[match.turnIndex];
        match.logs.push({
          id: `turn-next-${Date.now()}`,
          message: `Sıra ${nextPlayer.username} adlı oyuncuda.`,
          timestamp: Date.now()
        });

        triggerDrawForActivePlayer(match);
        broadcastToRoom(roomId, { type: 'room_update', matchState: match });

        if (nextPlayer.isBot || nextPlayer.isDisconnected) {
          scheduleBotTurn(match, 1000);
        }
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
              match.turnIndex = (match.turnIndex + 1) % match.players.length;
              match.actionsPlayedThisTurn = 0;
              match.turnStartedAt = Date.now();

              const nextPlayer = match.players[match.turnIndex];
              match.logs.push({
                id: `turn-afk-${Date.now()}`,
                message: `Sıra ${nextPlayer.username} adlı oyuncuda. (Önceki oyuncu 3 hamlesini tamamladı)`,
                timestamp: Date.now()
              });

              triggerDrawForActivePlayer(match);
              if (nextPlayer.isBot || nextPlayer.isDisconnected) {
                scheduleBotTurn(match, 1000);
              }
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
            match.turnIndex = (match.turnIndex + 1) % match.players.length;
            match.actionsPlayedThisTurn = 0;
            match.turnStartedAt = Date.now();

            const nextPlayer = match.players[match.turnIndex];
            match.logs.push({
              id: `turn-afk-${Date.now()}`,
              message: `Sıra ${nextPlayer.username} adlı oyuncuda. (Önceki oyuncu 3 hamlesini tamamladı)`,
              timestamp: Date.now()
            });

            triggerDrawForActivePlayer(match);
            if (nextPlayer.isBot || nextPlayer.isDisconnected) {
              scheduleBotTurn(match, 1000);
            }
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

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Deal Master PRO Deal running on http://0.0.0.0:${PORT}`);
  });
}

const COLOR_LABELS: Record<CardColor, string> = {
  brown: 'Kahverengi',
  lightblue: 'Açık Mavi',
  pink: 'Pembe',
  orange: 'Turuncu',
  red: 'Kırmızı',
  yellow: 'Sarı',
  green: 'Yeşil',
  darkblue: 'Koyu Mavi',
  railroad: 'Demiryolu',
  utility: 'Kamu Hizmeti',
};

const RENT_VALUES: Record<CardColor, number[]> = {
  brown: [1, 2],
  lightblue: [1, 2, 3],
  pink: [1, 2, 4],
  orange: [1, 3, 5],
  red: [2, 3, 6],
  yellow: [2, 4, 6],
  green: [2, 4, 7],
  darkblue: [3, 8],
  railroad: [1, 2, 3, 4],
  utility: [1, 2],
};

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
      const col = colKey as CardColor;
      const propSet = targetPlayer.properties[col];
      if (propSet) {
        const idx = propSet.cards.findIndex((c: any) => c.id === cardIdToSteal);
        if (idx !== -1) {
          stolenCard = propSet.cards.splice(idx, 1)[0];
          stolenColor = col;
          if (propSet.cards.length === 0) {
            delete targetPlayer.properties[col];
          }
          break;
        }
      }
    }

    if (stolenCard) {
      const col = stolenCard.color || stolenColor || 'brown';
      if (!sourcePlayer.properties[col]) {
        sourcePlayer.properties[col] = { cards: [], hasHouse: false, hasHotel: false };
      }
      sourcePlayer.properties[col]!.cards.push(stolenCard);

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
    const targetColor = req.targetColor;
    if (targetColor) {
      const propSet = targetPlayer.properties[targetColor];
      if (propSet) {
        sourcePlayer.properties[targetColor] = { ...propSet };
        delete targetPlayer.properties[targetColor];

        match.logs.push({
          id: `db-res-${Date.now()}`,
          message: `${sourcePlayer.username}, ${targetPlayer.username} adlı oyuncunun tamamlanmış ${COLOR_LABELS[targetColor]} setini çaldı!`,
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
      const col = colKey as CardColor;
      const propSet = targetPlayer.properties[col];
      if (propSet) {
        const idx = propSet.cards.findIndex((c: any) => c.id === cardIdToSteal);
        if (idx !== -1) {
          stolenCard = propSet.cards.splice(idx, 1)[0];
          stolenColor = col;
          if (propSet.cards.length === 0) {
            delete targetPlayer.properties[col];
          }
          break;
        }
      }
    }

    for (const colKey in sourcePlayer.properties) {
      const col = colKey as CardColor;
      const propSet = sourcePlayer.properties[col];
      if (propSet) {
        const idx = propSet.cards.findIndex((c: any) => c.id === myCardIdToGive);
        if (idx !== -1) {
          givenCard = propSet.cards.splice(idx, 1)[0];
          givenColor = col;
          if (propSet.cards.length === 0) {
            delete sourcePlayer.properties[col];
          }
          break;
        }
      }
    }

    if (stolenCard && givenCard) {
      const colS = stolenCard.color || stolenColor || 'brown';
      if (!sourcePlayer.properties[colS]) {
        sourcePlayer.properties[colS] = { cards: [], hasHouse: false, hasHotel: false };
      }
      sourcePlayer.properties[colS]!.cards.push(stolenCard);

      const colG = givenCard.color || givenColor || 'brown';
      if (!targetPlayer.properties[colG]) {
        targetPlayer.properties[colG] = { cards: [], hasHouse: false, hasHotel: false };
      }
      targetPlayer.properties[colG]!.cards.push(givenCard);

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

// Handle Match Win State on Server
async function handleMatchWinner(match: any, winnerId: string) {
  match.status = 'finished';
  match.winnerId = winnerId;

  const winner = match.players.find((p: any) => p.id === winnerId);
  match.logs.push({
    id: `win-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    message: `Tebrikler! Maçı ${winner?.username} kazandı!`,
    timestamp: Date.now(),
  });

  // Award XP/Coins to the winner securely
  const users = await loadUsers();
  const winnerUser = users[winnerId];
  const dateStr = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  if (winnerUser) {
    winnerUser.coins += 200; // 200 coins win bonus
    winnerUser.xp += 150;
    winnerUser.stats.gamesPlayed++;
    winnerUser.stats.gamesWon++;
    winnerUser.stats.totalSetsCompleted += 3;

    // Check level up (every 500 XP is 1 level)
    winnerUser.level = Math.floor(winnerUser.xp / 500) + 1;

    // Update quests
    winnerUser.dailyQuests.forEach((q: any) => {
      if (q.description.includes('yen') || q.description.includes('maç')) {
        q.currentValue = Math.min(q.targetValue, q.currentValue + 1);
        if (q.currentValue >= q.targetValue) q.completed = true;
      }
    });

    if (!winnerUser.gamesHistory) winnerUser.gamesHistory = [];
    const oppNames = match.players.filter((p: any) => p.id !== winnerId).map((p: any) => p.username).join(', ');
    winnerUser.gamesHistory.unshift({
      id: `match-${Date.now()}`,
      date: dateStr,
      opponent: oppNames || 'Bot Rakipler',
      result: 'won',
      coinsEarned: 200,
      xpEarned: 150
    });

    users[winnerId] = winnerUser;
  }

  // Update losers
  match.players.forEach((p: any) => {
    if (p.id !== winnerId && !p.isBot) {
      const loserUser = users[p.id];
      if (loserUser) {
        loserUser.coins += 50; // loser participation bonus
        loserUser.xp += 50;
        loserUser.stats.gamesPlayed++;
        loserUser.stats.gamesLost++;
        loserUser.level = Math.floor(loserUser.xp / 500) + 1;

        if (!loserUser.gamesHistory) loserUser.gamesHistory = [];
        const oppNames = match.players.filter((x: any) => x.id !== p.id).map((x: any) => x.username).join(', ');
        loserUser.gamesHistory.unshift({
          id: `match-${Date.now()}`,
          date: dateStr,
          opponent: oppNames || 'Bot Rakipler',
          result: 'lost',
          coinsEarned: 50,
          xpEarned: 50
        });

        users[p.id] = loserUser;
      }
    }
  });

  await saveUsers(users);
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
