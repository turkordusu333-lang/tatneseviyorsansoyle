import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, X, Shield, Zap, Home, DollarSign, Award, Lightbulb, Check, ChevronRight } from 'lucide-react';
import { UserProfile } from '../types';
import { t } from '../lib/TranslationSystem';
import { sounds } from '../lib/SoundSystem';

interface HowToPlayModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
}

export const HowToPlayModal: React.FC<HowToPlayModalProps> = React.memo(({ isOpen, onClose, profile }) => {
  const [activeTab, setActiveTab] = useState<'rules' | 'strategies' | 'cards' | 'tips'>('rules');

  if (!isOpen) return null;

  const isEn = profile.settings.language === 'en';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
        className="fixed inset-0 bg-slate-950/92 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 z-[10000] font-sans select-none cursor-pointer"
      >
        <motion.div
          initial={{ scale: 0.95, y: 12, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.95, y: 12, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          className="bg-slate-900 border border-slate-750/80 rounded-3xl p-4 sm:p-6 w-full max-w-2xl shadow-2xl relative overflow-hidden max-h-[90dvh] flex flex-col my-auto border-amber-500/30"
        >
          {/* Glowing Ambient Top Bar */}
          <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500" />
          <div className="absolute -top-16 -right-16 w-40 h-40 bg-amber-500/10 rounded-full filter blur-3xl pointer-events-none" />

          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-red-600 flex items-center justify-center shadow-lg text-white">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-white tracking-wide">
                  {isEn ? 'How to Play & Card Strategies' : 'Nasıl Oynanır & Kart Stratejileri'}
                </h2>
                <p className="text-[11px] text-amber-400 font-semibold">
                  {isEn ? 'Monopoly Deal Complete Masterclass' : 'Monopoly Deal Kapsamlı Rehberi'}
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                sounds.playCoin(profile.settings);
                onClose();
              }}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-all cursor-pointer border border-slate-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Category Tabs */}
          <div className="flex bg-slate-950/80 p-1 rounded-2xl border border-white/10 gap-1 mb-3 shrink-0 overflow-x-auto scrollbar-none">
            {[
              { id: 'rules', label: isEn ? 'General Rules' : 'Genel Kurallar', icon: BookOpen },
              { id: 'strategies', label: isEn ? 'Card Strategies' : 'Kart Stratejileri', icon: Zap },
              { id: 'cards', label: isEn ? 'Card Types' : 'Kart Türleri', icon: Home },
              { id: 'tips', label: isEn ? 'Pro Tips' : 'Püf Noktaları', icon: Lightbulb },
            ].map((tab) => {
              const IconComp = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    sounds.playPlay(profile.settings);
                    setActiveTab(tab.id as any);
                  }}
                  className={`flex-1 min-w-[100px] py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md font-black'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <IconComp className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Scrollable Content Body */}
          <div className="flex-1 overflow-y-auto pr-1 sm:pr-2 scrollbar-thin space-y-4 text-xs text-slate-300 leading-relaxed font-sans">
            {activeTab === 'rules' && (
              <div className="space-y-3">
                <div className="bg-slate-950/70 border border-amber-500/30 rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center gap-2 text-amber-400 font-black text-sm">
                    <Award className="w-4 h-4" />
                    <span>{isEn ? '1. Goal of the Game' : '1. Oyunun Amacı'}</span>
                  </div>
                  <p className="text-slate-200 font-medium">
                    {isEn
                      ? 'The first player to collect 3 COMPLETE property sets of different colors wins the match immediately!'
                      : 'Farklı renklerde tamamlanmış 3 tam mülk setine (ör. 2 Kahverengi + 3 Sarı + 2 Koyu Mavi) sahip olan ilk oyuncu oyunu anında kazanır!'}
                  </p>
                </div>

                <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-black text-sm">
                    <ChevronRight className="w-4 h-4" />
                    <span>{isEn ? '2. Player Turn Structure' : '2. Tur Yapısı (3 Hamle Hakkı)'}</span>
                  </div>
                  <ul className="space-y-2 text-slate-300">
                    <li className="flex items-start gap-2">
                      <span className="bg-emerald-500/20 text-emerald-400 font-black px-1.5 py-0.5 rounded text-[10px]">1</span>
                      <span><strong>{isEn ? 'Draw Cards:' : 'Kart Çekme:'}</strong> {isEn ? 'At the start of your turn, draw 2 cards from the deck (if your hand is empty, draw 5 cards).' : 'Turunun başında desteden 2 kart çekersin (elinde hiç kart yoksa 5 kart çekersin).'}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="bg-amber-500/20 text-amber-400 font-black px-1.5 py-0.5 rounded text-[10px]">2</span>
                      <span><strong>{isEn ? 'Play Action (Up to 3):' : 'Kart Oynama (En fazla 3):'}</strong> {isEn ? 'You can play up to 3 cards per turn. You can put money into your bank, build properties, or play action cards.' : 'Sıran boyunca en fazla 3 kart oynayabilirsin. Kartları bankaya para yapabilir, mülk alanına koyabilir veya aksiyon olarak masaya oynayabilirsin.'}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="bg-rose-500/20 text-rose-400 font-black px-1.5 py-0.5 rounded text-[10px]">3</span>
                      <span><strong>{isEn ? 'End Turn & Hand Limit:' : 'Tur Sonu & El Limiti:'}</strong> {isEn ? 'At the end of your turn, if you have more than 7 cards in hand, you must discard excess cards.' : 'Turunu bitirdiğinde elinde 7\'den fazla kart varsa, fazlalıkları çöpe (atık destesine) atmalısın.'}</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center gap-2 text-cyan-400 font-black text-sm">
                    <DollarSign className="w-4 h-4" />
                    <span>{isEn ? '3. Payment & Debt Settlement Rules' : '3. Borç ve Ödeme Kuralları'}</span>
                  </div>
                  <p className="text-slate-300">
                    {isEn
                      ? 'When rent or money is demanded, you can pay using cash in your bank or property cards on the board. You CANNOT pay from cards held in your hand. Change is never given! If you have no cash or properties, you pay nothing (no negative debt).'
                      : 'Kira istendiğinde veya borç talep edildiğinde ödemeyi sadece bankandaki paralardan veya önündeki mülklerden yapabilirsin. ELDEKİ KARTLARLA ÖDEME YAPILAMAZ. Para üstü verilmez! Önünde hiç para veya mülk yoksa borç ödemezsin.'}
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'strategies' && (
              <div className="space-y-3">
                {/* Deal Breaker Strategy */}
                <div className="bg-slate-950/80 border border-red-500/40 rounded-2xl p-3.5 space-y-1.5 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-xs text-red-400 flex items-center gap-1.5">
                      ⚡ ANLAŞMA BOZAN (DEAL BREAKER)
                    </span>
                    <span className="bg-red-500/20 text-red-300 font-black text-[9px] px-2 py-0.5 rounded-full border border-red-500/30">
                      M5 DEĞERİ
                    </span>
                  </div>
                  <p className="text-slate-200">
                    {isEn
                      ? 'Steals a complete property set from an opponent, including any House or Hotel built on it!'
                      : 'Rakibin tamamlanmış tam bir mülk setini (üzerindeki Ev ve Oteller dahil) doğrudan senin masana çalar!'}
                  </p>
                  <div className="bg-slate-900/90 border border-red-500/20 rounded-xl p-2.5 text-[11px] text-amber-300 font-semibold space-y-1">
                    <div className="font-bold text-amber-400">💡 {isEn ? 'Pro Strategy:' : 'Stratejik Tavsiye:'}</div>
                    <p>{isEn ? 'Save your Deal Breaker until an opponent completes a set that brings them close to winning, or use Just Say No if they attempt to counter!' : 'Anlaşma Bozan kartını rakip 2. setini tamamlayana kadar elinde sakla. Sakın erkenden harcama!'}</p>
                  </div>
                </div>

                {/* Just Say No Strategy */}
                <div className="bg-slate-950/80 border border-emerald-500/40 rounded-2xl p-3.5 space-y-1.5 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-xs text-emerald-400 flex items-center gap-1.5">
                      🛡️ HAYIR TEŞEKKÜRLER (JUST SAY NO)
                    </span>
                    <span className="bg-emerald-500/20 text-emerald-300 font-black text-[9px] px-2 py-0.5 rounded-full border border-emerald-500/30">
                      SAVUNMA
                    </span>
                  </div>
                  <p className="text-slate-200">
                    {isEn
                      ? 'Cancels any action played against you (Deal Breaker, Sly Deal, Rent, Debt Collector). You can play it out of turn!'
                      : 'Sana karşı oynanan herhangi bir aksiyonu (Anlaşma Bozan, Sinsi Anlaşma, Yüksek Kira) anında iptal eder. Kendi sıran olmasa bile oynayabilirsin!'}
                  </p>
                  <div className="bg-slate-900/90 border border-emerald-500/20 rounded-xl p-2.5 text-[11px] text-emerald-300 font-semibold space-y-1">
                    <div className="font-bold text-emerald-400">⚔️ {isEn ? 'JSN Duel:' : 'Hayır Teşekkürler Düellosu:'}</div>
                    <p>{isEn ? 'An opponent can counter your Just Say No with another Just Say No! Whoever plays the last Just Say No wins the duel.' : 'Rakip senin "Hayır Teşekkürler" kartına karşılık kendi "Hayır Teşekkürler" kartını oynayabilir! Son kartı oynayan düelloyu kazanır.'}</p>
                  </div>
                </div>

                {/* Sly Deal & Forced Deal */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-slate-950/80 border border-amber-500/30 rounded-2xl p-3 space-y-1.5">
                    <span className="font-black text-xs text-amber-400 block">🥷 Sinsi Anlaşma (Sly Deal)</span>
                    <p className="text-[11px] text-slate-300">
                      {isEn
                        ? 'Steal a single property card from an opponent (must not be part of a full set).'
                        : 'Rakibin TAMAMLANMAMIŞ bir setindeki tek bir mülk kartını çalar.'}
                    </p>
                  </div>

                  <div className="bg-slate-950/80 border border-blue-500/30 rounded-2xl p-3 space-y-1.5">
                    <span className="font-black text-xs text-blue-400 block">🔄 Zoraki Takas (Forced Deal)</span>
                    <p className="text-[11px] text-slate-300">
                      {isEn
                        ? 'Swap one of your properties with one property from an opponent.'
                        : 'Kendi değersiz bir mülkünle rakibin değerli bir mülkünü zorla takas eder.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'cards' && (
              <div className="space-y-3">
                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 space-y-2">
                  <h4 className="font-extrabold text-amber-400 text-xs">🏢 Mülk Kartları (Properties & Wildcards)</h4>
                  <p className="text-[11px] text-slate-300">
                    Aynı renkteki mülk kartlarını bir araya getirerek set tamamla. Joker Mülkler (Wildcards) istediğin iki renkten birine dönüşebilir ve turun esnasında istediğin zaman rengini değiştirebilirsin!
                  </p>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 space-y-2">
                  <h4 className="font-extrabold text-emerald-400 text-xs">🏠 Ev ve Otel (House & Hotel)</h4>
                  <p className="text-[11px] text-slate-300">
                    Ev koymak için o rengin setinin tam olması gerekir. Ev kirayı +3M artırır. Otel koymak için üzerinde Ev olması gerekir ve kirayı +4M daha artırır!
                  </p>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 space-y-2">
                  <h4 className="font-extrabold text-cyan-400 text-xs">⚡ Çift Kira (Double Rent)</h4>
                  <p className="text-[11px] text-slate-300">
                    Kira kartı oynamadan önce Çift Kira oynarsan talep ettiğin kira bedeli 2 katına çıkar! (Ör. 8M kira 16M olur ve rakibin tüm bankasını sıfırlayabilir).
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'tips' && (
              <div className="space-y-3">
                <div className="bg-slate-950/80 border border-amber-500/30 rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                    <Lightbulb className="w-4 h-4" />
                    <span>Usta Oyuncu Tavsiyeleri</span>
                  </div>
                  <ul className="space-y-2 text-[11px] text-slate-200">
                    <li className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span><strong>Bankanı Dolu Tut:</strong> Büyük kiralara ve Borç Tahsili taleplerine karşı bankanda her zaman para veya değersiz mülk bulundur, böylece ana mülk setlerini kaybetmezsin.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span><strong>3. Set Tuzağı:</strong> 3. seti hemen tamamlamak rakibe davetiye çıkarabilir. Elinde Anlaşma Bozan veya Hayır Teşekkürler yoksa 3. seti tamamlamayı 1 tur geciktirmek stratejik bir hamledir!</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span><strong>Jokerleri Doğru Kullan:</strong> Çok renkli joker mülkleri kirası yüksek olan renk gruplarına kaydırarak maksimum kira elde et.</span>
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Sticky Bottom Action Footer */}
          <div className="shrink-0 pt-3 mt-3 border-t border-white/10 sticky bottom-0 bg-slate-900 z-20">
            <button
              onClick={() => {
                sounds.playCoin(profile.settings);
                onClose();
              }}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110 text-slate-950 font-black rounded-2xl text-xs sm:text-sm transition-all shadow-lg cursor-pointer tracking-wider uppercase"
            >
              {isEn ? 'GOT IT, LET\'S PLAY!' : 'ANLADIM, OYUNA BAŞLA!'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
});

HowToPlayModal.displayName = 'HowToPlayModal';
