import React from 'react';
import { Card, CardColor } from '../types';
import { COLOR_HEX, COLOR_LABELS, RENT_VALUES, MAX_IN_SET } from '../lib/deck';
import { motion } from 'motion/react';
import { Holo } from './Holo';
import { t } from '../lib/TranslationSystem';
import { findShopItem } from '../lib/shopItemsStore';
import { HlsVideoPlayer, isVideoUrl } from './HlsVideoPlayer';

const COLOR_KEYWORDS: Record<string, { tr: string[]; en: string[]; hex: string }> = {
  brown: { tr: ['kahverengi', 'kahve', 'kahve seti', 'kahverengi seti'], en: ['brown'], hex: '#A16207' },
  sky_blue: { tr: ['açık mavi', 'gökyüzü mavisi', 'açik mavi', 'acik mavi'], en: ['lightblue', 'light blue', 'sky blue'], hex: '#0EA5E9' },
  pink: { tr: ['pembe'], en: ['pink'], hex: '#EC4899' },
  orange: { tr: ['turuncu'], en: ['orange'], hex: '#F97316' },
  red: { tr: ['kırmızı', 'kirmizi'], en: ['red'], hex: '#EF4444' },
  yellow: { tr: ['sarı', 'sari'], en: ['yellow'], hex: '#EAB308' },
  green: { tr: ['yeşil', 'yesil'], en: ['green'], hex: '#22C55E' },
  blue: { tr: ['koyu mavi', 'mavi'], en: ['darkblue', 'dark blue', 'blue'], hex: '#2563EB' },
  station: { tr: ['demiryolu', 'istasyon'], en: ['railroad', 'station'], hex: '#6B7280' },
  utility: { tr: ['kamu kuruluşu', 'kamu hizmeti', 'kamu kuruluşu seti', 'kamu kurulusu'], en: ['utility', 'utilities'], hex: '#0D9488' },
};

const renderColorizedText = (text: string, language: string = 'tr'): React.ReactNode => {
  if (!text) return '';
  
  const termMap = new Map<string, string>();
  for (const key in COLOR_KEYWORDS) {
    const item = COLOR_KEYWORDS[key];
    const terms = language === 'en' ? item.en : item.tr;
    terms.forEach(t => {
      const lower = t.toLowerCase();
      termMap.set(lower, item.hex);
      termMap.set(t.toUpperCase(), item.hex);
      termMap.set(lower.replace(/i/g, 'İ').toUpperCase(), item.hex);
      termMap.set(lower.replace(/ı/g, 'I').toUpperCase(), item.hex);
      termMap.set(t.replace(/i/g, 'ı').toLowerCase(), item.hex);
    });
  }

  const searchTerms = Array.from(termMap.keys()).sort((a, b) => b.length - a.length);

  const escapedTerms = searchTerms.map(s => s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
  const regex = new RegExp(`(${escapedTerms.join('|')})`, 'gi');

  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, idx) => {
        const lowerPart = part.toLowerCase();
        const hex = termMap.get(part) || termMap.get(lowerPart) || termMap.get(part.toUpperCase());
        if (hex) {
          return (
            <span key={idx} className="font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[7px]" style={{ color: hex }}>
              {part}
            </span>
          );
        }
        return part;
      })}
    </>
  );
};

export type CardEffectType = 'steal' | 'rent' | 'bday' | 'gold' | 'house' | 'sly-shadow' | 'debt-seal' | 'birthday-confetti' | null;

interface GameCardProps {
  card: Card;
  size?: 'normal' | 'medium' | 'mini';
  isSelected?: boolean;
  isGlowableRent?: boolean;
  onClick?: () => void;
  className?: string;
  activeEffect?: CardEffectType;
  isFaceDown?: boolean;
  cardBack?: string;
  disable3D?: boolean;
  cardSkin?: string;
}

const CardEffectAnimation: React.FC<{ type: CardEffectType }> = ({ type }) => {
  // Completely disabled to eliminate lag, freezes, and frame-rate drops on all devices
  return null;
};

export const TURKISH_NAMES: Record<string, string> = {
  // Brown (Kahverengi)
  'Baltic Avenue': 'Kasımpaşa',
  'Mediterranean Avenue': 'Sultanahmet',
  // Dark Blue (Koyu Mavi)
  'Boardwalk': 'Tarabya',
  'Park Place': 'Yeniköy',
  // Light Blue (Açık Mavi)
  'Connecticut Avenue': 'Ortaköy',
  'Vermont Avenue': 'Karaköy',
  'Oriental Avenue': 'Eminönü',
  // Pink (Pembe)
  'Virginia Avenue': 'Şişli',
  'States Avenue': 'Mecidiyeköy',
  'St. Charles Place': 'Kabataş',
  // Orange (Turuncu)
  'New York Avenue': 'Kadıköy',
  'Tennessee Avenue': 'Bostancı',
  'St. James Place': 'Moda',
  // Red (Kırmızı)
  'Kentucky Avenue': 'Caddebostan',
  'Indiana Avenue': 'Erenköy',
  'Illinois Avenue': 'Barış Manço',
  // Yellow (Sarı)
  'Marvin Gardens': 'Teşvikiye',
  'Ventnor Avenue': 'Nişantaşı',
  'Atlantic Avenue': 'Beşiktaş',
  // Green (Yeşil)
  'North Carolina Avenue': 'Levent',
  'Pacific Avenue': 'Etiler',
  'Pennsylvania Avenue': 'Bebek',
  // Railroad (İstasyon / Demiryolu)
  'Reading Railroad': 'Haydarpaşa Garı',
  'Pennsylvania Railroad': 'Sirkeci Garı',
  'B. & O. Railroad': 'Kadıköy Vapur İskelesi',
  'Short Line Railroad': 'Yenikapı İskelesi',
  // Utility (Kamu Kuruluşu)
  'Water Works': 'Sular İdaresi',
  'Electric Company': 'Elektrik İdaresi',
  // Action Cards (Aksiyon Kartları)
  'Sly Deal': 'Sinsi Anlaşma',
  'Forced Deal': 'Zoraki Takas',
  'Deal Breaker': 'Anlaşma Bozan',
  'Debt Collector': 'Borç Tahsildarı',
  'Its My Birthday': "Bugün Benim Doğum Günüm",
  "It's My Birthday": "Bugün Benim Doğum Günüm",
  'Double Rent': 'Çift Kira',
  'Pass Go': 'Başlangıç Noktasından Geç',
  'House': 'Ev',
  'Hotel': 'Otel',
  'Just Say No': 'Hayır Teşekkürler',
};

const TURKISH_COLOR_LABELS: Record<CardColor, string> = {
  brown: 'KAHVERENGİ',
  lightblue: 'AÇIK MAVİ',
  pink: 'PEMBE',
  orange: 'TURUNCU',
  red: 'KIRMIZI',
  yellow: 'SARI',
  green: 'YEŞİL',
  darkblue: 'KOYU MAVİ',
  railroad: 'İSTASYON',
  utility: 'KAMU KURULUŞU',
};

