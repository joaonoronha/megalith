import React from 'react';
import { trackEvent, AnalyticsEvents } from '@megalith/analytics';
import { useI18n } from '../i18n';
import { WEDDING_CONFIG } from '../config/wedding';
import { calculateCountdown, CountdownResult } from '../utils/countdown';
import { downloadWeddingCalendar } from '../utils/calendar';
import { LanguageSwitcher } from './LanguageSwitcher';
import {
  SaveTheDateVideo,
  requestVideoFullscreen,
  exitVideoFullscreen,
  playWithAudioFadeIn,
} from './SaveTheDateVideo';

export interface SaveTheDateGateProps {
  readonly className?: string;
  readonly unlockUtc?: string;
  readonly videoUrl?: string;
  readonly posterUrl?: string;
  readonly initialShowIntro?: boolean;
}

/**
 * SaveTheDateGate component rendering the bespoke watercolor aesthetic
 * faithful to screenshot.PNG:
 * - Top-left botanical branch overlay
 * - Editorial typography: "SAVE THE DATE", "Madalena & João", "16 · 08 · 2027"
 * - Romantic intro quote
 * - Gold double-rimmed video card with click-to-fullscreen
 * - Venue banner: "QUINTA DA GRILLA · PORTUGAL"
 * - Countdown card: "REVELAMOS MAIS DA NOSSA HISTÓRIA EM..." with days/hours/minutes/seconds
 * - "GUARDAR A DATA" calendar integration button
 * - Closing love quote and "M | J" monogram
 * - Quinta da Grilla watercolor illustration at the base
 */
