import { Card, CardColor, CardType, GamePlayer } from '../types';

export const COLOR_LABELS: Record<CardColor, string> = {
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

export const COLOR_HEX: Record<CardColor, string> = {
  brown: '#795548',
  lightblue: '#29B6F6',
  pink: '#EC407A',
  orange: '#FF9800',
  red: '#EF5350',
  yellow: '#FFEE58',
  green: '#4CAF50',
  darkblue: '#1A237E',
  railroad: '#37474F',
  utility: '#827717',
};

export const RENT_VALUES: Record<CardColor, number[]> = {
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

export const MAX_IN_SET: Record<CardColor, number> = {
  brown: 2,
  lightblue: 3,
  pink: 3,
  orange: 3,
  red: 3,
  yellow: 3,
  green: 3,
  darkblue: 2,
  railroad: 4,
  utility: 2,
};

// Generates a full standard Deal Master PRO Deal deck (106 cards)
export function generateDeck(): Card[] {
  const deck: Omit<Card, 'id'>[] = [];

  // 1. Money Cards
  // 10M x1
  deck.push({
    type: 'money',
    name: '10M Para',
    value: 10,
    description: 'Banka kasasına 10 Milyon değerinde para ekler.',
  });
  // 5M x2
  for (let i = 0; i < 2; i++) {
    deck.push({
      type: 'money',
      name: '5M Para',
      value: 5,
      description: 'Banka kasasına 5 Milyon değerinde para ekler.',
    });
  }
  // 4M x3
  for (let i = 0; i < 3; i++) {
    deck.push({
      type: 'money',
      name: '4M Para',
      value: 4,
      description: 'Banka kasasına 4 Milyon değerinde para ekler.',
    });
  }
  // 3M x3
  for (let i = 0; i < 3; i++) {
    deck.push({
      type: 'money',
      name: '3M Para',
      value: 3,
      description: 'Banka kasasına 3 Milyon değerinde para ekler.',
    });
  }
  // 2M x5
  for (let i = 0; i < 5; i++) {
    deck.push({
      type: 'money',
      name: '2M Para',
      value: 2,
      description: 'Banka kasasına 2 Milyon değerinde para ekler.',
    });
  }
  // 1M x6
  for (let i = 0; i < 6; i++) {
    deck.push({
      type: 'money',
      name: '1M Para',
      value: 1,
      description: 'Banka kasasına 1 Milyon değerinde para ekler.',
    });
  }

  // 2. Standard Property Cards
  const properties: { color: CardColor; name: string; value: number }[] = [
    // Brown (2 cards)
    { color: 'brown', name: 'Baltic Avenue', value: 1 },
    { color: 'brown', name: 'Mediterranean Avenue', value: 1 },
    // Dark Blue (2 cards)
    { color: 'darkblue', name: 'Boardwalk', value: 4 },
    { color: 'darkblue', name: 'Park Place', value: 4 },
    // Light Blue (3 cards)
    { color: 'lightblue', name: 'Connecticut Avenue', value: 1 },
    { color: 'lightblue', name: 'Vermont Avenue', value: 1 },
    { color: 'lightblue', name: 'Oriental Avenue', value: 1 },
    // Pink (3 cards)
    { color: 'pink', name: 'Virginia Avenue', value: 2 },
    { color: 'pink', name: 'States Avenue', value: 2 },
    { color: 'pink', name: 'St. Charles Place', value: 2 },
    // Orange (3 cards)
    { color: 'orange', name: 'New York Avenue', value: 2 },
    { color: 'orange', name: 'Tennessee Avenue', value: 2 },
    { color: 'orange', name: 'St. James Place', value: 2 },
    // Red (3 cards)
    { color: 'red', name: 'Kentucky Avenue', value: 3 },
    { color: 'red', name: 'Indiana Avenue', value: 3 },
    { color: 'red', name: 'Illinois Avenue', value: 3 },
    // Yellow (3 cards)
    { color: 'yellow', name: 'Marvin Gardens', value: 3 },
    { color: 'yellow', name: 'Ventnor Avenue', value: 3 },
    { color: 'yellow', name: 'Atlantic Avenue', value: 3 },
    // Green (3 cards)
    { color: 'green', name: 'North Carolina Avenue', value: 4 },
    { color: 'green', name: 'Pacific Avenue', value: 4 },
    { color: 'green', name: 'Pennsylvania Avenue', value: 4 },
    // Railroad (4 cards)
    { color: 'railroad', name: 'Reading Railroad', value: 2 },
    { color: 'railroad', name: 'Pennsylvania Railroad', value: 2 },
    { color: 'railroad', name: 'B. & O. Railroad', value: 2 },
    { color: 'railroad', name: 'Short Line Railroad', value: 2 },
    // Utility (2 cards)
    { color: 'utility', name: 'Water Works', value: 2 },
    { color: 'utility', name: 'Electric Company', value: 2 },
  ];

  properties.forEach((p) => {
    deck.push({
      type: 'property',
      name: p.name,
      value: p.value,
      color: p.color,
      rentValues: RENT_VALUES[p.color],
      maxInSet: MAX_IN_SET[p.color],
      description: `${COLOR_LABELS[p.color]} Renk grubuna ait arsa kartı. Set tamamlamak için ${MAX_IN_SET[p.color]} kart gerekir.`,
    });
  });

  // 3. Property Wildcards
  // Multicolor Wildcard x2 (matches any set, value: 0 - actually we count it as value 4 for payments but 0 in standard rules, let's say 4 to make it valuable)
  for (let i = 0; i < 2; i++) {
    deck.push({
      type: 'wildcard',
      name: 'Çok Renkli Joker',
      value: 4,
      isWildcard: true,
      allowedColors: ['brown', 'lightblue', 'pink', 'orange', 'red', 'yellow', 'green', 'darkblue', 'railroad', 'utility'],
      description: 'Herhangi bir renk grubuna yerleştirilebilen süper joker arsa kartı.',
    });
  }

  // Dual Color Wildcards
  const dualWildcards: { c1: CardColor; c2: CardColor; val: number }[] = [
    { c1: 'darkblue', c2: 'green', val: 4 },
    { c1: 'lightblue', c2: 'brown', val: 1 },
    { c1: 'orange', c2: 'pink', val: 2 },
    { c1: 'green', c2: 'railroad', val: 4 },
    { c1: 'lightblue', c2: 'railroad', val: 2 },
    { c1: 'utility', c2: 'railroad', val: 2 },
    { c1: 'yellow', c2: 'red', val: 3 },
  ];

  dualWildcards.forEach((dw) => {
    // Add 1 or 2 of each
    const count = dw.c1 === 'orange' || dw.c1 === 'lightblue' ? 2 : 1;
    for (let i = 0; i < count; i++) {
      deck.push({
        type: 'wildcard',
        name: `${COLOR_LABELS[dw.c1]} / ${COLOR_LABELS[dw.c2]} Joker`,
        value: dw.val,
        color: dw.c1, // defaults to first color, can toggle in real game
        secondaryColor: dw.c2,
        allowedColors: [dw.c1, dw.c2],
        isWildcard: true,
        description: `İki farklı renkten (${COLOR_LABELS[dw.c1]} veya ${COLOR_LABELS[dw.c2]}) biri olarak kullanılabilen joker arsa kartı.`,
      });
    }
  });

  // 4. Action Cards
  // Deal Breaker x2
  for (let i = 0; i < 2; i++) {
    deck.push({
      type: 'action',
      name: 'Anlaşma Bozan (Deal Breaker)',
      value: 5,
      actionType: 'deal-breaker',
      description: 'Başka bir oyuncunun tamamlanmış bir arsa setini (ev ve otelleriyle birlikte) çal.',
    });
  }
  // Just Say No x3
  for (let i = 0; i < 3; i++) {
    deck.push({
      type: 'action',
      name: 'Hayır Teşekkürler (Just Say No)',
      value: 4,
      actionType: 'just-say-no',
      description: 'Sana karşı oynanan herhangi bir aksiyon kartını anında iptal et. Karşı aksiyon olarak oynanır.',
    });
  }
  // Sly Deal x3
  for (let i = 0; i < 3; i++) {
    deck.push({
      type: 'action',
      name: 'Sinsi Anlaşma (Sly Deal)',
      value: 3,
      actionType: 'sly-deal',
      description: 'Başka bir oyuncunun tamamlanmamış bir setinden 1 arsa kartı çal.',
    });
  }
  // Forced Deal x3
  for (let i = 0; i < 4; i++) {
    deck.push({
      type: 'action',
      name: 'Zoraki Takas (Forced Deal)',
      value: 3,
      actionType: 'forced-deal',
      description: 'Kendi tamamlanmamış setindeki bir arsayı başka bir oyuncunun tamamlanmamış setindeki bir arsayla takas et.',
    });
  }
  // Debt Collector x3
  for (let i = 0; i < 3; i++) {
    deck.push({
      type: 'action',
      name: 'Borç Tahsildarı',
      value: 3,
      actionType: 'debt-collector',
      description: 'Seçtiğin bir oyuncudan anında 2M borç talep et.',
    });
  }
  // It's My Birthday x3
  for (let i = 0; i < 3; i++) {
    deck.push({
      type: 'action',
      name: 'Bugün Benim Doğum Günüm!',
      value: 2,
      actionType: 'birthday',
      description: 'Tüm oyunculardan anında 2M doğum günü hediyesi talep et.',
    });
  }
  // Pass Go x10
  for (let i = 0; i < 10; i++) {
    deck.push({
      type: 'action',
      name: 'Başlangıç Noktasından Geç',
      value: 1,
      actionType: 'pass-go',
      description: 'Desteden ekstra 2 kart çek.',
    });
  }
  // Double the Rent x2
  for (let i = 0; i < 2; i++) {
    deck.push({
      type: 'action',
      name: 'Kirayı İkiye Katla',
      value: 1,
      actionType: 'double-rent',
      description: 'Bir kira kartıyla birlikte oynandığında talep edilen kira bedelini ikiye katlar.',
    });
  }
  // House x3
  for (let i = 0; i < 3; i++) {
    deck.push({
      type: 'house-hotel',
      name: 'Ev',
      value: 3,
      actionType: 'house',
      description: 'Tamamlanmış bir sete eklenir ve kira bedelini +3M artırır. Set başına maksimum 1 ev.',
    });
  }
  // Hotel x2
  for (let i = 0; i < 2; i++) {
    deck.push({
      type: 'house-hotel',
      name: 'Otel',
      value: 4,
      actionType: 'hotel',
      description: 'Evi olan tamamlanmış bir sete eklenir ve kira bedelini +4M artırır. Set başına maksimum 1 otel.',
    });
  }

  // 5. Rent Cards
  // Wild Rent x3 (any color, value 3)
  for (let i = 0; i < 3; i++) {
    deck.push({
      type: 'rent',
      name: 'Her Renk Kira Kartı',
      value: 3,
      description: 'Sahip olduğun herhangi bir renk grubu için tüm oyunculardan kira bedeli tahsil et.',
    });
  }

  // Dual Rent Cards (value 1)
  const dualRents: { c1: CardColor; c2: CardColor }[] = [
    { c1: 'green', c2: 'darkblue' },
    { c1: 'red', c2: 'yellow' },
    { c1: 'orange', c2: 'pink' },
    { c1: 'brown', c2: 'lightblue' },
    { c1: 'utility', c2: 'railroad' },
  ];

  dualRents.forEach((dr) => {
    for (let i = 0; i < 2; i++) {
      deck.push({
        type: 'rent',
        name: `${COLOR_LABELS[dr.c1]} / ${COLOR_LABELS[dr.c2]} Kira`,
        value: 1,
        color: dr.c1,
        secondaryColor: dr.c2,
        description: `Sahip olduğun ${COLOR_LABELS[dr.c1]} veya ${COLOR_LABELS[dr.c2]} renk grubundan biri için tüm oyunculardan kira talep et.`,
      });
    }
  });

  // Attach dynamic unique IDs to all cards
  return deck.map((c, idx) => ({
    ...c,
    id: `card-${idx}-${Math.random().toString(36).substr(2, 5)}`,
  }));
}

// Shuffles an array of cards in-place
export function shuffleDeck(cards: Card[]): Card[] {
  const result = [...cards];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Check if a player has won (complete property sets of different colors based on targetSets)
export function checkWinner(properties: GamePlayer['properties'], targetSets: number = 3): boolean {
  let completedSetsCount = 0;
  const completedColors: CardColor[] = [];

  for (const colorKey in properties) {
    const color = colorKey as CardColor;
    const propSet = properties[color];
    if (propSet && propSet.cards.length > 0) {
      // Find maximum cards required to complete this color
      const maxCount = MAX_IN_SET[color];
      // Note: wildcards might match colors. In standard rules, wildcards are placed in a set.
      if (propSet.cards.length >= maxCount) {
        completedSetsCount++;
        completedColors.push(color);
      }
    }
  }

  return completedSetsCount >= targetSets;
}
