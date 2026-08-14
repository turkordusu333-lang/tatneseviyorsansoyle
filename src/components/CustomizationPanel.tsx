import React from 'react';
import { UserProfile, UserSettings, StoreItem } from '../types';
import { sounds } from '../lib/SoundSystem';
import { AvatarWithFrame } from './AvatarWithFrame';
import { t } from '../lib/TranslationSystem';
import { API_BASE_URL } from '../lib/apiConfig';
import { setShopItemsCache } from '../lib/shopItemsStore';

interface Props {
  profile: UserProfile;
  onUpdateProfile: (updated: UserProfile) => void;
}

const THEME_OPTIONS = [
  { id: 'theme_slate', name: 'Kozmik Slate', color: '#1E293B', description: 'Koyu gri minimalist arka plan.' },
  { id: 'theme_green', name: 'Nane Yeşili', color: '#064E3B', description: 'Geleneksel yeşil masası.' },
  { id: 'theme_purple', name: 'Kraliyet Moru', color: '#581C87', description: 'Altın detaylı zengin mor masa.' },
  { id: 'theme_cyberpunk', name: 'Siber Izgara', color: '#090D16', description: 'Fütüristik yüksek kontrastlı neon çizgileri.' },
  // New board themes
  { id: 'theme_lava', name: 'Magma Krateri', color: '#450A0A', description: 'Aktif yanardağ lavları üzerinde sıcak masa.' },
  { id: 'theme_abyss', name: 'Karanlık Çukur', color: '#020617', description: 'Denizin en karanlık noktasındaki su altı arenası.' },
  { id: 'theme_gold', name: 'Hazine Odası', color: '#78350F', description: 'Altın külçelerle süslenmiş zengin masa.' },
  { id: 'theme_sakura', name: 'Sakura Vadisi', color: '#500724', description: 'Kiraz çiçeklerinin süzüldüğü huzurlu masa.' },
  { id: 'theme_ice', name: 'Kar Fırtınası', color: '#1E3A8A', description: 'Kar fırtınası altında kalmış kristal buz masası.' },
  { id: 'theme_retro', name: 'Atari Salonu', color: '#311042', description: '80ler atari salonu neon çizgi desenli masa.' },
  { id: 'theme_toxic', name: 'Zehirli Vaha', color: '#022C22', description: 'Yeşil asit havuzlu tekinsiz endüstriyel masa.' },
  { id: 'theme_matrix', name: 'Sanal Matris', color: '#022C22', description: 'Yeşil akan kod yağmuru altında sanal masa.' },
  { id: 'theme_space', name: 'Uzay İstasyonu', color: '#0F172A', description: 'Dünya manzaralı uzay üssü gözlem masası.' },
  { id: 'theme_desert', name: 'Kayıp Tapınak', color: '#7C2D12', description: 'Mısır kumları altındaki kadim çöl masası.' },
  { id: 'theme_atlantis', name: '🌊 Sualtı Krallığı (Atlantis)', color: '#0B5394', description: 'Derin okyanus mavisi ve deniz tozu partikülleri ile sualtı masa deneyimi.' },
  { id: 'theme_volcano', name: '🌋 Volkanik Öfke (Lav Masası)', color: '#7F1D1D', description: 'Lav çatlakları ve kor parçacıkları efektiyle volkanik arena.' },
  { id: 'theme_snowstorm', name: '❄️ Dinamik Kar Fırtınası', color: '#1F2937', description: 'Kar fırtınası, süzülen kar taneleri ve kutup rüzgarı partikül efektli masa.' },
];

const CARD_BACKS = [
  { id: 'back_classic', name: 'Klasik Kırmızı', color: '#EF5350', pattern: '◆' },
  { id: 'back_cosmic', name: 'Kozmik Siyah', color: '#0F172A', pattern: '★' },
  { id: 'back_gold', name: 'V.I.P Altın', color: '#D97706', pattern: '♛' },
  { id: 'back_neon', name: 'Retro Dalga', color: '#EC407A', pattern: '▲' },
  // New card backs
  { id: 'back_fire', name: 'Volkanik Magma', color: '#B91C1C', pattern: '🔥' },
  { id: 'back_ice', name: 'Kutup Rüzgarı', color: '#0891B2', pattern: '❄️' },
  { id: 'back_void', name: 'Karanlık Rift', color: '#3B0764', pattern: '🌀' },
  { id: 'back_matrix', name: 'Siber Kod Yağmuru', color: '#052E16', pattern: '💾' },
  { id: 'back_rainbow', name: 'Gökkuşağı Prizması', color: '#475569', pattern: '🌈' },
  { id: 'back_bubble', name: 'Deniz Köpüğü', color: '#38BDF8', pattern: '🫧' },
  { id: 'back_steampunk', name: 'Buharlı Çark', color: '#78350F', pattern: '⚙️' },
  { id: 'back_laser', name: 'Retro Grid Lazer', color: '#1E1B4B', pattern: '⚡' },
  { id: 'back_galaxy', name: 'Nebula Bulutu', color: '#1E1B4B', pattern: '🌌' },
  { id: 'back_darkness', name: 'Gölgeler Diyarı', color: '#090514', pattern: '👁️' },
  { id: 'back_snowstorm', name: '❄️ Kar Fırtınası', color: '#E2E8F0', pattern: '❄️' },
];

const PLAYER_BOARDS = [
  { id: 'board_classic', name: 'Klasik Siyah', description: 'Standart sade mat siyah tahta.' },
  { id: 'board_gold', name: '👑 V.I.P Altın', description: 'Asil lüks altın işlemeli tahta.' },
  { id: 'board_cyber', name: '⚡ Siber Neon Izgara', description: 'Fütüristik pembe-mavi neon çizgili tahta.' },
  { id: 'board_magma', name: '🔥 Magma Lav Tahtası', description: 'Kızgın aktif volkanik korlu tahta.' },
  { id: 'board_galaxy', name: '🌌 Nebula Galaksi', description: 'Mor yıldız tozu ve nebula rüzgarlı tahta.' },
  { id: 'board_ice', name: '❄️ Kutup Ayazı', description: 'Dondurucu buzul kristalleriyle kaplı tahta.' },
  { id: 'board_void', name: '🌀 Karanlık Rift', description: 'Derin boşluk aurası saçan gizemli tahta.' },
];

