import React from 'react';
import { UserProfile, UserSettings, StoreItem } from '../types';
import { sounds } from '../lib/SoundSystem';
import { AvatarWithFrame } from './AvatarWithFrame';
import { t } from '../lib/TranslationSystem';
import { API_BASE_URL } from '../lib/apiConfig';

interface Props {
  profile: UserProfile;
  onUpdateProfile: (updated: UserProfile) => void;
}

export const AVATAR_EMOJIS: Record<string, string> = {
  avatar_classic: '👑',
  avatar_skater: '🛹',
  avatar_neon: '🌌',
  avatar_golden: '👑',
  avatar_alien: '👽',
  avatar_ninja: '🥷',
  avatar_wizard: '🧙',
  avatar_dragon: '🐉',
  avatar_astronaut: '🧑‍🚀',
  avatar_robot: '🤖',
  avatar_dj: '🎧',
  avatar_ghost: '👻',
  avatar_knight: '🛡️',
  avatar_unicorn: '🦄',
  avatar_pharaoh: '👑',
  avatar_zombie: '🧟',
  avatar_snowstorm: '🥶',
};

export const CARD_BACK_STYLES: Record<string, { color: string; symbol: string; bgClass?: string; pColor?: string }> = {
  back_classic: { color: '#EF4444', symbol: '▲', pColor: '#FCA5A5' },
  back_cosmic: { color: '#0F172A', symbol: '★', pColor: '#818CF8' },
  back_gold: { color: '#D97706', symbol: '♛', pColor: '#FBBF24' },
  back_neon: { color: '#EC407A', symbol: '▲', pColor: '#F472B6' },
  back_fire: { color: '#B91C1C', symbol: '🔥', pColor: '#F59E0B', bgClass: 'bg-gradient-to-br from-red-700 to-yellow-600' },
  back_ice: { color: '#0891B2', symbol: '❄️', pColor: '#22D3EE', bgClass: 'bg-gradient-to-br from-cyan-600 to-blue-500' },
  back_void: { color: '#3B0764', symbol: '🌀', pColor: '#C084FC', bgClass: 'bg-gradient-to-br from-purple-950 to-black' },
  back_matrix: { color: '#052E16', symbol: '💾', pColor: '#4ADE80', bgClass: 'bg-gradient-to-br from-green-950 to-black' },
  back_rainbow: { color: '#475569', symbol: '🌈', pColor: '#F87171', bgClass: 'bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500' },
  back_bubble: { color: '#38BDF8', symbol: '🫧', pColor: '#FFD6E8', bgClass: 'bg-gradient-to-br from-sky-400 to-pink-300' },
  back_steampunk: { color: '#78350F', symbol: '⚙️', pColor: '#F59E0B', bgClass: 'bg-gradient-to-br from-amber-800 to-zinc-700' },
  back_laser: { color: '#1E1B4B', symbol: '⚡', pColor: '#A78BFA', bgClass: 'bg-gradient-to-br from-violet-950 to-fuchsia-900' },
  back_galaxy: { color: '#1E1B4B', symbol: '🌌', pColor: '#C084FC', bgClass: 'bg-gradient-to-br from-purple-950 to-indigo-900' },
  back_darkness: { color: '#090514', symbol: '👁️', pColor: '#EC4899', bgClass: 'bg-gradient-to-br from-slate-950 to-purple-950' },
  back_snowstorm: { color: '#E2E8F0', symbol: '❄️', pColor: '#93C5FD', bgClass: 'bg-gradient-to-br from-blue-100 to-sky-300' },
};

export const BOARD_THEME_COLORS: Record<string, string> = {
  theme_slate: '#0F172A',
  theme_green: '#064E3B',
  theme_purple: '#581C87',
  theme_cyberpunk: '#090D16',
  theme_lava: '#450A0A',
  theme_abyss: '#020617',
  theme_gold: '#78350F',
  theme_sakura: '#500724',
  theme_ice: '#1E3A8A',
  theme_retro: '#311042',
  theme_toxic: '#022C22',
  theme_matrix: '#022C22',
  theme_space: '#0F172A',
  theme_desert: '#7C2D12',
  theme_snowstorm: '#0b1329',
};

