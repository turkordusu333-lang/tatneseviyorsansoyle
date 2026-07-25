import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../lib/apiConfig';

interface AvatarWithFrameProps {
  avatarId: string;
  avatarUrl?: string;
  frameId?: string;
  sizeClassName?: string;
  customFrameItem?: any;
  prestigeBadge?: string;
}

let cachedStoreCatalog: any[] = [];
let fetchPromise: Promise<any> | null = null;

export const loadGlobalStoreCatalog = (forceRefresh: boolean = false) => {
  if (!forceRefresh && cachedStoreCatalog.length > 0) return Promise.resolve(cachedStoreCatalog);
  if (!forceRefresh && fetchPromise) return fetchPromise;
  fetchPromise = fetch(`${API_BASE_URL}/api/admin/store-items?t=${Date.now()}`)
    .then(res => res.json())
    .then(data => {
      if (Array.isArray(data)) {
        cachedStoreCatalog = data;
      }
      return cachedStoreCatalog;
    })
    .catch(() => cachedStoreCatalog)
    .finally(() => {
      fetchPromise = null;
    });
  return fetchPromise;
};

export const AvatarWithFrame: React.FC<AvatarWithFrameProps> = ({
  avatarId,
  avatarUrl,
  frameId = 'frame_none',
  sizeClassName = 'w-16 h-16 text-3xl',
  customFrameItem,
  prestigeBadge
}) => {
  const [storeCatalog, setStoreCatalog] = useState<any[]>(cachedStoreCatalog);

  useEffect(() => {
    loadGlobalStoreCatalog().then(items => {
      if (items && Array.isArray(items) && items.length > 0) {
        setStoreCatalog(items);
      }
    });
  }, []);

  const resolvedAvatarItem = avatarUrl ? null : storeCatalog.find(i => i.id === avatarId);
  const effectiveAvatarUrl = avatarUrl || resolvedAvatarItem?.mediaUrl;

  const resolvedFrameItem = customFrameItem || storeCatalog.find(i => i.id === frameId);

  const emoji = 
    avatarId === 'avatar_classic' ? '🎩' 
    : avatarId === 'avatar_skater' ? '🛹' 
    : avatarId === 'avatar_neon' ? '🌌' 
    : avatarId === 'avatar_golden' ? '👑'
    : avatarId === 'avatar_alien' ? '👽'
    : avatarId === 'avatar_ninja' ? '🥷'
    : avatarId === 'avatar_wizard' ? '🧙'
    : avatarId === 'avatar_dragon' ? '🐉'
    : avatarId === 'avatar_astronaut' ? '🧑‍🚀'
    : avatarId === 'avatar_robot' ? '🤖'
    : avatarId === 'avatar_dj' ? '🎧'
    : avatarId === 'avatar_ghost' ? '👻'
    : avatarId === 'avatar_knight' ? '🛡️'
    : avatarId === 'avatar_unicorn' ? '🦄'
    : avatarId === 'avatar_pharaoh' ? '👑'
    : avatarId === 'avatar_zombie' ? '🧟'
    : '🎩';
  
  // Custom frame styles based on preset ID or dynamic options
  let frameClass = 'border border-white/10';
  let glowStyle: React.CSSProperties = {};
  
  if (resolvedFrameItem?.options) {
    const opts = resolvedFrameItem.options;
    let gradientStr = '#ec4899, #3b82f6';
    if (opts.gradientColors) {
      if (Array.isArray(opts.gradientColors) && opts.gradientColors.length > 0) {
        gradientStr = opts.gradientColors.join(', ');
      } else if (typeof opts.gradientColors === 'string' && opts.gradientColors.trim().length > 0) {
        gradientStr = opts.gradientColors.trim();
      }
    }
    const anim = opts.animation || 'none';
    let animClass = '';
    if (anim === 'rotate') animClass = 'animate-spin-slow';
    if (anim === 'pulse') animClass = 'animate-pulse';
    if (anim === 'wave') animClass = 'animate-bounce-gentle';
    if (anim === 'shake' || opts.shake) animClass += ' animate-shake';
    if (anim === 'lava_flow') animClass += ' frame-lava-flow';
    if (anim === 'rainbow_hue') animClass += ' frame-rainbow-cycle';

    frameClass = animClass;
    glowStyle = {
      background: `linear-gradient(135deg, ${gradientStr})`,
      boxShadow: opts.useGlow !== false && (opts.glow || opts.glowColor) ? `0 0 18px ${opts.glowColor || '#ec4899'}` : undefined,
      borderWidth: `${opts.borderWidth || 3}px`,
      borderStyle: 'solid',
      borderColor: opts.borderColor || 'transparent',
    };
  } else if (frameId === 'frame_neon') {
    frameClass = 'border-[3px] border-pink-500 animate-pulse';
    glowStyle = { boxShadow: '0 0 15px #ec4899, inset 0 0 10px #ec4899' };
  } else if (frameId === 'frame_gold') {
    frameClass = 'border-[3px] border-amber-400 bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 animate-pulse';
    glowStyle = { boxShadow: '0 0 15px #fbbf24, inset 0 0 10px #d97706' };
  } else if (frameId === 'frame_fire') {
    frameClass = 'border-[3px] border-red-500 frame-lava-flow bg-gradient-to-r from-red-600 via-orange-500 to-red-600';
    glowStyle = { boxShadow: '0 0 18px #ef4444, inset 0 0 10px #f97316' };
  } else if (frameId === 'frame_royal') {
    frameClass = 'border-[3px] border-cyan-400 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 animate-pulse';
    glowStyle = { boxShadow: '0 0 15px #22d3ee, inset 0 0 10px #3b82f6' };
  } else if (frameId === 'frame_plasma') {
    frameClass = 'border-[3px] border-sky-400 bg-gradient-to-r from-sky-400 via-indigo-500 to-cyan-400 animate-pulse';
    glowStyle = { boxShadow: '0 0 20px #38bdf8, inset 0 0 10px #6366f1' };
  } else if (frameId === 'frame_rainbow') {
    frameClass = 'border-[3px] border-rose-500 frame-rainbow-cycle bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500';
    glowStyle = { boxShadow: '0 0 20px #ec4899, inset 0 0 10px #3b82f6' };
  } else if (frameId === 'frame_toxic') {
    frameClass = 'border-[3px] border-emerald-400 bg-gradient-to-r from-emerald-600 via-green-400 to-emerald-600 animate-pulse';
    glowStyle = { boxShadow: '0 0 18px #34d399, inset 0 0 8px #059669' };
  } else if (frameId === 'frame_ice') {
    frameClass = 'border-[3px] border-blue-200 frame-ice-shimmer bg-gradient-to-r from-blue-300 via-cyan-200 to-blue-300';
    glowStyle = { boxShadow: '0 0 18px #93c5fd, inset 0 0 10px #22d3ee' };
  } else if (frameId === 'frame_steampunk') {
    frameClass = 'border-[3px] border-amber-700 frame-steampunk-spin bg-gradient-to-r from-amber-800 via-zinc-600 to-amber-900';
    glowStyle = { boxShadow: '0 0 15px #b45309, inset 0 0 10px #78350f' };
  } else if (frameId === 'frame_matrix') {
    frameClass = 'border-[3px] border-green-500 frame-matrix-rain bg-gradient-to-r from-green-600 via-black to-green-700';
    glowStyle = { boxShadow: '0 0 15px #22c55e, inset 0 0 10px #15803d' };
  } else if (frameId === 'frame_thunder') {
    frameClass = 'border-[3px] border-yellow-400 frame-thunder-active bg-gradient-to-r from-yellow-500 via-amber-300 to-yellow-500';
    glowStyle = { boxShadow: '0 0 22px #facc15, inset 0 0 12px #ca8a04' };
  } else if (frameId === 'frame_darkness') {
    frameClass = 'border-[3px] border-purple-950 frame-void-active bg-gradient-to-r from-slate-950 via-purple-900 to-black';
    glowStyle = { boxShadow: '0 0 20px #581c87, inset 0 0 10px #3b0764' };
  } else if (frameId === 'frame_galaxy') {
    frameClass = 'border-[3px] border-violet-400 frame-galaxy-rotate bg-gradient-to-r from-indigo-950 via-purple-500 to-indigo-900';
    glowStyle = { boxShadow: '0 0 20px #8b5cf6, inset 0 0 10px #4f46e5' };
  } else if (frameId === 'frame_dragon') {
    frameClass = 'border-[3px] border-rose-700 frame-lava-flow bg-gradient-to-r from-rose-900 via-red-500 to-rose-950';
    glowStyle = { boxShadow: '0 0 20px #be123c, inset 0 0 10px #9f1239' };
  } else if (frameId === 'frame_snowstorm') {
    frameClass = 'border-[3px] border-blue-100 frame-ice-shimmer bg-gradient-to-r from-blue-200 via-sky-300 to-indigo-300';
    glowStyle = { boxShadow: '0 0 18px #e0f2fe, inset 0 0 8px #bae6fd' };
  }
  
  // Check if avatar url is a video
  const isVideo = effectiveAvatarUrl && (effectiveAvatarUrl.endsWith('.mp4') || effectiveAvatarUrl.endsWith('.webm') || effectiveAvatarUrl.includes('video'));

  // Check if frame has a video/GIF overlay
  const frameVideoUrl = resolvedFrameItem?.options?.frameVideoUrl || (resolvedFrameItem?.category === 'profile_frame' && resolvedFrameItem?.mediaUrl ? resolvedFrameItem.mediaUrl : null);
  const isFrameVideo = frameVideoUrl && (frameVideoUrl.endsWith('.mp4') || frameVideoUrl.endsWith('.webm') || frameVideoUrl.includes('video'));

  // Check prestige badge level
  const badgeLevel = prestigeBadge || resolvedFrameItem?.options?.badgeLevel;

  return (
    <div className="relative inline-block select-none">
      <div 
        id={`avatar-frame-${frameId}`}
        className={`${sizeClassName} rounded-full flex items-center justify-center font-bold text-white shadow-xl relative transition-all duration-300 p-0.5 overflow-hidden ${frameClass}`}
        style={glowStyle}
      >
        {/* Animated Video Frame Overlay */}
        {frameVideoUrl && (
          <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden rounded-full mix-blend-screen opacity-90">
            {isFrameVideo ? (
              <video src={frameVideoUrl} autoPlay loop muted className="w-full h-full object-cover rounded-full" />
            ) : (
              <img src={frameVideoUrl} alt="Frame FX" className="w-full h-full object-cover rounded-full" />
            )}
          </div>
        )}

        <div className="w-full h-full rounded-full bg-slate-900/95 flex items-center justify-center overflow-hidden relative z-10">
          {isVideo ? (
            <video 
              src={effectiveAvatarUrl} 
              autoPlay 
              loop 
              muted 
              className="w-full h-full object-cover rounded-full"
            />
          ) : effectiveAvatarUrl ? (
            <img 
              src={effectiveAvatarUrl} 
              alt="Avatar" 
              className="w-full h-full object-cover rounded-full"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="select-none scale-110">{emoji}</span>
          )}
        </div>
      </div>

      {/* Prestige Badge Overlay */}
      {badgeLevel && (
        <div 
          className="absolute -bottom-1 -right-1 z-30 bg-slate-950/90 border border-amber-400/60 rounded-full w-5 h-5 flex items-center justify-center text-[10px] shadow-lg animate-pulse"
          title={`Prestij Seviyesi: ${badgeLevel.toUpperCase()}`}
        >
          {badgeLevel === 'vip' ? '👑' : badgeLevel === 'mythic' ? '💎' : badgeLevel === 'legendary' ? '⚡' : '🌟'}
        </div>
      )}
    </div>
  );
};