const getPlayerBoardName = (id: string, profile: UserProfile): string => {
  const opt = PLAYER_BOARDS.find(o => o.id === id);
  if (profile.settings.language === 'en') {
    switch(id) {
      case 'board_classic': return 'Classic Dark';
      case 'board_gold': return 'V.I.P Golden';
      case 'board_cyber': return 'Cyber Neon';
      case 'board_magma': return 'Magma Lava';
      case 'board_galaxy': return 'Nebula Galaxy';
      case 'board_ice': return 'Frosty Glacier';
      case 'board_void': return 'Abyssal Void';
      default: return opt ? opt.name : id;
    }
  }
  return opt ? opt.name : id;
};

const PROFILE_FRAMES = [
  { id: 'frame_none', name: 'Klasik Sınır', description: 'Standart sade çerçeve.' },
  { id: 'frame_neon', name: 'Neon Aura', description: 'Siberpunk parlayan pembe.' },
  { id: 'frame_gold', name: 'V.I.P Altın', description: 'Asil saf altın kaplama.' },
  { id: 'frame_fire', name: 'Volkanik Ateş', description: 'Ateşli lav ve köz tasarımı.' },
  { id: 'frame_royal', name: 'Kraliyet Elması', description: 'Göz alıcı mavi elmas süsü.' },
  // New profile frames
  { id: 'frame_plasma', name: 'Plazma Kalkanı', description: 'Mavi elektrik arklarıyla parlayan çerçeve.' },
  { id: 'frame_rainbow', name: 'Gökkuşağı Spektrumu', description: 'Renk değiştiren RGB spektrum çerçeve.' },
  { id: 'frame_toxic', name: 'Radyoaktif Slime', description: 'Yemyeşil zehir akıntılı slime çerçeve.' },
  { id: 'frame_ice', name: 'Buz Kristali', description: 'Mavi buz kristalli soğuk çerçeve.' },
  { id: 'frame_steampunk', name: 'Buharlı Dişliler', description: 'Dönen bronz dişli çarklı çerçeve.' },
  { id: 'frame_matrix', name: 'Matris Kod Hattı', description: 'Akan yeşil binary kodlu çerçeve.' },
  { id: 'frame_thunder', name: 'Şimşek Hattı', description: 'Sarı şimşekler fırlayan çerçeve.' },
  { id: 'frame_darkness', name: 'Karanlık Duman', description: 'Koyu mor gölge dumanları tüten çerçeve.' },
  { id: 'frame_galaxy', name: 'Galaksi Sarmalı', description: 'Dönen galaksi sarmallı çerçeve.' },
  { id: 'frame_dragon', name: 'Ejderha Pulları', description: 'Kızıl ejderha pullu çerçeve.' },
  { id: 'frame_snowstorm', name: '❄️ Kar Fırtınası Çerçevesi', description: 'Buz parçacıkları saçan hareketli kar fırtınası aurası.' },
];

const CELEBRATION_SOUNDS = [
  { id: 'sound_classic', name: 'Klasik Melodi', description: 'Klasik zafer melodisi.' },
  { id: 'sound_applause', name: 'Coşkulu Alkış', description: 'Coşkulu alkışlama efekti.' },
  { id: 'sound_fireworks', name: 'Havai Fişek', description: 'Heyecanlı gökyüzü şenlik patlamaları.' },
  { id: 'sound_laser', name: 'Siber Lazer', description: 'Fütüristik retro lazer şovu.' },
  { id: 'sound_fanfare', name: 'Şampiyon Fanfarı', description: 'Asil zafer fanfar melodisi.' },
  // New celebration sounds
  { id: 'sound_victory', name: 'Zafer Marşı', description: 'Trompet sesli epik zafer marşı.' },
  { id: 'sound_arcade', name: '8-Bit Atari', description: 'Eski atari oyunu ses efektleri.' },
  { id: 'sound_coins', name: 'Para Yağmuru', description: 'Kasaya para girerken çalan jackpot şıkırtısı.' },
  { id: 'sound_laser_zap', name: 'Lazer Silahı', description: 'Fütüristik siber lazer atış sesleri.' },
  { id: 'sound_rock', name: 'Elektro Gitar Riffi', description: 'Havalı rock gitar riffi.' },
  { id: 'sound_synthwave', name: 'Synthwave Bas', description: '80ler tarzı elektronik bas ritimleri.' },
  { id: 'sound_thunder', name: 'Kuvvetli Yıldırım', description: 'Güçlü gök gürültüsü ve şimşek.' },
  { id: 'sound_magical', name: 'Sihirli Değnek', description: 'Parıltılı büyü melodisi.' },
  { id: 'sound_snowstorm', name: '❄️ Çığ ve Fırtına Sesi', description: 'Zafer anınızda çalan ürpertici çığ ve dondurucu fırtına uğultusu.' },
];

const AVATAR_OPTIONS = [
  { id: 'avatar_classic', name: 'Klasik Hükümdar', description: 'Geleneksel şapkalı asilzade.' },
  { id: 'avatar_skater', name: 'Kaykaycı Çocuk', description: 'Cool şapkalı sokak tarzı.' },
  { id: 'avatar_neon', name: 'Cyberpunk Neon', description: 'Fütüristik neon parıltısı.' },
  { id: 'avatar_golden', name: 'Altın Kral', description: 'Zenginlik ve ihtişam simgesi.' },
  // New avatars
  { id: 'avatar_alien', name: 'Siber Uzaylı', description: 'Samanyolu dışından gelen zeka.' },
  { id: 'avatar_ninja', name: 'Gölge Ninja', description: 'Gizlilik ve sessizlik ustası.' },
  { id: 'avatar_wizard', name: 'Başbüyücü', description: 'Kaderi yöneten kart sihirbazı.' },
  { id: 'avatar_dragon', name: 'Kadim Ejderha', description: 'Ateş saçan efsanevi ejderha.' },
  { id: 'avatar_astronaut', name: 'Uzay Gezgini', description: 'Derin uzay astronot tasarımı.' },
  { id: 'avatar_robot', name: 'Siber Mekanik', description: 'Yapay zeka metalik robot.' },
  { id: 'avatar_dj', name: 'Tempolu DJ', description: 'Arenaya müzik getiren DJ.' },
  { id: 'avatar_ghost', name: 'Kabus Hayalet', description: 'Rakiplerinin korkulu rüyası.' },
  { id: 'avatar_knight', name: 'Onurlu Şövalye', description: 'Zırhlı kraliyet muhafızı.' },
  { id: 'avatar_unicorn', name: 'Efsanevi Tekboynuz', description: 'Gökkuşağı büyülü unicorn.' },
  { id: 'avatar_pharaoh', name: 'Mısır Firavunu', description: 'Antik piramit hükümdarı.' },
  { id: 'avatar_zombie', name: 'Zombi Saldırganı', description: 'Karanlıktan fırlayan yaşayan ölü.' },
  { id: 'avatar_snowstorm', name: '❄️ Kar Fırtınası Savaşçısı', description: 'Kutup ayazında dövüşen buz zırhlı efsanevi savaşçı.' },
];

