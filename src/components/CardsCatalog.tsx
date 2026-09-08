import React, { useState, useMemo, useEffect } from 'react';
import { UserProfile, CardColor, Card } from '../types';
import { GameCard } from './GameCard';
import { Holo } from './Holo';
import { sounds } from '../lib/SoundSystem';
import { t } from '../lib/TranslationSystem';
import { COLOR_LABELS, COLOR_HEX, RENT_VALUES, MAX_IN_SET } from '../lib/deck';
import { ALL_CATALOG_CARDS, CardCatalogItem, DECK_STATS } from '../lib/cardsCatalogData';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Layers,
  Sparkles,
  Shield,
  Coins,
  ArrowLeft,
  ArrowRight,
  X,
  SlidersHorizontal,
  Info,
  TrendingUp,
  RotateCcw,
  CheckCircle2,
  Building,
  Home,
  Check,
  ChevronRight
} from 'lucide-react';

interface Props {
  profile: UserProfile;
}

type CategoryType = 'all' | 'property' | 'action' | 'wildcard' | 'rent' | 'money';
type SortType = 'default' | 'value_desc' | 'value_asc' | 'count_desc' | 'name_asc';

export const CardsCatalog: React.FC<Props> = ({ profile }) => {
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('all');
  const [selectedColor, setSelectedColor] = useState<CardColor | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortType>('default');
  const [inspectingCard, setInspectingCard] = useState<CardCatalogItem | null>(null);
  const [previewFlipped, setPreviewFlipped] = useState(false);

  const lang = profile.settings.language || 'tr';

  // Keyboard navigation for card inspector modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!inspectingCard) return;

      if (e.key === 'Escape') {
        setInspectingCard(null);
      } else if (e.key === 'ArrowRight') {
        handleNextCard();
      } else if (e.key === 'ArrowLeft') {
        handlePrevCard();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inspectingCard]);

  // Reset flip when card changes
  useEffect(() => {
    setPreviewFlipped(false);
  }, [inspectingCard]);

  // Filter and sort cards
  const filteredCards = useMemo(() => {
    let list = ALL_CATALOG_CARDS.filter((item) => {
      // Category filter
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }

      // Color filter
      if (selectedColor !== 'all') {
        const c = item.card.color;
        const sec = item.card.secondaryColor;
        const allowed = item.card.allowedColors;

        const matchesPrimary = c === selectedColor;
        const matchesSecondary = sec === selectedColor;
        const matchesAllowed = allowed && allowed.includes(selectedColor);

        if (!matchesPrimary && !matchesSecondary && !matchesAllowed) {
          return false;
        }
      }

      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const nameMatch = item.card.name.toLowerCase().includes(query);
        const descTrMatch = item.detailedDescriptionTr.toLowerCase().includes(query);
        const descEnMatch = item.detailedDescriptionEn.toLowerCase().includes(query);
        const catMatch = item.categoryLabelTr.toLowerCase().includes(query) || item.categoryLabelEn.toLowerCase().includes(query);

        if (!nameMatch && !descTrMatch && !descEnMatch && !catMatch) {
          return false;
        }
      }

      return true;
    });

    // Sorting
    switch (sortBy) {
      case 'value_desc':
        list = [...list].sort((a, b) => b.card.value - a.card.value);
        break;
      case 'value_asc':
        list = [...list].sort((a, b) => a.card.value - b.card.value);
        break;
      case 'count_desc':
        list = [...list].sort((a, b) => b.countInDeck - a.countInDeck);
        break;
      case 'name_asc':
        list = [...list].sort((a, b) => a.card.name.localeCompare(b.card.name));
        break;
      default:
        // Keep default curated order
        break;
    }

    return list;
  }, [selectedCategory, selectedColor, searchQuery, sortBy]);

  // Modal navigation helpers
  const currentCardIndex = useMemo(() => {
    if (!inspectingCard) return -1;
    return filteredCards.findIndex((c) => c.id === inspectingCard.id);
  }, [inspectingCard, filteredCards]);

  const handleNextCard = () => {
    if (filteredCards.length <= 1) return;
    const nextIdx = (currentCardIndex + 1) % filteredCards.length;
    setInspectingCard(filteredCards[nextIdx]);
    sounds.playDraw(profile.settings);
  };

  const handlePrevCard = () => {
    if (filteredCards.length <= 1) return;
    const prevIdx = (currentCardIndex - 1 + filteredCards.length) % filteredCards.length;
    setInspectingCard(filteredCards[prevIdx]);
    sounds.playDraw(profile.settings);
  };

  const categories: { id: CategoryType; labelTr: string; labelEn: string; count: number; icon: string; color: string }[] = [
    { id: 'all', labelTr: 'Tüm Kartlar', labelEn: 'All Cards', count: 106, icon: '🌟', color: 'from-red-600 to-amber-600' },
    { id: 'property', labelTr: 'Arsa Mülkleri', labelEn: 'Properties', count: 28, icon: '🏠', color: 'from-blue-600 to-indigo-600' },
    { id: 'action', labelTr: 'Aksiyon Kartları', labelEn: 'Action Cards', count: 34, icon: '⚡', color: 'from-amber-600 to-orange-600' },
    { id: 'wildcard', labelTr: 'Joker Kartlar', labelEn: 'Wildcards', count: 11, icon: '🃏', color: 'from-purple-600 to-pink-600' },
    { id: 'rent', labelTr: 'Kira Kartları', labelEn: 'Rent Cards', count: 13, icon: '📜', color: 'from-emerald-600 to-teal-600' },
    { id: 'money', labelTr: 'Nakit Paralar', labelEn: 'Money Cards', count: 20, icon: '💰', color: 'from-yellow-500 to-amber-500' },
  ];

  const colorsList: { key: CardColor; label: string; hex: string }[] = [
    { key: 'brown', label: COLOR_LABELS.brown, hex: COLOR_HEX.brown },
    { key: 'lightblue', label: COLOR_LABELS.lightblue, hex: COLOR_HEX.lightblue },
    { key: 'pink', label: COLOR_LABELS.pink, hex: COLOR_HEX.pink },
    { key: 'orange', label: COLOR_LABELS.orange, hex: COLOR_HEX.orange },
    { key: 'red', label: COLOR_LABELS.red, hex: COLOR_HEX.red },
    { key: 'yellow', label: COLOR_LABELS.yellow, hex: COLOR_HEX.yellow },
    { key: 'green', label: COLOR_LABELS.green, hex: COLOR_HEX.green },
    { key: 'darkblue', label: COLOR_LABELS.darkblue, hex: COLOR_HEX.darkblue },
    { key: 'railroad', label: COLOR_LABELS.railroad, hex: COLOR_HEX.railroad },
    { key: 'utility', label: COLOR_LABELS.utility, hex: COLOR_HEX.utility },
  ];

  const getRarityBadge = (rarity: CardCatalogItem['rarity']) => {
    switch (rarity) {
      case 'legendary':
        return {
          label: lang === 'en' ? 'LEGENDARY' : 'EFSANEVİ',
          badgeClass: 'bg-gradient-to-r from-amber-500 to-yellow-300 text-slate-950 shadow-[0_0_10px_rgba(245,158,11,0.5)]',
          borderClass: 'border-amber-400/50'
        };
      case 'epic':
        return {
          label: lang === 'en' ? 'EPIC' : 'DESTANSI',
          badgeClass: 'bg-gradient-to-r from-purple-600 to-indigo-500 text-white shadow-[0_0_10px_rgba(147,51,234,0.4)]',
          borderClass: 'border-purple-500/50'
        };
      case 'rare':
        return {
          label: lang === 'en' ? 'RARE' : 'NADİR',
          badgeClass: 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-[0_0_10px_rgba(37,99,235,0.4)]',
          borderClass: 'border-blue-500/50'
        };
      default:
        return {
          label: lang === 'en' ? 'COMMON' : 'YAYGIN',
          badgeClass: 'bg-zinc-800 text-zinc-300 border border-zinc-700',
          borderClass: 'border-zinc-700/50'
        };
    }
  };

  return (
    <div className="space-y-6 text-left">
      {/* Catalog Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-zinc-950 via-zinc-900 to-red-950/40 border border-zinc-800/90 rounded-3xl p-5 sm:p-7 shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-red-600/10 rounded-full filter blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-amber-600/10 rounded-full filter blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-red-600 to-amber-600 flex items-center justify-center text-xl shadow-lg shadow-red-600/20 text-white font-black">
                🃏
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
                  DESTE VE KART REHBERİ
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase">
                  {lang === 'en' ? 'Card Compendium & Strategy' : 'Kart Kataloğu & İnceleme'}
                </h2>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl leading-relaxed">
              {lang === 'en'
                ? 'Explore all 106 official cards in the deck. Master every property rent value, secret action synergy, counterplay tactic, and probability to dominate your opponents.'
                : 'Oyundaki 106 kartın tamamını inceleyin. Arsa kira kademelerini, kritik aksiyon sinerjilerini, karşı hamle taktiklerini ve stratejik ipuçlarını öğrenerek masanın hakimi olun.'}
            </p>
          </div>

          {/* Quick Deck Info Box */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-3.5 sm:p-4 flex items-center gap-4 flex-shrink-0">
            <div className="text-center border-r border-zinc-800 pr-4">
              <span className="text-2xl font-black text-amber-400 font-mono block leading-none">106</span>
              <span className="text-[9px] uppercase font-bold text-zinc-500 mt-1 block">Toplam Kart</span>
            </div>
            <div className="text-center border-r border-zinc-800 pr-4">
              <span className="text-2xl font-black text-emerald-400 font-mono block leading-none">10</span>
              <span className="text-[9px] uppercase font-bold text-zinc-500 mt-1 block">Renk Grubu</span>
            </div>
            <div className="text-center">
              <span className="text-2xl font-black text-indigo-400 font-mono block leading-none">3</span>
              <span className="text-[9px] uppercase font-bold text-zinc-500 mt-1 block">Zafer Seti</span>
            </div>
          </div>
        </div>

        {/* Deck Breakdown Distribution Bar */}
        <div className="mt-6 pt-5 border-t border-zinc-800/80 space-y-2">
          <div className="flex items-center justify-between text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider">
            <span>Deste Kart Dağılımı (%100 Standart Deste)</span>
            <span className="font-mono text-zinc-500">{filteredCards.reduce((acc, c) => acc + c.countInDeck, 0)} / 106 Kart Gösteriliyor</span>
          </div>

          <div className="w-full h-3 bg-zinc-950 rounded-full overflow-hidden p-0.5 flex gap-0.5 border border-zinc-800/80 shadow-inner">
            <div
              style={{ width: `${(DECK_STATS.actionCards / 106) * 100}%` }}
              className="bg-amber-500 h-full rounded-sm transition-all"
              title={`Aksiyon Kartları: 34 Adet (%${Math.round((DECK_STATS.actionCards / 106) * 100)})`}
            />
            <div
              style={{ width: `${(DECK_STATS.propertyCards / 106) * 100}%` }}
              className="bg-blue-500 h-full rounded-sm transition-all"
              title={`Arsa Kartları: 28 Adet (%${Math.round((DECK_STATS.propertyCards / 106) * 100)})`}
            />
            <div
              style={{ width: `${(DECK_STATS.moneyCards / 106) * 100}%` }}
              className="bg-emerald-500 h-full rounded-sm transition-all"
              title={`Nakit Para: 20 Adet (%${Math.round((DECK_STATS.moneyCards / 106) * 100)})`}
            />
            <div
              style={{ width: `${(DECK_STATS.rentCards / 106) * 100}%` }}
              className="bg-teal-400 h-full rounded-sm transition-all"
              title={`Kira Kartları: 13 Adet (%${Math.round((DECK_STATS.rentCards / 106) * 100)})`}
            />
            <div
              style={{ width: `${(DECK_STATS.wildcardCards / 106) * 100}%` }}
              className="bg-purple-500 h-full rounded-sm transition-all"
              title={`Joker Kartlar: 11 Adet (%${Math.round((DECK_STATS.wildcardCards / 106) * 100)})`}
            />
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[9px] text-zinc-400 font-bold pt-1">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> 34 Aksiyon</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> 28 Arsa</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> 20 Para</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-teal-400 inline-block" /> 13 Kira</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-500 inline-block" /> 11 Joker</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="bg-zinc-950/60 border border-zinc-900/90 rounded-2xl p-4 space-y-4 shadow-md backdrop-blur-sm">
        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  sounds.playCoin(profile.settings);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all flex-shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg shadow-red-600/20 scale-[1.02]'
                    : 'bg-zinc-900/60 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 hover:bg-zinc-900'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{lang === 'en' ? cat.labelEn : cat.labelTr}</span>
                <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  isSelected ? 'bg-black/30 text-white' : 'bg-zinc-800 text-zinc-400'
                }`}>
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search, Sort and Color Filters Row */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Search Box */}
          <div className="md:col-span-6 relative">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === 'en' ? 'Search by card name, rules or action...' : 'Kart adı, aksiyon veya özellik ara...'}
              className="w-full bg-zinc-900/80 border border-zinc-800 rounded-xl pl-10 pr-9 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-xs p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort Selector */}
          <div className="md:col-span-3">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortType)}
              className="w-full bg-zinc-900/80 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs font-bold text-zinc-300 focus:outline-none focus:border-red-500/50 cursor-pointer"
            >
              <option value="default">📋 Sıralama: Standart Deste</option>
              <option value="value_desc">💰 Değer: Yüksekten Düşüğe</option>
              <option value="value_asc">💰 Değer: Düşükten Yükseğe</option>
              <option value="count_desc">🔢 Destede Bulunma Sayısı</option>
              <option value="name_asc">🔤 İsim: A'dan Z'ye</option>
            </select>
          </div>

          {/* Reset Filters */}
          <div className="md:col-span-3 flex justify-end">
            {(selectedCategory !== 'all' || selectedColor !== 'all' || searchQuery || sortBy !== 'default') && (
              <button
                onClick={() => {
                  setSelectedCategory('all');
                  setSelectedColor('all');
                  setSearchQuery('');
                  setSortBy('default');
                  sounds.playDraw(profile.settings);
                }}
                className="w-full py-2.5 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Filtreleri Temizle</span>
              </button>
            )}
          </div>
        </div>

        {/* Color Chips Filter (Only for properties, wildcards, rents or all) */}
        {(selectedCategory === 'all' || selectedCategory === 'property' || selectedCategory === 'wildcard' || selectedCategory === 'rent') && (
          <div className="pt-2 border-t border-zinc-900 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-black uppercase text-zinc-500 mr-1 flex items-center gap-1">
              <span>🎨</span> Renk:
            </span>
            <button
              onClick={() => setSelectedColor('all')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase transition-all cursor-pointer ${
                selectedColor === 'all'
                  ? 'bg-zinc-100 text-zinc-950 shadow-sm'
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              Tümü
            </button>
            {colorsList.map((c) => {
              const isSelected = selectedColor === c.key;
              return (
                <button
                  key={c.key}
                  onClick={() => {
                    setSelectedColor(isSelected ? 'all' : c.key);
                    sounds.playCoin(profile.settings);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase transition-all flex items-center gap-1.5 cursor-pointer border ${
                    isSelected
                      ? 'border-white text-white shadow-md'
                      : 'border-zinc-800/80 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                  }`}
                  style={{
                    backgroundColor: isSelected ? `${c.hex}33` : undefined,
                    borderColor: isSelected ? c.hex : undefined,
                  }}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.hex }} />
                  <span>{c.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Cards Grid */}
      {filteredCards.length === 0 ? (
        <div className="bg-zinc-950/40 border border-zinc-900 rounded-3xl p-12 text-center space-y-4">
          <div className="w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center text-3xl mx-auto text-zinc-600">
            🔍
          </div>
          <h3 className="text-base font-black text-white uppercase tracking-wider">Kart Bulunamadı</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Arama kriterlerinize veya filtrelere uyan hiçbir kart bulunamadı. Lütfen arama terimini veya filtreleri sıfırlayın.
          </p>
          <button
            onClick={() => {
              setSelectedCategory('all');
              setSelectedColor('all');
              setSearchQuery('');
              setSortBy('default');
            }}
            className="px-4 py-2 bg-red-600 text-white font-black text-xs uppercase tracking-wider rounded-xl cursor-pointer"
          >
            Filtreleri Sıfırla
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4">
          {filteredCards.map((item) => {
            const rarity = getRarityBadge(item.rarity);
            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                onClick={() => {
                  setInspectingCard(item);
                  sounds.playDraw(profile.settings);
                }}
                className="group relative bg-zinc-950/70 hover:bg-zinc-900/90 border border-zinc-900 hover:border-zinc-700/80 rounded-2xl p-2.5 sm:p-3 flex flex-col items-center justify-between gap-3 cursor-pointer transition-all hover:shadow-2xl hover:shadow-red-950/20 hover:-translate-y-1 select-none overflow-hidden"
              >
                {/* Count Badge in Deck */}
                <div className="w-full flex items-center justify-between z-10">
                  <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full ${rarity.badgeClass}`}>
                    {rarity.label}
                  </span>
                  <span className="text-[9px] font-mono font-black bg-zinc-900/90 border border-zinc-800 text-amber-400 px-1.5 py-0.5 rounded-md" title="Destede bulunan adet">
                    x{item.countInDeck} adet
                  </span>
                </div>

                {/* Card Graphic */}
                <div className="relative py-1 flex items-center justify-center transform group-hover:scale-105 transition-transform duration-200 pointer-events-none">
                  <GameCard
                    card={item.card}
                    size="medium"
                    cardBack={profile.settings.cardBack || 'back_classic'}
                    cardSkin={profile.settings.cardSkin || 'skin_none'}
                    disable3D={true}
                  />
                </div>

                {/* Card Title & Value */}
                <div className="w-full text-center space-y-1 z-10 pt-1 border-t border-zinc-900">
                  <h4 className="text-[11px] font-black text-zinc-200 truncate group-hover:text-white transition-colors" title={item.card.name}>
                    {item.card.name}
                  </h4>
                  <div className="flex items-center justify-between text-[9px] text-zinc-500 font-bold">
                    <span className="truncate max-w-[80px]">
                      {lang === 'en' ? item.categoryLabelEn : item.categoryLabelTr}
                    </span>
                    <span className="font-mono text-amber-400 font-black">
                      {item.card.value}M 💰
                    </span>
                  </div>
                </div>

                {/* Hover CTA overlay */}
                <div className="absolute inset-0 bg-red-950/20 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center pointer-events-none">
                  <span className="bg-red-600 text-white font-black text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-xl shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform">
                    İncele 🔍
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* =========================================================================
          MODAL: INTERACTIVE CARD INSPECTOR (KART DETAYLI İNCELEME)
         ========================================================================= */}
      <AnimatePresence>
        {inspectingCard && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[200] flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="bg-[#0b0d13] border border-zinc-800/90 rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl relative text-left"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Top Bar */}
              <div className="p-4 sm:p-5 border-b border-zinc-800/80 bg-zinc-950/60 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-sm">
                    🔍
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[8.5px] font-black uppercase px-2 py-0.5 rounded-full ${getRarityBadge(inspectingCard.rarity).badgeClass}`}>
                        {getRarityBadge(inspectingCard.rarity).label}
                      </span>
                      <span className="text-[10px] font-bold text-zinc-400">
                        {lang === 'en' ? inspectingCard.categoryLabelEn : inspectingCard.categoryLabelTr}
                      </span>
                    </div>
                    <h3 className="text-sm sm:text-base font-black text-white tracking-tight mt-0.5">
                      {inspectingCard.card.name}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Card index pill */}
                  <span className="text-[10px] font-mono text-zinc-500 hidden sm:inline-block">
                    {currentCardIndex + 1} / {filteredCards.length}
                  </span>
                  <button
                    onClick={() => {
                      setInspectingCard(null);
                      sounds.playPlay(profile.settings);
                    }}
                    className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-all cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-4 sm:p-7 grid grid-cols-1 md:grid-cols-12 gap-6 max-h-[75vh] overflow-y-auto scrollbar-none">
                {/* Left Column: Interactive 3D Card Display */}
                <div className="md:col-span-5 flex flex-col items-center justify-start space-y-4">
                  <div className="relative p-2 flex items-center justify-center select-none">
                    <Holo>
                      <GameCard
                        card={inspectingCard.card}
                        size="normal"
                        isFaceDown={previewFlipped}
                        cardBack={profile.settings.cardBack || 'back_classic'}
                        cardSkin={profile.settings.cardSkin || 'skin_none'}
                      />
                    </Holo>
                  </div>

                  {/* Flip Card Preview Button */}
                  <button
                    onClick={() => {
                      setPreviewFlipped(!previewFlipped);
                      sounds.playDraw(profile.settings);
                    }}
                    className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{previewFlipped ? 'Kartın Ön Yüzünü Göster' : 'Kart Arkalığını Gör'}</span>
                  </button>

                  {/* Deck Stats Quick Summary */}
                  <div className="w-full bg-zinc-950/60 border border-zinc-900 rounded-2xl p-3.5 grid grid-cols-2 gap-2 text-center text-xs">
                    <div className="p-2 bg-zinc-900/40 rounded-xl border border-zinc-900">
                      <span className="text-[9px] uppercase font-bold text-zinc-500 block">Destede Toplam</span>
                      <span className="text-sm font-black text-amber-400 font-mono mt-0.5 block">
                        {inspectingCard.countInDeck} Adet
                      </span>
                    </div>
                    <div className="p-2 bg-zinc-900/40 rounded-xl border border-zinc-900">
                      <span className="text-[9px] uppercase font-bold text-zinc-500 block">Çekilme Olasılığı</span>
                      <span className="text-sm font-black text-emerald-400 font-mono mt-0.5 block">
                        %{((inspectingCard.countInDeck / 106) * 100).toFixed(1)}
                      </span>
                    </div>
                    <div className="p-2 bg-zinc-900/40 rounded-xl border border-zinc-900 col-span-2 flex items-center justify-between px-3">
                      <span className="text-[10px] font-bold text-zinc-400">Banka / Kasa Değeri:</span>
                      <span className="text-xs font-black text-amber-300 font-mono">
                        {inspectingCard.card.value} Milyon 💰
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Column: Detailed Gameplay & Strategic Analysis */}
                <div className="md:col-span-7 space-y-5">
                  {/* Detailed Description */}
                  <div className="bg-zinc-950/50 border border-zinc-900 rounded-2xl p-4 space-y-2">
                    <div className="flex items-center gap-2 text-red-400 font-extrabold text-xs uppercase tracking-wider">
                      <Info className="w-4 h-4" />
                      <span>Kart İşlevi ve Oyun İçi Kullanımı</span>
                    </div>
                    <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                      {lang === 'en' ? inspectingCard.detailedDescriptionEn : inspectingCard.detailedDescriptionTr}
                    </p>
                  </div>

                  {/* Rent Table (If Property or Rent card) */}
                  {(inspectingCard.card.color || inspectingCard.card.rentValues) && (
                    <div className="bg-zinc-950/50 border border-zinc-900 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                        <div className="flex items-center gap-2 text-amber-400 font-extrabold text-xs uppercase tracking-wider">
                          <Building className="w-4 h-4" />
                          <span>Kira Gelirleri Cetveli</span>
                        </div>
                        {inspectingCard.card.maxInSet && (
                          <span className="text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full font-bold">
                            Tam Set: {inspectingCard.card.maxInSet} Kart
                          </span>
                        )}
                      </div>

                      {(() => {
                        const colorKey = inspectingCard.card.color;
                        const rentArr = (colorKey && RENT_VALUES[colorKey]) || inspectingCard.card.rentValues || [];
                        const maxCount = (colorKey && MAX_IN_SET[colorKey]) || inspectingCard.card.maxInSet || rentArr.length;

                        return (
                          <div className="space-y-1.5">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {rentArr.map((rent, idx) => (
                                <div
                                  key={idx}
                                  className={`p-2 rounded-xl border text-center ${
                                    idx + 1 === maxCount
                                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 font-black'
                                      : 'bg-zinc-900/40 border-zinc-900 text-zinc-300'
                                  }`}
                                >
                                  <span className="text-[9px] uppercase font-bold text-zinc-500 block">
                                    {idx + 1} Mülk {idx + 1 === maxCount && '⭐'}
                                  </span>
                                  <span className="text-xs font-mono font-bold mt-0.5 block">
                                    {rent}M Kira
                                  </span>
                                </div>
                              ))}
                            </div>

                            {/* House & Hotel Boost Info */}
                            {colorKey !== 'railroad' && colorKey !== 'utility' && (
                              <div className="pt-2 border-t border-zinc-900/60 flex items-center justify-between text-[10px] text-zinc-400 font-bold px-1">
                                <span className="flex items-center gap-1 text-emerald-400">
                                  <Home className="w-3 h-3" /> +Ev: +3M Kira
                                </span>
                                <span className="flex items-center gap-1 text-amber-400">
                                  <Building className="w-3 h-3" /> +Otel: +4M Kira
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Strategic Tips (Usta Stratejist İpuçları) */}
                  <div className="bg-zinc-950/50 border border-zinc-900 rounded-2xl p-4 space-y-2.5">
                    <div className="flex items-center gap-2 text-indigo-400 font-extrabold text-xs uppercase tracking-wider">
                      <Sparkles className="w-4 h-4" />
                      <span>{lang === 'en' ? 'Pro Tactics & Synergy' : 'Usta Stratejist İpuçları'}</span>
                    </div>
                    <ul className="space-y-1.5 text-xs text-zinc-300">
                      {(lang === 'en' ? inspectingCard.strategyTipsEn : inspectingCard.strategyTipsTr).map((tip, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                          <span className="leading-snug">{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Counterplay (Karşı Hamleler ve Korunma) */}
                  <div className="bg-zinc-950/50 border border-zinc-900 rounded-2xl p-4 space-y-2">
                    <div className="flex items-center gap-2 text-rose-400 font-extrabold text-xs uppercase tracking-wider">
                      <Shield className="w-4 h-4" />
                      <span>{lang === 'en' ? 'Counterplay & Defense' : 'Tehditler ve Karşı Savunma'}</span>
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      {lang === 'en' ? inspectingCard.counterplayEn : inspectingCard.counterplayTr}
                    </p>
                  </div>
                </div>
              </div>

              {/* Modal Navigation Footer */}
              <div className="p-4 border-t border-zinc-800/80 bg-zinc-950/70 flex items-center justify-between">
                <button
                  onClick={handlePrevCard}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Önceki Kart</span>
                </button>

                <div className="text-center text-[10px] text-zinc-500 font-bold hidden sm:block">
                  Klavye Yön Tuşları (← / →) ile gezinebilirsiniz
                </div>

                <button
                  onClick={handleNextCard}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <span>Sonraki Kart</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