const getSkinStyles = (cardBack?: string) => {
  const shopItem = findShopItem(cardBack);
  if (shopItem?.mediaUrl) {
    return {
      borderClass: 'border-amber-400/80 bg-slate-950 text-amber-200 font-sans shadow-[0_4px_16px_rgba(245,158,11,0.4)]',
      fontClass: 'font-sans font-extrabold text-amber-300',
      cardBg: 'bg-slate-950',
      bgOverlay: '',
      borderColor: 'border-amber-400/30',
      symbol: '🌟',
      mediaUrl: shopItem.mediaUrl,
      mediaType: shopItem.mediaType || 'image',
      previewColor: shopItem.previewColor
    };
  }
  if (shopItem?.previewColor) {
    return {
      borderClass: 'border-amber-400/80 bg-slate-950 text-white font-sans shadow-[0_4px_16px_rgba(245,158,11,0.4)]',
      fontClass: 'font-sans font-extrabold text-white',
      cardBg: 'bg-slate-950',
      bgOverlay: '',
      borderColor: 'border-white/20',
      symbol: '🎴',
      previewColor: shopItem.previewColor
    };
  }

  switch (cardBack) {
    case 'back_cosmic':
      return {
        borderClass: 'border-indigo-950 bg-slate-950 text-indigo-300 font-mono shadow-[0_4px_12px_rgba(99,102,241,0.25)]',
        fontClass: 'font-mono tracking-tight text-indigo-300',
        cardBg: 'bg-slate-900',
        bgOverlay: 'bg-gradient-to-br from-slate-950/20 via-indigo-950/25 to-slate-950/40',
        borderColor: 'border-indigo-500/20',
        symbol: '✨'
      };
    case 'back_gold':
      return {
        borderClass: 'border-amber-600 bg-amber-950 text-yellow-100 font-serif shadow-[0_4px_16px_rgba(245,158,11,0.35)]',
        fontClass: 'font-serif tracking-normal text-amber-200',
        cardBg: 'bg-amber-950/40',
        bgOverlay: 'bg-gradient-to-br from-amber-950/20 via-yellow-600/10 to-amber-950/30',
        borderColor: 'border-amber-500/30',
        symbol: '♛'
      };
    case 'back_neon':
      return {
        borderClass: 'border-pink-500 bg-purple-950 text-pink-200 font-sans shadow-[0_4px_12px_rgba(236,72,153,0.3)]',
        fontClass: 'font-sans tracking-wide uppercase text-pink-300',
        cardBg: 'bg-purple-950/40',
        bgOverlay: 'bg-gradient-to-br from-rose-950/20 via-purple-900/25 to-slate-950/30',
        borderColor: 'border-pink-500/25',
        symbol: '⚡'
      };
    case 'back_fire':
      return {
        borderClass: 'border-red-600 bg-red-950 text-red-200 font-sans shadow-[0_4px_16px_rgba(239,68,68,0.45)]',
        fontClass: 'font-sans uppercase text-red-400',
        cardBg: 'bg-red-950/40',
        bgOverlay: 'bg-gradient-to-br from-red-950/30 via-orange-950/20 to-black/40',
        borderColor: 'border-red-500/30',
        symbol: '🔥'
      };
    case 'back_ice':
      return {
        borderClass: 'border-cyan-400 bg-cyan-950 text-cyan-200 font-sans shadow-[0_4px_16px_rgba(34,211,238,0.35)]',
        fontClass: 'font-sans text-cyan-300',
        cardBg: 'bg-cyan-950/30',
        bgOverlay: 'bg-gradient-to-br from-cyan-900/20 via-blue-950/20 to-slate-900/30',
        borderColor: 'border-cyan-400/25',
        symbol: '❄️'
      };
    case 'back_void':
      return {
        borderClass: 'border-purple-600 bg-slate-950 text-purple-300 font-mono shadow-[0_4px_16px_rgba(147,51,234,0.35)]',
        fontClass: 'font-mono text-purple-400',
        cardBg: 'bg-slate-950',
        bgOverlay: 'bg-gradient-to-br from-purple-950/25 via-black to-slate-950',
        borderColor: 'border-purple-500/20',
        symbol: '🌀'
      };
    case 'back_matrix':
      return {
        borderClass: 'border-emerald-500 bg-black text-emerald-300 font-mono shadow-[0_4px_16px_rgba(16,185,129,0.35)]',
        fontClass: 'font-mono text-emerald-400 uppercase tracking-widest',
        cardBg: 'bg-zinc-950',
        bgOverlay: 'bg-gradient-to-b from-black/50 via-emerald-950/20 to-black',
        borderColor: 'border-emerald-500/30',
        symbol: '💾'
      };
    case 'back_rainbow':
      return {
        borderClass: 'border-pink-500 bg-slate-900 text-pink-200 font-sans shadow-[0_4px_16px_rgba(244,63,94,0.35)]',
        fontClass: 'font-sans text-pink-300',
        cardBg: 'bg-slate-900/40',
        bgOverlay: 'bg-gradient-to-r from-red-500/10 via-yellow-500/10 via-green-500/10 via-blue-500/10 to-purple-500/10',
        borderColor: 'border-pink-500/30',
        symbol: '🌈'
      };
    case 'back_bubble':
      return {
        borderClass: 'border-sky-400 bg-sky-950 text-sky-200 font-sans shadow-[0_4px_16px_rgba(56,189,248,0.35)]',
        fontClass: 'font-sans text-sky-300',
        cardBg: 'bg-sky-900/30',
        bgOverlay: 'bg-gradient-to-br from-sky-500/10 via-pink-500/10 to-indigo-900/20',
        borderColor: 'border-sky-400/25',
        symbol: '🫧'
      };
    case 'back_steampunk':
      return {
        borderClass: 'border-amber-800 bg-amber-950 text-amber-200 font-serif shadow-[0_4px_16px_rgba(180,83,9,0.35)]',
        fontClass: 'font-serif text-amber-300',
        cardBg: 'bg-amber-950/40',
        bgOverlay: 'bg-gradient-to-br from-amber-900/25 via-zinc-800/20 to-amber-950/30',
        borderColor: 'border-amber-700/30',
        symbol: '⚙️'
      };
    case 'back_laser':
      return {
        borderClass: 'border-violet-500 bg-violet-950 text-violet-200 font-sans shadow-[0_4px_16px_rgba(139,92,246,0.35)]',
        fontClass: 'font-sans text-violet-300',
        cardBg: 'bg-violet-950/40',
        bgOverlay: 'bg-gradient-to-br from-violet-950/20 via-fuchsia-950/20 to-slate-950',
        borderColor: 'border-violet-500/20',
        symbol: '⚡'
      };
    case 'back_galaxy':
      return {
        borderClass: 'border-indigo-500 bg-indigo-950 text-indigo-200 font-mono shadow-[0_4px_16px_rgba(99,102,241,0.35)]',
        fontClass: 'font-mono text-indigo-300',
        cardBg: 'bg-indigo-950/40',
        bgOverlay: 'bg-gradient-to-br from-indigo-950/30 via-purple-950/20 to-black/40',
        borderColor: 'border-indigo-500/20',
        symbol: '🌌'
      };
    case 'back_darkness':
      return {
        borderClass: 'border-slate-800 bg-slate-950 text-slate-400 font-sans shadow-[0_4px_16px_rgba(15,23,42,0.5)]',
        fontClass: 'font-sans text-slate-300',
        cardBg: 'bg-slate-950',
        bgOverlay: 'bg-gradient-to-br from-black via-slate-950 to-black',
        borderColor: 'border-slate-800/30',
        symbol: '👁️'
      };
    case 'back_classic':
      return {
        borderClass: 'border-white bg-white text-slate-800 font-sans shadow-2xl',
        fontClass: 'font-sans',
        cardBg: 'bg-white',
        bgOverlay: '',
        borderColor: 'border-black/20',
        symbol: '◆'
      };
    default:
      // Custom card back from store fallback
      return {
        borderClass: 'border-amber-400/80 bg-slate-950 text-amber-200 font-sans shadow-[0_4px_16px_rgba(245,158,11,0.4)]',
        fontClass: 'font-sans font-extrabold text-amber-300',
        cardBg: 'bg-slate-950',
        bgOverlay: 'bg-gradient-to-br from-amber-950/30 via-purple-950/25 to-slate-950',
        borderColor: 'border-amber-400/30',
        symbol: '👑'
      };
  }
};

