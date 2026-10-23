import React from 'react';
import { useI18n } from '../i18n';
import { LiquidGlassCanvas } from './LiquidGlassCanvas';

/**
 * Reusable irregular, organic rounded-rectangle shape as an SVG path
 * using cubic Bézier curves with gently bulging edges (vintage hand-cut frame look).
 * Normalized to 0-1 coordinates so it scales responsively with any container.
 */
export const WAVY_FRAME_PATH =
  'M 0.08 0.05 ' +
  'C 0.18 0.02, 0.32 0.05, 0.40 0.03 ' +
  'C 0.48 0.01, 0.58 0.01, 0.66 0.03 ' +
  'C 0.75 0.05, 0.86 0.02, 0.92 0.05 ' +
  'C 0.97 0.08, 0.99 0.15, 0.98 0.22 ' +
  'C 0.96 0.34, 0.99 0.46, 0.97 0.55 ' +
  'C 0.96 0.66, 0.99 0.78, 0.97 0.86 ' +
  'C 0.95 0.93, 0.89 0.98, 0.82 0.96 ' +
  'C 0.74 0.94, 0.62 0.98, 0.52 0.96 ' +
  'C 0.42 0.94, 0.30 0.98, 0.20 0.96 ' +
  'C 0.12 0.95, 0.06 0.92, 0.04 0.85 ' +
  'C 0.02 0.76, 0.05 0.62, 0.03 0.52 ' +
  'C 0.02 0.40, 0.05 0.28, 0.04 0.18 ' +
  'C 0.03 0.10, 0.05 0.07, 0.08 0.05 Z';

export interface SaveTheDateVideoProps {
  readonly src: string;
  readonly poster?: string;
  readonly className?: string;
  readonly videoRef?: React.RefObject<HTMLVideoElement | null>;
  readonly onVideoEnded?: () => void;
}

/**
 * Requests native fullscreen across standard browsers and iOS Safari WebKit.
 */
export function requestVideoFullscreen(video: HTMLVideoElement): void {
  try {
    if (video.requestFullscreen) {
      video.requestFullscreen().catch(() => {});
    } else if (typeof (video as any).webkitEnterFullscreen === 'function') {
      (video as any).webkitEnterFullscreen();
    } else if (typeof (video as any).webkitRequestFullscreen === 'function') {
      (video as any).webkitRequestFullscreen();
    } else if (typeof (video as any).mozRequestFullScreen === 'function') {
      (video as any).mozRequestFullScreen();
    } else if (typeof (video as any).msRequestFullscreen === 'function') {
      (video as any).msRequestFullscreen();
    }
  } catch {
    // Graceful fallback
  }
}

/**
 * Exits native fullscreen across iOS Safari WebKit and standard Document Fullscreen API.
 */
export function exitVideoFullscreen(video?: HTMLVideoElement | null): void {
  try {
    if (video) {
      if (typeof (video as any).webkitExitFullscreen === 'function') {
        (video as any).webkitExitFullscreen();
      } else if (typeof (video as any).webkitExitFullScreen === 'function') {
        (video as any).webkitExitFullScreen();
      }
    }

    if (typeof document !== 'undefined') {
      const isDocFullscreen = Boolean(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement ||
        (document as any).webkitIsFullScreen ||
        (document as any).fullscreen
      );

      if (isDocFullscreen || !video) {
        if (typeof document.exitFullscreen === 'function') {
          document.exitFullscreen().catch(() => {});
        } else if (typeof (document as any).webkitExitFullscreen === 'function') {
          (document as any).webkitExitFullscreen();
        } else if (typeof (document as any).webkitCancelFullScreen === 'function') {
          (document as any).webkitCancelFullScreen();
        } else if (typeof (document as any).mozCancelFullScreen === 'function') {
          (document as any).mozCancelFullScreen();
        } else if (typeof (document as any).msExitFullscreen === 'function') {
          (document as any).msExitFullscreen();
        }
      }
    }
  } catch {
    // Graceful fallback
  }
}

/**
 * Starts video playback with a smooth visual opacity fade-in and volume fade-in ramp.
 * Returns a cleanup function that cancels the interval if needed.
 */
export function playWithAudioFadeIn(
  video: HTMLVideoElement,
  targetVolume: number = 1.0,
  durationMs: number = 1800
): () => void {
  try {
    video.classList.add('fading-in');
    video.muted = false;
    video.volume = 0;
  } catch {
    // Graceful fallback if properties are restricted in certain environments
  }

  video.play().catch(() => {});

  const intervalTime = 50;
  const steps = Math.max(1, Math.round(durationMs / intervalTime));
  const volumeIncrement = targetVolume / steps;
  let currentStep = 0;

  const timer = window.setInterval(() => {
    currentStep += 1;
    try {
      const nextVolume = Math.min(targetVolume, currentStep * volumeIncrement);
      video.volume = nextVolume;
      if (nextVolume >= targetVolume || currentStep >= steps) {
        video.volume = targetVolume;
        window.clearInterval(timer);
      }
    } catch {
      window.clearInterval(timer);
    }
  }, intervalTime);

  return () => {
    window.clearInterval(timer);
  };
}

