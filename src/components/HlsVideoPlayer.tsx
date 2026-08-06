import React, { useEffect, useRef } from 'react';
import Hls from 'hls.js';

interface HlsVideoPlayerProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
  src: string;
}

export function isVideoUrl(url?: string, mediaType?: string): boolean {
  if (mediaType === 'video') return true;
  if (!url) return false;
  const lower = url.toLowerCase().trim();
  return (
    lower.endsWith('.mp4') ||
    lower.endsWith('.webm') ||
    lower.endsWith('.m3u8') ||
    lower.includes('.m3u8') ||
    lower.includes('m3u8') ||
    lower.includes('.mp4') ||
    lower.includes('.webm') ||
    lower.includes('video') ||
    lower.includes('hls') ||
    lower.startsWith('data:video')
  );
}

export const HlsVideoPlayer: React.FC<HlsVideoPlayerProps> = ({
  src,
  autoPlay = true,
  loop = true,
  muted = true,
  playsInline = true,
  className = '',
  style = {},
  crossOrigin = 'anonymous',
  ...rest
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    // Upgrade http to https if current page is https to prevent mixed content blocking
    let cleanSrc = src.trim();
    if (window.location.protocol === 'https:' && cleanSrc.startsWith('http://')) {
      cleanSrc = cleanSrc.replace('http://', 'https://');
    }

    let hls: Hls | null = null;
    const lowerSrc = cleanSrc.toLowerCase();
    const isM3u8 = lowerSrc.includes('.m3u8') || lowerSrc.includes('m3u8') || lowerSrc.includes('application/x-mpegurl');

    // Ensure muted for autoplay compliance
    if (muted) {
      video.muted = true;
    }

    const handleEnded = () => {
      if (loop && video) {
        video.currentTime = 0;
        video.play().catch(() => {});
      }
    };

    video.addEventListener('ended', handleEnded);

    if (isM3u8) {
      if (Hls.isSupported()) {
        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 90,
          xhrSetup: (xhr) => {
            xhr.withCredentials = false;
          }
        });

        hls.loadSource(cleanSrc);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (autoPlay) {
            if (muted) video.muted = true;
            video.play().catch((err) => {
              console.warn('HLS autoplay error:', err);
            });
          }
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.warn('HLS Network error, attempting restart...', data);
                hls?.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.warn('HLS Media error, attempting recover...', data);
                hls?.recoverMediaError();
                break;
              default:
                console.warn('HLS Unrecoverable error, switching to native video src', data);
                hls?.destroy();
                hls = null;
                if (video) {
                  video.src = cleanSrc;
                  if (autoPlay) {
                    if (muted) video.muted = true;
                    video.play().catch(() => {});
                  }
                }
                break;
            }
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = cleanSrc;
        if (autoPlay) {
          if (muted) video.muted = true;
          video.play().catch((err) => console.warn('Native HLS autoplay error:', err));
        }
      } else {
        video.src = cleanSrc;
      }
    } else {
      video.src = cleanSrc;
      if (autoPlay) {
        if (muted) video.muted = true;
        video.play().catch((err) => console.warn('Video autoplay error:', err));
      }
    }

    return () => {
      video.removeEventListener('ended', handleEnded);
      if (hls) {
        hls.destroy();
      }
    };
  }, [src, autoPlay, loop, muted]);

  return (
    <video
      ref={videoRef}
      autoPlay={autoPlay}
      loop={loop}
      muted={muted}
      playsInline={playsInline}
      className={className}
      style={style}
      crossOrigin={crossOrigin}
      {...rest}
    />
  );
};
