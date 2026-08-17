import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Tv, RotateCw, Sparkles, Coins, Trophy, 
  Play, Volume2, AlertCircle, Clock, CheckCircle 
} from 'lucide-react';
import { UserProfile } from '../types';
import { t } from '../lib/TranslationSystem';
import { sounds } from '../lib/SoundSystem';
import { Capacitor } from '@capacitor/core';
import { adMobService } from '../lib/adMobService';

interface LuckyWheelProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile | null;
  onUpdateProfile: (updated: UserProfile) => void;
  adminSettings: any;
}

export const LuckyWheel: React.FC<LuckyWheelProps> = ({
  isOpen,
  onClose,
  profile,
  onUpdateProfile,
  adminSettings,
}) => {
  // Config from admin panel (with defaults)
  const isEnabled = adminSettings?.wheelEnabled !== false;
  const cooldownMinutes = adminSettings?.wheelCooldownMinutes ?? 60;
  const adDuration = adminSettings?.wheelAdDurationSeconds ?? 8;

  // Google AdMob settings (Defaults to false for real AdMob production ads)
  const isTesting = adminSettings?.wheelAdMobTestingMode === true;
  const androidAdUnitId = adminSettings?.wheelAdMobAndroidAdUnitId || 'ca-app-pub-5045652074166668/6893680557';
  const iosAdUnitId = adminSettings?.wheelAdMobiOSAdUnitId || 'ca-app-pub-3940256099942544/1712485313';
  
  // Choose correct Ad Unit ID
  const platform = Capacitor.getPlatform();
  const activeAdUnitId = platform === 'ios' ? iosAdUnitId : androidAdUnitId;
  
  const rewards = [
    { id: 1, val: adminSettings?.wheelReward1 ?? 50, type: 'coins', label: 'Gold', color: '#1e1b4b', text: '#facc15' },    // Dark Purple / Gold
    { id: 2, val: adminSettings?.wheelReward2 ?? 100, type: 'coins', label: 'Gold', color: '#0f172a', text: '#e2e8f0' },   // Slate / White
    { id: 3, val: adminSettings?.wheelReward3 ?? 200, type: 'coins', label: 'Gold', color: '#1e1b4b', text: '#facc15' },    // Dark Purple / Gold
    { id: 4, val: adminSettings?.wheelReward4 ?? 500, type: 'coins', label: 'Gold', color: '#0f172a', text: '#e2e8f0' },   // Slate / White
    { id: 5, val: adminSettings?.wheelReward5 ?? 1000, type: 'coins', label: 'Mega Gold', color: '#b45309', text: '#fffbeb', isSpecial: true }, // Amber/White
    { id: 6, val: adminSettings?.wheelReward6 ?? 25, type: 'xp', label: 'XP', color: '#065f46', text: '#d1fae5' }          // Emerald / Mint
  ];

  const [isSpinning, setIsSpinning] = useState(false);
  const [wheelAngle, setWheelAngle] = useState(0);
  const [cooldownRemaining, setCooldownRemaining] = useState<string | null>(null);
  const [canFreeSpin, setCanFreeSpin] = useState(true);
  
  // Web ad simulation states
  const [showAdModal, setShowAdModal] = useState(false);
  const [adTimer, setAdTimer] = useState(0);
  const [adSkippedWarning, setAdSkippedWarning] = useState(false);

  // Native AdMob states
  const [isNativeAdLoading, setIsNativeAdLoading] = useState(false);
  const [admobError, setAdmobError] = useState<string | null>(null);

  const [rewardWon, setRewardWon] = useState<any | null>(null);
  const [showRewardModal, setShowRewardModal] = useState(false);

  const spinIntervalRef = useRef<any>(null);

  // Initialize AdMob on Native Platforms
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      adMobService.initialize(isTesting).catch((err) => {
        console.warn('AdMob initialization error:', err);
      });
    }
  }, [isTesting]);

  // Sound and timing setup
  useEffect(() => {
    if (!isOpen || !profile) return;

    const checkCooldown = () => {
      if (!profile.lastLuckyWheelSpin) {
        setCanFreeSpin(true);
        setCooldownRemaining(null);
        return;
      }

      const lastSpin = new Date(profile.lastLuckyWheelSpin).getTime();
      const now = Date.now();
      const diffMs = now - lastSpin;
      const cooldownMs = cooldownMinutes * 60 * 1000;

      if (diffMs < cooldownMs) {
        setCanFreeSpin(false);
        const remainingMs = cooldownMs - diffMs;
        
        // Format mm:ss or hh:mm:ss
        const totalSecs = Math.floor(remainingMs / 1000);
        const hrs = Math.floor(totalSecs / 3600);
        const mins = Math.floor((totalSecs % 3600) / 60);
        const secs = totalSecs % 60;

        const formatted = hrs > 0 
          ? `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
          : `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        
        setCooldownRemaining(formatted);
      } else {
        setCanFreeSpin(true);
        setCooldownRemaining(null);
      }
    };

    checkCooldown();
    const interval = setInterval(checkCooldown, 1000);
    return () => clearInterval(interval);
  }, [isOpen, profile, cooldownMinutes]);

  // Handle ad-watching countdown
  useEffect(() => {
    let timer: any;
    if (showAdModal && adTimer > 0) {
      timer = setTimeout(() => {
        setAdTimer((prev) => prev - 1);
      }, 1000);
    } else if (showAdModal && adTimer === 0) {
      // Ad finished playing completely!
      setShowAdModal(false);
      triggerSpin(true); // Spin the wheel as ad reward!
    }
    return () => clearTimeout(timer);
  }, [showAdModal, adTimer]);

  if (!isOpen || !profile) return null;

  // Weighted random picker
  const pickWeightedReward = () => {
    const weights = [35, 25, 20, 12, 3, 5]; // Wedge 1 to 6 probabilities (sum is 100)
    const random = Math.floor(Math.random() * 100);
    
    let cumulative = 0;
    for (let i = 0; i < weights.length; i++) {
      cumulative += weights[i];
      if (random < cumulative) {
        return rewards[i];
      }
    }
    return rewards[0];
  };

  const playNativeAdMobAd = async () => {
    if (isSpinning || isNativeAdLoading) return;
    setIsNativeAdLoading(true);
    setAdmobError(null);

    try {
      const result = await adMobService.showRewardedAd({
        customAdUnitId: activeAdUnitId,
        isTesting,
        onAdLoaded: () => {
          setIsNativeAdLoading(false);
        },
        onAdFailedToLoad: (err) => {
          setIsNativeAdLoading(false);
          setAdmobError(profile.settings.language === 'en' ? 'Ad could not be loaded. Please try again later.' : 'Reklam yüklenemedi (AdMob No Fill / Bağlantı). Lütfen daha sonra tekrar deneyin.');
        },
        onAdDismissed: () => {
          setIsNativeAdLoading(false);
        },
      });

      setIsNativeAdLoading(false);
      if (result.rewardEarned) {
        triggerSpin(true); // Spin wheel as ad reward!
      } else if (result.error) {
        setAdmobError(result.error);
      } else {
        setAdmobError(profile.settings.language === 'en' ? 'You must watch the full ad to earn the spin.' : 'Ödül kazanmak için reklamı sonuna kadar izlemelisiniz.');
      }
    } catch (error: any) {
      console.error('AdMob flow exception:', error);
      setIsNativeAdLoading(false);
      setAdmobError(error?.message || (profile.settings.language === 'en' ? 'Error loading ad.' : 'Reklam yüklenirken bir hata oluştu.'));
    }
  };

  const startSpinFlow = () => {
    if (isSpinning || isNativeAdLoading) return;

    if (!canFreeSpin) {
      // Must watch an ad to spin!
      sounds.playPlay(profile.settings);
      
      if (Capacitor.isNativePlatform()) {
        playNativeAdMobAd();
      } else {
        // Fallback: Web simulation
        setAdTimer(adDuration);
        setShowAdModal(true);
        setAdSkippedWarning(false);
      }
    } else {
      // Free spin!
      triggerSpin(false);
    }
  };

  const triggerSpin = (isFromAd: boolean) => {
    if (isSpinning) return;
    setIsSpinning(true);
    setRewardWon(null);

    sounds.playAction(profile.settings);

    // Pick the reward
    const selectedReward = pickWeightedReward();
    
    // Calculate angle: 6 sectors, each sector is 60 degrees.
    // Wedge 1 is 0-60 deg, centered at 30 deg.
    // Wedge 2 is 60-120 deg, centered at 90 deg.
    // Wedge 3 is 120-180 deg, centered at 150 deg.
    // Wedge 4 is 180-240 deg, centered at 210 deg.
    // Wedge 5 is 240-300 deg, centered at 270 deg.
    // Wedge 6 is 300-360 deg, centered at 330 deg.
    // Target pointer is at the very top (270 degrees in standard polar coords, or let's assume SVG rotated so top is 0 deg offset).
    // Let's design the pointer at 0 deg (top).
    // If pointer is at 0 deg (top), winning wedge is at index `selectedIdx`.
    // The degree to align index `idx` to the top is: `360 - (idx * 60) - 30`.
    const selectedIdx = rewards.findIndex(r => r.id === selectedReward.id);
    const targetSectorCenter = (selectedIdx * 60) + 30;
    const alignWithTopDeg = (360 - targetSectorCenter) % 360;

    // Minimum 6 full spins (2160 degrees) for visual suspense
    const extraSpins = 360 * 7; 
    const finalAngle = extraSpins + alignWithTopDeg;

    setWheelAngle(finalAngle);

    // Audio click ticker during spin
    let lastTickAngle = 0;
    const startTime = Date.now();
    const duration = 5000; // 5 seconds spin animation

    if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
    
    spinIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      if (elapsed >= duration) {
        clearInterval(spinIntervalRef.current);
        return;
      }

      // Cubic ease-out approximation for angle calculation to sync clicks
      const t = elapsed / duration;
      const easeOut = 1 - Math.pow(1 - t, 3);
      const currentAngle = finalAngle * easeOut;

      if (currentAngle - lastTickAngle >= 30) {
        sounds.playDraw(profile.settings);
        lastTickAngle = currentAngle;
      }
    }, 30);

    // Stop spin and award player
    setTimeout(() => {
      setIsSpinning(false);
      setRewardWon(selectedReward);
      setShowRewardModal(true);

      // Play victory sound for special or high rewards
      if (selectedReward.isSpecial || selectedReward.val >= 500) {
        sounds.playVictory(profile.settings);
      } else {
        sounds.playCoin(profile.settings);
      }

      // Update user state and persist
      const updatedProfile = { ...profile };
      
      if (selectedReward.type === 'coins') {
        updatedProfile.coins += selectedReward.val;
      } else if (selectedReward.type === 'xp') {
        updatedProfile.xp += selectedReward.val;
        updatedProfile.level = Math.floor(updatedProfile.xp / 500) + 1;
      }

      // Only set cooldown timestamp if it was a free spin (keeps it fair, ads are always spinnable!)
      if (!isFromAd) {
        updatedProfile.lastLuckyWheelSpin = new Date().toISOString();
      }

      onUpdateProfile(updatedProfile);
    }, duration + 200);
  };

  const handleCloseAdModalAttempt = () => {
    // Show a warning instead of letting them exit instantly
    setAdSkippedWarning(true);
  };

  const forceCloseAd = () => {
    setShowAdModal(false);
    setAdSkippedWarning(false);
  };

  const renderWheel = () => {
    return (
      <div className="relative w-72 h-72 md:w-80 md:h-80 mx-auto flex items-center justify-center">
        {/* Outer glowing gold ring */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-b from-yellow-400 to-amber-600 p-1 shadow-[0_0_40px_rgba(234,179,8,0.25)] animate-pulse">
          <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center overflow-hidden relative">
            
            {/* Spinning Canvas/SVG Container */}
            <motion.div
              style={{ rotate: wheelAngle }}
              transition={isSpinning ? { duration: 5, ease: [0.25, 0.1, 0.25, 1] } : { duration: 0 }}
              className="w-full h-full relative"
            >
              <svg viewBox="0 0 200 200" className="w-full h-full">
                {rewards.map((reward, idx) => {
                  const startAngle = idx * 60;
                  const endAngle = startAngle + 60;
                  
                  // Convert polar to cartesian coordinates
                  const rad1 = (startAngle - 90) * Math.PI / 180;
                  const rad2 = (endAngle - 90) * Math.PI / 180;
                  const r = 98;
                  const x1 = 100 + r * Math.cos(rad1);
                  const y1 = 100 + r * Math.sin(rad1);
                  const x2 = 100 + r * Math.cos(rad2);
                  const y2 = 100 + r * Math.sin(rad2);
                  
                  // Large arc flag is always 0 because sweep is 60 deg (< 180)
                  const d = `M 100 100 L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`;
                  
                  // Label coordinates (centered inside slice)
                  const midRad = (startAngle + 30 - 90) * Math.PI / 180;
                  const textR = 65;
                  const textX = 100 + textR * Math.cos(midRad);
                  const textY = 100 + textR * Math.sin(midRad);
                  const textRotation = startAngle + 30;

                  return (
                    <g key={reward.id} className="cursor-pointer">
                      {/* Wedge path */}
                      <path
                        d={d}
                        fill={reward.color}
                        stroke="#eab308"
                        strokeWidth="1.2"
                      />
                      {/* Text reward label */}
                      <g transform={`translate(${textX}, ${textY}) rotate(${textRotation})`}>
                        <text
                          textAnchor="middle"
                          alignmentBaseline="middle"
                          fill={reward.text}
                          fontSize="9.5"
                          fontWeight="bold"
                          className="font-sans tracking-wide pointer-events-none select-none"
                        >
                          {reward.val} {reward.type === 'coins' ? '💰' : '✨'}
                        </text>
                      </g>
                    </g>
                  );
                })}
              </svg>
            </motion.div>
          </div>
        </div>

        {/* Center gold pointer peg (Top indicator) */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
          <div className="w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[22px] border-t-yellow-400 drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)]" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500 border border-slate-900 -mt-1" />
        </div>

        {/* Center hub button */}
        <button
          disabled={isSpinning || isNativeAdLoading || (!canFreeSpin && !isEnabled)}
          onClick={startSpinFlow}
          className="absolute z-10 w-16 h-16 rounded-full bg-gradient-to-b from-yellow-300 via-amber-500 to-yellow-600 border-4 border-slate-950 flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all focus:outline-none disabled:opacity-50 disabled:scale-100 disabled:pointer-events-none"
        >
          <div className="w-full h-full flex flex-col items-center justify-center">
            <RotateCw className={`w-6 h-6 text-slate-950 ${isSpinning || isNativeAdLoading ? 'animate-spin' : ''}`} />
            <span className="text-[10px] font-black text-slate-950 uppercase tracking-tighter mt-0.5">SPIN</span>
          </div>
        </button>

        {/* Native AdMob Loading Glassmorphism Overlay */}
        {isNativeAdLoading && (
          <div className="absolute inset-0 rounded-full bg-slate-950/90 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-6 text-center space-y-3 border-2 border-indigo-500/30">
            <RotateCw className="w-8 h-8 text-indigo-400 animate-spin" />
            <div className="space-y-0.5">
              <span className="block text-xs font-black text-indigo-300 uppercase tracking-wider">Reklam Yükleniyor</span>
              <span className="text-[10px] text-slate-400 leading-tight">Lütfen bekleyin, Google AdMob reklamı yükleniyor...</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop Blur overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl z-10 p-6 flex flex-col space-y-6"
            >
              {/* Gold light streaks header */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-500" />

              {/* Close Button */}
              <button
                onClick={onClose}
                disabled={isSpinning}
                className="absolute top-5 right-5 text-slate-400 hover:text-slate-100 p-2 rounded-xl hover:bg-slate-800/50 transition focus:outline-none disabled:opacity-20"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Header */}
              <div className="text-center space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-yellow-400 text-[11px] font-extrabold uppercase tracking-wider mx-auto">
                  <Sparkles className="w-3 h-3 animate-spin" />
                  {t('lucky_wheel', profile)}
                </div>
                <h2 className="text-xl font-black text-slate-100 tracking-tight">
                  Talihini Dene, Altınları Kap!
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
                  {t('lucky_wheel_desc', profile)}
                </p>
              </div>

              {/* AdMob Error Banner */}
              {admobError && (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between gap-2.5 animate-pulse">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                    <span className="font-medium leading-tight">{admobError}</span>
                  </div>
                  <button
                    onClick={() => setAdmobError(null)}
                    className="p-1 px-2.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 font-extrabold transition text-[10px] uppercase"
                  >
                    Kapat
                  </button>
                </div>
              )}

              {/* Wheel graphics */}
              <div className="py-4">
                {renderWheel()}
              </div>

              {/* Action and Timing Controls */}
              <div className="space-y-3">
                {canFreeSpin ? (
                  <button
                    onClick={startSpinFlow}
                    disabled={isSpinning}
                    className="w-full py-4 bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 hover:from-yellow-300 hover:to-amber-500 text-slate-950 font-black text-sm uppercase tracking-wider rounded-2xl shadow-xl shadow-amber-500/15 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    <RotateCw className="w-4 h-4 animate-spin-slow" />
                    {t('spin', profile)}
                  </button>
                ) : (
                  <div className="space-y-3">
                    {/* Cooldown Timer Alert */}
                    <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/40 border border-white/5 text-slate-300 text-xs">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                        <span>Ücretsiz Çevirme Sırası Bekleniyor</span>
                      </div>
                      <span className="font-mono font-black text-amber-400 text-sm">
                        {cooldownRemaining}
                      </span>
                    </div>

                    {/* Ad Watch Bypass Button */}
                    <button
                      onClick={startSpinFlow}
                      disabled={isSpinning}
                      className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-sm uppercase tracking-wider rounded-2xl shadow-xl shadow-emerald-500/15 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                      <Tv className="w-4 h-4 text-emerald-100 animate-bounce" />
                      {t('watch_ad_to_spin', profile)}
                    </button>
                  </div>
                )}
                
                <span className="block text-[10px] text-slate-500 text-center">
                  * Sponsorlu reklamlar tamamen sanal olup oyun akışını kesintisiz hızlandırır.
                </span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MOCK VIDEO AD PLAYER INTERFACE --- */}
      <AnimatePresence>
        {showAdModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
            <div className="relative w-full max-w-lg aspect-video bg-slate-950 rounded-3xl border border-slate-800 overflow-hidden shadow-2xl flex flex-col justify-between p-6">
              
              {/* Ad Header Info */}
              <div className="flex justify-between items-start z-10">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-black text-white">DM</div>
                  <div>
                    <span className="block text-xs font-black text-slate-100 leading-none">Deal Master Media</span>
                    <span className="text-[10px] text-slate-500">Sponsored Ad Campaign</span>
                  </div>
                </div>

                {/* Simulated Close X Button with warn triggers */}
                <button
                  onClick={handleCloseAdModalAttempt}
                  className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Central Dynamic Video Graphics Content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-indigo-950/20 via-slate-950 to-slate-950 p-6 pointer-events-none">
                <div className="relative w-20 h-20 rounded-full bg-indigo-600/10 border-2 border-indigo-500/20 flex items-center justify-center mb-4">
                  <Tv className="w-10 h-10 text-indigo-400 animate-pulse" />
                  <div className="absolute inset-0 rounded-full border-2 border-indigo-500 animate-ping opacity-25" style={{ animationDuration: '3s' }} />
                </div>
                
                <h4 className="text-sm font-black text-indigo-300 uppercase tracking-widest text-center animate-pulse">
                  {t('ad_playing', profile)}
                </h4>
                <p className="text-[11px] text-slate-500 text-center max-w-xs mt-1.5 leading-relaxed">
                  Çevrimiçi arenalara girmeden önce mülk setinizi büyütün! Deal Master kart tasarımları mağazada sizi bekliyor.
                </p>
              </div>

              {/* Bottom Countdown Controls */}
              <div className="w-full flex flex-col gap-3.5 z-10 mt-auto">
                <div className="flex justify-between items-center text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Volume2 className="w-3.5 h-3.5" /> Ad Audio Stream Active
                  </span>
                  <span className="font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 border border-indigo-500/25 rounded-md">
                    Skip in {adTimer}s
                  </span>
                </div>

                {/* Action Progress Bar */}
                <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: adDuration, ease: 'linear' }}
                    className="h-full bg-indigo-500"
                  />
                </div>
              </div>

              {/* Warning overlay if user tried to cancel */}
              <AnimatePresence>
                {adSkippedWarning && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="absolute inset-0 z-20 bg-slate-950/95 flex flex-col justify-center items-center p-6 text-center space-y-4"
                  >
                    <AlertCircle className="w-12 h-12 text-rose-500 animate-bounce" />
                    <div className="space-y-1">
                      <h3 className="text-sm font-extrabold text-slate-100">Reklamı Kapatmak İstiyor Musunuz?</h3>
                      <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                        Reklamı şimdi kapatırsanız bekleme süresini atlayamaz ve ücretsiz çark çevirme hakkı elde edemezsiniz.
                      </p>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => setAdSkippedWarning(false)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition"
                      >
                        İzlemeye Devam Et
                      </button>
                      <button
                        onClick={forceCloseAd}
                        className="px-4 py-2 bg-transparent hover:bg-slate-900 text-rose-400 hover:text-rose-300 font-bold text-xs uppercase tracking-wider rounded-xl transition border border-rose-500/20"
                      >
                        Yine de Kapat
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* --- REWARD WINNING CELEBRATION MODAL --- */}
      <AnimatePresence>
        {showRewardModal && rewardWon && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRewardModal(false)}
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-md"
            />

            {/* Content modal */}
            <motion.div
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              className="relative w-full max-w-sm bg-gradient-to-b from-slate-900 to-indigo-950/40 border border-yellow-500/30 rounded-3xl overflow-hidden shadow-2xl z-10 p-6 text-center space-y-6"
            >
              {/* Confetti sparkle backgrounds */}
              <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-yellow-400 via-transparent to-transparent" />

              <div className="space-y-4">
                {/* Visual prize badge */}
                <div className="w-20 h-20 rounded-full bg-yellow-500/15 border-2 border-yellow-400 flex items-center justify-center mx-auto text-yellow-400 drop-shadow-[0_0_15px_rgba(234,179,8,0.4)] animate-bounce">
                  {rewardWon.type === 'coins' ? (
                    <Coins className="w-10 h-10 text-yellow-400" />
                  ) : (
                    <Trophy className="w-10 h-10 text-emerald-400" />
                  )}
                </div>

                <div className="space-y-1">
                  <h3 className="text-lg font-black text-slate-100 tracking-tight uppercase">
                    {t('congratulations', profile)}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Şans Çarkı sana bugün harika bir ödül getirdi!
                  </p>
                </div>

                {/* Amount display label */}
                <div className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-950/60 border border-yellow-500/25 text-yellow-400 text-2xl font-black shadow-inner animate-pulse">
                  {rewardWon.type === 'coins' ? '💰' : '✨'}
                  <span>+{rewardWon.val} {rewardWon.label}</span>
                </div>
              </div>

              {/* Close & Claim button */}
              <button
                onClick={() => {
                  setShowRewardModal(false);
                  onClose();
                }}
                className="w-full py-3 bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-slate-950 font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg active:scale-95 transition-all"
              >
                {t('claim_reward', profile)}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
