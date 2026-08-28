import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GamePlayer } from '../types';
import { AvatarWithFrame } from './AvatarWithFrame';
import { getCountryByCode } from '../lib/countryData';

interface StartingTurnRouletteOverlayProps {
  isOpen: boolean;
  players: GamePlayer[];
  activeIdx: number;
  winnerPlayer: GamePlayer | null;
  isFinalized: boolean;
  localPlayerId: string;
  onClose: () => void;
  language?: string;
}

export const StartingTurnRouletteOverlay: React.FC<StartingTurnRouletteOverlayProps> = ({
  isOpen,
  players,
  activeIdx,
  winnerPlayer,
  isFinalized,
  localPlayerId,
  onClose,
  language = 'tr',
}) => {
  if (!isOpen || !players || players.length === 0) return null;

  const isEn = language === 'en';
  const isMeWinner = winnerPlayer ? winnerPlayer.id === localPlayerId : false;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[160] flex flex-col items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xl select-none overflow-hidden">
        {/* Animated Background Atmosphere */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className={`absolute -top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full filter blur-[100px] transition-all duration-700 ${
              isFinalized
                ? isMeWinner
                  ? 'bg-emerald-500/25'
                  : 'bg-amber-500/25'
                : 'bg-indigo-600/20'
            }`}
          />
          <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-black/80 to-transparent" />
        </div>

        {/* Modal Container */}
        <motion.div
          initial={{ scale: 0.85, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 15 }}
          transition={{ type: 'spring', damping: 24, stiffness: 300 }}
          className="relative z-10 max-w-2xl w-full bg-slate-900/90 border border-white/15 rounded-3xl p-6 sm:p-8 shadow-[0_0_60px_rgba(0,0,0,0.8)] backdrop-blur-2xl flex flex-col items-center text-center overflow-hidden"
        >
          {/* Top Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] sm:text-xs font-black uppercase tracking-widest text-amber-400 mb-3 shadow-inner">
            <span className="animate-spin text-sm">🎲</span>
            <span>{isEn ? 'DEAL MASTER ARENA' : 'DEAL MASTER ARENASI'}</span>
          </div>

          {/* Main Headline */}
          <div className="space-y-1 mb-6">
            <h2 className="text-xl sm:text-3xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-white via-amber-200 to-amber-400 drop-shadow-md">
              {!isFinalized
                ? isEn
                  ? '🎲 STARTING TURN DRAW'
                  : '🎲 İLK SIRA KURASI'
                : isMeWinner
                ? isEn
                  ? '🎯 YOU GO FIRST!'
                  : '🎯 İLK SIRA SENDE!'
                : isEn
                ? `🎯 ${winnerPlayer?.username.toUpperCase()} GOES FIRST!`
                : `🎯 İLK BAŞLAYAN: ${winnerPlayer?.username.toUpperCase()}`}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 font-medium max-w-md mx-auto">
              {!isFinalized
                ? isEn
                  ? 'Rolling the dice... Randomly selecting who plays first!'
                  : 'Kura çekiliyor... Oyuna ilk başlayacak şanslı oyuncu belirleniyor!'
                : isMeWinner
                ? isEn
                  ? 'Luck is on your side! Take your time and make your first move.'
                  : 'Kura senin lehine sonuçlandı! İlk hamleni yaparak oyunu başlat.'
                : isEn
                ? `${winnerPlayer?.username} won the starting draw and will take the first turn.`
                : `${winnerPlayer?.username} kurayı kazandı ve oyuna ilk başlayacak.`}
            </p>
          </div>

          {/* Player Carousel / Grid */}
          <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 my-2">
            {players.map((p, idx) => {
              const isCurrentHighlighted = idx === activeIdx;
              const isWinner = isFinalized && winnerPlayer?.id === p.id;
              const isLocal = p.id === localPlayerId;
              const countryInfo = getCountryByCode(p.country);

              return (
                <motion.div
                  key={p.id}
                  animate={{
                    scale: isWinner ? 1.08 : isCurrentHighlighted ? 1.05 : 0.94,
                    y: isWinner ? -6 : isCurrentHighlighted ? -4 : 0,
                    opacity: isFinalized ? (isWinner ? 1 : 0.4) : isCurrentHighlighted ? 1 : 0.45,
                  }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className={`relative rounded-2xl p-3 sm:p-4 flex flex-col items-center gap-2 border transition-all ${
                    isWinner
                      ? 'bg-gradient-to-b from-emerald-500/25 via-slate-900 to-amber-500/20 border-emerald-400/90 shadow-[0_0_35px_rgba(16,185,129,0.7)] ring-2 ring-emerald-400/50'
                      : isCurrentHighlighted
                      ? 'bg-gradient-to-b from-amber-500/25 to-slate-900 border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.6)] ring-2 ring-amber-400/40'
                      : 'bg-slate-950/60 border-white/10'
                  }`}
                >
                  {/* Floating Winner Crown / Highlighter Badge */}
                  {isWinner && (
                    <motion.div
                      initial={{ scale: 0, y: 10 }}
                      animate={{ scale: 1, y: -18 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                      className="absolute -top-1 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-wider shadow-lg flex items-center gap-1 z-20"
                    >
                      <span>👑</span>
                      <span>{isEn ? '1ST TURN' : '1. SIRA'}</span>
                    </motion.div>
                  )}

                  {/* Team Tag if 2v2 */}
                  {p.team && (
                    <div
                      className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                        p.team === 'team_blue'
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          : 'bg-red-500/20 text-red-300 border border-red-500/30'
                      }`}
                    >
                      {p.team === 'team_blue' ? (isEn ? 'Blue Team' : 'Mavi Takım') : (isEn ? 'Red Team' : 'Kırmızı Takım')}
                    </div>
                  )}

                  {/* Avatar */}
                  <div className="relative my-1">
                    <AvatarWithFrame
                      avatarId={p.avatarId || 'avatar_classic'}
                      avatarUrl={p.avatarUrl}
                      frameId={p.profileFrame || 'frame_none'}
                      sizeClassName="w-14 h-14 sm:w-16 sm:h-16 text-xl sm:text-2xl"
                    />
                    {isLocal && (
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.2 bg-indigo-600 text-white text-[8px] font-bold rounded-full uppercase tracking-tighter border border-white/20">
                        {isEn ? 'YOU' : 'SEN'}
                      </span>
                    )}
                  </div>

                  {/* Username & Flag */}
                  <div className="w-full flex flex-col items-center">
                    <div className="flex items-center gap-1 max-w-full">
                      <span className="text-xs shrink-0" title={isEn ? countryInfo.nameEn : countryInfo.nameTr}>
                        {countryInfo.flag}
                      </span>
                      <span className="text-xs sm:text-sm font-extrabold text-white truncate max-w-[100px] sm:max-w-[120px]">
                        {p.username}
                      </span>
                    </div>

                    {p.isBot && (
                      <span className="text-[9px] text-amber-400/90 font-semibold mt-0.5">
                        🤖 {isEn ? 'AI Bot' : 'Yapay Zeka'}
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Celebratory Particles & Sparkles (Visible when Winner is Announced) */}
          {isFinalized && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-4 flex items-center justify-center gap-2 text-amber-300 font-bold text-xs sm:text-sm animate-pulse"
            >
              <span>✨</span>
              <span>
                {isMeWinner
                  ? isEn
                    ? 'Good luck! Starting your turn...'
                    : 'Bol şans! Oyun sırası sende...'
                  : isEn
                  ? 'Game is starting...'
                  : 'Oyun başlıyor...'}
              </span>
              <span>✨</span>
            </motion.div>
          )}

          {/* Skip / Fast Start Button */}
          <div className="mt-5 w-full flex justify-center">
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 text-xs font-bold text-slate-200 hover:text-white transition-all border border-white/15 cursor-pointer flex items-center gap-2"
            >
              <span>{isEn ? 'Start Game' : 'Hemen Başla (Geç)'}</span>
              <span className="text-amber-400">➜</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
