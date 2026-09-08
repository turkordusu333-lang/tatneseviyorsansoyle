import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  BannerAdPosition,
  BannerAdSize,
  BannerAdPluginEvents,
  RewardAdPluginEvents,
  AdmobConsentStatus,
  AdOptions,
} from '@capacitor-community/admob';

// Google Official Test Ad Unit IDs
export const ADMOB_TEST_IDS = {
  android: {
    banner: 'ca-app-pub-3940256099942544/6300978111',
    interstitial: 'ca-app-pub-3940256099942544/1033173712',
    rewarded: 'ca-app-pub-3940256099942544/5224354917',
  },
  ios: {
    banner: 'ca-app-pub-3940256099942544/2934735716',
    interstitial: 'ca-app-pub-3940256099942544/4411468910',
    rewarded: 'ca-app-pub-3940256099942544/1712485313',
  },
};

// Default Production Ad Unit IDs
export const ADMOB_PRODUCTION_IDS = {
  android: {
    banner: 'ca-app-pub-5045652074166668/1473978700',
    interstitial: 'ca-app-pub-5045652074166668/6893680557',
    rewarded: 'ca-app-pub-5045652074166668/6893680557',
  },
  ios: {
    banner: 'ca-app-pub-3940256099942544/2934735716',
    interstitial: 'ca-app-pub-3940256099942544/4411468910',
    rewarded: 'ca-app-pub-3940256099942544/1712485313',
  },
};

export interface ShowRewardedAdOptions {
  customAdUnitId?: string;
  isTesting?: boolean;
  onAdLoaded?: () => void;
  onAdFailedToLoad?: (error: any) => void;
  onAdDismissed?: () => void;
}

export interface RewardedAdResult {
  rewardEarned: boolean;
  rewardType?: string;
  rewardAmount?: number;
  error?: string;
}

class AdMobService {
  private isInitialized = false;
  private isInitializing = false;
  private isBannerShowing = false;
  private activeListeners: { remove: () => Promise<void> | void }[] = [];

  private bannerListenersSetup = false;