const getThemeName = (id: string, profile: UserProfile): string => {
  if (profile.settings.language !== 'en') {
    const opt = THEME_OPTIONS.find(o => o.id === id);
    return opt ? opt.name : id;
  }
  switch(id) {
    case 'theme_slate': return 'Cosmic Slate';
    case 'theme_green': return 'Mint Green';
    case 'theme_purple': return 'Royal Purple';
    case 'theme_cyberpunk': return 'Cyber Grid';
    case 'theme_lava': return 'Magma Crater';
    case 'theme_abyss': return 'Dark Pit';
    case 'theme_gold': return 'Treasure Room';
    case 'theme_sakura': return 'Sakura Valley';
    case 'theme_ice': return 'Blizzard';
    case 'theme_retro': return 'Arcade';
    case 'theme_toxic': return 'Toxic Oasis';
    case 'theme_matrix': return 'Virtual Matrix';
    case 'theme_space': return 'Space Station';
    case 'theme_desert': return 'Lost Temple';
    case 'theme_atlantis': return 'Underwater Kingdom (Atlantis)';
    case 'theme_volcano': return 'Volcanic Fury (Volcanic Table)';
    default: return id;
  }
};

const getThemeDesc = (id: string, profile: UserProfile): string => {
  if (profile.settings.language !== 'en') {
    const opt = THEME_OPTIONS.find(o => o.id === id);
    return opt ? opt.description : '';
  }
  switch(id) {
    case 'theme_slate': return 'Minimalist dark grey background.';
    case 'theme_green': return 'Traditional green table.';
    case 'theme_purple': return 'Rich purple table with gold details.';
    case 'theme_cyberpunk': return 'Futuristic high-contrast neon lines.';
    case 'theme_lava': return 'Hot table on top of active volcanic lava.';
    case 'theme_abyss': return 'Under-water arena at the deepest point of the sea.';
    case 'theme_gold': return 'Rich table decorated with gold bars.';
    case 'theme_sakura': return 'Peaceful table with cherry blossoms floating.';
    case 'theme_ice': return 'Crystal ice table left under blizzard.';
    case 'theme_retro': return '80s arcade neon line patterned table.';
    case 'theme_toxic': return 'Dangerous industrial table with green acid pool.';
    case 'theme_matrix': return 'Virtual table under green matrix code rain.';
    case 'theme_space': return 'Space base observation table with Earth view.';
    case 'theme_desert': return 'Ancient desert table under Egyptian sand.';
    case 'theme_atlantis': return 'Underwater table experience with deep ocean blue and rising sea bubbles.';
    case 'theme_volcano': return 'Volcanic arena with pulsing lava cracks and hot ember particles.';
    default: return '';
  }
};

const getCardBackName = (id: string, profile: UserProfile): string => {
  if (profile.settings.language !== 'en') {
    const opt = CARD_BACKS.find(o => o.id === id);
    return opt ? opt.name : id;
  }
  switch(id) {
    case 'back_classic': return 'Classic Red';
    case 'back_cosmic': return 'Cosmic Black';
    case 'back_gold': return 'V.I.P Gold';
    case 'back_neon': return 'Retro Wave';
    case 'back_fire': return 'Volcanic Magma';
    case 'back_ice': return 'Polar Wind';
    case 'back_void': return 'Dark Rift';
    case 'back_matrix': return 'Cyber Code Rain';
    case 'back_rainbow': return 'Rainbow Prism';
    case 'back_bubble': return 'Sea Foam';
    case 'back_steampunk': return 'Steam Cog';
    case 'back_laser': return 'Retro Grid Laser';
    case 'back_galaxy': return 'Nebula Cloud';
    case 'back_darkness': return 'Shadow Realm';
    default: return id;
  }
};

const getProfileFrameName = (id: string, profile: UserProfile): string => {
  if (profile.settings.language !== 'en') {
    const opt = PROFILE_FRAMES.find(o => o.id === id);
    return opt ? opt.name : id;
  }
  switch(id) {
    case 'frame_none': return 'Classic Border';
    case 'frame_neon': return 'Neon Aura';
    case 'frame_gold': return 'V.I.P Gold';
    case 'frame_fire': return 'Volcanic Fire';
    case 'frame_royal': return 'Royal Diamond';
    case 'frame_plasma': return 'Plasma Shield';
    case 'frame_rainbow': return 'Rainbow Spectrum';
    case 'frame_toxic': return 'Radioactive Slime';
    case 'frame_ice': return 'Ice Crystal';
    case 'frame_steampunk': return 'Steam Gears';
    case 'frame_matrix': return 'Matrix Code Line';
    case 'frame_thunder': return 'Lightning Bolt';
    case 'frame_darkness': return 'Dark Smoke';
    case 'frame_galaxy': return 'Galaxy Swirl';
    case 'frame_dragon': return 'Dragon Scales';
    default: return id;
  }
};

