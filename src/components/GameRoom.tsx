import React from 'react';
import { Card, GamePlayer, MatchState, CardColor, UserProfile, GameLog } from '../types';
import { generateDeck, shuffleDeck, checkWinner, COLOR_LABELS, COLOR_HEX, MAX_IN_SET, RENT_VALUES } from '../lib/deck';
import { BotEngine } from '../lib/BotEngine';
import { sounds } from '../lib/SoundSystem';
import { GameCard, TURKISH_NAMES } from './GameCard';
import { motion, AnimatePresence } from 'motion/react';
import { AvatarWithFrame } from './AvatarWithFrame';
import { t } from '../lib/TranslationSystem';
import { WS_BASE_URL, API_BASE_URL } from '../lib/apiConfig';
import { PLAYER_BOARD_STYLES } from './ShopDialog';
import { SPRING_PRESETS, CARD_VARIANTS, BOARD_REACTION_VARIANTS, ActionVFX } from '../lib/AnimationLibrary';
import { findShopItem, loadShopItems, subscribeShopItems } from '../lib/shopItemsStore';
import { useCompactLayout } from '../hooks/useCompactLayout';
import { getCountryByCode } from '../lib/countryData';
import { HlsVideoPlayer, isVideoUrl } from './HlsVideoPlayer';

interface Props {
  roomId: string;
  isOffline: boolean;
  profile: UserProfile;
  onLeaveRoom: () => void;
  onUpdateProfile: (updated: UserProfile) => void;
  adminSettings?: any;
  roomPassword?: string;
}

const translateCardNameInStr = (name: string, profile: UserProfile): string => {
  if (!name) return '';
  if (profile.settings.language !== 'en') return name;
  const cleanName = name.toLowerCase().replace(/'/g, '').replace(/ /g, '_');
  const key = `card_${cleanName}_name`;
  const val = t(key, profile);
  if (val !== key) return val;

  const cleanNameForProp = cleanName
    .replace(/_avenue/g, '_ave')
    .replace(/_place/g, '_pl')
    .replace(/_gardens/g, '_gardens');
  const propKey = `prop_${cleanNameForProp}`;
  const propVal = t(propKey, profile);
  if (propVal !== propKey) return propVal;

  return name;
};

const translateColorLabelInStr = (colorLabel: string, profile: UserProfile): string => {
  if (!colorLabel) return '';
  if (profile.settings.language !== 'en') return colorLabel;
  for (const col in COLOR_LABELS) {
    if (COLOR_LABELS[col as CardColor] === colorLabel) {
      let cleanCol = col === 'lightblue' ? 'sky_blue' : col;
      if (cleanCol === 'railroad') cleanCol = 'station';
      if (cleanCol === 'darkblue') cleanCol = 'blue';
      const key = `color_${cleanCol}`;
      const val = t(key, profile);
      if (val !== key) return val;
    }
  }
  return colorLabel;
};

const translateRecoveryMessage = (msg: string, profile: UserProfile): string => {
  if (profile.settings.language !== 'en') return msg;
  switch (msg) {
    case 'Atık destesi boş olduğu için kart karıştırılamadı!':
      return 'Could not reshuffle because the discard pile is empty!';
    case 'Kart başarıyla kasanıza eklendi.':
      return 'Card successfully deposited to bank vault.';
    case 'Kart başarıyla arsa setinize eklendi.':
      return 'Card successfully added to property set.';
    case 'Mülk rengi başarıyla değiştirildi.':
      return 'Property color changed successfully.';
    case 'Ev başarıyla kuruldu.':
      return 'House built successfully.';
    case 'Otel başarıyla kuruldu.':
      return 'Hotel built successfully.';
    case 'Yetersiz hamle hakkı! Turunuzda en fazla 3 hamle yapabilirsiniz.':
      return 'No moves remaining! You can only play up to 3 cards per turn.';
    default:
      return msg;
  }
};

const translateLogMessage = (msg: string, profile: UserProfile): string => {
  if (profile.settings.language !== 'en') return msg;
  let out = msg;

  // New room and connection logs
  out = out.replace(/^([^ ]+) odaya eklendi\.$/, '$1 joined the room.');
  out = out.replace(/^([^ ]+) (odadan|lobiden) ayrıldı\.$/, '$1 left the room.');
  out = out.replace(/^([^ ]+) odadan atıldı\.$/, '$1 was kicked from the room.');
  out = out.replace(/^([^ ]+) bağlantısını kaybetti. Yapay zeka devralıyor\.$/, '$1 disconnected. AI is taking over.');

  // Game mode settings translation
  if (out.includes('Oda ayarları güncellendi:')) {
    out = out.replace(/Klasik Mod 🎲/g, 'Classic Mode 🎲');
    out = out.replace(/Kaos Modu 🌀/g, 'Chaos Mode 🌀');
    out = out.replace(/Hedef: (\d+) Set/g, 'Target: $1 Sets');
    out = out.replace(/Tur Süresi: Sınırsız/g, 'Turn Limit: Unlimited');
    out = out.replace(/Tur Süresi: (\d+)/g, 'Turn Limit: $1s');
    out = out.replace(/Otomatik Tur Sonu: Açık/g, 'Auto End Turn: ON');
    out = out.replace(/Otomatik Tur Sonu: Kapalı/g, 'Auto End Turn: OFF');
    out = out.replace(/^Oda ayarları güncellendi: (.*)$/, 'Room settings updated: $1');
  }

  // Draw and turn timeout logs
  out = out.replace(/^([^ ]+) desteden (\d+) kart çekti\.$/, '$1 drew $2 cards from the deck.');
  out = out.replace(/^⏱️ ([^ ]+) süre aşımı nedeniyle sırasını kaybetti! Sıra devrediliyor\.$/, '⏱️ $1 timed out! Turn passed.');
  out = out.replace(/^⏱️ ([^ ]+) yanıt süresini aştı! Sistem otomatik karar alıyor\.$/, '⏱️ $1 timed out! System made an auto-decision.');
  out = out.replace(/^⏱️ Bazı oyuncular yanıt süresini aştı! Sistem otomatik ödeme yaptı\.$/, '⏱️ Some players timed out! Auto-payment resolved.');
  out = out.replace(/^Deste bitti, kartlar yeniden karıştırıldı\.$/, 'Deck exhausted, cards reshuffled.');
  out = out.replace(/^⚠️ Atık kart bulunamadı! Acil durum yedek destesi üretildi\.$/, '⚠️ No discard pile found! Emergency deck generated.');

  // Play and placement logs
  out = out.replace(/^([^,]+), bankaya (\d+)M para ekledi\.$/, '$1 deposited $2M cash in the bank.');
  out = out.replace(/^([^ ]+) bankaya (\d+)M para ekledi\.$/, '$1 deposited $2M cash in the bank.');
  out = out.replace(/^([^,]+), banka kasasına (\d+)M para \((.+?)\) yerleştirdi\.$/, (m, p1, val, cardName) => {
    return `${p1} deposited ${val}M cash (${translateCardNameInStr(cardName, profile)}) in the bank.`;
  });
  out = out.replace(/^([^ ]+), bankaya (\d+)M para \((.+?)\) ekledi\.$/, (m, p1, val, cardName) => {
    return `${p1} deposited ${val}M cash (${translateCardNameInStr(cardName, profile)}) in the bank.`;
  });
  out = out.replace(/^([^,]+), (.*) grubuna (Ev|Otel) dikti\.$/, (m, name, group, bld) => {
    const enBld = bld === 'Ev' ? 'House' : 'Hotel';
    return `${name} built a ${enBld} on the ${translateColorLabelInStr(group, profile)} set.`;
  });
  out = out.replace(/^([^,]+), (.*) grubuna mülk yerleştirdi\.$/, (m, name, group) => {
    return `${name} placed a property on the ${translateColorLabelInStr(group, profile)} set.`;
  });
  out = out.replace(/^(.+?), (.+?) grubuna (.+?) yerleştirdi\.$/, (m, p1, colGroup, cardName) => {
    const tc = translateCardNameInStr(cardName, profile);
    const tcol = translateColorLabelInStr(colGroup, profile);
    return `${p1} placed "${tc}" on the ${tcol} set.`;
  });
  out = out.replace(/^([^,]+) elinden fazla olan (.*) kartını attı\.$/, (m, name, cardName) => {
    return `${name} discarded excess card: ${translateCardNameInStr(cardName, profile)}.`;
  });
  out = out.replace(/^([^,]+) elinden (.*) kartını attı\.$/, (m, name, cardName) => {
    return `${name} discarded ${translateCardNameInStr(cardName, profile)}.`;
  });
  out = out.replace(/^([^ ]+) elinden (.+?) kartını attı\.$/, (m, p1, cardName) => {
    return `${p1} discarded "${translateCardNameInStr(cardName, profile)}".`;
  });

  // Action cards general logs
  out = out.replace(/^([^,]+) aksiyon kartı oynadı: (.*)$/, (m, name, cardName) => {
    return `${name} played action card: ${translateCardNameInStr(cardName, profile)}`;
  });
  out = out.replace(/^(.+?) aksiyon kartı oynadı: (.+)$/, (m, p1, cardName) => {
    return `${p1} played action card: ${translateCardNameInStr(cardName, profile)}`;
  });
  out = out.replace(/^([^ ]+) aksiyon kartı oynadı: (.*)$/, (m, name, cardName) => {
    return `${name} played action card: ${translateCardNameInStr(cardName, profile)}`;
  });

  // Specific action card request / execution logs
  out = out.replace(/^([^,]+) Başlangıç Noktasından Geçti ve 2 kart çekti!$/, '$1 passed GO and drew 2 cards!');
  out = out.replace(/^([^ ]+) Başlangıç Noktasından Geçti ve 2 kart çekti!$/, '$1 passed GO and drew 2 cards!');
  out = out.replace(/^📣 ([^,]+) doğum günü kartı oynadı ve herkesten 2M talep ediyor!$/, "📣 $1 played It's My Birthday card and demands 2M from everyone!");
  out = out.replace(/^([^ ]+) Bugün Benim Doğum Günüm kartını oynadı! Herkesten 2M talep ediyor\.$/, "$1 played It's My Birthday card! Demands 2M from everyone.");

  // Sly Deal logs
  out = out.replace(/^📣 (.+?), (.+?) adlı oyuncunun mülkünü Sinsi Anlaşma ile çalmak istiyor!$/, '📣 $1 wants to steal a property from $2 using Sly Deal!');
  out = out.replace(/^([^,]+), senden (.*) mülkünü sinsi anlaşma ile çaldı!$/, (m, name, propName) => {
    return `${name} stole ${translateCardNameInStr(propName, profile)} from you using Sly Deal!`;
  });
  out = out.replace(/^([^ ]+), ([^ ]+)'den (.+?) mülkünü sinsi anlaşma ile çaldı!$/, (m, p1, p2, cardName) => {
    return `${p1} stole "${translateCardNameInStr(cardName, profile)}" from ${p2} using Sly Deal!`;
  });
  out = out.replace(/^([^ ]+), ([^ ]+)'den (.+?) mülkünü sinsi anlaşma ile aldı!$/, (m, p1, p2, cardName) => {
    return `${p1} stole "${translateCardNameInStr(cardName, profile)}" from ${p2} using Sly Deal!`;
  });

  // Deal Breaker logs
  out = out.replace(/^📣 (.+?), (.+?) adlı oyuncunun tamamlanmış (.+?) setini çalan bir Anlaşma Bozan kartı oynadı!$/, (m, p1, p2, colGroup) => {
    return `📣 ${p1} played a Deal Breaker to steal the completed ${translateColorLabelInStr(colGroup, profile)} set of ${p2}!`;
  });
  out = out.replace(/^([^,]+), tamamlanmış (.*) setini Anlaşma Bozan kartı ile çaldı!$/, (m, name, group) => {
    return `${name} stole your completed ${translateColorLabelInStr(group, profile)} set using Deal Breaker!`;
  });
  out = out.replace(/^([^ ]+), ([^ ]+) adlı oyuncunun tamamlanmış (.+?) setini çaldı!$/, (m, p1, p2, colGroup) => {
    return `${p1} stole the completed ${translateColorLabelInStr(colGroup, profile)} set of ${p2}!`;
  });

  // Forced Deal logs
  out = out.replace(/^📣 (.+?), (.+?) ile (.+?) mülkü karşılığında (.+?) mülkünü Zoraki Takas ile değiştirmek istiyor!$/, (m, p1, p2, c1, c2) => {
    const tc1 = translateCardNameInStr(c1, profile);
    const tc2 = translateCardNameInStr(c2, profile);
    return `📣 ${p1} wants to swap property "${tc1}" with ${p2}'s "${tc2}" via Forced Deal!`;
  });
  out = out.replace(/^([^,]+), ([^ ]+) ile Zoraki Takas yaptı! (.*) verdi ve (.*) aldı\.$/, (m, p1, p2, give, take) => {
    return `${p1} made a Forced Deal with ${p2}! Gave ${translateCardNameInStr(give, profile)} and took ${translateCardNameInStr(take, profile)}.`;
  });
  out = out.replace(/^([^,]+), seninle Zoraki Takas yaptı! (.*) verdi ve (.*) aldı\.$/, (m, name, give, take) => {
    return `${name} made a Forced Deal with you! Gave ${translateCardNameInStr(give, profile)} and took ${translateCardNameInStr(take, profile)}.`;
  });
  out = out.replace(/^([^ ]+) Zoraki Takas ile "(.*)" mülkünü aldı, karşılığında "(.*)" mülkünü verdi\.$/, (m, name, take, give) => {
    return `${name} took "${translateCardNameInStr(take, profile)}" in Forced Deal, and gave "${translateCardNameInStr(give, profile)}" in return.`;
  });
  out = out.replace(/^([^ ]+), ([^ ]+) ile (.+?) karşılığında (.+?) mülkünü takas etti!$/, (m, p1, p2, card1, card2) => {
    return `${p1} swapped "${translateCardNameInStr(card2, profile)}" with ${p2} for "${translateCardNameInStr(card1, profile)}"!`;
  });
  out = out.replace(/^([^ ]+), ([^ ]+) ile (.+?) karşılığında (.+?) kartını takas etti!$/, (m, p1, p2, card1, card2) => {
    return `${p1} swapped "${translateCardNameInStr(card2, profile)}" with ${p2} for "${translateCardNameInStr(card1, profile)}"!`;
  });

  // Debt Collector logs
  out = out.replace(/^📣 ([^,]+) (Borç Tahsildarı|Sinsi Anlaşma|Anlaşma Bozan|Zoraki Takas) kartı oynadı! Elinde 'Hayır Teşekkürler' kartı olduğu için savunma yapabilirsin!$/, (m, name, cardName) => {
    return `📣 ${name} played ${translateCardNameInStr(cardName, profile)}! You can play 'Just Say No' to defend!`;
  });
  out = out.replace(/^📣 ([^,]+) (Borç Tahsildarı|Sinsi Anlaşma|Anlaşma Bozan|Zoraki Takas) oynadı! Elinde 'Hayır Teşekkürler' kartı olduğu için savunma yapabilirsin!$/, (m, name, cardName) => {
    return `📣 ${name} played ${translateCardNameInStr(cardName, profile)}! You can play 'Just Say No' to defend!`;
  });
  out = out.replace(/^📣 ([^,]+) (Borç Tahsildarı|Sinsi Anlaşma|Anlaşma Bozan|Zoraki Takas) Engeli!$/, (m, name, cardName) => {
    return `📣 ${name} ${translateCardNameInStr(cardName, profile)} Blocked!`;
  });
  out = out.replace(/^📣 ([^,]+) (Borç Tahsildarı|Sinsi Anlaşma|Anlaşma Bozan|Zoraki Takas) Oynandı!$/, (m, name, cardName) => {
    return `📣 ${name} ${translateCardNameInStr(cardName, profile)} Played!`;
  });
  out = out.replace(/^📣 ([^,]+) Borç Tahsildarı kartı oynadı ve senden 5M talep ediyor!$/, "📣 $1 played Debt Collector and demands 5M from you!");
  out = out.replace(/^([^ ]+), ([^ ]+) adlı oyuncudan (\d+)M borç tahsilatı talep ediyor!$/, '$1 demands $3M debt collection from $2!');

  // Rent logs
  out = out.replace(/^([^,]+) Kirayı İkiye Katla kartını oynadı!$/, '$1 played Double Rent card!');
  out = out.replace(/^📣 ([^,]+), (.*) mülkleri için senden (\d+)M kira talep ediyor!$/, (m, name, group, amt) => {
    return `📣 ${name} demands ${amt}M rent from you on the ${translateColorLabelInStr(group, profile)} properties!`;
  });
  out = out.replace(/^([^ ]+), ([^ ]+) mülkleri için ([^ ]+) oyuncusundan (\d+)M kira talep etti!$/, (m, p1, colGroup, p2, rentVal) => {
    return `${p1} demanded ${rentVal}M rent from ${p2} on the ${translateColorLabelInStr(colGroup, profile)} properties!`;
  });
  out = out.replace(/^([^ ]+), ([^ ]+) mülkleri için herkesten (\d+)M kira talep etti!$/, (m, p1, colGroup, rentVal) => {
    return `${p1} demanded ${rentVal}M rent from everyone on the ${translateColorLabelInStr(colGroup, profile)} properties!`;
  });
  out = out.replace(/^([^ ]+) mülkü olmadığı için kira tahsil edemedi\.$/, "$1 couldn't collect rent because they have no properties in that color.");

  // Payment and Winner logs
  out = out.replace(/^([^,]+), (.*) adlı oyuncuya (.*)M değerinde ödeme transferi yaptı\.$/, '$1 paid $3M to $2.');
  out = out.replace(/^([^ ]+), ([^ ]+) oyuncusuna (\d+)M ödeme yaptı\.$/, '$1 paid $3M to $2.');
  out = out.replace(/^([^,]+), ([^ ]+) adlı oyuncuya (\d+)M değerinde ödeme transferi yaptı\.$/, '$1 paid $3M to $2.');
  out = out.replace(/^Tebrikler! Maçı ([^ ]+) kazandı!$/, 'Congratulations! $1 won the match!');

  // JSN defense logs
  out = out.replace(/^([^,]+), 'Hayır Deme Hakkı' kullanarak ([^']+)'in hamlesine karşı koydu!$/, "$1 played Just Say No to counter $2's action!");
  out = out.replace(/^([^ ]+), 'Hayır Teşekkürler' diyerek ([^']+)'in hamlesine karşı koydu!$/, "$1 played Just Say No to counter $2's action!");
  out = out.replace(/^([^ ]+), 'Hayır Teşekkürler' diyerek ([^']+)'in hamlesini engelledi!$/, "$1 blocked $2's action with Just Say No!");
  out = out.replace(/^🛡️ ([^ ]+) 'Hayır Deme Hakkı' \(Reddet\) kartını kullanarak senin (.*) hamleni engelledi!$/, (m, defender, action) => {
    return `🛡️ ${defender} played Just Say No and countered your ${translateCardNameInStr(action, profile)} action!`;
  });
  out = out.replace(/^🛡️ ([^ ]+) 'Hayır Teşekkürler' diyerek senin 'Hayır' savunmanı iptal etti! \(Reddete Redet!\)$/, "🛡️ $1 counter-countered with Just Say No!");
  out = out.replace(/^🎯 Savunma iptal edildi! Hamle başarıyla uygulandı\.$/, '🎯 Counter canceled! Action resolved successfully.');
  out = out.replace(/^🛡️ Savunma başarılı oldu! ([^']+)'in hamlesi engellendi\.$/, "🛡️ Defense successful! $1's action was blocked.");
  out = out.replace(/^🛡️ Savunma başarılı oldu! Hamle engellendi\.$/, '🛡️ Defense successful! Action blocked.');

  // Target and general logs
  out = out.replace(/^🎯 ([^,]+), (.*) adlı oyuncudan (.*) mülkünü çaldı!$/, (m, stealer, target, prop) => {
    return `🎯 ${stealer} stole ${translateCardNameInStr(prop, profile)} from ${target}!`;
  });
  out = out.replace(/^🎯 ([^,]+), (.*) adlı oyuncunun tamamlanmış (.*) setini çaldı!$/, (m, stealer, target, group) => {
    return `🎯 ${stealer} stole the completed ${translateColorLabelInStr(group, profile)} set of ${target}!`;
  });
  out = out.replace(/^🎯 ([^,]+), (.*) ile (.*) karşılığında (.*) mülkünü takas etti!$/, (m, stealer, target, give, take) => {
    return `🎯 ${stealer} swapped ${translateCardNameInStr(take, profile)} with ${target} for ${translateCardNameInStr(give, profile)}!`;
  });
  out = out.replace(/^([^,]+), (.*) adlı oyuncunun tamamlanmış (.*) setini Anlaşma Bozan kartı ile çaldı!$/, (m, stealer, target, group) => {
    return `${stealer} stole the completed ${translateColorLabelInStr(group, profile)} set of ${target} using Deal Breaker!`;
  });

  // Excess buildings logs
  out = out.replace(/^Sayı yetersizliğinden dolayı ([^ ]+) adlı oyuncunun (.*) setindeki Otel yıkıldı ve ıskartaya gitti\.$/, (m, name, group) => {
    return `Due to insufficient count, ${name}'s Hotel on the ${translateColorLabelInStr(group, profile)} set was destroyed and discarded.`;
  });
  out = out.replace(/^Sayı yetersizliğinden dolayı ([^ ]+) adlı oyuncunun (.*) setindeki Ev yıkıldı ve ıskartaya gitti\.$/, (m, name, group) => {
    return `Due to insufficient count, ${name}'s House on the ${translateColorLabelInStr(group, profile)} set was destroyed and discarded.`;
  });

  // Bankruptcy and Turn limits
  out = out.replace(/^💥 ([^ ]+) adlı oyuncu iflas etti! Tüm varlıkları ([^ ]+) adlı oyuncuya devredildi\.$/, '💥 $1 went bankrupt! All assets transferred to $2.');
  out = out.replace(/^Sıra ([^ ]+) adlı yapay zekaya geçti\.$/, 'Turn passed to bot: $1.');
  out = out.replace(/^Sıra ([^ ]+) adlı oyuncuda\.$/, 'Turn passed to player: $1.');
  out = out.replace(/^Sıra ([^ ]+) adlı oyuncuda\. \(Önceki oyuncu 3 hamlesini tamamladı\)$/, 'Turn passed to player: $1. (Previous player used 3 moves)');
  out = out.replace(/^([^,]+), (.*) kartının rengini (.*) olarak değiştirdi\.$/, (m, name, cardName, color) => {
    return `${name} changed color of ${translateCardNameInStr(cardName, profile)} to ${translateColorLabelInStr(color, profile)}.`;
  });

  // Emojis and other chat messages
  out = out.replace(/^Rakibe "(.*)" ifadesini gönderdi!$/, 'Sent emoji "$1" to opponent!');
  out = out.replace(/^Sakin ol şampiyon, sadece bir oyun!$/, "Easy champion, it's just a game!");
  out = out.replace(/^Hahaha, çok eğlenceli!$/, 'Hahaha, so fun!');
  out = out.replace(/^Ağlama bebeğim, şansın dönecektir!$/, "Don't cry baby, your luck will turn!");
  out = out.replace(/^Güzel bir anlaşmaya her zaman varım!$/, 'Always open to a good deal!');
  out = out.replace(/^Buralarda paranın sözü geçmez!$/, "Money doesn't talk around here!");
  out = out.replace(/^Masa yanıyor! 🔥$/, 'The board is on fire! 🔥');

  if (out === 'Oyuncu bağlantısı koptu, yapay zeka devraldı.') {
    return 'Player disconnected, AI took over.';
  }
  return out;
};

const getTranslatedCardName = (card: any, profile: UserProfile): string => {
  if (!card) return '';
  if (card.type === 'money') {
    return `${card.value}M`;
  }
  const cleanName = card.name.toLowerCase().replace(/'/g, '').replace(/ /g, '_');
  const key = `card_${cleanName}_name`;
  const val = t(key, profile);
  if (val !== key) return val;

  const cleanNameForProp = cleanName
    .replace(/_avenue/g, '_ave')
    .replace(/_place/g, '_pl')
    .replace(/_gardens/g, '_gardens');
  const propKey = `prop_${cleanNameForProp}`;
  const propVal = t(propKey, profile);
  if (propVal !== propKey) return propVal;

  return TURKISH_NAMES[card.name] || card.name;
};

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

const getTranslatedCardDesc = (card: any, profile: UserProfile): string => {
  if (!card) return '';
  if (card.type === 'money') {
    return t('card_money_desc', profile, card.value);
  }
  const cleanName = card.name.toLowerCase().replace(/'/g, '').replace(/ /g, '_');
  const key = `card_${cleanName}_desc`;
  const val = t(key, profile);
  if (val !== key) return val;
  return card.description;
};

const getTranslatedColorLabel = (col: string, profile: UserProfile): string => {
  let cleanCol = col === 'lightblue' ? 'sky_blue' : col;
  if (cleanCol === 'railroad') cleanCol = 'station';
  if (cleanCol === 'darkblue') cleanCol = 'blue';
  const key = `color_${cleanCol}`;
  const val = t(key, profile);
  if (val !== key) return val;
  return COLOR_LABELS[col as CardColor] || col;
};

const getBankBreakdown = (bankCards: Card[]) => {
  const counts: Record<number, number> = {};
  bankCards.forEach((c) => {
    counts[c.value] = (counts[c.value] || 0) + 1;
  });
  return Object.keys(counts)
    .map((k) => Number(k))
    .sort((a, b) => b - a)
    .map((value) => ({
      value,
      count: counts[value],
    }));
};

const calculateSetRent = (cards: Card[], color: CardColor, hasHouse: boolean, hasHotel: boolean) => {
  if (cards.length === 0) return 0;
  const count = cards.length;
  const rents = RENT_VALUES[color] || [];
  let baseRent = rents[Math.min(count - 1, rents.length - 1)] || 0;
  if (hasHouse) baseRent += 3;
  if (hasHotel) baseRent += 4;
  return baseRent;
};

const countCompletedSets = (properties: any): number => {
  let count = 0;
  if (!properties) return 0;
  for (const colorKey in properties) {
    const col = colorKey as CardColor;
    const set = properties[col];
    if (set && set.cards && set.cards.length > 0) {
      const required = MAX_IN_SET[col];
      if (required && set.cards.length >= required) {
        count++;
      }
    }
  }
  return count;
};

const isCardMultiColorWildcard = (card: Card): boolean => {
  if (!card) return false;
  const isWild = card.isWildcard || card.type === 'wildcard';
  if (!isWild) return false;
  if (card.allowedColors && card.allowedColors.length > 2) return true;
  if (!card.secondaryColor || (card.secondaryColor as string) === 'any') {
    if (!card.allowedColors || card.allowedColors.length > 2) return true;
  }
  return false;
};

const isWildcardOrDualColorCard = (card: Card): boolean => {
  if (!card) return false;
  if (card.isWildcard || card.type === 'wildcard') return true;
  if (card.secondaryColor && (card.secondaryColor as string) !== 'any') return true;
  if (card.allowedColors && card.allowedColors.length > 1) return true;
  return false;
};

const getCardDualColors = (card: Card, fallbackColor?: CardColor): [CardColor, CardColor] | null => {
  if (!card) return null;
  const isWild = card.isWildcard || card.type === 'wildcard';
  if (card.allowedColors && card.allowedColors.length === 2) {
    return [card.allowedColors[0], card.allowedColors[1]];
  }
  if (card.secondaryColor && (card.secondaryColor as string) !== 'any') {
    const c1 = card.color || fallbackColor || 'brown';
    const c2 = card.secondaryColor;
    if (c1 !== c2) return [c1, c2];
    if (card.allowedColors && card.allowedColors.length >= 2) {
      const other = card.allowedColors.find(ac => ac !== c1);
      if (other) return [c1, other];
    }
    return [c1, c2];
  }
  if (isWild && card.color && fallbackColor && card.color !== fallbackColor) {
    return [card.color, fallbackColor];
  }
  return null;
};

const renderCardColorIndicator = (card: Card, fallbackColor: CardColor) => {
  if (!card) {
    return (
      <span 
        className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/20 shadow-sm" 
        style={{ backgroundColor: COLOR_HEX[fallbackColor || 'brown'] }} 
      />
    );
  }
  if (isCardMultiColorWildcard(card)) {
    return (
      <span 
        className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/20 shadow-sm" 
        style={{ background: 'linear-gradient(135deg, #ef4444 0%, #f97316 20%, #eab308 40%, #22c55e 60%, #3b82f6 80%, #a855f7 100%)' }}
        title="Çok Renkli Joker 🌈"
      />
    );
  }
  const dual = getCardDualColors(card, fallbackColor);
  if (dual) {
    const [c1, c2] = dual;
    return (
      <span 
        className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/20 shadow-sm" 
        style={{ background: `linear-gradient(135deg, ${COLOR_HEX[c1]} 50%, ${COLOR_HEX[c2]} 50%)` }}
        title="Çift Renk Joker 🌓"
      />
    );
  }
  return (
    <span 
      className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/20 shadow-sm" 
      style={{ backgroundColor: COLOR_HEX[card.color || fallbackColor || 'brown'] }} 
    />
  );
};

const getCardHeaderStyle = (card: Card, fallbackColor: CardColor): React.CSSProperties => {
  if (!card) {
    return { backgroundColor: COLOR_HEX[fallbackColor || 'brown'] };
  }
  if (isCardMultiColorWildcard(card)) {
    return {
      background: 'linear-gradient(135deg, #ef4444 0%, #f97316 20%, #eab308 40%, #22c55e 60%, #3b82f6 80%, #a855f7 100%)'
    };
  }
  const dual = getCardDualColors(card, fallbackColor);
  if (dual) {
    const [c1, c2] = dual;
    return {
      background: `linear-gradient(135deg, ${COLOR_HEX[c1]} 50%, ${COLOR_HEX[c2]} 50%)`
    };
  }
  return {
    backgroundColor: COLOR_HEX[card.color || fallbackColor || 'brown']
  };
};

const getCardSetExtraBadges = (card: Card, owner: GamePlayer) => {
  if (!card.color) return null;
  const set = owner.properties[card.color];
  if (!set) return null;
  
  const badges = [];
  if (set.hasHouse) {
    badges.push(
      <span key="house" className="text-[7.5px] font-black px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-0.5 shrink-0 select-none">
        🏠 EV
      </span>
    );
  }
  if (set.hasHotel) {
    badges.push(
      <span key="hotel" className="text-[7.5px] font-black px-1 py-0.2 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-0.5 shrink-0 select-none">
        🏨 OTEL
      </span>
    );
  }
  return badges.length > 0 ? <div className="flex gap-1 items-center shrink-0">{badges}</div> : null;
};

interface StolenCardFeedbackProps {
  x: number;
  y: number;
}

const StolenCardTapticFeedback: React.FC<StolenCardFeedbackProps> = ({ x, y }) => {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{
        scale: [0.8, 1.4, 0.95, 1.1, 1],
        x: [x, x - 5, x + 5, x - 3, x + 3, x],
        y: [y, y + 3, y - 3, y + 2, y - 2, y],
        opacity: [0, 1, 1, 1, 0]
      }}
      transition={{
        duration: 0.8,
        ease: "easeInOut"
      }}
      className="absolute pointer-events-none z-[999999] flex items-center justify-center"
      style={{ left: x - 40, top: y - 40, width: 80, height: 80 }}
    >
      <div className="absolute inset-0 rounded-full border-4 border-red-500/80 bg-red-600/20 shadow-[0_0_20px_rgba(239,68,68,0.6)] animate-ping" />
      <div className="absolute inset-2 rounded-full border-2 border-pink-400 bg-pink-500/10 flex items-center justify-center">
        <span className="text-xl">⚠️</span>
      </div>
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
        <motion.div
          key={i}
          initial={{ scale: 0.1, opacity: 0 }}
          animate={{
            x: Math.cos((angle * Math.PI) / 180) * 45,
            y: Math.sin((angle * Math.PI) / 180) * 45,
            scale: [0.1, 1, 0.2],
            opacity: [0, 1, 0]
          }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="absolute w-2.5 h-2.5 bg-rose-400 rounded-full"
        />
      ))}
    </motion.div>
  );
};

const CanvasBackground: React.FC<{ theme: string }> = ({ theme }) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const themeItem = findShopItem(theme);
  const isVideo = themeItem?.mediaUrl && isVideoUrl(themeItem.mediaUrl, themeItem.mediaType);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
      alpha: number;
      decay: number;
    }
    const baseColors: Record<string, string> = {
      theme_classic: '#0f172a',
      theme_slate: '#0f172a',
      theme_green: '#022c22',
      theme_purple: '#0f051d',
      theme_cyberpunk: '#020617',
      theme_lava: '#2a0202',
      theme_abyss: '#01040f',
      theme_gold: '#1e1103',
      theme_sakura: '#1c030d',
      theme_ice: '#07152e',
      theme_retro: '#14051a',
      theme_toxic: '#011c15',
      theme_matrix: '#011c08',
      theme_space: '#02020a',
      theme_desert: '#1f0d03',
      theme_atlantis: '#010d14',
      theme_volcano: '#180200',
      theme_snowstorm: '#0b1329',
    };

    const radialColors: Record<string, { start: string; end: string }> = {
      theme_classic: { start: 'rgba(30, 41, 59, 0.4)', end: 'rgba(7, 9, 15, 0.9)' },
      theme_slate: { start: 'rgba(30, 41, 59, 0.4)', end: 'rgba(7, 9, 15, 0.9)' },
      theme_green: { start: 'rgba(6, 78, 59, 0.35)', end: 'rgba(2, 15, 10, 0.9)' },
      theme_purple: { start: 'rgba(59, 7, 100, 0.4)', end: 'rgba(12, 3, 20, 0.9)' },
      theme_cyberpunk: { start: 'rgba(30, 27, 75, 0.3)', end: 'rgba(3, 7, 18, 0.9)' },
      theme_lava: { start: 'rgba(127, 29, 29, 0.45)', end: 'rgba(15, 3, 3, 0.9)' },
      theme_abyss: { start: 'rgba(15, 23, 42, 0.4)', end: 'rgba(2, 4, 12, 0.95)' },
      theme_gold: { start: 'rgba(120, 53, 15, 0.4)', end: 'rgba(15, 9, 2, 0.95)' },
      theme_sakura: { start: 'rgba(131, 24, 67, 0.35)', end: 'rgba(15, 3, 8, 0.95)' },
      theme_ice: { start: 'rgba(30, 64, 175, 0.35)', end: 'rgba(3, 10, 25, 0.95)' },
      theme_retro: { start: 'rgba(107, 33, 168, 0.35)', end: 'rgba(15, 3, 25, 0.95)' },
      theme_toxic: { start: 'rgba(6, 95, 70, 0.35)', end: 'rgba(2, 15, 10, 0.95)' },
      theme_matrix: { start: 'rgba(22, 101, 52, 0.35)', end: 'rgba(2, 15, 5, 0.95)' },
      theme_space: { start: 'rgba(49, 46, 129, 0.3)', end: 'rgba(2, 2, 8, 0.95)' },
      theme_desert: { start: 'rgba(124, 45, 18, 0.35)', end: 'rgba(15, 6, 2, 0.95)' },
      theme_atlantis: { start: 'rgba(0, 100, 160, 0.45)', end: 'rgba(1, 13, 20, 0.95)' },
      theme_volcano: { start: 'rgba(180, 30, 10, 0.45)', end: 'rgba(18, 2, 0, 0.95)' },
      theme_snowstorm: { start: 'rgba(147, 197, 253, 0.35)', end: 'rgba(7, 11, 23, 0.95)' },
    };

    const particles: Particle[] = [];
    const isMobileViewport = window.innerWidth < 768;
    const maxParticles = isMobileViewport
      ? 12
      : (theme === 'theme_gold' ? 60 : theme === 'theme_purple' ? 50 : theme === 'theme_cyberpunk' ? 70 : 40);

    const createParticle = (): Particle => {
      let pColor = 'rgba(234, 179, 8, '; // default golden
      let vxRange = 0.6, vyRange = 1.0, vyBase = 0.3;
      let pSizeMin = 1.5, pSizeRange = 3.5;
      let alphaMin = 0.3, alphaRange = 0.6;
      let decayMin = 0.001, decayRange = 0.0025;

      if (theme === 'theme_purple') {
        pColor = 'rgba(236, 72, 153, ';
        vyRange = 1.2; vyBase = 0.4;
      } else if (theme === 'theme_cyberpunk') {
        pColor = Math.random() > 0.5 ? 'rgba(99, 102, 241, ' : 'rgba(236, 72, 153, ';
        vxRange = 0.15; vyRange = 0.15; vyBase = -0.075;
      } else if (theme === 'theme_green') {
        pColor = 'rgba(52, 211, 153, ';
        vxRange = 0.3; vyRange = 0.3; vyBase = -0.15;
      } else if (theme === 'theme_lava') {
        pColor = Math.random() > 0.4 ? 'rgba(239, 68, 68, ' : 'rgba(245, 158, 11, ';
        vyRange = 1.4; vyBase = 0.5;
      } else if (theme === 'theme_abyss') {
        pColor = 'rgba(14, 165, 233, ';
        vyRange = 0.8; vyBase = 0.2;
      } else if (theme === 'theme_sakura') {
        pColor = 'rgba(244, 114, 182, ';
        vxRange = 0.8; vyRange = 0.9; vyBase = 0.3;
      } else if (theme === 'theme_ice') {
        pColor = 'rgba(186, 230, 253, ';
        vxRange = 0.4; vyRange = 0.8; vyBase = 0.2;
      } else if (theme === 'theme_retro') {
        pColor = Math.random() > 0.5 ? 'rgba(192, 132, 252, ' : 'rgba(244, 114, 182, ';
      } else if (theme === 'theme_toxic') {
        pColor = 'rgba(16, 185, 129, ';
      } else if (theme === 'theme_matrix') {
        pColor = 'rgba(34, 197, 94, ';
        vxRange = 0.1; vyRange = 1.8; vyBase = 0.6;
      } else if (theme === 'theme_space') {
        pColor = 'rgba(255, 255, 255, ';
        vxRange = 0.1; vyRange = 0.1; vyBase = -0.05;
      } else if (theme === 'theme_desert') {
        pColor = 'rgba(245, 158, 11, ';
        vxRange = 0.9; vyRange = 0.5; vyBase = 0.2;
      } else if (theme === 'theme_atlantis') {
        pColor = Math.random() > 0.6 ? 'rgba(56, 189, 248, ' : 'rgba(147, 197, 253, ';
        vxRange = 0.4; vyRange = 0.6; vyBase = -0.2; // rising bubbles
        pSizeMin = 1; pSizeRange = 2.5;
      } else if (theme === 'theme_volcano') {
        pColor = Math.random() > 0.5 ? 'rgba(239, 68, 68, ' : 'rgba(251, 146, 60, ';
        vxRange = 0.8; vyRange = 1.6; vyBase = 0.6; // falling embers
        pSizeMin = 1; pSizeRange = 3;
      } else if (theme === 'theme_snowstorm') {
        pColor = 'rgba(255, 255, 255, '; // white snowflakes
        vxRange = 1.8; vyRange = 2.4; vyBase = 1.0; // heavy falling snow with wind
        pSizeMin = 1.5; pSizeRange = 4.0;
      }

      const isSideways = theme === 'theme_cyberpunk' || theme === 'theme_green' || theme === 'theme_space';

      return {
        x: Math.random() * width,
        y: isSideways ? Math.random() * height : height + 10,
        vx: Math.random() * vxRange - (vxRange / 2),
        vy: isSideways ? (Math.random() * vyRange - (vyRange / 2)) : -(Math.random() * vyRange + vyBase),
        size: Math.random() * pSizeRange + pSizeMin,
        color: pColor,
        alpha: Math.random() * alphaRange + alphaMin,
        decay: Math.random() * decayRange + decayMin
      };
    };

    // Prepopulate
    for (let i = 0; i < maxParticles; i++) {
      const p = createParticle();
      p.y = Math.random() * height;
      particles.push(p);
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Only draw solid canvas background if no custom media URL is set
      if (!themeItem?.mediaUrl) {
        ctx.fillStyle = baseColors[theme] || '#0f172a';
        ctx.fillRect(0, 0, width, height);

        // Draw dynamic radial background
        const radGrad = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * 0.8);
        const rad = radialColors[theme] || { start: 'rgba(20, 30, 50, 0.3)', end: 'rgba(7, 9, 15, 0.9)' };
        radGrad.addColorStop(0, rad.start);
        radGrad.addColorStop(1, rad.end);
        ctx.fillStyle = radGrad;
        ctx.fillRect(0, 0, width, height);
      }

      // Update and draw particles
      particles.forEach((p, idx) => {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;

        if (p.alpha <= 0 || p.y < -10 || p.x < -10 || p.x > width + 10) {
          particles[idx] = createParticle();
        } else {
          ctx.beginPath();
          if (theme === 'theme_matrix') {
            // Drop falling binary digits
            ctx.fillStyle = `${p.color}${p.alpha})`;
            ctx.font = `${Math.round(p.size * 3 + 8)}px monospace`;
            const digit = Math.random() > 0.5 ? '1' : '0';
            ctx.fillText(digit, p.x, p.y);
          } else if (theme === 'theme_atlantis') {
            // 3D specular bubble
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(56, 189, 248, ${p.alpha * 0.8})`;
            ctx.lineWidth = 1;
            ctx.stroke();
            // bubble shine specular dot
            ctx.beginPath();
            ctx.arc(p.x - p.size * 0.3, p.y - p.size * 0.3, p.size * 0.25, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha * 0.55})`;
            ctx.fill();
          } else if (theme === 'theme_sakura') {
            // Rotating pink cherry blossom petal
            ctx.ellipse(p.x, p.y, p.size * 1.5, p.size * 0.8, Math.PI / 4 + p.alpha * 2, 0, Math.PI * 2);
            ctx.fillStyle = `${p.color}${p.alpha})`;
            ctx.fill();
          } else if (theme === 'theme_snowstorm' || theme === 'theme_ice') {
            // Intricate snowflake crosses
            ctx.strokeStyle = `rgba(255, 255, 255, ${p.alpha * 0.95})`;
            ctx.lineWidth = 1.1;
            const size = p.size * 1.6;
            ctx.moveTo(p.x - size, p.y); ctx.lineTo(p.x + size, p.y);
            ctx.moveTo(p.x, p.y - size); ctx.lineTo(p.x, p.y + size);
            ctx.moveTo(p.x - size * 0.7, p.y - size * 0.7); ctx.lineTo(p.x + size * 0.7, p.y + size * 0.7);
            ctx.moveTo(p.x - size * 0.7, p.y + size * 0.7); ctx.lineTo(p.x + size * 0.7, p.y - size * 0.7);
            ctx.stroke();
          } else if (theme === 'theme_cyberpunk') {
            // Futuristic glowing neon squares
            ctx.rect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
            ctx.fillStyle = `${p.color}${p.alpha})`;
            ctx.fill();
            // mini inner glow point
            ctx.beginPath();
            ctx.rect(p.x - p.size * 0.4, p.y - p.size * 0.4, p.size * 0.8, p.size * 0.8);
            ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha * 0.9})`;
            ctx.fill();
          } else if (theme === 'theme_retro') {
            // Atari pixel plus-stars
            ctx.rect(p.x - p.size, p.y - p.size * 0.3, p.size * 2, p.size * 0.6);
            ctx.rect(p.x - p.size * 0.3, p.y - p.size, p.size * 0.6, p.size * 2);
            ctx.fillStyle = `${p.color}${p.alpha})`;
            ctx.fill();
          } else if (theme === 'theme_space') {
            // Four-pointed twinkling star sparkle
            const s = p.size * 1.8;
            ctx.moveTo(p.x, p.y - s);
            ctx.quadraticCurveTo(p.x, p.y, p.x + s, p.y);
            ctx.quadraticCurveTo(p.x, p.y, p.x, p.y + s);
            ctx.quadraticCurveTo(p.x, p.y, p.x - s, p.y);
            ctx.quadraticCurveTo(p.x, p.y, p.x, p.y - s);
            ctx.fillStyle = `${p.color}${p.alpha * (0.3 + 0.7 * Math.abs(Math.sin(Date.now() / 450 + idx)))}`;
            ctx.fill();
          } else if (theme === 'theme_desert') {
            // Wind-swept sand grains
            ctx.ellipse(p.x, p.y, p.size * 1.8, p.size * 0.6, -Math.PI / 8, 0, Math.PI * 2);
            ctx.fillStyle = `${p.color}${p.alpha})`;
            ctx.fill();
          } else if (theme === 'theme_lava' || theme === 'theme_volcano') {
            // Flickering hot embers leaving a subtle shadow trail
            ctx.arc(p.x, p.y, p.size * 1.25, 0, Math.PI * 2);
            ctx.fillStyle = `${p.color}${p.alpha * (0.5 + 0.5 * Math.sin(Date.now() / 120 + idx))})`;
            ctx.fill();
          } else {
            // Classic smooth circular particle
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = `${p.color}${p.alpha})`;
            ctx.fill();
          }
        }
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [theme]);

  const overlayOpacity = themeItem?.overlayOpacity ?? 0.85;
  const overlayMode = themeItem?.overlayMode || 'normal';

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-slate-950">
      {themeItem?.mediaUrl && (
        isVideo ? (
          <HlsVideoPlayer
            src={themeItem.mediaUrl}
            style={{
              opacity: overlayOpacity,
              mixBlendMode: overlayMode as any
            }}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0"
          />
        ) : (
          <img
            src={themeItem.mediaUrl}
            alt="Board Theme"
            style={{
              opacity: overlayOpacity,
              mixBlendMode: overlayMode as any
            }}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0"
          />
        )
      )}
      <canvas ref={canvasRef} className="absolute inset-0 z-1 pointer-events-none w-full h-full" />
    </div>
  );
};

const FireworksCelebration: React.FC = () => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    interface Firework {
      x: number;
      y: number;
      targetY: number;
      color: string;
      speed: number;
      exploded: boolean;
      particles: Particle[];
    }

    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      color: string;
      alpha: number;
      decay: number;
    }

    const fireworks: Firework[] = [];
    const colors = ['#ec4899', '#3b82f6', '#10b981', '#fbbf24', '#a855f7', '#f43f5e'];

    const createFirework = (): Firework => {
      const x = Math.random() * width;
      const y = height + 10;
      const targetY = Math.random() * (height * 0.4) + 60;
      const color = colors[Math.floor(Math.random() * colors.length)];
      return {
        x,
        y,
        targetY,
        color,
        speed: Math.random() * 3 + 4,
        exploded: false,
        particles: []
      };
    };

    const explode = (firework: Firework) => {
      const isMobile = window.innerWidth < 768;
      const count = isMobile ? 18 : 35;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 4 + 2;
        firework.particles.push({
          x: firework.x,
          y: firework.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: firework.color,
          alpha: 1.0,
          decay: Math.random() * 0.02 + 0.015
        });
      }
    };

    let animationFrameId: number;

    const render = () => {
      ctx.fillStyle = 'rgba(7, 9, 15, 0.25)';
      ctx.fillRect(0, 0, width, height);

      const isMobile = window.innerWidth < 768;
      const spawnRate = isMobile ? 0.025 : 0.04;
      const maxFires = isMobile ? 3 : 6;

      if (Math.random() < spawnRate && fireworks.length < maxFires) {
        fireworks.push(createFirework());
      }

      fireworks.forEach((fw, fIdx) => {
        if (!fw.exploded) {
          fw.y -= fw.speed;
          ctx.beginPath();
          ctx.arc(fw.x, fw.y, 3, 0, Math.PI * 2);
          ctx.fillStyle = fw.color;
          ctx.fill();

          if (fw.y <= fw.targetY) {
            fw.exploded = true;
            explode(fw);
          }
        } else {
          fw.particles.forEach((p, pIdx) => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.04; // gravity
            p.alpha -= p.decay;

            ctx.beginPath();
            ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.alpha;
            ctx.fill();
            ctx.globalAlpha = 1.0;

            if (p.alpha <= 0) {
              fw.particles.splice(pIdx, 1);
            }
          });

          if (fw.particles.length === 0) {
            fireworks.splice(fIdx, 1);
          }
        }
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 z-0 pointer-events-none w-full h-full" />;
};

export const GameRoom: React.FC<Props> = ({ roomId, isOffline, profile, onLeaveRoom, onUpdateProfile, adminSettings, roomPassword }) => {
  const [match, setMatch] = React.useState<MatchState | null>(null);
  const matchRef = React.useRef<MatchState | null>(null);
  const botTimeoutRef = React.useRef<any>(null);
  React.useEffect(() => {
    matchRef.current = match;
  }, [match]);

  // Bot difficulty calculations (Improvement #20)
  const botDifficulty: 'easy' | 'medium' | 'hard' = React.useMemo(() => {
    if (roomId.includes('-easy-') || roomId.includes('practice-easy')) return 'easy';
    if (roomId.includes('-hard-') || roomId.includes('practice-hard')) return 'hard';
    return 'medium';
  }, [roomId]);

  const botDelay = botDifficulty === 'easy' ? 4500 : botDifficulty === 'hard' ? 3500 : 4000;
  const botPaymentDelay = botDifficulty === 'easy' ? 4500 : botDifficulty === 'hard' ? 3500 : 4000;
  const botFinishDelay = botDifficulty === 'easy' ? 3500 : botDifficulty === 'hard' ? 2500 : 3000;

  const [botIsThinking, setBotIsThinking] = React.useState(false);
  const [localSettings, setLocalSettings] = React.useState({
    targetSets: 3,
    turnLimit: 'unlimited',
    autoEndTurn: false,
    gameMode: 'classic',
  });

  const checkWinnerWithSettings = (properties: any) => {
    return checkWinner(properties, match?.settings?.targetSets || 3);
  };

  const [showShieldDefenseFor, setShowShieldDefenseFor] = React.useState<string | null>(null);
  const [showDealBreakerAnimation, setShowDealBreakerAnimation] = React.useState<{ source: string; target: string; color: CardColor } | null>(null);
  const disable3D = adminSettings ? adminSettings.enable3DCardFlip === false : false;

  const updateMatchState = (newMatch: MatchState | null) => {
    matchRef.current = newMatch;
    setMatch(newMatch);
  };
  const [selectedCard, setSelectedCard] = React.useState<Card | null>(null);
  const [showCardMenu, setShowCardMenu] = React.useState(false);
  const [wildcardColorPick, setWildcardColorPick] = React.useState<Card | null>(null);
  const [propertyWildcardColorPick, setPropertyWildcardColorPick] = React.useState<Card | null>(null);
  const [draggingCard, setDraggingCard] = React.useState<Card | null>(null);
  const [isDragOverBank, setIsDragOverBank] = React.useState(false);
  const [isDragOverProperties, setIsDragOverProperties] = React.useState(false);
  const [rentColorPick, setRentColorPick] = React.useState<Card | null>(null);
  const [rentTargetSelect, setRentTargetSelect] = React.useState<{ card: Card; color: CardColor; payload?: any } | null>(null);
  const [paymentSelection, setPaymentSelection] = React.useState<string[]>([]);
  const [floatingEmojis, setFloatingEmojis] = React.useState<{ id: number; emoji: string; username: string; x: number }[]>([]);
  const [flyingCoins, setFlyingCoins] = React.useState<{ id: number; delay: number; x: number; y: number }[]>([]);
  const [buildSmoke, setBuildSmoke] = React.useState<{ id: number; x: number; y: number }[]>([]);

  // Custom visual transaction and flow animation states
  const [activeMoneyFlow, setActiveMoneyFlow] = React.useState<{
    id: string;
    sourceName: string;
    targetName: string;
    amount: string;
    type: 'bank' | 'player';
  } | null>(null);

  const [activeCardFlow, setActiveCardFlow] = React.useState<{
    id: string;
    sourceName: string;
    targetName: string;
    cardName: string;
    type: 'sly' | 'forced_deal' | 'deal_breaker' | 'rent' | 'general' | 'debt';
    cardNameGiver?: string;
  } | null>(null);

  // 🚀 Premium physical board-to-board flying animation state
  const [boardFlows, setBoardFlows] = React.useState<{
    id: string;
    type: 'money' | 'card' | 'forced_deal';
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    amount?: string;
    cardName?: string;
    cardColor?: CardColor;
    cardNameGiver?: string;
    cardColorGiver?: CardColor;
    subType?: 'sly' | 'forced_deal' | 'deal_breaker' | 'rent' | 'debt' | 'bank_deposit';
    sourceName?: string;
    targetName?: string;
  }[]>([]);

  // 🎭 Dynamic player visual status overlay glows & floating state triggers
  const [playerVisualStates, setPlayerVisualStates] = React.useState<Record<string, {
    type: 'money_gain' | 'card_gain' | 'card_loss' | 'deal_breaker_target';
    timestamp: number;
  } | null>>({});

  const triggerPlayerVisualState = (playerId: string, type: 'money_gain' | 'card_gain' | 'card_loss' | 'deal_breaker_target') => {
    setPlayerVisualStates((prev) => ({
      ...prev,
      [playerId]: { type, timestamp: Date.now() }
    }));
    setTimeout(() => {
      setPlayerVisualStates((prev) => {
        if (prev[playerId]?.timestamp && Date.now() - prev[playerId]!.timestamp >= 2400) {
          return { ...prev, [playerId]: null };
        }
        return prev;
      });
    }, 2500);
  };

  const [activeStealFeedbacks, setActiveStealFeedbacks] = React.useState<{ id: string; x: number; y: number }[]>([]);

  const triggerStealFeedback = React.useCallback((x: number, y: number) => {
    const id = `steal-${Date.now()}-${Math.random()}`;
    setActiveStealFeedbacks((prev) => [...prev, { id, x, y }]);
    setTimeout(() => {
      setActiveStealFeedbacks((prev) => prev.filter((f) => f.id !== id));
    }, 1000);
  }, []);

  const [glowingProperties, setGlowingProperties] = React.useState<Record<string, boolean>>({});
  const [discardGlow, setDiscardGlow] = React.useState(false);
  const [drawDeckBurst, setDrawDeckBurst] = React.useState(false);

  const prevDeckCountRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (!match) return;
    if (prevDeckCountRef.current !== null && match.deckCount < prevDeckCountRef.current) {
      setDrawDeckBurst(true);
      setTimeout(() => setDrawDeckBurst(false), 1500);
    }
    prevDeckCountRef.current = match.deckCount;
  }, [match?.deckCount]);

  const propertyGlowTimeoutsRef = React.useRef<Record<string, NodeJS.Timeout>>({});

  const triggerPropertyGlow = React.useCallback((color: CardColor, playerId: string) => {
    const key = `${color}-${playerId}`;
    if (propertyGlowTimeoutsRef.current[key]) {
      clearTimeout(propertyGlowTimeoutsRef.current[key]);
    }
    setGlowingProperties((prev) => ({ ...prev, [key]: true }));
    propertyGlowTimeoutsRef.current[key] = setTimeout(() => {
      setGlowingProperties((prev) => ({ ...prev, [key]: false }));
      delete propertyGlowTimeoutsRef.current[key];
    }, 2200);
  }, []);

  // ⚡ Centralized High-Impact Sequential Animation & Screen Shake State
  const [isHighImpactShaking, setIsHighImpactShaking] = React.useState(false);
  const [activeHighImpactCard, setActiveHighImpactCard] = React.useState<{
    type: 'deal_breaker' | 'sly_deal' | 'forced_deal' | 'debt_collector';
    actorId?: string;
    victimId?: string;
  } | null>(null);

  const triggerHighImpactSequence = React.useCallback((
    type: 'deal_breaker' | 'sly_deal' | 'forced_deal' | 'debt_collector',
    actorId?: string,
    victimId?: string
  ) => {
    // Phase 1: Card Play starts, record active impact card for specialized glows/overlays
    setActiveHighImpactCard({ type, actorId, victimId });
    triggerTapticFeedback();
    
    // Play custom visual status triggers on players
    if (actorId) {
      triggerPlayerVisualState(actorId, 'card_gain');
    }
    if (victimId) {
      triggerPlayerVisualState(victimId, type === 'deal_breaker' ? 'deal_breaker_target' : 'card_loss');
    }

    // Phase 2: After a brief delay (representing the card reaching mid-flight), trigger screen shake
    setTimeout(() => {
      setIsHighImpactShaking(true);
      
      // Phase 3: Trigger high-impact sound effect based on card type
      if (sounds && profile.settings) {
        if (type === 'deal_breaker') {
          if (sounds.playSteal) sounds.playSteal(profile.settings);
          if (sounds.playAction) sounds.playAction(profile.settings);
        } else if (type === 'sly_deal') {
          if (sounds.playSteal) sounds.playSteal(profile.settings);
        } else {
          if (sounds.playAction) sounds.playAction(profile.settings);
        }
      }
      
      // Stop the shake after 800ms
      setTimeout(() => {
        setIsHighImpactShaking(false);
      }, 800);

    }, 600); // 600ms mid-flight delay

    // Reset high impact card state after sequence completes (2.5 seconds total)
    setTimeout(() => {
      setActiveHighImpactCard(null);
    }, 2500);
  }, [profile.settings]);

  // 📳 Taptic Feedback (Kenar Titreşimi / Parlama Görsel Geri Bildirimi)
  const [tapticFeedbackActive, setTapticFeedbackActive] = React.useState(false);

  const triggerTapticFeedback = React.useCallback(() => {
    setTapticFeedbackActive(true);
    triggerHaptic('medium');
    setTimeout(() => {
      setTapticFeedbackActive(false);
    }, 700);
  }, []);


  // 🛡️ Centralized VFX Manager to handle clean, target-specific visual animations and flows
  const VFXManager = React.useMemo(() => {
    return {
      shouldTriggerVFX: (message: string, actor: any, victim: any): boolean => {
        if (!profile || !match) return false;
        const lowercaseMessage = message.toLowerCase();
        const myUsername = profile.username.toLowerCase();

        // 1. Strict whole-word matching of username to prevent substring false positives
        const isMeMentioned = () => {
          const esc = myUsername.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          const regex = new RegExp(`(?:^|\\s|[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ])${esc}(?:$|\\s|[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ]|')`, 'i');
          return regex.test(lowercaseMessage);
        };

        if (isMeMentioned()) return true;

        // 2. Direct ID verification of actor or victim against local player
        if (actor && actor.id === profile.id) return true;
        if (victim && victim.id === profile.id) return true;

        // 3. Global actions affecting all players (rent collection, birthday)
        const isGlobalAction = 
          lowercaseMessage.includes('herkesten') || 
          lowercaseMessage.includes('herkes') || 
          lowercaseMessage.includes('doğum günü') || 
          lowercaseMessage.includes('birthday') || 
          lowercaseMessage.includes('tüm oyunculardan') ||
          lowercaseMessage.includes('tüm oyuncular');

        if (isGlobalAction) return true;

        // 4. Bank deposits only concern the active player whose turn it is
        const isBankDeposit = 
          lowercaseMessage.includes('banka') || 
          lowercaseMessage.includes('kasasına') || 
          lowercaseMessage.includes('bankaya') ||
          lowercaseMessage.includes('bank-deposit');

        if (isBankDeposit) {
          const turnOwner = match.players[match.turnIndex];
          if (turnOwner && turnOwner.id === profile.id) {
            return true;
          }
        }

        return false;
      }
    };
  }, [profile, match]);

  const lastProcessedLogIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!match || !match.logs || match.logs.length === 0) return;
    const lastLog = match.logs[match.logs.length - 1];
    if (lastProcessedLogIdRef.current === lastLog.id) return;
    lastProcessedLogIdRef.current = lastLog.id;

    const message = lastLog.message;
    const lowercaseMessage = message.toLowerCase();

    // Helper: Find players mentioned in the log to resolve IDs and anchor positions
    const findPlayers = () => {
      if (!match || !match.players) return { actor: null, victim: null };
      const found = match.players.filter((p) =>
        lowercaseMessage.includes(p.username.toLowerCase())
      );
      // Sort by appearance in message text
      found.sort((a, b) => {
        return lowercaseMessage.indexOf(a.username.toLowerCase()) - lowercaseMessage.indexOf(b.username.toLowerCase());
      });
      return {
        actor: found[0] || null,
        victim: found[1] || null
      };
    };

    // Helper: Find card colors based on Turkish or English terms
    const findCardColor = (txt: string): CardColor | undefined => {
      const lower = txt.toLowerCase();
      for (const [colorKey, colorLabel] of Object.entries(COLOR_LABELS)) {
        if (lower.includes(colorLabel.toLowerCase())) {
          return colorKey as CardColor;
        }
      }
      return undefined;
    };

    // Helper: Get absolute viewport coordinates for any DOM ID with bulletproof fallbacks
    const getCoords = (elementId: string, fallbackType: 'top_carousel' | 'bottom_player' | 'center_table' | 'bank_drop'): { x: number; y: number } => {
      const el = document.getElementById(elementId);
      if (el) {
        const rect = el.getBoundingClientRect();
        return {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2
        };
      }

      // Safe fallbacks if elements are not fully rendered or offscreen
      if (fallbackType === 'top_carousel') {
        const pId = elementId.replace('player-card-', '');
        const idx = match ? match.players.findIndex(p => p.id === pId) : -1;
        if (idx !== -1 && match) {
          const ratio = (idx + 0.5) / match.players.length;
          return { x: ratio * window.innerWidth, y: 100 };
        }
        return { x: window.innerWidth / 2, y: 100 };
      }

      if (fallbackType === 'bottom_player') {
        return { x: window.innerWidth / 2, y: window.innerHeight - 140 };
      }

      if (fallbackType === 'bank_drop') {
        const bankEl = document.getElementById('bank-drop-zone');
        if (bankEl) {
          const rect = bankEl.getBoundingClientRect();
          return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        }
        return { x: window.innerWidth * 0.25, y: window.innerHeight * 0.75 };
      }

      // Default: Center table
      return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    };

    // Wait 80ms for the DOM state to complete updating before looking up client positions
    setTimeout(() => {
      const { actor, victim } = findPlayers();

      const involved = VFXManager.shouldTriggerVFX(message, actor, victim);

      // Trigger glowing border when a property is successfully placed or a move is made
      if (lowercaseMessage.includes('yerleştirdi') || lowercaseMessage.includes('placed') || lowercaseMessage.includes('grubuna')) {
        const colGroup = findCardColor(message);
        if (actor && colGroup) {
          triggerPropertyGlow(colGroup, actor.id);
        }
      }

      // 1. Bank Deposit Detection
      if (lowercaseMessage.includes('banka kasasına') || lowercaseMessage.includes('bankaya') || lowercaseMessage.includes('kasasına') || lowercaseMessage.includes('bank-deposit')) {
        let playerName = actor ? actor.username : 'Oyuncu';
        let amount = '1M';

        const valMatch = message.match(/(\d+M)/);
        if (valMatch) amount = valMatch[1];

        // Bank deposit overlay animation removed by request
        
        // Trigger board-to-board physics coin flight
        const actorId = actor ? actor.id : (match.players[match.turnIndex]?.id || '');
        const isActorMe = actorId === profile.id;
        const startAnchor = `player-card-${actorId}`;
        const start = getCoords(startAnchor, isActorMe ? 'bottom_player' : 'top_carousel');
        const end = getCoords('bank-drop-zone', 'bank_drop');

        // Play coin sound only if involved
        if (sounds.playCoin && involved) sounds.playCoin(profile.settings);

        if (actorId) {
          triggerPlayerVisualState(actorId, 'card_loss');
        }

        setBoardFlows((prev) => [
          ...prev,
          {
            id: `flow-bank-${lastLog.id}`,
            type: 'money',
            startX: start.x,
            startY: start.y,
            endX: end.x,
            endY: end.y,
            amount,
            subType: 'bank_deposit',
            sourceName: playerName,
            targetName: '🏦 BANKA'
          }
        ]);

        setTimeout(() => {
          setBoardFlows((prev) => prev.filter(f => f.id !== `flow-bank-${lastLog.id}`));
        }, 4000);
      }

      // 2. Player-to-player Payment Detection
      else if (
        lowercaseMessage.includes('ödeme yaptı') ||
        lowercaseMessage.includes('ödedi') ||
        lowercaseMessage.includes('ödüyor') ||
        lowercaseMessage.includes('borç ödedi')
      ) {
        let sourceName = victim ? victim.username : 'Ödeyen';
        let targetName = actor ? actor.username : 'Alan';
        let amount = '2M';

        const valMatch = message.match(/(\d+M)/);
        if (valMatch) amount = valMatch[1];

        if (involved) {
          setActiveMoneyFlow({
            id: lastLog.id,
            sourceName,
            targetName,
            amount,
            type: 'player'
          });
        }

        // Trigger board-to-board physics coin flight: victim pays actor
        const payerId = victim ? victim.id : '';
        const receiverId = actor ? actor.id : '';
        
        if (payerId && receiverId) {
          const isPayerMe = payerId === profile.id;
          const isReceiverMe = receiverId === profile.id;
          
          const start = getCoords(`player-card-${payerId}`, isPayerMe ? 'bottom_player' : 'top_carousel');
          const end = getCoords(`player-card-${receiverId}`, isReceiverMe ? 'bottom_player' : 'top_carousel');

          if (sounds.playCoin && involved) sounds.playCoin(profile.settings);

          triggerPlayerVisualState(payerId, 'card_loss');
          triggerPlayerVisualState(receiverId, 'money_gain');

          setBoardFlows((prev) => [
            ...prev,
            {
              id: `flow-pay-${lastLog.id}`,
              type: 'money',
              startX: start.x,
              startY: start.y,
              endX: end.x,
              endY: end.y,
              amount,
              subType: 'rent',
              sourceName,
              targetName
            }
          ]);

          setTimeout(() => {
            setBoardFlows((prev) => prev.filter(f => f.id !== `flow-pay-${lastLog.id}`));
          }, 4000);
        }

        if (involved) {
          setTimeout(() => setActiveMoneyFlow(null), 3000);
        }
      }

      // 3. Sly Deal / Sinsi Anlaşma
      else if (lowercaseMessage.includes('sinsi anlaşma') || lowercaseMessage.includes('sinsi')) {
        let sourceName = victim ? victim.username : 'Rakip';
        let targetName = actor ? actor.username : 'Sinsi Oyuncu';
        let cardName = 'Mülk Kartı';

        const stolenMatch = message.match(/'den\s+([^\s]+)\s+mülkünü/i) || message.match(/([^\s]+)\s+mülkünü\s+sinsi/i);
        if (stolenMatch) cardName = stolenMatch[1];

        if (involved) {
          setActiveCardFlow({
            id: lastLog.id,
            sourceName,
            targetName,
            cardName,
            type: 'sly'
          });
        }

        // Trigger board-to-board card flight: flies from victim (source) to actor (target)
        const victimId = victim ? victim.id : '';
        const actorId = actor ? actor.id : '';

        if (victimId && actorId) {
          const isVictimMe = victimId === profile.id;
          const isActorMe = actorId === profile.id;

          const start = getCoords(`player-card-${victimId}`, isVictimMe ? 'bottom_player' : 'top_carousel');
          const end = getCoords(`player-card-${actorId}`, isActorMe ? 'bottom_player' : 'top_carousel');
          const cardCol = findCardColor(message);

          if (involved) {
            triggerHighImpactSequence('sly_deal', actorId, victimId);
          } else {
            triggerPlayerVisualState(victimId, 'card_loss');
            triggerPlayerVisualState(actorId, 'card_gain');
          }

          triggerStealFeedback(start.x, start.y);

          setBoardFlows((prev) => [
            ...prev,
            {
              id: `flow-card-${lastLog.id}`,
              type: 'card',
              startX: start.x,
              startY: start.y,
              endX: end.x,
              endY: end.y,
              cardName,
              cardColor: cardCol,
              subType: 'sly',
              sourceName,
              targetName
            }
          ]);

          setTimeout(() => {
            setBoardFlows((prev) => prev.filter(f => f.id !== `flow-card-${lastLog.id}`));
          }, 4000);
        }

        if (involved) {
          setTimeout(() => setActiveCardFlow(null), 3500);
        }
      }

      // 4. Forced Deal / Zoraki Takas / Zorunlu Takas
      else if (lowercaseMessage.includes('zoraki takas') || lowercaseMessage.includes('takas etti') || lowercaseMessage.includes('takas')) {
        let sourceName = victim ? victim.username : 'Rakip';
        let targetName = actor ? actor.username : 'Oyuncu';
        let cardName = 'Alınan Kart';
        let cardNameGiver = 'Verilen Kart';

        const remainder = message.split(" ile ")[1] || '';
        const karşılıkMatch = remainder.match(/(.+)\s+karşılığında\s+(.+)\s+kartını/) || remainder.match(/(.+)\s+karşılığında\s+(.+)\s+mülkünü/);
        if (karşılıkMatch) {
          cardName = karşılıkMatch[1].trim();
          cardNameGiver = karşılıkMatch[2].trim();
        }

        if (involved) {
          setActiveCardFlow({
            id: lastLog.id,
            sourceName,
            targetName,
            cardName,
            type: 'forced_deal',
            cardNameGiver
          });
        }

        // Trigger board-to-board double flying cards for Forced Deal!
        const victimId = victim ? victim.id : '';
        const actorId = actor ? actor.id : '';

        if (victimId && actorId) {
          const isVictimMe = victimId === profile.id;
          const isActorMe = actorId === profile.id;

          const start = getCoords(`player-card-${victimId}`, isVictimMe ? 'bottom_player' : 'top_carousel');
          const end = getCoords(`player-card-${actorId}`, isActorMe ? 'bottom_player' : 'top_carousel');
          
          const colA = findCardColor(cardName);
          const colB = findCardColor(cardNameGiver);

          if (involved) {
            triggerHighImpactSequence('forced_deal', actorId, victimId);
          } else {
            triggerPlayerVisualState(victimId, 'card_gain');
            triggerPlayerVisualState(actorId, 'card_gain');
          }

          setBoardFlows((prev) => [
            ...prev,
            {
              id: `flow-swap-${lastLog.id}`,
              type: 'forced_deal',
              startX: start.x,
              startY: start.y,
              endX: end.x,
              endY: end.y,
              cardName,
              cardColor: colA,
              cardNameGiver,
              cardColorGiver: colB,
              subType: 'forced_deal',
              sourceName,
              targetName
            }
          ]);

          setTimeout(() => {
            setBoardFlows((prev) => prev.filter(f => f.id !== `flow-swap-${lastLog.id}`));
          }, 4500);
        }

        if (involved) {
          setTimeout(() => setActiveCardFlow(null), 4000);
        }
      }

      // 5. Deal Breaker / Anlaşma Bozan
      else if (lowercaseMessage.includes('anlaşma bozan') || lowercaseMessage.includes('setini çaldı') || lowercaseMessage.includes('set çaldı')) {
        let sourceName = victim ? victim.username : 'Rakip';
        let targetName = actor ? actor.username : 'Anlaşma Bozan';
        let cardName = 'Tamamlanmış Mülk Seti 🏆';

        const colMatch = findCardColor(message);
        if (colMatch && COLOR_LABELS[colMatch]) {
          cardName = `Tamamlanmış ${COLOR_LABELS[colMatch]} Seti 🏆`;
        }

        if (involved) {
          setActiveCardFlow({
            id: lastLog.id,
            sourceName,
            targetName,
            cardName,
            type: 'deal_breaker'
          });
        }

        // Trigger board-to-board set flight
        const victimId = victim ? victim.id : '';
        const actorId = actor ? actor.id : '';

        if (victimId && actorId) {
          const isVictimMe = victimId === profile.id;
          const isActorMe = actorId === profile.id;

          const start = getCoords(`player-card-${victimId}`, isVictimMe ? 'bottom_player' : 'top_carousel');
          const end = getCoords(`player-card-${actorId}`, isActorMe ? 'bottom_player' : 'top_carousel');

          if (involved) {
            triggerHighImpactSequence('deal_breaker', actorId, victimId);
          } else {
            triggerPlayerVisualState(victimId, 'deal_breaker_target');
            triggerPlayerVisualState(actorId, 'card_gain');
          }

          triggerStealFeedback(start.x, start.y);

          setBoardFlows((prev) => [
            ...prev,
            {
              id: `flow-db-${lastLog.id}`,
              type: 'card',
              startX: start.x,
              startY: start.y,
              endX: end.x,
              endY: end.y,
              cardName,
              cardColor: colMatch,
              subType: 'deal_breaker',
              sourceName,
              targetName
            }
          ]);

          setTimeout(() => {
            setBoardFlows((prev) => prev.filter(f => f.id !== `flow-db-${lastLog.id}`));
          }, 4500);
        }

        if (involved) {
          setTimeout(() => setActiveCardFlow(null), 4000);
        }
      }

      // 6. Debt Collector / Haciz / Borç Tahsilatı
      else if (lowercaseMessage.includes('borç tahsilatı') || lowercaseMessage.includes('haciz') || lowercaseMessage.includes('borç')) {
        let sourceName = victim ? victim.username : 'Borçlu';
        let targetName = actor ? actor.username : 'Alacaklı';

        if (involved) {
          setActiveCardFlow({
            id: lastLog.id,
            sourceName,
            targetName,
            cardName: 'Borç / Kira Ödemesi',
            type: 'debt'
          });
        }

        // Trigger board-to-board money flight as debt response
        const victimId = victim ? victim.id : '';
        const actorId = actor ? actor.id : '';

        if (victimId && actorId) {
          const isVictimMe = victimId === profile.id;
          const isActorMe = actorId === profile.id;

          const start = getCoords(`player-card-${victimId}`, isVictimMe ? 'bottom_player' : 'top_carousel');
          const end = getCoords(`player-card-${actorId}`, isActorMe ? 'bottom_player' : 'top_carousel');

          if (involved) {
            triggerHighImpactSequence('debt_collector', actorId, victimId);
          } else {
            triggerPlayerVisualState(victimId, 'card_loss');
            triggerPlayerVisualState(actorId, 'money_gain');
          }

          setBoardFlows((prev) => [
            ...prev,
            {
              id: `flow-debt-${lastLog.id}`,
              type: 'money',
              startX: start.x,
              startY: start.y,
              endX: end.x,
              endY: end.y,
              amount: '2M',
              subType: 'debt',
              sourceName,
              targetName
            }
          ]);

          setTimeout(() => {
            setBoardFlows((prev) => prev.filter(f => f.id !== `flow-debt-${lastLog.id}`));
          }, 4000);
        }

        if (involved) {
          setTimeout(() => setActiveCardFlow(null), 3500);
        }
      }
    }, 80);

  }, [match?.logs?.length]);

  const triggerCoinFlyingEffect = React.useCallback(() => {
    if (adminSettings && adminSettings.enableCoinFlyEffect === false) return;

    const count = 12;
    const newCoins = Array.from({ length: count }).map((_, idx) => ({
      id: Date.now() + idx + Math.random(),
      delay: idx * 0.1,
      x: Math.random() * 60 + 20,
      y: Math.random() * 20 + 10
    }));
    setFlyingCoins((prev) => [...prev, ...newCoins]);
    setTimeout(() => {
      setFlyingCoins((prev) => prev.filter((c) => !newCoins.find((nc) => nc.id === c.id)));
    }, 2500);
  }, [adminSettings]);

  const triggerBuildSmoke = React.useCallback(() => {
    if (adminSettings && adminSettings.enableBuildingSmoke === false) return;

    const id = Date.now() + Math.random();
    setBuildSmoke((prev) => [...prev, { id, x: 50, y: 50 }]);
    setTimeout(() => {
      setBuildSmoke((prev) => prev.filter((s) => s.id !== id));
    }, 1500);
  }, [adminSettings]);

  const triggerFloatingEmoji = React.useCallback((emoji: string, username: string) => {
    if (adminSettings && adminSettings.enableFloatingEmojis === false) return;

    const id = Date.now() + Math.random();
    const x = Math.random() * 80 + 10;
    setFloatingEmojis((prev) => [...prev, { id, emoji, username, x }]);
    setTimeout(() => {
      setFloatingEmojis((prev) => prev.filter((item) => item.id !== id));
    }, 3000);
  }, [adminSettings]);

  const calculateLocalChecksum = React.useCallback((m: MatchState): string => {
    let sum = 0;
    m.players.forEach((p) => {
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
  }, []);

  const [voiceMuted, setVoiceMuted] = React.useState(false);
  const [isMusicPlaying, setIsMusicPlaying] = React.useState(() => {
    const saved = localStorage.getItem('bgm_enabled');
    return saved === 'true';
  });
  const [showSettingsDropdown, setShowSettingsDropdown] = React.useState(false);
  const [voiceoversMuted, setVoiceoversMuted] = React.useState(() => {
    const saved = localStorage.getItem('voiceovers_muted');
    return saved === 'true';
  });
  const [showcaseAnimationsEnabled, setShowcaseAnimationsEnabled] = React.useState(() => {
    const saved = localStorage.getItem('showcase_animations_enabled');
    return saved !== 'false'; // Defaults to true
  });
  const [speakingList, setSpeakingList] = React.useState<string[]>([]);
  const [customAlert, setCustomAlert] = React.useState<{ message: string; title: string } | null>(null);

  const alert = React.useCallback((message: string, title: string = 'Deal Master PRO') => {
    setCustomAlert({ message, title });
    try {
      sounds.playAlert(profile.settings);
    } catch (e) { }
  }, [profile.settings]);

  // Interaction targets
  const [pendingSlyDeal, setPendingSlyDeal] = React.useState<Card | null>(null);

  // Step-by-step Action target selector states
  const [activeActionCard, setActiveActionCard] = React.useState<Card | null>(null);
  const [selectedOpponentId, setSelectedOpponentId] = React.useState<string | null>(null);
  const [selectedStolenCardId, setSelectedStolenCardId] = React.useState<string | null>(null);
  const [selectedStolenColor, setSelectedStolenColor] = React.useState<CardColor | null>(null);
  const [selectedMyCardId, setSelectedMyCardId] = React.useState<string | null>(null);

  // Tracking target selection stage for action cards
  const [actionSelectionState, setActionSelectionState] = React.useState<'idle' | 'selecting_opponent' | 'selecting_asset' | 'completed'>('idle');

  React.useEffect(() => {
    if (!activeActionCard) {
      setSelectedOpponentId(null);
      setSelectedStolenCardId(null);
      setSelectedStolenColor(null);
      setSelectedMyCardId(null);
      setActionSelectionState('idle');
    } else {
      if (!selectedOpponentId) {
        setActionSelectionState('selecting_opponent');
      } else {
        const type = activeActionCard.actionType;
        const needsAsset = ['sly-deal', 'deal-breaker', 'forced-deal'].includes(type || '');
        if (needsAsset) {
          if (type === 'forced-deal') {
            if (!selectedStolenCardId || !selectedMyCardId) {
              setActionSelectionState('selecting_asset');
            } else {
              setActionSelectionState('completed');
            }
          } else if (type === 'sly-deal') {
            if (!selectedStolenCardId) {
              setActionSelectionState('selecting_asset');
            } else {
              setActionSelectionState('completed');
            }
          } else if (type === 'deal-breaker') {
            if (!selectedStolenColor) {
              setActionSelectionState('selecting_asset');
            } else {
              setActionSelectionState('completed');
            }
          } else {
            setActionSelectionState('selecting_asset');
          }
        } else {
          setActionSelectionState('completed');
        }
      }
    }
  }, [activeActionCard, selectedOpponentId, selectedStolenCardId, selectedStolenColor, selectedMyCardId]);

  // Helper to check if selection is complete for a given card and payload
  const isActionSelectionComplete = (card: Card, payload?: any): boolean => {
    if (!card) return false;
    const type = card.actionType;
    if (!type) return true;

    if (type === 'debt-collector') {
      return !!payload?.targetPlayerId;
    }
    if (type === 'sly-deal') {
      return !!payload?.targetPlayerId && !!payload?.targetCardId;
    }
    if (type === 'deal-breaker') {
      return !!payload?.targetPlayerId && !!payload?.targetColor;
    }
    if (type === 'forced-deal') {
      return !!payload?.targetPlayerId && !!payload?.targetCardId && !!payload?.myCardId;
    }
    return true;
  };

  const hasActiveRequest = !!match?.activeActionRequest || (!!match?.activeActionRequests && match.activeActionRequests.length > 0);
  const isActionLocked = hasActiveRequest || !!activeActionCard;
  const [hoveredCard, setHoveredCard] = React.useState<Card | null>(null);
  const [mousePos, setMousePos] = React.useState({ x: 0, y: 0 });
  const [useDoubleRent, setUseDoubleRent] = React.useState(false);
  const [houseHotelColorPick, setHouseHotelColorPick] = React.useState<Card | null>(null);

  // Holographic card play animation overlay state
  const [playedCardAnimation, setPlayedCardAnimation] = React.useState<{
    card: Card;
    playerName: string;
  } | null>(null);

  const triggerPlayedCardAnimation = (card: Card, playerName: string) => {
    setPlayedCardAnimation({ card, playerName });
    setTimeout(() => {
      setPlayedCardAnimation(null);
    }, 2200);
  };

  const [analyzedProperty, setAnalyzedProperty] = React.useState<{
    color: CardColor;
    ownerName: string;
    cardsCount: number;
    hasHouse: boolean;
    hasHotel: boolean;
    currentRent: number;
  } | null>(null);

  const longPressTimerRef = React.useRef<any>(null);

  const handleStartPress = (col: CardColor, owner: string, setObj: any) => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      triggerHaptic('medium');
      setExpandedPropertyColor(prev => prev === col ? null : col);
      setAnalyzedProperty({
        color: col,
        ownerName: owner,
        cardsCount: setObj.cards.length,
        hasHouse: setObj.hasHouse,
        hasHotel: setObj.hasHotel,
        currentRent: calculateSetRent(setObj.cards, col, setObj.hasHouse, setObj.hasHotel),
      });
    }, 450);
  };

  const handleEndPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const triggerHaptic = (type: 'light' | 'medium' | 'heavy' = 'light') => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        if (type === 'light') {
          navigator.vibrate(12);
        } else if (type === 'medium') {
          navigator.vibrate(25);
        } else if (type === 'heavy') {
          navigator.vibrate([40, 20, 40]);
        }
      } catch (e) {
        // Safe check
      }
    }
  };

  // Layout & Adaptive Mobile States
  const handScrollRef = React.useRef<HTMLDivElement>(null);
  const [isHandExpanded, setIsHandExpanded] = React.useState(true);
  const [showChatPanel, setShowChatPanel] = React.useState(true);
  const [showChatOverlay, setShowChatOverlay] = React.useState(false);
  const { isCompactLayout, setIsCompactLayout, toggleCompactLayout, getDynamicSetDimensions } = useCompactLayout();
  const [timeLeft, setTimeLeft] = React.useState(30);
  const [actionTimeLeft, setActionTimeLeft] = React.useState<number | null>(null);
  const [managedSetColor, setManagedSetColor] = React.useState<CardColor | null>(null);
  const [expandedPropertyColor, setExpandedPropertyColor] = React.useState<CardColor | null>(null);
  const [buildingTooltipColor, setBuildingTooltipColor] = React.useState<CardColor | null>(null);
  const [isOpponentsGrid, setIsOpponentsGrid] = React.useState(false);
  const [hideOwnBoard, setHideOwnBoard] = React.useState(false);
  const [showDiscardModal, setShowDiscardModal] = React.useState(false);

  React.useEffect(() => {
    if (!expandedPropertyColor) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && !target.closest('.property-details-sheet') && !target.closest('.property-set-card-trigger')) {
        setExpandedPropertyColor(null);
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('click', handler);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handler);
    };
  }, [expandedPropertyColor]);

  React.useEffect(() => {
    if (!buildingTooltipColor) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && !target.closest('.building-tooltip-panel') && !target.closest('.property-set-card-trigger')) {
        setBuildingTooltipColor(null);
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('click', handler);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handler);
    };
  }, [buildingTooltipColor]);

  const [showHint, setShowHint] = React.useState(false);
  const [tutorialStep, setTutorialStep] = React.useState(0);
  const [showBankVaultModal, setShowBankVaultModal] = React.useState(false);
  const [showOpponentAssetsModal, setShowOpponentAssetsModal] = React.useState(false);
  const [assetsOpponentId, setAssetsOpponentId] = React.useState<string | null>(null);
  const [focusedCard, setFocusedCard] = React.useState<Card | null>(null);
  const [focusedCardZoom, setFocusedCardZoom] = React.useState<number>(1.5);
  const [showYourTurnSplash, setShowYourTurnSplash] = React.useState(false);
  const [activeToast, setActiveToast] = React.useState<string | null>(null);
  const [tiltX, setTiltX] = React.useState(0);
  const [tiltY, setTiltY] = React.useState(0);

  // Action Cancel Warning alert state (for troubleshooting / stuck recovery)
  const [isHeaderHidden, setIsHeaderHidden] = React.useState(false);

  const [recoveryAlert, setRecoveryAlert] = React.useState<{
    message: string;
    type: 'warning' | 'success' | 'info';
  } | null>(null);

  // Force bypass/cancel mechanism to prevent the game from getting stuck
  const handleForceCancelActiveAction = (reason?: string) => {
    const activeMatch = matchRef.current;
    if (!activeMatch) return;

    if (sounds.playAlert) {
      sounds.playAlert(profile.settings);
    }

    // Create an updated match without activeActionRequest
    const updatedMatch = { ...activeMatch };
    delete updatedMatch.activeActionRequest;

    // Log the bypass action
    updatedMatch.logs.push({
      id: `bypass-${Date.now()}`,
      message: `⚠️ İşlem İptal: Bekleyen aksiyon zorla iptal edildi. Oyun akışı kurtarıldı!`,
      timestamp: Date.now(),
    });

    updateMatchState(updatedMatch);

    // Clear interaction selections
    setActiveActionCard(null);
    setSelectedCard(null);
    setShowCardMenu(false);
    setPaymentSelection([]);
    setPendingSlyDeal(null);
    setSelectedOpponentId(null);
    setSelectedStolenCardId(null);
    setSelectedMyCardId(null);

    // Show beautiful animated fluid warning alert banner
    setRecoveryAlert({
      message: reason || 'Sistem: Bekleyen işlem iptal edildi ve oyun akışı kurtarıldı!',
      type: 'warning',
    });

    // Auto-hide alert
    setTimeout(() => {
      setRecoveryAlert(null);
    }, 4500);

    // Safely resume bot if it is bot's turn
    const currentTurnPlayer = updatedMatch.players[updatedMatch.turnIndex];
    if (currentTurnPlayer && currentTurnPlayer.isBot) {
      setTimeout(() => {
        resumeBotTurnOffline();
      }, 1000);
    }
  };

  // Mobile Touch Drag and Drop states
  const wasTouchMovedRef = React.useRef(false);
  const touchAnimFrameRef = React.useRef<number | null>(null);
  const touchPosRef = React.useRef<{ x: number; y: number } | null>(null);
  const [touchDragCard, setTouchDragCard] = React.useState<Card | null>(null);
  const [touchPosition, setTouchPosition] = React.useState<{ x: number; y: number } | null>(null);
  const [touchStartPos, setTouchStartPos] = React.useState<{ x: number; y: number } | null>(null);
  const [isTouchDragging, setIsTouchDragging] = React.useState(false);

  const handleTouchStart = (e: React.TouchEvent, card: Card) => {
    if (!isMyTurn) return;
    wasTouchMovedRef.current = false;
    const touch = e.touches[0];
    const initialPos = { x: touch.clientX, y: touch.clientY };
    touchPosRef.current = initialPos;
    setTouchStartPos(initialPos);
    setTouchDragCard(card);
    setTouchPosition(initialPos);
    setIsTouchDragging(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchDragCard || !touchStartPos) return;
    const touch = e.touches[0];
    const clientX = touch.clientX;
    const clientY = touch.clientY;
    const deltaX = clientX - touchStartPos.x;
    const deltaY = clientY - touchStartPos.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (distance > 8) {
      wasTouchMovedRef.current = true;

      // Allow native container scrolling if gesture is predominantly horizontal
      if (!isTouchDragging && Math.abs(deltaX) > Math.abs(deltaY) * 1.1) {
        return;
      }

      if (!isTouchDragging) {
        setIsTouchDragging(true);
        setDraggingCard(touchDragCard); // Sync with desktop draggingCard so drop zones highlight
      }

      touchPosRef.current = { x: clientX, y: clientY };
      if (!touchAnimFrameRef.current) {
        touchAnimFrameRef.current = requestAnimationFrame(() => {
          touchAnimFrameRef.current = null;
          if (touchPosRef.current) {
            setTouchPosition(touchPosRef.current);
          }
        });
      }

      // Highlight drop zones in real-time when dragging on mobile!
      const bankEl = document.getElementById('bank-drop-zone');
      const propertiesEl = document.getElementById('properties-drop-zone');
      const padding = 55; // Generous forgiving touch zone padding for mobile screens

      if (bankEl) {
        const rect = bankEl.getBoundingClientRect();
        const overBank = (
          clientX >= rect.left - padding &&
          clientX <= rect.right + padding &&
          clientY >= rect.top - padding &&
          clientY <= rect.bottom + padding
        );
        setIsDragOverBank((prev) => (prev !== overBank ? overBank : prev));
      }

      if (propertiesEl) {
        const rect = propertiesEl.getBoundingClientRect();
        const overProperties = (
          clientX >= rect.left - padding &&
          clientX <= rect.right + padding &&
          clientY >= rect.top - padding &&
          clientY <= rect.bottom + padding
        );
        setIsDragOverProperties((prev) => (prev !== overProperties ? overProperties : prev));
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchAnimFrameRef.current) {
      cancelAnimationFrame(touchAnimFrameRef.current);
      touchAnimFrameRef.current = null;
    }

    if (!touchDragCard) return;

    if (isActionLocked) {
      playAlertSound();
      alert("Şu an aktif bir ödeme veya hamle talebi var. Bu talep çözülene kadar yeni kart oynayamazsınız!");
      setTouchDragCard(null);
      setTouchPosition(null);
      setTouchStartPos(null);
      setIsTouchDragging(false);
      setDraggingCard(null);
      touchPosRef.current = null;
      return;
    }

    const finalTouchPos = touchPosRef.current || touchPosition;

    if (isTouchDragging && finalTouchPos) {
      const bankEl = document.getElementById('bank-drop-zone');
      const propertiesEl = document.getElementById('properties-drop-zone');

      let droppedOnBank = false;
      let droppedOnProperties = false;
      const padding = 55; // Generous forgiving touch zone padding for mobile screens

      if (bankEl) {
        const rect = bankEl.getBoundingClientRect();
        if (
          finalTouchPos.x >= rect.left - padding &&
          finalTouchPos.x <= rect.right + padding &&
          finalTouchPos.y >= rect.top - padding &&
          finalTouchPos.y <= rect.bottom + padding
        ) {
          droppedOnBank = true;
        }
      }

      if (propertiesEl) {
        const rect = propertiesEl.getBoundingClientRect();
        if (
          finalTouchPos.x >= rect.left - padding &&
          finalTouchPos.x <= rect.right + padding &&
          finalTouchPos.y >= rect.top - padding &&
          finalTouchPos.y <= rect.bottom + padding
        ) {
          droppedOnProperties = true;
        }
      }

      if (droppedOnBank) {
        if (touchDragCard.type === 'property' || touchDragCard.type === 'wildcard') {
          playAlertSound();
          alert('Tapu kartları bankaya yatırılamaz! Sadece para ve aksiyon kartları bankaya yatırılabilir.');
        } else {
          playPlaySound();
          if (isOffline) {
            handleOfflinePlayCard(touchDragCard.id, 'bank');
          } else {
            handlePlayCardMultiplayer(touchDragCard.id, 'bank');
          }
        }
      } else if (droppedOnProperties) {
        if (touchDragCard.type === 'money') {
          playPlaySound();
          if (isOffline) {
            handleOfflinePlayCard(touchDragCard.id, 'bank');
          } else {
            handlePlayCardMultiplayer(touchDragCard.id, 'bank');
          }
        } else if (touchDragCard.type === 'house-hotel') {
          const res = checkHouseHotelPlayability(touchDragCard);
          if (res.playable) {
            playPlaySound();
            setHouseHotelColorPick(touchDragCard);
          } else {
            playAlertSound();
            alert(res.reason || 'Otel/Ev yerleştirilemez!');
          }
        } else if (touchDragCard.isWildcard || touchDragCard.type === 'wildcard') {
          playPlaySound();
          setWildcardColorPick(touchDragCard);
        } else if (touchDragCard.type === 'property') {
          playPlaySound();
          if (isOffline) {
            handleOfflinePlayCard(touchDragCard.id, 'property');
          } else {
            handlePlayCardMultiplayer(touchDragCard.id, 'property');
          }
        } else {
          const res = checkActionPlayability(touchDragCard);
          if (res.playable) {
            playPlaySound();
            if (touchDragCard.type === 'rent') {
              setRentColorPick(touchDragCard);
            } else if (['sly-deal', 'deal-breaker', 'forced-deal', 'debt-collector'].includes(touchDragCard.actionType || '')) {
              setActiveActionCard(touchDragCard);
            } else {
              if (isOffline) handleOfflinePlayCard(touchDragCard.id, 'action');
              else handlePlayCardMultiplayer(touchDragCard.id, 'action');
            }
          } else {
            playAlertSound();
            alert(res.reason || 'Bu kart oynanamaz!');
          }
        }
      }
    } else {
      // Treat as click / selection only if finger was not moved/swiped
      if (!wasTouchMovedRef.current) {
        setSelectedCard(touchDragCard);
        setShowCardMenu(true);
        playPlaySound();
      }
    }

    // Clear touch drag states
    setTouchDragCard(null);
    setTouchPosition(null);
    setTouchStartPos(null);
    touchPosRef.current = null;
    setIsTouchDragging(false);
    setDraggingCard(null);
    setIsDragOverBank(false);
    setIsDragOverProperties(false);
  };

  // Career stats state
  const [careerStats, setCareerStats] = React.useState({
    wins: 0,
    bankruptcies: 0,
    rentCollected: 0,
  });

  const [showCareerPanel, setShowCareerPanel] = React.useState(false);

  React.useEffect(() => {
    const saved = localStorage.getItem('mono_deal_career_stats');
    if (saved) {
      try {
        setCareerStats(JSON.parse(saved));
      } catch (e) {
        // use default
      }
    }
  }, []);

  const incrementCareerStat = (key: 'wins' | 'bankruptcies', amount = 1) => {
    setCareerStats((prev) => {
      const next = { ...prev, [key]: prev[key] + amount };
      localStorage.setItem('mono_deal_career_stats', JSON.stringify(next));
      return next;
    });
  };

  const addCareerRent = (amount: number) => {
    setCareerStats((prev) => {
      const next = { ...prev, rentCollected: prev.rentCollected + amount };
      localStorage.setItem('mono_deal_career_stats', JSON.stringify(next));
      return next;
    });
  };

  // Drawing cards motion animation state
  const [animatingDrawCards, setAnimatingDrawCards] = React.useState<{ id: number; delay: number }[]>([]);

  // 3D Particles/Light effects state for active card actions
  const [cardEffects, setCardEffects] = React.useState<Record<string, 'steal' | 'rent' | 'bday' | 'gold' | 'house' | 'sly-shadow' | 'debt-seal' | 'birthday-confetti' | null>>({});

  const triggerCardEffect = React.useCallback((cardId: string, type: 'steal' | 'rent' | 'bday' | 'gold' | 'house' | 'sly-shadow' | 'debt-seal' | 'birthday-confetti') => {
    setCardEffects((prev) => ({ ...prev, [cardId]: type }));
    setTimeout(() => {
      setCardEffects((prev) => {
        const copy = { ...prev };
        delete copy[cardId];
        return copy;
      });
    }, 2500);
  }, []);

  // Game notification stack type & state
  interface GameNotification {
    id: string;
    message: string;
    timestamp: Date;
    type: 'action' | 'property' | 'rent' | 'money' | 'other';
  }
  const [notifications, setNotifications] = React.useState<GameNotification[]>([]);

  // Flying card animation types and states
  interface FlyingCard {
    id: string;
    card: Card;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  }
  const [flyingCards, setFlyingCards] = React.useState<FlyingCard[]>([]);
  const [showcaseCard, setShowcaseCard] = React.useState<{ card: Card; playerName: string; zone: 'bank' | 'property' | 'action' | 'discard'; color?: CardColor } | null>(null);
  const [animationQueue, setAnimationQueue] = React.useState<{
    card: Card;
    playerName: string;
    zone: 'bank' | 'property' | 'action' | 'discard';
    color?: CardColor;
    startId: string;
    endId: string;
    targetPlayerIds?: string[];
  }[]>([]);

  // Live feed & chat tab filter state
  const [chatFilter, setChatFilter] = React.useState<'all' | 'actions' | 'chat'>('all');
  const [isProcessingAnimation, setIsProcessingAnimation] = React.useState(false);

  const triggerCardFlight = (
    card: Card,
    startElementId: string,
    endElementId: string,
    onComplete?: () => void
  ) => {
    const startEl = document.getElementById(startElementId);
    const endEl = document.getElementById(endElementId);

    // Fallbacks if elements are not found
    let startX = window.innerWidth / 2;
    let startY = window.innerHeight;
    let endX = window.innerWidth / 2;
    let endY = window.innerHeight / 2;

    if (startEl) {
      const rect = startEl.getBoundingClientRect();
      startX = rect.left + rect.width / 2;
      startY = rect.top + rect.height / 2;
    } else if (startElementId.startsWith('hand-card-')) {
      startX = window.innerWidth / 2;
      startY = window.innerHeight - 50;
    }
    if (endEl) {
      const rect = endEl.getBoundingClientRect();
      endX = rect.left + rect.width / 2;
      endY = rect.top + rect.height / 2;
    }

    const flightId = `flight-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const newFlight: FlyingCard = {
      id: flightId,
      card,
      startX,
      startY,
      endX,
      endY,
    };

    setFlyingCards((prev) => [...prev, newFlight]);

    setTimeout(() => {
      setFlyingCards((prev) => prev.filter((fc) => fc.id !== flightId));
      if (onComplete) onComplete();
    }, 600); // 600ms match duration
  };

  const isCardAnimating = (cardId: string) => {
    return flyingCards.some((fc) => fc.card.id === cardId) || showcaseCard?.card.id === cardId;
  };

  const showcaseTimeoutRef = React.useRef<any>(null);
  const skipShowcase = React.useCallback(() => {
    if (showcaseTimeoutRef.current) {
      clearTimeout(showcaseTimeoutRef.current);
      showcaseTimeoutRef.current = null;
    }
    if (showcaseCard) {
      setShowcaseCard(null);
      const nextAnim = animationQueue[0];
      if (nextAnim) {
        triggerCardFlight(nextAnim.card, nextAnim.startId, nextAnim.endId, () => {
          setAnimationQueue((prev) => prev.slice(1));
          setIsProcessingAnimation(false);
        });
      }
    }
  }, [showcaseCard, animationQueue]);

  // Action / Rent Toast State
  const [actionToast, setActionToast] = React.useState<{
    id: string;
    title: string;
    message: string;
    remainingCash: number;
    remainingPropsCount: number;
    type: 'rent' | 'deal-breaker' | 'sly-deal' | 'forced-deal' | 'debt-collector' | 'info';
    victimName: string;
    victimAvatarId: string;
  } | null>(null);

  const translateToastTitle = (tTitle: string, userProfile: UserProfile): string => {
    if (userProfile.settings.language !== 'en') return tTitle;
    let outT = tTitle;
    outT = outT.replace('Sinsi Anlaşma', 'Sly Deal');
    outT = outT.replace('Anlaşma Bozan', 'Deal Breaker');
    outT = outT.replace('Zoraki Takas', 'Forced Deal');
    outT = outT.replace('Borç Tahsildarı', 'Debt Collector');
    outT = outT.replace('Borç Tahsil Edildi', 'Debt Collected');
    outT = outT.replace('Doğum Günü Kutlaması', 'Birthday Celebration');
    outT = outT.replace('Kira Tahsil Edildi', 'Rent Collected');
    outT = outT.replace('Oynandı', 'Played');
    outT = outT.replace('Gerçekleşti', 'Executed');
    outT = outT.replace('Engeli', 'Blocked');
    return outT;
  };

  const showActionToast = (
    _type: 'rent' | 'deal-breaker' | 'sly-deal' | 'forced-deal' | 'debt-collector' | 'info',
    _title: string,
    _message: string,
    _victimPlayer: any
  ) => {
    // Upper action toast notifications have been completely disabled as requested.
    return;
  };

  // Turn Timer Tracking Refs for extra time on action plays
  const prevTurnIndexRef = React.useRef<number | undefined>(undefined);
  const prevActionsPlayedRef = React.useRef<number>(0);
  const botActionsPlayedRef = React.useRef<number>(0);
  const processedLogsRef = React.useRef<Set<string>>(new Set());
  const toastTimeoutRef = React.useRef<any>(null);

  // Extra bonus time on action play (for offline mode)
  React.useEffect(() => {
    if (match && match.status === 'playing') {
      const maxLimit = getTurnLimitSeconds();
      if (maxLimit !== 99999 && prevTurnIndexRef.current === match.turnIndex) {
        if (match.actionsPlayedThisTurn > prevActionsPlayedRef.current) {
          if (isOffline) {
            setTimeLeft((prev) => Math.min(prev + 10, maxLimit));
          }
        }
      }
      prevTurnIndexRef.current = match.turnIndex;
      prevActionsPlayedRef.current = match.actionsPlayedThisTurn;
    } else {
      prevTurnIndexRef.current = undefined;
      prevActionsPlayedRef.current = 0;
    }
  }, [match?.turnIndex, match?.actionsPlayedThisTurn, match?.status, isOffline]);

  const getTurnLimitSeconds = () => {
    const limit = match?.settings?.turnLimit || 'unlimited';
    if (limit === '15s') return 15;
    if (limit === '30s') return 30;
    if (limit === '1m') return 60;
    return 99999; // Unlimited flag
  };

  // Turn Timer Countdown Effect
  React.useEffect(() => {
    if (match && match.status === 'playing') {
      setTimeLeft(getTurnLimitSeconds());
    }
  }, [match?.turnIndex, match?.status, match?.settings?.turnLimit]);

  React.useEffect(() => {
    if (match && match.status === 'playing') {
      const maxSeconds = getTurnLimitSeconds();
      if (maxSeconds === 99999) {
        setTimeLeft(99999);
        return;
      }

      const timer = setInterval(() => {
        // Paused during active action requests or target selection
        if (match.activeActionRequest || activeActionCard) {
          return;
        }
        setTimeLeft((prev) => {
          if (prev <= 1) {
            const activePlayer = match.players[match.turnIndex];
            const isMyTurn = activePlayer?.id === profile.id;
            if (isMyTurn) {
              if (isOffline) {
                let currentHand = [...activePlayer.hand];
                while (currentHand.length > 7) {
                  const toDiscard = currentHand.shift();
                  if (toDiscard) {
                    handleOfflineDiscard(toDiscard.id);
                  }
                }
                handleOfflineEndTurn();
              } else {
                let currentHand = [...activePlayer.hand];
                if (currentHand.length > 7) {
                  while (currentHand.length > 7) {
                    const toDiscard = currentHand.shift();
                    if (toDiscard) {
                      handleDiscardMultiplayer(toDiscard.id);
                    }
                  }
                  setTimeout(() => {
                    handleEndTurnMultiplayer();
                  }, 500);
                } else {
                  handleEndTurnMultiplayer();
                }
              }
            }
            return maxSeconds;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [match?.turnIndex, match?.status, match?.activeActionRequest, activeActionCard, match?.settings?.turnLimit]);

  // Action Request Timer Countdown Effect (JSN / payments)
  React.useEffect(() => {
    if (actionTimeLeft === null || actionTimeLeft <= 0) return;
    const timer = setInterval(() => {
      setActionTimeLeft((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [actionTimeLeft]);

  // Auto End Turn effect
  React.useEffect(() => {
    if (match && match.status === 'playing' && match.settings?.autoEndTurn) {
      const activePlayer = match.players[match.turnIndex];
      const isMyTurn = activePlayer?.id === profile.id;
      const hasActiveAction = match.activeActionRequest || (match.activeActionRequests && match.activeActionRequests.length > 0);
      if (isMyTurn && match.actionsPlayedThisTurn === 3 && !hasActiveAction && !activeActionCard) {
        // Only end if hand size is <= 7, otherwise they must select cards to discard
        if (activePlayer.hand.length <= 7) {
          if (isOffline) {
            handleOfflineEndTurn();
          } else {
            handleEndTurnMultiplayer();
          }
        }
      }
    }
  }, [match?.actionsPlayedThisTurn, match?.turnIndex, match?.status, match?.settings?.autoEndTurn, match?.activeActionRequest, match?.activeActionRequests, activeActionCard]);

  // Yeni tur başladığında fazla kart modalını kapat (önceki turun state'inin taşınmasını önle)
  React.useEffect(() => {
    setShowDiscardModal(false);
  }, [match?.turnIndex]);

  // 3 hamle tamamlandığında ve elde 7'den fazla kart varsa fazla kart modalını aç
  React.useEffect(() => {
    if (!match || match.status !== 'playing') return;
    // Yalnızca actionsPlayedThisTurn tam olarak 3'e ulaştığında tetikle (tur değişiminde değil)
    if (match.actionsPlayedThisTurn !== 3) return;
    const activePlayer = match.players[match.turnIndex];
    if (!activePlayer) return;
    const isMyTurn = activePlayer.id === profile.id;
    const hasActiveAction = match.activeActionRequest || (match.activeActionRequests && match.activeActionRequests.length > 0);
    if (isMyTurn && !hasActiveAction && !activeActionCard && activePlayer.hand.length > 7) {
      setShowDiscardModal(true);
    }
  }, [match?.actionsPlayedThisTurn]);

  // "SIRA SENDE" (Your Turn) Splash Screen effect
  const prevTurnIndexForSplash = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (!match || match.status !== 'playing') return;
    const isMyTurnNow = match.players[match.turnIndex]?.id === profile.id;
    if (isMyTurnNow && prevTurnIndexForSplash.current !== match.turnIndex) {
      if (sounds.playAlert) {
        sounds.playAlert(profile.settings);
      } else {
        playPlaySound();
      }
      // Play your turn voiceover
      playCustomVoiceoverFile('your_turn.mp3');

      setShowYourTurnSplash(true);
      const timer = setTimeout(() => setShowYourTurnSplash(false), 2000);
      return () => clearTimeout(timer);
    }
    prevTurnIndexForSplash.current = match.turnIndex;
  }, [match?.turnIndex, match?.status, profile.id]);

  // Centralized quest, achievement and stat progress engine
  const updateDynamicQuestAndAchievements = (
    currentProfile: UserProfile,
    actionType: string,
    increment: number = 1
  ): UserProfile => {
    try {
      const updated = JSON.parse(JSON.stringify(currentProfile)) as UserProfile;
      if (!updated.stats) {
        updated.stats = {
          gamesPlayed: 0,
          gamesWon: 0,
          gamesLost: 0,
          winRate: 0,
          totalRentCollected: 0,
          totalCardsStolen: 0,
          totalSetsCompleted: 0,
          totalMoneyBanked: 0
        };
      }

      if (actionType === 'games_played') {
        updated.stats.gamesPlayed += increment;
      } else if (actionType === 'games_won') {
        updated.stats.gamesWon += increment;
      } else if (actionType === 'money_banked') {
        updated.stats.totalMoneyBanked += increment;
      } else if (actionType === 'cards_stolen') {
        updated.stats.totalCardsStolen += increment;
      } else if (actionType === 'sets_completed') {
        updated.stats.totalSetsCompleted += increment;
      } else if (actionType === 'rent_collected') {
        updated.stats.totalRentCollected += increment;
      }

      if (updated.stats.gamesPlayed > 0) {
        updated.stats.winRate = Math.round((updated.stats.gamesWon / updated.stats.gamesPlayed) * 100);
      }

      if (updated.dailyQuests && Array.isArray(updated.dailyQuests)) {
        updated.dailyQuests.forEach((q: any) => {
          if (q.type === actionType) {
            q.currentValue = Math.min(q.targetValue, (q.currentValue || 0) + increment);
            if (q.currentValue >= q.targetValue) {
              q.completed = true;
            }
          }
        });
      }

      if (updated.achievements && Array.isArray(updated.achievements)) {
        updated.achievements.forEach((ach: any) => {
          if (ach.type === actionType) {
            ach.currentValue = Math.min(ach.targetValue, (ach.currentValue || 0) + increment);
            if (ach.currentValue >= ach.targetValue) {
              ach.completed = true;
            }
          }
        });
      }

      return updated;
    } catch (e) {
      console.error('Error tracking quest/achievement progress:', e);
      return currentProfile;
    }
  };

  // Game Start, Victory & Defeat triggers
  const lastMatchStatusRef = React.useRef<string | undefined>(undefined);
  React.useEffect(() => {
    if (!match) return;

    if (lastMatchStatusRef.current !== match.status) {
      if (match.status === 'playing') {
        playCustomVoiceoverFile('game_start.mp3');
      } else if (match.status === 'finished') {
        const isWinner = match.winnerId === profile.id;
        const allowPracticeRewards = isOffline ? (adminSettings?.botPracticeRewardsEnabled === true) : true;

        if (!isOffline || allowPracticeRewards) {
          let updated = { ...profile };

          // Increment games played
          updated = updateDynamicQuestAndAchievements(updated, 'games_played', 1);

          if (isWinner) {
            playCustomVoiceoverFile('victory.mp3');
            updated = updateDynamicQuestAndAchievements(updated, 'games_won', 1);
            // Auto add 3 sets completed for winning
            updated = updateDynamicQuestAndAchievements(updated, 'sets_completed', 3);
          } else {
            playCustomVoiceoverFile('defeat.mp3');
          }

          onUpdateProfile(updated);
        } else {
          if (isWinner) {
            playCustomVoiceoverFile('victory.mp3');
          } else {
            playCustomVoiceoverFile('defeat.mp3');
          }
        }
      }
      lastMatchStatusRef.current = match.status;
    }
  }, [match?.status, match?.winnerId, profile.id, isOffline, adminSettings]);

  // State diffing animation effect to automatically capture every play in multiplayer and offline modes
  const prevMatchRef = React.useRef<MatchState | null>(null);
  React.useEffect(() => {
    const oldMatch = prevMatchRef.current;
    const newMatch = match;
    prevMatchRef.current = newMatch;

    if (!oldMatch || !newMatch) return;
    if (oldMatch.status !== 'playing' || newMatch.status !== 'playing') return;

    const newItems: typeof animationQueue = [];
    let profileToUpdate = { ...profile };
    let hasChanges = false;

    // Helper to find the card's previous location in oldMatch to determine its flight origin
    const findPreviousLocation = (cardId: string) => {
      for (const p of oldMatch.players) {
        if (p.hand.some((c) => c.id === cardId)) {
          return { ownerId: p.id, zone: 'hand' };
        }
        if (p.bank.some((c) => c.id === cardId)) {
          return { ownerId: p.id, zone: 'bank' };
        }
        for (const colKey of Object.keys(p.properties)) {
          const set = p.properties[colKey as CardColor];
          if (set && set.cards.some((c) => c.id === cardId)) {
            return { ownerId: p.id, zone: 'property', color: colKey as CardColor };
          }
        }
      }
      return null;
    };

    // 1. Detect Discard Pile additions (Action / Rent cards)
    if (newMatch.discardPile.length > oldMatch.discardPile.length) {
      setDiscardGlow(true);
      setTimeout(() => setDiscardGlow(false), 2200);
      const addedCards = newMatch.discardPile.filter((nc) => !oldMatch.discardPile.some((oc) => oc.id === nc.id));
      addedCards.forEach((card) => {
        const turnPlayer = oldMatch.players[oldMatch.turnIndex];
        if (turnPlayer) {
          const startId = turnPlayer.id === profile.id ? `hand-card-${card.id}` : `player-card-${turnPlayer.id}`;
          
          const targetPlayerIds: string[] = [];
          if (newMatch.activeActionRequest) {
            if (newMatch.activeActionRequest.targetPlayerId) {
              targetPlayerIds.push(newMatch.activeActionRequest.targetPlayerId);
            }
            if (newMatch.activeActionRequest.sourcePlayerId) {
              targetPlayerIds.push(newMatch.activeActionRequest.sourcePlayerId);
            }
          }
          if (newMatch.activeActionRequests && newMatch.activeActionRequests.length > 0) {
            newMatch.activeActionRequests.forEach((req) => {
              if (req.targetPlayerId) targetPlayerIds.push(req.targetPlayerId);
              if (req.sourcePlayerId) targetPlayerIds.push(req.sourcePlayerId);
            });
          }

          // Check if this card was actually discarded (due to holding >7 cards)
          const recentLogs = newMatch.logs.slice(oldMatch.logs.length);
          const isDiscarded = recentLogs.some(log => {
            const lowerMsg = log.message.toLowerCase();
            return (
              (lowerMsg.includes('elinden') && (lowerMsg.includes('attı') || lowerMsg.includes('atti'))) ||
              lowerMsg.includes('discarded')
            );
          });

          // TRIGGER: Dynamic Rent/Birthday/Debt-collector rent collected
          if (turnPlayer.id === profile.id && !isDiscarded) {
            if (card.type === 'rent' || card.actionType === 'debt-collector' || card.actionType === 'birthday') {
              profileToUpdate = updateDynamicQuestAndAchievements(profileToUpdate, 'rent_collected', 1);
              hasChanges = true;
            }
          }

          newItems.push({
            card,
            playerName: turnPlayer.username,
            zone: isDiscarded ? 'discard' : 'action',
            startId,
            endId: 'discard-pile-zone',
            targetPlayerIds: targetPlayerIds.length > 0 ? targetPlayerIds : undefined
          });
        }
      });
    }

    // 2. Detect Bank and Property additions
    newMatch.players.forEach((newPlayer) => {
      const oldPlayer = oldMatch.players.find((p) => p.id === newPlayer.id);
      if (!oldPlayer) return;

      // Bank additions
      if (newPlayer.bank.length > oldPlayer.bank.length) {
        const addedCards = newPlayer.bank.filter((nc) => !oldPlayer.bank.some((oc) => oc.id === nc.id));
        addedCards.forEach((card) => {
          let startId = newPlayer.id === profile.id ? `hand-card-${card.id}` : `player-card-${newPlayer.id}`;
          const prev = findPreviousLocation(card.id);

          if (prev) {
            if (prev.ownerId !== newPlayer.id) {
              // Transferred from another player (e.g. rent payment)
              startId = prev.ownerId === profile.id ? `card-mini-${card.id}` : `player-card-${prev.ownerId}`;
            }
          }

          // TRIGGER: Banked money
          if (newPlayer.id === profile.id) {
            profileToUpdate = updateDynamicQuestAndAchievements(profileToUpdate, 'money_banked', 1);
            hasChanges = true;
          }

          const endId = newPlayer.id === profile.id ? 'bank-drop-zone' : `player-card-${newPlayer.id}`;
          newItems.push({
            card,
            playerName: newPlayer.username,
            zone: 'bank',
            startId,
            endId
          });
        });
      }

      // Property additions
      Object.keys(newPlayer.properties).forEach((colorKey) => {
        const col = colorKey as CardColor;
        const newSet = newPlayer.properties[col];
        const oldSet = oldPlayer.properties[col];
        const oldCards = oldSet ? oldSet.cards : [];
        const newCards = newSet ? newSet.cards : [];

        if (newCards.length > oldCards.length) {
          // Detect set completion
          const isNowCompleted = newCards.length >= (MAX_IN_SET[col] || 0);
          const wasCompletedBefore = oldCards.length >= (MAX_IN_SET[col] || 0);
          if (isNowCompleted && !wasCompletedBefore && newPlayer.id === profile.id) {
            playCustomVoiceoverFile('set_completed.mp3');
            profileToUpdate = updateDynamicQuestAndAchievements(profileToUpdate, 'sets_completed', 1);
            hasChanges = true;
          }

          const addedCards = newCards.filter((nc) => !oldCards.some((oc) => oc.id === nc.id));
          addedCards.forEach((card) => {
            let startId = newPlayer.id === profile.id ? `hand-card-${card.id}` : `player-card-${newPlayer.id}`;
            const prev = findPreviousLocation(card.id);

            if (prev) {
              if (prev.ownerId !== newPlayer.id) {
                // Stolen or traded from another player!
                startId = prev.ownerId === profile.id ? `card-mini-${card.id}` : `player-card-${prev.ownerId}`;
              }
            }

            // TRIGGER: Stolen/traded property
            if (newPlayer.id === profile.id) {
              if (prev && prev.ownerId !== newPlayer.id) {
                profileToUpdate = updateDynamicQuestAndAchievements(profileToUpdate, 'cards_stolen', 1);
                hasChanges = true;
              }
            }

            const endId = newPlayer.id === profile.id ? `property-set-${col}-${newPlayer.id}` : `player-card-${newPlayer.id}`;
            newItems.push({
              card,
              playerName: newPlayer.username,
              zone: 'property',
              color: col,
              startId,
              endId
            });
          });
        }
      });
    });

    if (hasChanges) {
      onUpdateProfile(profileToUpdate);
    }

    if (newItems.length > 0) {
      setAnimationQueue((prev) => [...prev, ...newItems]);
    }
  }, [match]);

  // Process the animation queue sequentially to prevent cards overlapping or playing simultaneously
  React.useEffect(() => {
    if (animationQueue.length === 0 || isProcessingAnimation) return;

    setIsProcessingAnimation(true);
    const nextAnim = animationQueue[0];

    // 1. Showcase (ONLY for action plays that affect players or opponents, skip for Pass Go, bank, and property)
    const actType = nextAnim.card.actionType || nextAnim.card.type;
    const isActionPlay = nextAnim.zone === 'action' && [
      'deal-breaker',
      'just-say-no',
      'sly-deal',
      'forced-deal',
      'debt-collector',
      'birthday',
      'rent'
    ].includes(actType);

    const isActor = nextAnim.playerName === profile.username || match?.players.find((p) => p.username === nextAnim.playerName)?.id === profile.id;
    const isTarget = nextAnim.targetPlayerIds?.includes(profile.id);
    const isGlobalAction = !nextAnim.targetPlayerIds || nextAnim.targetPlayerIds.length === 0 || actType === 'birthday' || actType === 'rent';
    const isLocalInvolved = isActor || isTarget || isGlobalAction;

    const showShowcase = isActionPlay && isLocalInvolved;

    // Play corresponding voiceover for this card play
    playVoiceover(nextAnim.zone, nextAnim.card, nextAnim.playerName);

    if (showShowcase) {
      setShowcaseCard(nextAnim);
      showcaseTimeoutRef.current = setTimeout(() => {
        showcaseTimeoutRef.current = null;
        setShowcaseCard(null);
        triggerCardFlight(nextAnim.card, nextAnim.startId, nextAnim.endId, () => {
          setAnimationQueue((prev) => prev.slice(1));
          setIsProcessingAnimation(false);
        });
      }, 3500);
    } else {
      setShowcaseCard(null);
      triggerCardFlight(nextAnim.card, nextAnim.startId, nextAnim.endId, () => {
        setAnimationQueue((prev) => prev.slice(1));
        setIsProcessingAnimation(false);
      });
    }

    return () => {
      if (showcaseTimeoutRef.current) {
        clearTimeout(showcaseTimeoutRef.current);
        showcaseTimeoutRef.current = null;
      }
    };
  }, [animationQueue, isProcessingAnimation]);

  // Log-monitoring Effect to show Toasts/Banners and trigger 3D custom particle animations
  React.useEffect(() => {
    if (!match || !match.logs) return;

    const newLogs = match.logs.filter((log: any) => !processedLogsRef.current.has(log.id));
    if (newLogs.length === 0) return;

    newLogs.forEach((log: any) => {
      processedLogsRef.current.add(log.id);
      const text = log.message;

      // Top-screen active log toast notification disabled by request
      // if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      // setActiveToast(translateLogMessage(text, profile));
      // toastTimeoutRef.current = setTimeout(() => {
      //   setActiveToast(null);
      // }, 3500);

      // Add a dynamic slide-in notification
      let notifType: 'action' | 'property' | 'rent' | 'money' | 'other' = 'other';
      const lowercaseMsg = text.toLowerCase();
      const isDiscardLog = lowercaseMsg.includes('elinden') && (lowercaseMsg.includes('attı') || lowercaseMsg.includes('atti'));
      const isBankPlacement = lowercaseMsg.includes('banka') || lowercaseMsg.includes('kasasına') || lowercaseMsg.includes('bankaya') || lowercaseMsg.includes('para ekledi');

      if (!isDiscardLog) {
        if (lowercaseMsg.includes('mülk') || lowercaseMsg.includes('tapu') || lowercaseMsg.includes('arsa') || lowercaseMsg.includes('set')) {
          notifType = 'property';
        } else if (lowercaseMsg.includes('kira') || lowercaseMsg.includes('bedel')) {
          notifType = 'rent';
        } else if (lowercaseMsg.includes('para') || lowercaseMsg.includes('nakit') || lowercaseMsg.includes('m ekledi')) {
          notifType = 'money';
        } else if (lowercaseMsg.includes('oynadı') || lowercaseMsg.includes('çaldı') || lowercaseMsg.includes('aldı')) {
          notifType = 'action';
        }
      }

      const notifId = log.id || Math.random().toString();
      const newNotif: GameNotification = {
        id: notifId,
        message: text,
        timestamp: new Date(),
        type: notifType,
      };

      setNotifications((prev) => [newNotif, ...prev].slice(0, 5));

      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== notifId));
      }, 4000);

      // Detect "Doğum Günü" play
      if (!isDiscardLog && !isBankPlacement && (text.includes('Bugün Benim Doğum Günüm') || text.includes('doğum günü'))) {
        match.players.forEach((p) => {
          p.hand.forEach((c) => triggerCardEffect(c.id, 'birthday-confetti'));
          Object.values(p.properties).forEach((set: any) => {
            set?.cards.forEach((c: any) => triggerCardEffect(c.id, 'birthday-confetti'));
          });
        });

        const activePlayer = match.players[match.turnIndex];
        showActionToast(
          'info',
          '🎂 Doğum Günü Kutlaması!',
          text,
          activePlayer || match.players[0]
        );
      }
      // Detect "Haciz" / "Borç" play
      else if (!isDiscardLog && !isBankPlacement && (text.includes('borç tahsilatı') || text.includes('Borç Tahsildarı') || text.includes('tahsilat'))) {
        match.players.forEach((p) => {
          Object.values(p.properties).forEach((set: any) => {
            set?.cards.forEach((c: any) => triggerCardEffect(c.id, 'debt-seal'));
          });
        });

        const activePlayer = match.players[match.turnIndex];
        showActionToast(
          'debt-collector',
          '💼 Borç / Haciz Talebi!',
          text,
          activePlayer || match.players[0]
        );
      }
      // Detect "Sinsi Anlaşma" play
      else if (!isDiscardLog && !isBankPlacement && (text.includes('sinsi anlaşma') || text.includes('Sinsi Anlaşma'))) {
        match.players.forEach((p) => {
          Object.values(p.properties).forEach((set: any) => {
            set?.cards.forEach((c: any) => triggerCardEffect(c.id, 'sly-shadow'));
          });
        });

        const activePlayer = match.players[match.turnIndex];
        showActionToast(
          'sly-deal',
          '🥷 Sinsi Anlaşma Oynandı!',
          text,
          activePlayer || match.players[0]
        );
      }
      // Detect "Anlaşma Bozan" play
      else if (!isDiscardLog && !isBankPlacement && (text.includes('Anlaşma Bozan') || text.includes('bozan'))) {
        match.players.forEach((p) => {
          Object.values(p.properties).forEach((set: any) => {
            set?.cards.forEach((c: any) => triggerCardEffect(c.id, 'debt-seal'));
          });
        });

        const activePlayer = match.players[match.turnIndex];
        showActionToast(
          'deal-breaker',
          '⚡ Anlaşma Bozan Oynandı!',
          text,
          activePlayer || match.players[0]
        );

        // Trigger Meteor Strike VFX (offline/bot games)
        if (profile.settings.actionVfx === 'vfx_meteor') {
          setShowDealBreakerAnimation({ source: '', target: '', color: 'brown' });
          setTimeout(() => setShowDealBreakerAnimation(null), 2200);
        }
      }
      // Detect "Zoraki Takas" play
      else if (!isDiscardLog && !isBankPlacement && (text.includes('Zoraki Takas') || text.includes('forced-deal'))) {
        match.players.forEach((p) => {
          Object.values(p.properties).forEach((set: any) => {
            set?.cards.forEach((c: any) => triggerCardEffect(c.id, 'sly-shadow'));
          });
        });

        const activePlayer = match.players[match.turnIndex];
        showActionToast(
          'forced-deal',
          '🤝 Zoraki Takas Oynandı!',
          text,
          activePlayer || match.players[0]
        );
      }
      // Detect "Hayır Teşekkürler" (Just Say No) play or counter
      else if (!isDiscardLog && !isBankPlacement && (text.includes('Hayır Teşekkürler') || text.includes('savunma') || text.includes('Savunma') || text.includes('JSN') || text.includes('jsn'))) {
        match.players.forEach((p: any) => {
          p.hand.forEach((c: any) => triggerCardEffect(c.id, 'sly-shadow'));
        });

        const activePlayer = match.players[match.turnIndex];
        showActionToast(
          'info',
          '🛡️ Hayır Teşekkürler!',
          text,
          activePlayer || match.players[0]
        );

        // Trigger Mirror Shield VFX (offline/bot games)
        if (profile.settings.actionVfx === 'vfx_mirror_shield') {
          setShowShieldDefenseFor(profile.id);
          setTimeout(() => setShowShieldDefenseFor(null), 2500);
        }
      }
      // Detect player bankruptcy
      else if (text.includes('iflas etti') || text.includes('went bankrupt')) {
        playCustomVoiceoverFile('bankruptcy.mp3');
      }
    });
  }, [match?.logs?.length, match?.players]);

  const socketRef = React.useRef<WebSocket | null>(null);
  const [wsConnected, setWsConnected] = React.useState<boolean>(true);
  const [isReconnecting, setIsReconnecting] = React.useState<boolean>(false);
  const [reconnectCount, setReconnectCount] = React.useState<number>(0);
  const [reconnectTrigger, setReconnectTrigger] = React.useState<number>(0);
  const reconnectTimerRef = React.useRef<any>(null);
  const isIntentionallyClosedRef = React.useRef<boolean>(false);

  // --- AUDIO SYNTHESIS INTEGRATION ---
  const lastPlaySoundTimeRef = React.useRef<number>(0);
  const lastCoinSoundTimeRef = React.useRef<number>(0);

  const playDrawSound = () => sounds.playCardDraw(profile.settings);
  const playPlaySound = (card?: Card) => {
    const now = Date.now();
    if (now - lastPlaySoundTimeRef.current < 350) {
      return;
    }
    lastPlaySoundTimeRef.current = now;

    // Register combo action to dynamically shift pitch upward on consecutive plays!
    const pitchMultiplier = sounds.registerCombo();

    if (card && (card.actionType === 'house' || card.actionType === 'hotel')) {
      sounds.playHouseHotelBuild(profile.settings);
    } else {
      sounds.playPropertyPlace(profile.settings, pitchMultiplier);
    }
  };
  const playCoinSound = () => {
    const now = Date.now();
    if (now - lastCoinSoundTimeRef.current < 350) {
      return;
    }
    lastCoinSoundTimeRef.current = now;
    const pitchMultiplier = sounds.registerCombo();
    sounds.playCoin(profile.settings, pitchMultiplier);
  };

  const playVoiceover = (zone: 'bank' | 'property' | 'action' | 'discard', card: Card, actorName?: string) => {
    if (zone === 'discard') return;
    const voiceoversGloballyEnabled = adminSettings ? adminSettings.enableSystemVoiceovers !== false : true;
    if (!voiceoversGloballyEnabled || voiceoversMuted) return;
    if (!match) return;

    const actor = actorName ? match.players.find(p => p.username === actorName) : null;
    const actorId = actor?.id;
    const isActor = actorId === profile.id;

    // Check if the local player is a targeted player in the action request
    let isTarget = false;
    if (match.activeActionRequest) {
      if (match.activeActionRequest.targetPlayerId === profile.id) {
        isTarget = true;
      }
      if (card.actionType === 'just-say-no' && match.activeActionRequest.sourcePlayerId === profile.id) {
        isTarget = true;
      }
    }
    if (match.activeActionRequests) {
      const hasTarget = match.activeActionRequests.some(r => r.targetPlayerId === profile.id);
      if (hasTarget) {
        isTarget = true;
      }
    }

    // Determine if the local player should hear this sound
    let shouldHear = false;

    if (zone === 'bank') {
      shouldHear = isActor;
    } else if (zone === 'property') {
      shouldHear = isActor;
    } else if (zone === 'action') {
      const act = card.actionType;
      if (act === 'birthday' || act === 'deal-breaker') {
        shouldHear = true; // Everyone hears birthday celebrations and deal breakers!
      } else if (act === 'pass-go') {
        shouldHear = isActor;
      } else if (card.type === 'rent') {
        // Standard dual-color rent is global; wild rent (single target) is actor + target only
        const isWildRent = card.name === 'Her Renk Kira Kartı' || !card.color;
        if (isWildRent) {
          shouldHear = isActor || isTarget;
        } else {
          shouldHear = true;
        }
      } else if (act === 'double-rent') {
        shouldHear = isActor || isTarget;
      } else if (act === 'debt-collector' || act === 'sly-deal' || act === 'forced-deal' || act === 'just-say-no') {
        shouldHear = isActor || isTarget;
      } else {
        shouldHear = isActor;
      }
    }

    if (!shouldHear) return;

    const lang = profile.settings.language === 'en' ? 'en' : 'tr';
    let filename = '';

    if (zone === 'bank') {
      filename = 'place_bank.mp3';
    } else if (zone === 'property') {
      if (card.actionType === 'house') {
        filename = 'build_house.mp3';
      } else if (card.actionType === 'hotel') {
        filename = 'build_hotel.mp3';
      } else {
        filename = 'place_property.mp3';
      }
    } else if (zone === 'action') {
      const act = card.actionType;
      if (act === 'pass-go') {
        filename = 'play_passgo.mp3';
      } else if (act === 'birthday') {
        filename = 'play_birthday.mp3';
      } else if (act === 'debt-collector') {
        filename = 'play_debt.mp3';
      } else if (act === 'sly-deal') {
        filename = 'play_sly.mp3';
      } else if (act === 'deal-breaker') {
        filename = 'play_dealbreaker.mp3';
      } else if (act === 'forced-deal') {
        filename = 'play_forced.mp3';
      } else if (act === 'double-rent') {
        filename = 'play_double.mp3';
      } else if (card.type === 'rent') {
        filename = 'play_rent.mp3';
      } else if (act === 'just-say-no') {
        filename = 'play_jsn.mp3';
      } else {
        filename = 'play_action.mp3';
      }
    }

    if (!filename) return;

    try {
      const audio = new Audio(`/assets/sounds/voices/${lang}/${filename}`);
      audio.volume = (profile.settings.soundVolume || 50) / 100;
      audio.onerror = () => {};
      audio.play().catch(() => {});
    } catch (e) {
      // Ignore audio load errors
    }
  };

  const playCustomVoiceoverFile = (filename: string) => {
    const voiceoversGloballyEnabled = adminSettings ? adminSettings.enableSystemVoiceovers !== false : true;
    if (!voiceoversGloballyEnabled || voiceoversMuted) return;

    const lang = profile.settings.language === 'en' ? 'en' : 'tr';
    try {
      const audio = new Audio(`/assets/sounds/voices/${lang}/${filename}`);
      audio.volume = (profile.settings.soundVolume || 50) / 100;
      audio.onerror = () => {};
      audio.play().catch(() => {});
    } catch (e) {
      // Ignore audio load errors
    }
  };
  const playActionSound = (card?: Card) => {
    if (!card) {
      sounds.playActionCardPlay(profile.settings);
      return;
    }
    if (card.actionType === 'birthday') {
      sounds.playBirthday(profile.settings);
    } else if (card.actionType === 'debt-collector') {
      sounds.playDebtCollector(profile.settings);
    } else if (card.actionType === 'deal-breaker') {
      sounds.playDealBreaker(profile.settings);
    } else if (card.actionType === 'sly-deal' || card.actionType === 'forced-deal') {
      sounds.playSlyForcedDeal(profile.settings);
    } else if (card.actionType === 'pass-go') {
      sounds.playPassGo(profile.settings);
    } else if (card.actionType === 'house' || card.actionType === 'hotel') {
      sounds.playHouseHotelBuild(profile.settings);
    } else {
      sounds.playActionCardPlay(profile.settings);
    }
  };
  const playStealSound = () => sounds.playSteal(profile.settings);
  const playJsnSound = () => sounds.playJustSayNo(profile.settings);
  const playAlertSound = () => sounds.playAlert(profile.settings);
  const playCardDrawSound = () => sounds.playCardDraw(profile.settings);
  const playCardDiscardSound = () => sounds.playCardDiscard(profile.settings);
  const playPropertyPlaceSound = () => {
    const now = Date.now();
    if (now - lastPlaySoundTimeRef.current < 350) {
      return;
    }
    lastPlaySoundTimeRef.current = now;
    sounds.playPropertyPlace(profile.settings);
  };
  const playActionCardPlaySound = () => sounds.playActionCardPlay(profile.settings);

  // --- BACKGROUND MUSIC ENGINE CONTROLLER ---
  React.useEffect(() => {
    if (isMusicPlaying) {
      sounds.startMusic(profile.settings);
    } else {
      sounds.stopMusic();
    }
    return () => {
      sounds.stopMusic();
    };
  }, [isMusicPlaying, profile.settings.soundVolume, profile.settings.gameMusic, profile.settings.customBgmUrl]);

  // Initialize Offline Practice Match or Connect WebSocket
  React.useEffect(() => {
    loadShopItems();
    if (isOffline) {
      const isTournament = roomId.startsWith('tournament:');
      const tParts = isTournament ? roomId.split(':') : [];
      const tOpponent = tParts[3] || 'Bot Can';

      // Setup Offline State
      const initialMatch: MatchState = {
        roomId,
        status: 'lobby',
        players: [
          {
            id: profile.id,
            username: profile.username,
            avatarId: profile.avatarId,
            avatarUrl: profile.avatarUrl,
            profileFrame: profile.settings.profileFrame || 'frame_none',
            playerBoard: profile.settings.playerBoard || 'board_classic',
            cardBack: profile.settings.cardBack || 'back_classic',
            cardSkin: profile.settings.cardSkin || 'skin_none',
            actionVfx: profile.settings.actionVfx || 'vfx_none',
            isBot: false,
            hand: [],
            bank: [],
            properties: {},
          },
          {
            id: 'bot-1',
            username: isTournament ? `${tOpponent}` : 'Bot Can (Yapay Zeka)',
            avatarId: 'avatar_skater',
            profileFrame: 'frame_neon',
            playerBoard: 'board_cyber',
            cardBack: 'back_cosmic',
            cardSkin: 'skin_cyber',
            actionVfx: 'vfx_meteor',
            isBot: true,
            hand: [],
            bank: [],
            properties: {},
          },
        ],
        deckCount: 106,
        discardPile: [],
        turnIndex: 0,
        actionsPlayedThisTurn: 0,
        logs: [
          {
            id: 'log-1',
            message: isTournament
              ? `🏆 TURNUVA MAÇI BAŞLADI: ${tOpponent}'a karşı mücadele ediyorsunuz!`
              : 'Çevrimdışı Pratik Odası Kuruldu. Bot Can maça hazır!',
            timestamp: Date.now(),
          },
        ],
        isOffline: true,
      };
      setMatch(initialMatch);
    } else {
      // Connect WebSocket
      isIntentionallyClosedRef.current = false;
      const wsUrl = WS_BASE_URL;
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        setIsReconnecting(false);
        setReconnectCount(0);
        // Register client
        ws.send(JSON.stringify({ type: 'register', userId: profile.id }));
        // Join room
        ws.send(JSON.stringify({ type: 'join_room', userId: profile.id, roomId, password: roomPassword }));
      };

      ws.onclose = (event) => {
        if (isIntentionallyClosedRef.current) return;
        setWsConnected(false);
        setIsReconnecting(true);

        const delay = Math.min(1000 * Math.pow(1.5, reconnectCount), 8000);
        setReconnectCount((c) => c + 1);

        console.log(`[Smart-Reconnect] Connection lost. Reconnecting in ${Math.round(delay)}ms... (Attempt ${reconnectCount + 1})`);

        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = setTimeout(() => {
          setReconnectTrigger((p) => p + 1);
        }, delay);
      };

      ws.onerror = (err) => {
        console.error('[Smart-Reconnect] WebSocket error:', err);
        setWsConnected(false);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'room_update') {
            setMatch(data.matchState);
            if (data.matchState.settings) {
              setLocalSettings(data.matchState.settings);
            }
            if (data.matchState.actionTimeLeft !== undefined) {
              setActionTimeLeft(data.matchState.actionTimeLeft);
            }
            if (data.matchState.turnTimeLeft !== undefined) {
              if (data.matchState.turnTimeLeft === null) {
                setTimeLeft(99999);
              } else {
                setTimeLeft(data.matchState.turnTimeLeft);
              }
            }

            // Checksum Verification (State Desync Check)
            if (data.checksum) {
              const localSum = calculateLocalChecksum(data.matchState);
              if (localSum !== data.checksum) {
                console.warn('[Sync] Desync detected! Local:', localSum, 'Server:', data.checksum);
                if (!isOffline && ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ type: 'request_sync', userId: profile.id, roomId }));
                }
              }
            }

            // Play corresponding trigger sound effects based on last log messages
            const logs = data.matchState.logs as GameLog[];
            if (logs.length > 0) {
              const lastLog = logs[logs.length - 1].message;
              const lowercaseLastLog = lastLog.toLowerCase();
              const isBankLog = lowercaseLastLog.includes('banka') || lowercaseLastLog.includes('kasasına') || lowercaseLastLog.includes('bankaya') || lowercaseLastLog.includes('para ekledi');

              if (isBankLog) {
                playCoinSound();
              } else if (lastLog.includes('çekti')) {
                playCardDrawSound();
              } else if (lastLog.includes('attı')) {
                playCardDiscardSound();
              } else if (lastLog.includes('yerleştirdi')) {
                if (lastLog.includes('Ev') || lastLog.includes('Otel') || lastLog.includes('ev') || lastLog.includes('otel')) {
                  sounds.playHouseHotelBuild(profile.settings);
                  triggerBuildSmoke();
                } else {
                  playPropertyPlaceSound();
                }
              } else if (lastLog.includes('Doğum Günü') || lastLog.includes('doğum günü')) {
                sounds.playBirthday(profile.settings);
              } else if (lastLog.includes('Borç Tahsilatı') || lastLog.includes('borç tahsilatı') || lastLog.includes('Haciz')) {
                sounds.playDebtCollector(profile.settings);
              } else if (lastLog.includes('Anlaşma Bozan') || lastLog.includes('anlaşma bozan') || lastLog.includes('Set Çaldı') || lastLog.includes('set çaldı')) {
                sounds.playDealBreaker(profile.settings);
              } else if (lastLog.includes('Sinsi Anlaşma') || lastLog.includes('sinsi anlaşma') || lastLog.includes('Zorunlu Anlaşma') || lastLog.includes('zorunlu anlaşma')) {
                sounds.playSlyForcedDeal(profile.settings);
              } else if (lastLog.includes('Başlangıç Noktası') || lastLog.includes('Başlangıç noktasından') || lastLog.includes('pass-go')) {
                sounds.playPassGo(profile.settings);
              } else if (lastLog.includes('aksiyon') || lastLog.includes('başladı') || lastLog.includes('oynadı') || lastLog.includes('talep etti') || lastLog.includes('talep ediyor') || lastLog.includes('çalmak istiyor') || lastLog.includes('değiştirmek istiyor')) {
                playActionCardPlaySound();
              } else if (lastLog.includes('çaldı')) {
                playStealSound();
              } else if (lastLog.includes('Hayır Teşekkürler') || lastLog.includes('Hayır Deme Hakkı') || lastLog.includes('Reddet')) {
                playJsnSound();
                // Trigger Mirror Shield VFX (online)
                if (profile.settings.actionVfx === 'vfx_mirror_shield') {
                  setShowShieldDefenseFor(profile.id);
                  setTimeout(() => setShowShieldDefenseFor(null), 2500);
                }
              }

              // Trigger Meteor Strike VFX for Deal Breaker (online)
              if ((lastLog.includes('Anlaşma Bozan') || lastLog.includes('Set Çaldı')) && profile.settings.actionVfx === 'vfx_meteor') {
                setShowDealBreakerAnimation({ source: '', target: '', color: 'brown' });
                setTimeout(() => setShowDealBreakerAnimation(null), 2200);
              }

              // Detect rent/payment logs to trigger Coin Flying
              if (
                lowercaseLastLog.includes('ödeme yaptı') ||
                lowercaseLastLog.includes('ödedi') ||
                lowercaseLastLog.includes('ödüyor')
              ) {
                triggerCoinFlyingEffect();
              }
            }
          } else if (data.type === 'emoji_broadcast') {
            triggerFloatingEmoji(data.emoji, data.username);
          } else if (data.type === 'voice_update') {
            const speaking = data.players.filter((p: any) => p.isSpeaking).map((p: any) => p.id);
            setSpeakingList(speaking);
          } else if (data.type === 'kicked') {
            alert('Lobiden Atıldınız!');
            isIntentionallyClosedRef.current = true;
            onLeaveRoom();
          } else if (data.type === 'join_failed') {
            alert(data.error || 'Odaya katılım başarısız oldu!');
            isIntentionallyClosedRef.current = true;
            onLeaveRoom();
          } else if (data.type === 'alert') {
            alert(data.message);
          }
        } catch (e) {
          console.error(e);
        }
      };

      return () => {
        ws.onopen = null;
        ws.onclose = null;
        ws.onerror = null;
        ws.onmessage = null;
        ws.close();
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
        }
      };
    }
  }, [roomId, isOffline, reconnectTrigger]);

  // Listen for online status and tab visibility to trigger instant reconnect
  React.useEffect(() => {
    if (isOffline) return;

    const handleInstantReconnect = () => {
      if (socketRef.current?.readyState !== WebSocket.OPEN && !isIntentionallyClosedRef.current) {
        console.log('[Smart-Reconnect] Triggering instant reconnection due to network change or page focus.');
        setWsConnected(false);
        setIsReconnecting(true);
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
        }
        setReconnectTrigger((p) => p + 1);
      }
    };

    window.addEventListener('online', handleInstantReconnect);
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleInstantReconnect();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('online', handleInstantReconnect);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isOffline]);

  // Simulated speaking wave generator for Voice Chat
  React.useEffect(() => {
    if (!voiceMuted) {
      const interval = setInterval(() => {
        // Randomly make self speak in UI to show the dynamic voice waves
        if (Math.random() < 0.25) {
          setSpeakingList((prev) => [...new Set([...prev, profile.id])]);
          if (!isOffline && socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(
              JSON.stringify({ type: 'voice_state', userId: profile.id, roomId, isSpeaking: true })
            );
          }
        } else {
          setSpeakingList((prev) => prev.filter((id) => id !== profile.id));
          if (!isOffline && socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(
              JSON.stringify({ type: 'voice_state', userId: profile.id, roomId, isSpeaking: false })
            );
          }
        }
      }, 3500);

      return () => clearInterval(interval);
    } else {
      setSpeakingList((prev) => prev.filter((id) => id !== profile.id));
    }
  }, [voiceMuted]);

  const handleLeaveLobby = () => {
    isIntentionallyClosedRef.current = true;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }
    if (!isOffline) {
      socketRef.current?.send(JSON.stringify({ type: 'leave_room', userId: profile.id, roomId }));
    }
    onLeaveRoom();
  };

  const handleKickPlayer = (targetPlayerId: string) => {
    if (isOffline) {
      setMatch((prev) => {
        if (!prev) return null;
        const updatedPlayers = prev.players.filter((p) => p.id !== targetPlayerId);
        return {
          ...prev,
          players: updatedPlayers,
          logs: [
            ...prev.logs,
            { id: `kick-${Date.now()}`, message: `Bot odadan çıkarıldı.`, timestamp: Date.now() },
          ],
        };
      });
    } else {
      socketRef.current?.send(JSON.stringify({
        type: 'kick_player',
        userId: profile.id,
        roomId,
        targetPlayerId
      }));
    }
  };

  const changeMatchSettings = (updated: Partial<typeof localSettings>) => {
    const fullSettings = { ...localSettings, ...updated };

    // Automatically apply rules for presets
    if (updated.gameMode === 'chaos') {
      fullSettings.targetSets = 4;
      fullSettings.turnLimit = 'unlimited';
      fullSettings.autoEndTurn = false;
    } else if (updated.gameMode === 'speed') {
      fullSettings.targetSets = 2;
      fullSettings.turnLimit = '15s';
      fullSettings.autoEndTurn = true;
    }

    setLocalSettings(fullSettings);

    if (isOffline) {
      setMatch(prev => prev ? { ...prev, settings: fullSettings } : null);
    } else {
      socketRef.current?.send(JSON.stringify({
        type: 'update_match_settings',
        userId: profile.id,
        roomId,
        settings: fullSettings
      }));
    }
  };

  // --- OFFLINE PRACTICE MODE ENGINE ACTIONS ---
  const handleStartOfflineGame = () => {
    if (!match) return;

    let fullDeck = shuffleDeck(generateDeck());

    // Deal 5 cards
    const updatedPlayers = match.players.map((p) => ({
      ...p,
      hand: fullDeck.splice(0, 5),
    }));

    const nextState: MatchState = {
      ...match,
      status: 'playing',
      players: updatedPlayers,
      deckCount: fullDeck.length,
      discardPile: [],
      turnIndex: 0,
      actionsPlayedThisTurn: 0,
      settings: localSettings,
      logs: [
        ...match.logs,
        { id: `start-${Date.now()}`, message: 'Oyun başladı! İlk 5 kartınız dağıtıldı.', timestamp: Date.now() },
      ],
    };

    // Store deck count
    (nextState as any).serverDeck = fullDeck;

    // Trigger draw for player 1
    triggerOfflineDraw(nextState);
  };

  const triggerOfflineDraw = (currentState: MatchState) => {
    const activePlayer = currentState.players[currentState.turnIndex];
    const serverDeck: Card[] = (currentState as any).serverDeck || [];

    if (serverDeck.length < 5) {
      const disc = [...currentState.discardPile];
      currentState.discardPile = [];
      serverDeck.push(...shuffleDeck(disc));
    }

    const drawCount = activePlayer.hand.length === 0 ? 5 : 2;
    const drawn = serverDeck.splice(0, drawCount);
    activePlayer.hand.push(...drawn);

    currentState.deckCount = serverDeck.length;
    (currentState as any).serverDeck = serverDeck;

    currentState.logs.push({
      id: `draw-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      message: `${activePlayer.username} desteden ${drawCount} kart çekti.`,
      timestamp: Date.now(),
    });

    if (activePlayer.id === profile.id) {
      // Trigger visual cards draw gliding animation
      const cardsToAnimate = Array.from({ length: drawCount }).map((_, idx) => ({
        id: Date.now() + idx,
        delay: idx * 0.15,
      }));
      setAnimatingDrawCards(cardsToAnimate);
      setTimeout(() => {
        setAnimatingDrawCards([]);
      }, 1500);
    }

    playDrawSound();
    setMatch({ ...currentState });
  };

  const executeSlyDealOffline = (matchState: MatchState, sourceId: string, payload: any) => {
    const sourcePlayer = matchState.players.find((p) => p.id === sourceId);
    const targetPlayer = matchState.players.find((p) => p.id === payload.targetPlayerId);
    if (sourcePlayer && targetPlayer && payload.targetCardId) {
      let stolenCard: Card | null = null;
      let stolenColor: CardColor | null = null;
      for (const colKey in targetPlayer.properties) {
        const col = colKey as CardColor;
        const propSet = targetPlayer.properties[col];
        if (propSet) {
          const idx = propSet.cards.findIndex((c) => c.id === payload.targetCardId);
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
        triggerCardEffect(stolenCard.id, 'steal');
        matchState.logs.push({
          id: `sly-resolved-${Date.now()}`,
          message: `${sourcePlayer.username}, ${targetPlayer.username} adlı oyuncudan ${stolenCard.name} mülkünü sinsi anlaşma ile çaldı!`,
          timestamp: Date.now(),
        });
        enforceBuildingRules(targetPlayer, matchState.discardPile);
        showActionToast(
          'sly-deal',
          '🥷 Sinsi Anlaşma Gerçekleşti!',
          `${sourcePlayer.username}, ${targetPlayer.username} adlı oyuncudan "${stolenCard.name}" mülkünü aldı.`,
          targetPlayer
        );
      }
    }
  };

  const executeDealBreakerOffline = (matchState: MatchState, sourceId: string, payload: any) => {
    const sourcePlayer = matchState.players.find((p) => p.id === sourceId);
    const targetPlayer = matchState.players.find((p) => p.id === payload.targetPlayerId);
    const targetColor = payload.targetColor as CardColor;
    if (sourcePlayer && targetPlayer && targetColor) {
      const propSet = targetPlayer.properties[targetColor];
      if (propSet) {
        sourcePlayer.properties[targetColor] = { ...propSet };
        delete targetPlayer.properties[targetColor];
        propSet.cards.forEach((c) => triggerCardEffect(c.id, 'steal'));
        matchState.logs.push({
          id: `db-resolved-${Date.now()}`,
          message: `${sourcePlayer.username}, ${targetPlayer.username} adlı oyuncunun tamamlanmış ${COLOR_LABELS[targetColor]} setini çaldı!`,
          timestamp: Date.now(),
        });
        showActionToast(
          'deal-breaker',
          '⚡ Anlaşma Bozan Gerçekleşti!',
          `${sourcePlayer.username}, ${targetPlayer.username} adlı oyuncunun tamamlanmış "${COLOR_LABELS[targetColor]}" setini aldı.`,
          targetPlayer
        );
      }
    }
  };

  const executeForcedDealOffline = (matchState: MatchState, sourceId: string, payload: any) => {
    const sourcePlayer = matchState.players.find((p) => p.id === sourceId);
    const targetPlayer = matchState.players.find((p) => p.id === payload.targetPlayerId);
    if (sourcePlayer && targetPlayer && payload.targetCardId && payload.myCardId) {
      let stolenCard: Card | null = null;
      let givenCard: Card | null = null;
      let stolenColor: CardColor | null = null;
      let givenColor: CardColor | null = null;

      for (const colKey in targetPlayer.properties) {
        const col = colKey as CardColor;
        const propSet = targetPlayer.properties[col];
        if (propSet) {
          const idx = propSet.cards.findIndex((c) => c.id === payload.targetCardId);
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
          const idx = propSet.cards.findIndex((c) => c.id === payload.myCardId);
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

        triggerCardEffect(stolenCard.id, 'steal');
        triggerCardEffect(givenCard.id, 'steal');

        matchState.logs.push({
          id: `fd-resolved-${Date.now()}`,
          message: `${sourcePlayer.username}, ${targetPlayer.username} ile Zoraki Takas yaptı! ${givenCard.name} verdi ve ${stolenCard.name} aldı.`,
          timestamp: Date.now(),
        });

        enforceBuildingRules(targetPlayer, matchState.discardPile);
        enforceBuildingRules(sourcePlayer, matchState.discardPile);

        showActionToast(
          'forced-deal',
          '🤝 Zoraki Takas Gerçekleşti!',
          `${sourcePlayer.username} Zoraki Takas ile "${stolenCard.name}" mülkünü aldı, karşılığında "${givenCard.name}" mülkünü verdi.`,
          targetPlayer
        );
      }
    }
  };

  const handleOfflinePlayCard = (cardId: string, zone: 'bank' | 'property' | 'action', extraColor?: CardColor, payload?: any) => {
    if (!match) return;
    triggerTapticFeedback();

    if (isActionLocked && cardId !== activeActionCard?.id) {
      playAlertSound();
      alert("Şu an aktif bir ödeme veya hamle talebi var. Bu talep çözülene kadar yeni kart oynayamazsınız!");
      return;
    }

    let actionsCost = 1;
    if (zone === 'action' && payload?.isDoubleRent) {
      actionsCost = 2;
    }

    if (match.actionsPlayedThisTurn + actionsCost > 3) {
      playAlertSound();
      alert("Bu turda en fazla 3 hamle yapabilirsiniz! Lütfen turunuzu sonlandırın.");
      return;
    }

    const activePlayer = match.players[match.turnIndex];
    const cardIdx = activePlayer.hand.findIndex((c) => c.id === cardId);
    if (cardIdx === -1) return;

    const card = activePlayer.hand[cardIdx];

    if (zone === 'action' && ['sly-deal', 'deal-breaker', 'forced-deal', 'debt-collector'].includes(card.actionType || '')) {
      if (!isActionSelectionComplete(card, payload)) {
        setActiveActionCard(card);
        if (payload?.targetPlayerId) setSelectedOpponentId(payload.targetPlayerId);
        if (payload?.targetCardId) setSelectedStolenCardId(payload.targetCardId);
        if (payload?.targetColor) setSelectedStolenColor(payload.targetColor);
        if (payload?.myCardId) setSelectedMyCardId(payload.myCardId);
        return;
      }
    }

    const updatedPlayers = [...match.players];
    const updatedPlayer = { ...activePlayer };
    updatedPlayers[match.turnIndex] = updatedPlayer;

    let updatedDiscard = [...match.discardPile];

    if (zone === 'bank') {
      if (card.type === 'property' || card.type === 'wildcard') {
        return; // Arazi Kartları ve Joker Arazi kartları Bankaya Konulmaz.
      }
      updatedPlayer.hand.splice(cardIdx, 1);
      updatedPlayer.bank.push(card);
      match.logs.push({
        id: `play-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        message: `${activePlayer.username}, banka kasasına ${card.value}M para (${card.name}) yerleştirdi.`,
        timestamp: Date.now(),
      });
      playCoinSound();
    } else if (zone === 'property') {
      updatedPlayer.hand.splice(cardIdx, 1);
      const colorToUse = (card.isWildcard && extraColor) ? extraColor : (card.color || extraColor || 'brown');

      if (!updatedPlayer.properties[colorToUse]) {
        updatedPlayer.properties[colorToUse] = { cards: [], hasHouse: false, hasHotel: false };
      }

      if (card.type === 'house-hotel') {
        if (card.actionType === 'house') updatedPlayer.properties[colorToUse]!.hasHouse = true;
        else updatedPlayer.properties[colorToUse]!.hasHotel = true;
      } else {
        const updatedCard = { ...card };
        if (updatedCard.isWildcard && updatedCard.secondaryColor && colorToUse === updatedCard.secondaryColor) {
          const temp = updatedCard.color;
          updatedCard.color = colorToUse;
          updatedCard.secondaryColor = temp;
        } else {
          updatedCard.color = colorToUse;
        }
        updatedPlayer.properties[colorToUse]!.cards.push(updatedCard);
      }

      match.logs.push({
        id: `play-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        message: `${activePlayer.username}, ${COLOR_LABELS[colorToUse]} grubuna ${card.name} yerleştirdi.`,
        timestamp: Date.now(),
      });
      playPlaySound(card);

      // Check win
      if (checkWinnerWithSettings(updatedPlayer.properties)) {
        handleOfflineWinner(updatedPlayer.id);
        return;
      }
    } else if (zone === 'action') {
      updatedPlayer.hand.splice(cardIdx, 1);
      updatedDiscard.push(card);

      if (payload?.isDoubleRent) {
        const drIdx = updatedPlayer.hand.findIndex((c) => c.actionType === 'double-rent');
        if (drIdx !== -1) {
          const drCard = updatedPlayer.hand.splice(drIdx, 1)[0];
          updatedDiscard.push(drCard);
          actionsCost += 1;
        }
      }

      match.logs.push({
        id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        message: `${activePlayer.username}, ${card.name} aksiyonunu masaya sürdü!`,
        timestamp: Date.now(),
      });
      playActionSound(card);

      // Implement specific offline action results
      if (card.actionType === 'pass-go') {
        const serverDeck: Card[] = (match as any).serverDeck || [];
        const drawn = serverDeck.splice(0, 2);
        updatedPlayer.hand.push(...drawn);
        match.deckCount = serverDeck.length;
        (match as any).serverDeck = serverDeck;
        match.logs.push({
          id: `passgo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          message: `${activePlayer.username} Başlangıç Noktasından Geçti ve 2 kart çekti!`,
          timestamp: Date.now(),
        });
        playDrawSound();
      } else if (card.actionType === 'birthday') {
        // Collect 2M from all other players (bots)
        const targets = match.players.filter((p) => p.id !== activePlayer.id);
        targets.forEach((tp) => {
          if (tp.isBot) {
            const payments = BotEngine.selectPayment(tp, 2);
            transferOfflinePayment(tp.id, activePlayer.id, payments);
            payments.forEach((cardId) => triggerCardEffect(cardId, 'gold'));
            match.logs.push({
              id: `bday-offline-${Date.now()}-${Math.random()}`,
              message: `🎂 ${tp.username}, Doğum Günü Kutlaması için ${activePlayer.username} oyuncusuna 2M ödedi.`,
              timestamp: Date.now()
            });
          }
        });
        showActionToast(
          'info',
          '🎂 Doğum Günü Kutlaması!',
          `${activePlayer.username} bir doğum günü partisi verdi ve herkesten 2M topladı!`,
          activePlayer
        );
      } else if (card.actionType === 'debt-collector') {
        const targetId = payload?.targetPlayerId || match.players.find((p) => p.id !== activePlayer.id)?.id;
        const targetPlayer = match.players.find((p) => p.id === targetId);
        if (targetPlayer) {
          if (targetPlayer.isBot) {
            const jsnIdx = targetPlayer.hand.findIndex((c) => c.actionType === 'just-say-no');
            if (jsnIdx !== -1) {
              const jsnCard = targetPlayer.hand.splice(jsnIdx, 1)[0];
              updatedDiscard.push(jsnCard);
              match.logs.push({
                id: `bot-jsn-${Date.now()}`,
                message: `🛡️ ${targetPlayer.username} 'Hayır Deme Hakkı' (Reddet) kartını kullanarak senin Borç Tahsilatı hamleni engelledi!`,
                timestamp: Date.now(),
              });
              playJsnSound();

              match.activeActionRequest = {
                id: `req-${Date.now()}`,
                type: 'just-say-no',
                sourcePlayerId: targetPlayer.id,
                targetPlayerId: activePlayer.id,
                actionCard: card,
                amountDue: 5,
                originalAction: {
                  type: 'debt-collector',
                  payload: { targetPlayerId: targetId }
                },
                jsnCount: 1
              };
            } else {
              // Debt collector is 5M!
              const payments = BotEngine.selectPayment(targetPlayer, 5);
              transferOfflinePayment(targetPlayer.id, activePlayer.id, payments);
              payments.forEach((cardId) => triggerCardEffect(cardId, 'gold'));
              showActionToast(
                'debt-collector',
                '💼 Haciz / Borç Tahsilatı!',
                `${activePlayer.username}, ${targetPlayer.username} adlı oyuncudan 5M borç tahsil etti!`,
                targetPlayer
              );
            }
          }
        }
      } else if (card.type === 'rent') {
        const chosenColor = extraColor || 'brown';
        const set = updatedPlayer.properties[chosenColor];
        if (set && set.cards.length > 0) {
          const baseCount = Math.min(set.cards.length, MAX_IN_SET[chosenColor]);
          let rentVal = set.cards[0].rentValues?.[baseCount - 1] || 1;
          if (set.hasHouse) rentVal += 3;
          if (set.hasHotel) rentVal += 4;

          if (payload?.isDoubleRent) {
            rentVal *= 2;
          }

          const isWildRent = card.name === 'Her Renk Kira Kartı' || !card.color;
          if (isWildRent) {
            // Collect from ONLY one player
            const targetId = payload?.targetPlayerId || match.players.find((p) => p.id !== activePlayer.id)?.id;
            const targetPlayer = match.players.find((p) => p.id === targetId);
            if (targetPlayer) {
              if (targetPlayer.isBot) {
                const payments = BotEngine.selectPayment(targetPlayer, rentVal);
                transferOfflinePayment(targetPlayer.id, activePlayer.id, payments);
                payments.forEach((cardId) => triggerCardEffect(cardId, 'gold'));
                match.logs.push({
                  id: `rent-offline-${Date.now()}-${Math.random()}`,
                  message: `💰 ${targetPlayer.username}, ${COLOR_LABELS[chosenColor]} mülkleri için ${rentVal}M kira ödedi.`,
                  timestamp: Date.now()
                });
                showActionToast(
                  'rent',
                  '💰 Kira Tahsilatı!',
                  `${activePlayer.username}, ${targetPlayer.username} adlı oyuncudan ${COLOR_LABELS[chosenColor]} mülkleri için ${rentVal}M kira aldı!`,
                  targetPlayer
                );
              }
            }
          } else {
            // Collect from EVERYONE (standard dual-color rent)
            const targets = match.players.filter((p) => p.id !== activePlayer.id);
            targets.forEach((targetPlayer) => {
              if (targetPlayer.isBot) {
                const payments = BotEngine.selectPayment(targetPlayer, rentVal);
                transferOfflinePayment(targetPlayer.id, activePlayer.id, payments);
                payments.forEach((cardId) => triggerCardEffect(cardId, 'gold'));
                match.logs.push({
                  id: `rent-offline-${Date.now()}-${Math.random()}`,
                  message: `💰 ${targetPlayer.username}, ${COLOR_LABELS[chosenColor]} mülkleri için ${rentVal}M kira ödedi.`,
                  timestamp: Date.now()
                });
              }
            });
            showActionToast(
              'rent',
              '💰 Kira Tahsilatı!',
              `${activePlayer.username} herkesten ${COLOR_LABELS[chosenColor]} mülkleri için ${rentVal}M kira aldı!`,
              activePlayer
            );
          }
        }
      } else if (card.actionType === 'sly-deal') {
        const targetId = payload?.targetPlayerId;
        const cardIdToSteal = payload?.targetCardId;
        if (targetId && cardIdToSteal) {
          const targetPlayer = match.players.find((p) => p.id === targetId);
          if (targetPlayer) {
            const jsnIdx = targetPlayer.hand.findIndex((c) => c.actionType === 'just-say-no');
            if (jsnIdx !== -1) {
              const jsnCard = targetPlayer.hand.splice(jsnIdx, 1)[0];
              updatedDiscard.push(jsnCard);
              match.logs.push({
                id: `bot-jsn-${Date.now()}`,
                message: `🛡️ ${targetPlayer.username} 'Hayır Deme Hakkı' (Reddet) kartını kullanarak senin Sinsi Anlaşma hamleni engelledi!`,
                timestamp: Date.now(),
              });
              playJsnSound();

              match.activeActionRequest = {
                id: `req-${Date.now()}`,
                type: 'just-say-no',
                sourcePlayerId: targetPlayer.id,
                targetPlayerId: activePlayer.id,
                actionCard: card,
                targetCardId: cardIdToSteal,
                originalAction: {
                  type: 'sly-deal',
                  payload: { targetPlayerId: targetId, targetCardId: cardIdToSteal }
                },
                jsnCount: 1
              };
            } else {
              let stolenCard: Card | null = null;
              let stolenColor: CardColor | null = null;
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
              if (stolenCard) {
                const col = stolenCard.color || stolenColor || 'brown';
                if (!updatedPlayer.properties[col]) {
                  updatedPlayer.properties[col] = { cards: [], hasHouse: false, hasHotel: false };
                }
                updatedPlayer.properties[col]!.cards.push(stolenCard);
                triggerCardEffect(stolenCard.id, 'steal');
                match.logs.push({
                  id: `sly-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  message: `${activePlayer.username}, ${targetPlayer.username} adlı oyuncudan ${stolenCard.name} mülkünü sinsi anlaşma ile çaldı!`,
                  timestamp: Date.now(),
                });
                // Enforce building rules because stealing might have broken target player's set
                enforceBuildingRules(targetPlayer, match.discardPile);
                showActionToast(
                  'sly-deal',
                  '🥷 Sinsi Anlaşma Oynandı!',
                  `${activePlayer.username}, ${targetPlayer.username} adlı oyuncudan "${stolenCard.name}" mülkünü çaldı!`,
                  targetPlayer
                );
              }
            }
          }
        }
      } else if (card.actionType === 'deal-breaker') {
        const targetId = payload?.targetPlayerId;
        const targetColor = payload?.targetColor as CardColor;
        if (targetId && targetColor) {
          const targetPlayer = match.players.find((p) => p.id === targetId);
          if (targetPlayer) {
            const jsnIdx = targetPlayer.hand.findIndex((c) => c.actionType === 'just-say-no');
            if (jsnIdx !== -1) {
              const jsnCard = targetPlayer.hand.splice(jsnIdx, 1)[0];
              updatedDiscard.push(jsnCard);
              match.logs.push({
                id: `bot-jsn-${Date.now()}`,
                message: `🛡️ ${targetPlayer.username} 'Hayır Deme Hakkı' (Reddet) kartını kullanarak senin Anlaşma Bozan hamleni engelledi!`,
                timestamp: Date.now(),
              });
              playJsnSound();

              match.activeActionRequest = {
                id: `req-${Date.now()}`,
                type: 'just-say-no',
                sourcePlayerId: targetPlayer.id,
                targetPlayerId: activePlayer.id,
                actionCard: card,
                targetColor: targetColor,
                originalAction: {
                  type: 'deal-breaker',
                  payload: { targetPlayerId: targetId, targetColor: targetColor }
                },
                jsnCount: 1
              };
            } else {
              const propSet = targetPlayer?.properties[targetColor];
              if (propSet) {
                updatedPlayer.properties[targetColor] = { ...propSet };
                delete targetPlayer.properties[targetColor];
                propSet.cards.forEach((c) => triggerCardEffect(c.id, 'steal'));
                match.logs.push({
                  id: `db-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  message: `${activePlayer.username}, ${targetPlayer.username} adlı oyuncunun tamamlanmış ${COLOR_LABELS[targetColor]} setini Anlaşma Bozan kartı ile çaldı!`,
                  timestamp: Date.now(),
                });
                showActionToast(
                  'deal-breaker',
                  '⚡ Anlaşma Bozan Oynandı!',
                  `${activePlayer.username}, ${targetPlayer.username} adlı oyuncunun tamamlanmış "${COLOR_LABELS[targetColor]}" setini çaldı!`,
                  targetPlayer
                );
              }
            }
          }
        }
      } else if (card.actionType === 'forced-deal') {
        const targetId = payload?.targetPlayerId;
        const cardIdToSteal = payload?.targetCardId;
        const myCardIdToGive = payload?.myCardId;
        if (targetId && cardIdToSteal && myCardIdToGive) {
          const targetPlayer = match.players.find((p) => p.id === targetId);
          if (targetPlayer) {
            const jsnIdx = targetPlayer.hand.findIndex((c) => c.actionType === 'just-say-no');
            if (jsnIdx !== -1) {
              const jsnCard = targetPlayer.hand.splice(jsnIdx, 1)[0];
              updatedDiscard.push(jsnCard);
              match.logs.push({
                id: `bot-jsn-${Date.now()}`,
                message: `🛡️ ${targetPlayer.username} 'Hayır Deme Hakkı' (Reddet) kartını kullanarak senin Zoraki Takas hamleni engelledi!`,
                timestamp: Date.now(),
              });
              playJsnSound();

              match.activeActionRequest = {
                id: `req-${Date.now()}`,
                type: 'just-say-no',
                sourcePlayerId: targetPlayer.id,
                targetPlayerId: activePlayer.id,
                actionCard: card,
                targetCardId: cardIdToSteal,
                myCardId: myCardIdToGive,
                originalAction: {
                  type: 'forced-deal',
                  payload: { targetPlayerId: targetId, targetCardId: cardIdToSteal, myCardId: myCardIdToGive }
                },
                jsnCount: 1
              };
            } else {
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

              for (const colKey in updatedPlayer.properties) {
                const col = colKey as CardColor;
                const propSet = updatedPlayer.properties[col];
                if (propSet) {
                  const idx = propSet.cards.findIndex((c) => c.id === myCardIdToGive);
                  if (idx !== -1) {
                    givenCard = propSet.cards.splice(idx, 1)[0];
                    givenColor = col;
                    if (propSet.cards.length === 0) {
                      delete updatedPlayer.properties[col];
                    }
                    break;
                  }
                }
              }

              if (stolenCard && givenCard) {
                const colS = stolenCard.color || stolenColor || 'brown';
                if (!updatedPlayer.properties[colS]) {
                  updatedPlayer.properties[colS] = { cards: [], hasHouse: false, hasHotel: false };
                }
                updatedPlayer.properties[colS]!.cards.push(stolenCard);

                const colG = givenCard.color || givenColor || 'brown';
                if (!targetPlayer.properties[colG]) {
                  targetPlayer.properties[colG] = { cards: [], hasHouse: false, hasHotel: false };
                }
                targetPlayer.properties[colG]!.cards.push(givenCard);

                triggerCardEffect(stolenCard.id, 'steal');
                triggerCardEffect(givenCard.id, 'steal');

                match.logs.push({
                  id: `fd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  message: `${activePlayer.username}, ${targetPlayer.username} ile Zoraki Takas yaptı! ${givenCard.name} verdi ve ${stolenCard.name} aldı.`,
                  timestamp: Date.now(),
                });
                // Enforce building rules on both players because swaps could break sets for either of them
                enforceBuildingRules(updatedPlayer, match.discardPile);
                enforceBuildingRules(targetPlayer, match.discardPile);
                showActionToast(
                  'forced-deal',
                  '⇄ Zorunlu Anlaşma Oynandı!',
                  `${activePlayer.username}, ${targetPlayer.username} adlı oyuncu ile takas yaptı: "${givenCard.name}" mülkünü verdi, karşılığında "${stolenCard.name}" mülkünü aldı!`,
                  targetPlayer
                );
              }
            }
          }
        }
      }
    }

    const nextActionsCount = match.actionsPlayedThisTurn + actionsCost;

    const nextMatch = {
      ...match,
      players: updatedPlayers,
      discardPile: updatedDiscard,
      actionsPlayedThisTurn: nextActionsCount,
    };

    // Check if any player has won
    let offlineWinnerId: string | null = null;
    for (const p of updatedPlayers) {
      if (checkWinnerWithSettings(p.properties)) {
        offlineWinnerId = p.id;
        break;
      }
    }

    if (offlineWinnerId) {
      const winner = updatedPlayers.find((p) => p.id === offlineWinnerId);
      nextMatch.status = 'finished';
      nextMatch.winnerId = offlineWinnerId;
      nextMatch.logs.push({
        id: `win-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        message: `Maçı ${winner?.username} kazandı! Oyun bitti.`,
        timestamp: Date.now()
      });

      setMatch(nextMatch);

      const allowPracticeRewards = isOffline ? (adminSettings?.botPracticeRewardsEnabled === true) : true;

      if (allowPracticeRewards) {
        const totalOfflinePlayers = updatedPlayers.length || 4;
        const playerCountScale = totalOfflinePlayers >= 4 ? 1.0 : (totalOfflinePlayers === 3 ? 0.75 : 0.50);

        // Award XP/Coins to the profile if the local player won
        if (offlineWinnerId === profile.id) {
          sounds.playCelebration(profile.settings.celebrationSound, profile.settings);
          const coinsEarned = Math.round(150 * (adminSettings?.goldMultiplier || 1.0) * playerCountScale);
          const xpEarned = Math.round(100 * playerCountScale);

          const updatedProfile = {
            ...profile,
            coins: profile.coins + coinsEarned,
            xp: profile.xp + xpEarned,
          };
          updatedProfile.stats.gamesPlayed++;
          updatedProfile.stats.gamesWon++;
          updatedProfile.stats.totalSetsCompleted += 3;
          // Complete daily quest
          updatedProfile.dailyQuests.forEach((q) => {
            if (q.description.includes('bot') || q.description.includes('Pratik')) {
              q.currentValue = Math.min(q.targetValue, q.currentValue + 1);
              if (q.currentValue >= q.targetValue) q.completed = true;
            }
          });

          if (!updatedProfile.gamesHistory) updatedProfile.gamesHistory = [];
          const dateStr = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
          updatedProfile.gamesHistory.unshift({
            id: `match-offline-${Date.now()}`,
            date: dateStr,
            opponent: updatedPlayers.filter((p) => p.id !== profile.id).map((p) => p.username).join(', '),
            result: 'won',
            xpEarned,
            coinsEarned
          });

          onUpdateProfile(updatedProfile);
        } else {
          // Local player lost
          sounds.playDefeat(profile.settings);
          // In 2-player mode, loser gets 0 coins
          const coinsEarned = totalOfflinePlayers <= 2 ? 0 : Math.round(30 * (adminSettings?.goldMultiplier || 1.0) * playerCountScale);
          const xpEarned = Math.round(20 * playerCountScale);

          const updatedProfile = {
            ...profile,
            coins: profile.coins + coinsEarned,
            xp: profile.xp + xpEarned,
          };
          updatedProfile.stats.gamesPlayed++;
          updatedProfile.stats.gamesLost++;

          if (!updatedProfile.gamesHistory) updatedProfile.gamesHistory = [];
          const dateStr = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
          updatedProfile.gamesHistory.unshift({
            id: `match-offline-${Date.now()}`,
            date: dateStr,
            opponent: updatedPlayers.filter((p) => p.id !== profile.id).map((p) => p.username).join(', '),
            result: 'lost',
            xpEarned,
            coinsEarned
          });
          onUpdateProfile(updatedProfile);
        }
      } else {
        if (offlineWinnerId === profile.id) {
          sounds.playCelebration(profile.settings.celebrationSound, profile.settings);
        } else {
          sounds.playDefeat(profile.settings);
        }
      }
    } else {
      setMatch(nextMatch);
    }

    setSelectedCard(null);
    setShowCardMenu(false);
  };

  const enforceBuildingRules = (player: GamePlayer, discardPile: Card[]) => {
    Object.keys(player.properties).forEach((colorKey) => {
      const col = colorKey as CardColor;
      const set = player.properties[col];
      if (!set) return;

      const maxRequired = MAX_IN_SET[col];
      const actualCount = set.cards.length;

      // If set is broken, strip any built houses or hotels and return to discard
      if (actualCount < maxRequired) {
        if (set.hasHotel) {
          discardPile.push({
            id: `hotel-disc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'house-hotel',
            name: 'Otel',
            value: 4,
            actionType: 'hotel',
            description: 'Evi olan tamamlanmış bir sete eklenir ve kira bedelini +4M artırır. Set başına maksimum 1 otel.',
          });
          set.hasHotel = false;
          match?.logs.push({
            id: `building-loss-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            message: `Sayı yetersizliğinden dolayı ${player.username} adlı oyuncunun ${COLOR_LABELS[col]} setindeki Otel yıkıldı ve ıskartaya gitti.`,
            timestamp: Date.now(),
          });
        }
        if (set.hasHouse) {
          discardPile.push({
            id: `house-disc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'house-hotel',
            name: 'Ev',
            value: 3,
            actionType: 'house',
            description: 'Tamamlanmış bir sete eklenir ve kira bedelini +3M artırır. Set başına maksimum 1 ev.',
          });
          set.hasHouse = false;
          match?.logs.push({
            id: `building-loss-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            message: `Sayı yetersizliğinden dolayı ${player.username} adlı oyuncunun ${COLOR_LABELS[col]} setindeki Ev yıkıldı ve ıskartaya gitti.`,
            timestamp: Date.now(),
          });
        }
      }
    });
  };

  const transferOfflinePayment = (fromId: string, toId: string, cardIds: string[]) => {
    if (!match) return;

    const giver = match.players.find((p) => p.id === fromId);
    const receiver = match.players.find((p) => p.id === toId);
    if (!giver || !receiver) return;

    let valueTransferred = 0;

    cardIds.forEach((cid) => {
      // check bank
      const bIdx = giver.bank.findIndex((c) => c.id === cid);
      if (bIdx !== -1) {
        const card = giver.bank.splice(bIdx, 1)[0];
        receiver.bank.push(card);
        valueTransferred += card.value;
      } else {
        // check properties
        for (const colKey in giver.properties) {
          const col = colKey as CardColor;
          const set = giver.properties[col];
          if (set) {
            const pIdx = set.cards.findIndex((c) => c.id === cid);
            if (pIdx !== -1) {
              const card = set.cards.splice(pIdx, 1)[0];
              if (!receiver.properties[col]) {
                receiver.properties[col] = { cards: [], hasHouse: false, hasHotel: false };
              }
              receiver.properties[col]!.cards.push(card);
              valueTransferred += card.value;
              break;
            }
          }
        }
      }
    });

    // Enforce building rules for the giver because their sets might have been broken by paying with properties
    enforceBuildingRules(giver, match.discardPile);

    match.logs.push({
      id: `pay-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      message: `${giver.username}, ${receiver.username} adlı oyuncuya ${valueTransferred}M değerinde ödeme transferi yaptı.`,
      timestamp: Date.now(),
    });
    playCoinSound();

    // Track Career Stats & show beautiful action toast
    if (receiver.id === profile.id) {
      addCareerRent(valueTransferred);
    }

    // Check if receiver (we) bankrupted this player
    const giverBankTotal = giver.bank.reduce((sum, c) => sum + c.value, 0);
    const giverPropsTotal = Object.values(giver.properties).reduce((sum, set: any) => sum + (set?.cards?.length || 0), 0);
    if (giverBankTotal === 0 && giverPropsTotal === 0) {
      if (receiver.id === profile.id) {
        incrementCareerStat('bankruptcies');
        match.logs.push({
          id: `bankrupt-${Date.now()}`,
          message: `💥 ${giver.username} adlı oyuncu iflas etti! Tüm varlıkları ${receiver.username} adlı oyuncuya devredildi.`,
          timestamp: Date.now()
        });
      }
    }

    // Show toast with details
    showActionToast(
      'rent',
      '💰 Kira / Borç Ödemesi',
      `${giver.username}, ${receiver.username} adlı oyuncuya toplam ${valueTransferred}M değerinde ödeme transfer etti.`,
      giver
    );
  };

  const handleOfflineEndTurn = () => {
    if (!match) return;

    if (isActionLocked) {
      playAlertSound();
      alert("Aktif bir ödeme veya hamle talebi varken turunuzu sonlandıramazsınız!");
      return;
    }

    const player = match.players[match.turnIndex];
    if (player.hand.length > 7) {
      playAlertSound();
      setShowDiscardModal(true);
      return;
    }

    if (player.id === profile.id) {
      playCustomVoiceoverFile('end_turn.mp3');
    }

    // Move turn to Bot / Next Player
    const nextTurnIdx = (match.turnIndex + 1) % match.players.length;
    match.turnIndex = nextTurnIdx;
    match.actionsPlayedThisTurn = 0;

    if (nextTurnIdx === 0) {
      match.turnNumber = (match.turnNumber || 1) + 1;
      match.logs.push({
        id: `round-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        message: `🔄 ${match.turnNumber}. Tur Başladı!`,
        timestamp: Date.now(),
        turnNumber: match.turnNumber,
      });
    }

    const nextPlayer = match.players[nextTurnIdx];
    match.logs.push({
      id: `turn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      message: `Sıra ${nextPlayer.username} adlı ${nextPlayer.isBot ? 'yapay zekaya' : 'oyuncuya'} geçti.`,
      timestamp: Date.now(),
      turnNumber: match.turnNumber || 1,
    });

    triggerOfflineDraw(match);

    // Auto Bot Turn
    if (nextPlayer.isBot) {
      scheduleBotTurnOffline(() => executeBotTurnOffline(), 1500);
    }
  };

  const scheduleBotTurnOffline = (callback: () => void, delay: number) => {
    if (botTimeoutRef.current) {
      clearTimeout(botTimeoutRef.current);
    }
    botTimeoutRef.current = setTimeout(() => {
      botTimeoutRef.current = null;
      callback();
    }, delay);
  };

  const resumeBotTurnOffline = () => {
    const currentMatch = matchRef.current;
    if (!currentMatch) return;
    const bot = currentMatch.players[currentMatch.turnIndex];
    if (bot && bot.isBot) {
      executeBotTurnOffline(botActionsPlayedRef.current);
    }
  };

  const executeBotTurnOffline = (initialActionsCount = 0) => {
    if (botTimeoutRef.current) {
      clearTimeout(botTimeoutRef.current);
      botTimeoutRef.current = null;
    }
    const currentMatch = matchRef.current;
    if (!currentMatch) return;

    const bot = currentMatch.players[currentMatch.turnIndex];
    if (!bot || !bot.isBot) return;

    setBotIsThinking(true);

    const human = currentMatch.players.find((p) => !p.isBot);
    botActionsPlayedRef.current = initialActionsCount;

    const playNextBotAction = () => {
      const activeMatch = matchRef.current;
      if (!activeMatch) return;
      if (activeMatch.activeActionRequest) {
        // Pause bot actions while human has a pending payment request
        return;
      }
      // Re-verify it is still playing and it is this bot's turn
      const currentBot = activeMatch.players[activeMatch.turnIndex];
      if (!currentBot || !currentBot.isBot) return;
      if (activeMatch.status !== 'playing' || currentBot.id !== bot.id) return;

      if (botActionsPlayedRef.current >= 3) {
        endBotTurn();
        return;
      }

      const decision = BotEngine.selectPlayAction(currentBot, activeMatch, botDifficulty);
      if (!decision) {
        endBotTurn();
        return;
      }

      const cardIdx = currentBot.hand.findIndex((c) => c.id === decision.cardId);
      if (cardIdx === -1) {
        endBotTurn();
        return;
      }

      const card = currentBot.hand[cardIdx];
      const activeHuman = activeMatch.players.find((p) => !p.isBot);

      if (decision.targetZone === 'bank') {
        currentBot.hand.splice(cardIdx, 1);
        currentBot.bank.push(card);
        activeMatch.logs.push({
          id: `bot-play-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          message: `${currentBot.username}, bankaya ${card.value}M para ekledi.`,
          timestamp: Date.now(),
        });

        updateMatchState({ ...activeMatch });
        botActionsPlayedRef.current++;
        scheduleBotTurnOffline(playNextBotAction, botDelay);

      } else if (decision.targetZone === 'property') {
        currentBot.hand.splice(cardIdx, 1);
        const col = decision.extraColor || card.color || 'brown';

        if (!currentBot.properties[col]) {
          currentBot.properties[col] = { cards: [], hasHouse: false, hasHotel: false };
        }

        if (card.type === 'house-hotel') {
          if (card.actionType === 'house') currentBot.properties[col]!.hasHouse = true;
          else currentBot.properties[col]!.hasHotel = true;
          activeMatch.logs.push({
            id: `bot-play-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            message: `${currentBot.username}, ${COLOR_LABELS[col]} grubuna ${card.name} dikti.`,
            timestamp: Date.now(),
          });
        } else {
          currentBot.properties[col]!.cards.push({ ...card, color: col });
          activeMatch.logs.push({
            id: `bot-play-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            message: `${currentBot.username}, ${COLOR_LABELS[col]} grubuna mülk yerleştirdi.`,
            timestamp: Date.now(),
          });
        }

        if (checkWinnerWithSettings(currentBot.properties)) {
          handleOfflineWinner(currentBot.id);
          return;
        }

        updateMatchState({ ...activeMatch });
        botActionsPlayedRef.current++;
        scheduleBotTurnOffline(playNextBotAction, botDelay);

      } else if (decision.targetZone === 'action') {
        currentBot.hand.splice(cardIdx, 1);
        activeMatch.discardPile.push(card);
        activeMatch.logs.push({
          id: `bot-play-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          message: `${currentBot.username} aksiyon kartı oynadı: ${card.name}`,
          timestamp: Date.now(),
        });

        if (card.actionType === 'pass-go') {
          const serverDeck: Card[] = (activeMatch as any).serverDeck || [];
          const drawn = serverDeck.splice(0, 2);
          currentBot.hand.push(...drawn);
          activeMatch.deckCount = serverDeck.length;
          (activeMatch as any).serverDeck = serverDeck;
          activeMatch.logs.push({
            id: `bot-passgo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            message: `${currentBot.username} Başlangıç Noktasından Geçti ve 2 kart çekti!`,
            timestamp: Date.now(),
          });
          updateMatchState({ ...activeMatch });
          botActionsPlayedRef.current++;
          scheduleBotTurnOffline(playNextBotAction, botDelay);

        } else if (card.actionType === 'birthday' && activeHuman) {
          // Pause and request payment from the human player interactively!
          activeMatch.activeActionRequest = {
            id: `req-${Date.now()}`,
            type: 'make-payment',
            sourcePlayerId: currentBot.id,
            targetPlayerId: activeHuman.id,
            actionCard: card,
            amountDue: 2,
          };
          activeMatch.logs.push({
            id: `bot-bday-req-${Date.now()}`,
            message: `📣 ${currentBot.username} doğum günü kartı oynadı ve herkesten 2M talep ediyor!`,
            timestamp: Date.now(),
          });
          showActionToast(
            'info',
            '🎂 Doğum Günü Kutlaması!',
            `${currentBot.username} bir doğum günü partisi düzenledi! Senden 2M hediye talep ediyor!`,
            activeHuman
          );
          updateMatchState({ ...activeMatch });
          botActionsPlayedRef.current++;

        } else if (card.actionType === 'debt-collector' && activeHuman) {
          const humanHasJsn = activeHuman.hand.some((c) => c.actionType === 'just-say-no');
          if (humanHasJsn) {
            activeMatch.activeActionRequest = {
              id: `req-${Date.now()}`,
              type: 'just-say-no',
              sourcePlayerId: currentBot.id,
              targetPlayerId: activeHuman.id,
              actionCard: card,
              amountDue: 5,
              originalAction: {
                type: 'debt-collector',
                payload: { targetPlayerId: activeHuman.id }
              },
              jsnCount: 0
            };
            activeMatch.logs.push({
              id: `bot-debt-jsn-${Date.now()}`,
              message: `📣 ${currentBot.username} Borç Tahsildarı kartı oynadı! Elinde 'Hayır Teşekkürler' kartı olduğu için savunma yapabilirsin!`,
              timestamp: Date.now(),
            });
            showActionToast(
              'debt-collector',
              '💼 Borç Tahsilatı Engeli!',
              `${currentBot.username} Borç Tahsildarı kartı oynadı! Elinde 'Hayır Teşekkürler' kartı olduğu için savunma yapabilirsin!`,
              activeHuman
            );
          } else {
            // Pause and request payment from the human player interactively!
            activeMatch.activeActionRequest = {
              id: `req-${Date.now()}`,
              type: 'make-payment',
              sourcePlayerId: currentBot.id,
              targetPlayerId: activeHuman.id,
              actionCard: card,
              amountDue: 5,
            };
            activeMatch.logs.push({
              id: `bot-debt-req-${Date.now()}`,
              message: `📣 ${currentBot.username} Borç Tahsildarı kartı oynadı ve senden 5M talep ediyor!`,
              timestamp: Date.now(),
            });
            showActionToast(
              'debt-collector',
              '💼 Haciz / Borç Tahsilatı!',
              `${currentBot.username} Tahsilat (Haciz) kartı oynadı! Senden 5M borç ödemeni istiyor!`,
              activeHuman
            );
          }
          updateMatchState({ ...activeMatch });
          botActionsPlayedRef.current++;

        } else if (card.type === 'rent' && activeHuman) {
          const chosenColor = decision.extraColor || 'brown';
          const isDouble = decision.payload?.isDoubleRent || false;
          const set = currentBot.properties[chosenColor];
          if (set && set.cards.length > 0) {
            const baseCount = Math.min(set.cards.length, MAX_IN_SET[chosenColor]);
            let rentVal = set.cards[0].rentValues?.[baseCount - 1] || 1;
            if (set.hasHouse) rentVal += 3;
            if (set.hasHotel) rentVal += 4;
            if (isDouble) {
              rentVal *= 2;
              const drIdx = currentBot.hand.findIndex((c) => c.actionType === 'double-rent');
              if (drIdx !== -1) {
                const drCard = currentBot.hand.splice(drIdx, 1)[0];
                activeMatch.discardPile.push(drCard);
                activeMatch.logs.push({
                  id: `bot-play-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  message: `${currentBot.username} Kirayı İkiye Katla kartını oynadı!`,
                  timestamp: Date.now(),
                });
              }
            }
            // Pause and request rent from the human player interactively!
            activeMatch.activeActionRequest = {
              id: `req-${Date.now()}`,
              type: 'make-payment',
              sourcePlayerId: currentBot.id,
              targetPlayerId: activeHuman.id,
              actionCard: card,
              amountDue: rentVal,
            };
            activeMatch.logs.push({
              id: `bot-rent-req-${Date.now()}`,
              message: `📣 ${currentBot.username}, ${COLOR_LABELS[chosenColor]} mülkleri için senden ${rentVal}M kira talep ediyor!`,
              timestamp: Date.now(),
            });
            showActionToast(
              'rent',
              '💰 Kira Tahsilat Talebi!',
              `${currentBot.username}, ${COLOR_LABELS[chosenColor]} mülkleri için senden ${rentVal}M kira talep ediyor!`,
              activeHuman
            );
          }
          updateMatchState({ ...activeMatch });
          botActionsPlayedRef.current++;

        } else if (card.actionType === 'sly-deal' && activeHuman) {
          const cardIdToSteal = decision.payload?.targetCardId;
          if (cardIdToSteal) {
            const humanHasJsn = activeHuman.hand.some((c) => c.actionType === 'just-say-no');
            if (humanHasJsn) {
              activeMatch.activeActionRequest = {
                id: `req-${Date.now()}`,
                type: 'just-say-no',
                sourcePlayerId: currentBot.id,
                targetPlayerId: activeHuman.id,
                actionCard: card,
                targetCardId: cardIdToSteal,
                originalAction: {
                  type: 'sly-deal',
                  payload: { targetPlayerId: activeHuman.id, targetCardId: cardIdToSteal }
                },
                jsnCount: 0
              };
              activeMatch.logs.push({
                id: `bot-sly-jsn-${Date.now()}`,
                message: `📣 ${currentBot.username} Sinsi Anlaşma oynadı! Elinde 'Hayır Teşekkürler' kartı olduğu için savunma yapabilirsin!`,
                timestamp: Date.now(),
              });
              showActionToast(
                'sly-deal',
                '🥷 Sinsi Anlaşma Engeli!',
                `${currentBot.username} senden bir mülk çalmaya çalışıyor! Elinde 'Hayır Teşekkürler' kartı olduğu için savunma yapabilirsin!`,
                activeHuman
              );
            } else {
              let stolenCard: Card | null = null;
              let stolenColor: CardColor | null = null;
              for (const colKey in activeHuman.properties) {
                const col = colKey as CardColor;
                const propSet = activeHuman.properties[col];
                if (propSet) {
                  const idx = propSet.cards.findIndex((c) => c.id === cardIdToSteal);
                  if (idx !== -1) {
                    stolenCard = propSet.cards.splice(idx, 1)[0];
                    stolenColor = col;
                    if (propSet.cards.length === 0) {
                      delete activeHuman.properties[col];
                    }
                    break;
                  }
                }
              }
              if (stolenCard) {
                const col = stolenCard.color || stolenColor || 'brown';
                if (!currentBot.properties[col]) {
                  currentBot.properties[col] = { cards: [], hasHouse: false, hasHotel: false };
                }
                currentBot.properties[col]!.cards.push(stolenCard);
                triggerCardEffect(stolenCard.id, 'steal');
                activeMatch.logs.push({
                  id: `bot-sly-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  message: `${currentBot.username}, senden ${stolenCard.name} mülkünü sinsi anlaşma ile çaldı!`,
                  timestamp: Date.now(),
                });
                enforceBuildingRules(activeHuman, activeMatch.discardPile);

                showActionToast(
                  'sly-deal',
                  '🥷 Sinsi Anlaşma Oynandı!',
                  `${currentBot.username} senden "${stolenCard.name}" mülkünü çaldı!`,
                  activeHuman
                );
              }
              scheduleBotTurnOffline(playNextBotAction, botPaymentDelay);
            }
          }
          updateMatchState({ ...activeMatch });
          botActionsPlayedRef.current++;

        } else if (card.actionType === 'deal-breaker' && activeHuman) {
          const targetColor = decision.payload?.targetColor as CardColor;
          if (targetColor) {
            const humanHasJsn = activeHuman.hand.some((c) => c.actionType === 'just-say-no');
            if (humanHasJsn) {
              activeMatch.activeActionRequest = {
                id: `req-${Date.now()}`,
                type: 'just-say-no',
                sourcePlayerId: currentBot.id,
                targetPlayerId: activeHuman.id,
                actionCard: card,
                targetColor: targetColor,
                originalAction: {
                  type: 'deal-breaker',
                  payload: { targetPlayerId: activeHuman.id, targetColor: targetColor }
                },
                jsnCount: 0
              };
              activeMatch.logs.push({
                id: `bot-db-jsn-${Date.now()}`,
                message: `📣 ${currentBot.username} Anlaşma Bozan oynadı! Elinde 'Hayır Teşekkürler' kartı olduğu için savunma yapabilirsin!`,
                timestamp: Date.now(),
              });
              showActionToast(
                'deal-breaker',
                '⚡ Anlaşma Bozan Engeli!',
                `${currentBot.username} tamamlanmış setini çalmaya çalışıyor! Elinde 'Hayır Teşekkürler' kartı olduğu için savunma yapabilirsin!`,
                activeHuman
              );
            } else {
              const propSet = activeHuman.properties[targetColor];
              if (propSet) {
                currentBot.properties[targetColor] = { ...propSet };
                delete activeHuman.properties[targetColor];
                propSet.cards.forEach((c) => triggerCardEffect(c.id, 'steal'));
                activeMatch.logs.push({
                  id: `bot-db-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  message: `${currentBot.username}, tamamlanmış ${COLOR_LABELS[targetColor]} setini Anlaşma Bozan kartı ile çaldı!`,
                  timestamp: Date.now(),
                });

                showActionToast(
                  'deal-breaker',
                  '⚡ Anlaşma Bozan Oynandı!',
                  `${currentBot.username} senin tamamlanmış "${COLOR_LABELS[targetColor]}" setini çaldı!`,
                  activeHuman
                );
              }
              scheduleBotTurnOffline(playNextBotAction, botPaymentDelay);
            }
          }
          updateMatchState({ ...activeMatch });
          botActionsPlayedRef.current++;

        } else if (card.actionType === 'forced-deal' && activeHuman) {
          const cardIdToSteal = decision.payload?.targetCardId;
          const myCardIdToGive = decision.payload?.myCardId;
          if (cardIdToSteal && myCardIdToGive) {
            const humanHasJsn = activeHuman.hand.some((c) => c.actionType === 'just-say-no');
            if (humanHasJsn) {
              activeMatch.activeActionRequest = {
                id: `req-${Date.now()}`,
                type: 'just-say-no',
                sourcePlayerId: currentBot.id,
                targetPlayerId: activeHuman.id,
                actionCard: card,
                targetCardId: cardIdToSteal,
                myCardId: myCardIdToGive,
                originalAction: {
                  type: 'forced-deal',
                  payload: { targetPlayerId: activeHuman.id, targetCardId: cardIdToSteal, myCardId: myCardIdToGive }
                },
                jsnCount: 0
              };
              activeMatch.logs.push({
                id: `bot-fd-jsn-${Date.now()}`,
                message: `📣 ${currentBot.username} Zoraki Takas oynadı! Elinde 'Hayır Teşekkürler' kartı olduğu için savunma yapabilirsin!`,
                timestamp: Date.now(),
              });
              showActionToast(
                'forced-deal',
                '⇄ Zoraki Takas Engeli!',
                `${currentBot.username} seninle zoraki takas yapmaya çalışıyor! Elinde 'Hayır Teşekkürler' kartı olduğu için savunma yapabilirsin!`,
                activeHuman
              );
            } else {
              let stolenCard: Card | null = null;
              let givenCard: Card | null = null;
              let stolenColor: CardColor | null = null;
              let givenColor: CardColor | null = null;

              for (const colKey in activeHuman.properties) {
                const col = colKey as CardColor;
                const propSet = activeHuman.properties[col];
                if (propSet) {
                  const idx = propSet.cards.findIndex((c) => c.id === cardIdToSteal);
                  if (idx !== -1) {
                    stolenCard = propSet.cards.splice(idx, 1)[0];
                    stolenColor = col;
                    if (propSet.cards.length === 0) {
                      delete activeHuman.properties[col];
                    }
                    break;
                  }
                }
              }

              for (const colKey in currentBot.properties) {
                const col = colKey as CardColor;
                const propSet = currentBot.properties[col];
                if (propSet) {
                  const idx = propSet.cards.findIndex((c) => c.id === myCardIdToGive);
                  if (idx !== -1) {
                    givenCard = propSet.cards.splice(idx, 1)[0];
                    givenColor = col;
                    if (propSet.cards.length === 0) {
                      delete currentBot.properties[col];
                    }
                    break;
                  }
                }
              }

              if (stolenCard && givenCard) {
                const colS = stolenCard.color || stolenColor || 'brown';
                if (!currentBot.properties[colS]) {
                  currentBot.properties[colS] = { cards: [], hasHouse: false, hasHotel: false };
                }
                currentBot.properties[colS]!.cards.push(stolenCard);

                const colG = givenCard.color || givenColor || 'brown';
                if (!activeHuman.properties[colG]) {
                  activeHuman.properties[colG] = { cards: [], hasHouse: false, hasHotel: false };
                }
                activeHuman.properties[colG]!.cards.push(givenCard);

                triggerCardEffect(stolenCard.id, 'steal');
                triggerCardEffect(givenCard.id, 'steal');

                activeMatch.logs.push({
                  id: `bot-fd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  message: `${currentBot.username}, seninle Zoraki Takas yaptı! ${givenCard.name} verdi ve ${stolenCard.name} aldı.`,
                  timestamp: Date.now(),
                });

                enforceBuildingRules(activeHuman, activeMatch.discardPile);
                enforceBuildingRules(currentBot, activeMatch.discardPile);

                showActionToast(
                  'forced-deal',
                  '⇄ Zorunlu Anlaşma Oynandı!',
                  `${currentBot.username} seninle takas yaptı: Sana "${givenCard.name}" mülkünü verdi, karşılığında "${stolenCard.name}" mülkünü aldı!`,
                  activeHuman
                );
              }
              scheduleBotTurnOffline(playNextBotAction, botPaymentDelay);
            }
          }
          updateMatchState({ ...activeMatch });
          botActionsPlayedRef.current++;
        } else {
          updateMatchState({ ...activeMatch });
          botActionsPlayedRef.current++;
          scheduleBotTurnOffline(playNextBotAction, botFinishDelay);
        }
      }
    };
    const endBotTurn = () => {
      setBotIsThinking(false);
      const activeMatch = matchRef.current;
      if (!activeMatch) return;

      const currentBot = activeMatch.players[activeMatch.turnIndex];
      if (!currentBot) return;

      // Bot discard excess
      while (currentBot.hand.length > 7) {
        const discId = BotEngine.selectDiscardCard(currentBot);
        if (discId) {
          const idx = currentBot.hand.findIndex((c) => c.id === discId);
          if (idx !== -1) {
            const card = currentBot.hand.splice(idx, 1)[0];
            activeMatch.discardPile.push(card);
            activeMatch.logs.push({
              id: `bot-disc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              message: `${currentBot.username} elinden fazla olan ${card.name} kartını attı.`,
              timestamp: Date.now(),
            });
          }
        }
      }

      // End Bot Turn & Move to Next Player
      const nextTurnIdx = (activeMatch.turnIndex + 1) % activeMatch.players.length;
      activeMatch.turnIndex = nextTurnIdx;
      activeMatch.actionsPlayedThisTurn = 0;

      if (nextTurnIdx === 0) {
        activeMatch.turnNumber = (activeMatch.turnNumber || 1) + 1;
        activeMatch.logs.push({
          id: `round-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          message: `🔄 ${activeMatch.turnNumber}. Tur Başladı!`,
          timestamp: Date.now(),
          turnNumber: activeMatch.turnNumber,
        });
      }

      const nextPlayer = activeMatch.players[nextTurnIdx];
      if (nextPlayer.isBot) {
        activeMatch.logs.push({
          id: `turn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          message: `Sıra ${nextPlayer.username} adlı yapay zekaya geçti.`,
          timestamp: Date.now(),
          turnNumber: activeMatch.turnNumber || 1,
        });
        triggerOfflineDraw(activeMatch);
        updateMatchState({ ...activeMatch });
        scheduleBotTurnOffline(() => executeBotTurnOffline(), 1500);
      } else {
        activeMatch.logs.push({
          id: `turn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          message: `Sıra tekrar senin! Başarılar.`,
          timestamp: Date.now(),
          turnNumber: activeMatch.turnNumber || 1,
        });
        triggerOfflineDraw(activeMatch);
        updateMatchState({ ...activeMatch });
      }
    };

    playNextBotAction();
  };

  const handleOfflineWinner = (winnerId: string) => {
    if (!match) return;

    const winner = match.players.find((p) => p.id === winnerId);
    setMatch({
      ...match,
      status: 'finished',
      winnerId,
      logs: [
        ...match.logs,
        { id: `win-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, message: `Maçı ${winner?.username} kazandı! Oyun bitti.`, timestamp: Date.now() },
      ],
    });

    // Check if this is a tournament match
    if (roomId.startsWith('tournament:')) {
      const parts = roomId.split(':');
      const tId = parts[1];
      const mId = parts[2];
      const oppName = parts[3] || 'Bot Can';
      const winnerName = winnerId === profile.id ? profile.username : oppName;

      fetch(`${API_BASE_URL}/api/tournaments/match/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: tId,
          matchId: mId,
          winnerName,
          score1: winnerId === profile.id ? 3 : 1,
          score2: winnerId === profile.id ? 1 : 3,
        }),
      }).catch(console.error);
    }

    const allowPracticeRewards = isOffline ? (adminSettings?.botPracticeRewardsEnabled === true) : true;

    if (allowPracticeRewards) {
      // Award XP/Coins to the profile
      if (winnerId === profile.id) {
        sounds.playCelebration(profile.settings.celebrationSound, profile.settings);
        const updatedProfile = {
          ...profile,
          coins: profile.coins + Math.round(150 * (adminSettings?.goldMultiplier || 1.0)),
          xp: profile.xp + 100,
        };
        updatedProfile.stats.gamesPlayed++;
        updatedProfile.stats.gamesWon++;
        updatedProfile.stats.totalSetsCompleted += 3;
        // Complete daily quest
        updatedProfile.dailyQuests.forEach((q) => {
          if (q.description.includes('bot') || q.description.includes('Pratik')) {
            q.currentValue = Math.min(q.targetValue, q.currentValue + 1);
            if (q.currentValue >= q.targetValue) q.completed = true;
          }
        });

        if (!updatedProfile.gamesHistory) updatedProfile.gamesHistory = [];
        const dateStr = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        updatedProfile.gamesHistory.unshift({
          id: `match-offline-${Date.now()}`,
          date: dateStr,
          opponent: 'Bot Memo, Bot Can',
          result: 'won',
          coinsEarned: Math.round(150 * (adminSettings?.goldMultiplier || 1.0)),
          xpEarned: 100,
        });

        onUpdateProfile(updatedProfile);
      } else {
        sounds.playDefeat(profile.settings);
        const updatedProfile = {
          ...profile,
          coins: profile.coins + Math.round(30 * (adminSettings?.goldMultiplier || 1.0)),
          xp: profile.xp + 30,
        };
        updatedProfile.stats.gamesPlayed++;
        updatedProfile.stats.gamesLost++;

        if (!updatedProfile.gamesHistory) updatedProfile.gamesHistory = [];
        const dateStr = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        updatedProfile.gamesHistory.unshift({
          id: `match-offline-${Date.now()}`,
          date: dateStr,
          opponent: 'Bot Memo, Bot Can',
          result: 'lost',
          coinsEarned: Math.round(30 * (adminSettings?.goldMultiplier || 1.0)),
          xpEarned: 30,
        });

        onUpdateProfile(updatedProfile);
      }
    } else {
      if (winnerId === profile.id) {
        sounds.playCelebration(profile.settings.celebrationSound, profile.settings);
      } else {
        sounds.playDefeat(profile.settings);
      }
    }
  };

  const handleOfflineDiscard = (cardId: string) => {
    if (!match) return;
    const player = match.players[0];
    const idx = player.hand.findIndex((c) => c.id === cardId);
    if (idx !== -1) {
      const card = player.hand.splice(idx, 1)[0];
      match.discardPile.push(card);
      match.logs.push({
        id: `disc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        message: `${player.username} elinden ${card.name} kartını attı.`,
        timestamp: Date.now(),
      });
      playCardDiscardSound();
      setMatch({ ...match });
    }
  };

  const handleOfflineChangeWildcardColor = (cardId: string, newColor: CardColor) => {
    if (!match) return;

    const activePlayer = match.players[match.turnIndex];
    const updatedPlayers = [...match.players];
    const updatedPlayer = { ...activePlayer };
    updatedPlayers[match.turnIndex] = updatedPlayer;

    let foundCard: Card | null = null;

    for (const colKey in updatedPlayer.properties) {
      const col = colKey as CardColor;
      const propSet = updatedPlayer.properties[col];
      if (propSet) {
        const idx = propSet.cards.findIndex((c) => c.id === cardId);
        if (idx !== -1) {
          foundCard = propSet.cards.splice(idx, 1)[0];
          if (propSet.cards.length === 0) {
            delete updatedPlayer.properties[col];
          }
          break;
        }
      }
    }

    if (foundCard) {
      if (foundCard.isWildcard && foundCard.secondaryColor && newColor === foundCard.secondaryColor) {
        const temp = foundCard.color;
        foundCard.color = newColor;
        foundCard.secondaryColor = temp;
      } else {
        foundCard.color = newColor;
      }
      if (!updatedPlayer.properties[newColor]) {
        updatedPlayer.properties[newColor] = { cards: [], hasHouse: false, hasHotel: false };
      }
      updatedPlayer.properties[newColor]!.cards.push(foundCard);

      match.logs.push({
        id: `change-col-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        message: `${activePlayer.username}, ${foundCard.name} kartının rengini ${COLOR_LABELS[newColor]} olarak değiştirdi.`,
        timestamp: Date.now(),
      });
      playPlaySound();

      if (checkWinnerWithSettings(updatedPlayer.properties)) {
        handleOfflineWinner(updatedPlayer.id);
        return;
      }
    }

    setMatch({
      ...match,
      players: updatedPlayers,
    });
  };

  // --- MULTIPLAYER ACTIONS VIA WEBSOCKET ---
  const handleAddBotMultiplayer = () => {
    socketRef.current?.send(JSON.stringify({ type: 'add_bot', userId: profile.id, roomId }));
  };

  const handleStartGameMultiplayer = () => {
    socketRef.current?.send(JSON.stringify({ type: 'start_game', userId: profile.id, roomId }));
  };

  const resetServerAfkTimer = () => {
    if (!isOffline && socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'reset_afk', userId: profile.id, roomId }));
    }
  };

  const handlePlayCardMultiplayer = (cardId: string, zone: 'bank' | 'property' | 'action', extraColor?: CardColor, payload?: any) => {
    if (!match) return;
    triggerTapticFeedback();

    if (isActionLocked && cardId !== activeActionCard?.id) {
      playAlertSound();
      alert("Şu an aktif bir ödeme veya hamle talebi var. Bu talep çözülene kadar yeni kart oynayamazsınız!");
      return;
    }

    let actionsCost = 1;
    if (zone === 'action' && payload?.isDoubleRent) {
      actionsCost = 2;
    }

    if (match.actionsPlayedThisTurn + actionsCost > 3) {
      playAlertSound();
      alert("Bu turda en fazla 3 hamle yapabilirsiniz! Lütfen turunuzu sonlandırın.");
      return;
    }

    const activePlayer = match.players.find(p => p.id === profile.id);
    if (!activePlayer) return;
    const card = activePlayer.hand.find((c) => c.id === cardId);
    if (!card) return;

    if (zone === 'action' && ['sly-deal', 'deal-breaker', 'forced-deal', 'debt-collector'].includes(card.actionType || '')) {
      if (!isActionSelectionComplete(card, payload)) {
        setActiveActionCard(card);
        if (payload?.targetPlayerId) setSelectedOpponentId(payload.targetPlayerId);
        if (payload?.targetCardId) setSelectedStolenCardId(payload.targetCardId);
        if (payload?.targetColor) setSelectedStolenColor(payload.targetColor);
        if (payload?.myCardId) setSelectedMyCardId(payload.myCardId);
        return;
      }
    }

    socketRef.current?.send(
      JSON.stringify({ type: 'play_card', userId: profile.id, roomId, cardId, targetZone: zone, extraColor, ...payload })
    );
    setSelectedCard(null);
    setShowCardMenu(false);
  };

  const handleChangeWildcardColorMultiplayer = (cardId: string, newColor: CardColor) => {
    socketRef.current?.send(
      JSON.stringify({ type: 'change_wildcard_color', userId: profile.id, roomId, cardId, newColor })
    );
  };

  const handleEndTurnMultiplayer = () => {
    if (isActionLocked) {
      playAlertSound();
      alert("Aktif bir ödeme veya hamle talebi varken turunuzu sonlandıramazsınız!");
      return;
    }
    // If hand > 7, open discard modal instead of ending turn
    const activePlayer = match?.players[match.turnIndex];
    if (activePlayer && activePlayer.id === profile.id && activePlayer.hand.length > 7) {
      playAlertSound();
      setShowDiscardModal(true);
      return;
    }
    playCustomVoiceoverFile('end_turn.mp3');
    socketRef.current?.send(JSON.stringify({ type: 'end_turn', userId: profile.id, roomId }));
  };

  const handleDiscardMultiplayer = (cardId: string) => {
    socketRef.current?.send(JSON.stringify({ type: 'discard_card', userId: profile.id, roomId, cardId }));
  };

  const handleRespondActionRequest = (decision: 'just-say-no' | 'pay' | 'decline') => {
    if (decision === 'pay' && myActiveRequest) {
      const amountDue = myActiveRequest.amountDue;

      let totalBankValue = 0;
      localPlayer.bank.forEach((c) => totalBankValue += c.value);

      let totalPropertiesValue = 0;
      let totalPropertiesCount = 0;
      Object.values(localPlayer.properties).forEach((set: any) => {
        if (set && set.cards) {
          set.cards.forEach((c: any) => {
            totalPropertiesValue += c.value;
            totalPropertiesCount++;
          });
        }
      });

      const totalAssetsValue = totalBankValue + totalPropertiesValue;
      const totalCardsCount = localPlayer.bank.length + totalPropertiesCount;

      if (totalAssetsValue > 0) {
        let selectedBankValue = 0;
        let selectedPropertiesValue = 0;
        let selectedCount = 0;

        paymentSelection.forEach((id) => {
          const bc = localPlayer.bank.find((card) => card.id === id);
          if (bc) {
            selectedBankValue += bc.value;
            selectedCount++;
          } else {
            for (const col in localPlayer.properties) {
              const pc = (localPlayer.properties[col as CardColor] as any)?.cards.find((card: any) => card.id === id);
              if (pc) {
                selectedPropertiesValue += pc.value;
                selectedCount++;
              }
            }
          }
        });

        const selectedTotalValue = selectedBankValue + selectedPropertiesValue;
        const targetAmount = Math.min(amountDue, totalAssetsValue);

        // Relaxed validation: Just make sure selected total is at least targetAmount (which is min of amountDue and total assets)
        if (selectedTotalValue < targetAmount) {
          playAlertSound();
          alert(`Yetersiz ödeme miktarı! En az ${targetAmount}M değerinde varlık seçmelisiniz. (Şu an seçilen: ${selectedTotalValue}M)`);
          return;
        }

        if (totalAssetsValue < amountDue && selectedCount < totalCardsCount) {
          playAlertSound();
          alert(`Borcu ödeyecek yeterli varlığınız yok! Bu durumda önünüzdeki ve bankanızdaki TÜM kartları seçmelisiniz (Borç: ${amountDue}M, Toplam Varlığınız: ${totalAssetsValue}M).`);
          return;
        }
      }
    }

    if (isOffline) {
      const activeMatch = matchRef.current;
      if (!activeMatch || !activeMatch.activeActionRequest) return;
      const activeReq = activeMatch.activeActionRequest;
      const targetPlayer = activeMatch.players.find((p) => p.id === activeReq.targetPlayerId);
      const sourcePlayer = activeMatch.players.find((p) => p.id === activeReq.sourcePlayerId);
      if (!targetPlayer || !sourcePlayer) return;

      const executeOriginalActionOffline = (req: any, selectedCards: string[]) => {
        const activeMatch2 = matchRef.current;
        if (!activeMatch2) return;
        const sPlayer = activeMatch2.players.find((p) => p.id === req.sourcePlayerId);
        const tPlayer = activeMatch2.players.find((p) => p.id === req.targetPlayerId);
        if (!sPlayer || !tPlayer) return;

        const type = req.originalAction?.type || req.actionCard?.actionType || req.actionCard?.type;

        if (type === 'sly-deal') {
          const cardIdToSteal = req.targetCardId;
          let stolenCard: Card | null = null;
          let stolenColor: CardColor | null = null;

          for (const colKey in tPlayer.properties) {
            const col = colKey as CardColor;
            const propSet = tPlayer.properties[col];
            if (propSet) {
              const idx = propSet.cards.findIndex((c) => c.id === cardIdToSteal);
              if (idx !== -1) {
                stolenCard = propSet.cards.splice(idx, 1)[0];
                stolenColor = col;
                if (propSet.cards.length === 0) {
                  delete tPlayer.properties[col];
                }
                break;
              }
            }
          }

          if (stolenCard) {
            const col = stolenCard.color || stolenColor || 'brown';
            if (!sPlayer.properties[col]) {
              sPlayer.properties[col] = { cards: [], hasHouse: false, hasHotel: false };
            }
            sPlayer.properties[col]!.cards.push(stolenCard);
            triggerCardEffect(stolenCard.id, 'steal');
            activeMatch2.logs.push({
              id: `sly-resolve-${Date.now()}`,
              message: `🎯 ${sPlayer.username}, ${tPlayer.username} adlı oyuncudan ${stolenCard.name} mülkünü çaldı!`,
              timestamp: Date.now(),
            });
            enforceBuildingRules(tPlayer, activeMatch2.discardPile);
          }

        } else if (type === 'deal-breaker') {
          const targetColor = req.targetColor;
          if (targetColor) {
            const propSet = tPlayer.properties[targetColor];
            if (propSet) {
              sPlayer.properties[targetColor] = { ...propSet };
              delete tPlayer.properties[targetColor];
              propSet.cards.forEach((c) => triggerCardEffect(c.id, 'steal'));
              activeMatch2.logs.push({
                id: `db-resolve-${Date.now()}`,
                message: `🎯 ${sPlayer.username}, ${tPlayer.username} adlı oyuncunun tamamlanmış ${COLOR_LABELS[targetColor]} setini çaldı!`,
                timestamp: Date.now(),
              });
              setShowDealBreakerAnimation({
                source: sPlayer.username,
                target: tPlayer.username,
                color: targetColor,
              });
              setTimeout(() => setShowDealBreakerAnimation(null), 4000);
            }
          }

        } else if (type === 'forced-deal') {
          const cardIdToSteal = req.targetCardId;
          const myCardIdToGive = req.myCardId;

          let stolenCard: Card | null = null;
          let givenCard: Card | null = null;
          let stolenColor: CardColor | null = null;
          let givenColor: CardColor | null = null;

          for (const colKey in tPlayer.properties) {
            const col = colKey as CardColor;
            const propSet = tPlayer.properties[col];
            if (propSet) {
              const idx = propSet.cards.findIndex((c) => c.id === cardIdToSteal);
              if (idx !== -1) {
                stolenCard = propSet.cards.splice(idx, 1)[0];
                stolenColor = col;
                if (propSet.cards.length === 0) {
                  delete tPlayer.properties[col];
                }
                break;
              }
            }
          }

          for (const colKey in sPlayer.properties) {
            const col = colKey as CardColor;
            const propSet = sPlayer.properties[col];
            if (propSet) {
              const idx = propSet.cards.findIndex((c) => c.id === myCardIdToGive);
              if (idx !== -1) {
                givenCard = propSet.cards.splice(idx, 1)[0];
                givenColor = col;
                if (propSet.cards.length === 0) {
                  delete sPlayer.properties[col];
                }
                break;
              }
            }
          }

          if (stolenCard && givenCard) {
            const colS = stolenCard.color || stolenColor || 'brown';
            if (!sPlayer.properties[colS]) {
              sPlayer.properties[colS] = { cards: [], hasHouse: false, hasHotel: false };
            }
            sPlayer.properties[colS]!.cards.push(stolenCard);

            const colG = givenCard.color || givenColor || 'brown';
            if (!tPlayer.properties[colG]) {
              tPlayer.properties[colG] = { cards: [], hasHouse: false, hasHotel: false };
            }
            tPlayer.properties[colG]!.cards.push(givenCard);

            triggerCardEffect(stolenCard.id, 'steal');
            triggerCardEffect(givenCard.id, 'steal');

            activeMatch2.logs.push({
              id: `forced-resolve-${Date.now()}`,
              message: `🎯 ${sPlayer.username}, ${tPlayer.username} ile ${stolenCard.name} karşılığında ${givenCard.name} mülkünü takas etti!`,
              timestamp: Date.now(),
            });

            enforceBuildingRules(tPlayer, activeMatch2.discardPile);
            enforceBuildingRules(sPlayer, activeMatch2.discardPile);
          }

        } else {
          // Payment requests (rent, debt-collector, birthday)
          let cardsToPay = selectedCards;
          if ((!cardsToPay || cardsToPay.length === 0) && tPlayer.isBot && req.amountDue) {
            cardsToPay = BotEngine.selectPayment(tPlayer, req.amountDue);
          }
          transferOfflinePayment(tPlayer.id, sPlayer.id, cardsToPay);
          cardsToPay.forEach((cardId) => triggerCardEffect(cardId, 'gold'));
          activeMatch2.logs.push({
            id: `payment-resolve-${Date.now()}`,
            message: `🎯 ${tPlayer.username}, ${sPlayer.username} adlı oyuncuya ödemesini yaptı!`,
            timestamp: Date.now(),
          });
        }

        // Check winner
        if (checkWinnerWithSettings(sPlayer.properties)) {
          handleOfflineWinner(sPlayer.id);
        } else if (checkWinnerWithSettings(tPlayer.properties)) {
          handleOfflineWinner(tPlayer.id);
        }
      };

      if (decision === 'just-say-no') {
        const jsnIdx = targetPlayer.hand.findIndex((c) => c.actionType === 'just-say-no');
        if (jsnIdx !== -1) {
          const jsnCard = targetPlayer.hand.splice(jsnIdx, 1)[0];
          activeMatch.discardPile.push(jsnCard);
          activeMatch.logs.push({
            id: `jsn-${Date.now()}`,
            message: `${targetPlayer.username}, 'Hayır Deme Hakkı' kullanarak ${sourcePlayer.username}'in hamlesine karşı koydu!`,
            timestamp: Date.now(),
          });
          playJsnSound();
          setShowShieldDefenseFor(targetPlayer.username);
          setTimeout(() => setShowShieldDefenseFor(null), 3500);

          // Increment JSN count and swap roles
          activeReq.jsnCount = (activeReq.jsnCount || 0) + 1;
          const prevSource = activeReq.sourcePlayerId;
          activeReq.sourcePlayerId = activeReq.targetPlayerId;
          activeReq.targetPlayerId = prevSource;

          // If the new target is a BOT, the bot decides to counter-defend!
          const newTargetPlayer = activeMatch.players.find((p) => p.id === activeReq.targetPlayerId);
          if (newTargetPlayer && newTargetPlayer.isBot) {
            const botHasJsn = newTargetPlayer.hand.some((c) => c.actionType === 'just-say-no');
            if (botHasJsn) {
              const botJsnIdx = newTargetPlayer.hand.findIndex((c) => c.actionType === 'just-say-no');
              const botJsnCard = newTargetPlayer.hand.splice(botJsnIdx, 1)[0];
              activeMatch.discardPile.push(botJsnCard);
              activeMatch.logs.push({
                id: `jsn-bot-counter-${Date.now()}`,
                message: `🛡️ ${newTargetPlayer.username} 'Hayır Teşekkürler' diyerek senin 'Hayır' savunmanı iptal etti! (Reddete Redet!)`,
                timestamp: Date.now(),
              });
              playJsnSound();
              setShowShieldDefenseFor(newTargetPlayer.username);
              setTimeout(() => setShowShieldDefenseFor(null), 3500);

              // Increment JSN count and swap roles back to human
              activeReq.jsnCount = (activeReq.jsnCount || 0) + 1;
              const prevSource2 = activeReq.sourcePlayerId;
              activeReq.sourcePlayerId = activeReq.targetPlayerId;
              activeReq.targetPlayerId = prevSource2;

              setRecoveryAlert({
                message: `🛡️ ${newTargetPlayer.username} 'Hayır Teşekkürler' diyerek senin savunmanı engelledi!`,
                type: 'warning',
              });
              setTimeout(() => setRecoveryAlert(null), 4000);

              updateMatchState({ ...activeMatch });
              return;
            } else {
              // Bot has no JSN! Check if original action should execute (even count of JSNs means defense was canceled)
              const finalJsnCount = activeReq.jsnCount || 0;
              if (finalJsnCount % 2 === 0) {
                // Sender successfully countered target's defense! Execute the action.
                executeOriginalActionOffline(activeReq, paymentSelection);

                activeMatch.logs.push({
                  id: `jsn-win-human-${Date.now()}`,
                  message: `🎯 Savunma iptal edildi! Hamle başarıyla uygulandı.`,
                  timestamp: Date.now(),
                });

                setRecoveryAlert({
                  message: `🎯 Savunma engellendi! Hamlen başarıyla uygulandı.`,
                  type: 'success',
                });
                setTimeout(() => setRecoveryAlert(null), 4000);
              } else {
                // Defense succeeds, action is blocked
                activeMatch.logs.push({
                  id: `jsn-win-bot-${Date.now()}`,
                  message: `🛡️ Savunma başarılı oldu! ${targetPlayer.username}'in hamlesi engellendi.`,
                  timestamp: Date.now(),
                });

                setRecoveryAlert({
                  message: `✅ Savunma başarılı oldu! Senden istenen hamle başarıyla engellendi.`,
                  type: 'success',
                });
                setTimeout(() => setRecoveryAlert(null), 4000);
              }

              const updatedMatch = { ...activeMatch };
              delete updatedMatch.activeActionRequest;
              updateMatchState(updatedMatch);
              setPaymentSelection([]);
              setTimeout(() => {
                resumeBotTurnOffline();
              }, 1000);
              return;
            }
          } else {
            // Target human player to respond to counter JSN
            setRecoveryAlert({
              message: `🛡️ "Hayır Deme Hakkı" (Reddet) kartı kullanıldı! Savunma sırası rakipte.`,
              type: 'info',
            });
            setTimeout(() => setRecoveryAlert(null), 4000);

            updateMatchState({ ...activeMatch });
            return;
          }
        }
      } else if (decision === 'decline') {
        const jsnCount = activeReq.jsnCount || 0;
        if (jsnCount % 2 === 1) {
          activeMatch.logs.push({
            id: `jsn-win-decline-${Date.now()}`,
            message: `🛡️ Savunma başarılı oldu! Hamle engellendi.`,
            timestamp: Date.now(),
          });

          setRecoveryAlert({
            message: `🛡️ Savunma başarılı oldu! Hamle engellendi.`,
            type: 'success',
          });
          setTimeout(() => setRecoveryAlert(null), 4000);

          const updatedMatch = { ...activeMatch };
          delete updatedMatch.activeActionRequest;
          updateMatchState(updatedMatch);
        } else {
          if (activeReq.amountDue > 0) {
            const tPlayer = activeMatch.players.find((p) => p.id === activeReq.targetPlayerId);
            const sPlayer = activeMatch.players.find((p) => p.id === activeReq.sourcePlayerId);

            if (tPlayer && sPlayer && tPlayer.isBot) {
              const botPayments = BotEngine.selectPayment(tPlayer, activeReq.amountDue);
              transferOfflinePayment(tPlayer.id, sPlayer.id, botPayments);
              botPayments.forEach((cardId) => triggerCardEffect(cardId, 'gold'));
              activeMatch.logs.push({
                id: `payment-resolve-decline-${Date.now()}`,
                message: `🎯 ${tPlayer.username}, ${sPlayer.username} adlı oyuncuya ${activeReq.amountDue}M ödemesini yaptı!`,
                timestamp: Date.now(),
              });
              const updatedMatch = { ...activeMatch };
              delete updatedMatch.activeActionRequest;
              updateMatchState(updatedMatch);
            } else {
              // Payment request: change back to normal payment so target player pays
              activeReq.jsnCount = 0;
              activeReq.type = 'make-payment';
              updateMatchState({ ...activeMatch });
            }
          } else if (activeReq.originalAction) {
            executeOriginalActionOffline(activeReq, paymentSelection);

            setRecoveryAlert({
              message: `🛑 Hamle kabul edildi ve sonuçları uygulandı.`,
              type: 'info',
            });
            setTimeout(() => setRecoveryAlert(null), 4000);

            const updatedMatch = { ...activeMatch };
            delete updatedMatch.activeActionRequest;
            updateMatchState(updatedMatch);
          } else {
            const updatedMatch = { ...activeMatch };
            delete updatedMatch.activeActionRequest;
            updateMatchState(updatedMatch);
          }
        }
      } else if (decision === 'pay') {
        executeOriginalActionOffline(activeReq, paymentSelection);

        setRecoveryAlert({
          message: `💵 Ödeme başarıyla yapıldı ve varlıklar teslim edildi!`,
          type: 'success',
        });
        setTimeout(() => setRecoveryAlert(null), 4000);

        const updatedMatch = { ...activeMatch };
        delete updatedMatch.activeActionRequest;
        updateMatchState(updatedMatch);
      }

      setPaymentSelection([]);
      setSelectedCard(null);
      setShowCardMenu(false);

      // Trigger bot resume
      setTimeout(() => {
        resumeBotTurnOffline();
      }, 1000);
      return;
    }

    socketRef.current?.send(
      JSON.stringify({
        type: 'action_response',
        userId: profile.id,
        roomId,
        actionRequestId: myActiveRequest?.id,
        decision,
        paymentCardIds: decision === 'pay' ? paymentSelection : [],
      })
    );
    setPaymentSelection([]);
  };

  const myActiveRequest = React.useMemo(() => {
    if (!match) return null;
    if (match.activeActionRequests && match.activeActionRequests.length > 0) {
      return match.activeActionRequests.find((r) => r.targetPlayerId === profile.id) || null;
    }
    if (match.activeActionRequest && match.activeActionRequest.targetPlayerId === profile.id) {
      return match.activeActionRequest;
    }
    return null;
  }, [match?.activeActionRequests, match?.activeActionRequest, profile.id]);

  const calculateOptimalPaymentSelection = (due: number) => {
    if (!match) return [];
    const localPlayer = match.players.find((p) => p.id === profile.id) || match.players[0];
    if (!localPlayer) return [];
    const bankCards = localPlayer.bank.map((c) => ({ id: c.id, value: c.value, isProperty: false, isCompletedSet: false }));
    const propertyCards: { id: string; value: number; isProperty: boolean; isCompletedSet: boolean }[] = [];
    Object.keys(localPlayer.properties).forEach((colorKey) => {
      const col = colorKey as CardColor;
      const set = localPlayer.properties[col];
      if (set) {
        const isCompleted = set.cards.length >= MAX_IN_SET[col];
        set.cards.forEach((c) => {
          propertyCards.push({ id: c.id, value: c.value, isProperty: true, isCompletedSet: isCompleted });
        });
      }
    });

    const cards = [...bankCards, ...propertyCards];
    const totalValue = cards.reduce((sum, c) => sum + c.value, 0);
    if (totalValue <= due) {
      return cards.map((c) => c.id);
    }

    // Solve for best subset
    let bestSubset: typeof cards | null = null;
    let bestValue = Infinity;
    let bestCompletedSetCount = Infinity;
    let bestPropCount = Infinity;
    let bestCardCount = Infinity;

    const n = cards.length;

    if (n > 14) {
      // Simple greedy fallback to prevent performance lag
      const sorted = [...cards].sort((a, b) => {
        if (a.isCompletedSet !== b.isCompletedSet) return a.isCompletedSet ? 1 : -1;
        if (a.isProperty !== b.isProperty) return a.isProperty ? 1 : -1;
        return a.value - b.value;
      });
      const selection: string[] = [];
      let sum = 0;
      for (const card of sorted) {
        if (sum < due) {
          selection.push(card.id);
          sum += card.value;
        }
      }
      return selection;
    }

    const search = (index: number, current: typeof cards, currentSum: number, currentPropCount: number, currentCompletedSetCount: number) => {
      if (currentSum >= due) {
        let update = false;
        if (currentSum < bestValue) {
          update = true;
        } else if (currentSum === bestValue) {
          if (currentCompletedSetCount < bestCompletedSetCount) {
            update = true;
          } else if (currentCompletedSetCount === bestCompletedSetCount) {
            if (currentPropCount < bestPropCount) {
              update = true;
            } else if (currentPropCount === bestPropCount) {
              if (current.length < bestCardCount) {
                update = true;
              }
            }
          }
        }

        if (update) {
          bestSubset = [...current];
          bestValue = currentSum;
          bestCompletedSetCount = currentCompletedSetCount;
          bestPropCount = currentPropCount;
          bestCardCount = current.length;
        }
        return;
      }

      if (index >= n) return;

      // Option 1: Include cards[index]
      const card = cards[index];
      current.push(card);
      search(
        index + 1,
        current,
        currentSum + card.value,
        currentPropCount + (card.isProperty ? 1 : 0),
        currentCompletedSetCount + (card.isCompletedSet ? 1 : 0)
      );
      current.pop();

      // Option 2: Exclude cards[index]
      search(index + 1, current, currentSum, currentPropCount, currentCompletedSetCount);
    };

    // Sort to optimize search (completed sets last, properties last, cash first, cheaper first)
    const sortedCards = [...cards].sort((a, b) => {
      if (a.isCompletedSet !== b.isCompletedSet) {
        return a.isCompletedSet ? 1 : -1; // Completed sets last
      }
      if (a.isProperty !== b.isProperty) {
        return a.isProperty ? 1 : -1; // Cash first, properties last
      }
      return a.value - b.value; // Cheaper first
    });

    search(0, [], 0, 0, 0);

    return bestSubset ? (bestSubset as typeof cards).map((c) => c.id) : [];
  };

  React.useEffect(() => {
    if (myActiveRequest && myActiveRequest.amountDue > 0) {
      const selection = calculateOptimalPaymentSelection(myActiveRequest.amountDue);
      setPaymentSelection(selection);
    } else {
      setPaymentSelection([]);
    }
  }, [myActiveRequest?.id, myActiveRequest?.amountDue]);

  // Chat message send
  const [chatText, setChatText] = React.useState('');
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatText.trim() === '') return;

    if (isOffline) {
      setMatch((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          logs: [
            ...prev.logs,
            { id: `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, playerName: profile.username, message: chatText, timestamp: Date.now() },
          ],
        };
      });
    } else {
      socketRef.current?.send(JSON.stringify({ type: 'send_chat', userId: profile.id, roomId, text: chatText }));
    }
    setChatText('');
  };

  if (!match) return <div className="text-center py-20 text-white font-bold">Oda yükleniyor...</div>;

  const localPlayer = match.players.find((p) => p.id === profile.id) || match.players[0];
  const otherPlayers = match.players.filter((p) => p.id !== localPlayer.id);
  const isMyTurn = match.players[match.turnIndex]?.id === localPlayer.id;

  const handleQuickFlipWildcard = (card: Card) => {
    if (!isMyTurn || isActionLocked) return;
    if (!card.isWildcard && card.type !== 'wildcard') return;

    // Determine the candidate colors
    const possibleColors: CardColor[] = [];
    if (card.allowedColors && card.allowedColors.length > 0) {
      possibleColors.push(...card.allowedColors);
    } else if (card.secondaryColor && (card.secondaryColor as string) !== 'any') {
      possibleColors.push(card.secondaryColor);
    } else {
      possibleColors.push('brown', 'lightblue', 'pink', 'orange', 'red', 'yellow', 'green', 'darkblue', 'railroad', 'utility');
    }

    if (possibleColors.length === 0) return;

    // Find the next color
    let nextColor: CardColor = possibleColors[0];
    const currentIdx = possibleColors.indexOf(card.color as CardColor);
    if (currentIdx !== -1) {
      nextColor = possibleColors[(currentIdx + 1) % possibleColors.length];
    } else {
      nextColor = possibleColors[0];
    }

    triggerHaptic('medium');
    playPlaySound();

    if (isOffline) {
      handleOfflineChangeWildcardColor(card.id, nextColor);
    } else {
      handleChangeWildcardColorMultiplayer(card.id, nextColor);
    }
  };

  const checkActionPlayability = (card: Card): { playable: boolean; reason?: string } => {
    if (isActionLocked) {
      return { playable: false, reason: 'Şu an aktif bir ödeme veya hamle talebi var. Bu talep çözülene kadar yeni kart oynayamazsınız!' };
    }
    if (card.actionType === 'just-say-no') {
      return { playable: false, reason: 'Hayır Teşekkürler kartı sadece rakibin size karşı oynadığı hamlelerde savunma olarak kullanılabilir.' };
    }
    if (card.actionType === 'double-rent') {
      return { playable: false, reason: 'Kirayı İkiye Katla kartı kendi başına oynanamaz, sadece bir kira kartı oynarken birlikte kullanılabilir.' };
    }

    if (card.type === 'rent') {
      const applicable: CardColor[] = [];
      if (card.color) applicable.push(card.color as CardColor);
      if (card.secondaryColor) applicable.push(card.secondaryColor as CardColor);
      if (card.allowedColors) {
        card.allowedColors.forEach((c) => applicable.push(c as CardColor));
      }
      if ((card as any).colors) {
        ((card as any).colors as CardColor[]).forEach((c) => applicable.push(c as CardColor));
      }
      const uniqueColors = Array.from(new Set(applicable));
      const isMultiRent = card.name?.includes('Her Renk') || uniqueColors.length === 0;

      if (isMultiRent) {
        const ownsAny = Object.values(localPlayer.properties).some((set: any) => set && set.cards && set.cards.length > 0);
        if (!ownsAny) {
          return { playable: false, reason: 'Kira talep edebilmek için önünüzde en az bir mülk bulunmalıdır!' };
        }
      } else {
        const ownsAnyAllowed = uniqueColors.some((col) => {
          const set = localPlayer.properties[col];
          return set && set.cards && set.cards.length > 0;
        });

        if (!ownsAnyAllowed) {
          const colorNames = uniqueColors.map((col) => COLOR_LABELS[col] || col).join(' veya ');
          return { playable: false, reason: `Bu kira kartını oynamak için ${colorNames} renklerinden en az bir mülke sahip olmalısınız!` };
        }
      }
    }

    if (card.actionType === 'deal-breaker') {
      const hasCompletedSet = otherPlayers.some((op) =>
        Object.keys(op.properties).some((col) => {
          const set = op.properties[col as CardColor];
          return set && set.cards.length >= MAX_IN_SET[col as CardColor];
        })
      );
      if (!hasCompletedSet) {
        return { playable: false, reason: 'Rakiplerinizin çalınabilecek tamamlanmış bir mülk seti bulunmuyor!' };
      }
    }

    if (card.actionType === 'sly-deal') {
      const hasIncompleteProp = otherPlayers.some((op) =>
        Object.keys(op.properties).some((col) => {
          const set = op.properties[col as CardColor];
          return set && set.cards.length > 0 && set.cards.length < MAX_IN_SET[col as CardColor];
        })
      );
      if (!hasIncompleteProp) {
        return { playable: false, reason: 'Rakiplerinizin çalınabilecek tamamlanmamış bir mülkü bulunmuyor!' };
      }
    }

    if (card.actionType === 'forced-deal') {
      const myIncompleteProp = Object.keys(localPlayer.properties).some((col) => {
        const set = localPlayer.properties[col as CardColor];
        return set && set.cards.length > 0 && set.cards.length < MAX_IN_SET[col as CardColor];
      });
      if (!myIncompleteProp) {
        return { playable: false, reason: 'Zoraki takas yapabilmek için önünüzde tamamlanmamış en az bir mülk bulunmalıdır!' };
      }

      const oppIncompleteProp = otherPlayers.some((op) =>
        Object.keys(op.properties).some((col) => {
          const set = op.properties[col as CardColor];
          return set && set.cards.length > 0 && set.cards.length < MAX_IN_SET[col as CardColor];
        })
      );
      if (!oppIncompleteProp) {
        return { playable: false, reason: 'Rakiplerinizin takas edilebilecek tamamlanmamış bir mülkü bulunmuyor!' };
      }
    }

    return { playable: true };
  };

  const checkHouseHotelPlayability = (card: Card): { playable: boolean; reason?: string } => {
    if (card.actionType === 'house') {
      const hasEligibleSet = Object.keys(localPlayer.properties).some((colorKey) => {
        const col = colorKey as CardColor;
        if (col === 'railroad' || col === 'utility') return false;
        const set = localPlayer.properties[col];
        return set && set.cards.length >= MAX_IN_SET[col] && !set.hasHouse;
      });
      if (!hasEligibleSet) {
        return { playable: false, reason: 'Ev yerleştirmek için ev bulunmayan tamamlanmış renkli bir setiniz (Kahve, Kırmızı vb.) olmalıdır!' };
      }
    }

    if (card.actionType === 'hotel') {
      const hasEligibleSet = Object.keys(localPlayer.properties).some((colorKey) => {
        const col = colorKey as CardColor;
        if (col === 'railroad' || col === 'utility') return false;
        const set = localPlayer.properties[col];
        return set && set.cards.length >= MAX_IN_SET[col] && set.hasHouse && !set.hasHotel;
      });
      if (!hasEligibleSet) {
        return { playable: false, reason: 'Otel yerleştirmek için zaten evi olan tamamlanmış bir setiniz olmalıdır!' };
      }
    }

    return { playable: true };
  };

  // Dynamic board background
  // Dynamic board background
  const themeHexMap: Record<string, string> = {
    theme_slate: '#0F172A',
    theme_green: '#064E3B',
    theme_purple: '#3B0764',
    theme_cyberpunk: '#050B14',
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
  };
  const themeHex = themeHexMap[profile.settings.boardTheme] || '#0F172A';

  const cardBackBgMap: Record<string, string> = {
    back_classic: 'linear-gradient(135deg, #7F1D1D 0%, #EF4444 100%)',
    back_cosmic: 'linear-gradient(135deg, #020617 0%, #1E1B4B 100%)',
    back_gold: 'linear-gradient(135deg, #78350F 0%, #F59E0B 100%)',
    back_neon: 'linear-gradient(135deg, #4C0519 0%, #DB2777 100%)',
    back_fire: 'linear-gradient(135deg, #7F1D1D 0%, #F97316 100%)',
    back_ice: 'linear-gradient(135deg, #0891B2 0%, #06b6d4 100%)',
    back_void: 'linear-gradient(135deg, #2e1065 0%, #030712 100%)',
    back_matrix: 'linear-gradient(135deg, #064e3b 0%, #020617 100%)',
    back_rainbow: 'linear-gradient(90deg, #ef4444 0%, #eab308 25%, #22c55e 50%, #3b82f6 75%, #a855f7 100%)',
    back_bubble: 'linear-gradient(135deg, #0ea5e9 0%, #f472b6 100%)',
    back_steampunk: 'linear-gradient(135deg, #7c2d12 0%, #4b5563 100%)',
    back_laser: 'linear-gradient(135deg, #4c1d95 0%, #86198f 100%)',
    back_galaxy: 'linear-gradient(135deg, #312e81 0%, #4c1d95 100%)',
    back_darkness: 'linear-gradient(135deg, #030712 0%, #111827 100%)',
  };
  const cardBackBg = cardBackBgMap[profile.settings.cardBack] || 'linear-gradient(135deg, #7F1D1D 0%, #EF4444 100%)';

  const cardBackPatternMap: Record<string, string> = {
    back_classic: '◆',
    back_cosmic: '★',
    back_gold: '♛',
    back_neon: '▲',
    back_fire: '🔥',
    back_ice: '❄️',
    back_void: '🌀',
    back_matrix: '💾',
    back_rainbow: '🌈',
    back_bubble: '🫧',
    back_steampunk: '⚙️',
    back_laser: '⚡',
    back_galaxy: '🌌',
    back_darkness: '👁️',
  };
  const cardBackPattern = cardBackPatternMap[profile.settings.cardBack] || '◆';
  // Dynamic top offsets for overlapping alert/toast banners
  const activeToastY = recoveryAlert ? 96 : 16;

  let actionToastY = 0;
  if (activeToast && recoveryAlert) {
    actionToastY = 176;
  } else if (activeToast || recoveryAlert) {
    actionToastY = 88;
  }

  const shouldShowShieldDefenseOverlay = () => {
    if (!showShieldDefenseFor) return false;
    const req = match?.activeActionRequest;
    if (req) {
      const isSource = req.sourcePlayerId === profile.id;
      const isTarget = req.targetPlayerId === profile.id;
      return isSource || isTarget;
    }
    return showShieldDefenseFor === profile.id || showShieldDefenseFor === profile.username;
  };

  const shouldShowDealBreakerOverlay = () => {
    if (!showDealBreakerAnimation) return false;
    const isActor = showDealBreakerAnimation.source === profile.username;
    const isTarget = showDealBreakerAnimation.target === profile.username;
    return isActor || isTarget;
  };

  const isMeActiveOrTargeted = !!myActiveRequest || (isMyTurn && (
    !!wildcardColorPick ||
    !!propertyWildcardColorPick ||
    !!rentColorPick ||
    !!rentTargetSelect ||
    !!activeActionCard ||
    !!houseHotelColorPick
  ));

  const shouldShakeMeteor = shouldShowDealBreakerOverlay();

  return (
    <div
      id="game-room"
      onClick={resetServerAfkTimer}
      onPointerDown={resetServerAfkTimer}
      onMouseMove={(e) => {
        setMousePos({ x: e.clientX, y: e.clientY });
      }}
      className={`h-[100dvh] w-screen overflow-hidden text-white font-sans flex flex-col justify-between select-none relative${(shouldShakeMeteor || isHighImpactShaking) ? ' vfx-meteor-shake' : ''}`}
    >
      {/* 1. Dynamic Canvas Particle Background */}
      <CanvasBackground theme={profile.settings.boardTheme || 'theme_classic'} />

      {/* Smart-Reconnect Notification Banner */}
      <AnimatePresence>
        {!isOffline && (!wsConnected || isReconnecting) && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-2rem)] max-w-md px-4"
          >
            <div className="bg-slate-900/95 border-2 border-red-500/50 backdrop-blur-md rounded-xl p-4 shadow-2xl flex flex-col gap-3 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-amber-500 to-red-500 animate-pulse" />
              
              <div className="flex items-start gap-3">
                <span className="text-2xl animate-bounce mt-1">🔌</span>
                <div className="flex-1">
                  <h4 className="text-sm font-black text-red-400 tracking-wider uppercase">
                    {profile.settings.language === 'en' ? 'CONNECTION LOST' : 'BAĞLANTI KOPTI'}
                  </h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    {profile.settings.language === 'en' 
                      ? 'Network connection was interrupted. Smart-Reconnect is automatically reconnecting you...' 
                      : 'İnternet bağlantısı kesildi veya sunucuyla iletişim kurulamıyor. Smart-Reconnect otomatik olarak tekrar bağlanıyor...'}
                  </p>
                  <div className="flex items-center gap-2 mt-2 text-[10px] text-amber-400 font-bold">
                    <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                    <span>
                      {profile.settings.language === 'en' 
                        ? `Reconnection Attempt: #${reconnectCount}` 
                        : `Yeniden Bağlanma Denemesi: #${reconnectCount}`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => {
                    if (reconnectTimerRef.current) {
                      clearTimeout(reconnectTimerRef.current);
                    }
                    setReconnectTrigger(p => p + 1);
                  }}
                  className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold py-2 px-3 rounded-lg border border-emerald-400/20 active:scale-95 transition-all shadow-md flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span>⚡ {profile.settings.language === 'en' ? 'Connect Now' : 'Şimdi Bağlan'}</span>
                </button>
                <button
                  onClick={handleLeaveLobby}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold py-2 px-3 rounded-lg border border-slate-700 active:scale-95 transition-all cursor-pointer"
                >
                  {profile.settings.language === 'en' ? 'Leave Lobby' : 'Odadan Ayrıl'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 📳 Taptic Edge Glow Pulse Confirmation Overlay */}
      <AnimatePresence>
        {tapticFeedbackActive && (
          <motion.div
            key="taptic-feedback"
            initial={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            variants={ActionVFX.glowPulse}
            animate="successEdge"
            className="absolute inset-0 border-[6px] pointer-events-none z-[9999] rounded-none"
          />
        )}
      </AnimatePresence>

      {/* ☄️ Meteor Strike VFX Overlay (vfx_meteor) */}
      <AnimatePresence>
        {shouldShowDealBreakerOverlay() && (
          <motion.div
            key="vfx-meteor"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="vfx-meteor-container"
          >
            <div className="vfx-meteor-rock" />
            <div className="vfx-meteor-shockwave" />
            {/* Particle burst */}
            {Array.from({ length: 8 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-2 h-2 rounded-full bg-amber-400"
                style={{ top: '50%', left: '50%' }}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{
                  x: Math.cos((i / 8) * Math.PI * 2) * (60 + Math.random() * 80),
                  y: Math.sin((i / 8) * Math.PI * 2) * (60 + Math.random() * 80),
                  opacity: 0,
                  scale: 0,
                }}
                transition={{ duration: 0.8, delay: 0.9, ease: 'easeOut' }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🛡️ Mirror Shield VFX Overlay (vfx_mirror_shield) */}
      <AnimatePresence>
        {shouldShowShieldDefenseOverlay() && (
          <motion.div
            key="vfx-shield"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.5 } }}
            className="vfx-shield-container"
          >
            <div className="vfx-shield-hex-grid">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="vfx-shield-hex" style={{ animationDelay: `${i * 0.07}s` }} />
              ))}
            </div>
            <div className="vfx-shield-shockwave" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Emojis Layer */}
      <div className="fixed inset-x-0 bottom-10 z-50 pointer-events-none overflow-hidden h-[300px]">
        <AnimatePresence>
          {floatingEmojis.map((fe) => (
            <motion.div
              key={fe.id}
              initial={{ y: 250, x: `${fe.x}vw`, opacity: 0, scale: 0.6 }}
              animate={{
                y: [250, 0],
                x: [`${fe.x}vw`, `${fe.x + (Math.random() * 10 - 5)}vw`],
                opacity: [0, 1, 1, 0],
                scale: [0.6, 1.4, 1.0]
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2.5, ease: 'easeOut' }}
              className="absolute flex flex-col items-center gap-1"
            >
              <span className="text-3xl filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.4)]">{fe.emoji}</span>
              <span className="text-[7.5px] bg-slate-950/80 text-slate-300 border border-white/10 px-1 py-0.5 rounded-full font-bold">
                {fe.username}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* 🚀 BOARD-TO-BOARD PHYSICAL ANIMATIONS LAYER (Flying Coins, Cards & Sparks) */}
      <div className="fixed inset-0 z-[99999] pointer-events-none overflow-hidden">
        <AnimatePresence>
          {boardFlows.map((flow) => {
            if (flow.type === 'money') {
              const numCoins = 16;
              const moneySymbols = ['🪙', '💵', '💸', '💰'];
              return (
                <div key={flow.id} className="absolute inset-0">
                  {Array.from({ length: numCoins }).map((_, i) => {
                    const delay = i * 0.07;
                    const coinId = `${flow.id}-coin-${i}`;
                    const arcHeight = 110 + Math.random() * 90;
                    const dispersionX = Math.random() * 50 - 25;
                    const symbol = moneySymbols[i % moneySymbols.length];
                    
                    // Sway factor to create standard sinusoidal leaf-drift physics
                    const swayFactor = Math.sin(i * 1.5) * 40;

                    return (
                      <motion.div
                        key={coinId}
                        initial={{ 
                          x: flow.startX, 
                          y: flow.startY, 
                          scale: 0.15, 
                          opacity: 0,
                          rotate: 0,
                          rotateY: 0
                        }}
                        animate={{ 
                          x: [
                            flow.startX, 
                            flow.startX + (flow.endX - flow.startX) * 0.3 + swayFactor, 
                            flow.startX + (flow.endX - flow.startX) * 0.7 - swayFactor, 
                            flow.endX
                          ], 
                          y: [
                            flow.startY, 
                            Math.min(flow.startY, flow.endY) - arcHeight - 20, 
                            Math.min(flow.startY, flow.endY) - arcHeight + 10,
                            flow.endY
                          ], 
                          scale: [0.15, 1.5, 1.2, 0.4], 
                          opacity: [0, 1, 1, 0.9, 0],
                          rotate: [0, 180, 360, 720],
                          rotateY: [0, 180, 360, 540]
                        }}
                        transition={{ 
                          duration: 1.5, 
                          delay: delay,
                          ease: "easeOut"
                        }}
                        className="absolute text-2xl filter drop-shadow-[0_6px_10px_rgba(0,0,0,0.6)] flex items-center justify-center select-none"
                        style={{ left: 0, top: 0 }}
                      >
                        {symbol}
                      </motion.div>
                    );
                  })}
                  
                  {/* Glowing landing rings at target position */}
                  <motion.div
                    initial={{ scale: 0.1, opacity: 0 }}
                    animate={{ scale: [0.1, 1.8, 0.9], opacity: [0, 0.9, 0] }}
                    transition={{ delay: 0.35, duration: 1.3 }}
                    className="absolute w-28 h-28 rounded-full border-2 border-emerald-400 bg-emerald-400/10 blur-md flex items-center justify-center"
                    style={{
                      left: flow.endX - 56,
                      top: flow.endY - 56
                    }}
                  />
                  <motion.div
                    initial={{ scale: 0.1, opacity: 0 }}
                    animate={{ scale: [0.1, 1.2, 0.6], opacity: [0, 0.6, 0] }}
                    transition={{ delay: 0.5, duration: 1.0 }}
                    className="absolute w-16 h-16 rounded-full border border-amber-400 bg-amber-400/5 blur-sm"
                    style={{
                      left: flow.endX - 32,
                      top: flow.endY - 32
                    }}
                  />
                </div>
              );
            }
            
            if (flow.type === 'card') {
              const arcHeight = 150;
              const cardBg = flow.cardColor ? COLOR_HEX[flow.cardColor] : '#3b82f6';
              const cardLabel = flow.cardName || 'Mülk Kartı';
              const isSet = flow.subType === 'deal_breaker';
              
              return (
                <div key={flow.id} className="absolute inset-0">
                  {/* 3D Holographic Gilded Game Card flight with vertical flip! */}
                  <motion.div
                    initial={{ 
                      x: flow.startX, 
                      y: flow.startY, 
                      scale: 0.25, 
                      rotate: -20,
                      rotateY: 0,
                      opacity: 0
                    }}
                    animate={{ 
                      x: flow.endX,
                      y: flow.endY,
                      scale: [0.25, 1.8, 1.4, 0.4], 
                      rotate: [-20, 90, 180, 365],
                      rotateY: [0, 180, 360, 540],
                      opacity: [0, 1, 1, 0.9, 0]
                    }}
                    transition={{ 
                      x: isSet ? SPRING_PRESETS.heavyImpact : SPRING_PRESETS.fluid,
                      y: isSet ? SPRING_PRESETS.heavyImpact : SPRING_PRESETS.fluid,
                      scale: { duration: 1.9, ease: "easeInOut" },
                      rotate: { duration: 1.9, ease: "easeInOut" },
                      rotateY: { duration: 1.9, ease: "easeInOut" },
                      opacity: { duration: 1.9, ease: "easeInOut" }
                    }}
                    className={`absolute z-20 w-28 h-40 rounded-2xl border-2 p-2.5 text-white flex flex-col justify-between shadow-[0_20px_50px_rgba(0,0,0,0.85)] bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 ${
                      isSet ? 'border-amber-400 shadow-[0_0_25px_rgba(234,179,8,0.5)]' : 'border-cyan-300'
                    }`}
                    style={{ left: -56, top: -80 }}
                  >
                    {/* Top strip banner */}
                    <div className="h-5 rounded-lg w-full flex items-center justify-between px-1.5 relative overflow-hidden" style={{ backgroundColor: cardBg }}>
                      <div className="absolute inset-0 bg-white/20 animate-pulse" />
                      <span className="text-[7px] font-black tracking-wider uppercase drop-shadow">MÜLK</span>
                      {isSet && <span className="text-[8px] animate-bounce">👑</span>}
                    </div>

                    {/* Styled centerpiece */}
                    <div className="flex-1 flex flex-col justify-center items-center text-center mt-2 px-1 relative">
                      <div className="absolute inset-0 flex items-center justify-center opacity-10">
                        <span className="text-4xl">🌟</span>
                      </div>
                      <span className="text-[10px] font-extrabold leading-tight text-slate-100 tracking-wide z-10">{cardLabel}</span>
                      <span className="text-[6px] text-cyan-400 font-bold uppercase tracking-widest mt-1 z-10">
                        {isSet ? 'TAM SET BOZAN' : 'SİNSİ ANLAŞMA'}
                      </span>
                    </div>

                    {/* Premium card footer */}
                    <div className="border-t border-white/10 pt-1.5 flex justify-between items-center text-slate-400">
                      <span className="text-[5px] font-black tracking-widest text-indigo-400">NETPLAY</span>
                      <span className="text-[9px]">🃏</span>
                    </div>
                  </motion.div>

                  {/* Flight trail star trail and light balls */}
                  {Array.from({ length: 12 }).map((_, idx) => {
                    const ratio = idx / 12;
                    const trailIcons = ['✨', '⭐', '💫', '🔵', '🟢', '🟡'];
                    const trailIcon = trailIcons[idx % trailIcons.length];
                    return (
                      <motion.div
                        key={idx}
                        initial={{ x: flow.startX, y: flow.startY, opacity: 0 }}
                        animate={{
                          x: [flow.startX, flow.startX + (flow.endX - flow.startX) * ratio, flow.endX],
                          y: [flow.startY, Math.min(flow.startY, flow.endY) - arcHeight * ratio, flow.endY],
                          scale: [0.5, 1.2, 0.2],
                          opacity: [0, 0.8, 0]
                        }}
                        transition={{
                          duration: 1.9,
                          delay: idx * 0.08,
                          ease: "easeInOut"
                        }}
                        className="absolute text-sm select-none filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]"
                        style={{ left: 0, top: 0 }}
                      >
                        {trailIcon}
                      </motion.div>
                    );
                  })}
                  
                  {/* Landing dynamic shockwave ring */}
                  <motion.div
                    initial={{ scale: 0.1, opacity: 0 }}
                    animate={{ scale: [0.1, 2.0, 1.0], opacity: [0, 1, 0] }}
                    transition={{ delay: 1.6, duration: 0.7 }}
                    className="absolute w-36 h-36 rounded-full border border-indigo-400 bg-indigo-500/20 blur-md"
                    style={{
                      left: flow.endX - 72,
                      top: flow.endY - 72
                    }}
                  />
                  <motion.div
                    initial={{ scale: 0.1, opacity: 0 }}
                    animate={{ scale: [0.1, 1.4, 0.7], opacity: [0, 0.8, 0] }}
                    transition={{ delay: 1.7, duration: 0.5 }}
                    className="absolute w-24 h-24 rounded-full border border-pink-400 bg-pink-500/10 blur-sm"
                    style={{
                      left: flow.endX - 48,
                      top: flow.endY - 48
                    }}
                  />
                </div>
              );
            }
            
            if (flow.type === 'forced_deal') {
              const arcHeightA = 140;
              const arcHeightB = 175;
              const colorA = flow.cardColor ? COLOR_HEX[flow.cardColor] : '#06b6d4';
              const colorB = flow.cardColorGiver ? COLOR_HEX[flow.cardColorGiver] : '#f59e0b';
              const labelA = flow.cardName || 'Alınan Kart';
              const labelB = flow.cardNameGiver || 'Verilen Kart';

              return (
                <div key={flow.id} className="absolute inset-0">
                  {/* Card A flying source to target (Alınan) */}
                  <motion.div
                    initial={{ 
                      x: flow.startX, 
                      y: flow.startY, 
                      scale: 0.25, 
                      rotate: -15,
                      rotateY: 0,
                      opacity: 0
                    }}
                    animate={{ 
                      x: [flow.startX, flow.startX + (flow.endX - flow.startX) * 0.5, flow.endX],
                      y: [flow.startY, Math.min(flow.startY, flow.endY) - arcHeightA, flow.endY],
                      scale: [0.25, 1.7, 1.3, 0.45], 
                      rotate: [-15, 90, 180, 360],
                      rotateY: [0, 180, 360],
                      opacity: [0, 1, 1, 0.8, 0]
                    }}
                    transition={{ 
                      duration: 2.1,
                      ease: "easeInOut"
                    }}
                    className="absolute z-20 w-24 h-36 rounded-2xl border-2 border-cyan-400 bg-gradient-to-br from-slate-900 via-cyan-950 to-slate-950 p-2 text-white flex flex-col justify-between shadow-2xl"
                    style={{ left: -48, top: -72 }}
                  >
                    <div className="h-4 rounded-lg w-full flex items-center justify-between px-1 relative overflow-hidden" style={{ backgroundColor: colorA }}>
                      <span className="text-[6px] font-black text-white">TAKAS</span>
                    </div>
                    <div className="flex-1 flex flex-col justify-center items-center text-center mt-1">
                      <span className="text-[9px] font-black leading-tight text-white">{labelA}</span>
                      <span className="text-[5px] text-cyan-300 font-extrabold uppercase mt-1 tracking-widest">ALINAN</span>
                    </div>
                    <div className="border-t border-white/5 pt-1.5 flex justify-between items-center">
                      <span className="text-[4px] font-extrabold text-cyan-400">NETPLAY</span>
                      <span className="text-[7px]">🌓</span>
                    </div>
                  </motion.div>

                  {/* Card B flying target to source (Verilen) */}
                  <motion.div
                    initial={{ 
                      x: flow.endX, 
                      y: flow.endY, 
                      scale: 0.25, 
                      rotate: 15,
                      rotateY: 0,
                      opacity: 0
                    }}
                    animate={{ 
                      x: [flow.endX, flow.endX + (flow.startX - flow.endX) * 0.5, flow.startX],
                      y: [flow.endY, Math.min(flow.startY, flow.endY) - arcHeightB, flow.startY],
                      scale: [0.25, 1.7, 1.3, 0.45], 
                      rotate: [15, -90, -180, -360],
                      rotateY: [0, -180, -360],
                      opacity: [0, 1, 1, 0.8, 0]
                    }}
                    transition={{ 
                      duration: 2.1,
                      ease: "easeInOut"
                    }}
                    className="absolute z-20 w-24 h-36 rounded-2xl border-2 border-amber-400 bg-gradient-to-br from-slate-900 via-amber-950 to-slate-950 p-2 text-white flex flex-col justify-between shadow-2xl"
                    style={{ left: -48, top: -72 }}
                  >
                    <div className="h-4 rounded-lg w-full flex items-center justify-between px-1 relative overflow-hidden" style={{ backgroundColor: colorB }}>
                      <span className="text-[6px] font-black text-white">TAKAS</span>
                    </div>
                    <div className="flex-1 flex flex-col justify-center items-center text-center mt-1">
                      <span className="text-[9px] font-black leading-tight text-white">{labelB}</span>
                      <span className="text-[5px] text-amber-300 font-extrabold uppercase mt-1 tracking-widest">VERİLEN</span>
                    </div>
                    <div className="border-t border-white/5 pt-1.5 flex justify-between items-center">
                      <span className="text-[4px] font-extrabold text-amber-400">NETPLAY</span>
                      <span className="text-[7px]">🌓</span>
                    </div>
                  </motion.div>

                  {/* Mid-flight collision explosion shockwave */}
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: [0, 2.8, 0], opacity: [0, 1, 0] }}
                    transition={{ delay: 0.95, duration: 0.9 }}
                    className="absolute w-28 h-28 rounded-full border-2 border-yellow-300 bg-amber-400/25 blur-sm flex items-center justify-center z-30"
                    style={{
                      left: flow.startX + (flow.endX - flow.startX) * 0.5 - 56,
                      top: Math.min(flow.startY, flow.endY) - Math.min(arcHeightA, arcHeightB) * 0.85
                    }}
                  >
                    <div className="relative flex flex-col items-center">
                      <span className="text-2xl animate-ping select-none">💥</span>
                      <span className="text-[8px] font-black text-amber-300 tracking-widest uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] mt-1">TAKAS! 🔄</span>
                    </div>
                  </motion.div>
                </div>
              );
            }
            
            return null;
          })}
        </AnimatePresence>
      </div>

      {/* 📳 STOLEN CARD TAPTIC FEEDBACK OVERLAY */}
      <div className="fixed inset-0 z-[999999] pointer-events-none overflow-hidden">
        <AnimatePresence>
          {activeStealFeedbacks.map((fb) => (
            <StolenCardTapticFeedback key={fb.id} x={fb.x} y={fb.y} />
          ))}
        </AnimatePresence>
      </div>

      {/* Build Smoke Overlay */}
      {buildSmoke.map((bs) => (
        <div key={bs.id} className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
          {Array.from({ length: 15 }).map((_, idx) => {
            const angle = (idx / 15) * Math.PI * 2;
            const distance = Math.random() * 100 + 40;
            return (
              <motion.div
                key={idx}
                initial={{ x: 0, y: 0, opacity: 0.8, scale: 0.5 }}
                animate={{
                  x: Math.cos(angle) * distance,
                  y: Math.sin(angle) * distance,
                  opacity: 0,
                  scale: [0.5, 2.5, 1.5],
                  rotate: Math.random() * 360
                }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
                className="absolute w-8 h-8 rounded-full bg-slate-400/30 blur-md mix-blend-screen"
              />
            );
          })}
        </div>
      ))}

      {/* Decorative board circle backgrounds matching Image 4 */}
      <div className="absolute top-[25%] left-1/2 -translate-x-1/2 w-[450px] h-[450px] rounded-full border border-white/[0.03] pointer-events-none z-0" />
      <div className="absolute top-[18%] left-1/2 -translate-x-1/2 w-[650px] h-[650px] rounded-full border border-white/[0.02] pointer-events-none z-0" />

      {/* Floating Header Show Button */}
      {isHeaderHidden && (
        <button
          onClick={() => {
            playPlaySound();
            setIsHeaderHidden(false);
          }}
          className="absolute top-2 left-2 z-50 bg-slate-950/80 hover:bg-slate-900 border border-white/10 p-1.5 rounded-lg text-[10px] font-bold text-amber-400 shadow-md transition-all flex items-center gap-1 cursor-pointer animate-fade-in"
          title={t('show_menu', profile)}
        >
          👁️ <span className="hidden sm:inline">{t('show_menu', profile)}</span>
          <span className="sm:hidden">{t('lobby', profile)}</span>
        </button>
      )}

      {/* Table Top Header - Compact for Mobile space saving */}
      {!isHeaderHidden && (
        <header className="border-b border-white/5 bg-black/45 backdrop-blur-md px-2 py-1.5 sm:px-4 sm:py-2 flex items-center justify-between z-40 flex-shrink-0 animate-fade-in gap-1 sm:gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => {
                playPlaySound();
                onLeaveRoom();
              }}
              className="text-[10px] bg-white/5 hover:bg-white/10 border border-white/10 px-1.5 py-1 sm:px-2 sm:py-1 rounded-lg transition-all font-bold"
              title={t('exit', profile)}
            >
              ← <span className="hidden sm:inline">{t('exit', profile)}</span>
            </button>

            <button
              onClick={() => {
                playPlaySound();
                setShowCareerPanel(true);
              }}
              className="text-[10px] bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 px-1.5 py-1 sm:px-2 sm:py-1 rounded-lg transition-all font-bold flex items-center gap-0.5"
              title={t('career', profile)}
            >
              📊 <span className="hidden sm:inline">{t('career', profile)}</span>
            </button>

            <div>
              <span className="text-[7px] sm:text-[8px] uppercase font-black tracking-widest text-amber-400 block leading-none">
                {isOffline ? 'PRATİK' : 'ONLINE'}
              </span>
              <h2 className="font-extrabold text-[9px] sm:text-[11px] text-slate-300 leading-tight">#{roomId}</h2>
            </div>
          </div>

          {/* Real-time Voice Chat System Status & Game Toolbar */}
          <div className="flex items-center gap-1.5 sm:gap-2 relative">
            
            {/* The Unified Game Toolbar Container */}
            <div id="game-toolbar" className="flex items-center gap-1 bg-slate-950/40 border border-white/[0.06] rounded-xl p-0.5 sm:p-1 shadow-lg backdrop-blur-sm">
              {/* Live Feed & Chat Toggle button */}
              <button
                id="toolbar-chat-btn"
                onClick={() => {
                  playPlaySound();
                  setShowChatPanel(!showChatPanel);
                  // Also toggle showChatOverlay for mobile if screen is small
                  if (window.innerWidth < 1024) {
                    setShowChatOverlay(!showChatOverlay);
                  }
                }}
                className={`p-1 px-1.5 sm:px-2.5 sm:py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer select-none ${showChatPanel
                  ? 'bg-purple-500/20 border border-purple-500/40 text-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.15)]'
                  : 'bg-white/[0.01] border border-white/5 hover:bg-white/[0.05] text-slate-400 hover:text-white'
                  }`}
                title={profile.settings.language === 'en' ? "Chat & Activity Log" : "Sohbet ve Aktivite Akışı"}
              >
                <span>💬</span>
                <span className="hidden md:inline">{showChatPanel ? t('chat', profile) : (profile.settings.language === 'en' ? 'Open' : 'Aç')}</span>
              </button>

              {/* İpucu (Hint) Button in Top Toolbar */}
              <button
                id="toolbar-hint-btn"
                onClick={() => {
                  playPlaySound();
                  setShowHint(true);
                }}
                className="p-1 px-1.5 sm:px-2.5 sm:py-1 rounded-lg text-[10px] font-bold bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 transition-all flex items-center gap-1 cursor-pointer select-none shadow-[0_0_10px_rgba(245,158,11,0.15)]"
                title={profile.settings.language === 'en' ? "Game Rules & Hints" : "Oyun Kuralları ve İpuçları"}
              >
                <span>💡</span>
                <span className="hidden md:inline">{t('btn_hint', profile)}</span>
              </button>

              {/* Unified Settings Gear Button */}
              <button
                id="toolbar-settings-btn"
                onClick={() => {
                  playPlaySound();
                  setShowSettingsDropdown(!showSettingsDropdown);
                }}
                className={`p-1 px-1.5 sm:px-2.5 sm:py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer select-none ${showSettingsDropdown
                  ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.15)]'
                  : 'bg-white/[0.01] border border-white/5 hover:bg-white/[0.05] text-slate-400 hover:text-white'
                  }`}
                title={profile.settings.language === 'en' ? "Game Settings Menu" : "Oyun Ayarları Menüsü"}
              >
                <span>⚙️</span>
                <span className="hidden md:inline">{profile.settings.language === 'en' ? 'Settings' : 'Ayarlar'}</span>
              </button>
            </div>

            {/* Settings Dropdown Panel */}
            {showSettingsDropdown && (
              <div className="absolute right-0 top-10 sm:top-11 z-[100] w-64 p-3.5 bg-slate-950/95 border border-white/15 rounded-xl shadow-2xl backdrop-blur-md space-y-3 text-left animate-fade-in text-white">
                <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                    {profile.settings.language === 'en' ? '⚙️ Game Settings' : '⚙️ Oyun Ayarları'}
                  </span>
                  <button 
                    onClick={() => setShowSettingsDropdown(false)}
                    className="text-[10px] text-slate-400 hover:text-white px-1 font-bold"
                  >
                    ✕
                  </button>
                </div>

                {/* Background Music toggle */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-200">
                      {profile.settings.language === 'en' ? 'Background Music' : 'Arka Plan Müziği'}
                    </span>
                    <span className="text-[7.5px] text-slate-400 leading-none">
                      {profile.settings.language === 'en' ? 'Atmospheric loop music' : 'Atmosferik fon müziklerini açar'}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      playPlaySound();
                      const newVal = !isMusicPlaying;
                      setIsMusicPlaying(newVal);
                      localStorage.setItem('bgm_enabled', String(newVal));
                    }}
                    className={`w-9 h-5 rounded-full p-0.5 transition-all duration-200 cursor-pointer ${
                      isMusicPlaying ? 'bg-amber-500' : 'bg-slate-700'
                    }`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full transition-all duration-200 ${
                      isMusicPlaying ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </button>
                </div>

                {/* Voiceover toggle */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-200">
                      {profile.settings.language === 'en' ? 'Card Voiceovers' : 'Kart Seslendirmesi'}
                    </span>
                    <span className="text-[7.5px] text-slate-400 leading-none">
                      {profile.settings.language === 'en' ? 'Speak aloud played actions' : 'Oynanan kartları seslendirir'}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      playPlaySound();
                      const newVal = !voiceoversMuted;
                      setVoiceoversMuted(newVal);
                      localStorage.setItem('voiceovers_muted', String(newVal));
                    }}
                    className={`w-9 h-5 rounded-full p-0.5 transition-all duration-200 cursor-pointer ${
                      !voiceoversMuted ? 'bg-amber-500' : 'bg-slate-700'
                    }`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full transition-all duration-200 ${
                      !voiceoversMuted ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>
      )}



      {/* Dynamic Animated Warning/Recovery Toast Alert */}
      <AnimatePresence>
        {recoveryAlert && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9, x: '-50%' }}
            animate={{ opacity: 1, y: 0, scale: 1, x: '-50%' }}
            exit={{ opacity: 0, y: -20, scale: 0.95, x: '-50%' }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            className="fixed top-16 left-1/2 z-50 w-full max-w-sm px-4"
          >
            <div className={`p-4 rounded-2xl border flex items-start gap-3 shadow-2xl backdrop-blur-md ${recoveryAlert.type === 'warning'
              ? 'bg-amber-950/90 border-amber-500/40 text-amber-200 shadow-amber-950/50'
              : recoveryAlert.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200 shadow-emerald-950/50'
                : 'bg-blue-950/90 border-blue-500/40 text-blue-200 shadow-blue-950/50'
              }`}>
              <div className="text-lg flex-shrink-0 mt-0.5">
                {recoveryAlert.type === 'warning' ? '⚠️' : recoveryAlert.type === 'success' ? '✅' : '🛡️'}
              </div>
              <div className="space-y-1 flex-1">
                <h4 className="font-extrabold text-xs uppercase tracking-wider text-white">
                  {recoveryAlert.type === 'warning'
                    ? (profile.settings.language === 'en' ? 'System Notification' : 'Sistem Bildirimi')
                    : recoveryAlert.type === 'success'
                      ? (profile.settings.language === 'en' ? 'Action Success' : 'Başarılı Hamle')
                      : (profile.settings.language === 'en' ? 'Game Info' : 'Oyun Bilgisi')
                  }
                </h4>
                <p className="text-[10px] text-slate-300 leading-normal">
                  {translateRecoveryMessage(recoveryAlert.message, profile)}
                </p>
              </div>
              <button
                onClick={() => setRecoveryAlert(null)}
                className="text-slate-400 hover:text-white text-xs font-bold px-1.5 py-0.5 rounded-md hover:bg-white/5 cursor-pointer"
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LOBBY STATE / PRE-START SCREEN */}
      {match.status === 'lobby' && (
        <div className="flex-1 overflow-y-auto p-4 flex flex-col justify-center items-center z-10 relative">
          <div className="bg-slate-900/95 border border-white/10 backdrop-blur-lg rounded-3xl p-6 md:p-8 max-w-3xl w-full shadow-2xl space-y-6 text-left">

            {/* Lobby Header */}
            <div className="flex flex-col md:flex-row items-center md:items-start justify-between border-b border-white/10 pb-4 gap-4">
              <div className="flex items-center gap-3">
                <span className="text-4xl">🎲</span>
                <div>
                  <h3 className="text-xl font-black text-white">{t('lobby_title', profile)}</h3>
                  <p className="text-xs text-slate-400">{t('room_code_lbl', profile)} <span className="font-mono bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-amber-400 select-all font-bold">{roomId}</span></p>
                </div>
              </div>
              <button
                onClick={handleLeaveLobby}
                className="px-4 py-1.5 bg-white/5 border border-white/10 hover:bg-red-500/10 hover:border-red-500/20 text-slate-300 hover:text-red-400 font-bold rounded-xl text-xs transition-all active:scale-95"
              >
                🚪 {t('leave_lobby', profile)}
              </button>
            </div>

            {/* Lobby Content Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Left Column: Players List & Waiting Info */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                    <span>👥</span> {t('players_list', profile)} ({match.players.length}/4)
                  </h4>
                  {isOffline && (
                    <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                      {t('lobby_practise_mode', profile)}
                    </span>
                  )}
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {match.players.map((p, index) => {
                    const isRoomHost = index === 0;
                    const canKickThisPlayer = (isOffline || match.players[0]?.id === profile.id) && p.id !== profile.id;

                    return (
                      <div key={p.id} className="flex items-center justify-between p-2.5 bg-black/40 border border-white/5 rounded-xl transition-all hover:bg-black/50">
                        <div className="flex items-center gap-2">
                          <AvatarWithFrame
                            avatarId={p.avatarId || 'avatar_classic'}
                            avatarUrl={p.avatarUrl}
                            frameId={p.profileFrame || 'frame_none'}
                            sizeClassName="w-7 h-7 text-[10px]"
                          />
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm select-none shrink-0" title={profile.settings.language === 'en' ? getCountryByCode(p.country).nameEn : getCountryByCode(p.country).nameTr}>
                                {getCountryByCode(p.country).flag}
                              </span>
                              <span className="font-bold text-xs text-slate-200">{p.username}</span>
                              {p.id === profile.id && (
                                <span className="text-[8px] font-extrabold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1 py-0.2 rounded uppercase">
                                  {profile.settings.language === 'en' ? 'YOU' : 'SEN'}
                                </span>
                              )}
                            </div>
                            {/* Equipped products badges in lobby */}
                            <div className="flex items-center gap-1 mt-0.5">
                              {PLAYER_BOARD_STYLES[p.playerBoard || 'board_classic'] && (
                                <span className="text-[8px] text-amber-300/90 font-medium bg-amber-500/10 border border-amber-500/20 px-1 rounded flex items-center gap-0.5" title="Masa Teması">
                                  <span>{PLAYER_BOARD_STYLES[p.playerBoard || 'board_classic'].icon}</span>
                                  <span className="text-[7.5px] font-bold truncate max-w-[60px]">{PLAYER_BOARD_STYLES[p.playerBoard || 'board_classic'].nameTr.split(' ')[0]}</span>
                                </span>
                              )}
                              {p.cardBack && p.cardBack !== 'back_classic' && (
                                <span className="text-[8px] text-pink-300/90 font-medium bg-pink-500/10 border border-pink-500/20 px-1 rounded flex items-center gap-0.5" title="Kart Sırtı">
                                  <span>🎴</span>
                                  <span className="text-[7.5px] font-bold">Sırt</span>
                                </span>
                              )}
                              {p.cardSkin && p.cardSkin !== 'skin_none' && (
                                <span className="text-[8px] text-cyan-300/90 font-medium bg-cyan-500/10 border border-cyan-500/20 px-1 rounded flex items-center gap-0.5" title="Kart Deseni">
                                  <span>🎨</span>
                                  <span className="text-[7.5px] font-bold">Kaplama</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isRoomHost ? (
                            <span className="text-[8px] font-extrabold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded flex items-center gap-1">
                              {t('lobby_role_host', profile)}
                            </span>
                          ) : p.isBot ? (
                            <span className="text-[8px] font-extrabold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded">
                              {t('lobby_role_bot', profile)}
                            </span>
                          ) : (
                            <span className="text-[8px] font-extrabold text-slate-400 bg-slate-500/10 border border-slate-500/20 px-1.5 py-0.5 rounded">
                              {t('lobby_role_player', profile)}
                            </span>
                          )}

                          {/* KICK Button */}
                          {canKickThisPlayer && (
                            <button
                              onClick={() => handleKickPlayer(p.id)}
                              title={t('lobby_kick_tooltip', profile)}
                              className="p-1 text-red-400 hover:text-white bg-red-500/10 hover:bg-red-500 border border-red-500/20 rounded-lg transition-all"
                            >
                              <span className="text-xs font-black">✕</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Status Notice Banner */}
                {(!isOffline && match.players[0]?.id !== profile.id) ? (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-[10px] flex items-center gap-2 animate-pulse">
                    <span>⌛</span> {t('lobby_waiting_host', profile)}
                  </div>
                ) : (
                  match.players.length < 2 && (
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400 text-[10px]">
                      {t('min_players_notice', profile)}
                    </div>
                  )
                )}

                {/* Host Control Buttons */}
                {(isOffline || match.players[0]?.id === profile.id) && (
                  <div className="flex flex-col gap-2 pt-2">
                    {isOffline ? (
                      <button
                        onClick={handleStartOfflineGame}
                        className="w-full py-2.5 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-black rounded-xl text-xs transition-all shadow-lg active:scale-95"
                      >
                        {t('lobby_start_practise', profile)}
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={handleAddBotMultiplayer}
                          disabled={match.players.length >= 4}
                          className="w-full py-2 bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-40 text-white font-bold rounded-xl text-xs transition-all"
                        >
                          {t('add_bot', profile)}
                        </button>
                        <button
                          onClick={handleStartGameMultiplayer}
                          disabled={match.players.length < 2}
                          className="w-full py-2.5 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 disabled:opacity-40 text-white font-black rounded-xl text-xs transition-all shadow-lg active:scale-95"
                        >
                          {t('start_game', profile)}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Right Column: Admin Settings & Game Modes */}
              <div className="space-y-4 bg-black/20 border border-white/5 p-4 rounded-2xl flex flex-col justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-300 flex items-center gap-2 mb-3">
                    <span>⚙️</span> {t('room_settings_rules', profile)}
                  </h4>

                  {/* Preset Game Modes */}
                  <div className="space-y-2 mb-4">
                    <span className="text-[10px] font-bold text-slate-400 block">{t('game_mode_selection', profile)}</span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: 'classic', label: profile.settings.language === 'en' ? '🎲 Classic' : '🎲 Klasik', desc: profile.settings.language === 'en' ? 'Classic rules.' : 'Klasik Deal Master PRO kuralları.' },
                        { id: 'chaos', label: profile.settings.language === 'en' ? '🌀 Chaos' : '🌀 Kaos', desc: profile.settings.language === 'en' ? 'Draw 4 cards, unlimited moves.' : '4 Kart çekilir, sınırsız hamle.' },
                        { id: 'speed', label: profile.settings.language === 'en' ? '⚡ Speed' : '⚡ Hızlı', desc: profile.settings.language === 'en' ? '15s turn limit.' : '15sn tur süresi.' },
                      ].map((m) => {
                        const isSelected = localSettings.gameMode === m.id;
                        const disabled = !(isOffline || match.players[0]?.id === profile.id);
                        return (
                          <button
                            key={m.id}
                            disabled={disabled}
                            onClick={() => changeMatchSettings({ gameMode: m.id as any })}
                            title={m.desc}
                            className={`p-2 rounded-xl text-center border transition-all text-xs flex flex-col items-center justify-center gap-1 ${isSelected
                              ? 'bg-red-500/15 border-red-500/50 text-red-400 font-extrabold shadow-md'
                              : 'bg-black/30 border-white/5 text-slate-400 hover:bg-black/40 disabled:hover:bg-black/30'
                              }`}
                          >
                            <span>{m.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Settings Fields */}
                  <div className="space-y-3">

                    {/* Set Target Selection */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-bold text-slate-400">{t('set_target', profile)}</span>
                        <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.2 rounded">
                          {profile.settings.language === 'en' ? 'Complete ' + localSettings.targetSets + ' Sets' : localSettings.targetSets + ' Set Tamamla'}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[2, 3, 4].map((s) => {
                          const isSelected = localSettings.targetSets === s;
                          const disabled = !(isOffline || match.players[0]?.id === profile.id) || localSettings.gameMode !== 'classic';
                          return (
                            <button
                              key={s}
                              disabled={disabled}
                              onClick={() => changeMatchSettings({ targetSets: s })}
                              className={`py-1 rounded-lg text-center border transition-all text-xs ${isSelected
                                ? 'bg-red-500/10 border-red-500/30 text-red-400 font-bold'
                                : 'bg-black/20 border-white/5 text-slate-400 hover:bg-black/30 disabled:opacity-40'
                                }`}
                            >
                              {s} Set
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Turn Time Limit Selection */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-bold text-slate-400">{t('lobby_turn_limit', profile)}</span>
                        <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.2 rounded">
                          {localSettings.turnLimit === 'unlimited' ? t('turn_duration_unlimited', profile) : localSettings.turnLimit === '15s' ? t('turn_duration_seconds', profile, 15) : localSettings.turnLimit === '30s' ? t('turn_duration_seconds', profile, 30) : t('turn_duration_minute', profile)}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[
                          { id: '15s', label: profile.settings.language === 'en' ? '15s' : '15sn' },
                          { id: '30s', label: profile.settings.language === 'en' ? '30s' : '30sn' },
                          { id: '1m', label: profile.settings.language === 'en' ? '1m' : '1dk' },
                          { id: 'unlimited', label: t('turn_duration_unlimited', profile) },
                        ].map((tField) => {
                          const isSelected = localSettings.turnLimit === tField.id;
                          const disabled = !(isOffline || match.players[0]?.id === profile.id) || localSettings.gameMode !== 'classic';
                          return (
                            <button
                              key={tField.id}
                              disabled={disabled}
                              onClick={() => changeMatchSettings({ turnLimit: tField.id as any })}
                              className={`py-1 rounded-lg text-center border transition-all text-[10px] ${isSelected
                                ? 'bg-red-500/10 border-red-500/30 text-red-400 font-bold'
                                : 'bg-black/20 border-white/5 text-slate-400 hover:bg-black/30 disabled:opacity-40'
                                }`}
                            >
                              {tField.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Auto End Turn Toggle */}
                    <div className="flex items-center justify-between p-2 bg-black/20 border border-white/5 rounded-xl mt-2">
                      <div>
                        <span className="text-[10px] font-bold text-slate-300 block">{t('auto_end_turn', profile)}</span>
                        <span className="text-[8px] text-slate-400">{t('auto_end_turn_desc', profile)}</span>
                      </div>
                      <button
                        disabled={!(isOffline || match.players[0]?.id === profile.id) || localSettings.gameMode !== 'classic'}
                        onClick={() => changeMatchSettings({ autoEndTurn: !localSettings.autoEndTurn })}
                        className={`px-3 py-1 text-[9px] font-extrabold rounded-lg border transition-all ${localSettings.autoEndTurn
                          ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                          : 'bg-black/40 border-white/10 text-slate-400'
                          }`}
                      >
                        {localSettings.autoEndTurn ? t('option_on', profile) : t('option_off', profile)}
                      </button>
                    </div>

                  </div>
                </div>

                {/* Footer mode summary */}
                <div className="border-t border-white/5 pt-3 mt-4 text-[9px] text-slate-500">
                  <span className="font-semibold text-slate-400 block uppercase mb-1">{t('rules_summary_title', profile)}</span>
                  {localSettings.gameMode === 'chaos' && t('rules_summary_chaos', profile)}
                  {localSettings.gameMode === 'speed' && t('rules_summary_speed', profile)}
                  {localSettings.gameMode === 'classic' && t('rules_summary_classic', profile, localSettings.targetSets, localSettings.turnLimit === 'unlimited' ? t('turn_duration_unlimited', profile) : (localSettings.turnLimit === '15s' ? t('turn_duration_seconds', profile, 15) : (localSettings.turnLimit === '30s' ? t('turn_duration_seconds', profile, 30) : t('turn_duration_minute', profile))), localSettings.autoEndTurn ? t('option_on', profile) : t('option_off', profile))}
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* ACTIVE PLAYING STATE */}
      {match.status === 'playing' && (
        <div className={`flex-1 flex flex-col justify-between min-h-0 relative z-10 transition-all duration-300 ${showChatPanel ? 'lg:pr-80' : ''}`}>

          {/* 1. Opponents & My Profile Carousel Row at the top (matches Image 4) */}
          <div className="px-3 pt-2.5 flex-shrink-0">
            <div className="flex justify-between items-center mb-1 text-[8.5px] font-bold text-slate-400">
              <span className="uppercase tracking-wide">{profile.settings.language === 'en' ? 'Players & Boards' : 'Oyuncular & Masalar'}</span>
              <div className="flex gap-1.5 items-center">
                <button
                  onClick={() => {
                    playPlaySound();
                    setHideOwnBoard(!hideOwnBoard);
                  }}
                  className={`px-2 py-0.5 rounded border text-[8px] cursor-pointer transition-all flex items-center gap-1 active:scale-95 ${
                    hideOwnBoard 
                      ? 'bg-amber-500/20 border-amber-500/30 text-amber-300' 
                      : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300'
                  }`}
                >
                  {hideOwnBoard 
                    ? `👁️ ${t('show_own_board_btn', profile)}` 
                    : `🙈 ${t('hide_own_board_btn', profile)}`
                  }
                </button>
                <button
                  onClick={() => {
                    playPlaySound();
                    setIsOpponentsGrid(!isOpponentsGrid);
                  }}
                  className="px-2 py-0.5 rounded bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 text-[8px] cursor-pointer transition-all flex items-center gap-1 active:scale-95"
                >
                  {isOpponentsGrid
                    ? (profile.settings.language === 'en' ? '↔️ Scroll View' : '↔️ Yatay Kaydır')
                    : (profile.settings.language === 'en' ? '🔢 Grid View' : '🔢 Izgara Görünümü')
                  }
                </button>
              </div>
            </div>

            {activeActionCard && (
              <div className="mb-2 bg-gradient-to-r from-amber-600/30 via-orange-600/30 to-amber-600/30 border border-amber-500/40 p-2.5 rounded-xl text-[10px] text-amber-300 font-extrabold flex items-center justify-between shadow-lg animate-pulse z-30 relative">
                <span className="flex items-center gap-1.5 leading-tight">
                  🎯 {profile.settings.language === 'en' 
                    ? `TARGET SELECTION: Choose an eligible opponent above for ${activeActionCard.name}!` 
                    : `HEDEF SEÇİMİ: ${activeActionCard.name} için yukarıdan uygun bir rakip seçin!`}
                </span>
                <button
                  onClick={() => setActiveActionCard(null)}
                  className="bg-red-500 hover:bg-red-400 text-white px-2.5 py-1 rounded-lg font-black text-[9px] active:scale-95 transition-all cursor-pointer shadow-md border border-red-400/40 shrink-0"
                >
                  {profile.settings.language === 'en' ? 'Cancel' : 'İptal Et'}
                </button>
              </div>
            )}

            <div className={isOpponentsGrid
              ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2 pb-1"
              : "flex gap-2 overflow-x-auto pb-1 scrollbar-thin"
            }>
              {match.players.filter((p) => !(hideOwnBoard && p.id === profile.id)).map((p) => {
                const isMe = p.id === profile.id;
                const isCurrentTurn = match.players[match.turnIndex].id === p.id;
                const bankTotal = p.bank.reduce((sum, c) => sum + c.value, 0);

                const bStyle = PLAYER_BOARD_STYLES[p.playerBoard || 'board_classic'] || PLAYER_BOARD_STYLES.board_classic;
                const pBoardItem = findShopItem(p.playerBoard);
                const isBoardVideo = pBoardItem?.mediaUrl && isVideoUrl(pBoardItem.mediaUrl, pBoardItem.mediaType);

                const isOpponentEligible = (() => {
                  if (!activeActionCard) return true;
                  if (p.id === profile.id) return false;
                  
                  if (activeActionCard.actionType === 'sly-deal') {
                    return Object.keys(p.properties).some((colKey) => {
                      const col = colKey as CardColor;
                      const set = p.properties[col];
                      return set && set.cards.length > 0 && set.cards.length < MAX_IN_SET[col];
                    });
                  }
                  if (activeActionCard.actionType === 'deal-breaker') {
                    return Object.keys(p.properties).some((colKey) => {
                      const col = colKey as CardColor;
                      const set = p.properties[col];
                      return set && set.cards.length >= MAX_IN_SET[col];
                    });
                  }
                  if (activeActionCard.actionType === 'forced-deal') {
                    const opHasStealable = Object.keys(p.properties).some((colKey) => {
                      const col = colKey as CardColor;
                      const set = p.properties[col];
                      return set && set.cards.length > 0 && set.cards.length < MAX_IN_SET[col];
                    });
                    const myHasToGive = Object.keys(localPlayer.properties).some((colKey) => {
                      const col = colKey as CardColor;
                      const set = localPlayer.properties[col];
                      return set && set.cards.length > 0 && set.cards.length < MAX_IN_SET[col];
                    });
                    return opHasStealable && myHasToGive;
                  }
                  return true;
                })();

                return (
                  <motion.div
                    key={p.id}
                    id={`player-card-${p.id}`}
                    variants={BOARD_REACTION_VARIANTS}
                    animate={playerVisualStates[p.id]?.type || 'idle'}
                    onClick={() => {
                      playPlaySound();
                      if (activeActionCard) {
                        if (p.id === profile.id) return;
                        if (isOpponentEligible) {
                          setSelectedOpponentId(p.id);
                        }
                        return;
                      }
                      if (isMe) {
                        setShowBankVaultModal(true);
                      } else {
                        setAssetsOpponentId(p.id);
                        setShowOpponentAssetsModal(true);
                      }
                    }}
                    className={`flex-shrink-0 w-[165px] p-2.5 rounded-2xl border backdrop-blur-md transition-all cursor-pointer relative overflow-hidden select-none ${bStyle.bgClass} ${bStyle.textClass || 'text-slate-200'} ${
                      playerVisualStates[p.id]?.type === 'money_gain'
                        ? 'border-emerald-400 ring-4 ring-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.8)] scale-[1.03] z-20'
                        : playerVisualStates[p.id]?.type === 'card_gain'
                        ? 'border-cyan-400 ring-4 ring-cyan-500 shadow-[0_0_30px_rgba(34,211,238,0.8)] scale-[1.03] z-20'
                        : playerVisualStates[p.id]?.type === 'card_loss'
                        ? 'border-red-500 ring-4 ring-red-500 shadow-[0_0_30px_rgba(239,68,68,0.8)] scale-[0.98] z-20 animate-pulse'
                        : playerVisualStates[p.id]?.type === 'deal_breaker_target'
                        ? 'border-fuchsia-500 ring-4 ring-fuchsia-600 shadow-[0_0_35px_rgba(217,70,239,0.9)] scale-[1.03] z-20'
                        : activeHighImpactCard?.actorId === p.id
                        ? 'border-indigo-400 ring-4 ring-indigo-500 shadow-[0_0_35px_rgba(99,102,241,0.85)] scale-[1.04] z-20 animate-pulse'
                        : activeActionCard && !selectedOpponentId
                        ? (isOpponentEligible 
                            ? 'border-amber-500 ring-2 ring-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.5)] scale-[1.03] z-20 animate-pulse border-dashed' 
                            : 'opacity-25 grayscale pointer-events-none scale-95 border-slate-900')
                        : activeActionCard && selectedOpponentId
                        ? (p.id === selectedOpponentId 
                            ? 'border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.4)] scale-[1.02] z-20' 
                            : 'opacity-25 grayscale pointer-events-none scale-95 border-slate-900')
                        : isCurrentTurn
                        ? 'border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.7)] ring-2 ring-amber-400/50 scale-[1.03] z-20'
                        : `${bStyle.borderClass} ${bStyle.glowClass} hover:border-slate-500`
                    }`}
                  >
                    {/* Dynamic visual state overlays and floating indicator symbols */}
                    <AnimatePresence>
                      {playerVisualStates[p.id] && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ duration: 0.25 }}
                          className="absolute inset-0 pointer-events-none z-30 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[1px]"
                        >
                          {playerVisualStates[p.id]!.type === 'money_gain' && (
                            <motion.div 
                              animate={{ y: [4, -4, 4], scale: [1, 1.1, 1] }}
                              transition={{ repeat: Infinity, duration: 1 }}
                              className="flex flex-col items-center relative"
                            >
                              <span className="text-2xl filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)]">💸</span>
                              <span className="text-[9px] font-black text-emerald-400 tracking-widest uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">+ÖDEME</span>
                              <div className="absolute -inset-x-6 -inset-y-4 rounded-xl border-2 border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.8)] animate-pulse" />
                            </motion.div>
                          )}
                          {playerVisualStates[p.id]!.type === 'card_gain' && (
                            <motion.div 
                              animate={{ rotate: [-5, 5, -5], scale: [1, 1.05, 1] }}
                              transition={{ repeat: Infinity, duration: 1.2 }}
                              className="flex flex-col items-center relative"
                            >
                              <span className="text-2xl filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)]">🎴</span>
                              <span className="text-[9px] font-black text-cyan-400 tracking-widest uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">+MÜLK</span>
                              <div className="absolute -inset-x-6 -inset-y-4 rounded-xl border-2 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.8)] animate-pulse" />
                            </motion.div>
                          )}
                          {playerVisualStates[p.id]!.type === 'card_loss' && (
                            <motion.div 
                              animate={{ x: [-4, 4, -4, 4, 0] }}
                              transition={{ repeat: Infinity, duration: 0.5 }}
                              className="flex flex-col items-center relative"
                            >
                              <span className="text-2xl filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)]">📉</span>
                              <span className="text-[9px] font-black text-red-400 tracking-widest uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">-KAYIP</span>
                              <div className="absolute -inset-x-6 -inset-y-4 rounded-xl border-2 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.8)]" />
                            </motion.div>
                          )}
                          {playerVisualStates[p.id]!.type === 'deal_breaker_target' && (
                            <motion.div 
                              animate={{ scale: [0.9, 1.1, 0.9] }}
                              transition={{ repeat: Infinity, duration: 0.8 }}
                              className="flex flex-col items-center relative"
                            >
                              <span className="text-2xl filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)]">🎯</span>
                              <span className="text-[9px] font-black text-fuchsia-400 tracking-widest uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">SET ÇALINDI</span>
                              <div className="absolute -inset-x-6 -inset-y-4 rounded-xl border-4 border-dashed border-fuchsia-500 shadow-[0_0_30px_rgba(217,70,239,0.9)] animate-spin-slow" />
                            </motion.div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                    {/* Atmospheric Ambient Visual FX Overlays */}
                    <div className="absolute inset-0 pointer-events-none opacity-50 overflow-hidden rounded-2xl z-0">
                      {pBoardItem?.mediaUrl && (
                        isBoardVideo ? (
                          <HlsVideoPlayer
                            src={pBoardItem.mediaUrl}
                            className="absolute inset-0 w-full h-full object-cover pointer-events-none opacity-50 rounded-2xl"
                          />
                        ) : (
                          <img
                            src={pBoardItem.mediaUrl}
                            alt="Player Board"
                            className="absolute inset-0 w-full h-full object-cover pointer-events-none opacity-50 rounded-2xl"
                          />
                        )
                      )}
                      {p.playerBoard === 'board_cyber' && (
                        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(236,72,153,0.08)_1px,transparent_1px),linear-gradient(to_right,rgba(6,182,212,0.08)_1px,transparent_1px)] bg-[size:8px_8px]" />
                      )}
                      {p.playerBoard === 'board_magma' && (
                        <div className="absolute inset-0 bg-radial-gradient from-red-600/25 to-orange-500/0 animate-pulse" />
                      )}
                      {p.playerBoard === 'board_galaxy' && (
                        <div className="absolute inset-0 bg-radial-gradient from-purple-500/15 via-indigo-500/8 to-transparent animate-spin-slow" />
                      )}
                      {p.playerBoard === 'board_ice' && (
                        <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(56,189,248,0.08)_25%,transparent_25%,transparent_50%,rgba(56,189,248,0.08)_50%,rgba(56,189,248,0.08)_75%,transparent_75%,transparent)] bg-[size:16px_16px]" />
                      )}
                      {p.playerBoard === 'board_void' && (
                        <div className="absolute inset-0 bg-radial-gradient from-violet-600/20 to-black/20 animate-pulse" />
                      )}
                    </div>

                    {/* Active Turn Pulsing Golden Halo Wave */}
                    {isCurrentTurn && (
                      <>
                        <motion.div
                          className="absolute inset-0 rounded-2xl border-2 border-amber-400 pointer-events-none"
                          animate={{
                            boxShadow: [
                              '0 0 4px rgba(245, 158, 11, 0.4)',
                              '0 0 20px rgba(245, 158, 11, 0.8)',
                              '0 0 4px rgba(245, 158, 11, 0.4)'
                            ]
                          }}
                          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                          style={{ zIndex: 5 }}
                        />
                        {/* Shimmer Light Flare crossing the active turn card */}
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-400/20 to-transparent -skew-x-12 pointer-events-none"
                          initial={{ x: '-150%' }}
                          animate={{ x: '150%' }}
                          transition={{ duration: 2, repeat: Infinity, ease: "linear", repeatDelay: 1 }}
                          style={{ zIndex: 6 }}
                        />
                      </>
                    )}

                    {/* Player Info Line */}
                    <div className="flex items-center gap-2 justify-between relative z-10">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {/* Avatar container with ripples, bot bubbles and speech indicators */}
                        <div className="relative flex-shrink-0 select-none">
                          {/* Pulsing speak halo ripple */}
                          {(speakingList.includes(p.id) || (p as any).isSpeaking) && (
                            <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-60 z-0 pointer-events-none" />
                          )}
                          <AvatarWithFrame
                            avatarId={p.avatarId || 'avatar_classic'}
                            avatarUrl={p.avatarUrl}
                            frameId={p.profileFrame || 'frame_none'}
                            sizeClassName={`w-8 h-8 text-[11px] flex-shrink-0 relative z-10 ${(speakingList.includes(p.id) || (p as any).isSpeaking) ? 'ring-2 ring-emerald-400' : ''
                              }`}
                          />
                          {/* Audio wavebars animation */}
                          {(speakingList.includes(p.id) || (p as any).isSpeaking) && (
                            <div className="absolute -bottom-1 -right-1 flex gap-[1px] items-end bg-slate-950/90 border border-emerald-400/40 rounded px-0.5 py-0.2 z-20 pointer-events-none scale-90">
                              <span className="w-[1.5px] bg-emerald-400 rounded-full animate-bounce" style={{ height: '5px', animationDuration: '0.4s' }} />
                              <span className="w-[1.5px] bg-emerald-400 rounded-full animate-bounce" style={{ height: '8px', animationDuration: '0.6s' }} />
                              <span className="w-[1.5px] bg-emerald-400 rounded-full animate-bounce" style={{ height: '4px', animationDuration: '0.3s' }} />
                            </div>
                          )}
                          {/* Bot thinking indicator */}
                          {p.isBot && isCurrentTurn && botIsThinking && (
                            <div className="absolute -top-3.5 -left-3.5 bg-blue-600 border border-blue-400/50 text-[6.5px] text-white font-extrabold px-1 py-0.5 rounded-md animate-bounce flex items-center gap-0.5 shadow-md shadow-blue-500/20 z-20">
                              <span>{profile.settings.language === 'en' ? '💬 Thinking' : '💬 Düşünüyor'}</span>
                              <span className="animate-pulse">...</span>
                            </div>
                          )}
                        </div>
                        <div className="truncate leading-none">
                          <span className="font-extrabold text-[10px] text-slate-100 truncate block flex items-center gap-1">
                            <span className="text-[11px] shrink-0 select-none" title={profile.settings.language === 'en' ? getCountryByCode(p.country).nameEn : getCountryByCode(p.country).nameTr}>
                              {getCountryByCode(p.country).flag}
                            </span>
                            <span className="truncate">{p.username.split(' ')[0]}</span>
                            {(p as any).isDisconnected && <span className="text-[7px] bg-red-500/20 text-red-400 px-1 py-0.2 rounded font-black uppercase animate-pulse">AFK</span>}
                          </span>
                          {isCurrentTurn ? (
                            <div className="mt-1 flex flex-col space-y-1">
                              {/* Visual bullet/energy dots for moves */}
                              <div className="flex gap-1">
                                {[1, 2, 3].map((num) => {
                                  const isSpent = match.actionsPlayedThisTurn >= num;
                                  const rem = 3 - match.actionsPlayedThisTurn;
                                  let dotClass = "w-2.5 h-2.5 rounded-full border transition-all duration-300 ";
                                  if (isSpent) {
                                    dotClass += "bg-purple-500 border-purple-400 shadow-[0_0_6px_rgba(168,85,247,0.7)]";
                                  } else {
                                    if (rem === 1) {
                                      dotClass += "bg-amber-500/20 border-amber-500/40 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.5)]";
                                    } else {
                                      dotClass += "bg-emerald-500/30 border-emerald-500/50 shadow-[0_0_6px_rgba(16,185,129,0.4)]";
                                    }
                                  }
                                  return (
                                    <div
                                      key={num}
                                      className={dotClass}
                                      title={isSpent ? "Hamle Kullanıldı" : `${rem} Hamle Kaldı`}
                                    />
                                  );
                                })}
                              </div>
                              {/* Descriptive Warning Text */}
                              {(() => {
                                const rem = 3 - match.actionsPlayedThisTurn;
                                if (rem === 0) {
                                  return (
                                    <span className="text-[7px] text-red-400 font-black tracking-wider uppercase animate-bounce block bg-red-950/40 border border-red-500/20 px-1 py-0.5 rounded text-center">
                                      🚨 TURU BİTİR
                                    </span>
                                  );
                                }
                                if (rem === 1) {
                                  return (
                                    <span className="text-[7px] text-orange-400 font-black tracking-wider uppercase animate-pulse block bg-orange-950/40 border border-orange-500/20 px-1 py-0.5 rounded text-center">
                                      ⚠️ SON HAMLE!
                                    </span>
                                  );
                                }
                                return (
                                  <span className="text-[6.5px] text-slate-400 font-extrabold tracking-wider uppercase block">
                                    {rem} HAMLE KALDI
                                  </span>
                                );
                              })()}
                            </div>
                          ) : isMe ? (
                            <span className="text-[7px] text-amber-400 font-black tracking-widest uppercase block mt-0.5">SEN</span>
                          ) : null}
                        </div>
                      </div>
                      <span className="text-[9px] font-black text-emerald-400 bg-emerald-950/20 px-1.5 py-0.5 rounded-lg border border-emerald-500/10 shrink-0">{bankTotal}M</span>
                    </div>

                    {/* Stats & Mini Badge Info */}
                    <div className="flex flex-col mt-2 pt-1.5 border-t border-white/[0.04] gap-1.5 relative z-10">
                      <div className="flex items-center justify-between text-[7px] text-slate-400 font-bold select-none">
                        <span>🎴 ELDEKİ KART: x{p.hand.length}</span>
                      </div>

                      {/* Display mini active set cards */}
                      <div className="flex flex-wrap gap-1 justify-start py-0.5">
                        {Object.keys(p.properties).map((colorKey) => {
                          const col = colorKey as CardColor;
                          const set = p.properties[col];
                          if (!set || set.cards.length === 0) return null;
                          const isCompleted = set.cards.length >= MAX_IN_SET[col];
                          const opponentNeon = COLOR_HEX[col] || '#34d399';

                          // Check if this property set is eligible for active action card
                          const isMiniEligible = (() => {
                            if (!activeActionCard) return true;
                            if (p.id === profile.id) return false;
                            const type = activeActionCard.actionType;
                            if (type === 'sly-deal') {
                              return !isCompleted;
                            }
                            if (type === 'deal-breaker') {
                              return isCompleted;
                            }
                            if (type === 'forced-deal') {
                              return !isCompleted;
                            }
                            return true;
                          })();

                          return (
                            <motion.div
                              key={col}
                              animate={glowingProperties[`${col}-${p.id}`] ? {
                                boxShadow: [
                                  `0 0 0px rgba(0, 0, 0, 0)`,
                                  `0 0 25px 6px ${opponentNeon}`,
                                  `0 0 45px 12px ${opponentNeon}`,
                                  `0 0 25px 6px ${opponentNeon}`,
                                  `0 0 0px rgba(0, 0, 0, 0)`
                                ],
                                borderColor: [
                                  `rgba(255, 255, 255, 0.1)`,
                                  opponentNeon,
                                  `#ffffff`,
                                  opponentNeon,
                                  `rgba(255, 255, 255, 0.1)`
                                ],
                                scale: [1, 1.45, 1.55, 1.45, 1],
                                zIndex: [10, 50, 50, 50, 10]
                              } : {
                                boxShadow: '0 0 0px rgba(0, 0, 0, 0)',
                                borderColor: 'rgba(255, 255, 255, 0.1)',
                                scale: 1,
                                zIndex: 10
                              }}
                              transition={{
                                duration: 1.8,
                                times: [0, 0.25, 0.5, 0.75, 1],
                                ease: "easeInOut"
                              }}
                              className={`flex-shrink-0 w-[24px] h-[34px] bg-white rounded flex flex-col justify-between p-0.5 relative overflow-hidden shadow-sm border transition-all duration-300 ${
                                activeActionCard
                                  ? (isMiniEligible
                                      ? 'border-amber-400 ring-2 ring-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)] scale-110 animate-pulse'
                                      : 'opacity-15 grayscale scale-90 border-slate-300')
                                  : isCompleted
                                  ? 'border-amber-400 ring-1 ring-amber-400/30 shadow-[0_0_4px_rgba(251,191,36,0.5)]'
                                  : 'border-slate-300'
                              }`}
                              title={`${COLOR_LABELS[col]}: ${set.cards.length}/${MAX_IN_SET[col]}`}
                            >
                              <div className="h-1.5 w-full rounded-t-sm flex-shrink-0" style={{ backgroundColor: COLOR_HEX[col] }} />
                              <div className="flex-1 flex items-center justify-center leading-none">
                                <span className={`text-[6px] font-black leading-none ${isCompleted ? 'text-amber-500 scale-105 animate-pulse' : 'text-slate-800'}`}>
                                  {isCompleted ? '👑' : `${set.cards.length}/${MAX_IN_SET[col]}`}
                                </span>
                              </div>
                              
                              {glowingProperties[`${col}-${p.id}`] && (
                                <>
                                  {/* Holographic Shimmer Flare */}
                                  <motion.div 
                                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/80 to-transparent -skew-x-12 pointer-events-none"
                                    initial={{ x: '-150%' }}
                                    animate={{ x: '150%' }}
                                    transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                                    style={{ zIndex: 30 }}
                                  />
                                  {/* Floating Sparkles inside mini card */}
                                  <motion.span 
                                    className="absolute text-[11px] pointer-events-none text-amber-300 select-none"
                                    initial={{ y: 22, x: 2, opacity: 0, scale: 0.5 }}
                                    animate={{ y: -18, x: 7, opacity: [0, 1, 1, 0], scale: [0.5, 1.3, 1.3, 0.5] }}
                                    transition={{ duration: 1.5, repeat: Infinity }}
                                    style={{ zIndex: 35 }}
                                  >✨</motion.span>
                                  <motion.span 
                                    className="absolute text-[9px] pointer-events-none text-yellow-200 select-none"
                                    initial={{ y: 16, x: 12, opacity: 0, scale: 0.5 }}
                                    animate={{ y: -12, x: 8, opacity: [0, 1, 1, 0], scale: [0.5, 1.2, 1.2, 0.5] }}
                                    transition={{ duration: 1.3, repeat: Infinity, delay: 0.3 }}
                                    style={{ zIndex: 35 }}
                                  >🌟</motion.span>
                                </>
                              )}
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* 2. Middle area: Piles, turn indicator timer and properties collection */}
          <div className={`flex-1 min-h-0 flex flex-col justify-around px-2 sm:px-3 transition-all ${isCompactLayout ? 'py-0.5 space-y-1' : 'py-1.5 space-y-2'
            }`}>

            {/* Horizontal Arena Grid */}
            <div className={`grid grid-cols-3 gap-1.5 sm:gap-2 items-center bg-black/15 border border-white/[0.04] rounded-xl transition-all ${isCompactLayout ? 'p-1.5' : 'p-2.5'
              }`}>

              {/* Draw Pile (DESTE) */}
              <div className="text-center space-y-0.5 relative">
                <span className="text-[7.5px] text-slate-400 uppercase tracking-widest block font-bold">DESTE</span>
                {(() => {
                  const desteShopDetail = findShopItem(profile.settings.cardBack);
                  const desteMediaUrl = desteShopDetail?.mediaUrl;
                  const isDesteVideo = desteMediaUrl && isVideoUrl(desteMediaUrl, desteShopDetail?.mediaType);

                  return (
                    <div className="relative w-10 h-14 mx-auto group cursor-pointer" onClick={() => playPlaySound()}>
                      {/* 3D Stacked Deck Effect (Layer 2) */}
                      <div className="absolute inset-0 translate-x-1 translate-y-1 rounded-lg bg-slate-900 border border-white/20 shadow-md opacity-70 pointer-events-none" />
                      {/* 3D Stacked Deck Effect (Layer 1) */}
                      <div className="absolute inset-0 translate-x-0.5 translate-y-0.5 rounded-lg bg-slate-950 border border-white/10 shadow-sm opacity-90 pointer-events-none" />

                      {/* Main DESTE Front Card */}
                      <div
                        className={`w-10 h-14 rounded-lg flex flex-col justify-between p-1 cursor-pointer select-none active:scale-95 transition-all relative overflow-hidden z-10 ${
                          desteShopDetail?.glowColor ? '' :
                          profile.settings.cardBack === 'back_cosmic'
                            ? 'border border-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.6)]'
                            : profile.settings.cardBack === 'back_gold'
                              ? 'border border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.75)] shadow-yellow-500/30'
                              : profile.settings.cardBack === 'back_neon'
                                ? 'border border-pink-500 shadow-[0_0_12px_rgba(236,72,153,0.75)] animate-bounce-subtle'
                                : 'border border-red-500/50 shadow-[0_4px_8px_rgba(239,68,68,0.25)]'
                        }`}
                        style={{
                          background: desteMediaUrl ? '#0f172a' : cardBackBg,
                          borderColor: desteShopDetail?.glowColor || undefined,
                          boxShadow: desteShopDetail?.glowColor ? `0 0 12px ${desteShopDetail.glowColor}` : undefined
                        }}
                      >
                        {desteMediaUrl ? (
                          <div className="absolute inset-0 rounded-lg overflow-hidden pointer-events-none">
                            {isDesteVideo ? (
                              <HlsVideoPlayer
                                src={desteMediaUrl}
                                style={{
                                  opacity: desteShopDetail?.overlayOpacity ?? 1,
                                  mixBlendMode: (desteShopDetail?.overlayMode as any) || 'normal'
                                }}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <img
                                src={desteMediaUrl}
                                alt="Deste Arkalığı"
                                style={{
                                  opacity: desteShopDetail?.overlayOpacity ?? 1,
                                  mixBlendMode: (desteShopDetail?.overlayMode as any) || 'normal'
                                }}
                                className="w-full h-full object-cover"
                              />
                            )}
                            <div className="absolute inset-0 bg-black/20 flex flex-col justify-between p-0.5 z-10">
                              <span className="text-white/60 text-[4px] font-black tracking-widest uppercase">DEAL</span>
                              <span className="text-white text-[10px] font-black self-center drop-shadow-md">♠️</span>
                              <span className="text-white/60 text-right text-[4px] font-black tracking-widest uppercase">PRO</span>
                            </div>
                          </div>
                        ) : (
                          <>
                            {/* Internal floating particles for custom cards */}
                            {profile.settings.cardBack !== 'back_classic' && (
                              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                                {[...Array(4)].map((_, idx) => (
                                  <span
                                    key={idx}
                                    className="absolute rounded-full animate-float"
                                    style={{
                                      left: `${15 + Math.random() * 70}%`,
                                      bottom: '0px',
                                      width: '2px',
                                      height: '2px',
                                      backgroundColor: profile.settings.cardBack === 'back_cosmic' ? '#818CF8' : profile.settings.cardBack === 'back_gold' ? '#FBBF24' : '#F472B6',
                                      boxShadow: `0 0 6px ${profile.settings.cardBack === 'back_cosmic' ? '#818CF8' : '#FBBF24'}`,
                                      animationDelay: `${idx * 0.3}s`,
                                      animationDuration: '1.5s',
                                    }}
                                  />
                                ))}
                              </div>
                            )}
                            <span className="text-white/20 text-left text-[4px] font-black leading-none tracking-widest">Deal Master PRO</span>
                            <span className="text-white text-xs font-black self-center drop-shadow-md">
                              {cardBackPattern}
                            </span>
                            <span className="text-white/20 text-right text-[4px] font-black leading-none tracking-widest">DEAL</span>
                          </>
                        )}

                        {/* Premium Draw Pile Burst FX */}
                        {drawDeckBurst && (
                          <>
                            {/* Shockwave expanding circle */}
                            <motion.div
                              className="absolute inset-0 rounded-lg border-2 border-cyan-400 bg-cyan-400/10 pointer-events-none"
                              initial={{ scale: 0.9, opacity: 1 }}
                              animate={{ scale: 2.1, opacity: 0 }}
                              transition={{ duration: 0.8, ease: "easeOut" }}
                              style={{ zIndex: 10 }}
                            />
                            {/* Inner flare pulse */}
                            <motion.div
                              className="absolute inset-0 bg-white/40 rounded-lg pointer-events-none"
                              animate={{ opacity: [0, 1, 0] }}
                              transition={{ duration: 0.6 }}
                              style={{ zIndex: 20 }}
                            />
                            {/* Curved Motion Path Flying Cards Overlay */}
                            {[0, 1].map((i) => (
                              <motion.div
                                key={`draw-card-fly-${i}`}
                                initial={{
                                  x: 0,
                                  y: 0,
                                  scale: 0.7,
                                  rotate: -15 + i * 20,
                                  opacity: 1
                                }}
                                animate={{
                                  x: [0, -40 - i * 30, -80 + i * 20, -10],
                                  y: [0, -90, -10, 220],
                                  scale: [0.7, 1.25, 1.1, 0.4],
                                  rotate: [-15 + i * 20, 25, -15, 0],
                                  opacity: [1, 1, 1, 0]
                                }}
                                transition={{
                                  duration: 1.1,
                                  delay: i * 0.16,
                                  ease: "easeInOut"
                                }}
                                className="fixed z-50 w-11 h-16 bg-gradient-to-br from-indigo-600 via-purple-600 to-amber-500 border-2 border-white rounded-xl shadow-[0_0_20px_rgba(99,102,241,0.9)] flex items-center justify-center text-white text-base font-black pointer-events-none"
                              >
                                ✨
                              </motion.div>
                            ))}
                            {/* Sparkles shooting up */}
                            <motion.span
                              className="absolute text-sm pointer-events-none text-cyan-300 select-none"
                              initial={{ y: 20, opacity: 0, scale: 0.5 }}
                              animate={{ y: -30, x: -10, opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5] }}
                              transition={{ duration: 1 }}
                              style={{ zIndex: 30, left: '20%' }}
                            >✨</motion.span>
                            <motion.span
                              className="absolute text-xs pointer-events-none text-white select-none"
                              initial={{ y: 20, opacity: 0, scale: 0.5 }}
                              animate={{ y: -25, x: 12, opacity: [0, 1, 0], scale: [0.5, 1.1, 0.5] }}
                              transition={{ duration: 0.9, delay: 0.15 }}
                              style={{ zIndex: 30, right: '20%' }}
                            >🌟</motion.span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })()}
                <span className="text-[7px] text-amber-300 font-black block bg-amber-500/10 px-1 py-0.5 rounded-full inline-block mt-1">
                  {match.deckCount} Kart
                </span>
              </div>

              {/* Timer & Turn status block (SÜRE) */}
              <div className="text-center space-y-0.5 flex flex-col items-center">
                <span className="text-[7.5px] text-slate-400 uppercase tracking-widest block font-bold">SÜRE</span>

                {/* Visual Timer ring */}
                <div className="relative w-10 h-10 rounded-full border-2 border-slate-800 flex items-center justify-center bg-slate-950 shadow-inner">
                  {(match.activeActionRequest || (match.activeActionRequests && match.activeActionRequests.length > 0)) ? (
                    <>
                      <div className="absolute inset-0 rounded-full border-2 border-red-500/40 animate-pulse" />
                      <span className="text-red-400 text-[10px] font-black">
                        {actionTimeLeft !== null ? `${actionTimeLeft}s` : '⏳'}
                      </span>
                    </>
                  ) : (
                    <>
                      {match?.settings?.turnLimit !== 'unlimited' && (
                        <div className="absolute inset-0 rounded-full border-2 border-amber-400 border-t-transparent animate-spin opacity-50" />
                      )}
                      <span className="text-amber-400 text-[10px] font-black">
                        {match?.settings?.turnLimit === 'unlimited' ? '∞' : `${timeLeft}s`}
                      </span>
                    </>
                  )}
                </div>

                <span className="text-[7.5px] font-black uppercase text-slate-300 truncate max-w-[85px]">
                  {(match.activeActionRequest || activeActionCard)
                    ? 'BEKLENİYOR'
                    : (match.players[match.turnIndex].id === profile.id ? 'SIRA SENDE' : match.players[match.turnIndex].username.split(' ')[0])}
                </span>
                <div className="flex flex-col items-center gap-0.5 mt-0.5">
                  <div className="flex gap-1 justify-center">
                    {[1, 2, 3].map((num) => {
                      const isPlayed = match.actionsPlayedThisTurn >= num;
                      const rem = 3 - match.actionsPlayedThisTurn;
                      return (
                        <div
                          key={num}
                          className={`w-1.5 h-1.5 rounded-full border transition-all duration-300 ${isPlayed
                            ? 'bg-red-500/80 border-red-400 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                            : rem === 1
                              ? 'bg-amber-500/20 border-amber-400 animate-pulse'
                              : 'bg-emerald-500/20 border-emerald-400 shadow-[0_0_4px_rgba(16,185,129,0.2)]'
                            }`}
                          title={isPlayed ? 'Hamle Yapıldı' : 'Kalan Hamle'}
                        />
                      );
                    })}
                  </div>
                  <span className={`text-[6.5px] font-extrabold px-1.5 py-0.5 rounded-full tracking-wider leading-none border transition-all ${(3 - match.actionsPlayedThisTurn) === 0
                    ? 'text-red-400 bg-red-950/60 border-red-500/30 animate-pulse'
                    : (3 - match.actionsPlayedThisTurn) === 1
                      ? 'text-amber-400 bg-amber-950/60 border-amber-500/30 animate-pulse font-black'
                      : 'text-emerald-400 bg-emerald-950/60 border-emerald-500/20'
                    }`}>
                    {3 - match.actionsPlayedThisTurn} HAMLE
                  </span>
                </div>
              </div>

              {/* Last Action Played (SON HAMLE) */}
              <div className="text-center space-y-0.5">
                <span className="text-[7.5px] text-slate-400 uppercase tracking-widest block font-bold">{t('last_move', profile)}</span>
                {match.discardPile.length > 0 ? (
                  (() => {
                    const topDiscard = match.discardPile[match.discardPile.length - 1];
                    const isHidden = isCardAnimating(topDiscard.id);
                    return (
                      <div
                        id="discard-pile-zone"
                        className={`flex justify-center cursor-pointer hover:scale-105 transition-all duration-300 relative ${isHidden ? 'opacity-0 pointer-events-none' : ''}`}
                        onClick={() => {
                          playPlaySound();
                          setFocusedCard(topDiscard);
                          setFocusedCardZoom(1.8);
                        }}
                        title={profile.settings.language === 'en' ? "Inspect Last Move" : "Son Hamle Detayını İncele"}
                      >
                        {/* Premium Discard Burst Glow and Ring */}
                        {discardGlow && (
                          <>
                            {/* Shockwave circle ring */}
                            <motion.div
                              className="absolute inset-0 rounded-lg border-2 border-amber-400 bg-amber-400/10 pointer-events-none"
                              initial={{ scale: 0.9, opacity: 1 }}
                              animate={{ scale: 2.2, opacity: 0 }}
                              transition={{ duration: 0.8, ease: "easeOut" }}
                              style={{ zIndex: 10 }}
                            />
                            {/* Outer ambient soft glow */}
                            <motion.div
                              className="absolute inset-x-[-12px] inset-y-[-16px] rounded-xl bg-amber-500/20 blur-xl pointer-events-none"
                              animate={{ opacity: [0, 0.8, 0.8, 0], scale: [0.8, 1.2, 1.2, 0.8] }}
                              transition={{ duration: 1.5, ease: "easeInOut" }}
                              style={{ zIndex: 5 }}
                            />
                            {/* Shimmer overlay */}
                            <motion.div
                              className="absolute inset-0 bg-gradient-to-tr from-amber-500/30 via-white/40 to-yellow-400/30 rounded-lg pointer-events-none"
                              animate={{ opacity: [0, 1, 0] }}
                              transition={{ duration: 1 }}
                              style={{ zIndex: 25 }}
                            />
                            {/* Sparkles */}
                            <motion.span
                              className="absolute text-lg pointer-events-none text-yellow-300 select-none -top-4 -left-4"
                              initial={{ y: 10, opacity: 0 }}
                              animate={{ y: -15, x: -5, opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5] }}
                              transition={{ duration: 1.2 }}
                              style={{ zIndex: 30 }}
                            >✨</motion.span>
                            <motion.span
                              className="absolute text-base pointer-events-none text-amber-300 select-none -bottom-4 -right-4"
                              initial={{ y: -10, opacity: 0 }}
                              animate={{ y: 15, x: 5, opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5] }}
                              transition={{ duration: 1.2, delay: 0.1 }}
                              style={{ zIndex: 30 }}
                            >🌟</motion.span>
                          </>
                        )}
                        <GameCard card={topDiscard} size="mini" activeEffect={cardEffects[topDiscard.id] || null} disable3D={disable3D} cardBack={profile.settings.cardBack} cardSkin={profile.settings.cardSkin || 'skin_none'} />
                      </div>
                    );
                  })()
                ) : (
                  <div className="w-10 h-14 rounded-lg border border-dashed border-white/10 mx-auto flex items-center justify-center text-slate-600 text-[7.5px] font-bold">
                    {profile.settings.language === 'en' ? 'NONE' : 'YOK'}
                  </div>
                )}
                <span className="text-[7px] text-slate-500 block font-bold">{t('action_label', profile)}</span>
              </div>

            </div>

            {/* BENİM VARLIKLARIM (My Assets - Bank & Properties Side-by-Side) */}
            <div className="flex gap-2 items-stretch flex-1 min-h-0">

              {/* BENİM BANKAM (My Bank - Dedicated Left Side Column with no elements above or below) */}
              <div className={`bg-[#090C12]/40 border border-white/5 rounded-xl flex flex-col justify-between transition-all shrink-0 ${isCompactLayout ? 'p-1 sm:p-1.5 space-y-1 w-[68px] sm:w-[84px] md:w-[96px]' : 'p-2 space-y-1.5 w-[84px] sm:w-[104px] md:w-[118px]'
                }`}>
                <span className="text-[9px] text-slate-400 uppercase tracking-wider block font-bold text-center select-none truncate">
                  {t('bank', profile)}
                </span>

                {(() => {
                  const bankTotal = localPlayer.bank.reduce((sum, c) => sum + c.value, 0);
                  const isDraggingActive = draggingCard !== null;

                  return (
                    <div
                      id="bank-drop-zone"
                      onClick={() => {
                        if (bankTotal > 0) {
                          playPlaySound();
                          setShowBankVaultModal(true);
                        }
                      }}
                      onDragOver={(e) => {
                        if (isMyTurn && draggingCard) {
                          e.preventDefault();
                          setIsDragOverBank(true);
                        }
                      }}
                      onDragLeave={() => setIsDragOverBank(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragOverBank(false);
                        if (isMyTurn && draggingCard) {
                          if (isActionLocked) {
                            playAlertSound();
                            alert("Şu an aktif bir ödeme veya hamle talebi var. Bu talep çözülene kadar yeni kart oynayamazsınız!");
                            setDraggingCard(null);
                            return;
                          }
                          if (draggingCard.type === 'property' || draggingCard.type === 'wildcard') {
                            playAlertSound();
                            alert(profile.settings.language === 'en' ? "Property cards cannot be deposited to the bank! Only money and action cards are allowed." : "Arsa mülk kartları bankaya koyulamaz! Sadece aksiyon ve para kartları bankaya konabilir.");
                            return;
                          }
                          playPlaySound();
                          if (isOffline) {
                            handleOfflinePlayCard(draggingCard.id, 'bank');
                          } else {
                            handlePlayCardMultiplayer(draggingCard.id, 'bank');
                          }
                          setDraggingCard(null);
                        }
                      }}
                      className={`flex-1 flex flex-col items-center justify-center p-1 rounded-xl transition-all cursor-pointer ${isDragOverBank
                        ? 'bg-emerald-500/20 border-2 border-emerald-400 scale-[1.03] shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-pulse'
                        : isDraggingActive && draggingCard.type !== 'property' && draggingCard.type !== 'wildcard'
                          ? 'bg-emerald-500/5 border border-dashed border-emerald-500/40 animate-pulse'
                          : 'bg-slate-900/10 border border-emerald-500/10 shadow-[0_4px_12px_rgba(16,185,129,0.05)] hover:border-emerald-400 hover:scale-[1.02]'
                        }`}
                    >
                      <span className={`text-[7px] font-black bg-emerald-950/60 border border-emerald-500/20 px-1.5 py-0.5 rounded-full leading-none mb-1.5 ${bankTotal > 0 ? 'text-emerald-400' : 'text-slate-400'
                        }`}>
                        🏦 {bankTotal}M
                      </span>
                      <div className={`w-full aspect-[2/3] h-auto rounded-lg border flex flex-col justify-between p-1 sm:p-1.5 relative overflow-hidden transition-all ${bankTotal > 0
                        ? 'bg-gradient-to-b from-emerald-900 to-emerald-950 border-emerald-500/50 shadow-xl'
                        : 'bg-slate-950/40 border-dashed border-slate-700'
                        }`}>
                        <div className="absolute -right-2 -bottom-2 text-emerald-900/10 text-3xl font-black">💵</div>
                        <span className="text-[5px] font-black text-emerald-400 tracking-wider leading-none">{t('bank', profile).toUpperCase()}</span>
                        <span className={`text-sm my-auto text-center font-black drop-shadow ${bankTotal > 0 ? 'text-emerald-300' : 'text-slate-600'
                          }`}>{bankTotal}M</span>
                        <span className={`text-[4px] font-extrabold text-center uppercase tracking-wider leading-none ${bankTotal > 0 ? 'text-emerald-500' : 'text-slate-600'
                          }`}>{profile.settings.language === 'en' ? 'VAULT' : 'KASA'}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* BENİM ARAZİLERİM (My Property sets - matches Image 4) */}
              <div className={`bg-[#090C12]/40 border border-white/5 rounded-xl flex-1 flex flex-col justify-center min-h-0 transition-all ${isCompactLayout ? 'p-1 sm:p-1.5 space-y-1' : 'p-2 space-y-1.5'
                }`}>
                <span className="text-[9px] text-slate-400 uppercase tracking-wider block font-bold">
                  {t('my_lands', profile)} ({countCompletedSets(localPlayer.properties)}/3 SET)
                </span>

                {/* Grid of properties or empty state (matches Image 1 - medium-scale stacked layout with bank on left) */}
                <div
                  id="properties-drop-zone"
                  onDragOver={(e) => {
                    if (isMyTurn && draggingCard) {
                      e.preventDefault();
                      setIsDragOverProperties(true);
                    }
                  }}
                  onDragLeave={() => setIsDragOverProperties(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOverProperties(false);
                    if (isMyTurn && draggingCard) {
                      if (isActionLocked) {
                        playAlertSound();
                        alert("Şu an aktif bir ödeme veya hamle talebi var. Bu talep çözülene kadar yeni kart oynayamazsınız!");
                        setDraggingCard(null);
                        return;
                      }
                      // 1. If it's a money card: Send directly to the bank.
                      if (draggingCard.type === 'money') {
                        playPlaySound();
                        if (isOffline) {
                          handleOfflinePlayCard(draggingCard.id, 'bank');
                        } else {
                          handlePlayCardMultiplayer(draggingCard.id, 'bank');
                        }
                        setDraggingCard(null);
                        return;
                      }

                      // 2. If it's a property, property wildcard or house-hotel card:
                      if (draggingCard.type === 'property' || draggingCard.type === 'wildcard' || draggingCard.type === 'house-hotel') {
                        playPlaySound();
                        if (draggingCard.type === 'house-hotel') {
                          const res = checkHouseHotelPlayability(draggingCard);
                          if (!res.playable) {
                            alert(res.reason);
                          } else {
                            setHouseHotelColorPick(draggingCard);
                          }
                        } else if (draggingCard.isWildcard || draggingCard.type === 'wildcard') {
                          setWildcardColorPick(draggingCard);
                        } else {
                          if (isOffline) {
                            handleOfflinePlayCard(draggingCard.id, 'property');
                          } else {
                            handlePlayCardMultiplayer(draggingCard.id, 'property');
                          }
                        }
                        setDraggingCard(null);
                        return;
                      }

                      // 3. For Action / Rent cards, play them as action!
                      const res = checkActionPlayability(draggingCard);
                      if (!res.playable) {
                        alert(res.reason);
                        setDraggingCard(null);
                        return;
                      }

                      playPlaySound();
                      if (draggingCard.type === 'rent') {
                        setRentColorPick(draggingCard);
                      } else if (['sly-deal', 'deal-breaker', 'forced-deal', 'debt-collector'].includes(draggingCard.actionType || '')) {
                        setActiveActionCard(draggingCard);
                        setSelectedOpponentId(null);
                        setSelectedStolenCardId(null);
                        setSelectedStolenColor(null);
                        setSelectedMyCardId(null);
                      } else {
                        if (isOffline) handleOfflinePlayCard(draggingCard.id, 'action');
                        else handlePlayCardMultiplayer(draggingCard.id, 'action');
                      }
                      setDraggingCard(null);
                    }
                  }}
                  className={(() => {
                    // mb-auto ile en üste itildi
                    // h-full ve flex-1 ile aşağıya kadar uzaması sağlandı
                    // max-h-... sınıfları kaldırıldı
                    return `flex-1 h-full mb-auto w-full rounded-xl transition-all flex flex-wrap overflow-auto items-start content-start ${isCompactLayout
                      ? 'gap-1.5 sm:gap-2 p-1.5'
                      : 'gap-2.5 sm:gap-3 p-2'
                      } ${isDragOverProperties
                        ? 'bg-amber-500/10 border-2 border-dashed border-amber-400 shadow-[inset_0_0_15px_rgba(245,158,11,0.2)] animate-pulse'
                        : draggingCard
                          ? 'bg-amber-500/[0.02] border border-dashed border-amber-500/30'
                          : playerVisualStates[localPlayer.id]?.type === 'card_gain'
                          ? 'bg-cyan-500/[0.04] border border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.3)] animate-pulse'
                          : playerVisualStates[localPlayer.id]?.type === 'money_gain'
                          ? 'bg-emerald-500/[0.04] border border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)] animate-pulse'
                          : ''
                      }`;
                  })()}
                >

                  {Object.keys(localPlayer.properties).map((colorKey) => {
                    const col = colorKey as CardColor;
                    const set = localPlayer.properties[col];
                    if (!set || set.cards.length === 0) return null;
                    const isCompleted = set.cards.length >= MAX_IN_SET[col];
                    const isExpanded = expandedPropertyColor === col;

                    const hasCompletedSet = Object.keys(localPlayer.properties).some((c) => {
                      const s = localPlayer.properties[c as CardColor];
                      return s && s.cards.length >= (MAX_IN_SET[c as CardColor] || 0);
                    });

                    // Dynamic dimensions calculation from useCompactLayout hook
                    const dims = getDynamicSetDimensions(set.cards.length, isExpanded, Boolean(set.hasHouse || set.hasHotel));
                    const cardsWrapperHeight = dims.minAccordionHeightClass;

                    const rentVal = calculateSetRent(set.cards, col, set.hasHouse, set.hasHotel);

                    // Neon pulse styles for rent badge
                    const neonColor = COLOR_HEX[col] || '#34d399';
                    const badgePulseStyle = isCompleted ? {
                      boxShadow: `0 0 12px ${neonColor}, inset 0 0 3px ${neonColor}`,
                      borderColor: neonColor,
                      textShadow: `0 0 4px ${neonColor}`,
                    } : {};

                    return (
                      <motion.div
                        key={col}
                        layout
                        id={`property-set-${col}-${localPlayer.id}`}
                        animate={glowingProperties[`${col}-${localPlayer.id}`] ? {
                          boxShadow: [
                            `0 0 0px rgba(0, 0, 0, 0)`,
                            `0 0 30px 8px ${neonColor}`,
                            `0 0 55px 15px ${neonColor}`,
                            `0 0 30px 8px ${neonColor}`,
                            `0 0 0px rgba(0, 0, 0, 0)`
                          ],
                          borderColor: [
                            `rgba(255, 255, 255, 0.1)`,
                            neonColor,
                            `#ffffff`,
                            neonColor,
                            `rgba(255, 255, 255, 0.1)`
                          ],
                          scale: [1, 1.18, 1.25, 1.18, 1],
                          zIndex: [10, 50, 50, 50, 10]
                        } : {
                          boxShadow: '0 0 0px rgba(0, 0, 0, 0)',
                          borderColor: 'rgba(255, 255, 255, 0.1)',
                          scale: 1,
                          zIndex: 10
                        }}
                        transition={{
                          duration: 1.8,
                          times: [0, 0.25, 0.5, 0.75, 1],
                          ease: "easeInOut"
                        }}
                        style={{ position: 'relative' }}
                        onClick={() => {
                          playPlaySound();
                          setExpandedPropertyColor(isExpanded ? null : col);
                          setBuildingTooltipColor(buildingTooltipColor === col ? null : col);
                          setAnalyzedProperty(null);
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleStartPress(col, localPlayer.username, set);
                        }}
                        onMouseUp={handleEndPress}
                        onMouseLeave={() => {
                          handleEndPress();
                          setAnalyzedProperty(null);
                        }}
                        onTouchStart={(e) => {
                          e.stopPropagation();
                          handleStartPress(col, localPlayer.username, set);
                        }}
                        onTouchEnd={() => {
                          handleEndPress();
                          // Clear analyzed property on touch release to prevent sticky modal on mobile
                          setTimeout(() => setAnalyzedProperty(null), 1200);
                        }}
                        onMouseEnter={(e: any) => {
                          if (e?.pointerType === 'mouse' || (typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches)) {
                            setAnalyzedProperty({
                              color: col,
                              ownerName: localPlayer.username,
                              cardsCount: set.cards.length,
                              hasHouse: set.hasHouse,
                              hasHotel: set.hasHotel,
                              currentRent: rentVal
                            });
                          }
                        }}
                        className={`flex flex-col items-center rounded-xl transition-all duration-300 shrink-0 relative cursor-pointer select-none property-set-card-trigger ${dims.containerWidthClass} ${isExpanded
                          ? 'ring-2 ring-amber-400 bg-slate-950/80 shadow-[0_0_15px_rgba(245,158,11,0.35)]'
                          : isCompleted
                            ? 'border border-amber-400 bg-amber-500/10 shadow-[0_0_12px_rgba(251,191,36,0.4)]'
                            : 'border border-white/5 bg-slate-900/40 hover:bg-slate-900/60'
                          }`}
                      >
                        {/* Completed Set Crown Badge Seal */}
                        {isCompleted && (
                          <div className={`absolute -top-2 -right-1.5 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black rounded-full border border-yellow-200 shadow-[0_0_10px_rgba(245,158,11,0.9)] animate-bounce z-40 flex items-center justify-center gap-0.5 pointer-events-none ${dims.badgeSizeClass}`}>
                            <span>👑</span>
                            {!isCompactLayout && <span>TAMAM</span>}
                          </div>
                        )}
                        {/* Active Buildings Indicator Seal */}
                        {(set.hasHouse || set.hasHotel) && (
                          <div className={`absolute -top-2 -left-1.5 bg-gradient-to-r ${set.hasHotel ? 'from-blue-500 to-indigo-600' : 'from-emerald-500 to-teal-600'} text-white font-black rounded-full border ${set.hasHotel ? 'border-blue-300 shadow-[0_0_8px_rgba(59,130,246,0.8)]' : 'border-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.8)]'} z-40 flex items-center justify-center w-5 h-5 cursor-pointer text-[10px]`}
                               onClick={(e) => {
                                 e.stopPropagation();
                                 playPlaySound();
                                 setBuildingTooltipColor(buildingTooltipColor === col ? null : col);
                               }}
                               title={set.hasHotel ? (profile.settings.language === 'en' ? 'Hotel built (+4M Rent)' : 'Otel kuruldu (+4M Kira)') : (profile.settings.language === 'en' ? 'House built (+3M Rent)' : 'Ev kuruldu (+3M Kira)')}
                          >
                            <span>{set.hasHotel ? '🏨' : '🏠'}</span>
                          </div>
                        )}
                        {/* Stack of actual medium property cards (with overlap) */}
                        <div className={`relative flex flex-col items-center w-full transition-all duration-300 ease-out ${cardsWrapperHeight}`}>
                          {set.cards.map((card, idx) => {
                            const isWild = card.isWildcard || card.type === 'wildcard';
                            // Calculate accordion spacing
                            const cardSpacingClass = idx > 0
                              ? (isExpanded
                                ? ''
                                : dims.stackOverlapClass
                              )
                              : '';

                            // Fan out accordion style (yelpaze)
                            const fanStyle = isExpanded ? {
                                transform: `translateY(${idx * dims.fanOffsetY}px) rotate(${(idx - (set.cards.length - 1) / 2) * 6}deg) translateX(${(idx - (set.cards.length - 1) / 2) * 6}px)`,
                                zIndex: 10 + idx,
                             } : {};

                            return (
                              <motion.div
                                key={card.id}
                                layout
                                onClick={(e) => {
                                  // Prevent double-triggering parent toggle if clicking card
                                  e.stopPropagation();
                                  playPlaySound();
                                  // Odak Modu (Zoom) tamamen kaldırıldı. Kart tıklaması sadece set detayını açar/kapatır.
                                  setExpandedPropertyColor(isExpanded ? null : col);
                                }}
                                onMouseEnter={() => setHoveredCard(card)}
                                onMouseLeave={() => setHoveredCard(null)}
                                className={`${cardSpacingClass} w-full transition-all duration-300 hover:z-30 relative cursor-pointer hover:scale-105 ${isCardAnimating(card.id) ? 'opacity-0 pointer-events-none' : ''}`}
                                style={fanStyle}
                                onDoubleClick={(e) => { e.stopPropagation(); if (isWild && isMyTurn) { handleQuickFlipWildcard(card); } }} title={isWild && isMyTurn ? (profile.settings.language === 'en' ? "Double-click to flip color instantly!" : "Renk değiştirmek için çift tıklayın!") : "Kartı Odakla / Genişlet"}
                              >
                                <GameCard card={card} size="mini" activeEffect={cardEffects[card.id] || null} disable3D={disable3D} cardBack={profile.settings.cardBack} cardSkin={profile.settings.cardSkin || 'skin_none'} />
                                {isWild && isMyTurn && (
                                  <div className="absolute top-1 right-1 bg-yellow-500 text-slate-950 text-[6px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center animate-bounce shadow z-10" title="Grup Değiştirebilir">
                                    🔄
                                  </div>
                                )}
                              </motion.div>
                            );
                          })}


                        </div>

                        {/* Unified Neon Glowing Rent Badge */}
                        <div
                          className={`mt-1 w-full rounded-full flex items-center justify-between font-black border transition-all duration-300 select-none ${dims.rentBadgeClass} ${isCompleted
                            ? 'bg-slate-950/95 border-emerald-400/50 text-white animate-pulse'
                            : 'bg-slate-950/80 border-white/5 text-emerald-400'
                            }`}
                          style={{ height: isCompactLayout ? '16px' : '18px', ...badgePulseStyle }}
                        >
                          <span className={`shrink-0 font-extrabold ${dims.fontScaleClass}`}>{isCompleted ? '👑' : `${set.cards.length}/${MAX_IN_SET[col]}`}</span>
                          <div className="h-1.5 w-[1px] bg-white/20 shrink-0" />
                          <span className={`font-mono font-black shrink-0 ${dims.fontScaleClass}`}>{rentVal}M</span>
                        </div>

                        {glowingProperties[`${col}-${localPlayer.id}`] && (
                          <>
                            {/* Holographic Shimmer Flare */}
                            <motion.div 
                              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -skew-x-12 pointer-events-none"
                              initial={{ x: '-150%' }}
                              animate={{ x: '150%' }}
                              transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                              style={{ zIndex: 40 }}
                            />
                            {/* Floating Sparkles */}
                            <motion.span 
                              className="absolute text-lg pointer-events-none text-amber-300 select-none"
                              initial={{ y: 50, x: -10, opacity: 0, scale: 0.5 }}
                              animate={{ y: -40, x: -5, opacity: [0, 1, 1, 0], scale: [0.5, 1.3, 1.3, 0.5] }}
                              transition={{ duration: 1.5, repeat: Infinity }}
                              style={{ zIndex: 45 }}
                            >✨</motion.span>
                            <motion.span 
                              className="absolute text-sm pointer-events-none text-yellow-200 select-none"
                              initial={{ y: 40, x: 25, opacity: 0, scale: 0.5 }}
                              animate={{ y: -30, x: 20, opacity: [0, 1, 1, 0], scale: [0.5, 1.2, 1.2, 0.5] }}
                              transition={{ duration: 1.3, repeat: Infinity, delay: 0.3 }}
                              style={{ zIndex: 45 }}
                            >🌟</motion.span>
                            <motion.span 
                              className="absolute text-md pointer-events-none text-amber-400 select-none"
                              initial={{ y: 60, x: 10, opacity: 0, scale: 0.5 }}
                              animate={{ y: -25, x: 5, opacity: [0, 1, 1, 0], scale: [0.5, 1.25, 1.25, 0.5] }}
                              transition={{ duration: 1.4, repeat: Infinity, delay: 0.15 }}
                              style={{ zIndex: 45 }}
                            >✨</motion.span>
                          </>
                        )}

                        {/* Building Info Tooltip (Bilgi Paneli) */}
                        <AnimatePresence>
                          {buildingTooltipColor === col && (
                            <motion.div
                              initial={{ opacity: 0, y: 10, scale: 0.9 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 8, scale: 0.95 }}
                              className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 z-[150] w-56 bg-slate-900/98 border-2 border-emerald-500/40 backdrop-blur-md rounded-2xl p-3 shadow-[0_10px_30px_rgba(0,0,0,0.8)] text-white select-none pointer-events-auto cursor-default building-tooltip-panel"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {/* Small triangle arrow at the bottom */}
                              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900 border-r-2 border-b-2 border-emerald-500/40 rotate-45" />

                              <div className="flex items-center justify-between border-b border-white/10 pb-1.5 mb-2">
                                <span className="text-[10px] font-black tracking-wide uppercase text-emerald-400">
                                  {profile.settings.language === 'en' ? '🏠 Building Status' : '🏠 Bina Durum Paneli'}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setBuildingTooltipColor(null);
                                  }}
                                  className="text-slate-400 hover:text-white text-[9px] w-4 h-4 rounded-full bg-white/5 flex items-center justify-center cursor-pointer"
                                >
                                  ✕
                                </button>
                              </div>

                              <div className="space-y-2">
                                {/* Set Info */}
                                <div className="flex items-center justify-between">
                                  <span className="font-extrabold text-[10px] uppercase text-slate-200">
                                    {getTranslatedColorLabel(col, profile)} Seti
                                  </span>
                                  <span className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm" style={{ backgroundColor: neonColor }} />
                                </div>

                                {/* House Status Section */}
                                <div className={`flex items-center justify-between p-1.5 rounded-lg border transition-all ${
                                  set.hasHouse 
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                                    : 'bg-white/[0.02] border-white/5 text-slate-500'
                                }`}>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs">🏡</span>
                                    <div className="flex flex-col text-left">
                                      <span className="text-[9px] font-black leading-tight">
                                        {profile.settings.language === 'en' ? 'House' : 'Ev Durumu'}
                                      </span>
                                      <span className="text-[7.5px] text-slate-400 leading-none">
                                        {set.hasHouse ? (profile.settings.language === 'en' ? 'Active' : 'Mevcut') : (profile.settings.language === 'en' ? 'Not built' : 'Yapılmamış')}
                                      </span>
                                    </div>
                                  </div>
                                  <span className={`text-[9.5px] font-mono font-black ${set.hasHouse ? 'text-emerald-400' : 'text-slate-600'}`}>
                                    +3M
                                  </span>
                                </div>

                                {/* Hotel Status Section */}
                                <div className={`flex items-center justify-between p-1.5 rounded-lg border transition-all ${
                                  set.hasHotel 
                                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-300' 
                                    : 'bg-white/[0.02] border-white/5 text-slate-500'
                                }`}>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs">🏨</span>
                                    <div className="flex flex-col text-left">
                                      <span className="text-[9px] font-black leading-tight">
                                        {profile.settings.language === 'en' ? 'Hotel' : 'Otel Durumu'}
                                      </span>
                                      <span className="text-[7.5px] text-slate-400 leading-none">
                                        {set.hasHotel ? (profile.settings.language === 'en' ? 'Active' : 'Mevcut') : (profile.settings.language === 'en' ? 'Not built' : 'Yapılmamış')}
                                      </span>
                                    </div>
                                  </div>
                                  <span className={`text-[9.5px] font-mono font-black ${set.hasHotel ? 'text-blue-400' : 'text-slate-600'}`}>
                                    +4M
                                  </span>
                                </div>

                                {/* Rent Status Overview */}
                                <div className="bg-black/30 p-1.5 rounded-lg text-left text-[8px] space-y-1">
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">
                                      {profile.settings.language === 'en' ? 'Base Set Rent:' : 'Taban Kira:'}
                                    </span>
                                    <span className="font-bold text-white font-mono">
                                      {calculateSetRent(set.cards, col, false, false)}M
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">
                                      {profile.settings.language === 'en' ? 'Active Buildings:' : 'Bina İlavesi:'}
                                    </span>
                                    <span className="font-bold text-amber-300 font-mono">
                                      +{set.hasHotel ? 4 : (set.hasHouse ? 3 : 0)}M
                                    </span>
                                  </div>
                                  <div className="h-[1px] bg-white/10 my-1" />
                                  <div className="flex justify-between text-[9px] font-black">
                                    <span className="text-emerald-400">
                                      {profile.settings.language === 'en' ? 'Total Rent:' : 'Toplam Kira:'}
                                    </span>
                                    <span className="text-emerald-400 font-mono">
                                      {rentVal}M
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}

                  {Object.keys(localPlayer.properties).filter(k => localPlayer.properties[k as CardColor]!.cards.length > 0).length === 0 && (
                    <div className="col-span-full flex-1 flex flex-col items-center justify-center border border-dashed border-white/5 rounded-xl py-4 text-slate-500 min-h-[130px] w-full">
                      <div className="w-10 h-14 border border-dashed border-white/10 rounded-md flex items-center justify-center text-xs text-slate-600">
                        BOŞ
                      </div>
                      <span className="text-[9px] font-bold mt-1 uppercase tracking-wide">henüz arazi yok</span>
                    </div>
                  )}
                </div>

                {/* Mobile Bottom-Sheet Console Dock */}
                <AnimatePresence>
                  {expandedPropertyColor && (() => {
                    const activeCol = expandedPropertyColor;
                    const activeSet = localPlayer.properties[activeCol];
                    if (!activeSet || activeSet.cards.length === 0) return null;
                    const isSetComp = activeSet.cards.length >= MAX_IN_SET[activeCol];
                    const activeRent = calculateSetRent(activeSet.cards, activeCol, activeSet.hasHouse, activeSet.hasHotel);
                    const colorLabel = COLOR_LABELS[activeCol] || activeCol;
                    const colorHex = COLOR_HEX[activeCol] || '#ffffff';

                    return (
                      <>
                        {/* Mobile backdrop click overlay */}
                        <div
                          className="fixed inset-0 bg-slate-950/60 z-[99] sm:hidden animate-fade-in"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedPropertyColor(null);
                          }}
                        />
                        <motion.div
                          initial={{ opacity: 0, y: 80, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 50, scale: 0.98 }}
                          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                          onClick={(e) => e.stopPropagation()}
                          className="fixed bottom-0 left-0 right-0 z-[100] bg-[#0c0f16] border-t border-slate-800/80 rounded-t-3xl p-5 flex flex-col gap-3 shadow-[0_-10px_35px_rgba(0,0,0,0.9)] max-h-[85vh] overflow-y-auto sm:relative sm:bottom-auto sm:left-auto sm:right-auto sm:z-30 sm:bg-[#0c0f16] sm:border sm:border-slate-800/80 sm:rounded-xl sm:p-2.5 sm:mt-2 sm:gap-2 sm:shadow-[0_20px_50px_rgba(0,0,0,0.85)] sm:max-h-none sm:overflow-visible property-details-sheet"
                        >
                          {/* 4 Köşe Siber Braketi (Sadece Masaüstü) */}
                          <div className="absolute top-3 left-3 w-3 h-3 border-t-2 border-l-2 border-slate-500/30 pointer-events-none sm:block hidden" />
                          <div className="absolute top-3 right-3 w-3 h-3 border-t-2 border-r-2 border-slate-500/30 pointer-events-none sm:block hidden" />
                          <div className="absolute bottom-3 left-3 w-3 h-3 border-b-2 border-l-2 border-slate-500/30 pointer-events-none sm:block hidden" />
                          <div className="absolute bottom-3 right-3 w-3 h-3 border-b-2 border-r-2 border-slate-500/30 pointer-events-none sm:block hidden" />

                          {/* Mobile Grab Handle */}
                          <div className="w-10 h-1 bg-slate-700/60 rounded-full mx-auto mb-1 sm:hidden shrink-0" />

                          {/* Subtle Color Accent Line */}
                          <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-3xl sm:rounded-t-none" style={{ backgroundColor: colorHex }} />

                          {/* Bottom Sheet Header */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2.5 h-2.5 rounded-full border border-white/20 shadow-sm" style={{ backgroundColor: colorHex }} />
                              <span className="text-[10px] sm:text-[9px] font-black text-white tracking-wide uppercase">
                                {colorLabel} SETİ DETAYI
                              </span>
                            </div>

                            {/* Close / Collapse button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                playPlaySound();
                                setExpandedPropertyColor(null);
                              }}
                              className="text-slate-400 hover:text-white text-xs sm:text-[9px] bg-white/5 hover:bg-white/10 w-6 h-6 sm:w-4.5 sm:h-4.5 rounded-full flex items-center justify-center transition-colors cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>

                          {/* Grid Layout of stats */}
                          <div className="grid grid-cols-3 gap-1.5 items-center">
                            {/* Card Count Block */}
                            <div className="bg-white/[0.03] border border-white/5 rounded-lg p-1.5 sm:p-1 flex flex-col items-center justify-center text-center">
                              <span className="text-xs sm:text-[10px] leading-none mb-0.5">🎴</span>
                              <span className="text-[7px] sm:text-[6.5px] text-slate-400 uppercase font-black tracking-tight leading-none mb-0.5">KARTLAR</span>
                              <span className={`text-[10px] sm:text-[9px] font-black leading-none ${isSetComp ? 'text-amber-400' : 'text-slate-200'}`}>
                                {activeSet.cards.length}/{MAX_IN_SET[activeCol]} {isSetComp && '👑'}
                              </span>
                            </div>

                            {/* Rent Value Block */}
                            <div className="bg-white/[0.03] border border-white/5 rounded-lg p-1.5 sm:p-1 flex flex-col items-center justify-center text-center relative overflow-hidden">
                              <span className="text-xs sm:text-[10px] leading-none mb-0.5 animate-pulse">💰</span>
                              <span className="text-[7px] sm:text-[6.5px] text-slate-400 uppercase font-black tracking-tight leading-none mb-0.5">KİRA GÜCÜ</span>
                              <motion.span
                                key={activeRent}
                                initial={{ scale: 1.3, y: -2 }}
                                animate={{ scale: 1, y: 0 }}
                                className="text-xs sm:text-[10px] font-black text-emerald-400 leading-none font-mono drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]"
                              >
                                {activeRent}M
                              </motion.span>
                            </div>

                            {/* House/Hotel count Block */}
                            <div className="bg-white/[0.03] border border-white/5 rounded-lg p-1.5 sm:p-1 flex flex-col items-center justify-center text-center">
                              <span className="text-xs sm:text-[10px] leading-none mb-0.5">🏠</span>
                              <span className="text-[7px] sm:text-[6.5px] text-slate-400 uppercase font-black tracking-tight leading-none mb-0.5">BİNALAR</span>
                              <span className="text-[9px] sm:text-[8.5px] font-black text-amber-300 leading-none truncate w-full">
                                {activeSet.hasHotel ? '🏨 Otel' : activeSet.hasHouse ? '🏠 Ev' : 'Yok'}
                              </span>
                            </div>
                          </div>

                          {/* Integrated Rent Scales Grid */}
                          <div className="bg-white/[0.02] border border-white/5 p-1.5 rounded-lg flex flex-col gap-1.5">
                            <span className="text-[8px] sm:text-[7.5px] font-black text-slate-400 uppercase tracking-wide block text-left">
                              {profile.settings.language === 'en' ? 'Rent Scales' : 'Kira Baremleri'}
                            </span>
                            <div className="flex gap-1.5 justify-around">
                              {(RENT_VALUES[activeCol] || []).map((r, idx) => {
                                const isActive = activeSet.cards.length === (idx + 1);
                                return (
                                  <div
                                    key={idx}
                                    className={`flex-1 p-1 rounded-lg text-center transition-all border ${isActive
                                      ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400 font-extrabold shadow-[inset_0_1px_3px_rgba(16,185,129,0.1)]'
                                      : 'bg-black/10 border-transparent text-slate-500 text-[8px]'
                                      }`}
                                  >
                                    <div className="text-[7px] sm:text-[6.5px] uppercase font-extrabold leading-none mb-0.5">{idx + 1}K</div>
                                    <div className="text-[9px] sm:text-[8px] font-black font-mono leading-none">{r}M</div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Large Action Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              playPlaySound();
                              setManagedSetColor(activeCol);
                            }}
                            className={`w-full py-2.5 sm:py-1.5 rounded-lg font-black text-[10px] sm:text-[9px] flex items-center justify-center gap-1 transition-all border uppercase tracking-wider select-none ${isMyTurn
                              ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 border-amber-300 shadow-[0_4px_12px_rgba(245,158,11,0.2)] active:scale-95 cursor-pointer'
                              : 'bg-slate-900 text-slate-500 border-white/5 cursor-not-allowed opacity-50'
                              }`}
                          >
                            <span>⚙️ SETİ DÜZENLE / BİNA YAP</span>
                          </button>
                        </motion.div>
                      </>
                    );
                  })()}
                </AnimatePresence>
              </div>
            </div>

          </div>

          {/* Dynamic Spacer/Gap between properties and hand cards in Compact Mode to prevent overlaps on mobile */}
          {isCompactLayout && (
            <div
              className="w-full bg-transparent flex-shrink-0 transition-all pointer-events-none"
              style={{
                height: isHandExpanded
                  ? `${Math.max(4, 16 - (localPlayer.hand.length * 1.2))}px`
                  : '4px'
              }}
            />
          )}

          {(() => {
            const hasActiveAction = match.activeActionRequest || (match.activeActionRequests && match.activeActionRequests.length > 0);
            const waitingForOthers = hasActiveAction && !myActiveRequest;
            if (!waitingForOthers) return null;

            return (
              <div className="mx-auto my-2 max-w-md w-[92%] bg-slate-950/80 backdrop-blur-md border border-slate-800 rounded-xl p-3 shadow-2xl flex flex-col space-y-2 z-20">
                <div className="flex justify-between items-center border-b border-slate-800/80 pb-1.5">
                  <span className="text-[9px] font-black text-amber-400 tracking-wider uppercase flex items-center gap-1">
                    ⏳ {profile.settings.language === 'en' ? "WAITING FOR OTHERS' DECISION" : 'BAŞKASININ KARARI BEKLENİYOR'}
                  </span>
                  {actionTimeLeft !== null && (
                    <span className="text-[9px] font-mono font-black px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                      ⏱️ {actionTimeLeft}s
                    </span>
                  )}
                </div>

                <div className="text-[10px] text-slate-300 space-y-1">
                  {(() => {
                    // Single request
                    if (match.activeActionRequest) {
                      const req = match.activeActionRequest;
                      const sPlayer = match.players.find(p => p.id === req.sourcePlayerId);
                      const tPlayer = match.players.find(p => p.id === req.targetPlayerId);
                      const actName = req.actionCard?.name || "Aksiyon";

                      return (
                        <p>
                          {profile.settings.language === 'en' ? (
                            <span><strong>{sPlayer?.username}</strong> played <strong>{getTranslatedCardName(req.actionCard, profile)}</strong> against <strong>{tPlayer?.username}</strong>.</span>
                          ) : (
                            <span><strong>{sPlayer?.username}</strong> oyuncusu, <strong>{tPlayer?.username}</strong> oyuncusuna karşı <strong>{actName}</strong> oynadı.</span>
                          )}
                        </p>
                      );
                    }

                    // Multi request (rent or birthday)
                    if (match.activeActionRequests && match.activeActionRequests.length > 0) {
                      const reqs = match.activeActionRequests;
                      const sPlayer = match.players.find(p => p.id === reqs[0].sourcePlayerId);
                      const actName = reqs[0].actionCard?.name || "Kira Talebi";

                      return (
                        <div className="space-y-1.5">
                          <p>
                            {profile.settings.language === 'en' ? (
                              <span><strong>{sPlayer?.username}</strong> requested <strong>{getTranslatedCardName(reqs[0].actionCard, profile)} ({reqs[0].amountDue}M)</strong> from everyone.</span>
                            ) : (
                              <span><strong>{sPlayer?.username}</strong>, herkesten <strong>{actName} ({reqs[0].amountDue}M)</strong> talep etti.</span>
                            )}
                          </p>
                          <div className="grid grid-cols-2 gap-1 bg-black/30 p-1.5 rounded-lg border border-white/5">
                            {match.players.filter(p => p.id !== sPlayer?.id).map(p => {
                              const isPending = reqs.some(r => r.targetPlayerId === p.id);
                              return (
                                <div key={p.id} className="flex items-center justify-between text-[9px] px-1">
                                  <span className="text-slate-400 truncate">{p.username}</span>
                                  {isPending ? (
                                    <span className="text-amber-400 font-extrabold flex items-center gap-0.5">{profile.settings.language === 'en' ? 'Thinking ⏳' : 'Düşünüyor ⏳'}</span>
                                  ) : (
                                    <span className="text-emerald-400 font-extrabold flex items-center gap-0.5">{profile.settings.language === 'en' ? 'Paid/Defended ✅' : 'Ödedi/Savundu ✅'}</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }

                    return null;
                  })()}
                </div>
              </div>
            );
          })()}

          {/* 3. Bottom Cards Drawer (KARTLARIM - Collapsible & matches Image 4) */}
          <div className="bg-slate-900/90 border-t border-white/10 flex-shrink-0 relative z-30">

            {/* Drawer Header Toolbar */}
            <div className="px-3 py-1.5 bg-black/40 flex items-center justify-between border-b border-white/[0.04]">

              {/* Hand Toggler */}
              <button
                onClick={() => {
                  playPlaySound();
                  setIsHandExpanded(!isHandExpanded);
                }}
                className="flex items-center gap-1 text-[10px] font-extrabold text-slate-300 hover:text-white cursor-pointer select-none"
              >
                <span>🎴 {t('cards_count', profile)} ({localPlayer.hand.length})</span>
                <span className="text-[8px]">{isHandExpanded ? '▼' : '▲'}</span>
              </button>

              {/* Active Action Controls */}
              <div className="flex items-center gap-1.5">
                {/* Sıkışık Düzen (Compact Layout) Button */}
                <button
                  id="drawer-compact-btn"
                  onClick={() => {
                    playPlaySound();
                    toggleCompactLayout();
                  }}
                  className={`px-2 py-1 rounded-lg text-[9px] font-black flex items-center gap-1 shadow-sm transition-all cursor-pointer select-none ${
                    isCompactLayout
                      ? 'bg-amber-500 text-slate-950 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10'
                  }`}
                  title={profile.settings.language === 'en' ? "Compact Layout Toggle" : "Sıkışık Düzen Aç/Kapat"}
                >
                  <span>🎴</span>
                  <span>{profile.settings.language === 'en' ? 'Compact' : 'Sıkışık Düzen'}</span>
                </button>

                {match.players[match.turnIndex].id === localPlayer.id ? (
                  <div className="flex items-center gap-1.5">
                    {/* 3D Action Energy Dots */}
                    <div className="flex items-center gap-1 bg-black/50 border border-white/10 px-2 py-0.5 rounded-lg shadow-inner">
                      {[1, 2, 3].map((num) => {
                        const isSpent = match.actionsPlayedThisTurn >= num;
                        return (
                          <div
                            key={num}
                            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                              isSpent
                                ? 'bg-purple-950 border border-purple-800/40 opacity-40 scale-90'
                                : 'bg-amber-400 border border-amber-200 shadow-[0_0_8px_rgba(251,191,36,0.9)] animate-pulse scale-105'
                            }`}
                            title={isSpent ? "Hamle Kullanıldı" : "Kalan Hamle"}
                          />
                        );
                      })}
                      <span className="text-[8.5px] font-black text-amber-300 ml-1">
                        {3 - match.actionsPlayedThisTurn}/3 Hamle
                      </span>
                    </div>
                    <button
                      onClick={isOffline ? handleOfflineEndTurn : handleEndTurnMultiplayer}
                      disabled={isActionLocked}
                      className={`font-black px-3 py-1 rounded-lg text-[9px] shadow-lg flex items-center gap-0.5 ${isActionLocked
                        ? 'bg-purple-900/50 text-purple-300 border border-purple-800/30 cursor-not-allowed opacity-50'
                        : 'bg-purple-600 hover:bg-purple-500 text-white'
                        }`}
                    >
                      {t('btn_end_turn', profile)}
                    </button>
                  </div>
                ) : (
                  <span className="text-[8px] text-slate-400 bg-slate-850 px-1.5 py-0.5 rounded font-bold uppercase">
                    {t('wait_opponent', profile)}
                  </span>
                )}
              </div>

            </div>

            {/* Hand Cards Carousel Content */}
            {isHandExpanded && (
              <div className="p-2.5">
                {match.players[match.turnIndex].id === localPlayer.id && match.actionsPlayedThisTurn === 3 && (
                  <div className="mb-2.5 p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-center text-[10px] font-extrabold text-red-400 animate-pulse flex items-center justify-center gap-1.5 shadow-sm">
                    ⚠️ {t('moves_exhausted_warning', profile)}
                  </div>
                )}

                {/* Excess Card Warning Banner — only shown when moves are exhausted */}
                {localPlayer.hand.length > 7 && match.players[match.turnIndex].id === localPlayer.id && match.actionsPlayedThisTurn === 3 && (
                  <button
                    onClick={() => {
                      playPlaySound();
                      setShowDiscardModal(true);
                    }}
                    className="mb-2.5 w-full p-2.5 bg-rose-500/15 border border-rose-500/40 rounded-xl text-center text-[10px] font-black text-rose-300 flex items-center justify-center gap-2 shadow-sm animate-pulse hover:bg-rose-500/25 transition-all cursor-pointer"
                  >
                    🗑️ {profile.settings.language === 'en'
                      ? `You have ${localPlayer.hand.length} cards — tap to discard ${localPlayer.hand.length - 7} excess card${localPlayer.hand.length - 7 > 1 ? 's' : ''}!`
                      : `Elinde ${localPlayer.hand.length} kart var — ${localPlayer.hand.length - 7} fazla kartı atmak için dokun!`
                    }
                  </button>
                )}

                <div ref={handScrollRef} className={`flex overflow-x-auto pb-1.5 justify-start scrollbar-thin transition-all touch-pan-x select-none ${isCompactLayout ? 'gap-1' : 'gap-2'}`}>
                  {(() => {
                    const sortedHand = [...localPlayer.hand].sort((a, b) => {
                      const getSortOrder = (card: Card) => {
                        if (card.type === 'property' || card.type === 'wildcard') {
                          return 1;
                        }
                        if (card.type === 'action' || card.type === 'rent' || card.type === 'house-hotel') {
                          return 2;
                        }
                        if (card.type === 'money') {
                          return 3;
                        }
                        return 4;
                      };
                      const orderA = getSortOrder(a);
                      const orderB = getSortOrder(b);
                      if (orderA !== orderB) {
                        return orderA - orderB;
                      }
                      return a.name.localeCompare(b.name);
                    });

                    return sortedHand.map((card) => {
                      const isSelected = selectedCard?.id === card.id;

                      // Rent card glow check: glows if localPlayer owns matching land/property
                      const isRentGlowable = (() => {
                        if (card.type !== 'rent') return false;
                        
                        const applicable: CardColor[] = [];
                        if (card.color) applicable.push(card.color as CardColor);
                        if (card.secondaryColor) applicable.push(card.secondaryColor as CardColor);
                        if (card.allowedColors) {
                          card.allowedColors.forEach((c) => applicable.push(c as CardColor));
                        }
                        if (card.colors) {
                          card.colors.forEach((c) => applicable.push(c as CardColor));
                        }
                        const uniqueColors = Array.from(new Set(applicable));
                        const isWildRent = card.name?.includes('Her Renk') || uniqueColors.length === 0;

                        if (isWildRent) {
                          return Object.values(localPlayer.properties || {}).some(
                            (set: any) => set && set.cards && set.cards.length > 0
                          );
                        }

                        return uniqueColors.some((color) => {
                          const set = localPlayer.properties?.[color];
                          return set && set.cards && set.cards.length > 0;
                        });
                      })();

                      return (
                        <motion.div
                          key={card.id}
                          id={`hand-card-${card.id}`}
                          variants={CARD_VARIANTS}
                          initial="initialDraw"
                          animate="draw"
                          whileHover="hover"
                          whileTap="tap"
                          style={{
                            zIndex: draggingCard?.id === card.id ? 100 : hoveredCard?.id === card.id ? 50 : isSelected ? 40 : 1
                          }}
                          draggable={isMyTurn && !isActionLocked}
                          onDragStart={() => {
                            if (isActionLocked) return;
                            triggerHaptic('medium');
                            setDraggingCard(card);
                            playPlaySound();
                          }}
                          onDragEnd={() => {
                            setDraggingCard(null);
                          }}
                          onTouchStart={(e) => {
                            if (isActionLocked) return;
                            triggerHaptic('light');
                            handleTouchStart(e, card);
                          }}
                          onTouchMove={(e) => {
                            if (isActionLocked) return;
                            handleTouchMove(e);
                          }}
                          onTouchEnd={(e) => {
                            if (isActionLocked) return;
                            handleTouchEnd(e);
                          }}
                          onMouseEnter={() => {
                            triggerHaptic('light');
                            setHoveredCard(card);
                          }}
                          onMouseLeave={() => setHoveredCard(null)}
                          className={`cursor-grab active:cursor-grabbing select-none flex-shrink-0 touch-pan-x transition-all duration-300 ${
                            draggingCard?.id === card.id ? 'opacity-40 scale-95' : ''
                          } ${isCardAnimating(card.id) ? 'opacity-0 pointer-events-none' : ''}`}
                        >
                          <GameCard
                            card={card}
                            size={isCompactLayout ? "medium" : "normal"}
                            isSelected={isSelected}
                            isGlowableRent={isRentGlowable}
                            activeEffect={cardEffects[card.id] || null}
                            disable3D={disable3D}
                            cardBack={profile.settings.cardBack} cardSkin={profile.settings.cardSkin || 'skin_none'}
                            onClick={() => {
                              if (isActionLocked) return;
                              if (wasTouchMovedRef.current) return;
                              triggerHaptic('medium');
                              setSelectedCard(card);
                              setShowCardMenu(true);
                              playPlaySound();
                            }}
                          />
                        </motion.div>
                      );
                    });
                  })()}

                  {localPlayer.hand.length === 0 && (
                    <p className="text-[9px] text-slate-500 italic py-4 text-center w-full">Elinizde hiç kart bulunmuyor.</p>
                  )}
                </div>
              </div>
            )}

          </div>

          {/* Live Feed Panel Drawer/Collapsible sidebar on desktop */}
          {showChatPanel && (
            <div className="hidden lg:flex flex-col w-80 bg-slate-950 border-l border-white/10 h-full absolute right-0 top-0 bottom-0 z-40 p-4 justify-between shadow-2xl">
              <div className="border-b border-white/5 pb-2 mb-2 flex items-center justify-between flex-shrink-0">
                <h3 className="font-bold text-xs text-white">{t('live_feed_chat_title', profile)}</h3>
                <span className="text-[8px] font-black uppercase text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded flex items-center gap-1">
                  ⚡ CANLI AKIŞ
                </span>
              </div>

              {/* Filter Tabs Bar */}
              <div className="flex gap-1 p-1 bg-black/40 border border-white/5 rounded-xl mb-2 shrink-0 select-none">
                {[
                  { id: 'all', label: profile.settings.language === 'en' ? 'All' : 'Tümü', icon: '📋' },
                  { id: 'actions', label: profile.settings.language === 'en' ? 'Actions' : 'Hamleler', icon: '⚡' },
                  { id: 'chat', label: profile.settings.language === 'en' ? 'Chat' : 'Sohbet', icon: '💬' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      playPlaySound();
                      setChatFilter(tab.id as any);
                    }}
                    className={`flex-1 py-1 rounded-lg text-[9px] font-black uppercase transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      chatFilter === tab.id
                        ? 'bg-purple-600 text-white shadow-md shadow-purple-900/40'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                    }`}
                  >
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Logs Stream (Reversed Chronological - Latest at top) */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-[10px] scrollbar-thin optimize-scroll optimize-list-render">
                {(() => {
                  const parseEnrichedLogs = (logs: GameLog[]) => {
                    let currentTurn = 1;
                    let currentAction = 0;

                    return logs.map((log) => {
                      const msg = log.message;

                      // Use log's explicit turnNumber if available
                      let turnNum = log.turnNumber || currentTurn;

                      if (!log.turnNumber) {
                        if (msg.includes('Tur Başladı') || msg.includes('Tur başladı') || msg.includes('. Tur:')) {
                          currentTurn++;
                          turnNum = currentTurn;
                          currentAction = 0;
                        }
                      } else {
                        currentTurn = log.turnNumber;
                      }

                      if (msg.includes('Sıra') || msg.includes('sırasını') || msg.includes('turunu') || msg.includes('Oyun başladı')) {
                        if (msg.includes('Sıra') || msg.includes('başladı')) {
                          currentAction = 0;
                        }
                        return {
                          id: log.id,
                          message: log.message,
                          timestamp: log.timestamp,
                          playerName: log.playerName,
                          turnNumber: Math.max(1, turnNum),
                          category: 'turn' as const,
                          icon: '🔄'
                        };
                      }

                      if (log.playerName) {
                        return {
                          id: log.id,
                          message: log.message,
                          timestamp: log.timestamp,
                          playerName: log.playerName,
                          turnNumber: Math.max(1, currentTurn),
                          category: 'chat' as const,
                          icon: '💬'
                        };
                      }

                      let category: 'rent' | 'property' | 'action' | 'defense' | 'system' = 'action';
                      let icon = '⚡';

                      if (msg.includes('kira') || msg.includes('Rent') || msg.includes('borç') || msg.includes('bankaya') || msg.includes('para') || msg.includes('ödedi')) {
                        category = 'rent';
                        icon = '💰';
                        currentAction = (currentAction % 3) + 1;
                      } else if (msg.includes('mülk') || msg.includes('grubuna') || msg.includes('yerleştirdi') || msg.includes('ev') || msg.includes('otel') || msg.includes('set')) {
                        category = 'property';
                        icon = '🏢';
                        currentAction = (currentAction % 3) + 1;
                      } else if (msg.includes('Hayır') || msg.includes('engelledi') || msg.includes('savundu') || msg.includes('Reddet')) {
                        category = 'defense';
                        icon = '🛡️';
                      } else if (msg.includes('sinsi') || msg.includes('Takas') || msg.includes('çaldı') || msg.includes('oynadı') || msg.includes('kartını attı')) {
                        category = 'action';
                        icon = '⚡';
                        currentAction = (currentAction % 3) + 1;
                      } else {
                        category = 'system';
                        icon = 'ℹ️';
                      }

                      return {
                        id: log.id,
                        message: log.message,
                        timestamp: log.timestamp,
                        playerName: log.playerName,
                        turnNumber: Math.max(1, currentTurn),
                        actionNumber: category !== 'system' ? Math.max(1, currentAction) : undefined,
                        category,
                        icon
                      };
                    });
                  };

                  const enrichedAll = parseEnrichedLogs(match.logs).reverse();
                  const filtered = enrichedAll.filter((item) => {
                    if (chatFilter === 'actions') return item.category !== 'chat';
                    if (chatFilter === 'chat') return item.category === 'chat';
                    return true;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="py-8 text-center text-slate-500 text-[10px] font-bold">
                        {profile.settings.language === 'en' ? 'No events found.' : 'Henüz bir olay yok.'}
                      </div>
                    );
                  }

                  return filtered.map((log) => {
                    const timeStr = new Date(log.timestamp).toLocaleTimeString('tr-TR', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    });

                    const styleMap = {
                      rent: 'bg-emerald-950/40 border-emerald-500/35 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.12)]',
                      property: 'bg-blue-950/40 border-blue-500/35 text-blue-200 shadow-[0_0_12px_rgba(59,130,246,0.12)]',
                      action: 'bg-amber-950/40 border-amber-500/35 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.12)]',
                      defense: 'bg-indigo-950/40 border-indigo-500/35 text-indigo-200 shadow-[0_0_12px_rgba(99,102,241,0.12)]',
                      turn: 'bg-purple-950/50 border-purple-500/40 text-purple-200 shadow-[0_0_12px_rgba(168,85,247,0.15)]',
                      chat: 'bg-slate-950/80 border-slate-750 text-slate-200',
                      system: 'bg-slate-900/60 border-white/10 text-slate-300'
                    };

                    return (
                      <div
                        key={log.id}
                        className={`p-2.5 rounded-2xl border ${styleMap[log.category]} transition-all flex flex-col gap-1 text-[10.5px] select-none relative overflow-hidden`}
                      >
                        {/* Header metadata row */}
                        <div className="flex items-center justify-between text-[8px] font-black border-b border-white/10 pb-1 mb-0.5">
                          <div className="flex items-center gap-1">
                            <span className="bg-purple-500/25 text-purple-300 border border-purple-500/40 px-1.5 py-0.2 rounded font-mono font-bold">
                              TUR {log.turnNumber}
                            </span>
                            {log.actionNumber && (
                              <span className="bg-amber-500/25 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 rounded font-mono font-bold">
                                HAMLE {log.actionNumber}/3
                              </span>
                            )}
                            <span className="text-slate-300 font-mono text-[9px] ml-0.5">{log.icon}</span>
                          </div>
                          <span className="text-slate-400 font-mono text-[8px]">{timeStr}</span>
                        </div>

                        {/* Log message content */}
                        {log.playerName ? (
                          <div className="flex items-start gap-1">
                            <strong className="text-amber-400 font-black shrink-0">
                              💬 {log.playerName}:
                            </strong>
                            <span className="text-slate-200 leading-snug break-words">{translateLogMessage(log.message, profile)}</span>
                          </div>
                        ) : (
                          <p className="font-bold leading-snug break-words text-slate-200">
                            {translateLogMessage(log.message, profile)}
                          </p>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Quick Emojis Grid */}
              <div className="grid grid-cols-6 gap-1.5 py-1.5 mt-2 border-t border-white/5 flex-shrink-0">
                {['😂', '😭', '😠', '👍', '🎉', '😮', '💩', '❤️', '🔥', '💸', '🎲', '👑'].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      playPlaySound();
                      if (!isOffline && socketRef.current?.readyState === WebSocket.OPEN) {
                        socketRef.current.send(JSON.stringify({ type: 'trigger_emoji', userId: profile.id, roomId, emoji }));
                      } else {
                        triggerFloatingEmoji(emoji, profile.username);
                      }
                    }}
                    className="h-8 text-base bg-white/5 hover:bg-white/10 active:bg-white/20 border border-white/5 rounded-lg flex items-center justify-center transition-all transform active:scale-90 cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSendChat} className="mt-1 flex gap-1.5 flex-shrink-0">
                <input
                  type="text"
                  placeholder="Mesaj gönder..."
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-white focus:outline-none focus:border-purple-500"
                />
                <button
                  type="submit"
                  className="bg-purple-600 hover:bg-purple-500 text-white font-extrabold px-3 py-1.5 rounded-lg text-[10px] transition-all transform active:scale-95 cursor-pointer"
                >
                  Gönder
                </button>
              </form>
            </div>
          )}

          {/* Floating Chat Trigger Button - toggles overlay drawer on mobile (matches Image 4) */}
          <button
            onClick={() => setShowChatOverlay(true)}
            className="lg:hidden fixed bottom-16 right-4 w-10 h-10 rounded-full bg-slate-800 border border-white/15 shadow-2xl flex items-center justify-center text-lg hover:scale-105 active:scale-95 transition-transform z-40"
          >
            💬
          </button>

        </div>
      )}

      {/* GAME OVER STATE - High-End Responsive Victory & Match Statistics Dashboard */}
      {match.status === 'finished' && (() => {
        const isWinner = match.winnerId === profile.id;
        const winnerPlayer = match.players.find((p) => p.id === match.winnerId);

        // Rank players (Winner #1, others sorted by completed sets then net bank value)
        const rankedPlayers = [...match.players].sort((a, b) => {
          if (a.id === match.winnerId) return -1;
          if (b.id === match.winnerId) return 1;
          const aSets = Object.keys(a.properties).filter(col => (a.properties[col as CardColor]?.cards.length || 0) >= (MAX_IN_SET[col as CardColor] || 99)).length;
          const bSets = Object.keys(b.properties).filter(col => (b.properties[col as CardColor]?.cards.length || 0) >= (MAX_IN_SET[col as CardColor] || 99)).length;
          if (aSets !== bSets) return bSets - aSets;
          const aBank = a.bank.reduce((sum, c) => sum + c.value, 0);
          const bBank = b.bank.reduce((sum, c) => sum + c.value, 0);
          return bBank - aBank;
        });

        // Compute match statistics from logs
        const logs = match.logs || [];
        const totalTurns = logs.filter(l => l.message.includes('Sıra') || l.message.includes('turn')).length || 1;
        const rentCount = logs.filter(l => l.message.includes('kira') || l.message.includes('Rent') || l.message.includes('borç')).length;
        const jsnCount = logs.filter(l => l.message.includes('Hayır') || l.message.includes('engelledi')).length;
        const tradeCount = logs.filter(l => l.message.includes('Takas') || l.message.includes('çaldı')).length;

        return (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col justify-center items-center p-3 sm:p-6 z-[10000] overflow-y-auto select-none font-sans">
            {isWinner && <FireworksCelebration />}

            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 25 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              className="bg-slate-900/95 border border-white/10 rounded-3xl p-5 sm:p-7 text-center space-y-5 max-w-lg w-full relative overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.85)] backdrop-blur-2xl my-auto"
            >
              {/* Top ambient glow accent line */}
              <div className={`absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r ${
                isWinner ? 'from-amber-400 via-emerald-400 to-yellow-400' : 'from-rose-600 via-red-500 to-amber-600'
              }`} />

              {/* Glowing Background Radial Aura */}
              <div className={`absolute -top-20 inset-x-0 h-44 rounded-full blur-3xl pointer-events-none ${
                isWinner ? 'bg-amber-500/15' : 'bg-rose-500/10'
              }`} />

              {/* 1. Header Trophy / Status Banner */}
              <div className="relative z-10 flex flex-col items-center space-y-2">
                <div className="relative">
                  {isWinner ? (
                    <div className="relative">
                      <div className="absolute inset-0 rounded-full bg-amber-400/30 blur-xl animate-pulse" />
                      <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-3xl bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 p-0.5 shadow-[0_0_35px_rgba(245,158,11,0.5)] transform rotate-3 animate-bounce">
                        <div className="w-full h-full bg-slate-950 rounded-[22px] flex items-center justify-center border border-amber-400/40">
                          <span className="text-4xl sm:text-5xl filter drop-shadow-[0_0_10px_rgba(251,191,36,0.8)]">👑</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-br from-slate-700 to-slate-900 p-0.5 shadow-xl">
                      <div className="w-full h-full bg-slate-950 rounded-[22px] flex items-center justify-center border border-white/10">
                        <span className="text-4xl filter drop-shadow">💔</span>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-wider font-sans drop-shadow-md">
                    {isWinner ? (profile.settings.language === 'en' ? 'VICTORY!' : 'MUHTEŞEM ZAFER!') : (profile.settings.language === 'en' ? 'MATCH ENDED' : 'MAÇ SONUCU')}
                  </h2>
                  <div className="flex items-center justify-center gap-2 mt-1">
                    <span className={`py-1 px-4 rounded-full text-xs font-black tracking-widest uppercase border shadow-lg ${
                      isWinner
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-emerald-500/10'
                        : 'bg-rose-500/15 text-rose-400 border-rose-500/30 shadow-rose-500/10'
                    }`}>
                      {isWinner ? (profile.settings.language === 'en' ? '🎉 YOU WON THE MATCH!' : '🎉 MAÇI KAZANDINIZ!') : (profile.settings.language === 'en' ? '🥺 DEFEATED' : 'MAĞLUP OLDUNUZ')}
                    </span>
                  </div>
                </div>

                {/* Earnings / Rewards Badge */}
                <div className="flex items-center gap-2 pt-1">
                  <span className="bg-amber-500/15 border border-amber-500/30 text-amber-400 font-black text-[11px] px-3 py-1 rounded-xl flex items-center gap-1 shadow-sm">
                    🪙 +{isWinner ? 150 : 30} {profile.settings.language === 'en' ? 'Coins' : 'Altın'}
                  </span>
                  <span className="bg-purple-500/15 border border-purple-500/30 text-purple-300 font-black text-[11px] px-3 py-1 rounded-xl flex items-center gap-1 shadow-sm">
                    ⭐ +{isWinner ? 100 : 30} XP
                  </span>
                </div>
              </div>

              {/* 2. Scoreboard Table (Skor & Sıralama Tablosu) */}
              <div className="space-y-2 text-left relative z-10">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">
                  🏆 {profile.settings.language === 'en' ? 'MATCH RANKINGS' : 'MAÇ SKOR TABLOSU'}
                </span>
                
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5 scrollbar-thin">
                  {(match.finalRankings && match.finalRankings.length > 0 ? match.finalRankings : rankedPlayers.map((p, idx) => {
                    const isChampion = p.id === match.winnerId;
                    const bankTotal: number = p.bank.reduce((sum: number, c: any) => sum + (Number(c.value) || 0), 0);
                    const completedSets: number = Object.keys(p.properties).filter(col => (p.properties[col as CardColor]?.cards.length || 0) >= (MAX_IN_SET[col as CardColor] || 99)).length;
                    const totalPropCards: number = (Object.values(p.properties) as any[]).reduce((sum: number, set: any) => sum + Number(set?.cards?.length || 0), 0);
                    const calculatedScore: number = Number(completedSets * 500) + Number(totalPropCards * 20) + Number(bankTotal * 10);
                    
                    return {
                      playerId: p.id,
                      username: p.username,
                      avatarId: p.avatarId,
                      avatarUrl: p.avatarUrl,
                      profileFrame: p.profileFrame,
                      rank: idx + 1,
                      matchScore: calculatedScore,
                      score: `${calculatedScore.toLocaleString('tr-TR')} Maç Puanı`,
                      completeSets: completedSets,
                      bankTotal: bankTotal,
                      rpChange: isChampion ? 25 : idx === 1 ? 10 : idx === 2 ? -5 : -15,
                      isWinner: isChampion,
                      isBot: p.isBot
                    };
                  })).map((item: any, idx: number) => {
                    const isChampion = item.isWinner || item.rank === 1;
                    const isLocal = item.playerId === profile.id;
                    const rankMedal = idx === 0 ? '🥇 1. Sıra' : idx === 1 ? '🥈 2. Sıra' : idx === 2 ? '🥉 3. Sıra' : '🏅 4. Sıra';

                    return (
                      <div
                        key={item.playerId || idx}
                        className={`p-2.5 rounded-2xl border flex items-center justify-between gap-2 transition-all ${
                          isChampion
                            ? 'bg-amber-500/10 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                            : isLocal
                            ? 'bg-indigo-950/40 border-indigo-500/40 shadow-[0_0_10px_rgba(99,102,241,0.15)]'
                            : 'bg-slate-950/50 border-white/5'
                        }`}
                      >
                        {/* Rank & User Info */}
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span className="text-xs shrink-0 font-black text-amber-300 font-mono">{rankMedal}</span>
                          <AvatarWithFrame
                            avatarId={item.avatarId || 'avatar_classic'}
                            avatarUrl={item.avatarUrl}
                            frameId={item.profileFrame || 'frame_none'}
                            sizeClassName="w-8 h-8 text-[10px] shrink-0"
                          />
                          <div className="min-w-0 flex flex-col">
                            <span className="text-xs font-black text-white truncate flex items-center gap-1">
                              {item.username}
                              {isLocal && (
                                <span className="text-[8px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1 py-0.2 rounded font-black uppercase">
                                  {profile.settings.language === 'en' ? 'YOU' : 'SEN'}
                                </span>
                              )}
                            </span>
                            <span className="text-[9px] text-slate-300 font-bold flex items-center gap-1.5 font-mono">
                              <span className="text-amber-400 font-black">{item.score || `${item.matchScore || 0} Puan`}</span>
                              {item.rpChange !== undefined && (
                                <span className={`font-black px-1 rounded text-[8px] ${item.rpChange >= 0 ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' : 'text-rose-400 bg-rose-500/10 border border-rose-500/20'}`}>
                                  {item.rpChange >= 0 ? `+${item.rpChange}` : item.rpChange} RP
                                </span>
                              )}
                            </span>
                          </div>
                        </div>

                        {/* Stats Badges */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${
                            item.completeSets > 0 ? 'bg-amber-500/15 text-amber-300 border-amber-500/20' : 'bg-slate-850 text-slate-500 border-white/5'
                          }`}>
                            🏆 {item.completeSets} Set
                          </span>
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                            💰 {item.bankTotal}M
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 3. Match Analytics Bento Grid */}
              <div className="space-y-2 text-left relative z-10">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">
                  📊 {profile.settings.language === 'en' ? 'MATCH ANALYTICS' : 'MAÇ İSTATİSTİKLERİ'}
                </span>

                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="bg-slate-950/60 border border-white/5 rounded-2xl p-2.5">
                    <span className="text-[8px] font-bold text-slate-400 uppercase block">⏱️ {profile.settings.language === 'en' ? 'TOTAL TURNS' : 'TOPLAM TUR'}</span>
                    <span className="text-lg font-black text-amber-400">{rentCount > 0 ? totalTurns : totalTurns} {profile.settings.language === 'en' ? 'Turns' : 'Tur'}</span>
                  </div>
                  <div className="bg-slate-950/60 border border-white/5 rounded-2xl p-2.5">
                    <span className="text-[8px] font-bold text-slate-400 uppercase block">💰 {profile.settings.language === 'en' ? 'RENT EVENTS' : 'KİRA TAHSİLATLARI'}</span>
                    <span className="text-lg font-black text-emerald-400">{rentCount} {profile.settings.language === 'en' ? 'Times' : 'Kere'}</span>
                  </div>
                  <div className="bg-slate-950/60 border border-white/5 rounded-2xl p-2.5">
                    <span className="text-[8px] font-bold text-slate-400 uppercase block">🛡️ {profile.settings.language === 'en' ? 'DEFENSES (JSN)' : 'ENGELLEMELER (JSN)'}</span>
                    <span className="text-lg font-black text-indigo-400">{jsnCount} {profile.settings.language === 'en' ? 'Times' : 'Kere'}</span>
                  </div>
                  <div className="bg-slate-950/60 border border-white/5 rounded-2xl p-2.5">
                    <span className="text-[8px] font-bold text-slate-400 uppercase block">🔄 {profile.settings.language === 'en' ? 'PROPERTY TRADES' : 'TAKAS & ÇALMALAR'}</span>
                    <span className="text-lg font-black text-rose-400">{tradeCount} {profile.settings.language === 'en' ? 'Times' : 'Kere'}</span>
                  </div>
                </div>
              </div>

              {/* 4. Action Buttons Footer */}
              <div className="pt-2 space-y-2 relative z-10">
                <div className="grid grid-cols-2 gap-2">
                  {/* Play Again (Restart) Button */}
                  <button
                    onClick={() => {
                      playPlaySound();
                      if (isOffline) {
                        handleStartOfflineGame();
                      } else {
                        onLeaveRoom();
                      }
                    }}
                    className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-black rounded-2xl text-xs transition-all shadow-lg active:scale-95 cursor-pointer uppercase tracking-wider flex items-center justify-center gap-1.5"
                  >
                    🔄 {isOffline ? (profile.settings.language === 'en' ? 'Play Again' : 'Yeniden Başlat') : (profile.settings.language === 'en' ? 'New Game' : 'Yeni Maç')}
                  </button>

                  {/* Main Menu Button */}
                  <button
                    onClick={() => {
                      playPlaySound();
                      onLeaveRoom();
                    }}
                    className="w-full py-3 bg-slate-800 hover:bg-slate-750 text-white font-black rounded-2xl text-xs transition-all border border-white/10 active:scale-95 cursor-pointer uppercase tracking-wider flex items-center justify-center gap-1.5"
                  >
                    🏠 {profile.settings.language === 'en' ? 'Main Menu' : 'Ana Menü'}
                  </button>
                </div>
              </div>

            </motion.div>
          </div>
        );
      })()}

      {/* --- OVERLAYS & MODALS PANEL --- */}

      {/* 0. Odak Modu (Focus Mode) overlay modal */}
      {focusedCard && (
        <div
          onClick={() => setFocusedCard(null)}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex flex-col items-center justify-center p-4 z-[60] animate-fade-in select-none"
        >
          {/* Main Container */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg flex flex-col items-center space-y-4 relative"
          >

            {/* Dynamic Slider and Zoom Info Panel */}
            <div className="bg-slate-900 border border-slate-800/85 rounded-2xl p-4 w-full flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xl relative">
              <div className="text-center sm:text-left">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">ODAK MODU / ZOOM</span>
                <h4 className="text-sm font-bold text-white uppercase tracking-tight">{TURKISH_NAMES[focusedCard.name] || focusedCard.name}</h4>
              </div>

              {/* Zoom slider controls */}
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={() => setFocusedCardZoom(prev => Math.max(0.8, prev - 0.2))}
                  className="w-8 h-8 rounded-full bg-slate-800 border border-white/5 flex items-center justify-center text-white font-extrabold hover:bg-slate-750 active:scale-90 transition-all text-xs cursor-pointer"
                  title="Uzaklaştır (-)"
                >
                  ➖
                </button>
                <div className="flex-1 sm:w-28 flex flex-col">
                  <input
                    type="range"
                    min="0.8"
                    max="2.5"
                    step="0.1"
                    value={focusedCardZoom}
                    onChange={(e) => setFocusedCardZoom(parseFloat(e.target.value))}
                    className="w-full accent-amber-500 h-1.5 bg-slate-850 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-[8.5px] font-mono text-center text-slate-400 mt-1 font-bold">
                    Ölçek: %{Math.round(focusedCardZoom * 100)}
                  </span>
                </div>
                <button
                  onClick={() => setFocusedCardZoom(prev => Math.min(2.5, prev + 0.2))}
                  className="w-8 h-8 rounded-full bg-slate-800 border border-white/5 flex items-center justify-center text-white font-extrabold hover:bg-slate-750 active:scale-90 transition-all text-xs cursor-pointer"
                  title="Yakınlaştır (+)"
                >
                  ➕
                </button>
              </div>
            </div>

            {/* Centered Large Card Canvas */}
            <div className="flex-1 flex items-center justify-center overflow-auto py-8 w-full min-h-[300px]">
              <div
                style={{
                  transform: `scale(${focusedCardZoom})`,
                  transition: 'transform 100ms cubic-bezier(0.16, 1, 0.3, 1)'
                }}
                className="origin-center shadow-2xl rounded-xl"
              >
                <GameCard card={focusedCard} size="normal" activeEffect={cardEffects[focusedCard.id] || null} disable3D={disable3D} cardBack={profile.settings.cardBack} cardSkin={profile.settings.cardSkin || 'skin_none'} />
              </div>
            </div>

            {/* Action buttons and dismiss */}
            <div className="w-full flex flex-col gap-2">
              {(focusedCard.isWildcard || focusedCard.type === 'wildcard') && isMyTurn && (
                <button
                  onClick={() => {
                    playPlaySound();
                    setPropertyWildcardColorPick(focusedCard);
                    setFocusedCard(null);
                  }}
                  className="w-full py-2.5 bg-yellow-500 hover:bg-yellow-600 text-slate-950 font-black rounded-xl text-xs shadow-lg transition-all flex items-center justify-center gap-1.5 uppercase tracking-wide cursor-pointer"
                >
                  🔄 KARTIN RENGİNİ / GRUBUNU DEĞİŞTİR
                </button>
              )}

              <button
                onClick={() => {
                  playPlaySound();
                  setFocusedCard(null);
                }}
                className="w-full py-2.5 bg-slate-850 hover:bg-slate-800 text-white font-black rounded-xl text-xs border border-white/10 shadow transition-all uppercase tracking-wider cursor-pointer"
              >
                ✕ İncelemeyi Kapat
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 1. Play Card Menu overlay modal */}
      {showCardMenu && selectedCard && (() => {
        const cardColorHex = selectedCard.color ? COLOR_HEX[selectedCard.color] : (selectedCard.type === 'money' ? '#10b981' : '#f59e0b');
        return (
          <div
            onClick={() => {
              setSelectedCard(null);
              setShowCardMenu(false);
            }}
            className="fixed inset-0 bg-slate-950/90 flex items-center justify-center p-4 z-50 animate-fade-in"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 border border-slate-750/80 rounded-3xl p-6 w-full max-w-xl shadow-2xl flex flex-col md:flex-row gap-6 items-center relative overflow-hidden"
            >
              {/* Decorative top accent glow */}
              <div
                className="absolute top-0 inset-x-0 h-[3px] transition-colors"
                style={{ backgroundColor: cardColorHex, boxShadow: `0 0 15px 3px ${cardColorHex}` }}
              />

              {/* Sol Sütun: 3D Tilt Kart Önizleme */}
              <div
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left - rect.width / 2;
                  const y = e.clientY - rect.top - rect.height / 2;
                  setTiltX((x / (rect.width / 2)) * 12);
                  setTiltY(-(y / (rect.height / 2)) * 12);
                }}
                onMouseLeave={() => {
                  setTiltX(0);
                  setTiltY(0);
                }}
                onClick={() => {
                  setFocusedCard(selectedCard);
                  setFocusedCardZoom(window.innerWidth < 640 ? 1.4 : 1.8);
                }}
                className="flex flex-col items-center gap-2.5 flex-shrink-0 cursor-zoom-in group select-none relative"
                style={{ perspective: 1000 }}
              >
                {/* Dynamically colored background glow */}
                <div
                  className="absolute inset-0 rounded-2xl filter blur-xl opacity-25 group-hover:opacity-40 transition-opacity duration-300"
                  style={{ backgroundColor: cardColorHex, transform: 'scale(0.85)' }}
                />

                <motion.div
                  animate={{ rotateX: tiltY, rotateY: tiltX }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  style={{ transformStyle: 'preserve-3d' }}
                  className="scale-100 md:scale-110 origin-center my-2"
                >
                  <GameCard
                    card={selectedCard}
                    size="normal"
                    activeEffect={cardEffects[selectedCard.id] || null}
                    disable3D={disable3D}
                    cardBack={profile.settings.cardBack}
                    cardSkin={profile.settings.cardSkin || 'skin_none'}
                  />
                </motion.div>

                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-slate-200 transition-colors">
                  🔍 Büyütmek İçin Karta Dokun
                </span>
              </div>

              {/* Sağ Sütun: Aksiyon Menüsü */}
              <div className="flex-1 w-full space-y-4">
                <div className="text-center md:text-left border-b border-white/10 pb-3">
                  <span className="text-[10px] font-black text-amber-400 block uppercase tracking-widest mb-0.5">{t('KART SEÇENEKLERİ', profile)}</span>
                  <h3 className="text-lg font-black text-slate-100 uppercase tracking-tight mt-0.5" style={{ color: cardColorHex }}>
                    {getTranslatedCardName(selectedCard, profile)}
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed mt-1.5 font-medium">
                    {renderColorizedText(getTranslatedCardDesc(selectedCard, profile), profile.settings.language)}
                  </p>
                </div>

                <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1 scrollbar-thin">
                  {/* Option 1: Add to Bank */}
                  {(selectedCard.type !== 'property' && selectedCard.type !== 'wildcard') && (
                    <button
                      onClick={() => {
                        if (isActionLocked) {
                          playAlertSound();
                          alert("Şu an aktif bir ödeme veya hamle talebi var. Bu talep çözülene kadar yeni kart oynayamazsınız!");
                          return;
                        }
                        if (isOffline) handleOfflinePlayCard(selectedCard.id, 'bank');
                        else handlePlayCardMultiplayer(selectedCard.id, 'bank');
                      }}
                      className="w-full p-3.5 rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/30 to-slate-900 hover:from-emerald-950/50 hover:to-slate-850 hover:border-emerald-500/60 text-white transition-all text-left active:scale-[0.98] cursor-pointer group flex flex-col gap-0.5 shadow-md"
                    >
                      <div className="flex items-center gap-2 font-black text-xs text-emerald-400 group-hover:text-emerald-300 transition-colors">
                        🪙 Bankaya Koy (+{selectedCard.value}M)
                      </div>
                      <div className="text-[10px] text-slate-300 font-medium">
                        Kasa değerini artırır, ödemelerde kullanılır ve rakipler tarafından çalınamaz.
                      </div>
                    </button>
                  )}

                  {/* Option 2: Place in Collection as property */}
                  {(selectedCard.type === 'property' || selectedCard.type === 'wildcard' || selectedCard.type === 'house-hotel') && (
                    <button
                      onClick={() => {
                        if (isActionLocked) {
                          playAlertSound();
                          alert("Şu an aktif bir ödeme veya hamle talebi var. Bu talep çözülene kadar yeni kart oynayamazsınız!");
                          return;
                        }
                        if (selectedCard.type === 'house-hotel') {
                          const res = checkHouseHotelPlayability(selectedCard);
                          if (!res.playable) {
                            alert(res.reason);
                          } else {
                            setHouseHotelColorPick(selectedCard);
                            setShowCardMenu(false);
                          }
                        } else if (selectedCard.isWildcard) {
                          setWildcardColorPick(selectedCard);
                          setShowCardMenu(false);
                        } else {
                          if (isOffline) handleOfflinePlayCard(selectedCard.id, 'property');
                          else handlePlayCardMultiplayer(selectedCard.id, 'property');
                        }
                      }}
                      className="w-full p-3.5 rounded-2xl border text-white transition-all text-left active:scale-[0.98] cursor-pointer group flex flex-col gap-0.5 shadow-md"
                      style={{
                        borderColor: `${cardColorHex}50`,
                        background: `linear-gradient(135deg, ${cardColorHex}15, rgba(15, 23, 42, 0.6))`
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = cardColorHex;
                        e.currentTarget.style.background = `linear-gradient(135deg, ${cardColorHex}25, rgba(15, 23, 42, 0.8))`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = `${cardColorHex}50`;
                        e.currentTarget.style.background = `linear-gradient(135deg, ${cardColorHex}15, rgba(15, 23, 42, 0.6))`;
                      }}
                    >
                      <div className="flex items-center gap-2 font-black text-xs group-hover:brightness-110 transition-all" style={{ color: cardColorHex }}>
                        🏠 Sahaya Sür (Mülk Olarak)
                      </div>
                      <div className="text-[10px] text-slate-300 font-medium">
                        Kazanmak için mülk setlerine yerleştirir ve kira toplama zeminini hazırlar.
                      </div>
                    </button>
                  )}

                  {/* Option 3: Play Action card */}
                  {(selectedCard.type === 'action' || selectedCard.type === 'rent') && (
                    <button
                      onClick={() => {
                        const res = checkActionPlayability(selectedCard);
                        if (!res.playable) {
                          alert(res.reason);
                          return;
                        }

                        if (selectedCard.type === 'rent') {
                          setRentColorPick(selectedCard);
                          setShowCardMenu(false);
                        } else if (['sly-deal', 'deal-breaker', 'forced-deal', 'debt-collector'].includes(selectedCard.actionType || '')) {
                          setActiveActionCard(selectedCard);
                          setSelectedOpponentId(null);
                          setSelectedStolenCardId(null);
                          setSelectedStolenColor(null);
                          setSelectedMyCardId(null);
                          setShowCardMenu(false);
                        } else {
                          if (isOffline) handleOfflinePlayCard(selectedCard.id, 'action');
                          else handlePlayCardMultiplayer(selectedCard.id, 'action');
                        }
                      }}
                      className="w-full p-3.5 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-950/30 to-slate-900 hover:from-amber-950/50 hover:to-slate-850 hover:border-amber-500/60 text-white transition-all text-left active:scale-[0.98] cursor-pointer group flex flex-col gap-0.5 shadow-md"
                    >
                      <div className="flex items-center gap-2 font-black text-xs text-amber-400 group-hover:text-amber-300 transition-colors">
                        ⚡ Aksiyonu Tetikle
                      </div>
                      <div className="text-[10px] text-slate-300 font-medium">
                        Kartın özel aksiyon etkisini başlatır ve rakiplerinize karşı üstünlük kurar.
                      </div>
                    </button>
                  )}

                  {/* Option 4: Discard Card */}
                  {localPlayer.hand.length > 7 && (
                    <button
                      onClick={() => {
                        if (isOffline) handleOfflineDiscard(selectedCard.id);
                        else handleDiscardMultiplayer(selectedCard.id);
                        setSelectedCard(null);
                        setShowCardMenu(false);
                      }}
                      className="w-full p-3.5 rounded-2xl border border-red-500/30 bg-gradient-to-r from-red-950/30 to-slate-900 hover:from-red-950/50 hover:to-slate-850 hover:border-red-500/60 text-white transition-all text-left active:scale-[0.98] cursor-pointer group flex flex-col gap-0.5 shadow-md"
                    >
                      <div className="flex items-center gap-2 font-black text-xs text-red-400 group-hover:text-red-300 transition-colors">
                        🗑️ Elinden Çöpe At
                      </div>
                      <div className="text-[10px] text-slate-300 font-medium">
                        Elinizdeki kart limiti olan 7'yi aşmamak için bu kartı feda edin.
                      </div>
                    </button>
                  )}
                </div>

                <button
                  onClick={() => {
                    setSelectedCard(null);
                    setShowCardMenu(false);
                  }}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-750 text-slate-200 font-extrabold rounded-2xl text-xs transition-all cursor-pointer border border-slate-700/50 mt-1"
                >
                  {t('cancel', profile)}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 2. Wildcard Color selector prompt */}
      <AnimatePresence>
        {isMyTurn && wildcardColorPick && (
          <motion.div
            id="context-aware-interaction-panel"
            key="wildcard-color-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setWildcardColorPick(null)}
            className="fixed inset-0 bg-slate-950/90 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.92, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.92, y: 15, opacity: 0 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 border border-slate-750/70 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl relative overflow-hidden"
            >
              {/* Radial gradient background accent */}
              <div className="absolute -top-16 -left-16 w-36 h-36 bg-amber-500/10 rounded-full filter blur-2xl pointer-events-none" />

              <div className="text-center pb-2 border-b border-white/10 relative">
                <span className="text-xs font-black text-amber-400 tracking-widest uppercase block mb-1">
                  ✨ {t('color_select', profile)}
                </span>
                <h3 className="text-sm font-black text-slate-100">
                  {profile.settings.language === 'en' ? 'Choose Wildcard Placement' : 'Joker Kartı Rengini Seçin'}
                </h3>
                <p className="text-xs text-slate-300 font-medium mt-1">
                  {profile.settings.language === 'en' 
                    ? 'Deploy this wildcard to one of your property sets:' 
                    : 'Joker kartınızı mülk setlerinizden birine yerleştirin:'}
                </p>
              </div>

              {match?.settings?.turnLimit !== 'unlimited' && (
                <div className="text-center bg-amber-500/10 border border-amber-500/20 py-2 px-3 rounded-xl text-xs text-amber-400 font-black flex items-center justify-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                  </span>
                  ⏱️ {profile.settings.language === 'en' ? 'Decision Time Left:' : 'Kalan Seçim Süresi:'} <span className="text-sm font-black text-amber-300">{timeLeft}s</span>
                </div>
              )}

              {/* Dynamic Property Color Options rendered as Mini Land Cards */}
              <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
                {(() => {
                  const possibleColors: CardColor[] = [];
                  if (wildcardColorPick.allowedColors && wildcardColorPick.allowedColors.length > 0) {
                    possibleColors.push(...wildcardColorPick.allowedColors);
                  } else {
                    if (wildcardColorPick.color) {
                      possibleColors.push(wildcardColorPick.color);
                    }
                    if (wildcardColorPick.secondaryColor && wildcardColorPick.secondaryColor !== wildcardColorPick.color) {
                      possibleColors.push(wildcardColorPick.secondaryColor);
                    }
                    if (possibleColors.length === 0) {
                      possibleColors.push('brown', 'lightblue', 'pink', 'orange', 'red', 'yellow', 'green', 'darkblue', 'railroad', 'utility');
                    }
                  }

                  // Sort colors: colors where player owns property come FIRST at the top!
                  possibleColors.sort((a, b) => {
                    const countA = localPlayer.properties[a]?.cards.length || 0;
                    const countB = localPlayer.properties[b]?.cards.length || 0;
                    if (countA > 0 && countB === 0) return -1;
                    if (countA === 0 && countB > 0) return 1;
                    return countB - countA;
                  });

                  const isAlreadyPlayed = !localPlayer.hand.some((c) => c.id === wildcardColorPick.id);

                  return possibleColors.map((col) => {
                    const count = localPlayer.properties[col]?.cards.length || 0;
                    const max = MAX_IN_SET[col] || 0;
                    const isComplete = count === max && max > 0;
                    const colorHex = COLOR_HEX[col];

                    return (
                      <motion.button
                        key={col}
                        whileHover={{ scale: 1.03, y: -2 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => {
                          triggerHaptic('light');
                          playPlaySound();
                          if (isAlreadyPlayed) {
                            if (isOffline) handleOfflineChangeWildcardColor(wildcardColorPick.id, col);
                            else handleChangeWildcardColorMultiplayer(wildcardColorPick.id, col);
                          } else {
                            if (isOffline) handleOfflinePlayCard(wildcardColorPick.id, 'property', col);
                            else handlePlayCardMultiplayer(wildcardColorPick.id, 'property', col);
                          }
                          setWildcardColorPick(null);
                        }}
                        className="rounded-2xl border flex flex-col items-stretch transition-all bg-slate-950/60 hover:bg-slate-950 cursor-pointer relative overflow-hidden group shadow-lg text-left"
                        style={{ borderColor: `${colorHex}40` }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = colorHex;
                          e.currentTarget.style.boxShadow = `0 4px 18px -2px ${colorHex}40`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = `${colorHex}40`;
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        {/* Mini Land Card Color Header */}
                        <div className="py-2 px-3 flex items-center justify-between text-slate-950 font-black text-xs uppercase" style={{ backgroundColor: colorHex }}>
                          <span className="truncate filter drop-shadow">{getTranslatedColorLabel(col, profile)}</span>
                          {isComplete && <span className="text-xs">🏆</span>}
                        </div>

                        <div className="p-3 space-y-2 flex-1 flex flex-col justify-between">
                          <div className="flex items-center justify-between gap-1 text-[11px] font-extrabold text-slate-200">
                            <span>{getTranslatedColorLabel(col, profile)} Seti</span>
                            <span className="text-amber-400 font-black">{wildcardColorPick.value}M</span>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-white/5">
                            <span className={`text-[10px] px-2 py-0.5 rounded-lg font-black ${isComplete
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : count > 0
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-slate-800 text-slate-400'
                              }`}>
                              {isComplete ? (profile.settings.language === 'en' ? 'Complete' : 'Tamamlandı') : count > 0 ? `${count}/${max} Mülk` : `Boş (${max})`}
                            </span>
                          </div>
                        </div>
                      </motion.button>
                    );
                  });
                })()}
              </div>

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  triggerHaptic('light');
                  setWildcardColorPick(null);
                }}
                className="w-full py-3 bg-slate-800 hover:bg-slate-750 text-slate-200 font-extrabold rounded-2xl text-xs transition-all cursor-pointer border border-slate-700/50"
              >
                {t('cancel', profile)}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rent Color selector prompt */}
      <AnimatePresence>
        {isMyTurn && rentColorPick && (
          <motion.div
            id="context-aware-interaction-panel"
            key="rent-color-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setRentColorPick(null)}
            className="fixed inset-0 bg-slate-950/90 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.92, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.92, y: 15, opacity: 0 }}
              transition={{ type: "spring", duration: 0.45 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 border border-slate-750/70 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl relative overflow-hidden"
            >
              {/* Radial gradient background accent */}
              <div className="absolute -top-16 -right-16 w-36 h-36 bg-emerald-500/10 rounded-full filter blur-2xl pointer-events-none" />

              <div className="text-center pb-2 border-b border-white/10">
                <span className="text-xs font-black text-emerald-400 block uppercase tracking-widest mb-1">
                  💰 {profile.settings.language === 'en' ? 'Collect Rent' : 'Kira Topla'}
                </span>
                <h3 className="text-sm font-black text-slate-100">
                  {profile.settings.language === 'en' ? 'Select Property Set' : 'Kira Toplanacak Grubu Seçin'}
                </h3>
                <p className="text-xs text-slate-300 font-medium mt-1">
                  {profile.settings.language === 'en' 
                    ? 'Only completed or owned properties can collect rent:' 
                    : 'Kira toplamak için sahip olduğunuz bir renk grubunu seçin:'}
                </p>
              </div>

              {/* Double Rent Toggle styled as a physical glowing lever */}
              {localPlayer.hand.some((c) => c.actionType === 'double-rent') && match.actionsPlayedThisTurn < 2 && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => {
                    triggerHaptic('medium');
                    playCoinSound();
                    setUseDoubleRent(!useDoubleRent);
                  }}
                  className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer select-none text-left ${useDoubleRent
                    ? 'bg-amber-500/15 border-amber-500/60 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                    : 'bg-slate-950/60 border-slate-800 hover:border-amber-500/40'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base transition-all duration-300 ${useDoubleRent ? 'bg-amber-500 text-slate-950 scale-110 shadow-[0_0_10px_rgba(245,158,11,0.5)] font-black' : 'bg-slate-800 text-slate-400'
                      }`}>
                      ⚡
                    </div>
                    <div className="flex flex-col">
                      <span className={`text-xs font-black tracking-wide uppercase ${useDoubleRent ? 'text-amber-400' : 'text-slate-200'}`}>
                        {profile.settings.language === 'en' ? 'Double Rent' : 'Çift Kat Kira'} {useDoubleRent ? '(AKTİF)' : '(PASİF)'}
                      </span>
                      <span className="text-[10px] text-slate-300 font-medium">
                        {profile.settings.language === 'en' ? 'Multiplies all rent by 2 (+1 action)' : 'Kira gelirini 2 ile çarpar (+1 hamle)'}
                      </span>
                    </div>
                  </div>
                  <div className={`w-10 h-6 rounded-full p-0.5 transition-colors duration-300 flex items-center ${useDoubleRent ? 'bg-amber-500' : 'bg-slate-800'}`}>
                    <div className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-300 ${useDoubleRent ? 'translate-x-4' : 'translate-x-0'}`} />
                  </div>
                </motion.button>
              )}

              <div className="grid grid-cols-2 gap-3 max-h-[260px] overflow-y-auto pr-1 scrollbar-thin">
                {(() => {
                  const possibleColors: CardColor[] = [];
                  if (rentColorPick.color) {
                    possibleColors.push(rentColorPick.color);
                  }
                  if (rentColorPick.secondaryColor && rentColorPick.secondaryColor !== rentColorPick.color) {
                    possibleColors.push(rentColorPick.secondaryColor);
                  }
                  if (possibleColors.length === 0) {
                    possibleColors.push('brown', 'lightblue', 'pink', 'orange', 'red', 'yellow', 'green', 'darkblue', 'railroad', 'utility');
                  }

                  // Sort colors: colors where player owns property come FIRST at the top!
                  possibleColors.sort((a, b) => {
                    const countA = localPlayer.properties[a]?.cards.length || 0;
                    const countB = localPlayer.properties[b]?.cards.length || 0;
                    if (countA > 0 && countB === 0) return -1;
                    if (countA === 0 && countB > 0) return 1;
                    return countB - countA;
                  });

                  return possibleColors.map((col) => {
                    const set = localPlayer.properties[col];
                    const hasProp = (set?.cards.length || 0) > 0;
                    const currentRent = hasProp ? calculateSetRent(set.cards, col, set.hasHouse, set.hasHotel) : 0;
                    const doubledRent = currentRent * 2;
                    const colorHex = COLOR_HEX[col];

                    return (
                      <motion.button
                        key={col}
                        disabled={!hasProp}
                        whileHover={hasProp ? { scale: 1.03, y: -2 } : {}}
                        whileTap={hasProp ? { scale: 0.97 } : {}}
                        onClick={() => {
                          triggerHaptic('light');
                          playPlaySound();
                          const payload = useDoubleRent ? { isDoubleRent: true } : undefined;
                          const isWildRent = rentColorPick.name === 'Her Renk Kira Kartı' || !rentColorPick.color;
                          if (isWildRent) {
                            setRentTargetSelect({ card: rentColorPick, color: col, payload });
                          } else {
                            if (isOffline) handleOfflinePlayCard(rentColorPick.id, 'action', col, payload);
                            else handlePlayCardMultiplayer(rentColorPick.id, 'action', col, payload);
                          }
                          setRentColorPick(null);
                          setUseDoubleRent(false);
                        }}
                        className={`rounded-2xl border flex flex-col items-stretch transition-all text-left relative overflow-hidden ${hasProp
                          ? 'bg-slate-950/60 hover:bg-slate-950 text-white cursor-pointer shadow-lg'
                          : 'bg-slate-950/20 text-slate-600 cursor-not-allowed opacity-30 border-transparent'
                          }`}
                        style={hasProp ? { borderColor: `${colorHex}40` } : {}}
                        onMouseEnter={(e) => {
                          if (hasProp) {
                            e.currentTarget.style.borderColor = colorHex;
                            e.currentTarget.style.boxShadow = `0 4px 18px -2px ${colorHex}30`;
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (hasProp) {
                            e.currentTarget.style.borderColor = `${colorHex}40`;
                            e.currentTarget.style.boxShadow = 'none';
                          }
                        }}
                      >
                        {/* Mini Land Card Header */}
                        <div className="py-2 px-3 font-black text-xs uppercase flex items-center justify-between text-slate-950" style={{ backgroundColor: colorHex }}>
                          <span className="truncate filter drop-shadow">{getTranslatedColorLabel(col, profile)}</span>
                          {hasProp && <span className="text-[10px] bg-slate-950/20 px-1.5 py-0.2 rounded text-white font-black">{set.cards.length} Mülk</span>}
                        </div>

                        <div className="p-3 flex flex-col justify-between space-y-2 flex-1">
                          <span className="text-xs font-bold text-slate-200">
                            {getTranslatedColorLabel(col, profile)} Seti
                          </span>
                          {hasProp ? (
                            <div className="bg-emerald-500/15 border border-emerald-500/20 px-2.5 py-1 rounded-xl flex items-center justify-between">
                              <span className="text-[10px] text-slate-400 font-bold">Kira:</span>
                              <span className="text-xs font-black text-emerald-400">
                                {useDoubleRent ? doubledRent : currentRent}M
                              </span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-medium italic">{profile.settings.language === 'en' ? 'No assets' : 'Mülk Yok'}</span>
                          )}
                        </div>
                      </motion.button>
                    );
                  });
                })()}
              </div>

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  triggerHaptic('light');
                  setRentColorPick(null);
                }}
                className="w-full py-3 bg-slate-800 hover:bg-slate-750 text-slate-200 font-extrabold rounded-2xl text-xs transition-all cursor-pointer border border-slate-700/50"
              >
                {t('cancel', profile)}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rent Target selector prompt (for Her Renk Kira Kartı) */}
      <AnimatePresence>
        {isMyTurn && rentTargetSelect && (
          <motion.div
            id="context-aware-interaction-panel"
            key="rent-target-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setRentTargetSelect(null)}
            className="fixed inset-0 bg-slate-950/90 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.92, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.92, y: 15, opacity: 0 }}
              transition={{ type: "spring", duration: 0.45 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 border border-slate-750/70 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl relative overflow-hidden"
            >
              {/* Radial gradient background accent */}
              <div className="absolute -top-16 -left-16 w-36 h-36 bg-amber-500/10 rounded-full filter blur-2xl pointer-events-none" />

              <div className="text-center pb-2 border-b border-white/10">
                <span className="text-xs font-black text-amber-500 block uppercase tracking-widest mb-1">
                  🎯 {profile.settings.language === 'en' ? 'Target Rent Selection' : 'Kira Hedefi Seç'}
                </span>
                <h3 className="text-sm font-black text-slate-100">
                  {profile.settings.language === 'en' ? 'Select Target Player' : 'Kira Alınacak Rakibi Seçin'}
                </h3>
                <p className="text-xs text-slate-300 font-medium mt-1">
                  {profile.settings.language === 'en' 
                    ? 'Wild rent cards can only collect from 1 chosen opponent:' 
                    : 'Her Renk Kira Kartı sadece seçeceğiniz tek bir rakipten tahsilat yapar:'}
                </p>
              </div>

              <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1 scrollbar-thin">
                {otherPlayers.map((op) => {
                  const bankTotal = op.bank.reduce((sum, c) => sum + c.value, 0);
                  const completedSets = countCompletedSets(op.properties);

                  return (
                    <motion.button
                      key={op.id}
                      whileHover={{ scale: 1.02, x: 2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        triggerHaptic('medium');
                        playPlaySound();
                        const finalPayload = { ...rentTargetSelect.payload, targetPlayerId: op.id };
                        if (isOffline) handleOfflinePlayCard(rentTargetSelect.card.id, 'action', rentTargetSelect.color, finalPayload);
                        else handlePlayCardMultiplayer(rentTargetSelect.card.id, 'action', rentTargetSelect.color, finalPayload);
                        setRentTargetSelect(null);
                      }}
                      className="w-full p-4 rounded-2xl border border-white/10 hover:border-amber-500/60 bg-slate-950/60 hover:bg-slate-950 text-white transition-all text-left flex items-center justify-between shadow-lg cursor-pointer gap-3"
                    >
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-2xl bg-slate-800 border border-white/10 flex items-center justify-center text-lg shadow shrink-0">
                          {op.isBot ? '🤖' : '👤'}
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-sm font-black tracking-tight truncate text-slate-100">{op.username}</span>
                          <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mt-0.5">
                            {op.isBot ? (profile.settings.language === 'en' ? 'AI Bot' : 'Yapay Zeka') : (profile.settings.language === 'en' ? 'Player' : 'Oyuncu')}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {completedSets > 0 && (
                          <div className="text-xs bg-amber-500/20 text-amber-400 font-black px-2.5 py-1 rounded-xl border border-amber-500/20">
                            🏆 {completedSets}
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-xs font-mono text-emerald-400 font-black bg-emerald-500/20 px-3 py-1 rounded-xl border border-emerald-500/20">
                          💵 {bankTotal}M
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  triggerHaptic('light');
                  setRentTargetSelect(null);
                }}
                className="w-full py-3 bg-slate-800 hover:bg-slate-750 text-slate-200 font-extrabold rounded-2xl text-xs transition-all cursor-pointer border border-slate-700/50"
              >
                {t('cancel', profile)}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* House/Hotel Color selector prompt */}
      {isMyTurn && houseHotelColorPick && (
        <div id="context-aware-interaction-panel" className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-900 border border-slate-750/70 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl relative">
            <div className="text-center border-b border-white/10 pb-3">
              <span className="text-xs font-black text-emerald-400 block uppercase tracking-widest mb-1">🏠 MÜLK GELİŞTİR</span>
              <h3 className="text-sm font-black text-slate-100">
                {houseHotelColorPick.actionType === 'house' ? 'Evi Hangi Sete Yerleştirmek İstersiniz?' : 'Oteli Hangi Sete Yerleştirmek İstersiniz?'}
              </h3>
            </div>

            <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1 scrollbar-thin">
              {(() => {
                const eligibleColors: CardColor[] = [];
                Object.keys(localPlayer.properties).forEach((colorKey) => {
                  const col = colorKey as CardColor;
                  if (col === 'railroad' || col === 'utility') return;
                  const set = localPlayer.properties[col];
                  if (!set) return;

                  if (houseHotelColorPick.actionType === 'house') {
                    if (set.cards.length >= MAX_IN_SET[col] && !set.hasHouse) {
                      eligibleColors.push(col);
                    }
                  } else {
                    if (set.cards.length >= MAX_IN_SET[col] && set.hasHouse && !set.hasHotel) {
                      eligibleColors.push(col);
                    }
                  }
                });

                return eligibleColors.map((col) => {
                  const colorHex = COLOR_HEX[col];
                  return (
                    <button
                      key={col}
                      onClick={() => {
                        if (isOffline) handleOfflinePlayCard(houseHotelColorPick.id, 'property', col);
                        else handlePlayCardMultiplayer(houseHotelColorPick.id, 'property', col);
                        setHouseHotelColorPick(null);
                      }}
                      className="w-full rounded-2xl border bg-slate-950/60 hover:bg-slate-950 text-white font-bold flex flex-col transition-all overflow-hidden cursor-pointer"
                      style={{ borderColor: `${colorHex}40` }}
                    >
                      <div className="py-2 px-3 font-black text-xs uppercase text-slate-950 flex items-center justify-between" style={{ backgroundColor: colorHex }}>
                        <span>{getTranslatedColorLabel(col, profile)} Seti</span>
                        <span className="text-[10px] bg-slate-950/30 px-2 py-0.5 rounded text-white font-black">Set Tamamlandı</span>
                      </div>
                      <div className="p-3 flex items-center justify-between">
                        <span className="text-xs font-black text-slate-200">
                          {houseHotelColorPick.actionType === 'house' ? '🏠 Ev Ekle' : '🏨 Otel Ekle'}
                        </span>
                        <span className="text-xs font-black text-emerald-400 bg-emerald-500/15 px-3 py-1 rounded-xl border border-emerald-500/20">Yerleştir</span>
                      </div>
                    </button>
                  );
                });
              })()}
            </div>

            <button
              onClick={() => setHouseHotelColorPick(null)}
              className="w-full py-3 bg-slate-800 hover:bg-slate-750 text-slate-200 font-extrabold rounded-2xl text-xs transition-all cursor-pointer border border-slate-700/50"
            >
              İptal Et
            </button>
          </div>
        </div>
      )}

      {/* Step-by-Step Action Target Selection Modal */}
      <AnimatePresence>
        {isMyTurn && activeActionCard && (
          <motion.div
            id="context-aware-interaction-panel"
            key="action-target-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActiveActionCard(null)}
            className="fixed inset-0 bg-slate-950/90 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.92, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.92, y: 15, opacity: 0 }}
              transition={{ type: "spring", duration: 0.45 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 border border-slate-750/70 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl relative overflow-hidden"
            >
              {/* Top ambient glow bar based on card color */}
              <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500" />
              <div className="absolute -top-16 -left-16 w-36 h-36 bg-amber-500/10 rounded-full filter blur-2xl pointer-events-none" />

              <div className="text-center pb-2 border-b border-white/10 relative">
                <span className="text-xs font-black text-amber-400 tracking-widest uppercase block mb-1">
                  ⚡ {getTranslatedCardName(activeActionCard, profile)}
                </span>
                <h3 className="text-sm font-black text-slate-100">
                  {!selectedOpponentId 
                    ? (profile.settings.language === 'en' ? 'Choose Target Opponent' : 'Hedef Oyuncu Seçin') 
                    : (profile.settings.language === 'en' ? 'Select Target Asset' : 'Hedeflenecek Varlığı Seçin')}
                </h3>
              </div>

              {match?.settings?.turnLimit !== 'unlimited' && (
                <div className="text-center bg-amber-500/10 border border-amber-500/20 py-2 px-3 rounded-xl text-xs text-amber-400 font-black flex items-center justify-center gap-1.5">
                  ⏱️ {profile.settings.language === 'en' ? 'Decision Time Left:' : 'Kalan Seçim Süresi:'} <span className="text-sm font-black text-amber-300">{timeLeft}s</span>
                </div>
              )}

              {/* STEP 1: Select Opponent */}
              {!selectedOpponentId && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-300 font-extrabold uppercase tracking-wider text-center">
                    {profile.settings.language === 'en' ? 'Choose opponent to target:' : 'Hedeflenecek rakibi seçin:'}
                  </p>
                  <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1 scrollbar-thin">
                    {(() => {
                      // Find max completed sets among all other players to flag the top threat
                      const opStats = otherPlayers.map((op) => {
                        const completedCount = Object.keys(op.properties).filter((col) => {
                          const set = op.properties[col as CardColor];
                          return set && set.cards.length >= MAX_IN_SET[col as CardColor];
                        }).length;
                        const wildcardCount = Object.values(op.properties).flatMap(s => (s as any)?.cards || []).filter(c => isWildcardOrDualColorCard(c)).length;
                        return { id: op.id, completedCount, wildcardCount };
                      });
                      const maxCompleted = Math.max(...opStats.map(o => o.completedCount), 0);

                      // Sort players so top threats and players holding Jokers / Dual-color cards appear first
                      const sortedPlayers = [...otherPlayers].sort((a, b) => {
                        const aStat = opStats.find(o => o.id === a.id);
                        const bStat = opStats.find(o => o.id === b.id);
                        if ((bStat?.completedCount || 0) !== (aStat?.completedCount || 0)) {
                          return (bStat?.completedCount || 0) - (aStat?.completedCount || 0);
                        }
                        return (bStat?.wildcardCount || 0) - (aStat?.wildcardCount || 0);
                      });

                      return sortedPlayers.map((op) => {
                        const bankTotal = op.bank.reduce((sum, c) => sum + c.value, 0);
                        const completedCount = opStats.find(o => o.id === op.id)?.completedCount || 0;
                        const wildcardCount = opStats.find(o => o.id === op.id)?.wildcardCount || 0;
                        const isThreat = completedCount > 0 && completedCount === maxCompleted;

                        return (
                          <motion.button
                            key={op.id}
                            whileHover={{ scale: 1.02, x: 2 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                              triggerHaptic('medium');
                              setSelectedOpponentId(op.id);
                            }}
                            className={`w-full p-4 rounded-2xl border transition-all text-left flex justify-between items-center relative overflow-hidden group shadow-lg cursor-pointer ${isThreat
                              ? 'border-red-500/50 bg-gradient-to-r from-red-950/30 to-slate-950/50 hover:from-red-950/50 hover:border-red-500/80'
                              : 'border-slate-800 bg-slate-950/40 hover:bg-slate-950/80 hover:border-slate-700'
                              }`}
                          >
                            {isThreat && (
                              <span className="absolute top-0 right-0 bg-red-600 text-[8px] text-white font-black px-2 py-0.5 rounded-bl-lg tracking-wider uppercase">
                                ⚠️ {profile.settings.language === 'en' ? 'Top Threat' : 'Lider Rakip'}
                              </span>
                            )}

                            <div className="flex items-center gap-3.5 min-w-0 flex-1 pr-2">
                              <span className="text-2xl shrink-0 p-2 rounded-xl bg-slate-900 border border-white/10">{op.isBot ? '🤖' : '👤'}</span>
                              <div className="flex flex-col space-y-1 min-w-0 flex-1">
                                <span className="font-black text-sm text-slate-100 group-hover:text-white transition-colors truncate">{op.username}</span>

                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-300 font-extrabold">
                                  <span className="text-emerald-400">💰 {bankTotal}M</span>
                                  <span>🎴 {op.handCount || op.hand?.length || 0} Kart</span>
                                  <span className={completedCount > 0 ? 'text-amber-400' : 'text-slate-400'}>🏆 {completedCount} Set</span>
                                  {wildcardCount > 0 && (
                                    <span className="text-purple-300 bg-purple-500/20 px-1.5 py-0.5 rounded text-[10px]">🌈 {wildcardCount} Joker</span>
                                  )}
                                </div>

                                {/* Property colors list - Joker and Dual color sets listed first */}
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {Object.keys(op.properties)
                                    .map((colorKey) => {
                                      const col = colorKey as CardColor;
                                      const set = op.properties[col];
                                      const count = set?.cards.length || 0;
                                      const hasWildcard = set?.cards.some(c => isWildcardOrDualColorCard(c)) || false;
                                      return { col, count, hasWildcard };
                                    })
                                    .filter(item => item.count > 0)
                                    .sort((a, b) => (b.hasWildcard ? 1 : 0) - (a.hasWildcard ? 1 : 0))
                                    .map(({ col, count, hasWildcard }) => (
                                      <span key={col} className="inline-flex items-center gap-1 text-[9px] font-black text-slate-200 bg-slate-900 border border-white/10 px-1.5 py-0.5 rounded">
                                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLOR_HEX[col] }} />
                                        {count}
                                        {hasWildcard && <span className="text-[8px]">🃏</span>}
                                      </span>
                                    ))}
                                </div>
                              </div>
                            </div>

                            <div className="shrink-0 pl-1">
                              <span className={`text-xs font-black px-3 py-1.5 rounded-xl border transition-colors ${isThreat
                                ? 'text-red-400 bg-red-500/20 border-red-500/30 group-hover:bg-red-500/30'
                                : 'text-amber-400 bg-amber-500/20 border-amber-500/30 group-hover:bg-amber-500/30'
                                }`}>
                                {profile.settings.language === 'en' ? 'Target' : 'Seç'}
                              </span>
                            </div>
                          </motion.button>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}

              {/* STEP 2: Selected Opponent details and action targets */}
              {selectedOpponentId && (() => {
                const op = otherPlayers.find((p) => p.id === selectedOpponentId);
                if (!op) return null;

                const myBankTotal = localPlayer.bank.reduce((s, c) => s + c.value, 0);
                const opBankTotal = op.bank.reduce((s, c) => s + c.value, 0);

                return (
                  <div className="space-y-4">
                    {/* Comparative Stats Board */}
                    <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 grid grid-cols-2 gap-3 text-xs select-none shadow-inner relative">
                      {/* Sizin Varlıklarınız */}
                      <div className="space-y-1.5 border-r border-slate-800 pr-2">
                        <span className="text-[9px] text-slate-400 uppercase font-black block">{profile.settings.language === 'en' ? 'Your Assets' : 'Kendi Varlıklarınız'}</span>
                        <span className="text-emerald-400 font-black block">💰 {myBankTotal}M Kasa</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {Object.keys(localPlayer.properties).map((col) => {
                            const count = localPlayer.properties[col as CardColor]!.cards.length;
                            if (count === 0) return null;
                            return (
                              <span key={col} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900 border border-white/10 text-[8px] font-black">
                                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: COLOR_HEX[col as CardColor] }} />
                                {count}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      {/* Rakip Varlıkları */}
                      <div className="space-y-1.5 pl-1 min-w-0">
                        <span className="text-[9px] text-slate-400 uppercase font-black block truncate">{op.username}</span>
                        <span className="text-emerald-400 font-black block">💰 {opBankTotal}M Kasa</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {Object.keys(op.properties).map((col) => {
                            const count = op.properties[col as CardColor]!.cards.length;
                            if (count === 0) return null;
                            return (
                              <span key={col} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900 border border-white/10 text-[8px] font-black">
                                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: COLOR_HEX[col as CardColor] }} />
                                {count}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Sub action selectors based on action card type */}
                    {(() => {
                      // Sly Deal (Sinsi Anlaşma)
                      if (activeActionCard.actionType === 'sly-deal') {
                        return (
                          <div className="space-y-2.5">
                            <p className="text-xs text-slate-300 font-extrabold uppercase tracking-wider text-center">
                              {profile.settings.language === 'en' ? 'Select Property to Steal:' : 'Çalınacak Mülkü Seçin:'}
                            </p>
                            <div className="space-y-2 max-h-52 overflow-y-auto pr-1 scrollbar-thin">
                              {(() => {
                                const allStealableCards = Object.keys(op.properties).flatMap((colorKey) => {
                                  const col = colorKey as CardColor;
                                  const set = op.properties[col];
                                  if (!set || set.cards.length === 0 || set.cards.length >= MAX_IN_SET[col]) return [];
                                  return set.cards.map((c) => ({ c, col }));
                                });

                                // Sort so Joker and Dual-color cards appear FIRST at the top
                                allStealableCards.sort((a, b) => {
                                  const aWild = isWildcardOrDualColorCard(a.c) ? 1 : 0;
                                  const bWild = isWildcardOrDualColorCard(b.c) ? 1 : 0;
                                  return bWild - aWild;
                                });

                                if (allStealableCards.length === 0) {
                                  return (
                                    <p className="text-xs text-slate-400 italic text-center py-4">{profile.settings.language === 'en' ? 'No half-set property available to steal.' : 'Çalınabilecek yarım set mülk bulunmuyor.'}</p>
                                  );
                                }

                                return allStealableCards.map(({ c, col }) => {
                                  const mySet = localPlayer.properties[col];
                                  const myCount = mySet?.cards?.length || 0;
                                  const colorHex = COLOR_HEX[col];
                                  const headerStyle = getCardHeaderStyle(c, col);

                                  return (
                                    <motion.button
                                      key={c.id}
                                      whileHover={{ scale: 1.02 }}
                                      whileTap={{ scale: 0.98 }}
                                      onClick={() => {
                                        triggerHaptic('medium');
                                        const payload = { targetPlayerId: op.id, targetCardId: c.id };
                                        if (isOffline) handleOfflinePlayCard(activeActionCard.id, 'action', undefined, payload);
                                        else handlePlayCardMultiplayer(activeActionCard.id, 'action', undefined, payload);
                                        setActiveActionCard(null);
                                      }}
                                      className="w-full rounded-2xl border bg-slate-950/60 hover:bg-slate-950 text-white transition-all text-left flex flex-col overflow-hidden cursor-pointer shadow-md"
                                      style={{ borderColor: `${colorHex}40` }}
                                    >
                                      {/* Mini Property Card Header */}
                                      <div className="py-1.5 px-3 font-black text-xs uppercase text-slate-950 flex items-center justify-between" style={headerStyle}>
                                        <span className="flex items-center gap-1.5 filter drop-shadow">
                                          {(c.isWildcard || c.type === 'wildcard') && (
                                            <span className="text-xs">{isCardMultiColorWildcard(c) ? '🌈' : '🌓'}</span>
                                          )}
                                          {getTranslatedColorLabel(col, profile)}
                                        </span>
                                        <span className="text-[10px] text-slate-950 font-black">{c.value}M</span>
                                      </div>
                                      <div className="p-3 flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                          {renderCardColorIndicator(c, col)}
                                          <span className="text-xs font-black text-slate-100 truncate">
                                            {getTranslatedCardName(c, profile)}
                                          </span>
                                          {(c.isWildcard || c.type === 'wildcard') && (
                                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                                              {isCardMultiColorWildcard(c) ? 'Joker 🌈' : 'Çift Renk 🌓'}
                                            </span>
                                          )}
                                        </div>
                                        {myCount > 0 && (
                                          <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                                            Sete Uyar!
                                          </span>
                                        )}
                                      </div>
                                    </motion.button>
                                  );
                                });
                              })()}
                            </div>
                          </div>
                        );
                      }

                      // Deal Breaker (Anlaşma Bozan)
                      if (activeActionCard.actionType === 'deal-breaker') {
                        return (
                          <div className="space-y-2.5">
                            <p className="text-xs text-slate-300 font-extrabold uppercase tracking-wider text-center">
                              {profile.settings.language === 'en' ? 'Select Complete Set to Steal:' : 'Çalınacak Tamamlanmış Seti Seçin:'}
                            </p>
                            <div className="space-y-2 max-h-52 overflow-y-auto pr-1 scrollbar-thin">
                              {(() => {
                                const completedSets = Object.keys(op.properties)
                                  .map((colorKey) => {
                                    const col = colorKey as CardColor;
                                    const set = op.properties[col];
                                    return { col, set };
                                  })
                                  .filter(({ col, set }) => set && set.cards.length >= MAX_IN_SET[col]);

                                // Sort so sets containing Jokers / Dual-color cards appear FIRST at the top
                                completedSets.sort((a, b) => {
                                  const aHasWild = a.set!.cards.some(c => isWildcardOrDualColorCard(c)) ? 1 : 0;
                                  const bHasWild = b.set!.cards.some(c => isWildcardOrDualColorCard(c)) ? 1 : 0;
                                  return bHasWild - aHasWild;
                                });

                                if (completedSets.length === 0) {
                                  return (
                                    <p className="text-xs text-slate-400 italic text-center py-4">{profile.settings.language === 'en' ? 'No completed sets available to steal.' : 'Rakibin tamamlanmış seti bulunmuyor.'}</p>
                                  );
                                }

                                return completedSets.map(({ col, set }) => {
                                  if (!set) return null;
                                  const colorHex = COLOR_HEX[col];

                                  return (
                                    <motion.button
                                      key={col}
                                      whileHover={{ scale: 1.02 }}
                                      whileTap={{ scale: 0.98 }}
                                      onClick={() => {
                                        triggerHaptic('medium');
                                        const payload = { targetPlayerId: op.id, targetColor: col };
                                        if (isOffline) handleOfflinePlayCard(activeActionCard.id, 'action', undefined, payload);
                                        else handlePlayCardMultiplayer(activeActionCard.id, 'action', undefined, payload);
                                        setActiveActionCard(null);
                                      }}
                                      className="w-full rounded-2xl border bg-slate-950/60 hover:bg-slate-950 text-white transition-all text-left flex flex-col overflow-hidden cursor-pointer shadow-lg"
                                      style={{ borderColor: `${colorHex}50` }}
                                    >
                                      <div className="py-2 px-3 font-black text-xs uppercase text-slate-950 flex items-center justify-between" style={{ backgroundColor: colorHex }}>
                                        <span>{getTranslatedColorLabel(col, profile)} Seti</span>
                                        <span className="text-[10px] bg-slate-950/30 px-2 py-0.5 rounded text-white font-black">🏆 Tam Set ({set.cards.length})</span>
                                      </div>
                                      <div className="p-3 flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5 flex-wrap min-w-0 flex-1">
                                          {set.cards.map((c) => (
                                            <span key={c.id} className="text-[10px] font-bold text-slate-200 bg-slate-900/80 px-1.5 py-0.5 rounded border border-white/10 flex items-center gap-1">
                                              {renderCardColorIndicator(c, col)}
                                              <span className="truncate max-w-[70px]">{getTranslatedCardName(c, profile)}</span>
                                              {(c.isWildcard || c.type === 'wildcard') && (
                                                <span className="text-[8px] shrink-0">{isCardMultiColorWildcard(c) ? '🌈' : '🌓'}</span>
                                              )}
                                            </span>
                                          ))}
                                          {set.hasHouse && <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 shrink-0">🏠 EV</span>}
                                          {set.hasHotel && <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 shrink-0">🏨 OTEL</span>}
                                        </div>
                                        <span className="text-xs font-black text-amber-400 bg-amber-500/20 px-3 py-1 rounded-xl border border-amber-500/30 shrink-0">
                                          Seti Çal!
                                        </span>
                                      </div>
                                    </motion.button>
                                  );
                                });
                              })()}
                            </div>
                          </div>
                        );
                      }

                      // Forced Deal (Zorunlu Değiş Tokuş)
                      if (activeActionCard.actionType === 'forced-deal') {
                        if (!selectedStolenCardId) {
                          return (
                            <div className="space-y-2.5">
                              <p className="text-xs text-slate-300 font-extrabold uppercase tracking-wider text-center">
                                ➕ {profile.settings.language === 'en' ? 'Step 1: Choose Property to Steal:' : 'Adım 1: Rakipten Alınacak Mülk:'}
                              </p>
                              <div className="space-y-2 max-h-52 overflow-y-auto pr-1 scrollbar-thin">
                                {(() => {
                                  const stealableCards = Object.keys(op.properties).flatMap((colorKey) => {
                                    const col = colorKey as CardColor;
                                    const set = op.properties[col];
                                    if (!set || set.cards.length === 0 || set.cards.length >= MAX_IN_SET[col]) return [];
                                    return set.cards.map((c) => ({ c, col }));
                                  });

                                  // Sort so Joker and Dual-color cards appear FIRST at the top
                                  stealableCards.sort((a, b) => {
                                    const aWild = isWildcardOrDualColorCard(a.c) ? 1 : 0;
                                    const bWild = isWildcardOrDualColorCard(b.c) ? 1 : 0;
                                    return bWild - aWild;
                                  });

                                  if (stealableCards.length === 0) {
                                    return (
                                      <p className="text-xs text-slate-400 italic text-center py-4">{profile.settings.language === 'en' ? 'No half-set property available to steal.' : 'Çalınabilecek yarım set mülk bulunmuyor.'}</p>
                                    );
                                  }

                                  return stealableCards.map(({ c, col }) => {
                                    const colorHex = COLOR_HEX[col];
                                    const headerStyle = getCardHeaderStyle(c, col);
                                    return (
                                      <motion.button
                                        key={c.id}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => {
                                          triggerHaptic('light');
                                          setSelectedStolenCardId(c.id);
                                        }}
                                        className="w-full rounded-2xl border bg-slate-950/60 hover:bg-slate-950 text-white transition-all text-left flex flex-col overflow-hidden cursor-pointer shadow-md"
                                        style={{ borderColor: `${colorHex}40` }}
                                      >
                                        <div className="py-1.5 px-3 font-black text-xs uppercase text-slate-950 flex items-center justify-between" style={headerStyle}>
                                          <span className="flex items-center gap-1.5 filter drop-shadow">
                                            {(c.isWildcard || c.type === 'wildcard') && (
                                              <span className="text-xs">{isCardMultiColorWildcard(c) ? '🌈' : '🌓'}</span>
                                            )}
                                            {getTranslatedColorLabel(col, profile)}
                                          </span>
                                          <span className="text-[10px] text-slate-950 font-black">{c.value}M</span>
                                        </div>
                                        <div className="p-3 flex items-center justify-between gap-2">
                                          <div className="flex items-center gap-2 min-w-0 flex-1">
                                            {renderCardColorIndicator(c, col)}
                                            <span className="text-xs font-black text-slate-100 truncate">
                                              {getTranslatedCardName(c, profile)}
                                            </span>
                                            {(c.isWildcard || c.type === 'wildcard') && (
                                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                                                {isCardMultiColorWildcard(c) ? 'Joker 🌈' : 'Çift Renk 🌓'}
                                              </span>
                                            )}
                                          </div>
                                          <span className="text-xs font-black text-amber-400 bg-amber-500/20 px-2.5 py-1 rounded-xl border border-amber-500/30 shrink-0">
                                            Seç
                                          </span>
                                        </div>
                                      </motion.button>
                                    );
                                  });
                                })()}
                              </div>
                            </div>
                          );
                        } else {
                          return (
                            <div className="space-y-2.5">
                              <p className="text-xs text-slate-300 font-extrabold uppercase tracking-wider text-center">
                                🔄 {profile.settings.language === 'en' ? 'Step 2: Choose Your Property to Give:' : 'Adım 2: Karşılığında Vereceğiniz Mülk:'}
                              </p>
                              <div className="space-y-2 max-h-52 overflow-y-auto pr-1 scrollbar-thin">
                                {(() => {
                                  const myCardsToGive = Object.keys(localPlayer.properties).flatMap((colorKey) => {
                                    const col = colorKey as CardColor;
                                    const set = localPlayer.properties[col];
                                    if (!set || set.cards.length === 0 || set.cards.length >= MAX_IN_SET[col]) return [];
                                    return set.cards.map((c) => ({ c, col }));
                                  });

                                  // Sort so Joker and Dual-color cards appear FIRST at the top
                                  myCardsToGive.sort((a, b) => {
                                    const aWild = isWildcardOrDualColorCard(a.c) ? 1 : 0;
                                    const bWild = isWildcardOrDualColorCard(b.c) ? 1 : 0;
                                    return bWild - aWild;
                                  });

                                  if (myCardsToGive.length === 0) {
                                    return (
                                      <p className="text-xs text-slate-400 italic text-center py-4">{profile.settings.language === 'en' ? 'No property available to give.' : 'Karşılığında verebileceğiniz mülk bulunmuyor.'}</p>
                                    );
                                  }

                                  return myCardsToGive.map(({ c, col }) => {
                                    const colorHex = COLOR_HEX[col];
                                    const headerStyle = getCardHeaderStyle(c, col);
                                    return (
                                      <motion.button
                                        key={c.id}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => {
                                          triggerHaptic('medium');
                                          playPlaySound();
                                          const payload = { targetPlayerId: op.id, targetCardId: selectedStolenCardId, myCardId: c.id };
                                          if (isOffline) handleOfflinePlayCard(activeActionCard.id, 'action', undefined, payload);
                                          else handlePlayCardMultiplayer(activeActionCard.id, 'action', undefined, payload);
                                          setActiveActionCard(null);
                                        }}
                                        className="w-full rounded-2xl border bg-slate-950/60 hover:bg-slate-950 text-white transition-all text-left flex flex-col overflow-hidden cursor-pointer shadow-md"
                                        style={{ borderColor: `${colorHex}40` }}
                                      >
                                        <div className="py-1.5 px-3 font-black text-xs uppercase text-slate-950 flex items-center justify-between" style={headerStyle}>
                                          <span className="flex items-center gap-1.5 filter drop-shadow">
                                            {(c.isWildcard || c.type === 'wildcard') && (
                                              <span className="text-xs">{isCardMultiColorWildcard(c) ? '🌈' : '🌓'}</span>
                                            )}
                                            {getTranslatedColorLabel(col, profile)}
                                          </span>
                                          <span className="text-[10px] text-slate-950 font-black">{c.value}M</span>
                                        </div>
                                        <div className="p-3 flex items-center justify-between gap-2">
                                          <div className="flex items-center gap-2 min-w-0 flex-1">
                                            {renderCardColorIndicator(c, col)}
                                            <span className="text-xs font-black text-slate-100 truncate">
                                              {getTranslatedCardName(c, profile)}
                                            </span>
                                            {(c.isWildcard || c.type === 'wildcard') && (
                                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                                                {isCardMultiColorWildcard(c) ? 'Joker 🌈' : 'Çift Renk 🌓'}
                                              </span>
                                            )}
                                          </div>
                                          <span className="text-xs font-black text-emerald-400 bg-emerald-500/20 px-2.5 py-1 rounded-xl border border-emerald-500/30 shrink-0">
                                            Takas Et
                                          </span>
                                        </div>
                                      </motion.button>
                                    );
                                  });
                                })()}
                              </div>
                            </div>
                          );
                        }
                      }

                      // Debt Collector (Borç Tahsilatı)
                      if (activeActionCard.actionType === 'debt-collector') {
                        return (
                          <div className="space-y-4 text-center">
                            <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl select-none text-center">
                              <span className="text-xs text-amber-500 font-black tracking-widest uppercase block mb-1">TAHSİLAT TALEBİ</span>
                              <p className="text-sm text-slate-200 leading-relaxed font-extrabold">
                                <strong>{op.username}</strong> {profile.settings.language === 'en' ? 'will be billed 5M debt.' : 'oyuncusundan 5M borç tahsil edilecek.'}
                              </p>
                            </div>
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => {
                                triggerHaptic('heavy');
                                playCoinSound();
                                const payload = { targetPlayerId: op.id };
                                if (isOffline) handleOfflinePlayCard(activeActionCard.id, 'action', undefined, payload);
                                else handlePlayCardMultiplayer(activeActionCard.id, 'action', undefined, payload);
                                setActiveActionCard(null);
                              }}
                              className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-115 text-slate-950 font-black rounded-2xl text-xs transition-all shadow-lg cursor-pointer"
                            >
                              🚀 {profile.settings.language === 'en' ? 'Confirm & Collect' : 'Onayla ve Tahsil Et'}
                            </motion.button>
                          </div>
                        );
                      }

                      return null;
                    })()}
                  </div>
                );
              })()}

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  triggerHaptic('light');
                  setActiveActionCard(null);
                }}
                className="w-full py-3 bg-slate-800 hover:bg-slate-750 text-slate-200 font-extrabold rounded-2xl text-xs transition-all cursor-pointer border border-slate-700/50"
              >
                {t('cancel', profile)}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Multiplayer Payment Select interface overlay */}
      <AnimatePresence>
        {myActiveRequest && (
          <motion.div
            key="payment-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/90 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.92, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.92, y: 15, opacity: 0 }}
              transition={{ type: "spring", duration: 0.45 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 border border-slate-750/70 rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl relative overflow-hidden"
            >
              {myActiveRequest.type === 'just-say-no' || (myActiveRequest.jsnCount || 0) > 0 ? (
                // JSN SAVUNMA EKRANI (Just Say No Defense Chain)
                <div className="space-y-4 text-center">
                  <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-red-500 via-rose-500 to-red-500" />
                  <div className="absolute -top-16 -left-16 w-36 h-36 bg-rose-500/10 rounded-full filter blur-2xl pointer-events-none" />

                  {(() => {
                    const req = myActiveRequest;
                    const jsnCount = req.jsnCount || 0;
                    const isInitiatorView = (jsnCount % 2 === 1);
                    
                    const initiatorId = jsnCount % 2 === 0 ? req.sourcePlayerId : req.targetPlayerId;
                    const defenderId = jsnCount % 2 === 0 ? req.targetPlayerId : req.sourcePlayerId;
                    
                    const initiatorPlayer = match.players.find((p: any) => p.id === initiatorId);
                    const defenderPlayer = match.players.find((p: any) => p.id === defenderId);
                    const sPlayer = match.players.find((p: any) => p.id === req.sourcePlayerId);
                    
                    const actName = req.actionCard ? getTranslatedCardName(req.actionCard, profile) : "Aksiyon";
                    const isEn = profile.settings.language === 'en';

                    let displayTitle = '';
                    let displaySubtitle = '';
                    let displayDescription = null;
                    let acceptButtonText = '';

                    if (jsnCount === 0) {
                      // Initial defense phase: Defender's view
                      displayTitle = isEn ? 'ACTION INCOMING!' : 'SANA KARŞI HAMLE YAPILDI!';
                      displaySubtitle = isEn ? 'Choose your defense strategy' : 'Savunma stratejinizi seçin';
                      displayDescription = (
                        <span>
                          <strong>{initiatorPlayer?.username || 'Rakip'}</strong> size karşı <strong>{actName}</strong> oynadı. Hamleyi engellemek için elinizdeki 'Hayır Deme Hakkı' (Reddet) kartını kullanabilirsiniz!
                        </span>
                      );
                      acceptButtonText = isEn ? 'Accept and Resolve' : 'Hamleyi Kabul Et (Öde / Mülkü Ver)';
                    } else if (isInitiatorView) {
                      // Initiator's view: Opponent played JSN
                      displayTitle = isEn ? 'ACTION BLOCKED!' : 'HAMLENİZ ENGELLENDİ!';
                      displaySubtitle = isEn ? 'Counter with Just Say No' : 'Reddet\'e karşı Reddet oyna';
                      displayDescription = (
                        <div className="space-y-1.5 text-left">
                          <p className="text-center">
                            <strong>{sPlayer?.username || 'Rakip'}</strong> senin <strong>{actName}</strong> hamleni <strong>'Hayır Deme Hakkı' (Reddet)</strong> kartı ile engelledi!
                          </p>
                          <span className="block text-[10px] text-amber-400 font-bold bg-amber-500/10 py-1.5 px-3 rounded-lg mt-1 border border-amber-500/15 leading-normal">
                            💡 {isEn ? "If you accept, your action card will be canceled and discarded. You won't pay or lose anything!" : "Engellemeyi kabul ederseniz hamleniz iptal edilip kartınız ıskartaya gider. Sizden hiçbir para veya mülk eksilmez!"}
                          </span>
                        </div>
                      );
                      acceptButtonText = isEn ? 'Accept Block (Cancel My Action)' : 'Engellemeyi Kabul Et (Hamlemi İptal Et)';
                    } else {
                      // Defender's view: Initiator played counter-JSN
                      displayTitle = isEn ? 'DEFENSE COUNTERED!' : 'SAVUNMANIZ İPTAL EDİLDİ!';
                      displaySubtitle = isEn ? 'They countered your Just Say No!' : 'Rakip Reddet\'e karşı Reddet kullandı!';
                      displayDescription = (
                        <span>
                          <strong>{sPlayer?.username || 'Rakip'}</strong> senin 'Hayır' savunmanı iptal etti! Onların hamlesini hâlâ engellemek istiyorsan, elinden yeni bir 'Hayır Deme Hakkı' (Reddet) daha kullanmalısın!
                        </span>
                      );
                      acceptButtonText = isEn ? 'Give Up and Resolve' : 'Kabullen ve Çözülmesine İzin Ver';
                    }

                    return (
                      <>
                        <div className="border-b border-white/5 pb-3">
                          <div className={`w-14 h-14 rounded-full ${isInitiatorView ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' : 'bg-rose-500/10 border-rose-500/30 text-rose-500'} border flex items-center justify-center mx-auto text-2xl animate-pulse shadow-lg mb-2`}>
                            {isInitiatorView ? '⚡' : '🛡️'}
                          </div>
                          <span className={`text-[10px] font-black ${isInitiatorView ? 'text-amber-400' : 'text-rose-500'} uppercase tracking-widest block`}>
                            {isEn ? `DEFENSE CHAIN - STEP ${jsnCount + 1}` : `SAVUNMA ZİNCİRİ - ADIM ${jsnCount + 1}`}
                          </span>
                          <h3 className="text-sm font-black text-slate-100 mt-1 uppercase tracking-wide">
                            {displayTitle}
                          </h3>
                          <p className="text-[9px] font-bold text-slate-400 mt-0.5">
                            {displaySubtitle}
                          </p>
                          <div className="text-[10px] text-slate-300 mt-2 leading-relaxed bg-slate-950/40 p-2.5 rounded-xl border border-white/5">
                            {displayDescription}
                          </div>
                        </div>

                        {/* Detailed Action Target Visualizer for Defense Chain */}
                        {(() => {
                          const actionType = req.originalAction?.type || req.actionCard?.actionType || req.actionCard?.type;

                          // 1. Forced Deal (Zoraki Takas)
                          if (actionType === 'forced-deal') {
                            let targetCard: Card | null = null;
                            let givenCard: Card | null = null;
                            let targetColor: CardColor = 'brown';
                            let givenColor: CardColor = 'brown';

                            if (defenderPlayer) {
                              for (const col in defenderPlayer.properties) {
                                const c = defenderPlayer.properties[col as CardColor]?.cards.find(c => c.id === req.targetCardId);
                                if (c) { targetCard = c; targetColor = col as CardColor; break; }
                              }
                            }
                            if (initiatorPlayer) {
                              for (const col in initiatorPlayer.properties) {
                                const c = initiatorPlayer.properties[col as CardColor]?.cards.find(c => c.id === req.myCardId);
                                if (c) { givenCard = c; givenColor = col as CardColor; break; }
                              }
                            }

                            const leftCard = isInitiatorView ? givenCard : targetCard;
                            const leftColor = isInitiatorView ? givenColor : targetColor;
                            const leftHeader = isInitiatorView ? (isEn ? 'Your Sent Card' : 'Sizden Gidecek') : (isEn ? 'To Be Taken From You' : 'Sizden Gidecek');

                            const rightCard = isInitiatorView ? targetCard : givenCard;
                            const rightColor = isInitiatorView ? targetColor : givenColor;
                            const rightHeader = isInitiatorView ? (isEn ? 'To Be Received' : 'Karşılığında Gelecek') : (isEn ? 'To Be Given to You' : 'Bize Gelecek');

                            return (
                              <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-3 w-full text-center space-y-2 select-none">
                                <span className="text-[9px] text-amber-400 font-black uppercase tracking-wider block">🔄 TAKAS EDİLECEK KARTLAR</span>
                                <div className="flex items-center justify-between gap-2 px-1 text-[10px] text-slate-300 font-bold">
                                  {/* Verilen Kart */}
                                  <div className="flex-1 p-2 bg-slate-950/60 border border-slate-800 rounded-xl flex flex-col items-center min-w-0">
                                    <span className="text-[7.5px] text-rose-400 uppercase font-black mb-1">{leftHeader}</span>
                                    <span className="truncate w-full text-center block text-[10px] font-black">{leftCard ? getTranslatedCardName(leftCard, profile) : 'Mülk'}</span>
                                    <div className="mt-1.5 flex items-center justify-center">
                                      {leftCard ? renderCardColorIndicator(leftCard, leftColor) : <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: COLOR_HEX[leftColor] }} />}
                                    </div>
                                  </div>

                                  <span className="text-xs text-amber-500 font-black shrink-0 animate-pulse">➔</span>

                                  {/* Alınan Kart */}
                                  <div className="flex-1 p-2 bg-slate-950/60 border border-slate-800 rounded-xl flex flex-col items-center min-w-0">
                                    <span className="text-[7.5px] text-emerald-400 uppercase font-black mb-1">{rightHeader}</span>
                                    <span className="truncate w-full text-center block text-[10px] font-black">{rightCard ? getTranslatedCardName(rightCard, profile) : 'Mülk'}</span>
                                    <div className="mt-1.5 flex items-center justify-center">
                                      {rightCard ? renderCardColorIndicator(rightCard, rightColor) : <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: COLOR_HEX[rightColor] }} />}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          // 2. Sly Deal (Sinsi Anlaşma)
                          if (actionType === 'sly-deal') {
                            let targetCard: Card | null = null;
                            let targetColor: CardColor = 'brown';
                            if (defenderPlayer) {
                              for (const col in defenderPlayer.properties) {
                                const c = defenderPlayer.properties[col as CardColor]?.cards.find(c => c.id === req.targetCardId);
                                if (c) { targetCard = c; targetColor = col as CardColor; break; }
                              }
                            }

                            const cardLabel = isInitiatorView ? (isEn ? 'Targeting Property' : 'Çalmak İstediğiniz Mülk') : (isEn ? 'Your Targeted Property' : 'Hedeflenen Mülkünüz');

                            return (
                              <div className="bg-slate-950/80 border border-rose-500/30 rounded-2xl p-3.5 w-full text-center space-y-2 select-none shadow-lg relative overflow-hidden">
                                <div className="absolute top-0 inset-x-0 h-1.5" style={targetCard ? getCardHeaderStyle(targetCard, targetColor) : { backgroundColor: COLOR_HEX[targetColor] }} />
                                <span className="text-[10px] text-rose-400 font-black uppercase tracking-wider block">🎯 SİNSİ ANLAŞMA DETAYI</span>
                                <div className="p-3 bg-slate-900 border border-slate-700/60 rounded-xl flex flex-col items-center shadow-inner">
                                  <span className="text-[9px] text-slate-400 uppercase font-black">{cardLabel}</span>
                                  <div className="mt-1.5 px-3 py-1 bg-slate-950 rounded-lg border border-white/10 flex items-center gap-2">
                                    {targetCard ? renderCardColorIndicator(targetCard, targetColor) : <span className="w-3 h-3 rounded-full shrink-0 shadow-sm border border-white/20" style={{ backgroundColor: COLOR_HEX[targetColor] }} />}
                                    <span className="text-slate-100 font-black text-xs">
                                      {targetCard ? getTranslatedCardName(targetCard, profile) : 'Mülk'}
                                    </span>
                                    {targetCard && (targetCard.isWildcard || targetCard.type === 'wildcard') && (
                                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                                        {isCardMultiColorWildcard(targetCard) ? 'Joker 🌈' : 'Çift Renk 🌓'}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          // 3. Deal Breaker (Anlaşma Bozan)
                          if (actionType === 'deal-breaker') {
                            const targetColor = req.targetColor as CardColor;
                            const setLabel = isInitiatorView ? (isEn ? 'Targeting Complete Set' : 'Çalmak İstediğiniz Set') : (isEn ? 'Your Targeted Complete Set' : 'Hedeflenen Tam Setiniz');

                            return (
                              <div className="bg-slate-950/80 border border-red-500/30 rounded-2xl p-3.5 w-full text-center space-y-2 select-none shadow-lg relative overflow-hidden">
                                <div className="absolute top-0 inset-x-0 h-1" style={{ backgroundColor: COLOR_HEX[targetColor] }} />
                                <span className="text-[10px] text-red-400 font-black uppercase tracking-wider block">⚡ ANLAŞMA BOZAN DETAYI</span>
                                <div className="p-3 bg-slate-900 border border-slate-700/60 rounded-xl flex flex-col items-center shadow-inner">
                                  <span className="text-[9px] text-slate-400 uppercase font-black">{setLabel}</span>
                                  <div className="mt-1.5 px-3 py-1 bg-slate-950 rounded-lg border border-white/10 flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full shrink-0 shadow-sm border border-white/20" style={{ backgroundColor: COLOR_HEX[targetColor] }} />
                                    <span className="text-slate-100 font-black text-xs">
                                      {getTranslatedColorLabel(targetColor, profile)} Seti
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          // 4. Debt Collector / Rent / Birthday
                          if (actionType === 'debt-collector' || req.amountDue > 0) {
                            const amt = req.amountDue || 5;
                            const amtLabel = isInitiatorView ? (isEn ? 'You Will Receive' : 'Alacağınız Tutar') : (isEn ? 'You Owe' : 'Ödemeniz Gereken Tutar');
                            return (
                              <div className="bg-slate-950/80 border border-red-500/30 rounded-2xl p-3.5 w-full text-center space-y-2 select-none shadow-lg">
                                <span className="text-[10px] text-red-400 font-black uppercase tracking-wider block">💸 PARASAL TALEP DETAYI</span>
                                <div className="p-3 bg-slate-900 border border-slate-700/60 rounded-xl flex flex-col items-center shadow-inner">
                                  <span className="text-[9px] text-slate-400 uppercase font-black">{amtLabel}</span>
                                  <span className="text-red-400 font-black mt-1 text-3xl tracking-tight">
                                    {amt}M
                                  </span>
                                </div>
                              </div>
                            );
                          }

                          return null;
                        })()}

                        {actionTimeLeft !== null && (
                          <div className="text-xs bg-red-950/40 border border-red-500/30 py-2 px-3 rounded-xl text-red-400 font-black flex items-center justify-center gap-2 shadow-sm">
                            ⏱️ {isEn ? 'Auto decision in:' : 'Otomatik karar süresi:'} <span className="text-sm font-black text-red-400">{actionTimeLeft}s</span>
                          </div>
                        )}

                        <div className="flex flex-col gap-2.5 pt-1">
                          {localPlayer.hand.some((c) => c.actionType === 'just-say-no') ? (
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => {
                                triggerHaptic('heavy');
                                playPlaySound();
                                handleRespondActionRequest('just-say-no');
                              }}
                              className="w-full py-3.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black rounded-2xl text-xs uppercase tracking-wider transition-all shadow-lg cursor-pointer flex items-center justify-center gap-2 border border-red-400/40"
                            >
                              🛡️ {isInitiatorView 
                                ? (isEn ? "COUNTERSIGN WITH 'JUST SAY NO'!" : "REDDET'E 'REDDET' OYNA! (Karşı Savunma)") 
                                : (jsnCount > 0 
                                  ? (isEn ? "PLAY ANOTHER 'JUST SAY NO'!" : "YENİDEN 'REDDET' OYNA! (Savunmayı Sürdür)")
                                  : (isEn ? "USE 'JUST SAY NO' CARD!" : "'HAYIR TEŞEKKÜRLER' (REDDET) OYNA!"))
                              }
                            </motion.button>
                          ) : (
                            <div className="text-xs text-rose-300 bg-red-950/30 py-3 px-4 rounded-xl border border-red-500/20 text-center font-bold select-none">
                              {isEn ? "No 'Just Say No' card in hand." : "Elinizde savunma kartı (JSN) bulunmuyor."}
                            </div>
                          )}

                          <motion.button
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            onClick={() => {
                              triggerHaptic('light');
                              playCoinSound();
                              handleRespondActionRequest('decline');
                            }}
                            className={`w-full py-3 ${isInitiatorView ? 'bg-amber-600 hover:bg-amber-500 text-white border-amber-400/40 font-black' : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-600/50 font-black'} rounded-2xl text-xs uppercase tracking-wider transition-all cursor-pointer border shadow-md`}
                          >
                            {acceptButtonText}
                          </motion.button>


                        </div>
                      </>
                    );
                  })()}
                </div>
              ) : (
                // STANDART ÖDEME EKRANI (Kira, Borç / Checkout Terminal)
                <>
                  <div className="absolute top-0 inset-x-0 h-[4px] bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500" />
                  <div className="absolute -top-16 -left-16 w-36 h-36 bg-emerald-500/10 rounded-full filter blur-2xl pointer-events-none" />

                  <div className="text-center space-y-3 border-b border-white/10 pb-3">
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-xl">💳</span>
                      <h3 className="text-xs font-black text-slate-100 leading-snug">
                        {(() => {
                          const sPlayer = match.players.find(p => p.id === myActiveRequest.sourcePlayerId);
                          const cardName = myActiveRequest.actionCard ? getTranslatedCardName(myActiveRequest.actionCard, profile) : 'Aksiyon';
                          return (
                            <span><strong className="text-amber-400">{sPlayer?.username}</strong> size karşı <strong className="text-emerald-400">{cardName}</strong> oynadı!</span>
                          );
                        })()}
                      </h3>
                    </div>

                    {/* Checkout Details Box */}
                    {(() => {
                      const actionType = myActiveRequest.originalAction?.type || myActiveRequest.actionCard?.actionType || myActiveRequest.actionCard?.type;
                      const sPlayer = match.players.find(p => p.id === myActiveRequest.sourcePlayerId);

                      // 1. Borç / Kira Durumu
                      if (myActiveRequest.amountDue > 0) {
                        return (
                          <div className="bg-slate-950/80 border border-red-500/30 rounded-2xl p-3.5 inline-block w-full text-center shadow-inner">
                            <span className="text-[10px] text-red-400 font-black uppercase tracking-wider block mb-1">
                              {profile.settings.language === 'en' ? 'Total Amount Due:' : 'Ödemeniz Gereken Toplam Borç:'}
                            </span>
                            <span className="text-3xl font-black text-red-400 tracking-tight">{myActiveRequest.amountDue}M</span>
                          </div>
                        );
                      }

                      // 2. Zorla Takas (Forced Deal)
                      if (actionType === 'forced-deal') {
                        let targetCard: Card | null = null;
                        let givenCard: Card | null = null;
                        let targetColor: CardColor = 'brown';
                        let givenColor: CardColor = 'brown';

                        for (const col in localPlayer.properties) {
                          const c = localPlayer.properties[col as CardColor]?.cards.find(c => c.id === myActiveRequest.targetCardId);
                          if (c) { targetCard = c; targetColor = col as CardColor; break; }
                        }
                        if (sPlayer) {
                          for (const col in sPlayer.properties) {
                            const c = sPlayer.properties[col as CardColor]?.cards.find(c => c.id === myActiveRequest.myCardId);
                            if (c) { givenCard = c; givenColor = col as CardColor; break; }
                          }
                        }

                        return (
                          <div className="bg-slate-950/80 border border-amber-500/30 rounded-2xl p-3 w-full text-center space-y-2 select-none shadow-md">
                            <span className="text-[10px] text-amber-400 font-black uppercase tracking-wider block">🔄 ZORUNLU TAKAS TEKLİFİ</span>

                            <div className="flex items-center justify-between gap-2 text-xs text-slate-200 font-bold">
                              {/* Verilen Kart (Bizden Çalınacak) */}
                              <div className="flex-1 p-2.5 bg-slate-900 border border-slate-700/60 rounded-xl flex flex-col items-center min-w-0">
                                <span className="text-[8px] text-rose-400 uppercase font-black mb-1">Sizden Gidecek</span>
                                <span className="truncate w-full text-center block text-xs font-black">{targetCard ? getTranslatedCardName(targetCard, profile) : 'Mülk'}</span>
                                <div className="mt-1.5 flex items-center justify-center">
                                  {targetCard ? renderCardColorIndicator(targetCard, targetColor) : <span className="w-3 h-3 rounded-full shadow-sm border border-white/20" style={{ backgroundColor: COLOR_HEX[targetColor] }} />}
                                </div>
                              </div>

                              <span className="text-sm text-amber-400 font-black shrink-0 animate-pulse">➔</span>

                              {/* Alınan Kart (Bize Gelecek) */}
                              <div className="flex-1 p-2.5 bg-slate-900 border border-slate-700/60 rounded-xl flex flex-col items-center min-w-0">
                                <span className="text-[8px] text-emerald-400 uppercase font-black mb-1">Bize Gelecek</span>
                                <span className="truncate w-full text-center block text-xs font-black">{givenCard ? getTranslatedCardName(givenCard, profile) : 'Mülk'}</span>
                                <div className="mt-1.5 flex items-center justify-center">
                                  {givenCard ? renderCardColorIndicator(givenCard, givenColor) : <span className="w-3 h-3 rounded-full shadow-sm border border-white/20" style={{ backgroundColor: COLOR_HEX[givenColor] }} />}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // 3. Sinsi Anlaşma (Sly Deal)
                      if (actionType === 'sly-deal') {
                        let targetCard: Card | null = null;
                        let targetColor: CardColor = 'brown';
                        for (const col in localPlayer.properties) {
                          const c = localPlayer.properties[col as CardColor]?.cards.find(c => c.id === myActiveRequest.targetCardId);
                          if (c) { targetCard = c; targetColor = col as CardColor; break; }
                        }

                        return (
                          <div className="bg-slate-950/80 border border-rose-500/30 rounded-2xl p-3 w-full text-center space-y-2 select-none shadow-md relative overflow-hidden">
                            <div className="absolute top-0 inset-x-0 h-1.5" style={targetCard ? getCardHeaderStyle(targetCard, targetColor) : { backgroundColor: COLOR_HEX[targetColor] }} />
                            <span className="text-[10px] text-rose-400 font-black uppercase tracking-wider block">🎯 TEK MÜLK ÇALMA TALEBİ</span>
                            <div className="p-2.5 bg-slate-900 border border-slate-700/60 rounded-xl flex flex-col items-center">
                              <span className="text-[9px] text-slate-400 uppercase font-black">İstenen Mülkünüz</span>
                              <div className="mt-1.5 px-3 py-1 bg-slate-950 rounded-lg border border-white/10 flex items-center gap-2">
                                {targetCard ? renderCardColorIndicator(targetCard, targetColor) : <span className="w-3 h-3 rounded-full shrink-0 shadow-sm border border-white/20" style={{ backgroundColor: COLOR_HEX[targetColor] }} />}
                                <span className="text-slate-100 font-black text-xs">
                                  {targetCard ? getTranslatedCardName(targetCard, profile) : 'Mülk'}
                                </span>
                                {targetCard && (targetCard.isWildcard || targetCard.type === 'wildcard') && (
                                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                                    {isCardMultiColorWildcard(targetCard) ? 'Joker 🌈' : 'Çift Renk 🌓'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // 4. Anlaşma Bozan (Deal Breaker)
                      if (actionType === 'deal-breaker') {
                        const targetColor = myActiveRequest.targetColor as CardColor;

                        return (
                          <div className="bg-slate-950/80 border border-red-500/30 rounded-2xl p-3 w-full text-center space-y-2 select-none shadow-md">
                            <span className="text-[10px] text-red-400 font-black uppercase tracking-wider block">⚡ TAM SET ÇALMA TALEBİ</span>
                            <div className="p-2.5 bg-slate-900 border border-slate-700/60 rounded-xl flex flex-col items-center">
                              <span className="text-[9px] text-slate-400 uppercase font-black">İstenen Tamamlanmış Setiniz</span>
                              <div className="mt-1.5 px-3 py-1 bg-slate-950 rounded-lg border border-white/10 flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full shrink-0 shadow-sm border border-white/20" style={{ backgroundColor: COLOR_HEX[targetColor] }} />
                                <span className="text-slate-100 font-black text-xs">
                                  {getTranslatedColorLabel(targetColor, profile)} Seti
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      return null;
                    })()}
                  </div>

                  {/* Payment Board Checkout */}
                  <div className="space-y-3.5">
                    {/* Remaining Balance Bar */}
                    {(() => {
                      const totalSelectedVal = paymentSelection.reduce((acc, id) => {
                        const bc = localPlayer.bank.find((card) => card.id === id);
                        if (bc) return acc + bc.value;
                        for (const col in localPlayer.properties) {
                          const pc = localPlayer.properties[col as CardColor]?.cards.find((card) => card.id === id);
                          if (pc) return acc + pc.value;
                        }
                        return acc;
                      }, 0);
                      const amountDue = myActiveRequest?.amountDue || 0;
                      const remainingDebt = Math.max(0, amountDue - totalSelectedVal);
                      const progressPercent = Math.min(100, (totalSelectedVal / amountDue) * 100);

                      return (
                        <div className="bg-slate-950/80 border border-slate-750/70 p-3 rounded-2xl space-y-2 select-none shadow-inner">
                          <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-white/10">
                            <div
                              className="h-full bg-gradient-to-r from-red-500 to-emerald-400 transition-all duration-300"
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                          <div className="flex justify-between items-center text-xs font-black">
                            <span className="text-slate-300">{profile.settings.language === 'en' ? 'Remaining Due:' : 'Kalan Borç:'} <strong className="text-red-400 text-sm">{remainingDebt}M</strong></span>
                            {remainingDebt === 0 ? (
                              <span className="text-emerald-400 font-black animate-pulse flex items-center gap-1 text-xs">
                                ✓ {profile.settings.language === 'en' ? 'READY TO PAY!' : 'ÖDEME HAZIR!'}
                              </span>
                            ) : (
                              <span className="text-slate-400">{profile.settings.language === 'en' ? 'Paid:' : 'Ödenen:'} <strong className="text-emerald-400">{totalSelectedVal}M / {amountDue}M</strong></span>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Quick Selection buttons */}
                    <div className="flex gap-2">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          const due = myActiveRequest?.amountDue || 0;
                          const selection = calculateOptimalPaymentSelection(due);
                          setPaymentSelection(selection);
                          triggerHaptic('medium');
                          playCoinSound();
                        }}
                        className="flex-1 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer text-center shadow-md"
                      >
                        ⚡ {profile.settings.language === 'en' ? 'Auto-Select' : 'Otomatik Seç'}
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          triggerHaptic('light');
                          setPaymentSelection([]);
                        }}
                        className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 rounded-xl text-xs font-black transition-all cursor-pointer"
                      >
                        {profile.settings.language === 'en' ? 'Clear' : 'Temizle'}
                      </motion.button>
                    </div>

                    {/* Property Lists - Double column layout with mini land card styling */}
                    <div className="grid grid-cols-2 gap-3 max-h-52 overflow-y-auto pr-1 scrollbar-thin">
                      {/* Left: Bank Vault Cash */}
                      <div className="space-y-1.5">
                        <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider block">💰 {profile.settings.language === 'en' ? 'Cash Box' : 'Kasa (Nakit)'}</span>
                        {localPlayer.bank.length > 0 ? (
                          <div className="space-y-1.5">
                            {localPlayer.bank.map((c) => {
                              const isSelected = paymentSelection.includes(c.id);
                              return (
                                <motion.button
                                  key={c.id}
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  onClick={() => {
                                    triggerHaptic('light');
                                    playCoinSound();
                                    if (isSelected) {
                                      setPaymentSelection((prev) => prev.filter((id) => id !== c.id));
                                    } else {
                                      setPaymentSelection((prev) => [...prev, c.id]);
                                    }
                                  }}
                                  className={`w-full p-2.5 rounded-xl border text-left transition-all flex justify-between items-center cursor-pointer ${isSelected
                                    ? 'border-emerald-400 bg-emerald-500/20 shadow-md shadow-emerald-500/10'
                                    : 'border-slate-800 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-950'
                                    }`}
                                >
                                  <span className="text-xs font-extrabold text-slate-100 truncate max-w-[65px]">{getTranslatedCardName(c, profile)}</span>
                                  <span className="text-xs font-black text-emerald-400 shrink-0">{c.value}M</span>
                                </motion.button>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-[9px] text-slate-500 italic block py-2 text-center">{profile.settings.language === 'en' ? 'No Cash' : 'Nakit yok'}</span>
                        )}
                      </div>

                      {/* Right: Table Properties */}
                      <div className="space-y-1.5">
                        <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider block">🏢 {profile.settings.language === 'en' ? 'Properties' : 'Masadaki Mülkler'}</span>
                        {Object.values(localPlayer.properties).some((set: any) => set && set.cards.length > 0) ? (
                          <div className="space-y-1.5">
                            {(() => {
                              const myTableProperties = Object.keys(localPlayer.properties).flatMap((colorKey) => {
                                const col = colorKey as CardColor;
                                const set = localPlayer.properties[col];
                                if (!set) return [];
                                return set.cards.map((c) => ({ c, col }));
                              });

                              myTableProperties.sort((a, b) => {
                                const aWild = isWildcardOrDualColorCard(a.c) ? 1 : 0;
                                const bWild = isWildcardOrDualColorCard(b.c) ? 1 : 0;
                                return bWild - aWild;
                              });

                              return myTableProperties.map(({ c, col }) => {
                                const isSelected = paymentSelection.includes(c.id);
                                return (
                                  <motion.button
                                    key={c.id}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => {
                                      triggerHaptic('light');
                                      playCoinSound();
                                      if (isSelected) {
                                        setPaymentSelection((prev) => prev.filter((id) => id !== c.id));
                                      } else {
                                        setPaymentSelection((prev) => [...prev, c.id]);
                                      }
                                    }}
                                    className={`w-full p-2.5 rounded-xl border text-left transition-all flex justify-between items-center cursor-pointer gap-2 ${isSelected
                                      ? 'border-amber-400 bg-amber-500/20 shadow-md shadow-amber-500/10'
                                      : 'border-slate-800 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-950'
                                      }`}
                                  >
                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                      {renderCardColorIndicator(c, col)}
                                      <span className="text-xs font-extrabold text-slate-100 truncate">
                                        {getTranslatedCardName(c, profile)}
                                        {(c.isWildcard || c.type === 'wildcard') && (isCardMultiColorWildcard(c) ? ' 🌈' : ' 🌓')}
                                      </span>
                                    </div>
                                    <span className="text-xs font-black text-amber-400 shrink-0">{c.value}M</span>
                                  </motion.button>
                                );
                              });
                            })()}
                          </div>
                        ) : (
                          <span className="text-[9px] text-slate-500 italic block py-2 text-center">{profile.settings.language === 'en' ? 'No Properties' : 'Mülk yok'}</span>
                        )}
                      </div>
                    </div>

                    {/* Checkout Basket Overview */}
                    {paymentSelection.length > 0 && (
                      <div className="bg-slate-950/80 border border-slate-750/70 rounded-2xl p-3 space-y-1.5 select-none shadow-inner">
                        <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider block">🛒 {profile.settings.language === 'en' ? 'Checkout Basket' : 'Ödeme Sepeti'} ({paymentSelection.length} {profile.settings.language === 'en' ? 'Cards' : 'Kart'})</span>
                        <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto pr-0.5 scrollbar-thin">
                          <AnimatePresence>
                            {paymentSelection.map((id) => {
                              let card: Card | undefined = localPlayer.bank.find((c) => c.id === id);
                              let col: CardColor = 'brown';
                              if (!card) {
                                for (const cKey in localPlayer.properties) {
                                  const found = localPlayer.properties[cKey as CardColor]?.cards.find((c) => c.id === id);
                                  if (found) {
                                    card = found;
                                    col = cKey as CardColor;
                                    break;
                                  }
                                }
                              }
                              if (!card) return null;

                              return (
                                <motion.span
                                  key={id}
                                  layoutId={`payment-cart-${id}`}
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.8 }}
                                  className="inline-flex items-center gap-1.5 text-xs font-extrabold bg-slate-900 border border-white/10 px-2.5 py-1 rounded-lg text-slate-100 shadow-sm"
                                >
                                  {card.type === 'property' || card.type === 'wildcard' ? (
                                    <span className="w-2 h-2 rounded-full shrink-0 border border-white/20" style={{ backgroundColor: COLOR_HEX[col] }} />
                                  ) : (
                                    <span className="text-xs">💵</span>
                                  )}
                                  <span className="truncate max-w-[65px]">{getTranslatedCardName(card, profile)}</span>
                                  <span className="text-emerald-400 font-black">{card.value}M</span>
                                </motion.span>
                              );
                            })}
                          </AnimatePresence>
                        </div>
                      </div>
                    )}
                  </div>

                  {actionTimeLeft !== null && (
                    <div className="text-xs bg-red-950/30 border border-red-500/20 py-2 px-3 rounded-xl text-red-400 font-black flex items-center justify-center gap-2">
                      ⏱️ {profile.settings.language === 'en' ? 'Auto payment in:' : 'Otomatik ödeme süresi:'} <span className="text-sm font-black text-red-400">{actionTimeLeft}s</span>
                    </div>
                  )}

                  <div className="flex flex-col gap-2 pt-1">
                    {/* If they have Just Say No in hand, offer playing it */}
                    {localPlayer.hand.some((c) => c.actionType === 'just-say-no') && (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          triggerHaptic('heavy');
                          playPlaySound();
                          handleRespondActionRequest('just-say-no');
                        }}
                        className="w-full py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer border border-red-400/30"
                      >
                        🛡️ {profile.settings.language === 'en' ? "USE 'JUST SAY NO' CARD!" : "'HAYIR TEŞEKKÜRLER' KARTINI KULLAN!"}
                      </motion.button>
                    )}

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        triggerHaptic('heavy');
                        playCoinSound();
                        handleRespondActionRequest('pay');
                      }}
                      className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-2xl text-xs uppercase tracking-wider transition-all shadow-lg cursor-pointer border border-emerald-300/40"
                    >
                      {profile.settings.language === 'en' ? 'ACCEPT & PAY / HAND OVER CARDS' : 'ÖDEMEYİ ONAYLA VE DEVRET'}
                    </motion.button>


                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. Set Management Modal (Rearrange Wildcards) */}
      <AnimatePresence>
        {managedSetColor && (
          <motion.div
            key="managed-set-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setManagedSetColor(null)}
            className="fixed inset-0 bg-slate-950/90 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.92, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.92, y: 15, opacity: 0 }}
              transition={{ type: "spring", duration: 0.45 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 border border-slate-750/70 rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl relative overflow-hidden"
            >
              {/* Top color glow band */}
              <div className="absolute top-0 inset-x-0 h-[4px]" style={{ backgroundColor: COLOR_HEX[managedSetColor] }} />
              <div className="absolute -top-16 -left-16 w-36 h-36 rounded-full filter blur-2xl pointer-events-none" style={{ backgroundColor: `${COLOR_HEX[managedSetColor]}15` }} />

              <div className="flex justify-between items-center border-b border-white/5 pb-2 pt-1 relative">
                <h3 className="font-black text-xs text-white uppercase flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full border border-white/10" style={{ backgroundColor: COLOR_HEX[managedSetColor] }} />
                  {profile.settings.language === 'en' ? 'Set Management' : 'Set Yönetimi'} - <span style={{ color: COLOR_HEX[managedSetColor] }} className="font-black">{getTranslatedColorLabel(managedSetColor, profile)}</span>
                </h3>
                <button
                  onClick={() => {
                    triggerHaptic('light');
                    setManagedSetColor(null);
                  }}
                  className="text-slate-400 hover:text-white font-black text-xs p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <p className="text-[9.5px] text-slate-400 leading-normal">
                {profile.settings.language === 'en'
                  ? 'Rearrange your wildcards or change colors using the action buttons.'
                  : 'Joker kartlarınızın rengini değiştirebilir ve setinizi düzenleyebilirsiniz.'}
              </p>

              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
                {localPlayer.properties[managedSetColor]?.cards.map((c) => {
                  const isMultiColorWildcard = c.isWildcard && (!c.secondaryColor || c.secondaryColor === 'any');
                  return (
                    <div key={c.id} onDoubleClick={() => { if (c.isWildcard && isMyTurn) { handleQuickFlipWildcard(c); setManagedSetColor(null); } }} title={c.isWildcard && isMyTurn ? (profile.settings.language === 'en' ? "Double-click to flip color" : "Rengini çevirmek için çift tıklayın") : undefined} className="p-3 rounded-2xl bg-slate-950/60 border border-white/5 hover:border-white/10 flex items-center justify-between gap-3 transition-all shadow-md cursor-pointer select-none">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Color indicator strip */}
                        <div
                          className="w-3 h-10 rounded-lg shrink-0 shadow border border-white/10"
                          style={{
                            background: c.isWildcard
                              ? (isMultiColorWildcard
                                ? 'linear-gradient(180deg, #ef4444 0%, #f97316 20%, #eab308 40%, #22c55e 60%, #3b82f6 80%, #a855f7 100%)' // Rainbow
                                : `linear-gradient(180deg, ${COLOR_HEX[c.color || 'brown']} 50%, ${COLOR_HEX[c.secondaryColor || 'brown']} 50%)` // Dual
                              )
                              : COLOR_HEX[c.color || 'brown'] // Single
                          }}
                        />
                        <div className="flex flex-col min-w-0 text-left">
                          <span className="font-extrabold text-xs text-slate-200 truncate block">{getTranslatedCardName(c, profile)}</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {c.isWildcard && (
                              <span className="text-[8.5px] font-black tracking-wide uppercase px-1 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 select-none">
                                {profile.settings.language === 'en' ? 'Joker' : 'Joker'}
                              </span>
                            )}
                            <span className="text-[9px] text-slate-400 font-bold">
                              {profile.settings.language === 'en' ? 'Value: ' : 'Değer: '}{c.value}M
                            </span>
                          </div>
                        </div>
                      </div>

                      {c.isWildcard && (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            triggerHaptic('medium');
                            playPlaySound();
                            setWildcardColorPick(c);
                            setManagedSetColor(null);
                          }}
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-[10px] font-black rounded-xl uppercase transition-all shadow-md shrink-0 flex items-center gap-1 cursor-pointer"
                        >
                          🔄 {profile.settings.language === 'en' ? 'Switch' : 'Değiştir'}
                        </motion.button>
                      )}
                    </div>
                  );
                })}
              </div>

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  triggerHaptic('light');
                  setManagedSetColor(null);
                }}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-750 text-white font-extrabold rounded-xl text-xs transition-all shadow-md cursor-pointer border border-white/5"
              >
                {profile.settings.language === 'en' ? 'Close' : 'Kapat'}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Attack / Rent Shockwave Lightning Energy Overlay */}
      {match.activeActionRequest && (
        <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden flex items-center justify-center">
          <motion.div
            className="absolute w-[500px] h-[500px] rounded-full border-4 border-rose-500/60 bg-rose-600/10 shadow-[0_0_100px_rgba(244,63,94,0.7)]"
            initial={{ scale: 0.2, opacity: 0 }}
            animate={{ scale: [0.4, 2.2, 2.8], opacity: [0, 0.8, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
          />
        </div>
      )}

      {/* 5. Upgraded Interactive 4-Step Rules Hint Modal */}
      {showHint && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-900 border border-slate-750/50 rounded-3xl p-5 w-full max-w-md space-y-4 shadow-2xl relative overflow-hidden text-slate-100">
            
            {/* Header with Step indicator */}
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">💡</span>
                <div>
                  <h3 className="font-black text-xs text-amber-400 uppercase tracking-widest">
                    HIZLI OYUN REHBERİ
                  </h3>
                  <span className="text-[9px] text-slate-400 font-extrabold">
                    Adım {tutorialStep + 1} / 4
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowHint(false)}
                className="text-slate-400 hover:text-white font-black text-sm bg-slate-800 hover:bg-slate-700 w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Step Navigation Dots */}
            <div className="flex justify-center gap-2 py-1">
              {[0, 1, 2, 3].map((stepIdx) => (
                <button
                  key={stepIdx}
                  onClick={() => setTutorialStep(stepIdx)}
                  className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                    tutorialStep === stepIdx
                      ? 'w-8 bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]'
                      : 'w-2 bg-slate-700 hover:bg-slate-500'
                  }`}
                />
              ))}
            </div>

            {/* Step Content */}
            <div className="min-h-[190px] flex flex-col justify-center space-y-3">
              {tutorialStep === 0 && (
                <div className="space-y-3 text-center animate-fade-in">
                  <div className="inline-block p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl shadow-inner">
                    <span className="text-3xl">🏆</span>
                  </div>
                  <h4 className="font-black text-sm text-amber-300">1. OYUNUN AMACI & KAZANMA</h4>
                  <p className="text-xs text-slate-300 leading-relaxed px-2">
                    Maçı kazanmak için <strong>3 TAM MÜLK SETİ</strong> oluşturan ilk oyuncu olun! Her renk grubunun gerektirdiği kart sayısını (ör. 3 Kırmızı veya 2 Koyu Mavi) tamamlayarak setinizi bitirin.
                  </p>
                  <div className="flex justify-center gap-2 pt-1">
                    <span className="bg-emerald-950 border border-emerald-500 text-emerald-300 text-[10px] font-extrabold px-2 py-1 rounded-lg">👑 Yeşil [3/3]</span>
                    <span className="bg-blue-950 border border-blue-500 text-blue-300 text-[10px] font-extrabold px-2 py-1 rounded-lg">👑 Mavi [2/2]</span>
                    <span className="bg-rose-950 border border-rose-500 text-rose-300 text-[10px] font-extrabold px-2 py-1 rounded-lg">👑 Kırmızı [3/3]</span>
                  </div>
                </div>
              )}

              {tutorialStep === 1 && (
                <div className="space-y-3 text-center animate-fade-in">
                  <div className="inline-block p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl shadow-inner">
                    <span className="text-3xl">🎴</span>
                  </div>
                  <h4 className="font-black text-sm text-indigo-300">2. TUR AKIŞI (3 HAMLE HAKKI)</h4>
                  <p className="text-xs text-slate-300 leading-relaxed px-2">
                    Her tur sırası size geldiğinde:
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-[10px] font-bold text-left">
                    <div className="bg-slate-950 p-2 rounded-xl border border-white/10 text-center">
                      <span className="block text-amber-400 font-black mb-0.5">1. Kart Çek</span>
                      Desteden 2 kart alın.
                    </div>
                    <div className="bg-slate-950 p-2 rounded-xl border border-white/10 text-center">
                      <span className="block text-emerald-400 font-black mb-0.5">2. 3 Hamle Yap</span>
                      Mülk koy, Bankaya yatır veya Aksiyon oyna.
                    </div>
                    <div className="bg-slate-950 p-2 rounded-xl border border-white/10 text-center">
                      <span className="block text-purple-400 font-black mb-0.5">3. Turu Bitir</span>
                      Hamlen bitince devret.
                    </div>
                  </div>
                </div>
              )}

              {tutorialStep === 2 && (
                <div className="space-y-3 text-center animate-fade-in">
                  <div className="inline-block p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl shadow-inner">
                    <span className="text-3xl">🏦</span>
                  </div>
                  <h4 className="font-black text-sm text-emerald-300">3. BANKA KASASI & GÜVENLİK</h4>
                  <p className="text-xs text-slate-300 leading-relaxed px-2">
                    Para kartlarınızı <strong>Banka Kasası</strong> alanınıza yatırın. Rakipler sizden kira istediğinde veya borç çıkardığında, değerli mülklerinizi kaybetmemek için bankadaki paralar harcanır!
                  </p>
                  <div className="bg-slate-950 p-2 rounded-xl border border-emerald-500/30 text-[10px] text-emerald-200 font-bold">
                    💡 İpucu: Kasada ne kadar çok paranız olursa, mülklerinizi o kadar güvende tutarsınız!
                  </div>
                </div>
              )}

              {tutorialStep === 3 && (
                <div className="space-y-3 text-center animate-fade-in">
                  <div className="inline-block p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl shadow-inner">
                    <span className="text-3xl">🛡️</span>
                  </div>
                  <h4 className="font-black text-sm text-rose-300">4. SALDIRI & SADECE HAYIR KARTI</h4>
                  <p className="text-xs text-slate-300 leading-relaxed px-2">
                    Aksiyon kartları ile rakiplerinizin mülklerini çalabilir veya tüm oyunculardan kira toplayabilirsiniz. Bir rakip size saldırdığında <strong>"Sadece Hayır (Just Say No)"</strong> kartı ile saldırıyı anında İPTAL edebilirsiniz!
                  </p>
                  <div className="bg-slate-950 p-2 rounded-xl border border-rose-500/30 text-[10px] text-rose-200 font-bold">
                    🚫 Sadece Hayır kartı sıra sizde olmasa bile anında kullanılabilir!
                  </div>
                </div>
              )}
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/10">
              <button
                disabled={tutorialStep === 0}
                onClick={() => setTutorialStep((prev) => Math.max(0, prev - 1))}
                className={`px-3 py-2 rounded-xl text-xs font-black transition-all ${
                  tutorialStep === 0
                    ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                    : 'bg-slate-800 hover:bg-slate-700 text-white cursor-pointer'
                }`}
              >
                ◄ Önceki
              </button>

              {tutorialStep < 3 ? (
                <button
                  onClick={() => setTutorialStep((prev) => Math.min(3, prev + 1))}
                  className="flex-1 py-2 bg-gradient-to-r from-amber-500 to-purple-600 hover:opacity-90 text-white font-black rounded-xl text-xs transition-all shadow-md cursor-pointer"
                >
                  Sonraki Adım ►
                </button>
              ) : (
                <button
                  onClick={() => setShowHint(false)}
                  className="flex-1 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-90 text-white font-black rounded-xl text-xs transition-all shadow-md cursor-pointer animate-pulse"
                >
                  Anladım, Maça Dön! 🚀
                </button>
              )}
            </div>

          </div>
        </div>
      )}
      {showBankVaultModal && (
        <div
          onClick={() => setShowBankVaultModal(false)}
          className="fixed inset-0 bg-slate-950/90 flex items-center justify-center p-4 z-50 animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-750/70 rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl relative overflow-hidden"
            style={{
              boxShadow: '0 0 30px 2px rgba(16, 185, 129, 0.1), inset 0 0 15px rgba(255,255,255,0.02)',
              background: 'radial-gradient(circle at top, #0f172a 0%, #090d16 100%)'
            }}
          >
            {/* Gold metallic accent line at top */}
            <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-amber-500/20 via-amber-400 to-amber-500/20" />

            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl filter drop-shadow">🏦</span>
                <div>
                  <h3 className="font-black text-xs text-amber-400 uppercase tracking-widest">
                    {t('bank_vault', profile)}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold">
                    Ödemelerde harcayabileceğiniz nakit kasası
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  playPlaySound();
                  setShowBankVaultModal(false);
                }}
                className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors text-xs font-black"
              >
                ✕
              </button>
            </div>

            {/* Neon Yeşil Dev Dijital Gösterge */}
            <div className="bg-slate-950/90 border border-emerald-500/40 rounded-2xl p-4 text-center shadow-inner relative overflow-hidden select-none">
              <div className="absolute inset-0 bg-emerald-500/10 filter blur-md pointer-events-none" />
              <span className="text-[9px] text-emerald-400/80 font-black uppercase tracking-widest block mb-0.5">TOPLAM KASA DEĞERİ</span>
              <span className="text-3xl font-black text-emerald-400 tracking-wider filter drop-shadow-[0_0_12px_rgba(52,211,153,0.4)]">
                🪙 {localPlayer.bank.reduce((sum, c) => sum + c.value, 0)}M
              </span>
            </div>

            {/* List of cards */}
            <div className="py-1">
              {localPlayer.bank.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs italic bg-slate-950/60 rounded-2xl border border-dashed border-slate-800 font-bold">
                  {t('bank_vault_empty', profile)}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
                  {localPlayer.bank.map((card, idx) => (
                    <div
                      key={`${card.id}-${idx}`}
                      onClick={() => {
                        playCoinSound();
                        setFocusedCard(card);
                        setFocusedCardZoom(window.innerWidth < 640 ? 1.4 : 1.8);
                      }}
                      className="flex flex-col items-center gap-1.5 p-2 bg-slate-950/80 rounded-2xl border border-slate-750 hover:border-emerald-400/80 cursor-pointer transition-all active:scale-95 text-center group shadow-md"
                      title={t('view_details', profile)}
                    >
                      <div className="w-12 mx-auto scale-90 transition-transform group-hover:scale-95 group-hover:-translate-y-0.5 duration-200">
                        <GameCard card={card} size="medium" disable3D={true} cardBack={profile.settings.cardBack} cardSkin={profile.settings.cardSkin || 'skin_none'} />
                      </div>
                      <span className="text-xs font-black text-emerald-400 block group-hover:brightness-120">
                        {card.value}M 🔍
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => {
                playPlaySound();
                setShowBankVaultModal(false);
              }}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-100 font-black rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer border border-slate-700/60 shadow-md"
            >
              Masa Başına Dön
            </button>
          </div>
        </div>
      )}

      {/* OPPONENT ASSETS MODAL (Rakiplere Tıkladığımda Tüm Varlıkları çıksın) */}
      {showOpponentAssetsModal && assetsOpponentId && (
        (() => {
          const opponent = match.players.find((p) => p.id === assetsOpponentId);
          if (!opponent) return null;
          const bankTotal = opponent.bank.reduce((sum, c) => sum + c.value, 0);
          const bankBreakdown = getBankBreakdown(opponent.bank);

          return (
            <div
              onClick={() => {
                setShowOpponentAssetsModal(false);
                setAssetsOpponentId(null);
              }}
              className="fixed inset-0 bg-slate-950/90 flex items-center justify-center p-4 z-50 animate-fade-in"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="bg-slate-900 border border-emerald-500/30 rounded-3xl p-5 w-full max-w-sm space-y-4 shadow-2xl relative animate-scale-up max-h-[90vh] overflow-y-auto scrollbar-thin"
                style={{
                  boxShadow: '0 0 30px 2px rgba(16, 185, 129, 0.08)',
                  background: 'radial-gradient(circle at top, #0f172a 0%, #090d16 100%)'
                }}
              >
                {/* Header */}
                <div className="border-b border-white/10 pb-3 flex justify-between items-center relative select-none">
                  <h3 className="font-black text-xs text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                    🗂️ CASUS DOSYASI: {opponent.username}
                  </h3>
                  <span className="text-[9px] font-black text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded-lg">
                    {opponent.isBot ? 'BOT' : 'OYUNCU'}
                  </span>
                </div>

                {/* Bank status summary */}
                <div className="bg-slate-950/80 border border-slate-750 p-3.5 rounded-2xl space-y-2 text-center relative select-none shadow-inner">
                  <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider block">
                    💰 TOPLAM NAKİT REZERVİ
                  </span>
                  <span className="text-2xl font-black text-emerald-400 block tracking-wide">
                    {bankTotal}M
                  </span>
                  {bankBreakdown.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-1.5 mt-1">
                      {bankBreakdown.map((item) => (
                        <span
                          key={item.value}
                          className="text-[9px] font-black text-emerald-300 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-lg leading-none"
                        >
                          {item.value}M <span className="text-slate-400 font-bold text-[8px]">x{item.count}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Properties & sets bento layout */}
                <div className="space-y-2.5">
                  <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider block select-none">
                    🏢 SAHADAKİ MÜLK SETLERİ
                  </span>

                  <div className="grid grid-cols-2 gap-2.5">
                    {Object.keys(opponent.properties).map((colorKey) => {
                      const col = colorKey as CardColor;
                      const set = opponent.properties[col];
                      if (!set || set.cards.length === 0) return null;
                      const count = set.cards.length;
                      const max = MAX_IN_SET[col];
                      const isCompleted = count >= max;
                      const isCritical = !isCompleted && count === max - 1 && max > 0;
                      const rentVal = calculateSetRent(set.cards, col, set.hasHouse, set.hasHotel);
                      const colorHex = COLOR_HEX[col];

                      return (
                        <div
                          key={col}
                          className={`bg-slate-950/80 border rounded-2xl p-2.5 flex flex-col justify-between transition-all duration-300 relative shadow-md overflow-hidden ${isCritical
                            ? 'border-red-500/80 shadow-[0_0_12px_rgba(239,68,68,0.3)]'
                            : 'border-slate-800'
                            }`}
                        >
                          {/* Top Color Header Strip */}
                          <div className="absolute top-0 inset-x-0 h-1.5" style={{ backgroundColor: colorHex }} />

                          {isCritical && (
                            <span className="absolute top-2 right-2 bg-red-600 text-[7px] text-white font-black px-1.5 py-0.5 rounded-md tracking-wider animate-bounce select-none uppercase">
                              KRİTİK!
                            </span>
                          )}

                          {/* Set color & ratio */}
                          <div className="flex justify-between items-center text-xs font-black text-slate-100 pt-1">
                            <span className="truncate flex items-center gap-1.5 max-w-[85px]">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/20" style={{ backgroundColor: colorHex }} />
                              {getTranslatedColorLabel(col, profile)}
                            </span>
                            {isCompleted ? (
                              <span className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase">TAM SET</span>
                            ) : (
                              <span className="text-slate-400 text-xs font-black">[{count}/{max}]</span>
                            )}
                          </div>

                          {/* List of property names */}
                          <div className="space-y-1 border-t border-white/10 pt-1.5 my-2">
                            {set.cards.map((c) => (
                              <button
                                key={c.id}
                                onClick={() => {
                                  playPlaySound();
                                  setFocusedCard(c);
                                  setFocusedCardZoom(window.innerWidth < 640 ? 1.4 : 1.8);
                                }}
                                className="text-[9px] font-black text-slate-200 hover:text-amber-300 block w-full text-left truncate leading-snug uppercase cursor-pointer flex items-center gap-1.5"
                              >
                                {renderCardColorIndicator(c, col)}
                                <span>{getTranslatedCardName(c, profile)}</span>
                              </button>
                            ))}
                          </div>

                          <div className="text-[9px] font-black text-emerald-400 text-center bg-slate-900/80 py-1 rounded-lg border border-white/10">
                            Kira: <strong className="text-emerald-300 font-black">{rentVal}M</strong>
                          </div>
                        </div>
                      );
                    })}

                    {Object.keys(opponent.properties).every(c => !opponent.properties[c as CardColor] || opponent.properties[c as CardColor]!.cards.length === 0) && (
                      <span className="col-span-2 text-center py-8 text-xs text-slate-400 italic font-bold bg-slate-950/60 rounded-2xl border border-dashed border-slate-800">
                        Masada hiç mülkü bulunmuyor.
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => {
                    playPlaySound();
                    setShowOpponentAssetsModal(false);
                    setAssetsOpponentId(null);
                  }}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-100 font-black rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer relative z-10 border border-slate-700/60 shadow-md"
                >
                  Kapat
                </button>
              </div>
            </div>
          );
        })()
      )}

      {/* 6. Live Chat & Logs Slide-Over Overlay Drawer for Mobile */}
      {showChatOverlay && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-end animate-fade-in">
          <div className="w-full max-w-sm bg-slate-900 border-l border-white/10 h-full p-4 flex flex-col justify-between shadow-2xl relative animate-slide-left select-none">

            {/* Mobile Drawer Header */}
            <div className="border-b border-white/5 pb-2 mb-2 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="text-lg">💬</span>
                <h3 className="font-bold text-xs text-white">Canlı Akış & Sohbet</h3>
              </div>
              <button
                onClick={() => setShowChatOverlay(false)}
                className="text-slate-400 hover:text-white font-black text-sm p-1 cursor-pointer"
              >
                ✕ {t('close_btn', profile)}
              </button>
            </div>

            {/* Filter Tabs Bar */}
            <div className="flex gap-1 p-1 bg-black/40 border border-white/5 rounded-xl mb-2 shrink-0 select-none">
              {[
                { id: 'all', label: profile.settings.language === 'en' ? 'All' : 'Tümü', icon: '📋' },
                { id: 'actions', label: profile.settings.language === 'en' ? 'Actions' : 'Hamleler', icon: '⚡' },
                { id: 'chat', label: profile.settings.language === 'en' ? 'Chat' : 'Sohbet', icon: '💬' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    playPlaySound();
                    setChatFilter(tab.id as any);
                  }}
                  className={`flex-1 py-1 rounded-lg text-[9px] font-black uppercase transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    chatFilter === tab.id
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-900/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Logs Stream (Reversed Chronological - Latest at top) */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-[10px] scrollbar-thin optimize-scroll optimize-list-render">
              {(() => {
                const parseEnrichedLogs = (logs: GameLog[]) => {
                  let currentTurn = 1;
                  let currentAction = 0;

                  return logs.map((log) => {
                    const msg = log.message;

                    // Use log's explicit turnNumber if available
                    let turnNum = log.turnNumber || currentTurn;

                    if (!log.turnNumber) {
                      if (msg.includes('Tur Başladı') || msg.includes('Tur başladı') || msg.includes('. Tur:')) {
                        currentTurn++;
                        turnNum = currentTurn;
                        currentAction = 0;
                      }
                    } else {
                      currentTurn = log.turnNumber;
                    }

                    if (msg.includes('Sıra') || msg.includes('sırasını') || msg.includes('turunu') || msg.includes('Oyun başladı')) {
                      if (msg.includes('Sıra') || msg.includes('başladı')) {
                        currentAction = 0;
                      }
                      return {
                        id: log.id,
                        message: log.message,
                        timestamp: log.timestamp,
                        playerName: log.playerName,
                        turnNumber: Math.max(1, turnNum),
                        category: 'turn' as const,
                        icon: '🔄'
                      };
                    }

                    if (log.playerName) {
                      return {
                        id: log.id,
                        message: log.message,
                        timestamp: log.timestamp,
                        playerName: log.playerName,
                        turnNumber: Math.max(1, currentTurn),
                        category: 'chat' as const,
                        icon: '💬'
                      };
                    }

                    let category: 'rent' | 'property' | 'action' | 'defense' | 'system' = 'action';
                    let icon = '⚡';

                    if (msg.includes('kira') || msg.includes('Rent') || msg.includes('borç') || msg.includes('bankaya') || msg.includes('para') || msg.includes('ödedi')) {
                      category = 'rent';
                      icon = '💰';
                      currentAction = (currentAction % 3) + 1;
                    } else if (msg.includes('mülk') || msg.includes('grubuna') || msg.includes('yerleştirdi') || msg.includes('ev') || msg.includes('otel') || msg.includes('set')) {
                      category = 'property';
                      icon = '🏢';
                      currentAction = (currentAction % 3) + 1;
                    } else if (msg.includes('Hayır') || msg.includes('engelledi') || msg.includes('savundu') || msg.includes('Reddet')) {
                      category = 'defense';
                      icon = '🛡️';
                    } else if (msg.includes('sinsi') || msg.includes('Takas') || msg.includes('çaldı') || msg.includes('oynadı') || msg.includes('kartını attı')) {
                      category = 'action';
                      icon = '⚡';
                      currentAction = (currentAction % 3) + 1;
                    } else {
                      category = 'system';
                      icon = 'ℹ️';
                    }

                    return {
                      id: log.id,
                      message: log.message,
                      timestamp: log.timestamp,
                      playerName: log.playerName,
                      turnNumber: Math.max(1, currentTurn),
                      actionNumber: category !== 'system' ? Math.max(1, currentAction) : undefined,
                      category,
                      icon
                    };
                  });
                };

                const enrichedAll = parseEnrichedLogs(match.logs).reverse();
                const filtered = enrichedAll.filter((item) => {
                  if (chatFilter === 'actions') return item.category !== 'chat';
                  if (chatFilter === 'chat') return item.category === 'chat';
                  return true;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="py-8 text-center text-slate-500 text-[10px] font-bold">
                      {profile.settings.language === 'en' ? 'No events found.' : 'Henüz bir olay yok.'}
                    </div>
                  );
                }

                return filtered.map((log) => {
                  const timeStr = new Date(log.timestamp).toLocaleTimeString('tr-TR', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  });

                  const styleMap = {
                    rent: 'bg-emerald-950/40 border-emerald-500/35 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.12)]',
                    property: 'bg-blue-950/40 border-blue-500/35 text-blue-200 shadow-[0_0_12px_rgba(59,130,246,0.12)]',
                    action: 'bg-amber-950/40 border-amber-500/35 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.12)]',
                    defense: 'bg-indigo-950/40 border-indigo-500/35 text-indigo-200 shadow-[0_0_12px_rgba(99,102,241,0.12)]',
                    turn: 'bg-purple-950/50 border-purple-500/40 text-purple-200 shadow-[0_0_12px_rgba(168,85,247,0.15)]',
                    chat: 'bg-slate-950/80 border-slate-750 text-slate-200',
                    system: 'bg-slate-900/60 border-white/10 text-slate-300'
                  };

                  return (
                    <div
                      key={log.id}
                      className={`p-2.5 rounded-2xl border ${styleMap[log.category]} transition-all flex flex-col gap-1 text-[10.5px] select-none relative overflow-hidden`}
                    >
                      {/* Header metadata row */}
                      <div className="flex items-center justify-between text-[8px] font-black border-b border-white/10 pb-1 mb-0.5">
                        <div className="flex items-center gap-1">
                          <span className="bg-purple-500/25 text-purple-300 border border-purple-500/40 px-1.5 py-0.2 rounded font-mono font-bold">
                            TUR {log.turnNumber}
                          </span>
                          {log.actionNumber && (
                            <span className="bg-amber-500/25 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 rounded font-mono font-bold">
                              HAMLE {log.actionNumber}/3
                            </span>
                          )}
                          <span className="text-slate-300 font-mono text-[9px] ml-0.5">{log.icon}</span>
                        </div>
                        <span className="text-slate-400 font-mono text-[8px]">{timeStr}</span>
                      </div>

                      {/* Log message content */}
                      {log.playerName ? (
                        <div className="flex items-start gap-1">
                          <strong className="text-amber-400 font-black shrink-0">
                            💬 {log.playerName}:
                          </strong>
                          <span className="text-slate-200 leading-snug break-words">{translateLogMessage(log.message, profile)}</span>
                        </div>
                      ) : (
                        <p className="font-bold leading-snug break-words text-slate-200">
                          {translateLogMessage(log.message, profile)}
                        </p>
                      )}
                    </div>
                  );
                });
              })()}
            </div>

            {/* Quick Emojis Grid */}
            <div className="grid grid-cols-6 gap-2 py-2 mt-2 border-t border-white/5 flex-shrink-0">
              {['😂', '😭', '😠', '👍', '🎉', '😮', '💩', '❤️', '🔥', '💸', '🎲', '👑'].map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    playPlaySound();
                    if (!isOffline && socketRef.current?.readyState === WebSocket.OPEN) {
                      socketRef.current.send(JSON.stringify({ type: 'trigger_emoji', userId: profile.id, roomId, emoji }));
                    } else {
                      triggerFloatingEmoji(emoji, profile.username);
                    }
                  }}
                  className="h-10 text-xl bg-white/5 active:bg-white/10 border border-white/5 rounded-xl flex items-center justify-center transition-all transform active:scale-90 cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>

            <form onSubmit={handleSendChat} className="mt-1 flex gap-1.5 flex-shrink-0">
              <input
                type="text"
                placeholder={t('chat_placeholder', profile)}
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-white focus:outline-none focus:border-purple-500"
              />
              <button
                type="submit"
                className="bg-purple-600 hover:bg-purple-500 text-white font-extrabold px-3 py-1.5 rounded-lg text-[10px] transition-all transform active:scale-95 cursor-pointer"
              >
                {t('send_btn', profile)}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 7. Card Draw Animation Overlay */}
      <AnimatePresence>
        {animatingDrawCards.map((draw) => (
          <motion.div
            key={draw.id}
            initial={{ x: '0vw', y: '0vh', scale: 0.3, rotate: 0, opacity: 0 }}
            animate={{
              x: '0vw', // glides from center deck area
              y: '40vh', // down to the player's hand area
              scale: 1,
              rotate: 360,
              opacity: [0, 1, 1, 0],
            }}
            transition={{
              duration: 0.8,
              delay: draw.delay,
              ease: 'easeInOut',
            }}
            onAnimationComplete={() => {
              // remove card after completion
              setAnimatingDrawCards((prev) => prev.filter((d) => d.id !== draw.id));
            }}
            className="fixed inset-0 m-auto w-20 h-32 rounded-xl shadow-2xl border-2 border-amber-400 pointer-events-none z-50 flex items-center justify-center font-bold text-lg select-none"
            style={{
              background: cardBackBg,
              color: '#fff',
            }}
          >
            <div className="text-center">
              <span className="block text-2xl mb-1">{cardBackPattern}</span>
              <span className="text-[10px] tracking-wider uppercase font-black">Kart</span>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* 8. Action Toast Notification Overlay */}
      <AnimatePresence>
        {actionToast && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9, x: '-50%' }}
            animate={{ opacity: 1, y: actionToastY, scale: 1, x: '-50%' }}
            exit={{ opacity: 0, y: -20, scale: 0.95, x: '-50%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            className={`fixed top-16 left-1/2 w-[90vw] max-w-sm bg-slate-950/80 border backdrop-blur-lg rounded-2xl p-3 shadow-[0_20px_50px_rgba(0,0,0,0.8)] z-50 pointer-events-auto flex flex-col gap-2 transition-colors duration-300 ${actionToast.type === 'rent'
              ? 'border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.1)]'
              : actionToast.type === 'info'
                ? 'border-indigo-500/30 shadow-[0_0_20px_rgba(99,102,241,0.1)]'
                : 'border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.1)]'
              }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 select-none ${actionToast.type === 'rent'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : actionToast.type === 'info'
                    ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}>
                  {actionToast.type === 'rent' ? '💰' : actionToast.type === 'info' ? 'ℹ️' : '⚡'}
                </div>
                <div>
                  <h4 className="font-extrabold text-[11px] text-white uppercase tracking-wider">{actionToast.title}</h4>
                  <p className="text-[10px] text-slate-300 mt-0.5 leading-snug">{actionToast.message}</p>
                </div>
              </div>
              <button
                onClick={() => setActionToast(null)}
                className="text-slate-400 hover:text-white font-black text-xs p-1 cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {actionToast.victimName && (
              <div className="bg-black/50 border border-white/5 rounded-xl p-2 flex flex-col gap-1 text-[10px] select-none">
                <div className="flex items-center justify-between border-b border-white/5 pb-0.5">
                  <div className="flex items-center gap-1">
                    <span className="text-xs">👤</span>
                    <span className="font-extrabold text-slate-300 truncate max-w-[150px]">
                      {actionToast.victimName}
                    </span>
                  </div>
                  <span className="text-[9px] text-slate-400 font-medium">
                    {profile.settings.language === 'en' ? 'Remaining Status' : 'Kalan Durum'}
                  </span>
                </div>
                <div className="flex justify-around gap-2 text-[9px] font-mono font-bold pt-0.5">
                  <span className="text-amber-400 bg-amber-400/5 px-2 py-0.2 rounded border border-amber-400/10">
                    💵 {profile.settings.language === 'en' ? 'Cash:' : 'Para:'} {actionToast.remainingCash}M
                  </span>
                  <span className="text-emerald-400 bg-emerald-400/5 px-2 py-0.2 rounded border border-emerald-400/10">
                    🏢 {profile.settings.language === 'en' ? 'Props:' : 'Mülk:'} {actionToast.remainingPropsCount}
                  </span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 9. Career Statistics Overlay Modal */}
      {showCareerPanel && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800/85 rounded-3xl p-6 w-full max-w-sm space-y-5 shadow-2xl relative animate-scale-up">
            <button
              onClick={() => {
                playPlaySound();
                setShowCareerPanel(false);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white font-black text-sm p-1"
            >
              ✕ Kapat
            </button>

            <div className="text-center space-y-1">
              <span className="text-2xl block animate-bounce">🏆</span>
              <h3 className="text-sm font-black text-amber-400 uppercase tracking-wider">Kariyer İstatistikleri</h3>
              <p className="text-[10px] text-slate-400">Mono Deal Genel İlerleme Geçmişiniz</p>
            </div>

            <div className="space-y-3">
              <div className="bg-slate-950/60 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">Kazanılan Maçlar</span>
                  <span className="text-xl font-black text-emerald-400">{careerStats.wins} Maç</span>
                </div>
                <span className="text-2xl">🥇</span>
              </div>

              <div className="bg-slate-950/60 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">İflas Ettirilen Rakipler</span>
                  <span className="text-xl font-black text-rose-400">{careerStats.bankruptcies} Oyuncu</span>
                </div>
                <span className="text-2xl">💀</span>
              </div>

              <div className="bg-slate-950/60 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">Toplanan Toplam Kira</span>
                  <span className="text-xl font-black text-amber-400">{careerStats.rentCollected}M</span>
                </div>
                <span className="text-2xl">💵</span>
              </div>
            </div>

            <button
              onClick={() => {
                playPlaySound();
                setShowCareerPanel(false);
              }}
              className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-yellow-600 hover:opacity-90 text-slate-950 font-black rounded-xl text-xs transition-all shadow-lg"
            >
              Masa Başına Dön!
            </button>
          </div>
        </div>
      )}

      {/* 10. PROPERTY WILDCARD COLOR SWITCH MODAL (Mülk Rengini Değiştir) */}
      {isMyTurn && propertyWildcardColorPick && (
        <div id="context-aware-interaction-panel" className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800/85 rounded-3xl p-5 w-full max-w-sm space-y-4 shadow-2xl relative animate-scale-up max-h-[90vh] overflow-y-auto scrollbar-thin">
            <button
              onClick={() => {
                playPlaySound();
                setPropertyWildcardColorPick(null);
              }}
              className="absolute top-4 right-4 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-lg w-7 h-7 flex items-center justify-center font-bold text-xs shadow transition-all border border-white/5"
            >
              ✕
            </button>

            <div className="flex items-center gap-2 border-b border-white/5 pb-3">
              <span className="text-xl">🔄</span>
              <div>
                <h3 className="font-black text-sm text-yellow-500 uppercase tracking-wider">
                  Mülk Rengini Değiştir
                </h3>
              </div>
            </div>

            {/* Card preview in the middle */}
            <div className="flex justify-center py-1">
              <div className="shadow-[0_0_20px_rgba(234,179,8,0.25)] rounded-2xl overflow-hidden">
                <GameCard card={propertyWildcardColorPick} size="normal" activeEffect={cardEffects[propertyWildcardColorPick.id] || null} disable3D={disable3D} cardBack={profile.settings.cardBack} cardSkin={profile.settings.cardSkin || 'skin_none'} />
              </div>
            </div>

            <div className="text-[10px] text-slate-300 leading-normal text-center">
              Bu kart şu anda <span className="underline font-black text-blue-400">{COLOR_LABELS[propertyWildcardColorPick.color || 'brown']}</span> grubunda. Çevirmek istediğiniz yeni rengi seçin:
            </div>

            {/* List of allowed colors */}
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
              {(() => {
                const possibleColors: CardColor[] = [];
                if (propertyWildcardColorPick.allowedColors && propertyWildcardColorPick.allowedColors.length > 0) {
                  possibleColors.push(...propertyWildcardColorPick.allowedColors);
                } else {
                  if (propertyWildcardColorPick.color) {
                    possibleColors.push(propertyWildcardColorPick.color);
                  }
                  if (propertyWildcardColorPick.secondaryColor && propertyWildcardColorPick.secondaryColor !== propertyWildcardColorPick.color) {
                    possibleColors.push(propertyWildcardColorPick.secondaryColor);
                  }
                }

                // Sort colors: colors where player owns property come FIRST at the top!
                possibleColors.sort((a, b) => {
                  const countA = localPlayer.properties[a]?.cards.length || 0;
                  const countB = localPlayer.properties[b]?.cards.length || 0;
                  if (countA > 0 && countB === 0) return -1;
                  if (countA === 0 && countB > 0) return 1;
                  return countB - countA;
                });

                return possibleColors.map((col) => {
                  const isCurrent = propertyWildcardColorPick.color === col;
                  const rents = RENT_VALUES[col] || [];

                  return (
                    <div
                      key={col}
                      onClick={() => {
                        if (isCurrent) return;
                        playPlaySound();
                        if (isOffline) {
                          handleOfflineChangeWildcardColor(propertyWildcardColorPick.id, col);
                        } else {
                          handleChangeWildcardColorMultiplayer(propertyWildcardColorPick.id, col);
                        }
                        setPropertyWildcardColorPick(null);
                      }}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col space-y-1.5 ${isCurrent
                        ? 'border-yellow-500 bg-yellow-500/[0.04] shadow-[0_0_12px_rgba(234,179,8,0.15)] animate-pulse'
                        : 'border-white/5 bg-slate-950/40 hover:border-white/20 hover:bg-slate-900/60'
                        }`}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${isCurrent ? 'border-yellow-500' : 'border-slate-600'
                            }`}>
                            {isCurrent && (
                              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLOR_HEX[col] }} />
                            )}
                          </div>
                          <span className="font-bold text-[10px] text-white flex items-center gap-1.5 flex-wrap">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLOR_HEX[col] }} />
                            {COLOR_LABELS[col]}
                            {(() => {
                              const count = localPlayer.properties[col]?.cards.length || 0;
                              const max = MAX_IN_SET[col] || 0;
                              return (
                                <span className={`text-[7.5px] px-1 py-0.2 rounded font-black ${count === max && max > 0
                                  ? 'bg-emerald-500/15 text-emerald-400'
                                  : count > 0
                                    ? 'bg-amber-500/15 text-amber-400'
                                    : 'bg-slate-850 text-slate-500'
                                  }`}>
                                  {count > 0 ? `${count}/${max} Kartınız Var` : 'Sizde Yok'}
                                </span>
                              );
                            })()}
                          </span>
                        </div>

                        {isCurrent && (
                          <span className="bg-yellow-500 text-slate-950 text-[6.5px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
                            AKTİF GRUP
                          </span>
                        )}
                      </div>

                      {/* Rent details */}
                      <div className="bg-black/30 px-2 py-1 rounded-lg flex flex-wrap gap-x-2 gap-y-0.5 text-[7.5px] font-bold text-slate-400">
                        {rents.map((rentVal, idx) => (
                          <span key={idx}>
                            {idx + 1} Kart: <strong className="text-white">{rentVal}M</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Touch Drag Card Floating Preview */}
      {isTouchDragging && touchPosition && touchDragCard && (
        <div
          id={`touch-drag-preview-${touchDragCard.id}`}
          className="fixed pointer-events-none z-[9999] opacity-90 scale-105 shadow-2xl"
          style={{
            left: touchPosition.x - 57,
            top: touchPosition.y - 85,
          }}
        >
          <GameCard card={touchDragCard} size="normal" />
        </div>
      )}

      {/* Just Say No / Shield Defense Energy Dome Animation Overlay (Improvement #9) */}
      {shouldShowShieldDefenseOverlay() && (
        <div className="fixed inset-0 bg-indigo-950/40 backdrop-blur-[2px] z-[9999] flex flex-col items-center justify-center pointer-events-none animate-fade-in">
          <div className="relative flex flex-col items-center justify-center">
            {/* Glowing outer rotating energy rings */}
            <div className="absolute w-44 h-44 rounded-full border-4 border-indigo-500/20 border-t-indigo-400 border-b-cyan-400 animate-spin" />
            <div className="absolute w-36 h-36 rounded-full border-2 border-dashed border-purple-500/30 border-l-pink-400 border-r-indigo-400 animate-spin-reverse" />

            {/* Safe Shield Core Icon */}
            <div className="w-24 h-24 rounded-full bg-gradient-to-b from-indigo-600 to-indigo-900 border-2 border-indigo-400/80 flex items-center justify-center shadow-[0_0_40px_rgba(99,102,241,0.8)] animate-pulse z-10">
              <span className="text-4xl">🛡️</span>
            </div>

            {/* Glowing shield wall aura */}
            <div className="absolute w-52 h-52 rounded-full bg-radial from-indigo-500/10 via-indigo-500/5 to-transparent animate-ping" />

            <div className="mt-8 text-center z-10 bg-slate-950/90 border border-indigo-500/30 px-5 py-2.5 rounded-2xl shadow-xl backdrop-blur-md">
              <span className="text-[10px] font-black tracking-widest text-indigo-400 block uppercase">HAYIR TEŞEKKÜRLER!</span>
              <h4 className="text-sm font-bold text-white mt-1">
                <span className="text-indigo-300">{showShieldDefenseFor}</span> Saldırıyı Engelledi!
              </h4>
            </div>
          </div>
        </div>
      )}

      {/* Deal Breaker Lightning Bolt Special Animation Overlay (Improvement #19) */}
      {shouldShowDealBreakerOverlay() && showDealBreakerAnimation && (
        <div className="fixed inset-0 bg-yellow-500/10 backdrop-blur-[1px] z-[9999] flex flex-col items-center justify-center pointer-events-none animate-fade-in">
          <div className="relative flex flex-col items-center justify-center w-full h-full overflow-hidden">
            {/* Split Screen Flash effect */}
            <div className="absolute inset-x-0 top-0 h-1/2 bg-yellow-500/[0.05] animate-pulse" />
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-indigo-500/[0.05] animate-pulse" />

            {/* Lightning bolt vectors */}
            <div className="absolute top-0 bottom-0 w-2 bg-gradient-to-b from-yellow-400 via-amber-300 to-indigo-500 blur-sm shadow-[0_0_50px_#f59e0b] animate-bounce-subtle" />
            <div className="absolute top-0 bottom-0 w-1 bg-white animate-pulse" />

            {/* Crackling sparks around center */}
            <div className="absolute w-64 h-64 rounded-full border border-yellow-500/30 scale-110 animate-ping" />
            <div className="absolute w-48 h-48 rounded-full border-2 border-indigo-400/20 scale-75 animate-ping" style={{ animationDelay: '0.4s' }} />

            {/* Dramatic banner */}
            <div className="z-10 bg-slate-950/95 border-2 border-yellow-500/50 p-6 rounded-3xl shadow-[0_15px_45px_rgba(245,158,11,0.4)] text-center max-w-sm backdrop-blur-md animate-scale-up">
              <span className="text-[10px] font-black tracking-widest text-yellow-400 block uppercase animate-pulse">⚡ {profile.settings.language === 'en' ? 'DEAL BREAKER' : 'ANLAŞMA BOZAN'} ⚡</span>
              <h4 className="text-lg font-black text-white mt-3 leading-tight">
                {showDealBreakerAnimation.source}
              </h4>
              <p className="text-xs text-slate-400 mt-1">{profile.settings.language === 'en' ? 'unleashed a deal breaker!' : 'adlı oyuncu dehşet saçtı!'}</p>

              <div className="my-4 p-2 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center gap-2">
                <span className="w-3 h-3 rounded-full animate-ping" style={{ backgroundColor: COLOR_HEX[showDealBreakerAnimation.color] }} />
                <span className="text-xs font-black text-white uppercase" style={{ color: COLOR_HEX[showDealBreakerAnimation.color] }}>
                  {getTranslatedColorLabel(showDealBreakerAnimation.color, profile).toUpperCase()} {profile.settings.language === 'en' ? 'SET STOLEN!' : 'SETİ ÇALINDI!'}
                </span>
              </div>

              <p className="text-[10px] text-slate-400 leading-normal">
                {profile.settings.language === 'en' ? (
                  <span>Completed property set was forcefully taken from player <strong>{showDealBreakerAnimation.target}</strong>!</span>
                ) : (
                  <span>{showDealBreakerAnimation.target} adlı oyuncunun tamamlanmış mülk seti elinden zorla söküldü!</span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 5. Floating Rent Analysis Panel (Kira Analiz Penceresi - Follows Mouse) */}
      <AnimatePresence>
        {analyzedProperty && !expandedPropertyColor && (() => {
          const { color, ownerName, cardsCount, hasHouse, hasHotel, currentRent } = analyzedProperty;
          const rents = RENT_VALUES[color] || [];
          const maxInSet = MAX_IN_SET[color] || 0;
          const hexColor = COLOR_HEX[color] || '#34d399';

          // Calculate max potential rent for this set
          const maxStandardRent = rents[rents.length - 1] || 0;
          const potentialMaxRent = maxStandardRent + (hasHotel ? 4 : (hasHouse ? 3 : 0));

          // Calculate responsive bounding box position
          let leftPos = mousePos.x + 15;
          let topPos = mousePos.y + 15;
          const panelWidth = 256;
          const panelHeight = 220;

          if (leftPos + panelWidth > window.innerWidth) {
            leftPos = mousePos.x - panelWidth - 15;
          }
          if (topPos + panelHeight > window.innerHeight) {
            topPos = mousePos.y - panelHeight - 15;
          }

          leftPos = Math.max(10, Math.min(window.innerWidth - panelWidth - 10, leftPos));
          topPos = Math.max(10, Math.min(window.innerHeight - panelHeight - 10, topPos));

          return (
            <>
              {/* Tap Outside Backdrop on mobile */}
              <div
                className="fixed inset-0 z-[9998] bg-black/5 cursor-pointer sm:hidden"
                onClick={() => setAnalyzedProperty(null)}
                onTouchStart={() => setAnalyzedProperty(null)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={() => setAnalyzedProperty(null)}
                className="fixed z-[9999] w-64 bg-slate-950/95 border border-white/10 rounded-2xl p-4 shadow-2xl backdrop-blur-md text-white select-none pointer-events-auto cursor-pointer"
                style={{
                  left: `${leftPos}px`,
                  top: `${topPos}px`,
                }}
              >
                <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px]">📊</span>
                    <h4 className="font-extrabold text-[10px] tracking-wider uppercase text-slate-300">{profile.settings.language === 'en' ? 'Rent Analysis Panel' : 'Kira Analiz Paneli'}</h4>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setAnalyzedProperty(null);
                    }}
                    className="w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 text-[10px] font-bold flex items-center justify-center transition-colors cursor-pointer"
                    title="Kapat"
                  >
                    ✕
                  </button>
                </div>

              <div className="space-y-3">
                {/* Title and Color Tag */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-black text-xs text-white block leading-tight">{getTranslatedColorLabel(color, profile)} {profile.settings.language === 'en' ? 'Set' : 'Seti'}</span>
                    <span className="text-[8px] text-slate-400 block mt-0.5">{profile.settings.language === 'en' ? `On player ${ownerName}'s board` : `${ownerName} adlı oyuncunun masasında`}</span>
                  </div>
                  <span className="w-5 h-5 rounded-full border border-white/20 shadow" style={{ backgroundColor: hexColor }} />
                </div>

                {/* Progress Mini Meter */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[8px] font-bold text-slate-400">
                    <span>{profile.settings.language === 'en' ? 'Card Progress:' : 'Kart İlerlemesi:'}</span>
                    <span className="text-white">{cardsCount}/{maxInSet}</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, (cardsCount / maxInSet) * 100)}%`,
                        backgroundColor: hexColor,
                      }}
                    />
                  </div>
                </div>

                {/* Rent values steps */}
                <div className="space-y-1 bg-black/30 p-2 rounded-lg">
                  <span className="text-[7.5px] font-black text-slate-400 uppercase tracking-wide block">{profile.settings.language === 'en' ? 'Rent Scales' : 'Kira Baremleri'}</span>
                  <div className="space-y-1">
                    {rents.map((r, idx) => {
                      const isActive = cardsCount === (idx + 1);
                      return (
                        <div
                          key={idx}
                          className={`flex items-center justify-between text-[8.5px] px-1.5 py-0.5 rounded transition-all ${isActive
                            ? 'bg-emerald-500/15 text-emerald-300 font-extrabold border border-emerald-500/20'
                            : 'text-slate-400 font-medium'
                            }`}
                        >
                          <span className="flex items-center gap-1">
                            {isActive && <span className="text-[8px]">👉</span>}
                            {idx + 1} {t('cards_count', profile)}
                          </span>
                          <span>{r}M</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Houses and Hotels */}
                <div className="flex justify-between items-center text-[8.5px] px-1">
                  <span className="text-slate-400 font-bold">{profile.settings.language === 'en' ? 'House / Hotel Bonus:' : 'Ev / Otel İlavesi:'}</span>
                  <div className="flex gap-1.5 font-extrabold">
                    <span className={hasHouse ? 'text-amber-400' : 'text-slate-600'}>🏡 {profile.settings.language === 'en' ? 'House' : 'Ev'} {hasHouse ? '(+3M)' : ''}</span>
                    <span className={hasHotel ? 'text-amber-400' : 'text-slate-600'}>🏨 {profile.settings.language === 'en' ? 'Hotel' : 'Otel'} {hasHotel ? '(+4M)' : ''}</span>
                  </div>
                </div>

                {/* Rent Summary Box */}
                <div className="bg-slate-900 border border-white/5 p-2 rounded-xl flex items-center justify-between shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)]">
                  <div>
                    <span className="text-[7px] text-slate-500 block font-extrabold uppercase leading-none">{profile.settings.language === 'en' ? 'Current Rent' : 'Mevcut Kira'}</span>
                    <span className="text-emerald-400 font-black text-sm font-mono block mt-0.5">{currentRent}M</span>
                  </div>
                  <div className="h-6 w-[1px] bg-white/10" />
                  <div className="text-right">
                    <span className="text-[7px] text-slate-500 block font-extrabold uppercase leading-none">{profile.settings.language === 'en' ? 'Potential Max' : 'Potansiyel Maks'}</span>
                    <span className="text-amber-400 font-black text-sm font-mono block mt-0.5">{rents[rents.length - 1] + (hasHotel ? 4 : (hasHouse ? 3 : 0))}M</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
          );
        })()}
      </AnimatePresence>

      {/* 11. Central Action Card Showcase Overlay */}
      <AnimatePresence>
        {showcaseCard && (() => {
          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={skipShowcase}
              className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-[10000] flex flex-col items-center justify-center pointer-events-auto cursor-pointer overflow-hidden select-none"
            >
              {/* Clean, simple card display in the center */}
              <div className="relative flex flex-col items-center gap-6 max-w-sm px-4">
                <motion.div
                  initial={{ scale: 0.85, opacity: 0, y: 15 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.85, opacity: 0, y: 15 }}
                  transition={{ type: "spring", stiffness: 260, damping: 25 }}
                  className="shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-2xl p-1 bg-slate-900/40 border border-white/5"
                >
                  <GameCard
                    card={showcaseCard.card}
                    size="normal"
                    disable3D={true}
                    cardBack={profile.settings.cardBack}
                    cardSkin={profile.settings.cardSkin || 'skin_none'}
                  />
                </motion.div>

                {/* Minimalist translation label */}
                <div className="text-center space-y-1 mt-2">
                  <h3 className="text-sm font-black text-slate-100">
                    {translateLogMessage(showcaseCard.card.name, profile)}
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400">
                    {(() => {
                      const lastLog = match?.logs[match.logs.length - 1];
                      if (lastLog && (
                        lastLog.message.includes(showcaseCard.playerName) || 
                        lastLog.message.includes(translateLogMessage(showcaseCard.card.name, profile))
                      )) {
                        return translateLogMessage(lastLog.message, profile);
                      }
                      return profile.settings.language === 'en'
                        ? `${showcaseCard.playerName} played this card.`
                        : `${showcaseCard.playerName} bu kartı oynadı.`;
                    })()}
                  </p>
                  <p className="text-[9px] font-medium text-slate-500 pt-1">
                    {profile.settings.language === 'en' ? 'Tap anywhere to skip' : 'Geçmek için dokunun'}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* 10. Flying Cards Animation Portal overlay */}
      {flyingCards.map((fc) => (
        <motion.div
          key={fc.id}
          initial={{
            position: 'fixed',
            left: 0,
            top: 0,
            x: fc.startX,
            y: fc.startY,
            scale: 0.5,
            opacity: 0.6,
            zIndex: 99999,
            pointerEvents: 'none',
          }}
          animate={{
            x: fc.endX,
            y: fc.endY,
            scale: [0.5, 0.9, 0.7],
            opacity: 1,
          }}
          transition={{
            duration: 0.6,
            ease: 'easeInOut',
          }}
          className="-translate-x-1/2 -translate-y-1/2"
        >
          <div className="shadow-[0_10px_25px_rgba(0,0,0,0.5)] scale-[0.6] origin-center">
            <GameCard card={fc.card} size="medium" disable3D={true} cardBack={profile.settings.cardBack} cardSkin={profile.settings.cardSkin || 'skin_none'} />
          </div>
        </motion.div>
      ))}

      {/* ═══════════════════════════════════════════════════════════
          FAZLA KART AT MODALI — Discard Excess Cards Modal
          Mobil dostu: Tüm kartlar büyük buton olarak, tek dokunuşla at
          ═══════════════════════════════════════════════════════════ */}
      {showDiscardModal && localPlayer.hand.length > 7 && (() => {
        const excessCount = localPlayer.hand.length - 7;
        const sortedHand = [...localPlayer.hand].sort((a, b) => {
          // Money cards first (easiest to discard), then actions, then properties
          const order = { money: 0, action: 1, rent: 1, 'house-hotel': 1, property: 2, wildcard: 2 };
          return (order[a.type as keyof typeof order] ?? 3) - (order[b.type as keyof typeof order] ?? 3);
        });
        return (
          <div
            onClick={() => setShowDiscardModal(false)}
            className="fixed inset-0 bg-slate-950/90 z-[200] flex flex-col justify-end sm:justify-center sm:items-center sm:p-4 animate-fade-in"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 border-t sm:border border-white/10 sm:rounded-3xl w-full sm:max-w-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative max-h-[85vh] flex flex-col"
            >

              {/* Top accent line */}
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-rose-500 via-red-500 to-rose-500 rounded-t-3xl" />

              {/* Grab handle (mobile only) */}
              <div className="w-10 h-1 bg-slate-700/60 rounded-full mx-auto mt-3 mb-1 sm:hidden shrink-0" />

              {/* Header */}
              <div className="px-5 py-3 border-b border-white/10 shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-rose-400 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                      ⚡ {profile.settings.language === 'en' ? 'Discard Excess Cards' : 'Fazla Kartları At'}
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5 font-bold">
                      {profile.settings.language === 'en'
                        ? `Hand limit is 7 cards. You must discard ${excessCount} more card${excessCount > 1 ? 's' : ''}.`
                        : `El limiti 7 karttır. ${excessCount} kart daha atman gerekiyor.`
                      }
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Remaining to discard badge */}
                    <div className="bg-rose-500/20 border border-rose-500/40 rounded-xl px-3 py-1 text-center min-w-[68px]">
                      <span className="text-lg font-black text-rose-400 leading-none block">{excessCount}</span>
                      <span className="text-[8px] text-rose-300 font-black uppercase tracking-wide leading-none">
                        {profile.settings.language === 'en' ? 'to discard' : 'atılacak'}
                      </span>
                    </div>
                    <button
                      onClick={() => setShowDiscardModal(false)}
                      className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-colors text-xs font-black"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Progress bar: how many to discard */}
                <div className="mt-2.5 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-rose-500 rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(244,63,94,0.6)]"
                    style={{ width: `${(7 / localPlayer.hand.length) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-slate-400 mt-1 font-black">
                  <span>{profile.settings.language === 'en' ? 'Target: 7 cards' : 'Hedef: 7 kart'}</span>
                  <span>{profile.settings.language === 'en' ? `Currently: ${localPlayer.hand.length}` : `Şu an: ${localPlayer.hand.length}`}</span>
                </div>
              </div>

              {/* Cards Grid — compact bento design */}
              <div className="overflow-y-auto flex-1 p-4">
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                  {sortedHand.map((card) => {
                    const isLand = card.type === 'property' || card.type === 'wildcard';
                    const colorHex = isLand && card.color ? COLOR_HEX[card.color as CardColor] : null;

                    return (
                      <button
                        key={card.id}
                        onClick={() => {
                          playCardDiscardSound();
                          if (isOffline) handleOfflineDiscard(card.id);
                          else handleDiscardMultiplayer(card.id);
                        }}
                        className="relative flex flex-col items-center justify-between p-2 rounded-2xl border transition-all hover:scale-[1.03] active:scale-95 cursor-pointer group select-none overflow-hidden bg-slate-950/80 border-slate-750 hover:border-rose-500/80 shadow-md"
                        title={card.name}
                      >
                        {/* Mini Land Color Strip if Property/Wildcard */}
                        {colorHex && (
                          <div className="absolute top-0 inset-x-0 h-1.5" style={{ backgroundColor: colorHex }} />
                        )}

                        {/* Mini Card container */}
                        <div className="transform scale-[0.9] group-hover:scale-[0.95] transition-transform duration-200 mt-1">
                          <GameCard card={card} size="mini" activeEffect={null} disable3D={true} cardBack={profile.settings.cardBack} cardSkin={profile.settings.cardSkin || 'skin_none'} />
                        </div>

                        {/* Name and Discard trigger */}
                        <div className="w-full mt-1.5 text-center flex flex-col items-center gap-0.5">
                          <div className="text-[9px] font-black text-slate-200 truncate w-full px-0.5 leading-none uppercase">
                            {getTranslatedCardName(card, profile)}
                          </div>
                          
                          <div className="text-[8px] font-black text-amber-300 bg-amber-950/60 border border-amber-500/30 px-1.5 py-0.5 rounded-md leading-none mt-0.5">
                            {card.value}M
                          </div>
                        </div>

                        {/* Red "AT" Quick Action block */}
                        <div className="w-full mt-2 py-1.5 bg-rose-500/20 group-hover:bg-rose-600 text-rose-300 group-hover:text-white rounded-xl text-[9px] font-black text-center tracking-wider transition-all duration-150 leading-none border border-rose-500/30">
                          {profile.settings.language === 'en' ? 'DISCARD' : 'AT'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Footer */}
              <div className="px-4 pb-4 pt-2 border-t border-white/10 shrink-0">
                <button
                  onClick={() => setShowDiscardModal(false)}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer border border-slate-700/60 shadow-md"
                >
                  {profile.settings.language === 'en' ? 'Close' : 'Kapat'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
};