  /**
   * Initializes the AdMob SDK safely once across the entire application lifecycle.
   */
  public async initialize(testingMode = false): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      this.isInitialized = true;
      return true;
    }

    if (this.isInitialized) return true;
    if (this.isInitializing) {
      // Wait for existing initialization to finish
      let attempts = 0;
      while (this.isInitializing && attempts < 20) {
        await new Promise((r) => setTimeout(r, 100));
        attempts++;
      }
      return this.isInitialized;
    }

    this.isInitializing = true;
    try {
      // 1. Request Tracking Authorization on iOS (if applicable)
      if (Capacitor.getPlatform() === 'ios') {
        try {
          const trackingInfo = await AdMob.trackingAuthorizationStatus();
          if (trackingInfo.status === 'notDetermined') {
            await AdMob.requestTrackingAuthorization();
          }
        } catch (e) {
          console.warn('[AdMobService] Tracking authorization error:', e);
        }
      }

      // 2. Initialize Google Mobile Ads SDK
      await AdMob.initialize({
        initializeForTesting: testingMode,
      });

      // 3. Set up Banner lifecycle listeners once
      if (!this.bannerListenersSetup) {
        this.bannerListenersSetup = true;
        try {
          const lLoaded = await AdMob.addListener(BannerAdPluginEvents.Loaded, () => {
            console.log('[AdMobService] ✅ Banner Ad Loaded & Displayed successfully!');
            this.isBannerShowing = true;
          });
          this.activeListeners.push(lLoaded);

          const lFailed = await AdMob.addListener(BannerAdPluginEvents.FailedToLoad, (err: any) => {
            console.warn('[AdMobService] ❌ Banner Ad Failed to Load (AdMob response):', JSON.stringify(err));
            this.isBannerShowing = false;
          });
          this.activeListeners.push(lFailed);

          const lOpened = await AdMob.addListener(BannerAdPluginEvents.Opened, () => {
            console.log('[AdMobService] ℹ️ Banner Ad Opened / Clicked');
          });
          this.activeListeners.push(lOpened);

          const lClosed = await AdMob.addListener(BannerAdPluginEvents.Closed, () => {
            console.log('[AdMobService] ℹ️ Banner Ad Closed');
          });
          this.activeListeners.push(lClosed);
        } catch (listenerErr) {
          console.warn('[AdMobService] Error setting up banner listeners:', listenerErr);
        }
      }

      this.isInitialized = true;
      console.log('[AdMobService] Successfully initialized Google Mobile Ads SDK');
      return true;
    } catch (error) {
      console.warn('[AdMobService] Initialization error (may already be initialized):', error);
      this.isInitialized = true;
      return true;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Resolves the target Ad Unit ID for the current platform and testing flag.
   */
  public getAdUnitId(
    type: 'banner' | 'interstitial' | 'rewarded',
    customId?: string,
    isTesting = false
  ): string {
    const platform = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
    if (isTesting) {
      return ADMOB_TEST_IDS[platform][type];
    }
    return customId || ADMOB_PRODUCTION_IDS[platform][type] || ADMOB_TEST_IDS[platform][type];
  }

  /**
   * Loads and shows a Google AdMob Rewarded Video Ad with complete promise-based resolution.
   * Handles timeouts, cancellation, error recovery, and web mock fallbacks gracefully.
   */
  public async showRewardedAd(options: ShowRewardedAdOptions = {}): Promise<RewardedAdResult> {
    const { customAdUnitId, isTesting = false, onAdLoaded, onAdFailedToLoad, onAdDismissed } = options;

    // Web preview mock fallback
    if (!Capacitor.isNativePlatform()) {
      console.log('[AdMobService] Web environment detected. Simulating Rewarded Ad...');
      await new Promise((r) => setTimeout(r, 1200));
      return {
        rewardEarned: true,
        rewardType: 'coins',
        rewardAmount: 500,
      };
    }

    // Initialize SDK if not ready
    await this.initialize(isTesting);

    const adUnitId = this.getAdUnitId('rewarded', customAdUnitId, isTesting);

    return new Promise<RewardedAdResult>(async (resolve) => {
      let rewardEarned = false;
      let rewardDetails: any = null;
      let hasResolved = false;
      let loadTimeoutTimer: any = null;
      const listeners: { remove: () => Promise<void> | void }[] = [];

      const cleanup = () => {
        if (loadTimeoutTimer) clearTimeout(loadTimeoutTimer);
        listeners.forEach((l) => {
          try {
            l.remove();
          } catch (e) {}
        });
      };

      const finish = (result: RewardedAdResult) => {
        if (hasResolved) return;
        hasResolved = true;
        cleanup();
        resolve(result);
      };

      try {
        // Set a safety timeout for loading (16 seconds)
        loadTimeoutTimer = setTimeout(() => {
          console.warn('[AdMobService] Rewarded ad loading timed out.');
          finish({
            rewardEarned: false,
            error: 'Reklam yükleme zaman aşımına uğradı. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.',
          });
        }, 16000);

        // 1. Listen for Ad Loaded
        const loadedListener = await AdMob.addListener(RewardAdPluginEvents.Loaded, async () => {
          console.log('[AdMobService] Rewarded Ad Loaded successfully! Displaying ad...');
          if (loadTimeoutTimer) clearTimeout(loadTimeoutTimer);
          if (onAdLoaded) onAdLoaded();

          try {
            await AdMob.showRewardVideoAd();
          } catch (showError: any) {
            console.error('[AdMobService] showRewardVideoAd error:', showError);
            finish({
              rewardEarned: false,
              error: showError?.message || 'Reklam gösterilirken bir hata oluştu.',
            });
          }
        });
        listeners.push(loadedListener);

        // 2. Listen for Reward Earned
        const rewardedListener = await AdMob.addListener(RewardAdPluginEvents.Rewarded, (reward: any) => {
          console.log('[AdMobService] User earned reward:', reward);
          rewardEarned = true;
          rewardDetails = reward;
        });
        listeners.push(rewardedListener);

        // 3. Listen for Ad Dismissed
        const dismissedListener = await AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
          console.log('[AdMobService] Rewarded Ad dismissed.');
          if (onAdDismissed) onAdDismissed();
          finish({
            rewardEarned,
            rewardType: rewardDetails?.type || 'coins',
            rewardAmount: rewardDetails?.amount || 500,
          });
        });
        listeners.push(dismissedListener);

        // 4. Listen for Failed to Load
        const failedListener = await AdMob.addListener(RewardAdPluginEvents.FailedToLoad, (err: any) => {
          console.warn('[AdMobService] Rewarded Ad FailedToLoad:', err);
          if (onAdFailedToLoad) onAdFailedToLoad(err);
          finish({
            rewardEarned: false,
            error: 'Reklam şu anda yüklenemedi (AdMob No Fill). Lütfen biraz sonra tekrar deneyin.',
          });
        });
        listeners.push(failedListener);

        // 5. Prepare and Request the Ad
        const adOptions: AdOptions = {
          adId: adUnitId,
          isTesting,
        };

        await AdMob.prepareRewardVideoAd(adOptions);
      } catch (exception: any) {
        console.error('[AdMobService] showRewardedAd exception:', exception);
        finish({
          rewardEarned: false,
          error: exception?.message || 'Reklam başlatılamadı.',
        });
      }
    });
  }

  /**
   * Shows a Banner Ad with safe container spacing.
   */
  public async showBanner(
    customAdUnitId?: string,
    isTesting = false,
    position: 'top' | 'bottom' = 'bottom'
  ): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return true;

    try {
      await this.initialize(isTesting);
      const adId = this.getAdUnitId('banner', customAdUnitId, isTesting);
      const bannerPosition = position === 'top' ? BannerAdPosition.TOP_CENTER : BannerAdPosition.BOTTOM_CENTER;

      console.log(`[AdMobService] Showing banner ad | Unit: ${adId} | Testing: ${isTesting} | Pos: ${position}`);

      try {
        await AdMob.showBanner({
          adId,
          adSize: BannerAdSize.ADAPTIVE_BANNER,
          position: bannerPosition,
          margin: 0,
          isTesting,
        });
      } catch (adaptiveErr) {
        console.warn('[AdMobService] Adaptive banner failed, trying standard BANNER fallback...', adaptiveErr);
        await AdMob.showBanner({
          adId,
          adSize: BannerAdSize.BANNER,
          position: bannerPosition,
          margin: 0,
          isTesting,
        });
      }

      this.isBannerShowing = true;
      return true;
    } catch (error) {
      console.warn('[AdMobService] showBanner error:', error);
      return false;
    }
  }

  /**
   * Hides active banner ads safely.
   */
  public async hideBanner(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await AdMob.hideBanner();
      this.isBannerShowing = false;
      console.log('[AdMobService] Banner hidden.');
    } catch (error) {
      // Ignore hide errors
    }
  }

  /**
   * Cleans up all active plugin listeners.
   */
  public cleanup(): void {
    this.activeListeners.forEach((l) => {
      try {
        l.remove();
      } catch (e) {}
    });
    this.activeListeners = [];
  }
}

export const adMobService = new AdMobService();