export const GameCard: React.FC<GameCardProps> = ({
  card,
  size = 'normal',
  isSelected = false,
  isGlowableRent = false,
  onClick,
  className = '',
  activeEffect = null,
  isFaceDown = false,
  cardBack = 'back_classic',
  disable3D = false,
  cardSkin = 'skin_none',
}) => {
  const skin = getSkinStyles(cardBack);
  const skinItem = findShopItem(cardSkin);
  const isSkinVideo = skinItem?.mediaUrl && isVideoUrl(skinItem.mediaUrl, skinItem.mediaType);

  const getSkinOverlayClass = () => {
    if (size === 'normal') return 'rounded-2xl';
    if (size === 'medium') return 'rounded-md';
    return 'rounded-lg';
  };
  const skinOverlayElement = !isFaceDown && (
    <>
      {skinItem?.mediaUrl ? (
        isSkinVideo ? (
          <HlsVideoPlayer
            src={skinItem.mediaUrl}
            className={`absolute inset-0 w-full h-full object-cover pointer-events-none opacity-40 mix-blend-overlay z-35 ${getSkinOverlayClass()}`}
          />
        ) : (
          <img
            src={skinItem.mediaUrl}
            alt="Card Skin"
            className={`absolute inset-0 w-full h-full object-cover pointer-events-none opacity-40 mix-blend-overlay z-35 ${getSkinOverlayClass()}`}
          />
        )
      ) : null}
      {cardSkin === 'skin_holographic' && (
        <div className={`skin-holographic-overlay absolute inset-0 pointer-events-none z-35 skin-holographic-hover ${getSkinOverlayClass()}`} />
      )}
      {cardSkin === 'skin_rune' && (
        <div className={`skin-rune-overlay absolute inset-0 pointer-events-none z-35 ${getSkinOverlayClass()}`} />
      )}
      {cardSkin === 'skin_snowstorm' && (
        <div className={`absolute inset-0 pointer-events-none z-35 bg-gradient-to-t from-cyan-500/20 via-sky-300/10 to-transparent border border-cyan-300/40 shadow-[inset_0_0_12px_rgba(56,189,248,0.4)] ${getSkinOverlayClass()}`} />
      )}
      {cardSkin === 'skin_gold' && (
        <div className={`absolute inset-0 pointer-events-none z-35 bg-gradient-to-tr from-amber-500/20 via-yellow-300/15 to-transparent border border-amber-400/50 shadow-[inset_0_0_15px_rgba(251,191,36,0.5)] ${getSkinOverlayClass()}`} />
      )}
      {cardSkin === 'skin_cyber' && (
        <div className={`absolute inset-0 pointer-events-none z-35 bg-[linear-gradient(to_bottom,rgba(236,72,153,0.1)_1px,transparent_1px)] bg-[size:100%_4px] border border-pink-500/40 shadow-[inset_0_0_12px_rgba(236,72,153,0.4)] ${getSkinOverlayClass()}`} />
      )}
      {cardSkin === 'skin_matrix' && (
        <div className={`absolute inset-0 pointer-events-none z-35 bg-[linear-gradient(to_bottom,rgba(34,197,94,0.15)_1px,transparent_1px)] bg-[size:100%_3px] border border-emerald-500/40 shadow-[inset_0_0_12px_rgba(34,197,94,0.4)] ${getSkinOverlayClass()}`} />
      )}
      {(cardSkin === 'skin_fire' || cardSkin === 'skin_lava') && (
        <div className={`absolute inset-0 pointer-events-none z-35 bg-gradient-to-t from-red-600/25 via-orange-500/10 to-transparent border border-red-500/40 shadow-[inset_0_0_15px_rgba(239,68,68,0.5)] ${getSkinOverlayClass()}`} />
      )}
      {cardSkin === 'skin_neon' && (
        <div className={`absolute inset-0 pointer-events-none z-35 border-2 border-pink-500 shadow-[0_0_15px_#ec4899,inset_0_0_10px_#ec4899] ${getSkinOverlayClass()}`} />
      )}
      {cardSkin && cardSkin !== 'skin_none' && !skinItem?.mediaUrl && !['skin_holographic','skin_rune','skin_snowstorm','skin_gold','skin_cyber','skin_matrix','skin_fire','skin_lava','skin_neon'].includes(cardSkin) && (
        <div className={`absolute inset-0 pointer-events-none z-35 bg-gradient-to-tr from-purple-500/15 via-amber-400/10 to-transparent border border-amber-400/40 shadow-[inset_0_0_10px_rgba(245,158,11,0.3)] ${getSkinOverlayClass()}`} />
      )}
    </>
  );

  // Render Face-Down Card Back if isFaceDown is true
  if (isFaceDown) {
    const isVideo = (skin as any).mediaUrl && isVideoUrl((skin as any).mediaUrl, (skin as any).mediaType);

    return (
      <div
        id={`card-facedown-${card?.id || 'unknown'}`}
        onClick={onClick}
        className={`rounded-xl border select-none relative overflow-hidden transition-all shadow-xl cursor-pointer hover:scale-105 flex flex-col justify-between p-2 ${skin.borderClass} ${className}`}
        style={{
          width: size === 'mini' ? '40px' : size === 'medium' ? '48px' : '96px',
          height: size === 'mini' ? '58px' : size === 'medium' ? '70px' : '140px',
          backgroundColor: (skin as any).previewColor || undefined
        }}
      >
        {(skin as any).mediaUrl ? (
          isVideo ? (
            <HlsVideoPlayer
              src={(skin as any).mediaUrl}
              className="absolute inset-0 w-full h-full object-cover z-0"
            />
          ) : (
            <img
              src={(skin as any).mediaUrl}
              alt="Card Back"
              className="absolute inset-0 w-full h-full object-cover z-0"
            />
          )
        ) : (
          <div className={`absolute inset-0 ${skin.bgOverlay}`} />
        )}

        <div className="flex justify-between items-center z-10 opacity-70">
          <span className="text-[5px] sm:text-[6px] font-black uppercase tracking-widest text-white/80 drop-shadow">PRO</span>
          <span className="text-[7px] sm:text-[8px] text-white/90 drop-shadow">{skin.symbol || '◆'}</span>
        </div>
        <div className="flex flex-col items-center justify-center my-auto z-10 text-center">
          {!(skin as any).mediaUrl && (
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full border border-white/20 bg-black/40 backdrop-blur-sm flex items-center justify-center shadow-inner my-0.5">
              <span className="text-xs sm:text-sm">{skin.symbol || '🃏'}</span>
            </div>
          )}
          <span className="text-[5px] sm:text-[6.5px] font-black uppercase tracking-widest text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">DEAL MASTER</span>
        </div>
        <div className="flex justify-between items-center z-10 opacity-70">
          <span className="text-[7px] sm:text-[8px] text-white/90 drop-shadow">{skin.symbol || '◆'}</span>
          <span className="text-[5px] sm:text-[6px] font-black uppercase tracking-widest text-white/80 drop-shadow">CARD</span>
        </div>
      </div>
    );
  }
  const [showTooltip, setShowTooltip] = React.useState(false);
  const cardRef = React.useRef<HTMLDivElement>(null);
  const [hoverCoords, setHoverCoords] = React.useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = React.useState(false);
  const [tilt, setTilt] = React.useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    // Max 15 degrees of tilt
    const tiltX = (50 - y) * 0.3; 
    const tiltY = (x - 50) * 0.3;
    
    setHoverCoords({ x, y });
    setTilt({ x: tiltX, y: tiltY });
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!cardRef.current || e.touches.length === 0) return;
    const touch = e.touches[0];
    const rect = cardRef.current.getBoundingClientRect();
    const x = ((touch.clientX - rect.left) / rect.width) * 100;
    const y = ((touch.clientY - rect.top) / rect.height) * 100;
    
    const tiltX = (50 - y) * 0.3; 
    const tiltY = (x - 50) * 0.3;
    
    setHoverCoords({ x, y });
    setTilt({ x: tiltX, y: tiltY });
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    setShowTooltip(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setShowTooltip(false);
    setTilt({ x: 0, y: 0 });
    setHoverCoords({ x: 50, y: 50 });
  };

  const renderCardTitle = (titleText: string, cardSize: 'normal' | 'medium' | 'mini', textDark = false) => {
    // Truncate or scale text size dynamically
    const cleanText = titleText.split(' (')[0]; // Remove parenthetical explanations if any
    const len = cleanText.length;
    
    // Choose base typography classes based on size and length
    let fontClass = 'font-black tracking-tight uppercase text-center leading-none ';
    let colorClass = textDark 
      ? 'text-slate-900 drop-shadow-[0_0.5px_0.5px_rgba(255,255,255,0.5)]' 
      : 'text-white drop-shadow-[0_1.5px_1.5px_rgba(0,0,0,0.85)]';

    if (cardSize === 'normal') {
      if (len > 18) {
        fontClass += 'text-[9.5px] tracking-tighter leading-tight line-clamp-2';
      } else if (len > 12) {
        fontClass += 'text-[11px] leading-tight';
      } else {
        fontClass += 'text-[13px] leading-snug';
      }
    } else if (cardSize === 'medium') {
      if (len > 14) {
        fontClass += 'text-[5px] sm:text-[7px] tracking-tighter leading-none line-clamp-2 break-all';
      } else if (len > 8) {
        fontClass += 'text-[6px] sm:text-[7.5px] tracking-tight leading-[1.05] break-words line-clamp-2';
      } else {
        fontClass += 'text-[7.5px] sm:text-[9px] leading-tight break-words';
      }
    } else { // mini
      if (len > 12) {
        fontClass += 'text-[6px] sm:text-[7px] tracking-tight leading-none truncate fluid-card-title';
      } else {
        fontClass += 'text-[7px] sm:text-[8px] tracking-tight leading-none fluid-card-title';
      }
    }

    return (
      <span className={`block w-full ${fontClass} ${colorClass} select-none transition-all duration-150`}>
        {cleanText}
      </span>
    );
  };

  // Mapped details for dynamic multilingual look
  const getCardDetails = () => {
    const CARD_KEY_MAP: Record<string, string> = {
      'Baltic Avenue': 'prop_baltic_ave',
      'Mediterranean Avenue': 'prop_mediterranean_ave',
      'Oriental Avenue': 'prop_oriental_ave',
      'Vermont Avenue': 'prop_vermont_ave',
      'Connecticut Avenue': 'prop_connecticut_ave',
      'St. Charles Place': 'prop_st_charles_pl',
      'States Avenue': 'prop_states_ave',
      'Virginia Avenue': 'prop_virginia_ave',
      'St. James Place': 'prop_st_james_pl',
      'Tennessee Avenue': 'prop_tennessee_ave',
      'New York Avenue': 'prop_new_york_ave',
      'Kentucky Avenue': 'prop_kentucky_ave',
      'Indiana Avenue': 'prop_indiana_ave',
      'Illinois Avenue': 'prop_illinois_ave',
      'Atlantic Avenue': 'prop_atlantic_ave',
      'Ventnor Avenue': 'prop_ventnor_ave',
      'Marvin Gardens': 'prop_marvin_gardens',
      'Pacific Avenue': 'prop_pacific_ave',
      'North Carolina Avenue': 'prop_north_carolina_ave',
      'Pennsylvania Avenue': 'prop_pennsylvania_ave',
      'Park Place': 'prop_park_place',
      'Boardwalk': 'prop_boardwalk',
      'Reading Railroad': 'station_reading',
      'Pennsylvania Railroad': 'station_pennsylvania',
      'B. & O. Railroad': 'station_b_o',
      'Short Line Railroad': 'station_short_line',
      'Water Works': 'utility_water',
      'Electric Company': 'utility_electric',
    };

    let name = card.name;
    let typeLabel = t('prop_label');
    let description = card.description;
    let shortDesc = '';
    let icon = '🏢';
    let bgColor = '#ffffff'; // Default white card base
    let isAction = card.type === 'action' || card.type === 'house-hotel';
    let isMoney = card.type === 'money';
    let isRent = card.type === 'rent';
    let isWildcard = card.isWildcard === true;

    // Helper to get translated color names
    const getColorLabel = (c: CardColor): string => {
      let key = c as string;
      if (key === 'lightblue') key = 'sky_blue';
      if (key === 'railroad') key = 'station';
      if (key === 'darkblue') key = 'blue';
      return t(`color_${key}`).toUpperCase();
    };

    // Helper to get translated property names
    const getPropertyName = (origName: string): string => {
      const key = CARD_KEY_MAP[origName];
      if (key) {
        const val = t(key);
        return val !== key ? val : origName;
      }
      return origName;
    };

    if (isMoney) {
      typeLabel = t('money_label');
      icon = '💵';
      shortDesc = t('card_money_desc', null, card.value);
      description = shortDesc;
      if (card.value === 10) bgColor = '#FF9800'; // Vibrant Orange
      else if (card.value === 5) bgColor = '#9C27B0'; // Purple
      else if (card.value === 4) bgColor = '#4CAF50'; // Green
      else if (card.value === 3) bgColor = '#00BCD4'; // Sky blue
      else if (card.value === 2) bgColor = '#EF5350'; // Red
      else bgColor = '#90A4AE'; // Silver/Grey
    } else if (card.type === 'property') {
      typeLabel = t('prop_label');
      icon = '🏢';
      name = getPropertyName(card.name);
      shortDesc = `${getColorLabel(card.color!)} ${t('card_rent').toLowerCase()}.`;
      description = shortDesc;
    } else if (isWildcard) {
      typeLabel = t('joker_label');
      icon = '🃏';
      name = t('card_wildcard_name');
      if (!card.secondaryColor) {
        shortDesc = t('card_wildcard_desc_any');
      } else {
        shortDesc = t('card_wildcard_desc_two', null, getColorLabel(card.color!), getColorLabel(card.secondaryColor!));
      }
      description = shortDesc;
    } else if (isAction) {
      typeLabel = t('action_label');
      if (card.actionType === 'deal-breaker') {
        name = t('card_deal_breaker_name');
        description = t('card_deal_breaker_desc');
        shortDesc = description;
        icon = '⚡';
        bgColor = '#9C27B0'; // Purple
      } else if (card.actionType === 'just-say-no') {
        name = t('card_just_say_no_name');
        description = t('card_just_say_no_desc');
        shortDesc = description;
        icon = '🛑';
        bgColor = '#4CAF50'; // Lime green
      } else if (card.actionType === 'sly-deal') {
        name = t('card_sly_deal_name');
        description = t('card_sly_deal_desc');
        shortDesc = description;
        icon = '🥷';
        bgColor = '#00B0FF'; // Vibrant blue
      } else if (card.actionType === 'forced-deal') {
        name = t('card_forced_deal_name');
        description = t('card_forced_deal_desc');
        shortDesc = description;
        icon = '⇄';
        bgColor = '#00B0FF'; // Blue
      } else if (card.actionType === 'debt-collector') {
        name = t('card_debt_collector_name');
        description = t('card_debt_collector_desc');
        shortDesc = description;
        icon = '💼';
        bgColor = '#00B0FF'; // Blue
      } else if (card.actionType === 'birthday') {
        name = t('card_birthday_name');
        description = t('card_birthday_desc');
        shortDesc = description;
        icon = '🎂';
        bgColor = '#EC407A'; // Hot pink
      } else if (card.actionType === 'pass-go') {
        name = t('card_pass_go_name');
        description = t('card_pass_go_desc');
        shortDesc = description;
        icon = '↩️';
        bgColor = '#FFFFFF'; // White action card base
      } else if (card.actionType === 'double-rent') {
        name = t('card_double_rent_name');
        description = t('card_double_rent_desc');
        shortDesc = description;
        icon = '💰';
        bgColor = '#FFFFFF'; // White action card base
      } else if (card.actionType === 'house') {
        name = t('card_house_name');
        description = t('card_house_desc');
        shortDesc = description;
        icon = '🏠';
        bgColor = '#00B0FF'; // Blue
      } else if (card.actionType === 'hotel') {
        name = t('card_hotel_name');
        description = t('card_hotel_desc');
        shortDesc = description;
        icon = '🏢';
        bgColor = '#4CAF50'; // Green
      }
    } else if (isRent) {
      typeLabel = t('rent_label');
      icon = '💰';
      name = t('card_rent_name');
      if (card.name.includes('Her Renk') || !card.color) {
        description = t('card_rent_desc_any');
        shortDesc = description;
      } else {
        description = t('card_rent_desc_two', null, getColorLabel(card.color), getColorLabel(card.secondaryColor!));
        shortDesc = description;
      }
    }

    return { name, typeLabel, description, shortDesc, icon, bgColor, isAction, isMoney, isRent, isWildcard };
  };

  const details = getCardDetails();
  const primaryColorHex = card.color ? COLOR_HEX[card.color] : '#475569';
  const secondaryColorHex = card.secondaryColor ? COLOR_HEX[card.secondaryColor] : undefined;

  const getValueBadgeStyles = (val: number) => {
    switch (val) {
      case 10:
        return {
          bgClass: 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.7)] animate-pulse',
          textColor: 'text-emerald-400 font-black'
        };
      case 5:
        return {
          bgClass: 'bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-950 border-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.7)] font-black',
          textColor: 'text-amber-400 font-extrabold'
        };
      case 4:
        return {
          bgClass: 'bg-gradient-to-r from-orange-500 to-red-500 text-white border-orange-300 shadow-[0_0_6px_rgba(249,115,22,0.6)] font-black',
          textColor: 'text-orange-400 font-bold'
        };
      case 3:
        return {
          bgClass: 'bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white border-fuchsia-400 shadow-[0_0_6px_rgba(217,70,239,0.6)] font-black',
          textColor: 'text-fuchsia-400 font-bold'
        };
      case 2:
        return {
          bgClass: 'bg-gradient-to-r from-sky-400 to-blue-500 text-white border-sky-300 shadow-[0_0_6px_rgba(14,165,233,0.6)] font-black',
          textColor: 'text-sky-400 font-bold'
        };
      case 1:
      default:
        return {
          bgClass: 'bg-slate-700 text-slate-100 border-slate-500 font-bold',
          textColor: 'text-slate-300 font-bold'
        };
    }
  };

  // Premium holographic style and Rarity calculations
  const rarity: 'EFSANEVİ' | 'EPİK' | 'ENDER' | 'SIRADAN' = (() => {
    if (card.actionType === 'deal-breaker' || card.actionType === 'just-say-no' || card.value >= 10) {
      return 'EFSANEVİ';
    }
    if (
      card.actionType === 'sly-deal' ||
      card.actionType === 'forced-deal' ||
      (card.type === 'wildcard' && !card.secondaryColor) ||
      card.value === 5 ||
      card.color === 'darkblue'
    ) {
      return 'EPİK';
    }
    if (
      card.actionType === 'debt-collector' ||
      card.actionType === 'birthday' ||
      card.actionType === 'house' ||
      card.actionType === 'hotel' ||
      card.type === 'rent' ||
      card.value === 3 ||
      card.value === 4
    ) {
      return 'ENDER';
    }
    return 'SIRADAN';
  })();

  const isPremium = rarity !== 'SIRADAN';
  const holoClass = isPremium ? 'holo-card-shine holo-card-sparkle' : '';

  const getHoloGradient = (rarityVal: typeof rarity, x: number, y: number) => {
    switch (rarityVal) {
      case 'EFSANEVİ':
        return `radial-gradient(circle at ${x}% ${y}%, rgba(255, 215, 0, 0.45) 0%, rgba(139, 92, 246, 0.35) 30%, rgba(236, 72, 153, 0.2) 60%, transparent 80%), linear-gradient(${135 + (x - 50) * 0.5}deg, transparent 35%, rgba(255, 255, 255, 0.45) 45%, rgba(255, 215, 0, 0.4) 50%, rgba(255, 255, 255, 0.45) 55%, transparent 65%)`;
      case 'EPİK':
        return `radial-gradient(circle at ${x}% ${y}%, rgba(236, 72, 153, 0.45) 0%, rgba(59, 130, 246, 0.35) 40%, rgba(139, 92, 246, 0.15) 70%, transparent 90%), linear-gradient(${135 + (x - 50) * 0.5}deg, transparent 40%, rgba(255, 255, 255, 0.5) 48%, rgba(236, 72, 153, 0.25) 50%, rgba(255, 255, 255, 0.5) 52%, transparent 60%)`;
      case 'ENDER':
        return `radial-gradient(circle at ${x}% ${y}%, rgba(52, 211, 153, 0.45) 0%, rgba(6, 182, 212, 0.35) 40%, transparent 80%), linear-gradient(${135 + (x - 50) * 0.5}deg, transparent 40%, rgba(255, 255, 255, 0.45) 48%, rgba(52, 211, 153, 0.25) 50%, rgba(255, 255, 255, 0.45) 52%, transparent 60%)`;
      case 'SIRADAN':
      default:
        return `radial-gradient(circle at ${x}% ${y}%, rgba(255, 255, 255, 0.25) 0%, transparent 65%), linear-gradient(${135 + (x - 50) * 0.5}deg, transparent 42%, rgba(255, 255, 255, 0.3) 50%, transparent 58%)`;
    }
  };

  const holoOverlay = (
    <div
      className="pointer-events-none absolute inset-0 z-30 transition-opacity duration-300"
      style={{
        background: getHoloGradient(rarity, hoverCoords.x, hoverCoords.y),
        opacity: isHovered ? 0.95 : 0.2, // Ambient reflection even when not hovered!
        mixBlendMode: 'color-dodge',
      }}
    />
  );

  const isSpecialCard = card.type === 'wildcard' || card.isWildcard || card.type === 'property';

  // Special box shadow glow for special cards when hovered
  const glowShadow = isHovered && isSpecialCard
    ? (card.isWildcard || card.type === 'wildcard'
        ? '0 0 25px 5px rgba(139, 92, 246, 0.65), 0 0 15px 2px rgba(236, 72, 153, 0.45)' // Joker: Violet/Pink neon glow
        : `0 0 20px 4px ${primaryColorHex}80`) // Property: colored glow corresponding to property color
    : '0 10px 25px -5px rgba(0,0,0,0.3), 0 8px 10px -6px rgba(0,0,0,0.3)';

  const tiltStyle: React.CSSProperties = {
    transform: isHovered 
      ? `perspective(400px) rotateX(${isSpecialCard ? tilt.x * 1.5 : tilt.x}deg) rotateY(${isSpecialCard ? tilt.y * 1.5 : tilt.y}deg) scale(${isSpecialCard ? 1.08 : 1.05})` 
      : 'perspective(400px) rotateX(0deg) rotateY(0deg) scale(1)',
    transition: isHovered ? 'transform 0.05s ease-out, box-shadow 0.2s ease' : 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.3s ease',
    transformStyle: 'preserve-3d',
    boxShadow: glowShadow,
  };

  // Standard elegant Turkish detail tooltip element
  const tooltipElement = showTooltip && (
    <div className="absolute bottom-[105%] left-1/2 -translate-x-1/2 z-[9999] w-[190px] bg-slate-950/95 border-2 border-amber-500/50 rounded-2xl p-3 shadow-[0_10px_30px_rgba(0,0,0,0.8)] text-white pointer-events-none text-left flex flex-col space-y-1.5 backdrop-blur-md animate-fade-in select-none">
      <div className="flex items-center gap-1.5 border-b border-white/10 pb-1.5">
        <span className="text-sm">{details.icon}</span>
        <span className="font-extrabold text-[10px] text-amber-300 uppercase tracking-wider truncate">{details.name}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        <span className={`text-[7px] font-black px-1.5 py-0.5 rounded ${
          rarity === 'EFSANEVİ' ? 'bg-purple-500/20 border border-purple-500/40 text-purple-300 shadow-[0_0_6px_rgba(168,85,247,0.4)]' :
          rarity === 'EPİK' ? 'bg-pink-500/20 border border-pink-500/40 text-pink-300' :
          rarity === 'ENDER' ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300' :
          'bg-slate-500/20 border border-slate-500/40 text-slate-300'
        }`}>
          ✨ {(() => {
            const isEn = localStorage.getItem('language') === 'en';
            if (!isEn) return rarity;
            if (rarity === 'EFSANEVİ') return 'LEGENDARY';
            if (rarity === 'EPİK') return 'EPIC';
            if (rarity === 'ENDER') return 'RARE';
            return 'COMMON';
          })()}
        </span>
        <span className="text-[7px] font-black px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/25 text-amber-400">
          {localStorage.getItem('language') === 'en' ? 'VALUE' : 'DEĞER'}: {card.value}M
        </span>
        {card.color && (
          <span className="text-[7px] font-black px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: primaryColorHex, border: `1px solid rgba(255,255,255,0.15)` }}>
            {(() => {
              let key = card.color as string;
              if (key === 'lightblue') key = 'sky_blue';
              if (key === 'railroad') key = 'station';
              if (key === 'darkblue') key = 'blue';
              return t(`color_${key}`).toUpperCase();
            })()}
          </span>
        )}
      </div>
      <p className="text-[8px] leading-relaxed text-slate-300 font-semibold pt-1">
        {renderColorizedText(details.description || details.shortDesc, localStorage.getItem('language') || 'tr')}
      </p>
      <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-amber-500/50" />
    </div>
  );

  // ---------------------------------------------------------
  // 1. MINI-SIZED CARD (for Opponents, stacked piles, logs etc.)
  // ---------------------------------------------------------
  if (size === 'mini') {
    const renderMiniBody = () => {
      if (details.isMoney) {
        return (
          <div
            id={`card-mini-${card.id}`}
            onClick={onClick}
            className={`w-[40px] h-[58px] rounded-lg border border-black/40 flex flex-col justify-between p-0.5 relative overflow-hidden cursor-pointer hover:scale-110 transition-all shadow-md select-none fluid-card-container ${className}`}
            style={{ backgroundColor: details.bgColor }}
            title={`${card.value}M Para`}
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-black/10 via-transparent to-white/10 pointer-events-none" />
            <div className="w-5 h-5 rounded-full border border-black/20 bg-white/90 flex items-center justify-center mx-auto mt-0.5 shadow-sm">
              <span className="text-[8.5px] font-black text-slate-800 leading-none">{card.value}</span>
            </div>
            <span className="text-[8.5px] font-black text-white text-center drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)] leading-none mt-auto mb-0.5">
              {card.value}M
            </span>
          </div>
        );
      }

      if (details.isWildcard) {
        const isMulticolor = !card.secondaryColor;
        return (
          <div
            id={`card-mini-${card.id}`}
            onClick={onClick}
            className={`w-[40px] h-[58px] rounded-lg border border-black/30 flex flex-col justify-between p-0.5 relative overflow-hidden cursor-pointer hover:scale-110 transition-all shadow-md select-none fluid-card-container ${holoClass} ${className}`}
            style={{
              background: isMulticolor
                ? 'linear-gradient(135deg, #EF5350, #FF9800, #FFEE58, #4CAF50, #29B6F6, #9C27B0)'
                : `linear-gradient(135deg, ${primaryColorHex} 48%, #ffffff 48%, #ffffff 52%, ${secondaryColorHex || primaryColorHex} 52%)`
            }}
            title={details.name}
          >
            <div className="flex-1 flex items-center justify-center">
              <span className="text-[13px] drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.7)]">
                {isMulticolor ? '🌈' : '🌟'}
              </span>
            </div>
            <div className="bg-black/60 text-[6px] text-white font-black text-center py-0.5 leading-none rounded-sm">
              {isMulticolor ? 'JOKER' : 'ÇİFT'}
            </div>
          </div>
        );
      }

      if (card.type === 'property') {
        return (
          <div
            id={`card-mini-${card.id}`}
            onClick={onClick}
            className={`w-[40px] h-[58px] rounded-lg bg-white border border-slate-350 flex flex-col justify-between p-0.5 relative overflow-hidden cursor-pointer hover:scale-110 transition-all shadow-md select-none fluid-card-container ${holoClass} ${className}`}
            title={`${details.name} (Tapu)`}
          >
            <div className="h-2.5 w-full rounded-t-sm flex-shrink-0" style={{ backgroundColor: primaryColorHex }} />
            <div className="flex-1 flex items-center justify-center px-0.5 w-full overflow-hidden">
              {renderCardTitle(details.name, 'mini', true)}
            </div>
            <span className="text-[7.5px] font-black text-slate-600 text-center leading-none mb-0.5">
              {card.value}M
            </span>
          </div>
        );
      }

      // Dedicated Rent Mini card with color indicators
      if (details.isRent) {
        const isMulticolor = !card.color;
        return (
          <div
            id={`card-mini-${card.id}`}
            onClick={onClick}
            className={`w-[40px] h-[58px] rounded-lg border border-black/35 flex flex-col justify-between p-0.5 relative overflow-hidden cursor-pointer hover:scale-110 transition-all shadow-md select-none fluid-card-container ${holoClass} ${className}`}
            style={{
              background: isMulticolor
                ? 'linear-gradient(135deg, #EF5350, #FF9800, #FFEE58, #4CAF50, #29B6F6)'
                : card.secondaryColor
                ? `linear-gradient(135deg, ${primaryColorHex} 48%, #ffffff 48%, #ffffff 52%, ${secondaryColorHex} 52%)`
                : primaryColorHex
            }}
            title={details.name}
          >
            <div className="flex justify-between items-center px-0.5">
              <span className="text-[5.5px] font-black text-slate-900 bg-white/90 px-0.5 rounded leading-none">KİRA</span>
              <span className="text-[8px] leading-none drop-shadow-[0_0.5px_0.5px_rgba(0,0,0,0.5)]">💰</span>
            </div>
            <div className="bg-black/50 py-0.5 rounded-sm flex items-center justify-center w-full px-0.5 overflow-hidden">
              {renderCardTitle(isMulticolor ? 'HER RENK' : 'KİRA', 'mini', false)}
            </div>
          </div>
        );
      }

      // Default Action Mini card
      return (
        <div
          id={`card-mini-${card.id}`}
          onClick={onClick}
          className={`w-[40px] h-[58px] rounded-lg border border-black/30 flex flex-col justify-between p-0.5 relative overflow-hidden cursor-pointer hover:scale-110 transition-all shadow-md select-none fluid-card-container ${holoClass} ${className}`}
          style={{ backgroundColor: details.isAction && details.bgColor !== '#FFFFFF' ? details.bgColor : '#e2e8f0' }}
          title={details.name}
        >
          <div className="text-[12px] mx-auto leading-none mt-0.5">
            {details.icon}
          </div>
          <div className="bg-black/35 py-0.5 rounded-sm flex items-center justify-center w-full px-0.5 overflow-hidden">
            {renderCardTitle(details.name, 'mini', false)}
          </div>
        </div>
      );
    };

    return (
      <div 
        ref={cardRef}
        className="relative inline-block rounded-lg overflow-hidden"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseMove={handleMouseMove}
      >
        {tooltipElement}
        {renderMiniBody()}
        {skinOverlayElement}
        {holoOverlay}
        <CardEffectAnimation type={activeEffect} />
      </div>
    );
  }

  // ---------------------------------------------------------
  // 2. MEDIUM-SIZED CARD (for Properties piles in player layout - SHRUNK & CLEANED as requested)
  // ---------------------------------------------------------
  if (size === 'medium') {
    const renderMediumBody = () => {
      if (details.isMoney) {
        return (
          <div
            id={`card-med-${card.id}`}
            onClick={onClick}
            className={`w-full aspect-[2/3] rounded-md bg-white border border-white/50 shadow-md flex flex-col justify-between p-0.5 cursor-pointer hover:-translate-y-1 transition-all relative select-none ${className}`}
          >
            <div
              className="absolute inset-px rounded flex flex-col justify-between p-0.5"
              style={{ backgroundColor: details.bgColor }}
            >
              <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full border border-black/25 bg-white flex items-center justify-center font-black text-[6px] sm:text-[8px] text-slate-950 shadow-sm leading-none fluid-card-badge">
                {card.value}
              </div>
              <div className="my-auto text-center flex items-center justify-center w-full px-0.5">
                {renderCardTitle(`${card.value}M`, 'medium', false)}
              </div>
              <span className="text-[4px] sm:text-[5px] font-black text-white/60 text-center tracking-wider uppercase leading-none fluid-card-badge">
                PARA
              </span>
            </div>
          </div>
        );
      }

      if (details.isWildcard) {
        const isMulticolor = !card.secondaryColor;
        return (
          <div
            id={`card-med-${card.id}`}
            onClick={onClick}
            className={`w-full aspect-[2/3] rounded-md bg-white border border-slate-350 shadow-md flex flex-col justify-between p-0.5 cursor-pointer hover:-translate-y-1 transition-all relative select-none ${holoClass} ${className}`}
          >
            <div
              className="absolute inset-px rounded flex flex-col justify-between p-0.5 border border-black/10"
              style={{
                background: isMulticolor
                  ? 'linear-gradient(135deg, #EF5350, #FF9800, #FFEE58, #4CAF50, #29B6F6, #9C27B0)'
                  : `linear-gradient(135deg, ${primaryColorHex} 48%, #ffffff 48%, #ffffff 52%, ${secondaryColorHex || primaryColorHex} 52%)`
              }}
            >
              <div className="flex justify-between items-center px-0.5">
                <span className="text-[6px] sm:text-[8px] drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]">🌟</span>
                <span className="text-[4px] sm:text-[5.5px] font-black text-white bg-black/40 px-0.5 py-0.5 rounded uppercase leading-none fluid-card-badge">
                  JOKER
                </span>
              </div>

              <div className="bg-black/60 px-1 py-0.5 rounded flex items-center justify-center mx-auto overflow-hidden max-w-[90%]">
                {renderCardTitle(isMulticolor ? 'MULTİ' : 'ÇİFT', 'medium', false)}
              </div>

              <div className="flex justify-between items-center text-[4px] sm:text-[6px] text-white font-black leading-none px-0.5 fluid-card-badge">
                <span>{card.value}M</span>
                <span className="text-[5px] sm:text-[7px]">↕</span>
              </div>
            </div>
          </div>
        );
      }

      if (card.type === 'property') {
        return (
          <div
            id={`card-med-${card.id}`}
            onClick={onClick}
            className={`w-full aspect-[2/3] rounded-md bg-white border border-slate-350 shadow-sm flex flex-col justify-between cursor-pointer hover:-translate-y-1 transition-all relative select-none p-0.5 ${holoClass} ${
              isSelected ? 'ring-2 ring-amber-400 scale-105 z-10 shadow-[0_4px_12px_rgba(251,191,36,0.3)]' : ''
            } ${className}`}
          >
            {/* Property colored banner */}
            <div
              className="h-2.5 sm:h-3.5 w-full rounded-t-sm flex items-center justify-center border-b border-black/25 relative"
              style={{ backgroundColor: primaryColorHex }}
            />

            <div className="flex-1 flex flex-col justify-between p-0.5 sm:p-1 bg-white">
              {/* Simplified Property name in bold uppercase */}
              <div className="my-auto flex items-center justify-center w-full px-0.5 overflow-hidden">
                {renderCardTitle(details.name, 'medium', true)}
              </div>

              <div className="flex justify-between items-center text-[4.5px] sm:text-[6px] font-black text-slate-400 border-t border-slate-100 pt-0.5 mt-auto fluid-card-badge">
                <span className="text-slate-800 font-extrabold bg-slate-100 px-0.5 rounded leading-none">M{card.value}</span>
                <span className="leading-none">TAPU</span>
              </div>
            </div>
          </div>
        );
      }

      // Dedicated Rent Medium card with color indicators
      if (details.isRent) {
        const isMulticolor = !card.color;
        return (
          <div
            id={`card-med-${card.id}`}
            onClick={onClick}
            className={`w-full aspect-[2/3] rounded-md bg-white border border-slate-350 shadow-md flex flex-col justify-between p-0.5 cursor-pointer hover:-translate-y-1 transition-all relative select-none ${holoClass} ${className}`}
          >
            <div
              className="absolute inset-px rounded flex flex-col justify-between p-0.5 border border-black/10"
              style={{
                background: isMulticolor
                  ? 'linear-gradient(135deg, #EF5350, #FF9800, #FFEE58, #4CAF50, #29B6F6)'
                  : card.secondaryColor
                  ? `linear-gradient(135deg, ${primaryColorHex} 48%, #ffffff 48%, #ffffff 52%, ${secondaryColorHex} 52%)`
                  : primaryColorHex
              }}
            >
              <div className="flex justify-between items-center px-0.5">
                <span className="text-[4px] sm:text-[5.5px] font-black text-slate-950 bg-white/90 px-1 py-0.5 rounded uppercase leading-none fluid-card-badge shadow-sm">
                  KİRA
                </span>
                <span className="text-[6px] sm:text-[9px] leading-none drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]">💰</span>
              </div>

              <div className="bg-black/60 px-1 py-0.5 rounded flex items-center justify-center mx-auto overflow-hidden max-w-[90%] shadow-sm">
                {renderCardTitle(isMulticolor ? 'HER RENK' : 'KİRA', 'medium', false)}
              </div>

              <div className="flex justify-between items-center text-[4px] sm:text-[6px] text-white font-black leading-none px-0.5 fluid-card-badge drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]">
                <span>M{card.value}</span>
                <span className="text-white/80">KİRA</span>
              </div>
            </div>
          </div>
        );
      }

      // Default Action Medium card
      return (
        <div
          id={`card-med-${card.id}`}
          onClick={onClick}
          className={`w-full aspect-[2/3] rounded-md bg-white border border-white shadow-md flex flex-col justify-between p-0.5 cursor-pointer hover:-translate-y-1 transition-all relative select-none ${holoClass} ${className}`}
        >
          <div
            className="absolute inset-px rounded flex flex-col justify-between p-0.5 border border-black/10"
            style={{ backgroundColor: details.isAction && details.bgColor !== '#FFFFFF' ? details.bgColor : '#f1f5f9' }}
          >
            <div className="flex justify-between items-center">
              <span className="text-[3.5px] sm:text-[5px] font-black text-slate-700 bg-white/70 px-0.5 rounded uppercase leading-none fluid-card-badge">
                {details.typeLabel}
              </span>
              <span className="text-[6px] sm:text-[9px] leading-none">{details.icon}</span>
            </div>

            <div className="my-auto flex items-center justify-center w-full px-0.5 overflow-hidden">
              {renderCardTitle(details.name, 'medium', true)}
            </div>

            <div className="text-[4px] sm:text-[5.5px] text-slate-500 font-black text-right leading-none fluid-card-badge">
              {card.value}M
            </div>
          </div>
        </div>
      );
    };

    return (
      <Holo
        rarity={rarity}
        className="relative inline-block w-[46px] sm:w-[68px] md:w-[80px] flex-shrink-0 rounded-md overflow-hidden"
        style={tiltStyle}
      >
        {tooltipElement}
        {renderMediumBody()}
        {skinOverlayElement}
        <CardEffectAnimation type={activeEffect} />
      </Holo>
    );
  }

  // ---------------------------------------------------------
  // 3. NORMAL-SIZED CARD (Standard Card design in hand/piles - HIGHLY READABLE & BOLD)
  // ---------------------------------------------------------
  return (
    <Holo
      rarity={rarity}
      className="relative inline-block rounded-2xl overflow-hidden"
      style={tiltStyle}
    >
      {tooltipElement}
      <div
        id={`card-normal-${card.id}`}
        onClick={onClick}
        className={`flex-shrink-0 w-[114px] h-[170px] rounded-2xl border-[3.5px] shadow-2xl transition-all relative select-none flex flex-col justify-between cursor-pointer overflow-hidden p-0.5 ${skin.borderClass} ${skin.fontClass} ${holoClass} ${
          isSelected
            ? 'ring-4 ring-amber-400 scale-105 z-20 shadow-[0_15px_30px_rgba(251,191,36,0.45)]'
            : 'hover:-translate-y-2'
        } ${className}`}
      >
      {/* CARD BODY WITH THEME BACKGROUNDS */}

      {/* A. MONEY CARD DESIGN */}
      {details.isMoney && (
        <div
          className="w-full h-full rounded-xl flex flex-col justify-between p-1.5 relative border border-black/20 overflow-hidden"
          style={{ backgroundColor: details.bgColor }}
        >
          <div className="absolute inset-0 opacity-[0.06] pointer-events-none" style={{
            backgroundImage: 'repeating-linear-gradient(45deg, #000, #000 10px, transparent 10px, transparent 20px)'
          }} />

          {/* Top Value Circle */}
          <div className="flex justify-between items-start z-10">
            <div className={`w-5 h-5 rounded-full border border-black/35 flex items-center justify-center font-black text-[8px] shadow-sm leading-none ${getValueBadgeStyles(card.value).bgClass}`}>
              M{card.value}
            </div>
            <span className="text-[6px] font-black tracking-widest text-white uppercase bg-black/20 px-1 py-0.5 rounded-sm leading-none">
              PARA KARTI
            </span>
          </div>

          {/* Massive central outlined number circle */}
          <div className="flex flex-col items-center justify-center my-auto z-10">
            <div className="w-14 h-14 rounded-full border-[2.5px] border-black bg-white flex items-center justify-center shadow-lg relative">
              <div className="absolute inset-[1.5px] rounded-full border border-black/10" />
              <span className="text-slate-950 font-black text-[25px] tracking-tight leading-none">
                {card.value}
              </span>
            </div>

            <div className="bg-[#E51B24] border border-black px-1.5 py-0.5 mt-[-6px] z-10 text-[6px] font-black text-white uppercase tracking-wider rounded-sm shadow leading-none">
              MONO DEAL
            </div>
          </div>

          {/* Repeating value at bottom */}
          <div className="flex justify-between items-center text-[6px] font-black text-white/90 z-10 px-0.5 leading-none">
            <span className="tracking-tighter font-extrabold">{card.value}M NAKİT</span>
            <span className="tracking-wide uppercase font-black">PARA</span>
          </div>
        </div>
      )}

      {/* B. PROPERTY CARD DESIGN */}
      {!details.isMoney && card.type === 'property' && (
        <div className="w-full h-full rounded-xl bg-white flex flex-col justify-between relative border border-slate-350 overflow-hidden">
          {/* 1. Header Banner */}
          <div
            className="h-9 w-full flex items-center justify-center border-b-2 border-black relative px-1"
            style={{ backgroundColor: primaryColorHex }}
          >
            <div className="absolute inset-x-0 top-0 h-[1.5px] bg-white/20" />
            {renderCardTitle(details.name, 'normal', false)}
          </div>

          {/* Body Section */}
          <div className="flex-1 flex flex-col justify-between p-1.5 bg-white relative">
            {/* Cost Badge top-left */}
            <div className={`absolute top-1 left-1 w-5 h-5 rounded-full border border-black/35 flex items-center justify-center font-black text-[8px] shadow-sm leading-none ${getValueBadgeStyles(card.value).bgClass}`}>
              M{card.value}
            </div>

            {/* Set limit tag top-right */}
            <span className="absolute top-1 right-1 text-[5px] font-black text-slate-800 uppercase bg-amber-100 border border-amber-300 px-1 py-0.5 rounded leading-none">
              {MAX_IN_SET[card.color!]}'li Set
            </span>

            {/* Simplified, larger Rent info table for immediate mobile reading */}
            <div className="w-full mt-6 space-y-1">
              <div className="border border-black/15 rounded-lg overflow-hidden bg-slate-50 p-1 space-y-0.5">
                {RENT_VALUES[card.color!]?.map((rent, idx) => {
                  const isCompleted = idx === (MAX_IN_SET[card.color!] - 1);
                  return (
                    <div
                      key={idx}
                      className={`flex justify-between items-center px-1 py-0.5 rounded text-[6px] ${
                        isCompleted
                          ? 'bg-amber-100/70 border border-amber-400 font-black text-slate-950'
                          : 'text-slate-700 font-extrabold'
                      }`}
                    >
                      <span>{idx + 1} Tapu:</span>
                      <span className="font-extrabold text-[7px] text-slate-950">M{rent}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Color and Type footer */}
            <div className="border-t border-slate-200 pt-1 mt-auto flex justify-between items-center text-[6px]">
              <span className="font-black text-slate-950 bg-slate-100 border border-slate-300 px-1 rounded leading-none">
                M{card.value}
              </span>
              <span className="text-[5.5px] font-black text-slate-600 uppercase tracking-tight flex items-center gap-0.5 leading-none">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: primaryColorHex }} />
                {TURKISH_COLOR_LABELS[card.color!]}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* C. JOKER CARD DESIGN */}
      {!details.isMoney && details.isWildcard && (
        <div className="w-full h-full rounded-xl bg-white flex flex-col justify-between relative border border-slate-350 overflow-hidden">
          {/* MULTICOLOR JOKER */}
          {!card.secondaryColor ? (
            <div
              className="w-full h-full flex flex-col justify-between p-1.5 relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #FF1744 10%, #FF9100 25%, #FFEA00 40%, #00E676 55%, #00B0FF 70%, #D500F9 85%)'
              }}
            >
              <div className="bg-black text-white font-black text-[7.5px] text-center uppercase tracking-wide py-0.5 rounded border border-white/25 leading-none">
                SÜPER JOKER TAPU
              </div>

              <div className="my-auto text-center z-10 flex flex-col items-center">
                <div className="w-13 h-13 rounded-full border-2 border-black bg-white flex items-center justify-center shadow-lg relative animate-pulse">
                  <span className="text-2xl leading-none">🎩</span>
                </div>
                <div className="bg-[#E51B24] border border-black px-1.5 py-0.5 mt-[-6px] text-[5.5px] font-black text-white uppercase rounded-sm shadow leading-none">
                  HER RENK
                </div>
              </div>

              {/* Rules banner simplified */}
              <div className="bg-black/85 border border-white/10 rounded-lg p-1 text-center text-white z-10">
                <p className="text-[5.5px] font-black leading-tight text-amber-300">
                  HERHANGİ BİR SETTE KULLANILIR!
                </p>
              </div>

              <div className="flex justify-between items-center text-[6px] text-white font-black z-10 leading-none">
                <span>M{card.value}</span>
                <span className="tracking-wide uppercase font-extrabold">JOKER KART</span>
              </div>
            </div>
          ) : (
            /* DUAL COLOR JOKER CARD */
            <div className="w-full h-full flex flex-col justify-between relative overflow-hidden">
              <div className="absolute inset-0 flex flex-col">
                <div className="h-1/2 w-full border-b-2 border-black" style={{ backgroundColor: primaryColorHex }} />
                <div className="h-1/2 w-full" style={{ backgroundColor: secondaryColorHex }} />
              </div>

              <div className="absolute inset-0 bg-black/10 pointer-events-none" />

              {/* Headers styled to be highly readable */}
              <div className="absolute top-1.5 inset-x-1.5 z-10 bg-white border border-black rounded px-1 py-0.5 flex justify-between items-center">
                <span className="text-[5.5px] font-black text-slate-900 uppercase">JOKER:</span>
                <span className="text-[5.5px] font-black px-1 rounded text-white" style={{ backgroundColor: primaryColorHex }}>
                  {TURKISH_COLOR_LABELS[card.color!]}
                </span>
              </div>

              <div className="absolute bottom-1.5 inset-x-1.5 z-10 bg-white border border-black rounded px-1 py-0.5 flex justify-between items-center flex-row-reverse">
                <span className="text-[5.5px] font-black text-slate-900 uppercase">JOKER:</span>
                <span className="text-[5.5px] font-black px-1 rounded text-white" style={{ backgroundColor: secondaryColorHex }}>
                  {TURKISH_COLOR_LABELS[card.secondaryColor!]}
                </span>
              </div>

              <div className="my-auto mx-auto z-10 relative">
                <div className="w-10 h-10 rounded-full border-2 border-black bg-white flex items-center justify-center shadow-lg">
                  <span className="text-slate-950 font-black text-[15px] rotate-90 inline-block">
                    ⇄
                  </span>
                </div>
              </div>

              <div className={`absolute top-1/2 left-1.5 -translate-y-1/2 w-5 h-5 rounded-full border border-black/35 flex items-center justify-center font-black text-[7.5px] shadow z-10 leading-none ${getValueBadgeStyles(card.value).bgClass}`}>
                M{card.value}
              </div>
            </div>
          )}
        </div>
      )}

      {/* D. ACTION CARD DESIGN */}
      {!details.isMoney && !details.isWildcard && details.isAction && (
        <div
          className="w-full h-full rounded-xl flex flex-col justify-between p-1.5 relative border border-black/25 overflow-hidden"
          style={{ backgroundColor: details.bgColor }}
        >
          {/* Top Bar */}
          <div className="flex justify-between items-center z-10">
            <div className={`w-5 h-5 rounded-full border border-black/35 flex items-center justify-center font-black text-[8px] shadow-sm leading-none ${getValueBadgeStyles(card.value).bgClass}`}>
              M{card.value}
            </div>

            <div className="border border-black bg-white px-1 py-0.5 rounded text-[5px] font-black text-slate-950 uppercase tracking-wide select-none shadow leading-none">
              HAMLE KARTI
            </div>
          </div>

          {/* Central Black Ring Illustration with HUGE action name */}
          <div className="flex flex-col items-center justify-center my-auto z-10 w-full px-1">
            <div className="w-13 h-13 rounded-full border-2 border-black bg-white flex flex-col items-center justify-center shadow-md relative mb-1.5">
              <span className="text-2xl leading-none">{details.icon}</span>
            </div>
            <div className="bg-slate-950 border border-slate-700 px-1.5 py-0.5 rounded shadow-sm flex items-center justify-center w-full max-w-[100px]">
              {renderCardTitle(details.name, 'normal', false)}
            </div>
          </div>

          {/* Bottom rules box - simplified for high contrast / easy reading on mobile */}
          <div className="bg-white border border-black rounded-lg p-1 text-center shadow min-h-[32px] flex items-center justify-center z-10">
            <p className="text-[7.5px] font-black leading-tight text-slate-950 uppercase">
              {renderColorizedText(details.shortDesc, localStorage.getItem('language') || 'tr')}
            </p>
          </div>

          {/* Footer value and brand info */}
          <div className="flex justify-between items-center text-[6px] font-black z-10 px-0.5 leading-none">
            <span className={`${details.bgColor === '#FFFFFF' ? 'text-slate-800' : 'text-white'}`}>M{card.value} DEĞER</span>
            <span className={`tracking-wide font-black ${details.bgColor === '#FFFFFF' ? 'text-slate-400' : 'text-white/80'}`}>HAMLE</span>
          </div>
        </div>
      )}

      {/* E. RENT CARD DESIGN */}
      {!details.isMoney && !details.isWildcard && details.isRent && (
        <div className="w-full h-full rounded-xl bg-white flex flex-col justify-between p-1.5 relative border border-slate-350 overflow-hidden">
          {/* Top indicators */}
          <div className="flex justify-between items-center z-10">
            <div className={`w-5 h-5 rounded-full border border-black/35 flex items-center justify-center font-black text-[8px] shadow-sm leading-none ${getValueBadgeStyles(card.value).bgClass}`}>
              M{card.value}
            </div>
            <div className="border border-black bg-slate-950 px-1.5 py-0.5 rounded text-[5px] font-black text-white uppercase tracking-wide select-none shadow leading-none">
              KİRA KARTI
            </div>
          </div>

          {/* Color Ring Badge in center */}
          <div className="flex flex-col items-center justify-center my-auto z-10">
            <div
              className="w-13 h-13 rounded-full border-2 border-black flex flex-col items-center justify-center shadow-md relative bg-white"
              style={{
                background: !card.color
                  ? 'linear-gradient(135deg, #EF5350, #FF9800, #FFEE58, #4CAF50, #29B6F6)'
                  : card.secondaryColor
                  ? `linear-gradient(135deg, ${primaryColorHex} 50%, ${secondaryColorHex} 50%)`
                  : primaryColorHex
              }}
            >
              <div className="absolute inset-[3px] rounded-full bg-white flex flex-col items-center justify-center border border-black/10">
                <span className="text-lg leading-none">💰</span>
                <span className="text-[7.5px] font-black text-slate-950 leading-none">KİRA</span>
              </div>
            </div>
          </div>

          {/* Description - Simplified and ultra bold */}
          <div className="bg-slate-50 border border-black/15 rounded-lg p-1 text-center shadow min-h-[32px] flex items-center justify-center z-10">
            <p className="text-[7.5px] font-black leading-tight text-slate-950 uppercase">
              {renderColorizedText(details.shortDesc, localStorage.getItem('language') || 'tr')}
            </p>
          </div>

          {/* Footer details */}
          <div className="flex justify-between items-center text-[6px] font-black text-slate-500 z-10 px-0.5 leading-none">
            <span className="bg-slate-100 border border-slate-200 px-1 rounded text-slate-950 font-black">M{card.value}</span>
            <span className="tracking-wide text-slate-400 uppercase">KİRA</span>
          </div>
        </div>
      )}

      {/* Golden Glowing Rent Overlay when player owns matching property land */}
      {isGlowableRent && (
        <>
          <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 opacity-90 blur-[6px] animate-pulse pointer-events-none z-25 shadow-[0_0_20px_rgba(251,191,36,0.9)]" />
          <div className="absolute inset-0 rounded-xl ring-2 ring-amber-400 ring-offset-1 ring-offset-slate-950 pointer-events-none z-35 animate-pulse" />
          <div className="absolute top-1 right-1 z-40 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-[6px] px-1 py-0.5 rounded shadow-[0_0_8px_rgba(245,158,11,0.9)] flex items-center gap-0.5 leading-none animate-bounce-subtle">
            ⚡ KİRA HAZIR
          </div>
        </>
      )}

      {skinOverlayElement}
      <CardEffectAnimation type={activeEffect} />
      </div>
    </Holo>
  );
};
