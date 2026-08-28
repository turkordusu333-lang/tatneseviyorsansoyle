import React, { useEffect, useState, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { adMobService } from '../lib/adMobService';

declare global {
  interface Window {
    adsbygoogle?: any[];
  }
}

interface AdMobBannerProps {
  adminSettings?: any;
  visible?: boolean;
  position?: 'top' | 'bottom';
  className?: string;
  adSlot?: string;
  adFormat?: 'auto' | 'horizontal' | 'rectangle';
}

/**
 * SmartAdBanner / AdMobBanner:
 * - On Native Android & iOS (Capacitor): Renders Native Google AdMob Banner
 * - On Web Browsers: Renders Google AdSense Ad Unit (ca-pub-5045652074166668)
 */
export const AdMobBanner: React.FC<AdMobBannerProps> = ({
  adminSettings,
  visible = true,
  position = 'bottom',
  className = '',
  adSlot,
  adFormat = 'auto',
}) => {
  const isNative = Capacitor.isNativePlatform();
  const platform = Capacitor.getPlatform();
  const [adLoaded, setAdLoaded] = useState(false);
  const [adError, setAdError] = useState<string | null>(null);

  // Settings
  const isTesting = adminSettings?.bannerAdMobTestingMode === true || adminSettings?.wheelAdMobTestingMode === true;
  const isBannerEnabled = adminSettings?.bannerAdMobEnabled !== false;
  const isAdSenseEnabled = adminSettings?.adSenseEnabled !== false;
  const adSenseClient = adminSettings?.adSenseClientId || 'ca-pub-5045652074166668';
  const effectiveAdSlot = adSlot || adminSettings?.adSenseBannerSlotId || '';

  // AdMob Ad Unit IDs (Mobile)
  const androidAdUnitId = adminSettings?.bannerAdMobAndroidAdUnitId || 'ca-app-pub-5045652074166668/1473978700';
  const iosAdUnitId = adminSettings?.bannerAdMobiOSAdUnitId || 'ca-app-pub-3940256099942544/2934735716';
  const activeAdUnitId = platform === 'ios' ? iosAdUnitId : androidAdUnitId;

  // Ref to prevent multiple AdSense pushes on same element
  const adRef = useRef<HTMLModElement | null>(null);
  const pushedRef = useRef(false);

  // --- NATIVE ADMOB LIFECYCLE ---
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

  // --- WEB ADSENSE LIFECYCLE ---
  useEffect(() => {
    if (isNative || !isAdSenseEnabled || !visible) return;

    if (adRef.current && !pushedRef.current) {
      try {
        if (typeof window !== 'undefined') {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
          pushedRef.current = true;
          setAdLoaded(true);
        }
      } catch (e) {
        console.warn('[AdSense] adsbygoogle push error:', e);
      }
    }
  }, [isNative, isAdSenseEnabled, visible]);

  // If not visible or disabled, render nothing
  if (!visible || (isNative && !isBannerEnabled) || (!isNative && !isAdSenseEnabled)) {
    return null;
  }

  // On Native devices: The banner is rendered natively by Android/iOS Google Mobile Ads SDK on top of/under WebView.
  // We supply a bottom spacer so web content does not get covered by the native banner.
  if (isNative) {
    return <div className="h-14 w-full shrink-0 pointer-events-none" aria-hidden="true" />;
  }

  // On Web Browser: Render real Google AdSense ad container
  return (
    <div className={`w-full max-w-2xl mx-auto my-2 overflow-hidden flex flex-col items-center justify-center text-center ${className}`}>
      {/* Google AdSense ins element */}
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block', minHeight: '60px', width: '100%' }}
        data-ad-client={adSenseClient}
        data-ad-slot={effectiveAdSlot || undefined}
        data-ad-format={adFormat}
        data-full-width-responsive="true"
      />

      {/* Fallback preview indicator if running in development or ad blocked */}
      <div className="w-full py-1 px-3 bg-slate-950/40 border border-white/5 rounded-lg flex items-center justify-between text-[10px] text-slate-500 mt-1">
        <span className="flex items-center gap-1.5 font-bold text-amber-400">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          Google AdSense (Web)
        </span>
        <span className="font-mono text-[9px] text-slate-400">
          {adSenseClient}
        </span>
      </div>
    </div>
  );
};

/**
 * Dedicated Google AdSense Ad component for Web Pages
 */
export const AdSenseAd: React.FC<{
  adClient?: string;
  adSlot?: string;
  adFormat?: 'auto' | 'fluid' | 'rectangle' | 'horizontal';
  fullWidthResponsive?: boolean;
  className?: string;
  minHeight?: string;
}> = ({
  adClient = 'ca-pub-5045652074166668',
  adSlot,
  adFormat = 'auto',
  fullWidthResponsive = true,
  className = '',
  minHeight = '90px',
}) => {
  const adRef = useRef<HTMLModElement | null>(null);
  const pushedRef = useRef(false);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;

    if (adRef.current && !pushedRef.current) {
      try {
        if (typeof window !== 'undefined') {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
          pushedRef.current = true;
        }
      } catch (e) {
        console.warn('[AdSenseAd] push error:', e);
      }
    }
  }, []);

  if (Capacitor.isNativePlatform()) return null;

  return (
    <div className={`adsense-container w-full overflow-hidden my-3 text-center ${className}`}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block', minHeight }}
        data-ad-client={adClient}
        data-ad-slot={adSlot || undefined}
        data-ad-format={adFormat}
        data-full-width-responsive={fullWidthResponsive ? 'true' : 'false'}
      />
    </div>
  );
};