const getProfileFrameDesc = (id: string, profile: UserProfile): string => {
  if (profile.settings.language !== 'en') {
    const opt = PROFILE_FRAMES.find(o => o.id === id);
    return opt ? opt.description : '';
  }
  switch(id) {
    case 'frame_none': return 'Standard simple frame.';
    case 'frame_neon': return 'Cyberpunk glowing pink.';
    case 'frame_gold': return 'Noble pure gold plating.';
    case 'frame_fire': return 'Fiery lava and ember design.';
    case 'frame_royal': return 'Stunning blue diamond ornament.';
    case 'frame_plasma': return 'Glowing frame with blue electric arcs.';
    case 'frame_rainbow': return 'Color shifting RGB spectrum frame.';
    case 'frame_toxic': return 'Slimy green glowing poison flow frame.';
    case 'frame_ice': return 'Cold frame with blue ice crystals.';
    case 'frame_steampunk': return 'Rotating bronze gears frame.';
    case 'frame_matrix': return 'Binary green code flowing frame.';
    case 'frame_thunder': return 'Yellow lightning bolt shooting frame.';
    case 'frame_darkness': return 'Dark purple shadow smoke frame.';
    case 'frame_galaxy': return 'Swirling galaxy spiral frame.';
    case 'frame_dragon': return 'Crimson dragon scales frame.';
    default: return '';
  }
};

const getCelebrationSoundName = (id: string, profile: UserProfile): string => {
  if (profile.settings.language !== 'en') {
    const opt = CELEBRATION_SOUNDS.find(o => o.id === id);
    return opt ? opt.name : id;
  }
  switch(id) {
    case 'sound_classic': return 'Classic Melody';
    case 'sound_applause': return 'Enthusiastic Applause';
    case 'sound_fireworks': return 'Fireworks';
    case 'sound_laser': return 'Cyber Laser';
    case 'sound_fanfare': return 'Champion Fanfare';
    case 'sound_victory': return 'Victory March';
    case 'sound_arcade': return '8-Bit Arcade';
    case 'sound_coins': return 'Coin Shower';
    case 'sound_laser_zap': return 'Laser Gun';
    case 'sound_rock': return 'Rock Guitar Riff';
    case 'sound_synthwave': return 'Synthwave Bass';
    case 'sound_thunder': return 'Strong Thunder';
    case 'sound_magical': return 'Magic Wand';
    default: return id;
  }
};

const getCelebrationSoundDesc = (id: string, profile: UserProfile): string => {
  if (profile.settings.language !== 'en') {
    const opt = CELEBRATION_SOUNDS.find(o => o.id === id);
    return opt ? opt.description : '';
  }
  switch(id) {
    case 'sound_classic': return 'Classic victory melody.';
    case 'sound_applause': return 'Cheerful clapping effect.';
    case 'sound_fireworks': return 'Exciting sky festival explosions.';
    case 'sound_laser': return 'Cyber laser show.';
    case 'sound_fanfare': return 'Noble victory fanfare melody.';
    case 'sound_victory': return 'Epic victory march with trumpet sound.';
    case 'sound_arcade': return 'Old arcade game sound effects.';
    case 'sound_coins': return 'Jackpot chime when coins enter the vault.';
    case 'sound_laser_zap': return 'Futuristic cyber laser firing sounds.';
    case 'sound_rock': return 'Cool rock guitar riff.';
    case 'sound_synthwave': return '80s style electronic bass rhythms.';
    case 'sound_thunder': return 'Mighty thunder and lightning.';
    case 'sound_magical': return 'Sparkling magic melody.';
    default: return '';
  }
};

const getAvatarName = (id: string, profile: UserProfile): string => {
  if (profile.settings.language !== 'en') {
    const opt = AVATAR_OPTIONS.find(o => o.id === id);
    return opt ? opt.name : id;
  }
  switch(id) {
    case 'avatar_classic': return 'Classic Ruler';
    case 'avatar_skater': return 'Skater Boy';
    case 'avatar_neon': return 'Cyberpunk Neon';
    case 'avatar_golden': return 'Golden King';
    case 'avatar_alien': return 'Space Alien';
    case 'avatar_ninja': return 'Shadow Ninja';
    case 'avatar_wizard': return 'Grand Wizard';
    case 'avatar_dragon': return 'Ancient Dragon';
    case 'avatar_astronaut': return 'Space Explorer';
    case 'avatar_robot': return 'Cyber Mechanic';
    case 'avatar_dj': return 'Rhythmic DJ';
    case 'avatar_ghost': return 'Nightmare Ghost';
    case 'avatar_knight': return 'Honorable Knight';
    case 'avatar_unicorn': return 'Legendary Unicorn';
    case 'avatar_pharaoh': return 'Egyptian Pharaoh';
    case 'avatar_zombie': return 'Zombie Attacker';
    default: return id;
  }
};

const getAvatarDesc = (id: string, profile: UserProfile): string => {
  if (profile.settings.language !== 'en') {
    const opt = AVATAR_OPTIONS.find(o => o.id === id);
    return opt ? opt.description : '';
  }
  switch(id) {
    case 'avatar_classic': return 'Traditional hatted noble.';
    case 'avatar_skater': return 'Cool cap street style.';
    case 'avatar_neon': return 'Futuristic neon glow.';
    case 'avatar_golden': return 'Wealth and glory symbol.';
    case 'avatar_alien': return 'Intelligence from outer space.';
    case 'avatar_ninja': return 'Stealth and silence master.';
    case 'avatar_wizard': return 'Card magician directing destiny.';
    case 'avatar_dragon': return 'Fire-breathing legendary dragon.';
    case 'avatar_astronaut': return 'Deep space astronaut design.';
    case 'avatar_robot': return 'Yapay zeka metalik robot.';
    case 'avatar_dj': return 'DJ bringing music to the arena.';
    case 'avatar_ghost': return 'Opponents worst nightmare.';
    case 'avatar_knight': return 'Armored royal guard.';
    case 'avatar_unicorn': return 'Rainbow magic unicorn.';
    case 'avatar_pharaoh': return 'Ancient pyramid ruler.';
    case 'avatar_zombie': return 'Living dead jumping from darkness.';
    default: return '';
  }
};

