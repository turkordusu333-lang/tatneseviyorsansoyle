import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Tv, Coins, Sparkles, X, Volume2, AlertCircle, CheckCircle2, RotateCw } from 'lucide-react';
import { UserProfile } from '../types';
import { sounds } from '../lib/SoundSystem';
import { t } from '../lib/TranslationSystem';
import { Capacitor } from '@capacitor/core';
import { adMobService } from '../lib/adMobService';

interface RewardedAdCoinButtonProps {
  profile: UserProfile;
  onUpdateProfile: (updated: UserProfile) => void;
  adminSettings?: any;
  variant?: 'button' | 'card' | 'badge';
  className?: string;
}

export const RewardedAdCoinButton: React.FC<RewardedAdCoinButtonProps> = ({
  profile,
  onUpdateProfile,
  adminSettings,
  variant = 'button',
  className = '',
}) => {
  const rewardCoins = adminSettings?.rewardedAdCoinAmount ?? 100;
  const isTesting = adminSettings?.wheelAdMobTestingMode === true;
  const androidAdUnitId = adminSettings?.wheelAdMobAndroidAdUnitId || 'ca-app-pub-5045652074166668/6893680557';
  const iosAdUnitId = adminSettings?.wheelAdMobiOSAdUnitId || 'ca-app-pub-3940256099942544/1712485313';
  const adDuration = adminSettings?.wheelAdDurationSeconds ?? 8;

  const platform = Capacitor.getPlatform();
  const activeAdUnitId = platform === 'ios' ? iosAdUnitId : androidAdUnitId;

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Web ad simulation state
  const [showWebAdModal, setShowWebAdModal] = useState(false);
  const [adTimer, setAdTimer] = useState(0);
  const [adSkippedWarning, setAdSkippedWarning] = useState(false);

  // Victory reward state
  const [showVictoryModal, setShowVictoryModal] = useState(false);

  // Handle web ad countdown timer
  useEffect(() => {
    let timer: any;
    if (showWebAdModal && adTimer > 0) {
      timer = setTimeout(() => {
        setAdTimer((prev) => prev - 1);
      }, 1000);
    } else if (showWebAdModal && adTimer === 0) {
      // Completed watching web ad
      setShowWebAdModal(false);
      awardUserCoins();
    }
    return () => clearTimeout(timer);
  }, [showWebAdModal, adTimer]);

  const awardUserCoins = () => {
    sounds.playCoin(profile.settings);
    sounds.playVictory(profile.settings);

    const updatedProfile: UserProfile = {
      ...profile,
      coins: profile.coins + rewardCoins,
    };

    onUpdateProfile(updatedProfile);
    setShowVictoryModal(true);
  };

  const playNativeAdMobAd = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await adMobService.showRewardedAd({
        customAdUnitId: activeAdUnitId,
        isTesting,
        onAdLoaded: () => {
          setIsLoading(false);
        },
        onAdFailedToLoad: (err) => {
          setIsLoading(false);
          setErrorMessage(profile.settings.language === 'en' ? 'Ad failed to load. Please try again later.' : 'Reklam yüklenemedi (AdMob No Fill / Bağlantı). Lütfen daha sonra tekrar deneyin.');
        },
        onAdDismissed: () => {
          setIsLoading(false);
        },
      });

      setIsLoading(false);
      if (result.rewardEarned) {
        awardUserCoins();
      } else if (result.error) {
        setErrorMessage(result.error);
      } else {
        setErrorMessage(profile.settings.language === 'en' ? 'You must watch the full ad to earn the reward.' : 'Ödül kazanmak için reklamı sonuna kadar izlemelisiniz.');
      }
    } catch (error: any) {
      console.error('Native AdMob error:', error);
      setIsLoading(false);
      setErrorMessage(error?.message || (profile.settings.language === 'en' ? 'Error loading ad.' : 'Reklam yüklenirken bir hata oluştu.'));
    }
  };

  const handleStartWatchAd = () => {
    sounds.playAction(profile.settings);
    setErrorMessage(null);

    if (Capacitor.isNativePlatform()) {
      playNativeAdMobAd();
    } else {
      // Web simulated fallback
      setAdTimer(adDuration);
      setShowWebAdModal(true);
      setAdSkippedWarning(false);
    }
  };

  const isEn = profile?.settings?.language === 'en' || localStorage.getItem('language') === 'en';

  // Render trigger button depending on variant
  const renderTrigger = () => {
    if (variant === 'badge') {
      return (
        <button
          onClick={handleStartWatchAd}
          disabled={isLoading}
          className={`px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 font-extrabold text-xs flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50 cursor-pointer ${className}`}
        >
          {isLoading ? (
            <RotateCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
          ) : (
            <Tv className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
          )}
          <span>{isEn ? `+${rewardCoins} Gold Earn` : `+${rewardCoins} Altın Kazan`}</span>
        </button>
      );
    }

    if (variant === 'card') {
      return (
        <div className={`relative overflow-hidden bg-gradient-to-r from-amber-950/40 via-yellow-950/30 to-slate-900/80 border border-amber-500/30 rounded-2xl p-4.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl group ${className}`}>
          {/* Background Ambient Glow */}
          <div className="absolute -right-8 -bottom-8 w-24 h-24 rounded-full bg-amber-500/10 blur-2xl group-hover:scale-150 transition-all pointer-events-none" />

          <div className="flex items-center gap-3.5 z-10">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-yellow-400 to-amber-600 p-0.5 shadow-lg shrink-0 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <Tv className="w-5 h-5 text-amber-400 animate-pulse" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-100 uppercase tracking-wider">
                  {isEn ? 'AdMob Rewarded Video' : 'AdMob Ödüllü Reklam'}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] font-black uppercase">
                  {isEn ? 'FREE' : 'ÜCRETSİZ'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 leading-snug">
                {isEn
                  ? `Watch a short sponsored video to immediately add +${rewardCoins} Gold to your account!`
                  : `Sponsorlu kısa videoyu izleyerek anında +${rewardCoins} Altın hesabına ekle!`}
              </p>
            </div>
          </div>

          <button
            onClick={handleStartWatchAd}
            disabled={isLoading}
            className="w-full sm:w-auto px-5 py-3 bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 hover:from-yellow-300 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 shrink-0 disabled:opacity-50 cursor-pointer z-10"
          >
            {isLoading ? (
              <>
                <RotateCw className="w-4 h-4 animate-spin text-slate-950" />
                <span>{isEn ? 'Loading...' : 'Yükleniyor...'}</span>
              </>
            ) : (
              <>
                <Coins className="w-4 h-4 text-slate-950" />
                <span>{isEn ? `Watch Ad & Earn +${rewardCoins}` : `Reklam İzle & +${rewardCoins} Kazan`}</span>
              </>
            )}
          </button>
        </div>
      );
    }

    // Default 'button' variant
    return (
      <button
        onClick={handleStartWatchAd}
        disabled={isLoading}
        className={`px-4 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-md active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer ${className}`}
      >
        {isLoading ? (
          <RotateCw className="w-4 h-4 animate-spin" />
        ) : (
          <Tv className="w-4 h-4 text-slate-950" />
        )}
        <span>🎥 {isEn ? `+${rewardCoins} Gold` : `+${rewardCoins} Altın`}</span>
      </button>
    );
  };

  return (
    <>
      {renderTrigger()}

      {/* Error Alert Toast if error occurs */}
      <AnimatePresence>
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed bottom-6 right-6 z-50 max-w-sm p-4 bg-slate-900 border border-rose-500/30 rounded-2xl shadow-2xl text-rose-300 text-xs flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="p-1 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- WEB ADMOB SIMULATED PLAYER MODAL --- */}
      <AnimatePresence>
        {showWebAdModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
            <div className="relative w-full max-w-lg aspect-video bg-slate-950 rounded-3xl border border-slate-800 overflow-hidden shadow-2xl flex flex-col justify-between p-6">
              
              {/* Header Info */}
              <div className="flex justify-between items-start z-10">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-xs font-black text-slate-950">Ad</div>
                  <div>
                    <span className="block text-xs font-black text-slate-100 leading-none">Google AdMob Rewarded Video</span>
                    <span className="text-[10px] text-slate-500">Sponsored Ad Campaign</span>
                  </div>
                </div>

                <button
                  onClick={() => setAdSkippedWarning(true)}
                  className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Central Visual Graphic */}
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-amber-950/20 via-slate-950 to-slate-950 p-6 pointer-events-none">
                <div className="relative w-20 h-20 rounded-full bg-amber-500/10 border-2 border-amber-500/20 flex items-center justify-center mb-4">
                  <Coins className="w-10 h-10 text-amber-400 animate-bounce" />
                </div>
                
                <h4 className="text-sm font-black text-amber-300 uppercase tracking-widest text-center animate-pulse">
                  {isEn ? `+${rewardCoins} Gold Reward Loading...` : `+${rewardCoins} Altın Ödülü Yükleniyor...`}
                </h4>
                <p className="text-[11px] text-slate-500 text-center max-w-xs mt-1.5 leading-relaxed">
                  {isEn
                    ? `Once the ad is complete, ${rewardCoins} Gold will be added to your account.`
                    : `Reklam tamamlandığında hesabınıza anında ${rewardCoins} Altın tanımlanacaktır.`}
                </p>
              </div>

              {/* Bottom Countdown Controls */}
              <div className="w-full flex flex-col gap-3.5 z-10 mt-auto">
                <div className="flex justify-between items-center text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Volume2 className="w-3.5 h-3.5 text-amber-400" /> AdMob Video Audio Stream
                  </span>
                  <span className="font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 border border-amber-500/25 rounded-md">
                    {isEn ? 'Closing in:' : 'Kapanış:'} {adTimer}s
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: adDuration, ease: 'linear' }}
                    className="h-full bg-amber-500"
                  />
                </div>
              </div>

              {/* Cancel Warning Overlay */}
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
                      <h3 className="text-sm font-extrabold text-slate-100">
                        {isEn ? 'Do you want to close the ad?' : 'Reklamı Kapatmak İstiyor Musunuz?'}
                      </h3>
                      <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                        {isEn
                          ? `If you close early, you will not receive the +${rewardCoins} Gold reward.`
                          : `Erken kapatırsanız +${rewardCoins} Altın ödülünü kazanamazsınız.`}
                      </p>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => setAdSkippedWarning(false)}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer"
                      >
                        {isEn ? 'Continue Watching' : 'İzlemeye Devam Et'}
                      </button>
                      <button
                        onClick={() => {
                          setShowWebAdModal(false);
                          setAdSkippedWarning(false);
                        }}
                        className="px-4 py-2 bg-transparent hover:bg-slate-900 text-rose-400 hover:text-rose-300 font-bold text-xs uppercase tracking-wider rounded-xl transition border border-rose-500/20 cursor-pointer"
                      >
                        {isEn ? 'Forfeit Reward' : 'Ödülden Vazgeç'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* --- VICTORY REWARD POPUP --- */}
      <AnimatePresence>
        {showVictoryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowVictoryModal(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />

            <motion.div
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              className="relative w-full max-w-sm bg-gradient-to-b from-slate-900 via-slate-900 to-amber-950/50 border border-amber-500/30 rounded-3xl overflow-hidden shadow-2xl z-10 p-6 text-center space-y-6"
            >
              <div className="space-y-4">
                <div className="w-20 h-20 rounded-full bg-amber-500/15 border-2 border-amber-400 flex items-center justify-center mx-auto text-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.3)] animate-bounce">
                  <Coins className="w-10 h-10 text-amber-400" />
                </div>

                <div className="space-y-1">
                  <h3 className="text-lg font-black text-slate-100 tracking-tight uppercase">
                    {isEn ? 'CONGRATULATIONS!' : 'TEBRİKLER!'}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {isEn
                      ? 'You successfully watched the AdMob Rewarded Ad and claimed your reward!'
                      : 'AdMob Ödüllü Reklamını başarıyla izledin ve ödülünü kaptın!'}
                  </p>
                </div>

                <div className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-950/70 border border-amber-500/30 text-amber-400 text-2xl font-black shadow-inner animate-pulse">
                  💰 +{rewardCoins} {isEn ? 'Gold' : 'Altın'}
                </div>
              </div>

              <button
                onClick={() => setShowVictoryModal(false)}
                className="w-full py-3.5 bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-slate-950 font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg active:scale-95 transition-all cursor-pointer"
              >
                {isEn ? 'Awesome!' : 'Harika!'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