/**
 * SaveTheDateVideo component displaying a video inside an organic wavy hand-cut frame
 * with a thin diagonal gold gradient outline and a centered glass play button.
 */
export const SaveTheDateVideo: React.FC<SaveTheDateVideoProps> = ({
  src,
  poster = '/assets/save-the-date-poster.jpg',
  className = '',
  videoRef: externalVideoRef,
  onVideoEnded,
}) => {
  const { t } = useI18n();
  const internalVideoRef = React.useRef<HTMLVideoElement>(null);
  const videoRef = externalVideoRef || internalVideoRef;
  const [isPlaying, setIsPlaying] = React.useState<boolean>(false);
  const hasEndedRef = React.useRef<boolean>(false);

  const handleTogglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused || video.ended) {
      hasEndedRef.current = false;
      requestVideoFullscreen(video);
      video
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const handlePlay = () => {
    hasEndedRef.current = false;
    setIsPlaying(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    hasEndedRef.current = true;
    const video = videoRef.current;
    exitVideoFullscreen(video);
    onVideoEnded?.();
  };

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleWebkitEndFullscreen = () => {
      setIsPlaying(false);
      if (video.ended || hasEndedRef.current) {
        onVideoEnded?.();
      }
    };

    const handleFullscreenChange = () => {
      const isFullscreen = Boolean(
        (typeof document !== 'undefined' &&
          (document.fullscreenElement ||
            (document as any).webkitFullscreenElement ||
            (document as any).webkitIsFullScreen)) ||
          (video as any).webkitDisplayingFullscreen
      );

      if (!isFullscreen && (video.ended || hasEndedRef.current)) {
        setIsPlaying(false);
        onVideoEnded?.();
      }
    };

    video.addEventListener('webkitendfullscreen', handleWebkitEndFullscreen);
    if (typeof document !== 'undefined') {
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    }

    return () => {
      video.removeEventListener('webkitendfullscreen', handleWebkitEndFullscreen);
      if (typeof document !== 'undefined') {
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
        document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      }
    };
  }, [onVideoEnded, videoRef]);

  return (
    <div className={`save-the-date-video-wrapper ${className}`}>
      {/* 1. Inline SVG clipPath definition for wavy organic frame */}
      <svg
        width="0"
        height="0"
        className="wavy-frame-defs"
        aria-hidden="true"
        style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
      >
        <defs>
          <clipPath id="frame" clipPathUnits="objectBoundingBox">
            <path d={WAVY_FRAME_PATH} />
          </clipPath>
        </defs>
      </svg>

      {/* 2. Container with aspect-ratio 4/3 and width: 100% */}
      <div className="wavy-video-container video-frame">
        {/* Clipped Video */}
        <div className="wavy-video-clip">
          <video
            ref={videoRef}
            className="wavy-video-element save-the-date-video-element"
            src={src}
            poster={poster}
            playsInline
            controls={isPlaying}
            preload="auto"
            onClick={handleTogglePlay}
            onPlay={handlePlay}
            onPause={handlePause}
            onEnded={handleEnded}
            aria-label={t.saveTheDate.videoAriaLabel}
            data-testid="save-the-date-video"
          >
            <source src={src} type="video/quicktime" />
            <source src={src} type="video/mp4" />
            {t.saveTheDate.videoFallback}
          </video>
        </div>

        {/* 3. Gold Outline Overlay (Diagonal linearGradient #E8C987, #A67C37, #F1D9A0) */}
        <svg
          className="wavy-video-outline"
          viewBox="0 0 1 1"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#E8C987" />
              <stop offset="50%" stopColor="#A67C37" />
              <stop offset="100%" stopColor="#F1D9A0" />
            </linearGradient>
          </defs>
          <path
            d={WAVY_FRAME_PATH}
            fill="none"
            stroke="url(#goldGradient)"
            strokeWidth="3"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* 4. Play Button Overlay: Centered liquid glass distortion button */}
        {!isPlaying && (
          <div
            className="wavy-video-overlay"
            onClick={handleTogglePlay}
            data-testid="video-overlay"
          >
            <button
              type="button"
              className="wavy-play-button"
              onClick={(e) => {
                e.stopPropagation();
                handleTogglePlay();
              }}
              aria-label={t.saveTheDate.playPrompt}
              data-testid="video-play-button"
            >
              <LiquidGlassCanvas
                width={70}
                height={70}
                posterUrl={poster}
                videoRef={videoRef}
              />
              <svg
                className="wavy-play-triangle"
                viewBox="0 0 24 24"
                width="28"
                height="28"
                style={{ width: '28px', height: '28px', flexShrink: 0, zIndex: 2 }}
                aria-hidden="true"
              >
                <path d="M8 5v14l11-7z" fill="#ffffff" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