const CARD_SKINS = [
  { id: 'skin_none', name: 'Varsayılan Temiz Kart', description: 'Standart kart tasarımı.' },
  { id: 'skin_holographic', name: '💠 Holografik Mavi Sektör', description: 'Akan siber grid ızgarası ve parıltılar.' },
  { id: 'skin_rune', name: '🔮 Mistik Rün Parşömeni', description: 'Kadim parlayan rünler ve mistik kenarlık.' },
  { id: 'skin_snowstorm', name: '❄️ Donmuş Buz Kaplama', description: 'Buz kristalleriyle kaplı, set tamamlandığında buhar çıkaran buz kaplama.' }
];

const ACTION_VFX = [
  { id: 'vfx_none', name: 'Efekt Yok', description: 'Sıradan kart oynama animasyonları.' },
  { id: 'vfx_meteor', name: '☄️ Meteor Saldırısı', description: 'Deal Breaker oynandığında tam ekran meteor yağmuru.' },
  { id: 'vfx_mirror_shield', name: '🛡️ Ayna Kalkan', description: 'Just Say No oynandığında altıgen enerji kalkanı.' },
  { id: 'vfx_snowstorm', name: '❄️ Çığ Felaketi', description: 'Kart oynandığında ekranı kaplayan kar fırtınası ve buzlanma efekti.' }
];

const getCardSkinName = (id: string, profile: UserProfile): string => {
  if (profile.settings.language !== 'en') {
    const opt = CARD_SKINS.find(o => o.id === id);
    return opt ? opt.name : id;
  }
  switch(id) {
    case 'skin_none': return 'Default Clean Card';
    case 'skin_holographic': return 'Holographic Blue Grid';
    case 'skin_rune': return 'Mystic Rune Scroll';
    case 'skin_snowstorm': return 'Frozen Ice Skin';
    default: return id;
  }
};

const getCardSkinDesc = (id: string, profile: UserProfile): string => {
  if (profile.settings.language !== 'en') {
    const opt = CARD_SKINS.find(o => o.id === id);
    return opt ? opt.description : '';
  }
  switch(id) {
    case 'skin_none': return 'Standard card design.';
    case 'skin_holographic': return 'Flowing cyber grid lines and glow.';
    case 'skin_rune': return 'Ancient glowing runes and mystical border.';
    case 'skin_snowstorm': return 'Covered with ice crystals, emits cold steam on set completion.';
    default: return '';
  }
};

const getActionVfxName = (id: string, profile: UserProfile): string => {
  if (profile.settings.language !== 'en') {
    const opt = ACTION_VFX.find(o => o.id === id);
    return opt ? opt.name : id;
  }
  switch(id) {
    case 'vfx_none': return 'No VFX';
    case 'vfx_meteor': return 'Meteor Strike';
    case 'vfx_mirror_shield': return 'Mirror Shield';
    case 'vfx_snowstorm': return 'Avalanche Hazard';
    default: return id;
  }
};

const getActionVfxDesc = (id: string, profile: UserProfile): string => {
  if (profile.settings.language !== 'en') {
    const opt = ACTION_VFX.find(o => o.id === id);
    return opt ? opt.description : '';
  }
  switch(id) {
    case 'vfx_none': return 'Standard card play animations.';
    case 'vfx_meteor': return 'Full-screen meteor strike when Deal Breaker is played.';
    case 'vfx_mirror_shield': return 'Hexagonal energy shield when Just Say No is played.';
    case 'vfx_snowstorm': return 'Full-screen avalanche with freezing screen effect when action card is played.';
    default: return '';
  }
};

