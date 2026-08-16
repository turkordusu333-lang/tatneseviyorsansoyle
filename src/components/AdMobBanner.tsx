import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { adMobService } from '../lib/adMobService';

interface AdMobBannerProps {
  adminSettings?: any;
  visible?: boolean;
  position?: 'top' | 'bottom';
  className?: string;
}

export const AdMobBanner: React.FC<AdMobBannerProps> = ({
  adminSettings,
  visible = true,
  position = 'bottom',
  className = '',
}) => {
  const isNative = Capacitor.isNativePlatform();
  const platform = Capacitor.getPlatform();
  const [adLoaded, setAdLoaded] = useState(false);
  const [adError, setAdError] = useState<string | null>(null);

  // Settings
  const isTesting = adminSettings?.bannerAdMobTestingMode ?? adminSettings?.wheelAdMobTestingMode ?? true;
  const isBannerEnabled = adminSettings?.bannerAdMobEnabled !== false;
  
  // Ad Unit IDs
  const androidAdUnitId = adminSettings?.bannerAdMobAndroidAdUnitId || 'ca-app-pub-5045652074166668/1473978700';
  const iosAdUnitId = adminSettings?.bannerAdMobiOSAdUnitId || 'ca-app-pub-3940256099942544/2934735716';

  const activeAdUnitId = platform === 'ios' ? iosAdUnitId : androidAdUnitId;

  useEffect(() => {
    if (!isNative || !isBannerEnabled || !visible) {
      if (isNative) {
        adMobService.hideBanner().catch(() => {});
      }
      return;
    }

    let isMounted = true;

    const showBanner = async () => {
      try {
        const success = await adMobService.showBanner(activeAdUnitId, isTesting, position as ('top' | 'bottom'));
        if (isMounted) {
          setAdLoaded(success);
          if (!success) {
            setAdError('Banner yüklenemedi');
          }
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('AdMob showBanner error:', err);
          setAdError(err?.message || 'Banner başlatma hatası');
        }
      }
    };

    showBanner();

    return () => {
      isMounted = false;
      if (isNative) {
        adMobService.hideBanner().catch(() => {});
      }
    };
  }, [isNative, isBannerEnabled, visible, activeAdUnitId, isTesting, position]);

  // If not visible or disabled, render nothing
  if (!visible || !isBannerEnabled) {
    return null;
  }

  // On Native devices: The banner is rendered natively by Android/iOS Google Mobile Ads SDK on top of/under WebView.
  // We supply a bottom spacer so web content does not get covered by the native banner.
  if (isNative) {
    return <div className="h-14 w-full shrink-0 pointer-events-none" aria-hidden="true" />;
  }

  // On Web Browser preview: Render a clean visual AdMob Banner bar
  return (
    <div className={`w-full max-w-lg mx-auto my-2 px-3 py-2 bg-slate-900/80 border border-amber-500/20 rounded-xl flex items-center justify-between shadow-lg text-xs backdrop-blur-md ${className}`}>
      <div className="flex items-center gap-2">
        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 text-[10px] font-black text-amber-400 uppercase tracking-wider">
          AdMob
        </span>
        <div className="flex flex-col">
          <span className="font-bold text-slate-200 text-[11px]">Deal Card Sponsorlu Reklam</span>
          <span className="text-[9px] text-slate-400 font-mono truncate max-w-[220px]">
            {isTesting ? 'Google Test Banner (Aktif)' : activeAdUnitId}
          </span>
        </div>
      </div>
      <div className="text-[10px] text-emerald-400 font-bold flex items-center gap-1 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span>Banner Hazır</span>
      </div>
    </div>
  );
};
