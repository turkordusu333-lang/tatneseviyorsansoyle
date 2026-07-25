import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { sounds } from '../lib/SoundSystem';
import { UserProfile } from '../types';

export interface ToastItem {
  id: string;
  type: 'achievement' | 'unlock';
  title: string;
  message: string;
  description: string;
  emoji?: string;
  category?: string;
  rewardCoins?: number;
}

interface Props {
  profile: UserProfile | null;
}

export const GlobalToast: React.FC<Props> = ({ profile }) => {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  React.useEffect(() => {
    const handleToastEvent = (e: Event) => {
      const customEvent = e as CustomEvent<Omit<ToastItem, 'id'>>;
      const newToast: ToastItem = {
        ...customEvent.detail,
        id: Math.random().toString(),
      };

      setToasts((prev) => [...prev, newToast]);

      if (profile) {
        if (newToast.type === 'achievement') {
          sounds.playCelebration('sound_applause', profile.settings);
        } else {
          sounds.playCoin(profile.settings);
        }
      }

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
      }, 5000);
    };

    window.addEventListener('show-global-toast', handleToastEvent);
    return () => {
      window.removeEventListener('show-global-toast', handleToastEvent);
    };
  }, [profile]);

  return (
    <div id="global-toast-container" className="fixed bottom-4 right-4 z-[99999] pointer-events-none flex flex-col gap-3 w-full max-w-sm px-4 sm:px-0">
      <AnimatePresence>
        {toasts.map((toast) => {
          const isAch = toast.type === 'achievement';
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 100, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.9 }}
              className={`pointer-events-auto w-full p-4 rounded-2xl border backdrop-blur-xl flex gap-3.5 shadow-2xl transition-all ${
                isAch
                  ? 'bg-amber-950/85 border-amber-500/40 shadow-[0_0_30px_rgba(234,179,8,0.3)]'
                  : 'bg-cyan-950/85 border-cyan-500/40 shadow-[0_0_30px_rgba(6,182,212,0.3)]'
              }`}
            >
              {/* Icon/Emoji Box */}
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-2xl flex-shrink-0 bg-gradient-to-br ${
                  isAch
                    ? 'from-amber-400 to-yellow-600 text-slate-950 border border-amber-300/30'
                    : 'from-cyan-400 to-blue-600 text-white border border-cyan-300/30'
                }`}
              >
                {toast.emoji || (isAch ? '🏆' : '🎁')}
              </div>

              {/* Text content */}
              <div className="flex-1 min-w-0 font-sans">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-[9px] font-black uppercase tracking-widest ${
                      isAch ? 'text-amber-400' : 'text-cyan-400'
                    }`}
                  >
                    {toast.title}
                  </span>
                  {isAch && toast.rewardCoins && (
                    <span className="text-[10px] font-bold text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                      💰 +{toast.rewardCoins}M
                    </span>
                  )}
                </div>
                <h4 className="text-sm font-black text-white truncate mt-1">{toast.message}</h4>
                <p className="text-xs text-slate-300 leading-snug mt-1">{toast.description}</p>
                
                {/* Item category badge if unlock */}
                {toast.type === 'unlock' && toast.category && (
                  <span className="inline-block text-[9px] font-extrabold text-slate-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full uppercase tracking-wider mt-2">
                    {toast.category.replace('_', ' ')}
                  </span>
                )}
              </div>

              {/* Close Button */}
              <button
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                className="text-slate-400 hover:text-white self-start text-xs p-1 cursor-pointer"
              >
                ✕
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