export const CustomizationPanel: React.FC<Props> = ({ profile, onUpdateProfile }) => {
  const currentSettings = profile.settings;
  const [shopItems, setShopItems] = React.useState<StoreItem[]>([]);

  React.useEffect(() => {
    fetch(`${API_BASE_URL}/api/shop/items`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setShopItems(data);
          setShopItemsCache(data);
        }
      })
      .catch((err) => console.error('Error loading shop items in CustomizationPanel:', err));
  }, []);

  const allAvatarOptions = React.useMemo(() => {
    const list: any[] = [...AVATAR_OPTIONS];
    shopItems.filter(i => i.category === 'avatar').forEach(item => {
      if (!list.some(x => x.id === item.id)) {
        list.push({ id: item.id, name: item.name, description: item.description, mediaUrl: item.mediaUrl, mediaType: item.mediaType });
      }
    });
    return list;
  }, [shopItems]);

  const allThemeOptions = React.useMemo(() => {
    const list: any[] = [...THEME_OPTIONS];
    shopItems.filter(i => i.category === 'board_theme').forEach(item => {
      if (!list.some(x => x.id === item.id)) {
        list.push({ id: item.id, name: item.name, color: item.previewColor || '#1E293B', description: item.description, mediaUrl: item.mediaUrl, mediaType: item.mediaType });
      }
    });
    return list;
  }, [shopItems]);

  const allCardBacks = React.useMemo(() => {
    const list: any[] = [...CARD_BACKS];
    shopItems.filter(i => i.category === 'card_back').forEach(item => {
      if (!list.some(x => x.id === item.id)) {
        list.push({ id: item.id, name: item.name, color: item.previewColor || '#EF5350', pattern: '★', mediaUrl: item.mediaUrl, mediaType: item.mediaType });
      }
    });
    return list;
  }, [shopItems]);

  const allProfileFrames = React.useMemo(() => {
    const list: any[] = [...PROFILE_FRAMES];
    shopItems.filter(i => i.category === 'profile_frame').forEach(item => {
      if (!list.some(x => x.id === item.id)) {
        list.push({ id: item.id, name: item.name, description: item.description, mediaUrl: item.mediaUrl, mediaType: item.mediaType });
      }
    });
    return list;
  }, [shopItems]);

  const allCelebrationSounds = React.useMemo(() => {
    const list: any[] = [...CELEBRATION_SOUNDS];
    shopItems.filter(i => i.category === 'celebration_sound').forEach(item => {
      if (!list.some(x => x.id === item.id)) {
        list.push({ id: item.id, name: item.name, description: item.description });
      }
    });
    return list;
  }, [shopItems]);

  const allPlayerBoards = React.useMemo(() => {
    const list: any[] = [...PLAYER_BOARDS];
    shopItems.filter(i => i.category === 'player_board').forEach(item => {
      if (!list.some(x => x.id === item.id)) {
        list.push({ id: item.id, name: item.name, description: item.description, mediaUrl: item.mediaUrl, mediaType: item.mediaType });
      }
    });
    return list;
  }, [shopItems]);

  const allCardSkins = React.useMemo(() => {
    const list: any[] = [...CARD_SKINS];
    shopItems.filter(i => i.category === 'card_skin').forEach(item => {
      if (!list.some(x => x.id === item.id)) {
        list.push({ id: item.id, name: item.name, description: item.description, mediaUrl: item.mediaUrl, mediaType: item.mediaType });
      }
    });
    return list;
  }, [shopItems]);

  const allActionVfx = React.useMemo(() => {
    const list = [...ACTION_VFX];
    shopItems.filter(i => i.category === 'action_vfx').forEach(item => {
      if (!list.some(x => x.id === item.id)) {
        list.push({ id: item.id, name: item.name, description: item.description });
      }
    });
    return list;
  }, [shopItems]);

  const handleSoundTest = () => {
    sounds.playCoin(currentSettings);
  };

  const handleSaveSetting = async (key: keyof UserSettings, value: any) => {
    const updatedSettings = {
      ...currentSettings,
      [key]: value,
    };

    if (key === 'language') {
      localStorage.setItem('language', value);
    }

    let updatedAvatarUrl = profile.avatarUrl;
    if (key === 'avatarId') {
      const shopMatch = shopItems.find(i => i.id === value);
      if (shopMatch && shopMatch.mediaUrl) {
        updatedAvatarUrl = shopMatch.mediaUrl;
      } else if (value && (value.startsWith('http') || value.startsWith('/') || value.startsWith('data:'))) {
        updatedAvatarUrl = value;
      } else if (!shopMatch) {
        updatedAvatarUrl = undefined;
      }
    }

    // Optimistic Update
    const updatedProfile = {
      ...profile,
      settings: updatedSettings,
      ...(key === 'avatarId' ? { avatarId: value, avatarUrl: updatedAvatarUrl } : {}),
    };
    onUpdateProfile(updatedProfile);

    // Persist on server
    try {
      const response = await fetch(`${API_BASE_URL}/api/settings/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile.id, settings: { [key]: value } }),
      });
      if (response.ok) {
        const data = await response.json();
        // Play soft confirmation sound
        sounds.playPlay(updatedSettings);
      }
    } catch (e) {
      console.error('Failed to save settings on server', e);
    }
  };

  return (
    <div id="customization-panel" className="bg-black/20 border border-white/10 rounded-2xl p-6 text-white max-w-4xl mx-auto shadow-2xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 border-b border-white/10 pb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">{t('settings_title', profile)}</h2>
          <p className="text-slate-400 text-sm">{t('settings_desc', profile)}</p>
        </div>
        <button
          onClick={handleSoundTest}
          className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all text-sm flex items-center gap-2 transform active:scale-95"
        >
          <span>🔔</span> {t('settings_test_sound', profile)}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left: Sound Settings */}
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-red-500 flex items-center gap-2">
            <span>🔊</span> {t('settings_synth_title', profile)}
          </h3>

          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-300">{t('master_volume', profile)}</span>
              <span className="text-red-400 font-bold">%{currentSettings.soundVolume}</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={currentSettings.soundVolume}
              onChange={(e) => handleSaveSetting('soundVolume', parseInt(e.target.value))}
              className="w-full accent-red-600 bg-white/10 h-2 rounded-lg cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-300">{t('sound_pitch', profile)}</span>
              <span className="text-red-400 font-bold">{currentSettings.soundPitch.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="5"
              max="20"
              step="1"
              value={currentSettings.soundPitch * 10}
              onChange={(e) => handleSaveSetting('soundPitch', parseInt(e.target.value) / 10)}
              className="w-full accent-red-600 bg-white/10 h-2 rounded-lg cursor-pointer"
            />
          </div>

          <div>
            <span className="text-slate-300 text-sm block mb-3">{t('wave_type', profile)}</span>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {(['sine', 'square', 'triangle', 'sawtooth'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => handleSaveSetting('synthType', type)}
                  className={`py-2 px-3 rounded-lg border text-sm font-medium capitalize transition-all ${currentSettings.synthType === type
                      ? 'bg-red-600/20 border-red-500 text-red-400'
                      : 'bg-black/40 border-white/10 text-slate-400 hover:border-white/20'
                    }`}
                >
                  {type === 'sine' ? 'Sinüs' : type === 'square' ? 'Kare' : type === 'triangle' ? 'Üçgen' : 'Testere'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-slate-300 text-sm block mb-3">{t('active_sound', profile)}</span>
            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1 scrollbar-thin">
              {allCelebrationSounds.map((snd) => {
                const isUnlocked = snd.id === 'sound_classic' || profile.unlockedItems.includes(snd.id);
                const isSelected = (currentSettings.celebrationSound || 'sound_classic') === snd.id;
                return (
                  <div
                    key={snd.id}
                    className={`p-3 rounded-xl border flex items-center justify-between transition-all relative ${!isUnlocked ? 'opacity-40' : ''
                      } ${isSelected
                        ? 'border-red-500 bg-red-600/10'
                        : 'border-white/5 bg-black/40'
                      }`}
                  >
                    <div className="flex-1">
                      <span className="font-semibold text-xs block text-white">{snd.name || getCelebrationSoundName(snd.id, profile)}</span>
                      <span className="text-[10px] text-slate-400 leading-tight block">{snd.description || getCelebrationSoundDesc(snd.id, profile)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {isUnlocked && (
                        <button
                          onClick={() => sounds.playCelebration(snd.id, currentSettings)}
                          className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-amber-400 cursor-pointer"
                          title="Sesi Dinle"
                        >
                          🔊 {t('settings_play', profile)}
                        </button>
                      )}
                      {isUnlocked ? (
                        <button
                          disabled={isSelected}
                          onClick={() => handleSaveSetting('celebrationSound', snd.id)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${isSelected
                              ? 'bg-red-600 text-white cursor-default'
                              : 'bg-white/10 hover:bg-white/20 text-slate-300'
                            }`}
                        >
                          {isSelected ? t('settings_selected', profile) : t('settings_select', profile)}
                        </button>
                      ) : (
                        <span className="text-[9px] bg-red-600/90 text-white font-bold px-1.5 py-0.5 rounded">
                          {t('settings_locked', profile)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Visual Settings */}
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-red-500 flex items-center gap-2">
            <span>🎨</span> {t('customizations', profile)}
          </h3>

          {/* Language Selection */}
          <div>
            <span className="text-slate-300 text-sm block mb-3">{t('settings_language', profile)}</span>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { id: 'tr', name: 'Türkçe 🇹🇷' },
                { id: 'en', name: 'English 🇺🇸' }
              ].map((lang) => {
                const isSelected = (currentSettings.language || 'tr') === lang.id;
                return (
                  <button
                    key={lang.id}
                    onClick={() => handleSaveSetting('language', lang.id)}
                    className={`p-2.5 rounded-xl border text-left font-semibold text-xs transition-all relative ${isSelected
                      ? 'border-red-500 bg-red-600/10 text-white'
                      : 'border-white/5 bg-black/40 hover:border-white/10 text-slate-400'
                    }`}
                  >
                    {lang.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Avatar Selection */}
          <div>
            <span className="text-slate-300 text-sm block mb-3">{t('active_avatar', profile)}</span>
            <div className="grid grid-cols-2 gap-3 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
              {allAvatarOptions.map((av) => {
                const isUnlocked = av.id === 'avatar_classic' || profile.unlockedItems.includes(av.id);
                const isSelected = profile.avatarId === av.id;
                return (
                  <button
                    key={av.id}
                    disabled={!isUnlocked}
                    onClick={() => handleSaveSetting('avatarId', av.id)}
                    className={`p-3 rounded-xl border text-left transition-all relative ${!isUnlocked ? 'opacity-40 cursor-not-allowed' : ''
                      } ${isSelected
                        ? 'border-red-500 bg-red-600/10'
                        : 'border-white/5 bg-black/40 hover:border-white/10'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <AvatarWithFrame
                        avatarId={av.id}
                        frameId="frame_none"
                        sizeClassName="w-10 h-10 text-xl"
                      />
                      <div>
                        <span className="font-semibold text-xs block text-white">{av.name || getAvatarName(av.id, profile)}</span>
                        <span className="text-[10px] text-slate-400 leading-none">{av.description || getAvatarDesc(av.id, profile)}</span>
                      </div>
                    </div>
                    {!isUnlocked && (
                      <span className="absolute top-1 right-1 text-[10px] bg-red-600/90 text-white font-bold px-1.5 py-0.5 rounded">
                        {t('settings_locked', profile)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Board Themes */}
          <div>
            <span className="text-slate-300 text-sm block mb-3">{t('active_theme', profile)}</span>
            <div className="grid grid-cols-2 gap-3 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
              {allThemeOptions.map((theme) => {
                const isUnlocked = theme.id === 'theme_slate' || profile.unlockedItems.includes(theme.id);
                return (
                  <button
                    key={theme.id}
                    disabled={!isUnlocked}
                    onClick={() => handleSaveSetting('boardTheme', theme.id)}
                    className={`p-3 rounded-xl border text-left transition-all relative ${!isUnlocked ? 'opacity-40 cursor-not-allowed' : ''
                      } ${currentSettings.boardTheme === theme.id
                        ? 'border-red-500 bg-red-600/10'
                        : 'border-white/5 bg-black/40 hover:border-white/10'
                      }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: theme.color }} />
                      <span className="font-semibold text-xs text-white">{theme.name || getThemeName(theme.id, profile)}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">{theme.description || getThemeDesc(theme.id, profile)}</p>
                    {!isUnlocked && (
                      <span className="absolute top-1 right-1 text-[10px] bg-red-600/90 text-white font-bold px-1.5 py-0.5 rounded">
                        {t('settings_locked', profile)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Card Back Styles */}
          <div>
            <span className="text-slate-300 text-sm block mb-3">{t('active_card_back', profile)}</span>
            <div className="grid grid-cols-2 gap-3 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
              {allCardBacks.map((cb) => {
                const isUnlocked = cb.id === 'back_classic' || profile.unlockedItems.includes(cb.id);
                return (
                  <button
                    key={cb.id}
                    disabled={!isUnlocked}
                    onClick={() => handleSaveSetting('cardBack', cb.id)}
                    className={`p-3 rounded-xl border text-left transition-all relative ${!isUnlocked ? 'opacity-40 cursor-not-allowed' : ''
                      } ${currentSettings.cardBack === cb.id
                        ? 'border-red-500 bg-red-600/10'
                        : 'border-white/5 bg-black/40 hover:border-white/10'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-12 rounded border border-white/10 flex items-center justify-center font-bold text-lg"
                        style={{ backgroundColor: cb.color }}
                      >
                        {cb.pattern}
                      </div>
                      <div>
                        <span className="font-semibold text-xs block text-white">{cb.name || getCardBackName(cb.id, profile)}</span>
                        <span className="text-[10px] text-slate-400">{t('card_back', profile)}</span>
                      </div>
                    </div>
                    {!isUnlocked && (
                      <span className="absolute top-1 right-1 text-[10px] bg-red-600/90 text-white font-bold px-1.5 py-0.5 rounded">
                        {t('settings_locked', profile)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Profile Frames Selection */}
          <div>
            <span className="text-slate-300 text-sm block mb-3">{t('active_frame', profile)}</span>
            <div className="grid grid-cols-2 gap-3 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
              {allProfileFrames.map((frame) => {
                const isUnlocked = frame.id === 'frame_none' || profile.unlockedItems.includes(frame.id);
                return (
                  <button
                    key={frame.id}
                    disabled={!isUnlocked}
                    onClick={() => handleSaveSetting('profileFrame', frame.id)}
                    className={`p-3 rounded-xl border text-left transition-all relative ${!isUnlocked ? 'opacity-40 cursor-not-allowed' : ''
                      } ${(currentSettings.profileFrame || 'frame_none') === frame.id
                        ? 'border-red-500 bg-red-600/10'
                        : 'border-white/5 bg-black/40 hover:border-white/10'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <AvatarWithFrame
                        avatarId={profile.avatarId}
                        avatarUrl={profile.avatarUrl}
                        frameId={frame.id}
                        sizeClassName="w-10 h-10 text-xl"
                      />
                      <div>
                        <span className="font-semibold text-xs block text-white">{frame.name || getProfileFrameName(frame.id, profile)}</span>
                        <span className="text-[10px] text-slate-400 leading-none">{frame.description || getProfileFrameDesc(frame.id, profile)}</span>
                      </div>
                    </div>
                    {!isUnlocked && (
                      <span className="absolute top-1 right-1 text-[10px] bg-red-600/90 text-white font-bold px-1.5 py-0.5 rounded">
                        {t('settings_locked', profile)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Player Boards Selection */}
          <div>
            <span className="text-slate-300 text-sm block mb-3">
              {profile.settings.language === 'en' ? 'Active Player Board Theme' : 'Aktif Oyuncu Tahtası Teması'}
            </span>
            <div className="grid grid-cols-2 gap-3 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
              {allPlayerBoards.map((board) => {
                const isUnlocked = board.id === 'board_classic' || profile.unlockedItems.includes(board.id);
                const isSelected = (currentSettings.playerBoard || 'board_classic') === board.id;
                return (
                  <button
                    key={board.id}
                    disabled={!isUnlocked}
                    onClick={() => handleSaveSetting('playerBoard', board.id)}
                    className={`p-3 rounded-xl border text-left transition-all relative ${!isUnlocked ? 'opacity-40 cursor-not-allowed' : ''
                      } ${isSelected
                        ? 'border-red-500 bg-red-600/10'
                        : 'border-white/5 bg-black/40 hover:border-white/10'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full border border-white/10 bg-slate-800 flex items-center justify-center text-xl shrink-0">
                        {board.id === 'board_classic' ? '🎴' : board.id === 'board_gold' ? '👑' : board.id === 'board_cyber' ? '⚡' : board.id === 'board_magma' ? '🔥' : board.id === 'board_galaxy' ? '🌌' : board.id === 'board_ice' ? '❄️' : '🌀'}
                      </div>
                      <div>
                        <span className="font-semibold text-xs block text-white">{board.name || getPlayerBoardName(board.id, profile)}</span>
                        <span className="text-[10px] text-slate-400 leading-none">
                          {board.description || (profile.settings.language === 'en' ? 'Player board layout style.' : 'Oyuncu tahta çerçeve stili.')}
                        </span>
                      </div>
                    </div>
                    {!isUnlocked && (
                      <span className="absolute top-1 right-1 text-[10px] bg-red-600/90 text-white font-bold px-1.5 py-0.5 rounded">
                        {t('settings_locked', profile)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Card Skins Selection */}
          <div>
            <span className="text-slate-300 text-sm block mb-3">
              {profile.settings.language === 'en' ? 'Active Card Skin' : 'Aktif Kart Kaplaması'}
            </span>
            <div className="grid grid-cols-2 gap-3 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
              {allCardSkins.map((skin) => {
                const isUnlocked = skin.id === 'skin_none' || profile.unlockedItems.includes(skin.id);
                const isSelected = (currentSettings.cardSkin || 'skin_none') === skin.id;
                return (
                  <button
                    key={skin.id}
                    disabled={!isUnlocked}
                    onClick={() => handleSaveSetting('cardSkin', skin.id)}
                    className={`p-3 rounded-xl border text-left transition-all relative ${!isUnlocked ? 'opacity-40 cursor-not-allowed' : ''
                      } ${isSelected
                        ? 'border-red-500 bg-red-600/10'
                        : 'border-white/5 bg-black/40 hover:border-white/10'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-12 rounded border border-white/10 bg-slate-800 flex items-center justify-center font-bold text-xs relative overflow-hidden shrink-0">
                        {skin.id === 'skin_holographic' && <div className="skin-holographic-overlay absolute inset-0" />}
                        {skin.id === 'skin_rune' && <div className="skin-rune-overlay absolute inset-0" />}
                        <span className="text-[8px] text-white/50 z-10">KART</span>
                      </div>
                      <div>
                        <span className="font-semibold text-xs block text-white">{skin.name || getCardSkinName(skin.id, profile)}</span>
                        <span className="text-[10px] text-slate-400 leading-none">{skin.description || getCardSkinDesc(skin.id, profile)}</span>
                      </div>
                    </div>
                    {!isUnlocked && (
                      <span className="absolute top-1 right-1 text-[10px] bg-red-600/90 text-white font-bold px-1.5 py-0.5 rounded">
                        {t('settings_locked', profile)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action VFX Selection */}
          <div>
            <span className="text-slate-300 text-sm block mb-3">
              {profile.settings.language === 'en' ? 'Active Action VFX' : 'Aktif Aksiyon Efekti'}
            </span>
            <div className="grid grid-cols-2 gap-3 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
              {allActionVfx.map((vfx) => {
                const isUnlocked = vfx.id === 'vfx_none' || profile.unlockedItems.includes(vfx.id);
                const isSelected = (currentSettings.actionVfx || 'vfx_none') === vfx.id;
                return (
                  <button
                    key={vfx.id}
                    disabled={!isUnlocked}
                    onClick={() => handleSaveSetting('actionVfx', vfx.id)}
                    className={`p-3 rounded-xl border text-left transition-all relative ${!isUnlocked ? 'opacity-40 cursor-not-allowed' : ''
                      } ${isSelected
                        ? 'border-red-500 bg-red-600/10'
                        : 'border-white/5 bg-black/40 hover:border-white/10'
                      }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg shrink-0">{vfx.id === 'vfx_meteor' ? '☄️' : vfx.id === 'vfx_mirror_shield' ? '🛡️' : '⚪'}</span>
                      <div>
                        <span className="font-semibold text-xs block text-white">{vfx.name || getActionVfxName(vfx.id, profile)}</span>
                        <span className="text-[10px] text-slate-400 leading-none">{vfx.description || getActionVfxDesc(vfx.id, profile)}</span>
                      </div>
                    </div>
                    {!isUnlocked && (
                      <span className="absolute top-1 right-1 text-[10px] bg-red-600/90 text-white font-bold px-1.5 py-0.5 rounded">
                        {t('settings_locked', profile)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
