import React from 'react';
import { HlsVideoPlayer, isVideoUrl } from './HlsVideoPlayer';

interface AvatarWithFrameProps {
  avatarId: string;
  avatarUrl?: string;
  frameId?: string;
  sizeClassName?: string;
}

export const AVATAR_EMOJIS_MAP: Record<string, string> = {
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

export const AvatarWithFrame: React.FC<AvatarWithFrameProps> = ({
  avatarId,
  avatarUrl,
  frameId = 'frame_none',
  sizeClassName = 'w-16 h-16 text-3xl'
}) => {
  const effectiveUrl = avatarUrl || (avatarId && (avatarId.startsWith('http') || avatarId.startsWith('/') || avatarId.startsWith('data:')) ? avatarId : undefined);
  const emoji = AVATAR_EMOJIS_MAP[avatarId] || (avatarId && avatarId.startsWith('shop_') ? '🌟' : '👑');
  
  // Custom frame styles
  let frameClass = 'border border-white/10';
  let glowStyle: React.CSSProperties = {};
  
  if (frameId === 'frame_neon') {
    frameClass = 'border-[3px] border-pink-500 animate-pulse';
    glowStyle = { 
      boxShadow: '0 0 15px #ec4899, inset 0 0 10px #ec4899'
    };
  } else if (frameId === 'frame_gold') {
    frameClass = 'border-[3px] border-amber-400 bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 animate-pulse';
    glowStyle = { 
      boxShadow: '0 0 15px #fbbf24, inset 0 0 10px #d97706'
    };
  } else if (frameId === 'frame_fire') {
    frameClass = 'border-[3px] border-red-500 frame-lava-flow bg-gradient-to-r from-red-600 via-orange-500 to-red-600';
    glowStyle = { 
      boxShadow: '0 0 18px #ef4444, inset 0 0 10px #f97316'
    };
  } else if (frameId === 'frame_royal') {
    frameClass = 'border-[3px] border-cyan-400 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 animate-pulse';
    glowStyle = { 
      boxShadow: '0 0 15px #22d3ee, inset 0 0 10px #3b82f6'
    };
  } else if (frameId === 'frame_plasma') {
    frameClass = 'border-[3px] border-sky-400 bg-gradient-to-r from-sky-400 via-indigo-500 to-cyan-400 animate-pulse';
    glowStyle = { 
      boxShadow: '0 0 20px #38bdf8, inset 0 0 10px #6366f1'
    };
  } else if (frameId === 'frame_rainbow') {
    frameClass = 'border-[3px] border-rose-500 frame-rainbow-cycle bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500';
    glowStyle = { 
      boxShadow: '0 0 20px #ec4899, inset 0 0 10px #3b82f6'
    };
  } else if (frameId === 'frame_toxic') {
    frameClass = 'border-[3px] border-emerald-400 bg-gradient-to-r from-emerald-600 via-green-400 to-emerald-600 animate-pulse';
    glowStyle = { 
      boxShadow: '0 0 18px #34d399, inset 0 0 8px #059669'
    };
  } else if (frameId === 'frame_ice') {
    frameClass = 'border-[3px] border-blue-200 frame-ice-shimmer bg-gradient-to-r from-blue-300 via-cyan-200 to-blue-300';
    glowStyle = { 
      boxShadow: '0 0 18px #93c5fd, inset 0 0 10px #22d3ee'
    };
  } else if (frameId === 'frame_steampunk') {
    frameClass = 'border-[3px] border-amber-700 frame-steampunk-spin bg-gradient-to-r from-amber-800 via-zinc-600 to-amber-900';
    glowStyle = { 
      boxShadow: '0 0 15px #b45309, inset 0 0 10px #78350f'
    };
  } else if (frameId === 'frame_matrix') {
    frameClass = 'border-[3px] border-green-500 frame-matrix-rain bg-gradient-to-r from-green-600 via-black to-green-700';
    glowStyle = { 
      boxShadow: '0 0 15px #22c55e, inset 0 0 10px #15803d'
    };
  } else if (frameId === 'frame_thunder') {
    frameClass = 'border-[3px] border-yellow-400 frame-thunder-active bg-gradient-to-r from-yellow-500 via-amber-300 to-yellow-500';
    glowStyle = { 
      boxShadow: '0 0 22px #facc15, inset 0 0 12px #ca8a04'
    };
  } else if (frameId === 'frame_darkness') {
    frameClass = 'border-[3px] border-purple-950 frame-void-active bg-gradient-to-r from-slate-950 via-purple-900 to-black';
    glowStyle = { 
      boxShadow: '0 0 20px #581c87, inset 0 0 10px #3b0764'
    };
  } else if (frameId === 'frame_galaxy') {
    frameClass = 'border-[3px] border-violet-400 frame-galaxy-rotate bg-gradient-to-r from-indigo-950 via-purple-500 to-indigo-900';
    glowStyle = { 
      boxShadow: '0 0 20px #8b5cf6, inset 0 0 10px #4f46e5'
    };
  } else if (frameId === 'frame_dragon') {
    frameClass = 'border-[3px] border-rose-700 frame-lava-flow bg-gradient-to-r from-rose-900 via-red-500 to-rose-950';
    glowStyle = { 
      boxShadow: '0 0 20px #be123c, inset 0 0 10px #9f1239'
    };
  } else if (frameId === 'frame_snowstorm') {
    frameClass = 'border-[3px] border-blue-100 frame-ice-shimmer bg-gradient-to-r from-blue-200 via-sky-300 to-indigo-300';
    glowStyle = { 
      boxShadow: '0 0 18px #e0f2fe, inset 0 0 8px #bae6fd'
    };
  } else if (frameId && frameId !== 'frame_none') {
    // Dynamic fallback for custom shop frames
    frameClass = 'border-[3px] border-amber-400 bg-gradient-to-r from-amber-500 via-purple-500 to-indigo-500 animate-pulse';
    glowStyle = {
      boxShadow: '0 0 18px rgba(245,158,11,0.6), inset 0 0 10px rgba(168,85,247,0.4)'
    };
  }
  
  return (
    <div 
      id={`avatar-frame-${frameId}`}
      className={`${sizeClassName} rounded-full flex items-center justify-center font-bold text-white shadow-xl relative transition-all duration-300 p-0.5 overflow-hidden ${frameClass}`}
      style={glowStyle}
    >
      <div className="w-full h-full rounded-full bg-slate-900/95 flex items-center justify-center overflow-hidden">
        {effectiveUrl ? (
          isVideoUrl(effectiveUrl) ? (
            <HlsVideoPlayer
              src={effectiveUrl}
              className="w-full h-full object-cover rounded-full"
            />
          ) : (
            <img 
              src={effectiveUrl} 
              alt="Avatar" 
              className="w-full h-full object-cover rounded-full"
              referrerPolicy="no-referrer"
            />
          )
        ) : (
          <span className="select-none scale-110">{emoji}</span>
        )}
      </div>
    </div>
  );
};