export const BOARD_THEME_STYLES: Record<string, { bgClass: string; icon: string; badge: string; glowColor: string }> = {
  theme_slate: { bgClass: 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950', icon: '📁', badge: 'Klasik', glowColor: 'rgba(71, 85, 105, 0.4)' },
  theme_green: { bgClass: 'bg-gradient-to-br from-emerald-950 via-green-900 to-emerald-950', icon: '🟢', badge: 'Klasik Keçe', glowColor: 'rgba(16, 185, 129, 0.4)' },
  theme_purple: { bgClass: 'bg-gradient-to-br from-purple-950 via-violet-900 to-slate-950 border-amber-500/20 border', icon: '👑', badge: 'Kraliyet Kadifesi', glowColor: 'rgba(168, 85, 247, 0.4)' },
  theme_cyberpunk: { bgClass: 'bg-gradient-to-br from-blue-950 via-indigo-900 to-fuchsia-950 border-pink-500/20 border', icon: '⚡', badge: 'Siber Izgara', glowColor: 'rgba(236, 72, 153, 0.4)' },
  theme_lava: { bgClass: 'bg-gradient-to-br from-red-950 via-orange-950 to-black', icon: '🔥', badge: 'Magma Krateri', glowColor: 'rgba(239, 68, 68, 0.4)' },
  theme_abyss: { bgClass: 'bg-gradient-to-br from-slate-950 via-blue-950 to-black', icon: '🌀', badge: 'Karanlık Çukur', glowColor: 'rgba(14, 165, 233, 0.4)' },
  theme_gold: { bgClass: 'bg-gradient-to-br from-amber-950 via-yellow-900 to-stone-900 border-yellow-500/20 border', icon: '💰', badge: 'Hazine Odası', glowColor: 'rgba(245, 158, 11, 0.4)' },
  theme_sakura: { bgClass: 'bg-gradient-to-br from-rose-950 via-pink-950 to-stone-900', icon: '🌸', badge: 'Sakura Vadisi', glowColor: 'rgba(244, 114, 182, 0.4)' },
  theme_ice: { bgClass: 'bg-gradient-to-br from-sky-950 via-blue-900 to-slate-950', icon: '❄️', badge: 'Kar Fırtınası', glowColor: 'rgba(56, 189, 248, 0.4)' },
  theme_retro: { bgClass: 'bg-gradient-to-br from-purple-900 via-fuchsia-950 to-indigo-950', icon: '🕹️', badge: 'Atari Salonu', glowColor: 'rgba(192, 132, 252, 0.4)' },
  theme_toxic: { bgClass: 'bg-gradient-to-br from-teal-950 via-emerald-950 to-neutral-950', icon: '☣️', badge: 'Zehirli Vaha', glowColor: 'rgba(16, 185, 129, 0.4)' },
  theme_matrix: { bgClass: 'bg-gradient-to-br from-black via-emerald-950 to-black border-green-500/20 border', icon: '💾', badge: 'Sanal Matris', glowColor: 'rgba(34, 197, 94, 0.4)' },
  theme_space: { bgClass: 'bg-gradient-to-br from-slate-950 via-indigo-950 to-black', icon: '🚀', badge: 'Uzay İstasyonu', glowColor: 'rgba(99, 102, 241, 0.4)' },
  theme_desert: { bgClass: 'bg-gradient-to-br from-amber-950 via-orange-950 to-stone-900', icon: '🏜️', badge: 'Kayıp Tapınak', glowColor: 'rgba(245, 158, 11, 0.4)' },
  theme_atlantis: { bgClass: 'theme-atlantis-bg border-cyan-500/30 border', icon: '🌊', badge: 'Atlantis Canlı Mat', glowColor: 'rgba(6, 182, 212, 0.5)' },
  theme_volcano: { bgClass: 'theme-volcano-bg border-red-500/30 border', icon: '🌋', badge: 'Volkanik Canlı Mat', glowColor: 'rgba(239, 68, 68, 0.5)' },
  theme_snowstorm: { bgClass: 'bg-slate-900 border border-blue-400/30 shadow-[inset_0_0_20px_rgba(59,130,246,0.2)]', icon: '❄️', badge: 'Buzlu Canlı Mat', glowColor: 'rgba(147, 197, 253, 0.5)' },
};

export const PLAYER_BOARD_STYLES: Record<string, { bgClass: string; borderClass: string; textClass: string; glowClass: string; icon: string; nameTr: string; nameEn: string; descTr: string; descEn: string }> = {
  board_classic: {
    bgClass: 'bg-slate-900/90',
    borderClass: 'border-slate-800',
    textClass: 'text-slate-200',
    glowClass: '',
    icon: '🎴',
    nameTr: 'Klasik Siyah Tahta',
    nameEn: 'Classic Dark Board',
    descTr: 'Sade ve asil klasik mat siyah oyun tahtası.',
    descEn: 'Simple and noble classic matte dark gaming board.'
  },
  board_gold: {
    bgClass: 'bg-gradient-to-br from-amber-950/90 to-amber-900/90',
    borderClass: 'border-amber-400 border-2',
    textClass: 'text-amber-100',
    glowClass: 'shadow-[0_0_15px_rgba(245,158,11,0.5)] ring-1 ring-amber-400/30',
    icon: '👑',
    nameTr: 'V.I.P Altın Tahta',
    nameEn: 'V.I.P Golden Board',
    descTr: 'Altın işlemeli kenarlar ve sarı asil parıltılı kaplama.',
    descEn: 'Gold-embroidered borders with royal yellow glow.'
  },
  board_cyber: {
    bgClass: 'bg-gradient-to-br from-indigo-950/95 to-slate-950/95',
    borderClass: 'border-fuchsia-500 border-2',
    textClass: 'text-pink-100',
    glowClass: 'shadow-[0_0_15px_rgba(236,72,153,0.5)] ring-1 ring-pink-400/30',
    icon: '⚡',
    nameTr: 'Siber Neon Izgara',
    nameEn: 'Cyber Neon Grid',
    descTr: 'Neon pembe ve mavi siber çizgileriyle parlayan siber kart yuvası.',
    descEn: 'Sleek cyber slots glowing with neon pink and blue grids.'
  },
  board_magma: {
    bgClass: 'bg-gradient-to-br from-red-950/95 to-black/95',
    borderClass: 'border-orange-500 border-2',
    textClass: 'text-orange-100',
    glowClass: 'shadow-[0_0_15px_rgba(249,115,22,0.5)] ring-1 ring-orange-500/30 animate-pulse',
    icon: '🔥',
    nameTr: 'Magma Lav Tahtası',
    nameEn: 'Magma Lava Board',
    descTr: 'Sürekli kızışan aktif volkanik kor ve ateş efekti.',
    descEn: 'Constantly heating active volcanic embers and fire effect.'
  },
  board_galaxy: {
    bgClass: 'bg-gradient-to-br from-purple-950/95 via-indigo-950/95 to-black/95',
    borderClass: 'border-purple-400 border-2',
    textClass: 'text-purple-100',
    glowClass: 'shadow-[0_0_15px_rgba(168,85,247,0.5)] ring-1 ring-purple-400/30',
    icon: '🌌',
    nameTr: 'Nebula Galaksi Tahtası',
    nameEn: 'Nebula Galaxy Board',
    descTr: 'Mor yıldız tozu süzülmesi ve derin uzay görselliği.',
    descEn: 'Deep space visuals with floating purple star dust.'
  },
  board_ice: {
    bgClass: 'bg-gradient-to-br from-sky-950/90 to-blue-950/90',
    borderClass: 'border-blue-400 border-2',
    textClass: 'text-sky-100',
    glowClass: 'shadow-[0_0_15px_rgba(56,189,248,0.5)] ring-1 ring-sky-400/30',
    icon: '❄️',
    nameTr: 'Kutup Ayazı Buz Tahtası',
    nameEn: 'Frosty Glacier Board',
    descTr: 'Dondurucu rüzgar altında parıldayan kristal buz tabakası.',
    descEn: 'Crystal ice layer shining under sub-zero winds.'
  },
  board_void: {
    bgClass: 'bg-gradient-to-br from-violet-950/95 to-stone-950/95',
    borderClass: 'border-violet-600 border-2',
    textClass: 'text-violet-100',
    glowClass: 'shadow-[0_0_15px_rgba(139,92,246,0.4)] ring-1 ring-violet-600/30',
    icon: '🌀',
    nameTr: 'Karanlık Rift Tahtası',
    nameEn: 'Abyssal Void Board',
    descTr: 'Derin boşluktan çıkan mor aura ve gizemli karanlık.',
    descEn: 'Mysterious dark aura rising from the infinite void.'
  }
};

export const STORE_ITEMS: Omit<StoreItem, 'isUnlocked'>[] = [
  // Avatars
  { id: 'avatar_skater', name: 'Cool Kaykaycı', category: 'avatar', price: 100, description: 'Sokak modasına uygun şık kaykaycı avatarı.' },
  { id: 'avatar_neon', name: 'Cyber Neon', category: 'avatar', price: 250, description: 'Gelecekten gelen neon parıltılı hacker siber tasarımı.' },
  { id: 'avatar_golden', name: 'Altın Kral', category: 'avatar', price: 500, description: 'Lüks altın taçlı şampiyon Deal Master PRO Deal kralı.' },

  // NEW AVATARS (12)
  { id: 'avatar_alien', name: 'Siber Uzaylı', category: 'avatar', price: 120, description: 'Samanyolu dışından gelen siber zeka.' },
  { id: 'avatar_ninja', name: 'Gölge Ninja', category: 'avatar', price: 180, description: 'Gizlilik ve sessizlik ustası gölge.' },
  { id: 'avatar_wizard', name: 'Başbüyücü', category: 'avatar', price: 200, description: 'Kartların kaderini değiştiren büyücü.' },
  { id: 'avatar_dragon', name: 'Kadim Ejderha', category: 'avatar', price: 350, description: 'Ateş saçan görkemli efsane.' },
  { id: 'avatar_astronaut', name: 'Uzay Gezgini', category: 'avatar', price: 160, description: 'Derin uzay boşluğunda bir astronot.' },
  { id: 'avatar_robot', name: 'Siber Mekanik', category: 'avatar', price: 140, description: 'Yapay zeka temelli mekanik zeka.' },
  { id: 'avatar_dj', name: 'Ritmin Ustası DJ', category: 'avatar', price: 110, description: 'Arenaya kendi temposunu getiren DJ.' },
  { id: 'avatar_ghost', name: 'Kabus Hayalet', category: 'avatar', price: 130, description: 'Rakiplerinin kabusu olan ruh.' },
  { id: 'avatar_knight', name: 'Onurlu Şövalye', category: 'avatar', price: 220, description: 'Kraliyetin sadık koruyucusu.' },
  { id: 'avatar_unicorn', name: 'Efsanevi Unicorn', category: 'avatar', price: 300, description: 'Gökkuşağının parlayan efsanesi.' },
  { id: 'avatar_pharaoh', name: 'Mısır Firavunu', category: 'avatar', price: 280, description: 'Mısırın kadim altın hükümdarı.' },
  { id: 'avatar_zombie', name: 'Zombi Saldırganı', category: 'avatar', price: 90, description: 'Karanlık geceden fırlayan zombi.' },

  // Card Backs
  { id: 'back_cosmic', name: 'Kozmik Siyah', category: 'card_back', price: 150, description: 'Yıldızlar ve samanyolu desenli kozmik kart arkası.' },
  { id: 'back_gold', name: 'V.I.P Altın', category: 'card_back', price: 300, description: 'Altın kaplamalı elit kulüp lüks desen tasarımı.' },
  { id: 'back_neon', name: 'Retro Dalga', category: 'card_back', price: 200, description: '80\'lerin synthwave mor dalga çizgileri.' },

  // NEW CARD BACKS (10)
  { id: 'back_fire', name: 'Volkanik Magma', category: 'card_back', price: 160, description: 'Kızıl lav efektli sıcak kart arkalığı.' },
  { id: 'back_ice', name: 'Kutup Rüzgarı', category: 'card_back', price: 180, description: 'Kutup soğukluğu taşıyan kristal kartlar.' },
  { id: 'back_void', name: 'Karanlık Rift', category: 'card_back', price: 220, description: 'Uzay boşluğu çeken kara delik deseni.' },
  { id: 'back_matrix', name: 'Siber Kod Yağmuru', category: 'card_back', price: 250, description: 'Yeşil siber veri çizgileriyle akan kodlar.' },
  { id: 'back_rainbow', name: 'Gökkuşağı Prizması', category: 'card_back', price: 210, description: 'Tüm renk tayfını yansıtan prizma.' },
  { id: 'back_bubble', name: 'Deniz Köpüğü', category: 'card_back', price: 140, description: 'Su altı baloncuklu canlı tasarım.' },
  { id: 'back_steampunk', name: 'Buharlı Çark', category: 'card_back', price: 190, description: 'Bronz çarklar ve buhar makineleri.' },
  { id: 'back_laser', name: 'Retro Grid Lazer', category: 'card_back', price: 240, description: 'Lazer ışınlarıyla çizilmiş 80ler gridi.' },
  { id: 'back_galaxy', name: 'Nebula Bulutu', category: 'card_back', price: 280, description: 'Yıldız tozu ve mor nebula süzülmesi.' },
  { id: 'back_darkness', name: 'Gölgeler Diyarı', category: 'card_back', price: 170, description: 'Gizemli gözler ve koyu karanlık.' },

  // Board Themes
  { id: 'theme_green', name: 'Nane Yeşili', category: 'board_theme', price: 100, description: 'Klasik Deal Master PRO yeşil keçe masa tasarımı.' },
  { id: 'theme_purple', name: 'Kraliyet Moru', category: 'board_theme', price: 250, description: 'Mor renk kadife üzerine altın işlemeli lüks masa.' },
  { id: 'theme_cyberpunk', name: 'Siber Izgara', category: 'board_theme', price: 400, description: 'Karanlık odada parlayan siber neon oyun masası.' },

  // NEW BOARD THEMES (10)
  { id: 'theme_lava', name: 'Magma Krateri', category: 'board_theme', price: 220, description: 'Aktif yanardağ lavları üzerinde sıcak masa.' },
  { id: 'theme_abyss', name: 'Karanlık Çukur', category: 'board_theme', price: 240, description: 'Denizin en karanlık dip noktasındaki su altı arenası.' },
  { id: 'theme_gold', name: 'Hazine Odası', category: 'board_theme', price: 400, description: 'Saf altın külçelerle süslenmiş zengin kraliyet masası.' },
  { id: 'theme_sakura', name: 'Sakura Vadisi', category: 'board_theme', price: 260, description: 'Kiraz çiçeklerinin süzüldüğü huzurlu masa.' },
  { id: 'theme_ice', name: 'Kar Fırtınası', category: 'board_theme', price: 250, description: 'Kar fırtınası altında kalmış kristal buz masası.' },
  { id: 'theme_retro', name: 'Atari Salonu', category: 'board_theme', price: 300, description: '80ler atari salonu neon çizgi desenli masa.' },
  { id: 'theme_toxic', name: 'Zehirli Vaha', category: 'board_theme', price: 180, description: 'Yeşil asit havuzlu tekinsiz endüstriyel masa.' },
  { id: 'theme_matrix', name: 'Sanal Matris', category: 'board_theme', price: 350, description: 'Yeşil akan kod yağmuru altında sanal masa.' },
  { id: 'theme_space', name: 'Uzay İstasyonu', category: 'board_theme', price: 450, description: 'Dünya manzaralı uzay üssü gözlem masası.' },
  { id: 'theme_desert', name: 'Kayıp Tapınak', category: 'board_theme', price: 150, description: 'Mısır kumları altındaki kadim çöl masası.' },

  // Profile Frames
  { id: 'frame_neon', name: 'Neon Aura Çerçevesi', category: 'profile_frame', price: 150, description: 'Profil fotoğrafınızın etrafında harika pembe neon parlaması yaratır.' },
  { id: 'frame_gold', name: 'V.I.P Altın Çerçevesi', category: 'profile_frame', price: 300, description: 'Lüks altın kaplamasıyla elit oyuncuların tercihi.' },
  { id: 'frame_fire', name: 'Volkanik Ateş Çerçevesi', category: 'profile_frame', price: 200, description: 'Ateş kırmızısı ve lav akışı efektli çarpıcı çerçeve.' },
  { id: 'frame_royal', name: 'Kraliyet Elması Çerçevesi', category: 'profile_frame', price: 450, description: 'Göz kamaştırıcı mavi elmas süslemeleriyle şampiyonlara özel.' },

  // NEW PROFILE FRAMES (10)
  { id: 'frame_plasma', name: 'Plazma Kalkanı', category: 'profile_frame', price: 225, description: 'Mavi elektrik arklarıyla parlayan plazma çerçeve.' },
  { id: 'frame_rainbow', name: 'Gökkuşağı Spektrumu', category: 'profile_frame', price: 265, description: 'Sürekli renk değiştiren RGB spektrum çerçeve.' },
  { id: 'frame_toxic', name: 'Radyoaktif Slime', category: 'profile_frame', price: 175, description: 'Yemyeşil zehir akıntılı hareketli slime çerçeve.' },
  { id: 'frame_ice', name: 'Buz Kristali', category: 'profile_frame', price: 195, description: 'Kutup soğukluğu saçan parıltılı mavi buz çerçevesi.' },
  { id: 'frame_steampunk', name: 'Buharlı Dişliler', category: 'profile_frame', price: 215, description: 'Dönen bronz dişli çarklar ve bakır çerçeve.' },
  { id: 'frame_matrix', name: 'Matris Kod Hattı', category: 'profile_frame', price: 285, description: 'Aşağı akan yeşil binary siber kod çerçevesi.' },
  { id: 'frame_thunder', name: 'Şimşek Hattı', category: 'profile_frame', price: 325, description: 'Etrafından sarı şimşekler fırlayan dinamik çerçeve.' },
  { id: 'frame_darkness', name: 'Karanlık Duman', category: 'profile_frame', price: 245, description: 'Koyu mor gölge dumanları tüten gizemli çerçeve.' },
  { id: 'frame_galaxy', name: 'Galaksi Sarmalı', category: 'profile_frame', price: 350, description: 'Dönen galaksi sarmalı ve yıldız tozu aurası.' },
  { id: 'frame_dragon', name: 'Ejderha Pulları', category: 'profile_frame', price: 400, description: 'Kızıl ejderha pulları ve parıldayan pullu çerçeve.' },

  // Celebration Sounds
  { id: 'sound_classic', name: 'Klasik Melodi', category: 'celebration_sound', price: 0, description: 'Klasik retro tınılı zafer melodisi.' },
  { id: 'sound_applause', name: 'Coşkulu Alkış', category: 'celebration_sound', price: 100, description: 'Kritik hamlelerinizde ve zaferlerinizde çalan coşkulu alkış efekti.' },
  { id: 'sound_fireworks', name: 'Havai Fişek', category: 'celebration_sound', price: 180, description: 'Gökyüzünde patlayan renkli ve heyecanlı şenlik efekti.' },
  { id: 'sound_laser', name: 'Siber Lazer', category: 'celebration_sound', price: 150, description: 'Cyberpunk arenalara özel fütüristik retro lazer şovu.' },
  { id: 'sound_fanfare', name: 'Şampiyon Fanfarı', category: 'celebration_sound', price: 250, description: 'Zafere ulaştığınızda çalacak asil ve muhteşem şampiyon melodisi.' },

  // NEW CELEBRATION SOUNDS (8)
  { id: 'sound_victory', name: 'Zafer Marşı', category: 'celebration_sound', price: 200, description: 'Trompet sesleriyle dolu epik zafer marşı.' },
  { id: 'sound_arcade', name: '8-Bit Atari', category: 'celebration_sound', price: 120, description: 'Eski atari oyunları tarzı retro ses efektleri.' },
  { id: 'sound_coins', name: 'Para Yağmuru', category: 'celebration_sound', price: 150, description: 'Kasanıza para girerken çalan jackpot şıkırtısı.' },
  { id: 'sound_laser_zap', name: 'Lazer Silahı', category: 'celebration_sound', price: 130, description: 'Fütüristik siber lazer atış sesleri.' },
  { id: 'sound_rock', name: 'Elektro Gitar Riffi', category: 'celebration_sound', price: 220, description: 'Zafere ulaştığınızda çalan havalı gitar solosu.' },
  { id: 'sound_synthwave', name: 'Synthwave Bas', category: 'celebration_sound', price: 170, description: '80ler tarzı elektronik bas ritimleri.' },
  { id: 'sound_thunder', name: 'Kuvvetli Yıldırım', category: 'celebration_sound', price: 250, description: 'Hamlelerinizi taçlandıracak güçlü gök gürültüsü.' },
  { id: 'sound_magical', name: 'Sihirli Değnek', category: 'celebration_sound', price: 180, description: 'Kartlarınızı açtığınızda çalan parıltılı büyü melodisi.' },

  // DYNAMIC BOARD THEMES (Live Mats)
  { id: 'theme_atlantis', name: '🌊 Atlantis Krallığı', category: 'board_theme', price: 800, description: 'Derin okyanus mavisi, yüzen kabarcıklar, ışık kırılması ve deniz tozu partikülleri ile yaşayan bir sualtı masa deneyimi.' },
  { id: 'theme_volcano', name: '🌋 Volkanik Öfke', category: 'board_theme', price: 900, description: 'Nabız gibi atan lav çatlakları, kor parçacıkları ve ısı bozulması efektiyle volkanik bir arena.' },

  // CARD SKINS (Live Skins)
  { id: 'skin_holographic', name: '💠 Holografik Mavi Sektör', category: 'card_skin', price: 1200, description: 'Kartların üzerinde akan mavi veri ızgarası, hover titremesi ve set tamamlandığında radyal parıltı efekti.' },
  { id: 'skin_rune', name: '🔮 Mistik Rün Parşömeni', category: 'card_skin', price: 1000, description: 'Kart kenarlarında parlayan kadim rünler, parşömen dokusu ve kira ödendiğinde mavi-kırmızı renk geçişi.' },

  // ACTION VFX (Epic VFX)
  { id: 'vfx_meteor', name: '☄️ Meteor Saldırısı', category: 'action_vfx', price: 1500, description: 'Deal Breaker oynandığında ekrana meteor düşer, darbe anında ekran sallanır ve altın parçacık patlaması tetiklenir.' },
  { id: 'vfx_mirror_shield', name: '🛡️ Ayna Kalkan', category: 'action_vfx', price: 1300, description: 'Hayır Teşekkürler kartı oynandığında altıgen enerji kalkanı belirir, şok dalgası ve gökkuşağı kırılması efekti.' },

  // KAR FIRTINASI KONSEPT ÜRÜNLERİ (Snowstorm Concept Set)
  { id: 'avatar_snowstorm', name: '❄️ Kar Fırtınası Savaşçısı', category: 'avatar', price: 300, description: 'Kutup ayazında dövüşen buz zırhlı efsanevi savaşçı.' },
  { id: 'back_snowstorm', name: '❄️ Kar Fırtınası', category: 'card_back', price: 200, description: 'Buz kristalleriyle kaplı, soğuk kutup rüzgarı desenli kart arkası.' },
  { id: 'theme_snowstorm', name: '❄️ Dinamik Kar Fırtınası', category: 'board_theme', price: 650, description: 'Sürekli yağan kar taneleri ve buz tutmuş zemin efektiyle yaşayan kış masası.' },
  { id: 'frame_snowstorm', name: '❄️ Kar Fırtınası Çerçevesi', category: 'profile_frame', price: 250, description: 'Buz parçacıkları saçan, hareketli kar fırtınası aurası.' },
  { id: 'sound_snowstorm', name: '❄️ Çığ ve Fırtına Sesi', category: 'celebration_sound', price: 200, description: 'Zafer anınızda çalan ürpertici çığ ve dondurucu fırtına uğultusu.' },
  { id: 'skin_snowstorm', name: '❄️ Donmuş Buz Kaplama', category: 'card_skin', price: 1100, description: 'Kartların üzerinde parıldayan buz kristalleri ve set tamamlandığında buhar çıkma efekti.' },
  { id: 'vfx_snowstorm', name: '❄️ Çığ Felaketi', category: 'action_vfx', price: 1400, description: 'Aksiyon kartı oynandığında oyun alanını kaplayan kar fırtınası ve ekran donması efekti.' },

  // Player Board Designs (New requested category)
  { id: 'board_classic', name: '🎴 Klasik Siyah Tahta', category: 'player_board', price: 0, description: 'Sade ve asil klasik mat siyah oyuncu tahtası.' },
  { id: 'board_gold', name: '👑 V.I.P Altın Tahta', category: 'player_board', price: 350, description: 'Rakiplerinizi büyüleyecek lüks altın parıltılı çerçeveli oyuncu alanı tasarımı.' },
  { id: 'board_cyber', name: '⚡ Siber Neon Tahta', category: 'player_board', price: 400, description: 'Sürekli akan pembe-mavi siber ızgaralı ve ışık hüzmeli oyuncu alanı tasarımı.' },
  { id: 'board_magma', name: '🔥 Magma Lav Tahtası', category: 'player_board', price: 450, description: 'Kızgın lav çatlakları ve patlayan kıvılcım efektli oyuncu alanı tasarımı.' },
  { id: 'board_galaxy', name: '🌌 Nebula Galaksi Tahtası', category: 'player_board', price: 500, description: 'Sonsuz derinlik hissi veren dönen nebula bulutları ile süslü oyuncu alanı tasarımı.' },
  { id: 'board_ice', name: '❄️ Kutup Ayazı Buz Tahtası', category: 'player_board', price: 300, description: 'Dondurucu buz kristalleriyle çevrelenmiş şık kutup temalı oyuncu alanı tasarımı.' },
  { id: 'board_void', name: '🌀 Karanlık Rift Tahtası', category: 'player_board', price: 420, description: 'Hiçliğin derinliklerinden gelen gizemli mor aura ve parçacık süzülmeli tasarım.' }
];

export const ShopDialog: React.FC<Props> = ({ profile, onUpdateProfile }) => {
  const [itemsList, setItemsList] = React.useState<StoreItem[]>(STORE_ITEMS);
  const [activeCategory, setActiveCategory] = React.useState<'all' | 'avatar' | 'card_back' | 'board_theme' | 'profile_frame' | 'celebration_sound' | 'card_skin' | 'action_vfx' | 'player_board'>('all');
  const [buyingId, setBuyingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [previewItem, setPreviewItem] = React.useState<StoreItem | null>(null);
  const [soundIsPlaying, setSoundIsPlaying] = React.useState<boolean>(false);
  const [purchasedItemName, setPurchasedItemName] = React.useState<string | null>(null);
  const [vfxTrigger, setVfxTrigger] = React.useState<boolean>(false);

  React.useEffect(() => {
    fetch(`${API_BASE_URL}/api/shop/items`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setItemsList(data);
        }
      })
      .catch((err) => console.error('Error fetching shop items:', err));
  }, []);

  const filteredItems = itemsList.filter(
    (item) => activeCategory === 'all' || item.category === activeCategory
  );

  const isItemEquipped = (item: StoreItem) => {
    if (item.category === 'avatar') return profile.avatarId === item.id;
    if (item.category === 'card_back') return profile.settings.cardBack === item.id;
    if (item.category === 'board_theme') return profile.settings.boardTheme === item.id;
    if (item.category === 'profile_frame') return profile.settings.profileFrame === item.id;
    if (item.category === 'celebration_sound') return profile.settings.celebrationSound === item.id;
    if (item.category === 'card_skin') return profile.settings.cardSkin === item.id;
    if (item.category === 'action_vfx') return profile.settings.actionVfx === item.id;
    if (item.category === 'player_board') return profile.settings.playerBoard === item.id;
    return false;
  };

  const handleEquipItem = async (item: StoreItem) => {
    let settingKey: keyof UserSettings | 'avatarId' | null = null;
    if (item.category === 'avatar') settingKey = 'avatarId';
    else if (item.category === 'card_back') settingKey = 'cardBack';
    else if (item.category === 'board_theme') settingKey = 'boardTheme';
    else if (item.category === 'profile_frame') settingKey = 'profileFrame';
    else if (item.category === 'celebration_sound') settingKey = 'celebrationSound';
    else if (item.category === 'card_skin') settingKey = 'cardSkin';
    else if (item.category === 'action_vfx') settingKey = 'actionVfx';
    else if (item.category === 'player_board') settingKey = 'playerBoard';

    if (!settingKey) return;

    const updatedSettings: UserSettings = {
      ...profile.settings,
      ...(settingKey !== 'avatarId' ? { [settingKey]: item.id } : {})
    };

    let updatedAvatarUrl = profile.avatarUrl;
    if (settingKey === 'avatarId') {
      if (item.mediaUrl) {
        updatedAvatarUrl = item.mediaUrl;
      } else if (item.id && (item.id.startsWith('http') || item.id.startsWith('/') || item.id.startsWith('data:'))) {
        updatedAvatarUrl = item.id;
      } else {
        updatedAvatarUrl = undefined;
      }
    }

    const updatedProfile: UserProfile = {
      ...profile,
      settings: updatedSettings,
      ...(settingKey === 'avatarId' ? { avatarId: item.id, avatarUrl: updatedAvatarUrl } : {})
    };

    onUpdateProfile(updatedProfile);
    sounds.playPlay(updatedSettings);

    try {
      await fetch(`${API_BASE_URL}/api/settings/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile.id, settings: { [settingKey]: item.id } }),
      });
    } catch (e) {
      console.error('Failed to save equipped item settings:', e);
    }
  };

  const handleBuy = async (itemId: string, price: number) => {
    if (profile.coins < price) {
      setError('Yetersiz altın! Daha fazla maç kazanarak altın biriktirin.');
      sounds.playAlert(profile.settings);
      return;
    }

    setBuyingId(itemId);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/shop/buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile.id, itemId }),
      });

      if (response.ok) {
        const data = await response.json();

        const storeItem = itemsList.find(item => item.id === itemId);
        let settingKey: keyof UserSettings | 'avatarId' | null = null;

        if (storeItem) {
          if (storeItem.category === 'avatar') settingKey = 'avatarId';
          else if (storeItem.category === 'card_back') settingKey = 'cardBack';
          else if (storeItem.category === 'board_theme') settingKey = 'boardTheme';
          else if (storeItem.category === 'profile_frame') settingKey = 'profileFrame';
          else if (storeItem.category === 'celebration_sound') settingKey = 'celebrationSound';
          else if (storeItem.category === 'card_skin') settingKey = 'cardSkin';
          else if (storeItem.category === 'action_vfx') settingKey = 'actionVfx';
          else if (storeItem.category === 'player_board') settingKey = 'playerBoard';
        }

        const updatedSettings: UserSettings = {
          ...profile.settings,
          ...(settingKey && settingKey !== 'avatarId' ? { [settingKey]: itemId } : {})
        };

        let updatedAvatarUrl = profile.avatarUrl;
        if (settingKey === 'avatarId' && storeItem) {
          if (storeItem.mediaUrl) {
            updatedAvatarUrl = storeItem.mediaUrl;
          } else if (storeItem.id && (storeItem.id.startsWith('http') || storeItem.id.startsWith('/') || storeItem.id.startsWith('data:'))) {
            updatedAvatarUrl = storeItem.id;
          } else {
            updatedAvatarUrl = undefined;
          }
        }

        // Success - Auto-equip the newly purchased item!
        const updatedProfile: UserProfile = {
          ...profile,
          coins: data.coins,
          unlockedItems: data.unlockedItems,
          achievements: data.achievements || profile.achievements,
          settings: updatedSettings,
          ...(settingKey === 'avatarId' ? { avatarId: itemId, avatarUrl: updatedAvatarUrl } : {})
        };
        onUpdateProfile(updatedProfile);
        sounds.playCoin(profile.settings);

        if (settingKey) {
          fetch(`${API_BASE_URL}/api/settings/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: profile.id, settings: { [settingKey]: itemId } }),
          }).catch(err => console.error('Error auto equipping settings:', err));
        }

        if (storeItem) {
          setPurchasedItemName(storeItem.name);
          setTimeout(() => setPurchasedItemName(null), 4000);
        }

        // Update local preview state
        if (previewItem && previewItem.id === itemId) {
          sounds.playCelebration('sound_laser', profile.settings);
        }
      } else {
        const errData = await response.json();
        setError(errData.error || 'Satın alma işlemi başarısız oldu.');
        sounds.playAlert(profile.settings);
      }
    } catch (e) {
      setError('Sunucu bağlantı hatası oluştu.');
      sounds.playAlert(profile.settings);
    } finally {
      setBuyingId(null);
    }
  };

  const playPreviewSound = (itemId: string) => {
    setSoundIsPlaying(true);
    sounds.playCelebration(itemId, profile.settings);
    setTimeout(() => {
      setSoundIsPlaying(false);
    }, 1500);
  };

  return (
    <div id="shop-dialog" className="bg-black/20 border border-white/10 rounded-2xl p-6 text-white max-w-4xl mx-auto shadow-2xl relative">
      {/* Shop Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 border-b border-white/10 pb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>🛒</span> {t('shop_title_lbl', profile)}
          </h2>
          <p className="text-slate-400 text-sm">{t('shop_desc_lbl', profile)}</p>
        </div>
        <div className="flex items-center gap-2 bg-black/40 border border-white/5 px-4 py-2 rounded-xl">
          <div className="w-3.5 h-3.5 bg-yellow-400 rounded-full shadow-md shadow-yellow-500/20"></div>
          <span className="font-bold text-amber-300 text-lg">{t('shop_coins_lbl', profile, profile.coins)}</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-2">
          <span>⚠️</span> {error}
        </div>
      )}

      {/* Categories Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { id: 'all', label: t('shop_tab_all', profile) },
          { id: 'avatar', label: t('shop_tab_avatars', profile) },
          { id: 'card_back', label: t('shop_tab_card_backs', profile) },
          { id: 'board_theme', label: t('shop_tab_themes', profile) },
          { id: 'profile_frame', label: t('shop_tab_frames', profile) },
          { id: 'celebration_sound', label: t('shop_tab_sounds', profile) },
          { id: 'card_skin', label: t('shop_tab_card_skins', profile) },
          { id: 'action_vfx', label: t('shop_tab_action_vfx', profile) },
          { id: 'player_board', label: profile.settings.language === 'en' ? '🏆 Player Boards' : '🏆 Oyuncu Tahtaları' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveCategory(tab.id as any);
              sounds.playPlay(profile.settings);
            }}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${activeCategory === tab.id
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/15'
                : 'bg-white/5 hover:bg-white/10 text-slate-300'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Store Items Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.map((item) => {
          const isUnlocked = item.id === 'sound_classic' || profile.unlockedItems.includes(item.id);
          const isPremium = item.price >= 350 || item.id.includes('theme_atlantis') || item.id.includes('theme_volcano') || item.id.includes('skin_') || item.id.includes('vfx_');

          return (
            <div
              key={item.id}
              className={`rounded-2xl p-4 flex flex-col justify-between transition-all relative group shop-card-3d ${
                isPremium
                  ? 'premium-item-glow'
                  : 'bg-black/25 border border-white/5 hover:border-white/10 shadow-lg'
              }`}
            >
              {isPremium && <div className="premium-shimmer-overlay rounded-2xl" />}

              <div className="relative z-10 flex flex-col h-full justify-between">
                <div>
                  {/* Visual Preview Container */}
                  <div
                    onClick={() => {
                      setPreviewItem(item);
                      sounds.playPlay(profile.settings);
                    }}
                    className={`aspect-[4/3] rounded-xl mb-4 bg-black/40 flex items-center justify-center relative overflow-hidden group border cursor-pointer hover:bg-black/60 transition-all ${
                      isPremium ? 'border-amber-500/25' : 'border-white/5'
                    }`}
                    title="Önizlemek için Tıklayın"
                  >
                    {/* Rarity & Discount Badges */}
                    <div className="absolute top-2 left-2 z-20 flex flex-col gap-1 items-start pointer-events-none">
                      {item.rarity && (
                        <div className={`px-2 py-0.5 rounded-full border text-[8px] font-black uppercase tracking-wider shadow-md backdrop-blur-md ${
                          item.rarity === 'mythic' ? 'bg-gradient-to-r from-red-600/90 via-pink-600/90 to-purple-600/90 text-white border-pink-400 animate-pulse' :
                          item.rarity === 'legendary' ? 'bg-amber-500/90 text-amber-100 border-amber-300 animate-pulse' :
                          item.rarity === 'epic' ? 'bg-purple-600/90 text-purple-100 border-purple-400' :
                          item.rarity === 'rare' ? 'bg-blue-600/90 text-blue-100 border-blue-400' :
                          'bg-slate-800/80 text-slate-300 border-slate-600'
                        }`}>
                          {item.rarity === 'mythic' ? '🔥 MİSTİK' :
                           item.rarity === 'legendary' ? '🟡 EFSANEVİ' :
                           item.rarity === 'epic' ? '🟣 EPİK' :
                           item.rarity === 'rare' ? '🔵 NADİR' : '⚪ YAYGIN'}
                        </div>
                      )}
                      {item.discountPercent && item.discountPercent > 0 ? (
                        <div className="bg-rose-600 text-white font-black text-[8px] px-2 py-0.5 rounded-full border border-rose-400 shadow-md animate-bounce">
                          %{item.discountPercent} İNDİRİM
                        </div>
                      ) : null}
                    </div>

                    {/* Glassmorphic hover overlay */}
                    <div className="absolute inset-0 bg-red-600/0 group-hover:bg-red-600/10 flex items-center justify-center transition-all duration-300 z-10">
                      <span className="opacity-0 group-hover:opacity-100 bg-black/85 border border-white/10 text-white font-black text-[10px] px-3 py-1.5 rounded-full shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-all tracking-wider">
                        🔍 ÖNİZLEME PENCERESİ
                      </span>
                    </div>

                    {item.mediaUrl ? (
                      item.mediaType === 'video' || item.mediaUrl.endsWith('.mp4') || item.mediaUrl.endsWith('.webm') || item.mediaUrl.includes('video') ? (
                        <div className="w-full h-full relative flex items-center justify-center overflow-hidden">
                          <video
                            src={item.mediaUrl}
                            autoPlay
                            loop
                            muted
                            playsInline
                            className="w-full h-full object-cover rounded-xl"
                          />
                          <div className="absolute top-2 right-2 bg-black/80 text-amber-300 border border-amber-500/30 text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 z-20 shadow-md">
                            🎬 VİDEO
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-full relative flex items-center justify-center overflow-hidden">
                          <img
                            src={item.mediaUrl}
                            alt={item.name}
                            className="w-full h-full object-cover rounded-xl"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute top-2 right-2 bg-black/80 text-sky-300 border border-sky-500/30 text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 z-20 shadow-md">
                            {item.mediaType === 'gif' || item.mediaUrl.endsWith('.gif') ? '✨ GIF' : '🖼️ RESİM'}
                          </div>
                        </div>
                      )
                    ) : (
                      item.category === 'avatar' && (
                        <div className="w-18 h-18 rounded-full border-4 border-red-500/80 flex items-center justify-center text-4xl bg-gradient-to-br from-slate-800 to-slate-900 shadow-xl shadow-red-950/40 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 relative overflow-hidden">
                          {AVATAR_EMOJIS[item.id] || '👑'}
                          <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        </div>
                      )
                    )}

                    {item.category === 'card_back' && (() => {
                      const cBack = CARD_BACK_STYLES[item.id] || { color: '#EF4444', symbol: '▲', pColor: '#FFF' };
                      return (
                        <div className="relative p-1">
                          <div
                            className={`w-14 h-22 rounded-xl border flex flex-col justify-between p-2 shadow-xl transition-all duration-300 ${cBack.bgClass || ''} group-hover:scale-110 group-hover:rotate-3 relative overflow-hidden`}
                            style={{
                              backgroundColor: cBack.bgClass ? undefined : cBack.color,
                              borderColor: cBack.pColor || 'rgba(255, 255, 255, 0.2)',
                              boxShadow: `0 8px 16px -4px rgba(0,0,0,0.5), 0 0 12px ${(cBack.pColor || '#FFFFFF')}25`
                            }}
                          >
                            <div className="text-[6px] font-black text-white/30 select-none text-left tracking-wide">DEAL</div>
                            <span className="text-white text-3xl font-black self-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] select-none animate-pulse">
                              {cBack.symbol}
                            </span>
                            <div className="text-[6px] font-black text-white/30 select-none text-right tracking-wide">PRO</div>
                            {/* Inner thin border frame to look like a premium playing card */}
                            <div className="absolute inset-1 border border-white/5 rounded-lg pointer-events-none" />
                          </div>
                        </div>
                      );
                    })()}

                    {item.category === 'board_theme' && (() => {
                      const tStyle = BOARD_THEME_STYLES[item.id] || { bgClass: 'bg-slate-900', icon: '📁', badge: 'Klasik', glowColor: 'rgba(255,255,255,0.1)' };
                      return (
                        <div
                          className={`w-full h-full flex flex-col items-center justify-center transition-all duration-300 relative ${tStyle.bgClass}`}
                          style={{
                            boxShadow: `inset 0 0 25px ${tStyle.glowColor}`
                          }}
                        >
                          <div className="text-3xl filter drop-shadow-[0_0_8px_rgba(255,255,255,0.15)] animate-bounce-subtle select-none z-10">
                            {tStyle.icon}
                          </div>
                          <div className="absolute bottom-2 bg-black/60 border border-white/10 px-2.5 py-0.5 rounded-full text-[8px] font-black tracking-wider uppercase text-slate-300 z-10">
                            {tStyle.badge}
                          </div>
                          {/* Felt pattern overlay texture */}
                          <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.03)_1.2px,transparent_1.2px)] [background-size:10px_10px] opacity-60 pointer-events-none" />
                        </div>
                      );
                    })()}

                    {item.category === 'profile_frame' && (
                      <div className="scale-100 group-hover:scale-110 transition-transform duration-300">
                        <AvatarWithFrame
                          avatarId="avatar_classic"
                          avatarUrl={profile.avatarUrl}
                          frameId={item.id}
                          sizeClassName="w-20 h-20 text-4xl"
                        />
                      </div>
                    )}

                    {item.category === 'celebration_sound' && (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-500/20 to-red-500/10 border border-amber-500/30 flex items-center justify-center text-3xl text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.15)] group-hover:scale-110 group-hover:rotate-12 transition-all duration-300">
                          {item.id === 'sound_snowstorm' ? '❄️' : '🔊'}
                        </div>
                        {/* Animated audio visualizer waves */}
                        <div className="flex gap-0.5 items-end justify-center h-3 w-10">
                          <div className="w-0.75 bg-amber-500 rounded-full animate-pulse h-1" />
                          <div className="w-0.75 bg-amber-400 rounded-full animate-pulse h-2" style={{ animationDelay: '0.15s' }} />
                          <div className="w-0.75 bg-red-500 rounded-full animate-pulse h-3" style={{ animationDelay: '0.3s' }} />
                          <div className="w-0.75 bg-amber-400 rounded-full animate-pulse h-1.5" style={{ animationDelay: '0.45s' }} />
                        </div>
                      </div>
                    )}

                    {item.category === 'card_skin' && (
                      <div className="w-16 h-24 rounded-xl border border-white/25 bg-slate-900 flex flex-col justify-between p-2 shadow-2xl relative overflow-hidden group-hover:scale-110 group-hover:-rotate-2 transition-all duration-300">
                        {/* Live overlay elements */}
                        <div className="absolute inset-0 pointer-events-none">
                          {item.id === 'skin_holographic' && <div className="skin-holographic-overlay absolute inset-0" />}
                          {item.id === 'skin_rune' && <div className="skin-rune-overlay absolute inset-0" />}
                          {item.id === 'skin_snowstorm' && <div className="absolute inset-0 bg-gradient-to-br from-blue-300/30 to-sky-100/20 backdrop-blur-[1px] animate-pulse" />}
                        </div>
                        <div className="text-[5px] font-black text-amber-400 tracking-wider z-10 select-none">PRO SKIN</div>
                        <div className="text-xl self-center z-10 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                          {item.id === 'skin_holographic' ? '💠' : item.id === 'skin_rune' ? '🔮' : '❄️'}
                        </div>
                        <div className="text-[6px] font-black text-slate-400 bg-black/60 border border-white/10 px-1 py-0.5 rounded text-center z-10 select-none">
                          {item.id === 'skin_holographic' ? 'HOLOGRAM' : item.id === 'skin_rune' ? 'RÜN' : 'DONMUŞ'}
                        </div>
                      </div>
                    )}

                    {item.category === 'action_vfx' && (
                      <div className="relative">
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-red-600/20 to-orange-500/15 border-2 border-red-500/40 flex items-center justify-center text-3xl text-red-400 group-hover:scale-110 transition-all duration-300 relative shadow-[0_0_20px_rgba(239,68,68,0.25)]">
                          <span className="animate-pulse">{item.id === 'vfx_meteor' ? '☄️' : (item.id === 'vfx_snowstorm' ? '❄️' : '🛡️')}</span>
                          <div className="absolute inset-0 rounded-full border border-red-500/25 scale-125 animate-ping" />
                        </div>
                        <div className="absolute -bottom-1 -right-1 bg-red-600 border border-red-400/20 text-white font-extrabold text-[7px] px-1 rounded uppercase tracking-wider scale-90">VFX</div>
                      </div>
                    )}

                    {item.category === 'player_board' && (() => {
                      const bStyle = PLAYER_BOARD_STYLES[item.id] || PLAYER_BOARD_STYLES.board_classic;
                      return (
                        <div className={`w-[130px] p-2 rounded-xl border-2 transition-all duration-300 flex flex-col justify-between ${bStyle.bgClass} ${bStyle.borderClass} ${bStyle.glowClass}`}>
                          <div className="flex items-center gap-1">
                            <span className="text-sm select-none">{bStyle.icon}</span>
                            <span className="text-[8px] font-black tracking-wider uppercase truncate max-w-[80px] text-slate-100">
                              {profile.settings.language === 'en' ? bStyle.nameEn.split(' ')[0] : bStyle.nameTr.split(' ')[0]}
                            </span>
                          </div>
                          <div className="flex gap-0.5 mt-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" style={{ animationDelay: '0.1s' }} />
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" style={{ animationDelay: '0.2s' }} />
                          </div>
                        </div>
                      );
                    })()}

                    {isUnlocked && (
                      <div className="absolute top-2 right-2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold px-2.5 py-0.5 rounded-full z-20 shadow-sm animate-pulse">
                        Açık
                      </div>
                    )}
                  </div>

                  <h4 className="font-extrabold text-base text-slate-100 mb-1 flex items-center gap-1.5 group-hover:text-amber-400 transition-colors">
                    {item.name}
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed mb-4">{item.description}</p>
                </div>

                <div className="mt-auto">
                  {isUnlocked ? (
                    isItemEquipped(item) ? (
                      <button
                        disabled
                        className="w-full py-2.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-extrabold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-default uppercase tracking-wider"
                      >
                        <span>✓</span> KULLANILIYOR
                      </button>
                    ) : (
                      <button
                        onClick={() => handleEquipItem(item)}
                        className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-black rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/20 active:scale-95 transform cursor-pointer tracking-wider uppercase"
                      >
                        <span>⚡</span> AKTİFLEŞTİR
                      </button>
                    )
                  ) : (
                    <button
                      onClick={() => handleBuy(item.id, item.price)}
                      disabled={buyingId !== null}
                      className="w-full py-2.5 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-black rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 active:scale-95 transform cursor-pointer tracking-wider uppercase"
                    >
                      {buyingId === item.id ? (
                        <span className="animate-spin text-sm">⏳</span>
                      ) : (
                        <>
                          <span>💰</span> {item.price} Altın - Satın Al
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* DETAILED INTERACTIVE PREVIEW MODAL */}
      {previewItem && (() => {
        const isUnlocked = previewItem.id === 'sound_classic' || profile.unlockedItems.includes(previewItem.id);

        return (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[99] p-4">
            <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-lg p-6 relative overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] animate-play-card">
              {/* Close Button */}
              <button
                onClick={() => {
                  setPreviewItem(null);
                  sounds.playPlay(profile.settings);
                }}
                className="absolute top-4 right-4 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-full cursor-pointer transition-all z-10"
              >
                ✕
              </button>

              <div className="text-center mb-6">
                <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest bg-red-500/10 px-2.5 py-1 rounded-full">
                  ✨ ÜRÜN ÖNİZLEME ODASI
                </span>
                <h3 className="text-2xl font-black text-white mt-3">{previewItem.name}</h3>
                <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">{previewItem.description}</p>
              </div>

              {/* Dynamic Animation Area */}
              <div className="bg-black/40 border border-white/5 rounded-2xl aspect-[1.5] flex items-center justify-center relative overflow-hidden p-6 mb-6">
                {previewItem.mediaUrl ? (
                  <div className="w-full h-full relative flex items-center justify-center overflow-hidden rounded-xl">
                    {previewItem.mediaType === 'video' || previewItem.mediaUrl.endsWith('.mp4') || previewItem.mediaUrl.endsWith('.webm') || previewItem.mediaUrl.includes('video') ? (
                      <video
                        src={previewItem.mediaUrl}
                        autoPlay
                        loop
                        muted
                        playsInline
                        controls
                        className="w-full h-full object-contain rounded-xl"
                      />
                    ) : (
                      <img
                        src={previewItem.mediaUrl}
                        alt={previewItem.name}
                        className="w-full h-full object-contain rounded-xl"
                        referrerPolicy="no-referrer"
                      />
                    )}
                  </div>
                ) : (
                  previewItem.category === 'avatar' && (
                    <div className="flex flex-col items-center gap-3 relative">
                      <div className="w-24 h-24 rounded-full border-4 border-red-500 flex items-center justify-center text-5xl bg-slate-800 shadow-xl animate-bounce-subtle z-10 relative">
                        {AVATAR_EMOJIS[previewItem.id] || '👑'}
                      </div>
                      {/* Ripple background ring */}
                      <div className="absolute inset-0 w-32 h-32 rounded-full border border-red-500/20 scale-110 animate-ping opacity-30 pointer-events-none self-center top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    </div>
                  )
                )}

                {previewItem.category === 'card_back' && (() => {
                  const cBack = CARD_BACK_STYLES[previewItem.id] || { color: '#EF4444', symbol: '▲', pColor: '#FCA5A5' };
                  return (
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-28 h-40 rounded-xl border-2 flex flex-col justify-between p-3 shadow-2xl transition-all duration-500 relative overflow-hidden ${cBack.bgClass || ''}`}
                        style={{
                          backgroundColor: cBack.bgClass ? undefined : cBack.color,
                          borderColor: cBack.pColor || '#FFFFFF',
                          boxShadow: `0 0 25px ${(cBack.pColor || '#FFFFFF')}80`
                        }}
                      >
                        {/* Particles inside card */}
                        <div className="absolute inset-0 pointer-events-none">
                          {[...Array(12)].map((_, idx) => (
                            <span
                              key={idx}
                              className="absolute rounded-full animate-float"
                              style={{
                                left: `${10 + Math.random() * 80}%`,
                                bottom: '-10px',
                                width: `${2 + Math.random() * 4}px`,
                                height: `${2 + Math.random() * 4}px`,
                                backgroundColor: cBack.pColor || '#FFFFFF',
                                boxShadow: `0 0 8px ${cBack.pColor || '#FFFFFF'}`,
                                animationDelay: `${idx * 0.15}s`,
                                animationDuration: '1.6s'
                              }}
                            />
                          ))}
                        </div>

                        <div className="text-white/25 text-left text-[8px] font-black tracking-widest leading-none select-none">Deal Master PRO</div>

                        <span className="text-white text-5xl font-black self-center drop-shadow-xl animate-pulse">
                          {cBack.symbol}
                        </span>

                        <div className="text-white/25 text-right text-[8px] font-black tracking-widest leading-none select-none">DEAL</div>
                      </div>
                      <span className="text-[10px] text-amber-400 font-bold mt-3 animate-pulse">
                        ✨ HAREKETLİ TEKSTÜR VE EFEKTLER AKTİF ✨
                      </span>
                    </div>
                  );
                })()}

                {previewItem.category === 'board_theme' && (() => {
                  const tStyle = BOARD_THEME_STYLES[previewItem.id] || { bgClass: 'bg-slate-900', icon: '📁', badge: 'Klasik', glowColor: 'rgba(255,255,255,0.1)' };
                  return (
                    <div
                      className={`w-full h-full rounded-xl p-4 flex flex-col justify-between transition-all duration-500 border border-white/10 relative overflow-hidden ${tStyle.bgClass}`}
                      style={{
                        boxShadow: `inset 0 0 30px ${tStyle.glowColor}, 0 4px 20px rgba(0,0,0,0.6)`
                      }}
                    >
                      {previewItem.id === 'theme_snowstorm' && (
                        <div className="absolute inset-0 bg-blue-500/5 backdrop-blur-[0.5px] pointer-events-none flex flex-wrap justify-around items-center opacity-30">
                          <span>❄️</span><span>❄️</span><span>❄️</span><span>❄️</span>
                        </div>
                      )}
                      <div className="w-full flex justify-between items-center border-b border-white/5 pb-2 relative z-10">
                        <div className="flex gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                          <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" style={{ animationDelay: '0.2s' }} />
                          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" style={{ animationDelay: '0.4s' }} />
                        </div>
                        <span className="text-[9px] font-mono text-white/40">
                          {previewItem.id.includes('atlantis') || previewItem.id.includes('volcano') || previewItem.id.includes('snowstorm') ? 'DİNAMİK CANLI MAT' : 'LÜKS MASA TEMASI'}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-3 my-auto relative z-10">
                        <div className="bg-black/40 border border-white/10 rounded-xl p-3 text-center text-[10px] font-bold shadow-md text-slate-300">Banka 🏦</div>
                        <div className="bg-amber-500/20 border border-amber-500/40 rounded-xl p-3 text-center text-[10px] font-bold text-amber-300 animate-pulse shadow-[0_0_15px_rgba(245,158,11,0.35)]">Deste 🃏</div>
                        <div className="bg-black/40 border border-white/10 rounded-xl p-3 text-center text-[10px] font-bold shadow-md text-slate-300">Mülkler 🏡</div>
                      </div>

                      <div className="text-center text-[10px] text-white/60 font-black uppercase tracking-wider animate-pulse relative z-10 flex items-center justify-center gap-1.5">
                        <span>{tStyle.icon}</span>
                        <span>{previewItem.name} - {tStyle.badge}</span>
                        <span>{tStyle.icon}</span>
                      </div>

                      {/* felt pattern overlay */}
                      <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.02)_1.5px,transparent_1.5px)] [background-size:16px_16px] opacity-40 pointer-events-none" />
                    </div>
                  );
                })()}

                {previewItem.category === 'card_skin' && (
                  <div className="flex flex-col items-center">
                    <div className="w-28 h-40 rounded-xl border-2 border-white/10 bg-slate-800 flex flex-col justify-between p-3 shadow-2xl relative overflow-hidden">
                      {previewItem.id === 'skin_holographic' && <div className="skin-holographic-overlay absolute inset-0" />}
                      {previewItem.id === 'skin_rune' && <div className="skin-rune-overlay absolute inset-0 animate-pulse" />}
                      {previewItem.id === 'skin_snowstorm' && <div className="absolute inset-0 bg-gradient-to-br from-blue-300/40 to-sky-100/15 backdrop-blur-[0.5px] border border-blue-400/20" />}

                      <div className="text-white/20 text-left text-[8px] font-black tracking-widest leading-none select-none relative z-10">KART ÖRNEĞİ</div>
                      <span className="text-white text-3xl font-black self-center drop-shadow-xl select-none relative z-10">🃏</span>
                      <div className="text-white/20 text-right text-[8px] font-black tracking-widest leading-none select-none relative z-10">DEAL PRO</div>
                    </div>
                    <span className="text-[10px] text-amber-400 font-bold mt-3 animate-pulse">
                      ✨ CANLI KART KAPLAMASI ÖNİZLEMESİ ✨
                    </span>
                  </div>
                )}

                {previewItem.category === 'action_vfx' && (
                  <div className="flex flex-col items-center justify-center w-full h-full relative">
                    {/* Preview box container with clipping for animations */}
                    <div className={`w-full h-32 border border-white/10 bg-slate-950/80 rounded-xl relative overflow-hidden flex items-center justify-center ${vfxTrigger && previewItem.id === 'vfx_meteor' ? 'vfx-meteor-shake' : ''}`}>
                      {vfxTrigger ? (
                        <>
                          {previewItem.id === 'vfx_meteor' && (
                            <>
                              <div className="vfx-meteor-rock" style={{ top: '10%', right: '10%' }} />
                              <div className="vfx-meteor-shockwave animate-pulse" />
                              <div className="absolute inset-0 bg-orange-500/10 pointer-events-none animate-ping" />
                            </>
                          )}
                          {previewItem.id === 'vfx_mirror_shield' && (
                            <div className="relative w-full h-full flex items-center justify-center">
                              <div className="vfx-shield-hex-grid">
                                {[...Array(9)].map((_, i) => (
                                  <div key={i} className="vfx-shield-hex" />
                                ))}
                              </div>
                              <div className="vfx-shield-shockwave" />
                            </div>
                          )}
                          {previewItem.id === 'vfx_snowstorm' && (
                            <div className="absolute inset-0 bg-blue-100/10 pointer-events-none flex flex-col items-center justify-center">
                              <div className="text-4xl animate-spin" style={{ animationDuration: '4s' }}>❄️</div>
                              <span className="text-[9px] text-blue-300 font-black tracking-widest mt-2 animate-pulse uppercase">ÇIĞ VE BUZ FIRTINASI!</span>
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-slate-500">Efekti görmek için aşağıdaki butona basın</span>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setVfxTrigger(true);
                        setTimeout(() => setVfxTrigger(false), 2000);
                      }}
                      disabled={vfxTrigger}
                      className="mt-3 px-4 py-1.5 bg-red-600/20 hover:bg-red-600/40 border border-red-500/30 rounded-xl text-xs font-bold text-red-400 hover:text-white transition-all cursor-pointer"
                    >
                      {vfxTrigger ? 'Efekt Oynatılıyor...' : '💥 Efekti Test Et'}
                    </button>
                  </div>
                )}

                {previewItem.category === 'profile_frame' && (
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative">
                      {/* Pulsing ring underneath frame */}
                      <div className="absolute inset-0 rounded-full bg-amber-500/10 animate-ping pointer-events-none" />
                      <AvatarWithFrame
                        avatarId="avatar_classic"
                        avatarUrl={profile.avatarUrl}
                        frameId={previewItem.id}
                        sizeClassName="w-28 h-28 text-5xl"
                      />
                    </div>
                    <span className="text-[10px] text-amber-300 font-black tracking-wider animate-pulse mt-2">
                      ✨ HAREKETLİ VE PARILDAYAN ÖZEL ÇERÇEVE AKTİF ✨
                    </span>
                  </div>
                )}

                {previewItem.category === 'player_board' && (() => {
                  const bStyle = PLAYER_BOARD_STYLES[previewItem.id] || PLAYER_BOARD_STYLES.board_classic;
                  return (
                    <div className="flex flex-col items-center gap-3 w-full">
                      <div className={`w-[260px] p-5 rounded-2xl border-3 shadow-2xl transition-all duration-500 relative overflow-hidden flex flex-col justify-between ${bStyle.bgClass} ${bStyle.borderClass} ${bStyle.glowClass}`}>
                        {/* Dynamic atmospheric ambient lighting waves / patterns based on item */}
                        <div className="absolute inset-0 pointer-events-none opacity-40 mix-blend-color-dodge">
                          {previewItem.id === 'board_cyber' && (
                            <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(236,72,153,0.1)_1px,transparent_1px),linear-gradient(to_right,rgba(6,182,212,0.1)_1px,transparent_1px)] bg-[size:10px_10px]" />
                          )}
                          {previewItem.id === 'board_magma' && (
                            <div className="absolute inset-0 bg-radial-gradient from-red-600/30 to-orange-500/0 animate-pulse" />
                          )}
                          {previewItem.id === 'board_galaxy' && (
                            <div className="absolute inset-0 bg-radial-gradient from-purple-500/20 via-indigo-500/10 to-transparent animate-spin-slow" />
                          )}
                          {previewItem.id === 'board_ice' && (
                            <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(56,189,248,0.1)_25%,transparent_25%,transparent_50%,rgba(56,189,248,0.1)_50%,rgba(56,189,248,0.1)_75%,transparent_75%,transparent)] bg-[size:20px_20px]" />
                          )}
                          {previewItem.id === 'board_void' && (
                            <div className="absolute inset-0 bg-radial-gradient from-violet-600/25 to-black/30 animate-pulse" />
                          )}
                        </div>

                        <div className="flex justify-between items-center relative z-10">
                          <div className="flex items-center gap-2">
                            <div className="w-9 h-9 rounded-full border border-white/20 bg-slate-800 flex items-center justify-center text-xl">
                              👨‍💼
                            </div>
                            <div>
                              <div className="text-xs font-black text-slate-100">{profile.username}</div>
                              <div className="text-[9px] text-slate-400">Geliştirici</div>
                            </div>
                          </div>
                          <div className="bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-black px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-md">
                            💰 15M
                          </div>
                        </div>

                        <div className="flex justify-between items-center mt-6 pt-3 border-t border-white/5 relative z-10">
                          <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                            🃏 5 Kart
                          </div>
                          <div className="flex gap-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] text-amber-400 font-bold mt-2 animate-pulse uppercase tracking-wider">
                        ✨ {profile.settings.language === 'en' ? bStyle.nameEn : bStyle.nameTr} ÖNİZLEMESİ AKTİF ✨
                      </span>
                    </div>
                  );
                })()}

                {previewItem.category === 'celebration_sound' && (
                  <div className="flex flex-col items-center gap-4 w-full">
                    <button
                      onClick={() => playPreviewSound(previewItem.id)}
                      disabled={soundIsPlaying}
                      className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl cursor-pointer shadow-lg transition-transform active:scale-90 ${soundIsPlaying
                          ? 'bg-amber-500 text-white animate-ping'
                          : 'bg-gradient-to-r from-amber-500 to-red-600 text-white hover:from-amber-400 hover:to-red-500'
                        }`}
                      title="Sesi Çal"
                    >
                      {soundIsPlaying ? '🎵' : '▶️'}
                    </button>

                    {/* Animated visualizer bar-waves */}
                    <div className="flex items-end justify-center gap-1.5 h-10 mt-2 w-full">
                      {[...Array(12)].map((_, idx) => {
                        const h = soundIsPlaying ? `${20 + Math.random() * 80}%` : '15%';
                        return (
                          <div
                            key={idx}
                            className="bg-amber-400 w-1.5 rounded-full transition-all duration-150"
                            style={{
                              height: h,
                              boxShadow: '0 0 6px #F59E0B'
                            }}
                          />
                        );
                      })}
                    </div>

                    <span className="text-xs text-slate-400">Önizlemek için başlat butonuna basın</span>
                  </div>
                )}
              </div>

              {/* Purchase/Success Controls inside Preview */}
              <div className="flex gap-3">
                <button
                  onClick={() => setPreviewItem(null)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-bold rounded-2xl text-sm transition-all cursor-pointer"
                >
                  {t('cancel', profile)}
                </button>

                {isUnlocked ? (
                  isItemEquipped(previewItem) ? (
                    <button
                      disabled
                      className="flex-[2] py-3 bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 font-bold rounded-2xl text-sm cursor-default flex items-center justify-center gap-2 uppercase tracking-wider"
                    >
                      <span>✓</span> KULLANILIYOR
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        handleEquipItem(previewItem);
                        setPreviewItem(null);
                      }}
                      className="flex-[2] py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold rounded-2xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-95 cursor-pointer uppercase tracking-wider"
                    >
                      <span>⚡</span> AKTİFLEŞTİR
                    </button>
                  )
                ) : (
                  <button
                    onClick={() => handleBuy(previewItem.id, previewItem.price)}
                    disabled={buyingId !== null}
                    className="flex-[2] py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-2xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 active:scale-95 transform cursor-pointer uppercase tracking-wider"
                  >
                    <span>💰</span> {previewItem.price} {t('coins', profile)} - {t('buy', profile)}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {purchasedItemName && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex flex-col items-center justify-center p-6 pointer-events-none animate-fade-in">
          <div className="bg-gradient-to-r from-yellow-500 via-amber-600 to-red-600 p-1 rounded-3xl shadow-[0_0_50px_rgba(245,158,11,0.5)] animate-bounce-subtle max-w-sm w-full">
            <div className="bg-slate-950 rounded-[22px] px-6 py-8 text-center flex flex-col items-center">
              <span className="text-5xl animate-pulse">🎉</span>
              <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-500 mt-4 uppercase tracking-wider">{t('shop_success_title', profile)}</h3>
              <p className="text-white text-sm font-bold mt-2">"{purchasedItemName}"</p>
              <p className="text-emerald-400 text-xs font-semibold mt-1">{t('shop_success_desc', profile)}</p>
              <span className="text-[10px] text-slate-500 mt-6 block">{t('shop_success_hint', profile)}</span>
            </div>
          </div>
          {/* Confetti Explosion Particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {Array.from({ length: 40 }).map((_, i) => {
              const randX = Math.random() * 100;
              const randY = -10 - Math.random() * 40;
              const color = ['#F59E0B', '#EF4444', '#10B981', '#3B82F6', '#EC4899', '#8B5CF6', '#F43F5E'][i % 7];
              const size = Math.random() * 8 + 4;
              const delay = Math.random() * 1.5;
              const duration = Math.random() * 2 + 2;
              return (
                <div
                  key={i}
                  className="absolute rounded-sm animate-float"
                  style={{
                    left: `${randX}%`,
                    top: `${randY}%`,
                    width: `${size}px`,
                    height: `${size * 1.5}px`,
                    backgroundColor: color,
                    transform: `rotate(${Math.random() * 360}deg)`,
                    animationDelay: `${delay}s`,
                    animationDuration: `${duration}s`,
                    opacity: 0.8,
                  }}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