export const SaveTheDateGate: React.FC<SaveTheDateGateProps> = ({
  className = '',
  unlockUtc = WEDDING_CONFIG.saveTheDate.unlockUtc,
  videoUrl = WEDDING_CONFIG.saveTheDate.videoUrl,
  posterUrl = '/assets/save-the-date-poster.jpg',
  initialShowIntro = true,
}) => {
  const { t } = useI18n();
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const countdownRef = React.useRef<HTMLElement>(null);

  const isIntroDisabled = React.useMemo(() => {
    if (typeof window === 'undefined' || !window.location) return false;
    try {
      const val = new URLSearchParams(window.location.search).get('intro');
      return val === 'false' || val === '0';
    } catch {
      return false;
    }
  }, []);

  const [introState, setIntroState] = React.useState<'active' | 'zooming' | 'dismissed'>(
    initialShowIntro && !isIntroDisabled ? 'active' : 'dismissed'
  );

  React.useEffect(() => {
    if (introState !== 'dismissed') {
      const originalBodyOverflow = document.body.style.overflow;
      const originalHtmlOverflow = document.documentElement.style.overflow;
      const originalTouchAction = document.body.style.touchAction;

      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';

      const preventTouchMove = (e: TouchEvent) => {
        e.preventDefault();
      };

      window.addEventListener('touchmove', preventTouchMove, { passive: false });

      return () => {
        document.body.style.overflow = originalBodyOverflow;
        document.documentElement.style.overflow = originalHtmlOverflow;
        document.body.style.touchAction = originalTouchAction;
        window.removeEventListener('touchmove', preventTouchMove);
      };
    }
  }, [introState]);

  const [countdown, setCountdown] = React.useState<CountdownResult>(() =>
    calculateCountdown(unlockUtc)
  );

  React.useEffect(() => {
    setCountdown(calculateCountdown(unlockUtc));

    const interval = window.setInterval(() => {
      setCountdown(calculateCountdown(unlockUtc));
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [unlockUtc]);

  React.useEffect(() => {
    trackEvent(AnalyticsEvents.WEDDING_VIEWED, {
      unlock_utc: unlockUtc,
    });
  }, [unlockUtc]);

  const handleStartExperience = () => {
    if (introState !== 'active') return;

    trackEvent(AnalyticsEvents.WEDDING_INTRO_DISMISSED);
    trackEvent(AnalyticsEvents.WEDDING_VIDEO_STARTED);
    setIntroState('zooming');

    // Allow the high-velocity center suck-in zoom and black backdrop transition to complete (550ms)
    // before entering fullscreen video playback and starting the audio fade-in ramp.
    window.setTimeout(() => {
      const video = videoRef.current;
      if (video) {
        requestVideoFullscreen(video);
        playWithAudioFadeIn(video, 1.0, 1800);
      }
      setIntroState('dismissed');
    }, 550);
  };

  const handleVideoEnded = React.useCallback(() => {
    trackEvent(AnalyticsEvents.WEDDING_VIDEO_COMPLETED);
    exitVideoFullscreen(videoRef.current);
  }, []);

  return (
    <main className={`save-the-date-gate-root ${className}`}>
      {/* Fixed Full-Bleed Viewport Background Layer for Mobile Safari / iPhone 15 Pro Max */}
      <div className="save-the-date-bg-layer" aria-hidden="true" />

      {/* Botanical Leaves in Top-Left Corner */}
      <img
        src="/assets/save-the-date-top-left.png"
        alt=""
        className="screenshot-top-left-branch"
        aria-hidden="true"
      />

      {/* Intro Overlay (Loading Splash Screen with Suck-in Zoom & Black Backdrop) */}
      {introState !== 'dismissed' && (
        <div
          className={`save-the-date-intro-overlay ${
            introState === 'zooming' ? 'zooming' : ''
          }`}
          role="dialog"
          aria-modal="true"
          aria-label="Save the Date Introduction"
        >
          {/* Seamless Black Backdrop during suck-in transition to fullscreen */}
          <div className="intro-black-backdrop" aria-hidden="true" />
          <div className="intro-frame" aria-hidden="true" />
          <div className="intro-content">
            <h1 className="intro-names" data-testid="intro-names">
              <span className="intro-name-madalena" data-testid="intro-name-madalena">
                Madalena
              </span>
              <span className="intro-ampersand">&amp;</span>
              <span className="intro-name-joao" data-testid="intro-name-joao">
                João
              </span>
            </h1>

            <div className="intro-divider" aria-hidden="true">
              <span className="intro-divider-line" />
              <span className="intro-divider-diamond">✦</span>
              <span className="intro-divider-line" />
            </div>

            <button
              type="button"
              className="intro-pulse-btn"
              onClick={handleStartExperience}
              data-testid="intro-save-the-date-button"
            >
              <span className="pulse-btn-text">{t.saveTheDate.badge}</span>
              <span className="pulse-btn-glow" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* Top Header with Language Selector Capsule */}
      <header className="save-the-date-header">
        <div className="header-nav-container">
          <LanguageSwitcher separator="bar" className="save-the-date-lang-capsule" />
        </div>
      </header>

      {/* Main Editorial Content */}
      <div className="save-the-date-content-container">
        {/* 1. Top Section: Badge, Names, Date, Quote */}
        <section className="screenshot-hero-intro" aria-label="Save the date header">
          <p className="screenshot-badge">{t.saveTheDate.badge}</p>
          <h1 className="screenshot-names">{WEDDING_CONFIG.coupleDisplayName}</h1>
          <p className="screenshot-date">16 · 08 · 2027</p>

          <div className="screenshot-diamond" aria-hidden="true">
            ✦
          </div>

          <div className="screenshot-intro-quote">
            <p>{t.saveTheDate.quoteIntro1}</p>
            <p>{t.saveTheDate.quoteIntro2}</p>
          </div>
        </section>

        {/* 2. Video Player Section with Baroque Gold Frame */}
        <section
          id="video-section"
          className="screenshot-media-section"
          aria-label={t.saveTheDate.videoAriaLabel}
        >
          <SaveTheDateVideo
            src={videoUrl}
            poster={posterUrl}
            videoRef={videoRef}
            onVideoEnded={handleVideoEnded}
          />
        </section>

        {/* 3. Countdown Card */}
        <section
          ref={countdownRef}
          role="region"
          aria-live="polite"
          aria-label={t.saveTheDate.countdownHeading}
          className="screenshot-countdown-card"
          data-testid="save-the-date-countdown-card"
        >
          <h3 className="screenshot-countdown-title">
            {t.saveTheDate.countdownHeading}
          </h3>

          <div className="screenshot-countdown-grid">
            {/* Days */}
            <div className="countdown-col">
              <span className="countdown-num" data-testid="gate-countdown-days">
                {countdown.days}
              </span>
              <span className="countdown-unit-txt">{t.countdownUnits.days.toUpperCase()}</span>
            </div>

            <span className="countdown-bar-separator" aria-hidden="true" />

            {/* Hours */}
            <div className="countdown-col">
              <span className="countdown-num" data-testid="gate-countdown-hours">
                {String(countdown.hours).padStart(2, '0')}
              </span>
              <span className="countdown-unit-txt">{t.countdownUnits.hours.toUpperCase()}</span>
            </div>

            <span className="countdown-bar-separator" aria-hidden="true" />

            {/* Minutes */}
            <div className="countdown-col">
              <span className="countdown-num" data-testid="gate-countdown-minutes">
                {String(countdown.minutes).padStart(2, '0')}
              </span>
              <span className="countdown-unit-txt">{t.countdownUnits.minutes.toUpperCase()}</span>
            </div>

            <span className="countdown-bar-separator" aria-hidden="true" />

            {/* Seconds */}
            <div className="countdown-col">
              <span className="countdown-num" data-testid="gate-countdown-seconds">
                {String(countdown.seconds).padStart(2, '0')}
              </span>
              <span className="countdown-unit-txt">{t.countdownUnits.seconds.toUpperCase()}</span>
            </div>
          </div>

          <p className="screenshot-countdown-subtext">
            {t.saveTheDate.countdownSubtext}
          </p>
        </section>

        {/* 5. "GUARDAR A DATA" Calendar Button */}
        <div id="calendar-section" className="screenshot-calendar-action">
          <button
            type="button"
            className="screenshot-guardar-btn"
            onClick={() => {
              trackEvent(AnalyticsEvents.WEDDING_CALENDAR_SAVED);
              downloadWeddingCalendar();
            }}
            data-testid="guardar-data-button"
            aria-label={t.saveTheDate.calendarButton}
          >
            <svg
              className="calendar-btn-svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
              <line x1="8" y1="14" x2="8.01" y2="14" />
              <line x1="12" y1="14" x2="12.01" y2="14" />
              <line x1="16" y1="14" x2="16.01" y2="14" />
              <line x1="8" y1="18" x2="8.01" y2="18" />
              <line x1="12" y1="18" x2="12.01" y2="18" />
              <line x1="16" y1="18" x2="16.01" y2="18" />
            </svg>
            <span>{t.saveTheDate.calendarButton}</span>
          </button>
        </div>

        {/* 6. Closing Romantic Quote & Monogram */}
        <section className="screenshot-closing-section">
          <div className="screenshot-diamond" aria-hidden="true">
            ✦
          </div>
          <div className="screenshot-closing-quote">
            <p>{t.saveTheDate.closingQuote1}</p>
            <p>{t.saveTheDate.closingQuote2}</p>
            <p>{t.saveTheDate.closingQuote3}</p>
          </div>

          <div className="screenshot-monogram" aria-label="Monograma Madalena e João">
            <span className="monogram-letter">M</span>
            <span className="monogram-divider" aria-hidden="true" />
            <span className="monogram-letter">J</span>
          </div>
        </section>
      </div>

      {/* 7. Quinta da Grilla Illustration at Bottom (Full-bleed edge-to-edge, zero margin/padding gap) */}
      <footer className="screenshot-quinta-container" aria-hidden="true">
        <img
          src="/assets/save-the-date-quinta.png"
          alt="Quinta da Grilla"
          className="screenshot-quinta-img"
          loading="lazy"
        />
      </footer>
    </main>
  );
};

export default SaveTheDateGate;
